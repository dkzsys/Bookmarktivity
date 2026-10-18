# Bookmarktivity

Bookmarktivity is an open-source, cross-platform desktop app for Power Users who wants to supercharge their bookmark filtering and navigation. It aims to provide fast, powerful ways to find and browse bookmarks while keeping their browser profile of origin clear.

A standalone desktop app is built to overcome the limitations of browser extensions, and corporate environments.

The first browser integration targets Microsoft Edge. Users choose which local Edge profiles Bookmarktivity includes; each profile retains its own bookmarks. Additional browser integrations are future work. The planned workflow includes field-specific and folder-scoped search, configurable sorting, and keyboard-first navigation; see [PRODUCT.md](PRODUCT.md) for the requirements and open decisions.

## Project status

This repository contains the project foundation. The desktop runtime, supported operating systems for the first release, bookmark editing behavior, and executable build commands are not yet decided. No application code or browser data access is implemented.

## Repository map

| Path | Purpose |
| --- | --- |
| `apps/desktop/` | Desktop user interface and platform packaging |
| `packages/core/` | Browser-independent bookmark models and productivity features |
| `packages/browser-edge/` | Edge profile discovery and bookmark integration |
| `fixtures/` | Synthetic, non-personal browser data for development and tests |
| `docs/architecture.md` | System boundaries and data flow |
| `docs/decisions/` | Recorded product and architecture decisions |
| `PRODUCT.md` | Product scope and terminology |
| `AGENTS.md` | Guidance for coding agents |

## License

Bookmarktivity is licensed under the [MIT License](LICENSE).
