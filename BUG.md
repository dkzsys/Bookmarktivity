# Bug tracker

Record confirmed issues here with the observed behavior, cause, fix, and local date and time (Australia/Melbourne). Keep personal browser data out of reports.

## BUG-001 — Profile folder names collide across browser sources

- **Date and time:** 2026-10-25 20:10 AEDT
- **Status:** Fixed
- **Description:** Edge selections and loaded data were keyed only by profile folder name, such as `Default`.
- **Issue:** Adding Chrome or Brave would overwrite or mix same-named profiles and could display the wrong bookmark source.
- **Fix:** Use a key containing browser ID, canonical user-data directory, and profile folder throughout preferences, native reads, and UI data. Migrate previously saved Edge folder IDs when discovered.

## BUG-002 — Account bookmarks omitted from Chromium profile reads

- **Date and time:** 2026-10-25 20:10 AEDT
- **Status:** Fixed
- **Description:** The Edge reader only opened a profile's `Bookmarks` JSON file.
- **Issue:** Profiles with a separate `AccountBookmarks` file could show an incomplete collection; identical node IDs in the two files could collide.
- **Fix:** Read both files when present and include the storage file in node IDs. Fail the profile read on malformed data rather than returning a partial collection.

## BUG-003 — Failed re-read left old profile data visible

- **Date and time:** 2026-10-25 20:10 AEDT
- **Status:** Fixed
- **Description:** A failed manual re-read reported an error but retained the profile's previously loaded records.
- **Issue:** Old bookmarks remained visible after a read failure, contrary to the product requirement against presenting stale data as refreshed.
- **Fix:** Remove that profile's loaded records on failure and show its error in the source status.

## BUG-004 — Encrypted Chromium bookmark storage causes profile read failures

- **Date and time:** 2026-10-25 20:10 AEDT
- **Updated:** 2026-10-25 20:32 AEDT
- **Status:** Mitigated; encrypted-only support remains open
- **Description:** Chromium is introducing encrypted bookmark files such as `EncryptedBookmarks2` and `EncryptedAccountBookmarks2`.
- **Issue:** The reader rejected a profile whenever an encrypted file existed, even if a clear-text `Bookmarks` or `AccountBookmarks` file was still available. The reported error affected Chrome and Brave. A clear-text copy may be stale, and an encrypted-only store cannot be decoded by the JSON reader.
- **Fix:** Read available clear-text stores and show a profile-level warning that results may be older than the browser's current bookmarks. Fail the profile read when any store is encrypted-only, avoiding a partial collection. Full encrypted support still needs a separate design and compatibility tests for browser rollout stages and operating-system key access.

## BUG-005 — Large combined searches time out and hide valid results

- **Date and time:** 2026-10-25 20:48 AEDT
- **Status:** Fixed in code; live profile validation pending
- **Description:** Searching Brave alone became slow, and searching Edge and Brave together sometimes showed no result for a query such as `online timezone`. Re-reading all sources then showed a matching Brave bookmark.
- **Issue:** The desktop stopped every search after three seconds, cleared its results, and recreated the worker without retrying that query. Typing could queue earlier searches ahead of the latest one. Fuzzy matching also allocated a full edit-distance row for every candidate word, adding cost across large collections.
- **Fix:** Debounce search requests, stop an older running worker when a new query arrives, and show a searching state until the latest response arrives. Keep the short timeout for regex only. Use bounded edit-distance rows for fuzzy matching and test a combined 12,000-bookmark synthetic collection with the match at the end.
- **Remaining limitation:** Search can only find records in the loaded profile snapshot. Brave's clear-text snapshot may lag its encrypted store; that separate issue remains under BUG-004.
