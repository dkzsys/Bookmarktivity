# Bookmarktivity 0.4.4 build record

Prepared on 11 November 2026 (Australia/Melbourne) from release source tagged `v0.4.4` after the package version updates. The preceding application commit is `927abe9`.

## Artifacts

| Asset | Target | Status |
| --- | --- | --- |
| `artifacts/Bookmarktivity-v0.4.4-macos-arm64.dmg` | Apple Silicon macOS | Built locally; app ad-hoc signed; DMG checksum verified; not notarized |
| `artifacts/Bookmarktivity-v0.4.4-windows-x64-setup.exe` | Windows x64 | Cross-built with `cargo-xwin` and NSIS; valid PE/NSIS structure; unsigned; installation not tested |

The staged assets' SHA-256 hashes are in `SHA256SUMS.txt`. The installer binaries in `artifacts/` are ignored by Git and are uploaded separately to the GitHub release.

## Checks performed

- `npm install --package-lock-only --ignore-scripts`: passed; npm workspaces resolve to `0.4.4`.
- `npm test`: 14 core tests passed.
- `npm run typecheck`: passed.
- `cargo test --manifest-path packages/browser-chromium/Cargo.toml`: three synthetic adapter tests passed.
- `cargo test --manifest-path packages/browser-firefox/Cargo.toml`: five synthetic adapter tests passed.
- `cargo test --manifest-path packages/browser-safari/Cargo.toml`: two synthetic adapter tests passed.
- The redesigned interface was exercised in the browser preview with headless Chrome: light and dark appearance, search and highlighting, the re-read menu, settings, keyboard navigation into results, and the virtualized list with 2,920 visible rows from the 8,000-item synthetic collection. No script errors were reported.
- `npm run tauri -w @bookmarktivity/desktop -- build --bundles app,dmg --config '{"bundle":{"macOS":{"signingIdentity":"-"}}}'`: built the Apple Silicon app and DMG. The first attempt failed while creating the DMG; an immediate rerun from the same source succeeded.
- `codesign --verify --deep --strict` passed for the app. The app version is `0.4.4` and its executable is arm64.
- `hdiutil verify` passed for the DMG.
- `npm run tauri -w @bookmarktivity/desktop -- build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis`: built the Windows x64 installer with the rustup compiler, Homebrew LLVM and NSIS, and `cargo-xwin` v0.23.1. The cross-build emitted missing debug-symbol linker warnings and skipped signing, but completed successfully.
- `file` identified the installer as an NSIS PE32 setup program and the app executable as PE32+ x86-64. `scripts/stage-release.mjs` ran the Windows installer check on it.
- `node scripts/stage-release.mjs 0.4.4` staged both bundles and wrote their hashes; `shasum -a 256 -c ../SHA256SUMS.txt` verified the staged files.

## Not verified

- The redesigned interface inside the Tauri desktop window with real browser profiles.
- Firefox and Safari reads against real browser data.
- Installation and behavior on Windows.

## Before publishing

Install and test both staged packages on their target platforms, including the redesigned layout, profile discovery, the macOS Full Disk Access flow, search, and refresh. A public macOS release needs Developer ID signing and notarization. A public Windows release needs a trusted Authenticode signature and platform testing. Keep the GitHub release as a draft until these checks are complete.
