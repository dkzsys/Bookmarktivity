# Architecture outline

This is an initial map, not a description of implemented code. No runtime or storage engine has been selected.

## Boundaries

```text
Desktop UI
    | profile selection, search, review, actions
    v
Core bookmark model and operations
    | browser-neutral records with source identity
    v
Browser adapter interface
    |
    +-- Microsoft Edge adapter (first)
    +-- Other browser adapters (future)
```

`apps/desktop/` owns the user experience, platform packaging, Settings, and platform-specific URL opening and clipboard integration. `packages/core/` owns browser-neutral models, query interpretation, filtering, sorting, and productivity behavior. `packages/browser-edge/` owns Edge-specific profile discovery and bookmark access.

## Profile model

The user enables individual local browser profiles. A combined workspace may query multiple enabled profiles, but each bookmark must retain its browser and profile identity. Disabling a profile removes it from the workspace without changing that browser profile.

Search and folder filtering must operate on records from enabled profiles only. A bookmark's source identity and folder path remain attached to every search result, including when results are narrowed in stages. Browser adapters should expose available bookmark metadata without inventing dates or activity history that the source does not provide.

Profile discovery must account for operating-system differences and customized Edge user-data directories. Microsoft documents that the active profile path can be checked at `edge://version` and that the user-data directory can be configured.

## First integration boundary

The first technical slice should discover Edge profiles, let the user choose among them, and read bookmark data into a browser-neutral representation. Start with read-only access while validating the data format and refresh behavior. Writing changes back to Edge requires a separate decision covering concurrency, backup, recovery, and compatibility.

## Verification approach

Use synthetic fixtures for parser and model tests. Once an app runtime is chosen, add platform-specific discovery tests and end-to-end tests of profile selection and provenance. Do not depend on a developer's real Edge profile in automated tests.
