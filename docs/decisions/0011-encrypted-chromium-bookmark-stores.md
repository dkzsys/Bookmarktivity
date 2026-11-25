# 0011: Read encrypted Chromium bookmark stores

Status: Accepted

Date: 2026-11-25

Supersedes the encrypted-storage consequences of [0008](0008-chromium-browser-sources.md).

## Decision

Decrypt `EncryptedBookmarks2` and `EncryptedAccountBookmarks2` (falling back to the unsuffixed names), and treat a decrypted store as the source of truth. This matches Chromium's default `write_both_read_prefer_encrypted` stage. Its later `write_only_encrypted_read_prefer_encrypted` stage deletes the clear-text file, so encrypted-only profiles will become common.

Each encrypted file is one OSCrypt blob: a three-byte version prefix followed by the ciphertext of the same JSON the clear-text file holds. Keys are read only from the operating system, never written.

| Platform | Prefix | Cipher and key | Supported |
|---|---|---|---|
| macOS | `v10` | AES-128-CBC with an IV of 16 spaces. The key is PBKDF2-HMAC-SHA1 (salt `saltysalt`, 1003 iterations) of the browser's Keychain item, such as "Chrome Safe Storage", "Brave Safe Storage" or "Microsoft Edge Safe Storage". | Yes |
| Windows | `v10` | AES-256-GCM with a 12-byte nonce. The key is `os_crypt.encrypted_key` in `Local State`, unwrapped with DPAPI for the current user. | Yes, compile-checked only |
| Windows | `v20` | App-bound encryption, which only the browser's elevated service can unwrap | No |
| Linux | `v10` | AES-128-CBC with the fixed password `peanuts` and one iteration | Yes, untested |
| Linux | `v11` | As `v10`, with a password from the desktop keyring (libsecret) | No |

Reading rules for each store (`Bookmarks`, `AccountBookmarks`):

1. If an encrypted file exists and decrypts to valid bookmark JSON, use it. The JSON parse also catches a wrong key that happens to produce valid padding.
2. If decryption fails and a clear-text copy exists, use the clear-text copy and show a profile warning. The warning names the store and the reason, such as Keychain access being denied, and says the results may be stale.
3. If decryption fails and there is no clear-text copy, fail the profile read, so the app never returns a partial collection.
4. If there is no encrypted file, read the clear-text file as before.

A key is cached in memory per browser, user-data directory and blob version for the life of the process. The OS is asked once per run, not once per profile or re-read. Keys and decrypted data are never written to disk.

## Consequences

- On macOS, the first read of an encrypted profile triggers a Keychain prompt for each browser. If the user declines, they still get clear-text snapshots with a warning while those exist. Code signing affects how the prompt is attributed and whether "Always Allow" survives updates.
- Unsupported formats (`v20` on Windows, `v11` on Linux) produce a specific message rather than a generic failure.
- Decryption is limited to the selected, enabled profile's bookmark files. No other OSCrypt-protected data is read.
- Tests use synthetic blobs and a fixed key provider. An ignored test (`live_profiles_decrypt`) reads the local machine's real profiles and prints only counts, for manual validation.

## Validation

- 2026-11-25 on macOS (Apple Silicon): nine real profiles (six Chrome, one Brave, two Edge) read through the Keychain with no fallback warnings.
- Windows: type-checked for `x86_64-pc-windows-msvc`. A run on a real Windows profile is still needed, including a check of whether the browser writes `v10` or `v20`.
- Linux: not compiled or run.
