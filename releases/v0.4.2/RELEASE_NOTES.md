# Bookmarktivity 0.4.2 (test release)

Bookmarktivity is a read-only bookmark workspace for selected Microsoft Edge, Google Chrome, and Brave profiles. Each result retains its browser and profile source.

## What's new since 0.4.1

- Added a shortcut in profile settings to open macOS Full Disk Access settings. On macOS 27, grant Bookmarktivity access there, then return to the app and choose **Find profiles** for each browser. Only the user can grant this permission.
- Added a native **Choose folder…** control for browsers using a custom user-data directory. Profile discovery now reports access failures instead of silently treating a protected directory as empty.
- Pressing Down Arrow in either search field now moves focus into the results.
- Updated Windows bundle metadata and added installer validation to the release workflow.

## Known limitation

Some Chromium profiles have encrypted bookmark files. When a clear-text copy also exists, Bookmarktivity reads that snapshot and warns it may be older than the browser's current bookmarks. An encrypted-only bookmark store cannot be read yet.

## Installation status

This is a test release. The Apple Silicon macOS build is ad-hoc signed but not notarized. The Windows x64 installer is unsigned and was cross-built on macOS; installation on Windows has not been tested. Both packages should be validated on their target platforms before public distribution.
