# Bookmarktivity 0.4.6 (test release)

Bookmarktivity is a read-only bookmark workspace for selected Microsoft Edge, Google Chrome, Brave, Firefox, and Safari sources. Each result retains its browser and profile source.

## What's new since 0.4.5

- **Encrypted Chromium bookmarks are read (BUG-004).** Chrome, Brave, and Edge now keep an encrypted copy of each bookmark file, and Chromium treats it as the current one. Bookmarktivity now decrypts that copy and shows it, so results are no longer limited to an older clear-text snapshot. Profiles that contain only encrypted bookmark files can now be read.
- **macOS Keychain prompt.** The first time Bookmarktivity reads an encrypted profile in a session, macOS asks whether it may use that browser's "Safe Storage" Keychain item. Choose **Allow** to read the current bookmarks. If you decline, Bookmarktivity falls back to the clear-text snapshot where one exists. The "possibly stale" warning then states the reason.
- **Windows.** Encrypted stores protected by the current user's DPAPI key (`v10`) are supported.

All existing keyboard shortcuts, search syntax, folder scope, re-read options, and settings work as before.

## Known limitations

- Decryption has been validated on real Chrome, Brave, and Edge profiles on macOS only. On Windows it has been compile-checked but not run against a real profile.
- Windows app-bound encryption (`v20`) and Linux keyring encryption (`v11`) cannot be decrypted. Those profiles use the clear-text snapshot with a warning. If there is no clear-text copy, the profile read fails.
- Because the macOS build is ad-hoc signed, "Always Allow" in the Keychain prompt does not carry over to later builds.
- The Firefox and Safari sources are covered by synthetic tests and have not yet been validated against real installations on each platform.

## Installation status

This is a test release. The Apple Silicon macOS build is ad-hoc signed but not notarized. The Windows x64 installer is unsigned and was cross-built on macOS; installation on Windows has not been tested. Both packages should be validated on their target platforms before public distribution.
