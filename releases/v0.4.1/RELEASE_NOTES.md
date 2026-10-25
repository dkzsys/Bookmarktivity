# Bookmarktivity 0.4.1 (test release)

Bookmarktivity now brings selected local profiles from Microsoft Edge, Google Chrome, and Brave into one bookmark workspace. Each result identifies its browser and profile; Bookmarktivity reads bookmarks without modifying browser files.

## What's new since 0.3.0

- Added Google Chrome and Brave profile discovery and read-only bookmark access, including custom user-data directories.
- Kept bookmarks from different browsers and profiles distinct, even when their profile folders have the same name. Local and account bookmark stores are read as separate trees.
- Improved search responsiveness for large or combined collections. New queries stop older searches, text searches show progress instead of failing after three seconds, and fuzzy matching does less work per candidate.
- Disabled automatic text correction in search, custom directory, and shortcut fields.
- Made refresh failures clear per profile and removed previously loaded results for a profile that fails to re-read.

## Known limitation

Some Chromium profiles have encrypted bookmark files. When a clear-text copy is also present, Bookmarktivity reads it and warns that it may be older than the browser's current bookmarks. A profile with an encrypted-only bookmark store cannot be read yet. Search covers the loaded snapshot; it cannot find bookmarks absent from that snapshot.

## Installation status

This is a test release. The Apple Silicon macOS build is not notarized, and any Windows test installer is unsigned. Installation and behavior on each release platform still need validation before public distribution.
