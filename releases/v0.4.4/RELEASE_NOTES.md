# Bookmarktivity 0.4.4 (test release)

Bookmarktivity is a read-only bookmark workspace for selected Microsoft Edge, Google Chrome, Brave, Firefox, and Safari sources. Each result retains its browser and profile source.

## What's new since 0.4.3

- **Redesigned workspace.** The main search field now sits in the toolbar. Search fields, regex mode, folder scope, and sort share one filter bar below it.
- **More results on screen.** Results are a compact table with the bookmark name and URL, folder location, bookmark count, and source. About twice as many results fit on screen as before.
- **Easier to read.** Folder paths, sources, counts, and labels use larger text with stronger contrast in both light and dark appearance.
- **Clearer source status.** Profile read failures and possibly-stale snapshots appear as distinct banners, and the folder sidebar flags the affected profile.
- **Browsers are easier to tell apart.** Each browser has its own coloured badge, and icons now look the same on macOS and Windows.
- **Roomier settings.** Profiles & settings opens as a wider two-pane window with space for all five browsers.
- **Date added in details.** The details panel shows when a bookmark was added, where the browser provides it.
- **Count fix.** The count beside **All bookmarks** now shows the number of bookmarks in enabled profiles; it previously showed the number of enabled profiles.

All existing keyboard shortcuts, search syntax, folder scope, re-read options, and settings work as before.

## Known limitations

- The Firefox and Safari sources are covered by synthetic tests and have not yet been validated against real installations on each platform.
- Some Chromium profiles have encrypted bookmark files. When a clear-text copy also exists, Bookmarktivity reads that snapshot and warns it may be older than the browser's current bookmarks. An encrypted-only bookmark store cannot be read yet.

## Installation status

This is a test release. The Apple Silicon macOS build is ad-hoc signed but not notarized. The Windows x64 installer is unsigned and was cross-built on macOS; installation on Windows has not been tested. Both packages should be validated on their target platforms before public distribution.
