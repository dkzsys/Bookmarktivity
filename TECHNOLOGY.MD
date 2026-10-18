# Technology direction

Bookmarktivity uses **Tauri 2, React, TypeScript, Vite, and a small Rust native layer**. The first implementation is scaffolded. See [decision 0006](docs/decisions/0006-desktop-technology-stack.md) for the rationale and trade-offs.

## Responsibilities

| Area | Technology | Responsibility |
| --- | --- | --- |
| Desktop host | Tauri 2 and Rust | Window and operating-system integration; expose narrow commands to the UI. |
| Desktop UI | React, TypeScript, and Vite | Search controls, Settings, keyboard and focus behavior, folder trees, result rendering, and packaging assets. |
| Browser-neutral core | TypeScript in `packages/core/` | Bookmark and folder models, query parsing, filtering, scope rules, ranking, and sorting. |
| Edge adapter | Rust in `packages/browser-edge/` | Discover candidate Edge profiles and read bookmark data from selected profiles. |
| Search execution | In-memory TypeScript worker | Build derived search data from enabled profiles and run potentially expensive search work without blocking keyboard interaction. |
| Persistence | Small local preferences store | Save enabled profile references and app preferences; do not persist a duplicate bookmark database initially. |

The Rust adapter returns browser-neutral records through the desktop host. Every record carries browser and profile identity. The TypeScript core receives only enabled-profile data; disabling a profile removes its derived records. A manual re-read replaces only the targeted profile data and reports each failed profile separately. The UI retains the current query and scope when it refreshes results.

## Performance approach

- Start with an in-memory index and measure launch, targeted re-read, query latency, memory use, and rendering with large synthetic collections on the platforms chosen for the first release.
- Parse field prefixes, phrases, and Boolean operators explicitly. Apply fuzzy scoring to eligible results for relevance; a fuzzy-search library must not define the query language or folder-scope rules.
- Run search and regular-expression mode outside the UI thread. Allow expensive regex work to be cancelled or stopped so an expression cannot freeze navigation.
- Render only visible result rows for large collections while preserving keyboard navigation, selection, and accessible tree behavior.
- Consider a rebuildable local cache or moving a measured bottleneck to Rust only after benchmarks show the need. Neither is part of the initial storage design.

## Integration and privacy

- Keep native file access behind a narrow, read-only Edge adapter. Do not expose broad filesystem access to the web UI.
- Discover platform-specific profile locations and allow for configured Edge user-data directories; do not assume one fixed path. Edge documents the active profile path at `edge://version`.
- Read only profiles the user enabled. Do not persist or log bookmark contents unnecessarily; use synthetic or sanitized fixtures for tests.
- Open bookmark URLs in the system default browser. A preferred-browser action remains a separate product decision.
- Do not write to Edge profile files until an editing, concurrency, backup, and recovery design is recorded and tested.

## Verification and open choices

Core unit tests use synthetic trees and queries. Adapter tests use synthetic Edge profile directories. Desktop integration tests for profile selection, provenance, refresh failures, search, and keyboard focus are still needed. Test the chosen release platforms because Tauri uses different system webviews on Windows, macOS, and Linux. Working local commands are listed in the README.

First-release operating systems, fuzzy ranking, performance targets, and packaging details remain open. The first query grammar and browser preview behavior are recorded in decision 0007. The initial preferences store is a small local JSON file. Electron is the fallback if cross-platform webview differences or native integration costs prove material in a working prototype.

## References

- [Tauri 2 process model](https://v2.tauri.app/concept/process-model/)
- [Tauri commands](https://v2.tauri.app/develop/calling-rust/)
- [Microsoft Edge user-data directory policy](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/userdatadir)
- [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model)
