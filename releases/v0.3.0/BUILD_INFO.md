# Bookmarktivity 0.3.0 build record

Prepared on 20 October 2026 (Australia/Melbourne) from source commit `140db868b9915e82c461ef4cd3747a6fa0661c7e` plus the local `0.3.0` version and release-preparation edits. No `v0.3.0` Git tag exists yet. Commit the prepared source and notes before creating that tag; rebuild any artifact if the app source or build configuration changes.

## Artifacts

| Asset | Target | Status |
| --- | --- | --- |
| `artifacts/Bookmarktivity-v0.3.0-macos-arm64.dmg` | Apple Silicon macOS | Built on Apple Silicon; app ad-hoc signed; not notarized |
| `artifacts/Bookmarktivity-v0.3.0-windows-x64-setup.exe` | Windows x64 | NSIS installer cross-built from macOS; unsigned |

The SHA-256 values of these exact staged files are in `SHA256SUMS.txt`.

## Checks performed

- `npm test`: 13 core tests passed.
- `npm run typecheck`: passed.
- `cargo test --manifest-path packages/browser-edge/Cargo.toml`: one synthetic adapter test passed.
- npm workspace versions and Rust/Tauri build versions: `0.3.0`.
- macOS DMG: `hdiutil verify` passed; mounted read-only and confirmed `Bookmarktivity.app`, `CFBundleShortVersionString` `0.3.0`, arm64 Mach-O, and a valid ad-hoc code signature.
- Windows installer: Tauri and NSIS builds passed; PE version metadata reports `0.3.0` and the certificate table is empty, confirming no Authenticode signature.
- `cd artifacts && shasum -a 256 -c ../SHA256SUMS.txt`: both staged files passed.

## Before publication

These are test artifacts. Validate installation, Edge profile discovery, bookmark loading, and keyboard behavior on real macOS and Windows machines. A public macOS download needs Developer ID signing and notarization. A public Windows download needs a trusted code-signing identity; signing still does not guarantee immediate SmartScreen reputation. Keep the GitHub release as a draft until the intended release criteria are met.

For the manual GitHub release, use tag `v0.3.0`, paste `RELEASE_NOTES.md`, and upload both files in `artifacts/` plus `SHA256SUMS.txt`.
