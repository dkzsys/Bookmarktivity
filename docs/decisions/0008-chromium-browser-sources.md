# 0008: Separate browser adapters with shared Chromium reading

Status: Accepted

Date: 2026-10-25

## Decision

Add Google Chrome and Brave as read-only local sources alongside Microsoft Edge. Keep each browser's default directory discovery in its own Rust adapter and share Chromium bookmark JSON parsing in `packages/browser-chromium/`. Users can set a custom user-data directory for each browser and enable profiles individually.

Persist a profile selection as a key made from browser ID, canonical user-data directory, and profile folder. Node IDs also include the storage file (`Bookmarks` or `AccountBookmarks`) so local and account nodes cannot collide. Migrate existing Edge selections keyed by folder name when their profiles are discovered.

## Consequences

- The host validates every read against the saved enabled profile keys and rediscovered profile locations.
- The reader reads only a selected profile's bookmark files, returns browser and profile provenance, and never writes to browser data.
- A clear-text store with an encrypted counterpart is readable as a snapshot, accompanied by a visible warning that it may be stale. A read fails if any store is encrypted-only or a bookmark file is malformed. Previously loaded records for a failed profile are removed.
- A selected profile may contain both local and account bookmark trees. They remain separate roots within that profile.
- Browser installation channels and packaged Linux variants may use other directories; the user can supply the parent of the profile path shown on the browser's version page.
- Supporting encrypted storage later requires a separate design for browser compatibility and operating-system key access.

## References

- [Chromium user-data directories](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md)
- [Chromium bookmark storage names](https://github.com/chromium/chromium/blob/main/components/bookmarks/common/bookmark_constants.cc)
- [Chromium bookmark encryption rollout stages](https://github.com/chromium/chromium/blob/main/components/bookmarks/common/bookmark_features.cc)
- [Chromium bookmark model loader](https://github.com/chromium/chromium/blob/main/components/bookmarks/browser/model_loader.cc)
- [Brave profile locations](https://github.com/brave/brave-browser/wiki/Brave-Country-Id)
