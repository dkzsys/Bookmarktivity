# 0010: Firefox and Safari as read-only sources

Status: Accepted

Date: 2026-11-11

## Decision

Add Firefox and Safari as read-only local sources, each in its own Rust adapter. Move the browser-neutral records, identity keys, and data-directory resolution into `packages/browser-model/` so non-Chromium adapters do not depend on the Chromium reader.

### Firefox

- Discover profiles from `profiles.ini` in the Firefox data directory, honouring both relative and absolute (`IsRelative=0`) paths. When the file is absent, scan the chosen directory and its `Profiles` folder. List only profiles that contain `places.sqlite`. The profile key is browser ID, canonical data directory, and the profile path as written in `profiles.ini`.
- Default data directories: `~/Library/Application Support/Firefox` on macOS; `%APPDATA%\Mozilla\Firefox` and the Microsoft Store package location on Windows; `~/.mozilla/firefox`, the XDG config location, and the Snap and Flatpak locations on Linux. A per-browser override remains available.
- Never open `places.sqlite` in place. Read the file and its `-wal` file into memory, apply the log's committed frames to the image using SQLite's recovery rules (matching salts, valid running checksums, up to the last commit frame), mark the image as a rollback-journal database, and query it with a bundled SQLite. The read is retried when the log changes while the main file is being read, and fails with a clear message if it never settles.
- Return folders and bookmarks with created and modified dates. Omit the tags root, separators, `place:` history queries, and an empty mobile root. Name the built-in roots as Firefox displays them in English.

### Safari

- Treat each Safari data directory as one profile backed by `Bookmarks.plist` (binary or XML). Default locations are `~/Library/Safari` on macOS and `%APPDATA%\Apple Computer\Safari` on Windows. Safari is not offered on Linux.
- Return the Favorites bar, bookmarks menu, and other top-level folders and bookmarks. Omit the Reading List and the History placeholder. Safari stores no bookmark dates, so none are reported.
- On macOS the default location requires Full Disk Access; access failures are reported with the existing guidance rather than treated as "no bookmarks".

## Context and alternatives

`places.sqlite` also holds browsing history, and Firefox keeps it open in write-ahead-log mode with changes that may sit in the log for a long time.

- Opening the file with SQLite, even read-only, can create `-shm`/`-wal` files in the profile and can fail with a lock error while Firefox runs. That conflicts with the rule against writing to browser profile data.
- Opening it as an immutable file avoids writes but ignores the log, so bookmarks added in the running browser would be missing.
- Copying the database and log to a temporary directory works but places a copy of browsing history on disk outside the browser's control.
- Firefox's `bookmarkbackups` are compressed in a Mozilla-specific format and can be a day or more old.

The in-memory image avoids all four problems at the cost of holding the database in memory for the duration of a read.

## Consequences

- The desktop host links a bundled SQLite (`rusqlite`) and the `plist` crate. A C compiler is required to build, which the Tauri toolchain already needs.
- Profile discovery and profile reads now run off the host's main thread, because a Firefox read is proportional to the size of `places.sqlite`.
- Safari for Windows was discontinued in 2012. Its support reuses the macOS reader and has not been validated against a real installation.
- Safari's own profiles (Safari 17 and later) share one `Bookmarks.plist`; Bookmarktivity shows it as a single source and does not attribute folders to Safari profiles.
- Whether to include Safari's Reading List, and localized names for Firefox's built-in roots, remain open.
- Neither adapter writes to browser data.

## References

- [SQLite write-ahead log format](https://www.sqlite.org/fileformat2.html#the_write_ahead_log)
- [SQLite in-memory deserialization](https://www.sqlite.org/c3ref/deserialize.html)
- [Firefox profile locations](https://support.mozilla.org/en-US/kb/profiles-where-firefox-stores-user-data)
