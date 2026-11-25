use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};

mod os_crypt;

pub use browser_model::{profile_key, Bookmark, Folder, Profile, ProfileData, Source};
use os_crypt::KeyProvider;

fn bookmark_file_exists(path: &Path) -> Result<bool, String> {
    for name in [
        "Bookmarks",
        "AccountBookmarks",
        "EncryptedBookmarks2",
        "EncryptedAccountBookmarks2",
        "EncryptedBookmarks",
        "EncryptedAccountBookmarks",
    ] {
        match fs::metadata(path.join(name)) {
            Ok(metadata) if metadata.is_file() => return Ok(true),
            Ok(_) => {},
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {},
            Err(error) => return Err(format!("Cannot inspect {name} in a browser profile: {error}")),
        }
    }
    Ok(false)
}

pub fn discover(
    browser_id: &str,
    candidates: Vec<PathBuf>,
    override_dir: Option<&str>,
) -> Result<Vec<Profile>, String> {
    let Some(root) = browser_model::resolve_root(browser_id, candidates, override_dir)? else {
        return Ok(Vec::new());
    };
    let names = fs::read(root.join("Local State"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|state| state.pointer("/profile/info_cache").cloned())
        .unwrap_or(Value::Null);
    let mut profiles = Vec::new();
    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        let folder_id = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("");
        if !(folder_id == "Default" || folder_id.starts_with("Profile ")) {
            continue;
        }
        let metadata = fs::metadata(&path).map_err(|error| format!("Cannot inspect a browser profile: {error}"))?;
        if !metadata.is_dir() || !bookmark_file_exists(&path)? {
            continue;
        }
        let name = names
            .get(folder_id)
            .and_then(|profile| profile.get("name"))
            .and_then(Value::as_str)
            .unwrap_or(folder_id)
            .to_string();
        profiles.push(Profile {
            id: profile_key(browser_id, &root, folder_id),
            folder_id: folder_id.to_string(),
            name,
            browser_id: browser_id.to_string(),
            user_data_dir: root.to_string_lossy().to_string(),
        });
    }
    profiles.sort_by(|a, b| a.folder_id.cmp(&b.folder_id));
    Ok(profiles)
}

fn chromium_time(node: &Value, key: &str) -> Option<i64> {
    node.get(key)?
        .as_str()?
        .parse::<i64>()
        .ok()
        .map(|microseconds| microseconds / 1000 - 11_644_473_600_000)
        .filter(|timestamp| *timestamp >= 0)
}

fn visit(
    node: &Value,
    parent_id: Option<&str>,
    store: &str,
    source: &Source,
    output: &mut ProfileData,
) {
    let raw_id = node
        .get("guid")
        .and_then(Value::as_str)
        .or_else(|| node.get("id").and_then(Value::as_str))
        .unwrap_or("");
    let id = browser_model::node_key(&source.profile_id, store, raw_id);
    let name = node
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    match node.get("type").and_then(Value::as_str) {
        Some("folder") => {
            output.folders.push(Folder {
                kind: "folder",
                id: id.clone(),
                parent_id: parent_id.map(str::to_string),
                name,
                source: source.clone(),
                date_added: chromium_time(node, "date_added"),
                date_modified: chromium_time(node, "date_modified"),
            });
            if let Some(children) = node.get("children").and_then(Value::as_array) {
                for child in children {
                    visit(child, Some(&id), store, source, output);
                }
            }
        }
        Some("url") => {
            if let Some(url) = node.get("url").and_then(Value::as_str) {
                output.bookmarks.push(Bookmark {
                    kind: "bookmark",
                    id,
                    parent_id: parent_id.map(str::to_string),
                    name,
                    url: url.to_string(),
                    source: source.clone(),
                    date_added: chromium_time(node, "date_added"),
                    date_modified: None,
                });
            }
        }
        _ => {}
    }
}

pub fn read_profile(profile: &Profile) -> Result<ProfileData, String> {
    read_profile_with(profile, &os_crypt::SystemKeys)
}

/// Decrypts an encrypted store and parses it, so a wrong key that happens to yield valid
/// padding is still caught by the JSON check.
fn read_encrypted(file: &Path, profile: &Profile, keys: &dyn KeyProvider) -> Result<Value, String> {
    let blob = fs::read(file).map_err(|error| format!("cannot read the encrypted file: {error}"))?;
    let version = os_crypt::version(&blob)?;
    let key = keys.key(&profile.browser_id, Path::new(&profile.user_data_dir), version)?;
    let plain = os_crypt::decrypt(&blob, &key)?;
    serde_json::from_slice(&plain).map_err(|_| "The decrypted file is not bookmark data.".into())
}

