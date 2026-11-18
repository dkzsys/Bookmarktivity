# Bookmarktivity 0.4.5 (test release)

Bookmarktivity is a read-only bookmark workspace for selected Microsoft Edge, Google Chrome, Brave, Firefox, and Safari sources. Each result retains its browser and profile source.

## What's new since 0.4.4

- **Stale-snapshot warnings can be hidden.** The "possibly stale" warning banner is now hidden by default. Click the **possibly stale profile** chip above the results to show or hide the details. Your choice is remembered between launches. The sidebar and details panel still flag the affected profile.
- **Clearer startup errors.** When profile discovery fails, each browser's error is shown on its own line. On macOS, the Full Disk Access instruction appears once at the end instead of after every browser.
- **New README.** The README now opens with an annotated feature guide image, a query cheat sheet, and grouped keyboard shortcuts.

All existing keyboard shortcuts, search syntax, folder scope, re-read options, and settings work as before.

## Known limitations

- The Firefox and Safari sources are covered by synthetic tests and have not yet been validated against real installations on each platform.
- Some Chromium profiles have encrypted bookmark files. When a clear-text copy also exists, Bookmarktivity reads that snapshot and warns it may be older than the browser's current bookmarks. An encrypted-only bookmark store cannot be read yet.

## Installation status

This is a test release. The Apple Silicon macOS build is ad-hoc signed but not notarized. The Windows x64 installer is unsigned and was cross-built on macOS; installation on Windows has not been tested. Both packages should be validated on their target platforms before public distribution.
