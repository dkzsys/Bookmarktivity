//! Read-only decryption of Chromium OSCrypt blobs, used for `EncryptedBookmarks2` and
//! `EncryptedAccountBookmarks2`.
//!
//! A blob is a three-byte version prefix followed by ciphertext:
//! - `v10` on macOS: AES-128-CBC, key = PBKDF2-HMAC-SHA1(Keychain "<Browser> Safe Storage"
//!   password, "saltysalt", 1003 iterations), IV = 16 spaces.
//! - `v10` on Linux: the same cipher with the fixed password "peanuts" and one iteration.
//! - `v11` on Linux: as `v10`, but the password comes from the desktop keyring (not supported).
//! - `v10` on Windows: AES-256-GCM with a 12-byte nonce, keyed by the DPAPI-protected
//!   `os_crypt.encrypted_key` in `Local State`.
//! - `v20` on Windows: app-bound encryption, which only the browser's own service can unwrap
//!   (not supported).
//!
//! Keys are only ever read, never written, and are kept in memory for the life of the process
//! so the operating system asks for access once rather than on every re-read.

use std::{
    collections::HashMap,
    path::Path,
    sync::{Mutex, OnceLock},
};

#[derive(Clone)]
pub enum StoreKey {
    Cbc([u8; 16]),
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    Gcm([u8; 32]),
}

pub trait KeyProvider {
    /// Returns the key for blobs with `version` (such as `v10`) written by `browser_id`.
    fn key(&self, browser_id: &str, user_data_dir: &Path, version: &str) -> Result<StoreKey, String>;
}

pub fn decrypt(blob: &[u8], key: &StoreKey) -> Result<Vec<u8>, String> {
    let data = blob.get(3..).ok_or("The encrypted file is too short.")?;
    match key {
        StoreKey::Cbc(key) => {
            use cbc::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
            cbc::Decryptor::<aes::Aes128>::new(key.into(), &[b' '; 16].into())
                .decrypt_padded_vec_mut::<Pkcs7>(data)
                .map_err(|_| "The encrypted file could not be decrypted with the browser's key.".into())
        }
        StoreKey::Gcm(key) => {
            use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
            if data.len() < 12 + 16 {
                return Err("The encrypted file is too short.".into());
            }
            let (nonce, ciphertext) = data.split_at(12);
            Aes256Gcm::new(key.into())
                .decrypt(Nonce::from_slice(nonce), ciphertext)
                .map_err(|_| "The encrypted file could not be decrypted with the browser's key.".into())
        }
    }
}

pub fn version(blob: &[u8]) -> Result<&str, String> {
    blob.get(..3)
        .and_then(|prefix| std::str::from_utf8(prefix).ok())
        .filter(|prefix| prefix.starts_with('v') && prefix[1..].bytes().all(|b| b.is_ascii_digit()))
        .ok_or_else(|| "The encrypted file has an unrecognised format.".into())
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
pub fn cbc_key(password: &[u8], iterations: u32) -> StoreKey {
    let mut key = [0u8; 16];
    pbkdf2::pbkdf2_hmac::<sha1::Sha1>(password, b"saltysalt", iterations, &mut key);
    StoreKey::Cbc(key)
}

/// Keychain service and account names for each browser's "Safe Storage" item.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn keychain_item(browser_id: &str) -> Option<(&'static str, &'static str)> {
    match browser_id {
        "chrome" => Some(("Chrome Safe Storage", "Chrome")),
        "brave" => Some(("Brave Safe Storage", "Brave")),
        "edge" => Some(("Microsoft Edge Safe Storage", "Microsoft Edge")),
        "chromium" => Some(("Chromium Safe Storage", "Chromium")),
        _ => None,
    }
}

/// Reads keys from the operating system and caches each one for the process lifetime.
pub struct SystemKeys;

fn cache() -> &'static Mutex<HashMap<String, StoreKey>> {
    static CACHE: OnceLock<Mutex<HashMap<String, StoreKey>>> = OnceLock::new();
    CACHE.get_or_init(Default::default)
}

impl KeyProvider for SystemKeys {
    fn key(&self, browser_id: &str, user_data_dir: &Path, version: &str) -> Result<StoreKey, String> {
        let cache_key = serde_json::to_string(&(browser_id, user_data_dir, version))
            .map_err(|error| error.to_string())?;
        if let Some(bytes) = cache().lock().map_err(|_| "Key cache unavailable.")?.get(&cache_key) {
            return Ok(bytes.clone());
        }
        let key = system_key(browser_id, user_data_dir, version)?;
        cache()
            .lock()
            .map_err(|_| "Key cache unavailable.")?
            .insert(cache_key, key.clone());
        Ok(key)
    }
}

