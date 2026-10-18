# Coding agent guidance

Bookmarktivity is a standalone, cross-platform desktop bookmark app. Read `PRODUCT.md` for confirmed scope and open product decisions, `TECHNOLOGY.MD` for the selected stack and its boundaries, and `docs/architecture.md` when changing system boundaries or browser integrations.

## Project rules

- Keep browser-independent bookmark behavior in `packages/core/` and Edge-specific access in `packages/browser-edge/`.
- Keep browser and profile provenance attached to bookmarks. A combined view must not silently merge distinct profiles.
- Only include profiles the user has enabled. Treat browser profile contents as private user data.
- Do not hard-code a single Edge profile path; profile locations can differ by operating system and configuration.
- Do not write directly to Edge profile data until an explicit editing and recovery design is recorded and tested.
- Use synthetic or sanitized fixtures. Do not commit real browser profiles, bookmarks, credentials, or other personal data.
- Record consequential architecture decisions in `docs/decisions/`.

## Working in this repository

- The Tauri 2, React, TypeScript, Vite, and Rust stack is scaffolded. Use the working commands in README.md and report the checks run for the changed area.
- Keep instructions concise and scoped. Add nested `AGENTS.md` files only when a directory needs distinct, durable rules.
