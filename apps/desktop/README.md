# Desktop app

This directory contains the Tauri 2 desktop host, React and TypeScript UI, Vite tooling, and a worker for in-memory search. Rust commands expose only profile discovery, enabled-profile bookmark reads, preferences, and default-browser opening. See [TECHNOLOGY.MD](../../TECHNOLOGY.MD).

[`wireframe.html`](wireframe.html) is a standalone, interactive HTML design mockup using synthetic data. Open it in a browser to review the workspace, search shortcuts, folder navigation and bulk branch controls, result expansion, and simulated re-read actions for all sources, a source, or a profile. It does not read browser profiles or launch bookmarks.
