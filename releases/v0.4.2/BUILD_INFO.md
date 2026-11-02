# Bookmarktivity 0.4.2 build record

Prepared on 2 November 2026 (Australia/Melbourne) from release source tagged `v0.4.2` after the package version updates. The preceding application commit is `e66d371`.

## Artifacts

| Asset | Target | Status |
| --- | --- | --- |
| `artifacts/Bookmarktivity-v0.4.2-macos-arm64.dmg` | Apple Silicon macOS | Built locally; app ad-hoc signed; DMG checksum verified; not notarized |
| `artifacts/Bookmarktivity-v0.4.2-windows-x64-setup.exe` | Windows x64 | Cross-built with `cargo-xwin` and NSIS; valid PE/NSIS structure; unsigned; installation not tested |

The staged assets' SHA-256 hashes are in `SHA256SUMS.txt`. The installer binaries in `artifacts/` are ignored by Git and must be uploaded separately to a draft GitHub release.

## Checks performed

- `npm install --package-lock-only --offline --ignore-scripts`: passed; npm workspaces resolve to `0.4.2`.
- `npm test`: 14 core tests passed.
- `npm run typecheck`: passed.
- `cargo test --offline --manifest-path packages/browser-chromium/Cargo.toml`: three synthetic adapter tests passed.
- `cargo test --offline --manifest-path packages/browser-edge/Cargo.toml`: passed; no adapter-specific tests are defined in that crate.
- `cargo check --offline --manifest-path apps/desktop/src-tauri/Cargo.toml`: passed.
- `npm run tauri -w @bookmarktivity/desktop -- build --bundles app,dmg --config '{"bundle":{"macOS":{"signingIdentity":"-"}}}'`: built the Apple Silicon app and DMG. The macOS build required an unsandboxed run for `hdiutil`.
- `codesign --verify --deep --strict` passed for the app. The app version is `0.4.2` and its executable is arm64.
- `hdiutil verify` passed for the DMG.
- `npm run tauri -w @bookmarktivity/desktop -- build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis`: built the Windows x64 installer. The build used the rustup compiler with the Windows target, Homebrew LLVM and NSIS, and `cargo-xwin` v0.23.1. The cross-build emitted missing debug-symbol and `rust-objcopy` warnings, but completed successfully.
- `node scripts/check-windows-installer.mjs` accepted the Windows installer. `file` identified it as an NSIS PE32 setup program and the installed app executable as PE32+ x86-64.
- `node scripts/stage-release.mjs 0.4.2` staged both bundles and wrote their hashes; `shasum -a 256 -c ../SHA256SUMS.txt` verified the staged files.

## Before publishing

Install and test both staged packages on their target platforms, including profile discovery, the macOS Full Disk Access flow, search, and refresh. A public macOS release needs Developer ID signing and notarization. A public Windows release needs a trusted Authenticode signature and platform testing. Keep the GitHub release as a draft until these checks are complete.
