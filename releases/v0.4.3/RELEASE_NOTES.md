# Bookmarktivity 0.4.3 (test release)

Bookmarktivity is a read-only bookmark workspace for selected Microsoft Edge, Google Chrome, Brave, Firefox, and Safari sources. Each result retains its browser and profile source.

## What's new since 0.4.2

- Added Firefox as a bookmark source on macOS, Windows, and Linux. Profiles are discovered from `profiles.ini`, and bookmarks saved in a running Firefox are included without quitting the browser. Tags, separators, and saved history queries are not shown.
- Added Safari as a bookmark source. Safari appears as a single source with its Favorites and Bookmarks Menu; the Reading List is not included. On macOS, Safari bookmarks require Full Disk Access. On Windows, only the data location of the discontinued Safari 5 is read.
- Reading and discovering profiles no longer blocks the window while large profiles load.
- A profile read that fails because of macOS permissions now points to Full Disk Access, as profile discovery already did.

## Known limitations

- The Firefox and Safari sources are covered by synthetic tests and have not yet been validated against real installations on each platform.
- Some Chromium profiles have encrypted bookmark files. When a clear-text copy also exists, Bookmarktivity reads that snapshot and warns it may be older than the browser's current bookmarks. An encrypted-only bookmark store cannot be read yet.

## Installation status

This is a test release. The Apple Silicon macOS build is ad-hoc signed but not notarized. The Windows x64 installer is unsigned and was cross-built on macOS; installation on Windows has not been tested. Both packages should be validated on their target platforms before public distribution.
