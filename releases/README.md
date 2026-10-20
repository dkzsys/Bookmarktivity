# Release preparation

Use one `vX.Y.Z/` directory per GitHub release. Keep release notes and build records in Git; place installer files in `vX.Y.Z/artifacts/`, which is ignored by Git. Do not commit signing keys, browser profiles, or built installers.

For a manual release:

1. Align the versions in the Tauri config, Rust packages, npm workspaces, and their lockfiles.
2. Run the checks listed in the root README and build each intended platform. A Windows NSIS bundle built on macOS uses `cargo-xwin`; a DMG must be built on macOS.
3. For Apple Silicon and Windows x64 builds, run `node scripts/stage-release.mjs X.Y.Z`. It copies the bundles into `artifacts/` using versioned names and writes `SHA256SUMS.txt`. It refuses to replace a different artifact already staged under the same name. Verify with `cd releases/vX.Y.Z/artifacts && shasum -a 256 -c ../SHA256SUMS.txt`.
4. Record the source commit and checks in `BUILD_INFO.md`. Commit the version and release notes, then tag that exact commit as `vX.Y.Z`. If the source or build configuration changes after a bundle is built, rebuild it before upload.
5. In GitHub, create a **draft** release for the tag, paste `RELEASE_NOTES.md`, and upload the installer files and `SHA256SUMS.txt`. Verify the uploaded filenames and hashes before publishing.

The current signing setup does not produce publicly trusted installers. macOS needs Developer ID signing and notarization for smooth distribution outside the App Store. Windows needs a trusted Authenticode signing identity; a new signed build may still initially show SmartScreen. Keep the release as a draft until the intended platforms have been installed and tested.

References: [Tauri DMG](https://v2.tauri.app/distribute/dmg/), [Tauri Windows installer](https://v2.tauri.app/distribute/windows-installer/), [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).
