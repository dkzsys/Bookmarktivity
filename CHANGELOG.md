# Changelog

All notable changes to Bookmarktivity are recorded here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). All releases so far are test releases. Each release's full notes, build record, and checksums are in [`releases/`](releases/README.md). Bug fixes are recorded here under **Fixed**.

## [Unreleased]

### Changed

- Upgraded the core package's test runner to Vitest 5.

### Documentation

- Added this changelog, covering every version since 0.1.
- Retired `BUG.md`. Fixed bugs are now recorded in this changelog under **Fixed**.

## [0.4.6] - 2026-11-25

### Added

- Chrome, Brave, and Edge bookmarks stored encrypted (`EncryptedBookmarks2`, `EncryptedAccountBookmarks2`) are now decrypted and used in preference to clear-text copies, as the browser does. Profiles with only encrypted bookmark files can now be read ([ADR 0011](docs/decisions/0011-encrypted-chromium-bookmark-stores.md)).
- macOS reads the decryption key from the browser's "Safe Storage" Keychain item. The first read of each browser in a session asks for permission, and the key stays in memory only until the app quits.
- Windows decrypts stores protected by the current user's DPAPI key (`v10`).

### Changed

- When decryption fails, for example because Keychain access is declined, the clear-text snapshot is shown and the "possibly stale" warning gives the reason. A profile whose bookmark files exist only in encrypted form and cannot be decrypted fails to read instead of showing partial results.
- The licence copyright holder is now named.

### Known limitations

- Windows app-bound encryption (`v20`) and Linux keyring encryption (`v11`) are not supported.
- Decryption has been validated on real profiles on macOS only. On Windows it has been compile-checked but not run.

## [0.4.5] - 2026-11-19

### Changed

- The "possibly stale" warning banner is hidden by default. The **possibly stale profile** chip above the results shows or hides it, and the choice is remembered between launches. The sidebar and details panel still flag the affected profile.
- When profile discovery fails, each browser's error is listed on its own line. On macOS, the Full Disk Access instruction appears once instead of after every browser.

### Documentation

- The README now opens with an annotated feature guide image, a query cheat sheet, and grouped keyboard shortcuts.

## [0.4.4] - 2026-11-11

### Changed

- Redesigned workspace in the Native desktop design. The main search field sits in the toolbar. Search fields, regex mode, folder scope, and sort share one filter bar.
- Results are shown in a compact table with name and URL, folder location, bookmark count, and source, which fits about twice as many results on screen.
- Folder paths, sources, counts, and labels are larger, with stronger contrast in light and dark appearance.
- Profile read failures and possibly-stale snapshots appear as separate banners, and the folder sidebar flags the affected profile.
- Each browser has its own coloured badge, and icons look the same on macOS and Windows.
- **Profiles & settings** opens as a wider two-pane window with room for all five browsers.

### Added

- The details panel shows when a bookmark was added, where the browser records it.

### Fixed

- The count beside **All bookmarks** showed the number of enabled profiles. It now shows the number of bookmarks in those profiles.

## [0.4.3] - 2026-11-11

### Added

- Firefox as a bookmark source on macOS, Windows, and Linux. Profiles are discovered from `profiles.ini`, and bookmarks saved in a running Firefox are included without quitting it. Tags, separators, and saved history queries are not shown.
- Safari as a bookmark source, showing Favorites and the Bookmarks Menu but not the Reading List. Safari bookmarks need Full Disk Access on macOS. On Windows, only the legacy Safari 5 data location is read ([ADR 0010](docs/decisions/0010-firefox-and-safari-sources.md)).

### Changed

- Reading and discovering profiles no longer blocks the window while large profiles load.
- A profile read that fails because of macOS permissions now points to Full Disk Access, as discovery already did.

### Documentation

- Added early UI design explorations in `design-explorations/`.

## [0.4.2] - 2026-11-02

### Added

- A shortcut in profile settings that opens macOS Full Disk Access settings ([ADR 0009](docs/decisions/0009-macos-browser-data-access.md)).
- A native **Choose folder…** control for browsers that use a custom user-data directory.
- Pressing Down Arrow in either search field moves focus into the results.

### Changed

- Profile discovery reports access failures instead of treating a protected directory as empty.
- Updated Windows bundle metadata, and added installer validation to the release workflow.

## [0.4.1] - 2026-10-25

Includes the untagged 0.4.0 work.

### Added

- Google Chrome and Brave as read-only sources, including custom user-data directories ([ADR 0008](docs/decisions/0008-chromium-browser-sources.md)).
- Local (`Bookmarks`) and account (`AccountBookmarks`) bookmark stores are read as separate trees within a profile.
- A clear-text bookmark file with an encrypted copy is read with a "possibly stale" warning.

### Changed

- Automatic text correction is off in search, custom directory, and shortcut fields.

### Fixed

- Profiles with the same folder name in different browsers, such as `Default`, overwrote or mixed with each other. Profiles are now keyed by browser, user-data directory, and folder, and saved Edge selections are migrated.
- A profile that failed to re-read kept showing its old bookmarks. Its results are now removed and its error is shown.
- Large or combined searches could time out after three seconds and show no results. New queries now replace older ones, text searches show progress, and fuzzy matching does less work per candidate.

## [0.3.0] - 2026-10-20

### Added

- Expand or collapse a whole folder branch from its context menu or a configurable keyboard shortcut.
- A toolbar toggle that shows or hides each folder's total bookmark count, including its subfolders.
- Resizable, hideable folder and details sidebars.
- A light and dark appearance toggle, remembered between launches.

### Changed

- Folder results start collapsed. Expanding a folder shows its immediate contents with child folders still collapsed.
- Settings is split into tabs for local Edge profiles and keyboard shortcuts.

### Fixed

- Shortcut capture, focus behaviour, and the details sidebar.

## 0.2 - 2026-10-20

Untagged; first stable Microsoft Edge build.

### Changed

- Quoted phrases match a literal substring anywhere in a field, including part of a word.
- A folder-name search includes the folder's whole subtree, even items whose own names don't match.

## 0.1 - 2026-10-19

Untagged; first working version.

### Added

- Tauri 2 desktop app with a React and TypeScript interface and a Rust host.
- Read-only discovery and reading of local Microsoft Edge profiles, limited to profiles the user enables.
- Search across folder, name, and URL with `folder:`, `name:`, and `url:` prefixes, quoted phrases, `AND`/`OR`, fuzzy matching, and a regular-expression mode.
- Folder tree navigation and a details panel that shows each bookmark's folder path and browser/profile source. Links open in the system default browser.
- Manual re-read of all enabled sources or a chosen one.
- Updated application icons.

[Unreleased]: https://github.com/dkzsys/Bookmarktivity/compare/v0.4.6...HEAD
[0.4.6]: https://github.com/dkzsys/Bookmarktivity/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/dkzsys/Bookmarktivity/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/dkzsys/Bookmarktivity/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/dkzsys/Bookmarktivity/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/dkzsys/Bookmarktivity/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/dkzsys/Bookmarktivity/compare/0.3.0...v0.4.1
[0.3.0]: https://github.com/dkzsys/Bookmarktivity/releases/tag/0.3.0
