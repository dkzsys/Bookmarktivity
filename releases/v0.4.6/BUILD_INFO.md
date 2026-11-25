# Bookmarktivity 0.4.6 build record

Prepared on 25 November 2026 (Australia/Melbourne) from release source tagged `v0.4.6` (commit `84d0b51`), which contains the package version updates. This build record was committed after the tag. It does not change the application source.

## Artifacts

| Asset | Target | Status |
| --- | --- | --- |
| `artifacts/Bookmarktivity-v0.4.6-macos-arm64.dmg` | Apple Silicon macOS | Built locally; app ad-hoc signed; DMG checksum verified; not notarized |
| `artifacts/Bookmarktivity-v0.4.6-windows-x64-setup.exe` | Windows x64 | Cross-built with `cargo-xwin` and NSIS; valid PE/NSIS structure; unsigned; installation not tested |

The staged assets' SHA-256 hashes are in `SHA256SUMS.txt`. The installer binaries in `artifacts/` are ignored by Git and are uploaded separately to the GitHub release.

## Checks performed

- `npm install --package-lock-only --ignore-scripts`: npm workspaces resolve to `0.4.6`. Lockfile diffs changed only version numbers, apart from `packages/browser-edge/Cargo.lock`, which gained the crypto crates added for BUG-004.
- `npm test`: 14 core tests passed.
- `npm run typecheck`: passed.
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`: passed.
- `cargo test --manifest-path packages/browser-chromium/Cargo.toml`: five synthetic adapter tests passed (one live test ignored by default).
- `cargo test --manifest-path packages/browser-firefox/Cargo.toml`: five synthetic adapter tests passed.
- `cargo test --manifest-path packages/browser-safari/Cargo.toml`: two synthetic adapter tests passed.
- Encrypted-store decryption was checked before release with the ignored `live_profiles_decrypt` test. On this Mac it read nine real profiles (six Chrome, one Brave, two Edge) through the Keychain with no fallback warnings. The test prints counts only.
- `cargo check` and `cargo clippy` for `x86_64-pc-windows-msvc` on `browser-chromium`: passed with no warnings.
- `npm run tauri -w @bookmarktivity/desktop -- build --bundles app,dmg --config '{"bundle":{"macOS":{"signingIdentity":"-"}}}'`: built the Apple Silicon app and DMG. The first attempt failed without a captured error and the rerun succeeded.
- `codesign --verify --deep --strict` passed for the app. The app version is `0.4.6` and its executable is arm64.
- `hdiutil verify` passed for the DMG.
- `npm run tauri -w @bookmarktivity/desktop -- build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis`: built the Windows x64 installer with the rustup compiler, Homebrew LLVM, NSIS, and `cargo-xwin` from `~/.cargo/bin`. Signing was skipped, as expected on a macOS host.
- `file` identified the installer as an NSIS PE32 setup program. `scripts/stage-release.mjs` ran the Windows installer check on it.
- `node scripts/stage-release.mjs 0.4.6` staged both bundles and wrote their hashes; `shasum -a 256 -c ../SHA256SUMS.txt` verified the staged files.
- The draft GitHub release's asset digests matched `SHA256SUMS.txt` before it was published.

## Not verified

- The packaged 0.4.6 app was not launched before release, including its Keychain prompt.
- Encrypted-store decryption on Windows and Linux.
- Firefox and Safari reads against real browser data.
- Installation and behavior on Windows.

## Before publishing

A public macOS release needs Developer ID signing and notarization. A public Windows release needs a trusted Authenticode signature and platform testing.
