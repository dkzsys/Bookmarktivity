# 0006: TypeScript core and UI with a Rust desktop integration layer

Status: Accepted

## Decision

Use Tauri 2 as the desktop host, React and TypeScript with Vite for the UI, TypeScript for browser-neutral behavior in `packages/core/`, and Rust for native integration and Edge profile access in `packages/browser-edge/`. Run derived in-memory search work outside the UI thread. Persist preferences, but no duplicate bookmark database initially.

This selects a technology direction for implementation; the repository does not yet contain a scaffolded application or working build commands. The first-release operating systems remain open.

## Rationale

The product needs responsive keyboard interaction and search over large local collections. TypeScript keeps the UI and browser-neutral query logic in one language and makes the core straightforward to test. Tauri provides desktop packaging and a narrow Rust boundary for local profile access and platform actions. Rust is not required for the whole search engine before measurements justify it.

## Consequences

- Keep the Rust-to-TypeScript data contract explicit and preserve browser and profile provenance across it.
- Keep read-only Edge file access in the adapter; the web UI receives records, not unrestricted filesystem access.
- Benchmark startup, refresh, search, memory, and rendering with synthetic data before adding a database or moving core logic to Rust.
- Test UI behavior on each release platform because Tauri uses platform webviews.
- Electron remains a fallback if the prototype shows material webview or integration issues. Changing the chosen stack requires another recorded decision.

See [TECHNOLOGY.MD](../../TECHNOLOGY.MD) for responsibilities and verification guidance.
