# Architecture outline

This describes the first implemented architecture. The selected technology direction is in [TECHNOLOGY.MD](../TECHNOLOGY.MD) and [decision 0006](decisions/0006-desktop-technology-stack.md).

## Boundaries

```text
React/TypeScript UI (Tauri webview)
    | queries, focus, profile selection, review
    +--> TypeScript core and in-memory search worker
    |        browser-neutral records with source identity
    |
    +--> Narrow Tauri commands (Rust desktop host)
             |
             +-- Rust Edge, Chrome, and Brave adapters
             +-- Shared Chromium bookmark reader
```

`apps/desktop/` owns the React and TypeScript experience, Tauri host, platform packaging, Settings, and platform-specific URL opening and clipboard integration. `packages/core/` owns browser-neutral TypeScript models, query interpretation, filtering, sorting, and productivity behavior. `packages/browser-edge/`, `packages/browser-chrome/`, and `packages/browser-brave/` own browser-specific profile discovery. `packages/browser-chromium/` owns shared read-only Chromium bookmark parsing. The host passes browser-neutral records across the Rust-to-TypeScript boundary with browser and profile identity intact. Search work runs outside the UI thread.

## Profile model

The user enables individual local browser profiles. A source key includes browser ID, canonical user-data directory, and profile folder, so same-named folders in different browsers or directories cannot collide. A combined workspace may query multiple enabled profiles, but each bookmark retains its source identity. Disabling a profile removes it from the workspace without changing that browser profile. Existing Edge selections keyed only by folder name are migrated when that profile is discovered.

Search and folder filtering must operate on records from enabled profiles only. A bookmark's source identity and folder path remain attached to every search result, including when results are narrowed in stages. Browser adapters should expose available bookmark metadata without inventing dates or activity history that the source does not provide.

On launch, browser adapters read enabled profiles into a browser-neutral model. Core builds the bookmark tree and search data in memory. Bookmarktivity initially stores profile selections and app preferences, but no persistent duplicate of bookmark contents. A manual re-read can target all enabled sources, one source's enabled profiles, or one enabled profile; it rebuilds only the targeted in-memory data and then reapplies the current view. Disabled profiles are never read. Reconsider a local database if benchmarks in the chosen runtime show that launch or refresh performance falls short of expectations. See [decision 0005](decisions/0005-in-memory-bookmark-data.md).

The desktop UI owns search-focus and result-focus shortcuts, double-Escape reset, and folder expansion state, including collapse-all and expand-all for the navigation tree. Those controls do not change scope or the result tree. Core determines the eligible result set: a standalone folder-name match admits the matched folder's descendants for browsing, while enabled-profile and folder-scope restrictions still apply; result refinement narrows that set. The desktop UI arranges eligible records as a tree. Folder-name matching uses a folder's own name or a bookmark's immediate containing folder name, while the full path remains attached for display. See [decision 0003](decisions/0003-keyboard-search-and-tree-navigation.md) and [decision 0004](decisions/0004-manual-reread-and-folder-name-search.md).

Profile discovery accounts for operating-system differences and a configured user-data directory per browser. The active profile path can be checked at `edge://version`, `chrome://version`, or `brave://version`. The reader handles both `Bookmarks` and `AccountBookmarks` JSON within a selected profile and keeps their node IDs distinct. When encrypted and clear-text copies coexist, the reader shows the clear-text snapshot with a visible warning that it may be stale. An encrypted-only store fails the profile read to avoid a partial collection.

## First integration boundary

The first technical slice discovers Edge, Chrome, and Brave profiles, lets the user choose among them, and reads bookmark data into a browser-neutral representation. A manual re-read requests fresh data from enabled profiles through the browser adapter, then reapplies core search and scope without changing provenance. Read failures appear by profile and remove that profile's previously loaded records. The browser preview uses synthetic records only. Writing changes back to any browser requires a separate decision covering concurrency, backup, recovery, and compatibility.

## Verification approach

Use synthetic fixtures for parser and model tests. Once the app is scaffolded, add platform-specific discovery tests and end-to-end tests of profile selection and provenance. Test the release platforms' webviews and keyboard behavior. Do not depend on a developer's real Edge profile in automated tests.
