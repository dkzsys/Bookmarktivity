# Bookmarktivity 0.4.1 build record

Prepared on 25 October 2026 (Australia/Melbourne) from source commit `caff495` plus the `0.4.1` version and release-preparation changes in this directory.

## Artifacts

| Asset | Target | Status |
| --- | --- | --- |
| `artifacts/Bookmarktivity-v0.4.1-macos-arm64.dmg` | Apple Silicon macOS | Built locally; app ad-hoc signed; DMG verified; not notarized |
| Windows x64 NSIS installer | Windows x64 | Pending; `cargo-xwin` is unavailable locally and GitHub CLI authentication is invalid |

The SHA-256 of the staged macOS asset is in `SHA256SUMS.txt`. The artifact is ignored by Git; keep it with the release record or upload it to a draft release after GitHub access is restored.

## Checks performed

- `npm install --package-lock-only --offline --ignore-scripts`: completed; npm workspace versions resolve to `0.4.1`.
- `npm test`: 14 core tests passed.
- `npm run typecheck`: passed.
- `cargo test --offline --manifest-path packages/browser-chromium/Cargo.toml`: two synthetic adapter tests passed.
- `cargo test --offline --manifest-path packages/browser-edge/Cargo.toml`: passed; no adapter-specific tests are defined in that crate.
- `cargo check --offline --manifest-path apps/desktop/src-tauri/Cargo.toml`: passed.
- `npm run tauri -w @bookmarktivity/desktop -- build --bundles app,dmg --config '{"bundle":{"macOS":{"signingIdentity":"-"}}}'`: built the Apple Silicon app and DMG.
- `codesign --verify --deep --strict` passed for the app; `CFBundleShortVersionString` is `0.4.1` and its executable is arm64.
- `hdiutil verify` passed for the DMG. A read-only mount contained `Bookmarktivity.app` and an Applications link; the app inside the image passed `codesign --verify --deep --strict` and reported version `0.4.1`. `shasum -a 256 -c ../SHA256SUMS.txt` verifies the staged file.

## Before publishing

Install and test the staged macOS build with enabled Edge, Chrome, and Brave profiles, including search and refresh. The encrypted Chromium snapshot limitation in the release notes remains open. A public macOS download needs Developer ID signing and notarization. A Windows download needs a new installer, platform validation, and a trusted signing identity. Keep any GitHub release in draft until the intended release criteria are met.
