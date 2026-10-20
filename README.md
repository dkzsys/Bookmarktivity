# Bookmarktivity

Bookmarktivity is an open-source desktop workspace for people with large bookmark collections. Search across the browser profiles you choose, narrow results in layers, and move through folders with the keyboard. Every result keeps its browser and profile of origin visible.

As a standalone app, Bookmarktivity works outside the browser window. It reads local bookmarks from enabled profiles without changing browser files.

Microsoft Edge is the first browser integration. Users choose which local Edge profiles to include; a combined workspace never merges distinct profiles. See [PRODUCT.md](PRODUCT.md) for confirmed scope and open decisions and [TECHNOLOGY.MD](TECHNOLOGY.MD) for the implementation boundaries.

**License:** [MIT](LICENSE).

## Features available now

### Find and filter

- **Search across enabled profiles** by bookmark name, URL, and immediate containing folder name. Select any combination of those fields; text matching is case-insensitive.
- **Build layered filters:** run a primary query, then use **Search within results** to narrow that result set while retaining the original query and folder scope. Active filters remain visible.
- **Scope a search to a folder** and choose whether it includes descendants or only direct contents. Folder-name matching and folder scope are separate controls.
- **Write expressive queries** with `name:`, `url:`, and `folder:` prefixes, quoted phrases, `AND`, and `OR`. Adjacent terms imply `AND`, and `AND` takes precedence over `OR`. Unquoted terms also allow nearby fuzzy word matches. A regular-expression toggle runs the full primary query in a time-limited worker.
- **Explore matching folders:** a standalone folder-name search finds folders whose names match and lets you expand their contents, even when a child item does not match the folder name. Other search modes show matching items only.
- **Sort and scan results** by relevance or alphabetically, with created and modified date options when source metadata supports them. Matching text is highlighted in the results.

For example, `name:"Project plan"` finds that phrase anywhere within a longer bookmark name. `url:docs.example.com AND name:guide` requires both conditions. `folder:Research` finds a matching folder; expand it to browse its contents. You can then search within the current results for `2026` to narrow them further. Invalid query syntax is reported in the results area.

### Browse and act

- **Navigate folders and results as trees.** Result folders start collapsed; opening one reveals its immediate children. Expand or collapse a selected branch, or expand and collapse all branches in **Your Folders**.
- **Keep context visible.** Results show their Edge profile; the details panel shows the selected item's full folder path and source. Optional folder counts include bookmarks in descendants.
- **Open and copy quickly.** Open a selected bookmark in the system default browser or copy its URL. Opening a selected folder navigates into or expands it.
- **Choose your workspace layout.** Show or hide the folder and details sidebars, resize them, and switch between light and dark themes.
- **Re-read only what you need.** Refresh all enabled profiles, one browser source, or one enabled profile. The current query and scope are reapplied, and read failures are reported by profile.
- **Keep local data local.** Only enabled profiles are read. Bookmark data is held in memory rather than in a separate bookmark database; the browser-only preview uses synthetic bookmarks.

## Keyboard shortcuts

These are the current defaults. Search, results, copy, settings, and branch shortcuts can be reassigned in Settings, which detects duplicate bindings and can restore defaults. Arrow-key navigation, `Enter`, and double `Escape` are fixed.

| Action | macOS | Windows and Linux |
| --- | --- | --- |
| Focus global search; return to All bookmarks and clear the within-results filter | `Command+F` | `Ctrl+F` |
| Focus Search within results | `Option+F` | `Alt+F` |
| Focus the selected result or empty-results area | `Command+G` | `Alt+R` |
| Open Profiles & settings | `Command+,` | `Ctrl+,` |
| Copy the selected bookmark URL when results have focus | `Command+C` | `Ctrl+C` |
| Expand the focused folder and its descendants | `Command+E` | `Ctrl+E` |
| Collapse the focused folder and its descendants | `Command+Shift+E` | `Ctrl+Shift+E` |
| Move through visible folder or result rows | `Up` / `Down` | `Up` / `Down` |
| Jump to the first or last visible result | `Home` / `End` | `Home` / `End` |
| Expand or enter a folder; collapse or move to its parent | `Right` / `Left` | `Right` / `Left` |
| Open the selected bookmark or folder | `Enter` | `Enter` |
| Reset the query, filters, folder scope, sort, and result expansion | Press `Escape` twice quickly | Press `Escape` twice quickly |

`Command+F` / `Ctrl+F` retains the primary query so it can be revised. Double `Escape` leaves enabled-profile choices unchanged. `Tab` and `Shift+Tab` move through interactive controls with visible focus.

## Project status

The first usable desktop implementation is in place. Real profile access runs only in Tauri; the browser preview uses synthetic bookmarks. The current feature set is described above. An [HTML mockup of this README](docs/readme-mockup.html) shows the proposed presentation.

The native app has been compile-checked on macOS. An Apple Silicon DMG and a Windows x64 NSIS installer can be built locally; Windows installation and platform webview behavior still need validation before a public release. Linux packaging remains unvalidated.

Windows test installers are unsigned. See [Windows distribution](docs/windows-distribution.md) for managed-PC testing and signing requirements before publishing a release.

Manual release preparation is documented in [releases/README.md](releases/README.md).

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