/// Chromium treats the encrypted store as the source of truth when it exists and falls back
/// to clear text otherwise. Bookmarktivity does the same, and when decryption fails it
/// shows the clear-text copy with a staleness warning.
fn read_profile_with(profile: &Profile, keys: &dyn KeyProvider) -> Result<ProfileData, String> {
    let path = Path::new(&profile.user_data_dir).join(&profile.folder_id);
    let mut output = ProfileData {
        folders: Vec::new(),
        bookmarks: Vec::new(),
        warning: None,
    };
    let mut found = false;
    let mut stale = Vec::new();
    for (store, encrypted_names) in [
        ("Bookmarks", ["EncryptedBookmarks2", "EncryptedBookmarks"]),
        (
            "AccountBookmarks",
            ["EncryptedAccountBookmarks2", "EncryptedAccountBookmarks"],
        ),
    ] {
        let clear = path.join(store);
        let encrypted = encrypted_names
            .iter()
            .map(|name| path.join(name))
            .find(|file| file.is_file());
        let read_clear = |file: &Path| -> Result<Value, String> {
            let bytes = fs::read(file).map_err(|error| error.to_string())?;
            serde_json::from_slice(&bytes).map_err(|error| error.to_string())
        };
        let document = match encrypted {
            Some(file) => match read_encrypted(&file, profile, keys) {
                Ok(document) => document,
                Err(reason) if clear.is_file() => {
                    stale.push(format!("{store}: {reason}"));
                    read_clear(&clear)?
                }
                Err(reason) => {
                    return Err(format!(
                        "{store} is available only in encrypted storage, and it could not be read: {reason}"
                    ))
                }
            },
            None if clear.exists() => read_clear(&clear)?,
            None => continue,
        };
        found = true;
        let roots = document
            .get("roots")
            .and_then(Value::as_object)
            .ok_or_else(|| format!("{store} has no bookmark roots."))?;
        let source = Source::of(profile);
        for (key, node) in roots {
            if node.get("type").and_then(Value::as_str) == Some("folder") {
                visit(node, None, store, &source, &mut output);
            } else if key != "sync_transaction_version" && key != "meta_info" {
                return Err(format!(
                    "{store} contains an unsupported bookmark root: {key}."
                ));
            }
        }
    }
    if !found {
        return Err("This profile has no supported bookmark file.".into());
    }
    if !stale.is_empty() {
        output.warning = Some(format!(
            "Showing a clear-text bookmark snapshot because encrypted storage could not be read ({}). These results may be older than the browser's current bookmarks.",
            stale.join("; ")
        ));
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use os_crypt::testing::{encrypt_cbc, FixedKey};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static FIXTURE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    fn fixture_root() -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sequence = FIXTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "bookmarktivity-chromium-{}-{stamp}-{sequence}",
            std::process::id()
        ));
        fs::create_dir_all(root.join("Default")).unwrap();
        fs::write(
            root.join("Local State"),
            r#"{"profile":{"info_cache":{"Default":{"name":"Research"}}}}"#,
        )
        .unwrap();
        fs::write(root.join("Default/Bookmarks"), r#"{"roots":{"bookmark_bar":{"type":"folder","guid":"root","name":"Bar","children":[{"type":"url","guid":"same","name":"Local","url":"https://example.test/local"}]}}}"#).unwrap();
        fs::write(root.join("Default/AccountBookmarks"), r#"{"roots":{"bookmark_bar":{"type":"folder","guid":"root","name":"Account bar","children":[{"type":"url","guid":"same","name":"Account","url":"https://example.test/account"}]}}}"#).unwrap();
        root
    }

    #[test]
    fn keeps_browser_profile_and_store_ids_distinct() {
        let root = fixture_root();
        let other_root = fixture_root();
        let edge = discover("edge", vec![], Some(root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        let chrome = discover("chrome", vec![], Some(root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        let brave = discover("brave", vec![], Some(root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        assert_ne!(edge.id, chrome.id);
        assert_ne!(chrome.id, brave.id);
        let other_chrome = discover("chrome", vec![], Some(other_root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        assert_ne!(chrome.id, other_chrome.id);
        assert_eq!(edge.name, "Research");
        let data = read_profile(&chrome).unwrap();
        assert!(data.warning.is_none());
        assert_eq!(data.bookmarks.len(), 2);
        assert_eq!(data.folders.len(), 2);
        assert_ne!(data.bookmarks[0].id, data.bookmarks[1].id);
        assert_eq!(data.bookmarks[0].source.profile_id, chrome.id);
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(other_root).unwrap();
    }

    #[test]
    fn distinguishes_a_bad_override_from_missing_default_profiles() {
        let root = fixture_root();
        let file = root.join("Local State");
        assert!(discover("edge", vec![], Some(file.to_str().unwrap()))
            .unwrap_err()
            .contains("not a directory"));
        assert!(discover("edge", vec![], None).unwrap().is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    const ACCOUNT_JSON: &str = r#"{"roots":{"bookmark_bar":{"type":"folder","guid":"root","name":"Account bar","children":[{"type":"url","guid":"new","name":"Newer","url":"https://example.test/newer"}]}}}"#;

    #[test]
    fn prefers_decrypted_stores_over_clear_text() {
        let root = fixture_root();
        let profile = discover("chrome", vec![], Some(root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        fs::write(
            root.join("Default/EncryptedAccountBookmarks2"),
            encrypt_cbc(b"synthetic", ACCOUNT_JSON.as_bytes()),
        )
        .unwrap();
        let data = read_profile_with(&profile, &FixedKey(b"synthetic")).unwrap();
        assert!(data.warning.is_none());
        let names: Vec<_> = data.bookmarks.iter().map(|b| b.name.as_str()).collect();
        assert_eq!(names, ["Local", "Newer"]);

        // Encrypted-only stores are read when they decrypt.
        fs::remove_file(root.join("Default/AccountBookmarks")).unwrap();
        let data = read_profile_with(&profile, &FixedKey(b"synthetic")).unwrap();
        assert_eq!(data.bookmarks.len(), 2);
        assert!(data.warning.is_none());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn falls_back_to_clear_text_or_fails_when_decryption_fails() {
        let root = fixture_root();
        let profile = discover("chrome", vec![], Some(root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        fs::write(root.join("Default/EncryptedBookmarks2"), b"encrypted").unwrap();
        fs::write(
            root.join("Default/EncryptedAccountBookmarks2"),
            encrypt_cbc(b"synthetic", ACCOUNT_JSON.as_bytes()),
        )
        .unwrap();
        // Wrong key: both stores fall back to clear text with a warning naming each.
        let data = read_profile_with(&profile, &FixedKey(b"wrong")).unwrap();
        assert_eq!(data.bookmarks.len(), 2);
        let warning = data.warning.unwrap();
        assert!(warning.contains("may be older"));
        assert!(warning.contains("Bookmarks: The encrypted file has an unrecognised format"));
        assert!(warning.contains("AccountBookmarks: "));
        // Right key: only the unreadable store falls back.
        let data = read_profile_with(&profile, &FixedKey(b"synthetic")).unwrap();
        assert!(data.bookmarks.iter().any(|b| b.name == "Newer"));
        assert!(!data.warning.unwrap().contains("AccountBookmarks"));
        // No clear-text copy: the profile read fails instead of returning a partial collection.
        fs::remove_file(root.join("Default/AccountBookmarks")).unwrap();
        assert!(read_profile_with(&profile, &FixedKey(b"wrong"))
            .err()
            .unwrap()
            .contains("AccountBookmarks is available only in encrypted storage, and it could not be read"));
        fs::remove_file(root.join("Default/EncryptedBookmarks2")).unwrap();
        fs::remove_file(root.join("Default/EncryptedAccountBookmarks2")).unwrap();
        fs::write(root.join("Default/AccountBookmarks"), "{}").unwrap();
        assert!(read_profile(&profile)
            .err()
            .unwrap()
            .contains("no bookmark roots"));
        fs::remove_dir_all(root).unwrap();
    }

    /// Reads this machine's real Chrome and Brave profiles through the OS key store and
    /// prints only counts. Run with `cargo test -- --ignored --nocapture live`.
    #[test]
    #[ignore]
    fn live_profiles_decrypt() {
        for browser in ["chrome", "brave", "edge"] {
            let candidates = match browser {
                "chrome" => vec![dirs_home().join("Library/Application Support/Google/Chrome")],
                "brave" => vec![dirs_home().join("Library/Application Support/BraveSoftware/Brave-Browser")],
                _ => vec![dirs_home().join("Library/Application Support/Microsoft Edge")],
            };
            for profile in discover(browser, candidates, None).unwrap_or_default() {
                let encrypted = Path::new(&profile.user_data_dir).join(&profile.folder_id).join("EncryptedBookmarks2").is_file();
                match read_profile(&profile) {
                    Ok(data) => println!(
                        "{browser}/{}: encrypted={encrypted} bookmarks={} folders={} warning={:?}",
                        profile.folder_id, data.bookmarks.len(), data.folders.len(), data.warning
                    ),
                    Err(error) => println!("{browser}/{}: error {error}", profile.folder_id),
                }
            }
        }
    }

    fn dirs_home() -> PathBuf {
        PathBuf::from(std::env::var("HOME").unwrap_or_default())
    }
}
