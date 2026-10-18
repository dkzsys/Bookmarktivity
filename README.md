# Bookmarktivity

Bookmarktivity is an open-source, cross-platform desktop app for Power Users who wants to supercharge their bookmark filtering and navigation. It aims to provide fast, powerful ways to find and browse bookmarks while keeping their browser profile of origin clear.

A standalone desktop app is built to overcome the limitations of browser extensions, and corporate environments.

The first browser integration targets Microsoft Edge. Users choose which local Edge profiles Bookmarktivity includes; each profile retains its own bookmarks. Additional browser integrations are future work. The planned workflow includes field-specific and folder-scoped search, configurable sorting, and keyboard-first navigation; see [PRODUCT.md](PRODUCT.md) for the requirements and open decisions. The selected implementation direction is Tauri 2 with a React and TypeScript UI, a TypeScript core, and a narrow Rust native layer; see [TECHNOLOGY.MD](TECHNOLOGY.MD).

## Project status

The first usable desktop implementation is in place. It discovers local Microsoft Edge profiles, lets users enable individual profiles, reads bookmarks without changing browser files, and keeps bookmark data in memory. The workspace supports folder navigation, scoped and field-specific search, search within results, sorting, configurable search shortcuts, keyboard navigation, and targeted re-reading. The browser preview uses synthetic bookmarks; real profile access runs only in Tauri.

The native app has been compile-checked on macOS. Windows and Linux packaging and webview behavior still need validation before a release.

## Run locally

Install Node.js 20+ and a Rust toolchain, then run:

    npm install
    npm run tauri -w @bookmarktivity/desktop -- dev

The browser-only preview starts with npm run dev and uses synthetic data. The frontend build runs with npm run build; a desktop package builds with npm run tauri -w @bookmarktivity/desktop -- build.

Run npm test for browser-neutral search tests, cargo test --manifest-path packages/browser-edge/Cargo.toml for synthetic Edge adapter tests, and cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml for the native host.

## Repository map

| Path | Purpose |
| --- | --- |
| `apps/desktop/` | Desktop user interface and platform packaging |
| `packages/core/` | Browser-independent bookmark models and productivity features |
| `packages/browser-edge/` | Edge profile discovery and bookmark integration |
| `fixtures/` | Synthetic, non-personal browser data for development and tests |
| `docs/architecture.md` | System boundaries and data flow |
| `docs/decisions/` | Recorded product and architecture decisions |
| `apps/desktop/wireframe.html` | Interactive desktop wireframe using synthetic bookmarks |
| `PRODUCT.md` | Product scope and terminology |
| `TECHNOLOGY.MD` | Selected technology direction and implementation boundaries |
| `AGENTS.md` | Guidance for coding agents |

## License

Bookmarktivity is licensed under the [MIT License](LICENSE).
