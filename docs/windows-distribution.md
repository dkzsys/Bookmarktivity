# Windows test builds and release trust

The NSIS build can run locally on Windows or cross-compile from macOS. The current build is **unsigned**. A downloaded unsigned installer can trigger Microsoft Defender SmartScreen, and a corporate-managed device may also block the installer or installed app under a separate application-control policy.

## Testing on a managed PC

Ask the device's IT or security team to review and approve the exact installer and, if required by their policy, the installed executable. Give them the installer, its SHA-256, the app version, and the source revision. They can decide whether to allow the hashes in their application-control system or deploy through an approved managed installer. An allow rule for one hash does not cover a rebuilt file or later version. Do not disable security controls or remove the downloaded file's origin marker to work around the warning.

A ZIP containing the installer is useful for delivery and comparison with other downloads, but it does not sign or establish trust for the executable inside. Whether Windows shows a prompt can also depend on the file's download origin and reputation. Verify behavior on the managed PC and use the organisation's approval process for deployment.

The test application reads Edge bookmark files from profiles selected by the user and saves its own preferences under the user's configuration directory. It does not write to Edge profile files. Review the source and test the installation on Windows before broader deployment.

## Public releases

Obtain a publicly trusted Windows code-signing identity, then sign and timestamp **both** the app executable and NSIS installer. Verify each Authenticode signature on Windows before publishing. Keep the same publisher identity across releases. Do not publish an unsigned artifact as a production release.

Code signing establishes publisher identity but does not guarantee the first download avoids SmartScreen. Microsoft also evaluates file and publisher reputation. A corporate application-control policy may require separate IT approval even for a signed installer. Microsoft Store distribution is another option for a public release, subject to its own packaging and review requirements.

The repository's manual Windows workflow currently builds an unsigned **test** artifact. Its name explicitly identifies that status. Do not connect this workflow directly to GitHub Releases until signing and signature verification are configured with a real signing identity.

References: [Microsoft SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation), [Tauri Windows signing](https://v2.tauri.app/distribute/sign/windows/), [Microsoft App Control managed installers](https://learn.microsoft.com/en-us/windows/security/threat-protection/windows-defender-application-control/configure-authorized-apps-deployed-with-a-managed-installer).
