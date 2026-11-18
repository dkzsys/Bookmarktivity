# Bookmarktivity 0.4.5 build record

Prepared on 19 November 2026 (Australia/Melbourne) from release source tagged `v0.4.5` (commit `cae1cb2`), which contains the package version updates. This build record and the checksums were committed after the tag. They do not change the application source.

## Artifacts

| Asset | Target | Status |
| --- | --- | --- |
| `artifacts/Bookmarktivity-v0.4.5-macos-arm64.dmg` | Apple Silicon macOS | Built locally; app ad-hoc signed; DMG checksum verified; not notarized |
| `artifacts/Bookmarktivity-v0.4.5-windows-x64-setup.exe` | Windows x64 | Cross-built with `cargo-xwin` and NSIS; valid PE/NSIS structure; unsigned; installation not tested |

The staged assets' SHA-256 hashes are in `SHA256SUMS.txt`. The installer binaries in `artifacts/` are ignored by Git and are uploaded separately to the GitHub release.

## Checks performed

- `npm install --package-lock-only --ignore-scripts`: passed; npm workspaces resolve to `0.4.5`.
- `npm test`: 14 core tests passed.
- `npm run typecheck`: passed.
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`: passed.
- `cargo test --manifest-path packages/browser-chromium/Cargo.toml`: three synthetic adapter tests passed.
- `cargo test --manifest-path packages/browser-firefox/Cargo.toml`: five synthetic adapter tests passed.
- `cargo test --manifest-path packages/browser-safari/Cargo.toml`: two synthetic adapter tests passed.
- The stale-snapshot warning toggle and the per-browser startup error lines were checked by hand in the packaged macOS app before release.
- `npm run tauri -w @bookmarktivity/desktop -- build --bundles app,dmg --config '{"bundle":{"macOS":{"signingIdentity":"-"}}}'`: built the Apple Silicon app and DMG.
- `codesign --verify --deep --strict` passed for the app. The app version is `0.4.5` and its executable is arm64.
- `hdiutil verify` passed for the DMG.
- `npm run tauri -w @bookmarktivity/desktop -- build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis`: built the Windows x64 installer with the rustup compiler, Homebrew LLVM and NSIS, and `cargo-xwin` v0.23.1. Signing was skipped, as expected on a macOS host.
- `file` identified the installer as an NSIS PE32 setup program. `scripts/stage-release.mjs` ran the Windows installer check on it.
- `node scripts/stage-release.mjs 0.4.5` staged both bundles and wrote their hashes; `shasum -a 256 -c ../SHA256SUMS.txt` verified the staged files.

## Not verified

- Firefox and Safari reads against real browser data.
- Installation and behavior on Windows.

## Before publishing

A public macOS release needs Developer ID signing and notarization. A public Windows release needs a trusted Authenticode signature and platform testing.
