# Bookmarktivity 0.4.1 build record

Prepared on 25 October 2026 (Australia/Melbourne) from source commit `caff495` plus the `0.4.1` version and release-preparation changes in this directory.

## Artifacts

| Asset | Target | Status |
| --- | --- | --- |
| `artifacts/Bookmarktivity-v0.4.1-macos-arm64.dmg` | Apple Silicon macOS | Built locally; app ad-hoc signed; DMG verified; not notarized |
| `artifacts/Bookmarktivity-v0.4.1-windows-x64-setup.exe` | Windows x64 | Valid PE/NSIS structure and hash checked; unsigned; installation not tested |

A file named `Bookmarktivity_0.4.1_x64-setup.exe` was later found in the local artifacts directory with SHA-256 `add6432520b3096062d177c147f7283d5ad5012979bcee11c3a7f40ea32b946b`. All 2,021,442 bytes are zero; it is not a Windows executable. The same hash was reported for the copy on the corporate PC. This file was renamed with an `.invalid-zero-file` suffix to prevent accidental use. The point at which its contents became zero is unknown.

A replacement Windows installer was supplied from the Windows build and staged with SHA-256 `36338ba988b877648ba76b1b1d03f439c1350257055facb57f5b49275ebd23ef`. It has valid `MZ` and `PE` headers, parses as a 32-bit NSIS setup executable, and has no embedded Authenticode certificate. Static inspection does not establish that installation succeeds on Windows or that corporate policy permits it.

The SHA-256 hashes of both staged assets are in `SHA256SUMS.txt`. The artifacts are ignored by Git; keep them with the release record or upload them to a draft release after GitHub access is restored.

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
- `node scripts/check-windows-installer.mjs` accepted the replacement Windows installer and rejected the zero-filled copy. Its byte count and SHA-256 match the supplied file. PE resource parsing completed; the certificate table offset and size are both zero.

## Before publishing

Install and test the staged macOS build with enabled Edge, Chrome, and Brave profiles, including search and refresh. The encrypted Chromium snapshot limitation in the release notes remains open. A public macOS download needs Developer ID signing and notarization. The Windows installer needs platform validation and a trusted signing identity before public distribution. Keep any GitHub release in draft until the intended release criteria are met.