#[cfg(target_os = "macos")]
fn system_key(browser_id: &str, _user_data_dir: &Path, version: &str) -> Result<StoreKey, String> {
    if version != "v10" {
        return Err(format!("Encryption version {version} is not supported on macOS."));
    }
    let (service, account) = keychain_item(browser_id)
        .ok_or_else(|| format!("No Keychain item is known for browser {browser_id}."))?;
    let password = security_framework::passwords::get_generic_password(service, account).map_err(|error| {
        match error.code() {
            -128 | -25293 => format!("Keychain access to \"{service}\" was not allowed."),
            -25300 => format!("The Keychain item \"{service}\" was not found."),
            _ => format!("Keychain access to \"{service}\" failed: {error}"),
        }
    })?;
    Ok(cbc_key(&password, 1003))
}

#[cfg(target_os = "linux")]
fn system_key(_browser_id: &str, _user_data_dir: &Path, version: &str) -> Result<StoreKey, String> {
    match version {
        "v10" => Ok(cbc_key(b"peanuts", 1)),
        "v11" => Err("This store is protected by the desktop keyring, which Bookmarktivity cannot read yet.".into()),
        _ => Err(format!("Encryption version {version} is not supported on Linux.")),
    }
}

#[cfg(target_os = "windows")]
fn system_key(_browser_id: &str, user_data_dir: &Path, version: &str) -> Result<StoreKey, String> {
    use base64::Engine;
    match version {
        "v10" => {}
        "v20" => return Err("This store uses the browser's app-bound encryption, which other apps cannot read.".into()),
        _ => return Err(format!("Encryption version {version} is not supported on Windows.")),
    }
    let state: serde_json::Value = serde_json::from_slice(
        &std::fs::read(user_data_dir.join("Local State"))
            .map_err(|error| format!("Cannot read the browser's Local State: {error}"))?,
    )
    .map_err(|error| format!("Cannot parse the browser's Local State: {error}"))?;
    let wrapped = state
        .pointer("/os_crypt/encrypted_key")
        .and_then(serde_json::Value::as_str)
        .ok_or("The browser's Local State has no encryption key.")?;
    let wrapped = base64::engine::general_purpose::STANDARD
        .decode(wrapped)
        .map_err(|_| "The browser's encryption key is malformed.")?;
    let wrapped = wrapped
        .strip_prefix(b"DPAPI")
        .ok_or("The browser's encryption key is not DPAPI-protected.")?;
    let key = dpapi_unprotect(wrapped)?;
    let key: [u8; 32] = key
        .try_into()
        .map_err(|_| "The browser's encryption key has an unexpected length.")?;
    Ok(StoreKey::Gcm(key))
}

#[cfg(target_os = "windows")]
fn dpapi_unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB},
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    // SAFETY: `input` points at `data` for the duration of the call; on success Windows
    // allocates `output`, which is copied and then released with LocalFree.
    unsafe {
        if CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            &mut output,
        ) == 0
        {
            return Err("Windows could not unprotect the browser's encryption key.".into());
        }
        let key = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as _);
        Ok(key)
    }
}

#[cfg(test)]
pub mod testing {
    use super::*;

    /// A fixed key for synthetic fixtures, standing in for the operating-system key.
    pub struct FixedKey(pub &'static [u8]);

    impl KeyProvider for FixedKey {
        fn key(&self, _: &str, _: &Path, version: &str) -> Result<StoreKey, String> {
            match version {
                "v10" => Ok(cbc_key(self.0, 1003)),
                _ => Err(format!("Encryption version {version} is not supported.")),
            }
        }
    }

    pub fn encrypt_cbc(password: &[u8], plaintext: &[u8]) -> Vec<u8> {
        use cbc::cipher::{block_padding::Pkcs7, BlockEncryptMut, KeyIvInit};
        let StoreKey::Cbc(key) = cbc_key(password, 1003) else { unreachable!() };
        let mut out = b"v10".to_vec();
        out.extend(
            cbc::Encryptor::<aes::Aes128>::new(&key.into(), &[b' '; 16].into())
                .encrypt_padded_vec_mut::<Pkcs7>(plaintext),
        );
        out
    }

    #[test]
    fn decrypts_cbc_and_gcm_and_rejects_wrong_keys() {
        let blob = encrypt_cbc(b"secret", br#"{"roots":{}}"#);
        assert_eq!(version(&blob).unwrap(), "v10");
        assert_eq!(decrypt(&blob, &cbc_key(b"secret", 1003)).unwrap(), br#"{"roots":{}}"#);
        let wrong = decrypt(&blob, &cbc_key(b"other", 1003));
        assert!(wrong.map_or(true, |plain| plain != br#"{"roots":{}}"#));

        use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
        let key = [7u8; 32];
        let nonce = [9u8; 12];
        let mut blob = b"v10".to_vec();
        blob.extend_from_slice(&nonce);
        blob.extend(Aes256Gcm::new(&key.into()).encrypt(Nonce::from_slice(&nonce), &b"hello"[..]).unwrap());
        assert_eq!(decrypt(&blob, &StoreKey::Gcm(key)).unwrap(), b"hello");
        assert!(decrypt(&blob, &StoreKey::Gcm([8u8; 32])).is_err());
        assert!(version(b"{\n ").is_err());
    }
}
