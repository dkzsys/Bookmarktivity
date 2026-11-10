# Bookmarktivity 0.4.3 build record

Prepared on 11 November 2026 (Australia/Melbourne) from release source tagged `v0.4.3` after the package version updates. The preceding application commit is `246a639`.

## Artifacts

| Asset | Target | Status |
| --- | --- | --- |
| `artifacts/Bookmarktivity-v0.4.3-macos-arm64.dmg` | Apple Silicon macOS | Built locally; app ad-hoc signed; DMG checksum verified; not notarized |
| `artifacts/Bookmarktivity-v0.4.3-windows-x64-setup.exe` | Windows x64 | Cross-built with `cargo-xwin` and NSIS; valid PE/NSIS structure; unsigned; installation not tested |

The staged assets' SHA-256 hashes are in `SHA256SUMS.txt`. The installer binaries in `artifacts/` are ignored by Git and are uploaded separately to the GitHub release.

## Checks performed

- `npm install --package-lock-only --ignore-scripts`: passed; npm workspaces resolve to `0.4.3`.
- `npm test`: 14 core tests passed.
- `npm run typecheck`: passed.
- `cargo test --manifest-path packages/browser-chromium/Cargo.toml`: three synthetic adapter tests passed.
- `cargo test --manifest-path packages/browser-firefox/Cargo.toml`: five synthetic adapter tests passed, including a database held open in write-ahead-log mode.
- `cargo test --manifest-path packages/browser-safari/Cargo.toml`: two synthetic adapter tests passed.
- `npm run tauri -w @bookmarktivity/desktop -- build --bundles app,dmg --config '{"bundle":{"macOS":{"signingIdentity":"-"}}}'`: built the Apple Silicon app and DMG.
- `codesign --verify --deep --strict` passed for the app. The app version is `0.4.3` and its executable is arm64.
- `hdiutil verify` passed for the DMG.
- `npm run tauri -w @bookmarktivity/desktop -- build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis`: built the Windows x64 installer with the rustup compiler, Homebrew LLVM and NSIS, and `cargo-xwin` v0.23.1. The cross-build emitted missing debug-symbol linker warnings and skipped signing, but completed successfully.
- `file` identified the installer as an NSIS PE32 setup program and the app executable as PE32+ x86-64. `scripts/stage-release.mjs` ran the Windows installer check on it.
- `node scripts/stage-release.mjs 0.4.3` staged both bundles and wrote their hashes; `shasum -a 256 -c ../SHA256SUMS.txt` verified the staged files.

## Not verified

- Firefox and Safari reads against real browser data: a command-line smoke test on the build Mac was blocked by macOS privacy protection, so these sources rely on synthetic tests until the app is tested with Full Disk Access.
- Installation and behavior on Windows.

## Before publishing

Install and test both staged packages on their target platforms, including Firefox and Safari discovery, the macOS Full Disk Access flow, search, and refresh. A public macOS release needs Developer ID signing and notarization. A public Windows release needs a trusted Authenticode signature and platform testing. Keep the GitHub release as a draft until these checks are complete.
