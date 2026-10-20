# Windows installer comparison (20 October 2026)

The user reports that `KloudAtlas Console-2.1.13-Windows-x64.exe` opens its setup wizard on a corporate-managed Windows PC, while `Bookmarktivity_0.1.0_x64-setup.exe` shows a Microsoft Defender SmartScreen warning. The same warning occurred after Bookmarktivity was downloaded as a one-file ZIP and extracted with Windows File Explorer, matching the reported KloudAtlas delivery steps.

| Property | KloudAtlas 2.1.13 | Bookmarktivity 0.1.0 |
| --- | --- | --- |
| Supplied container | ZIP containing one installer EXE | Tested as direct EXE and a ZIP containing one installer EXE |
| Installer format | 32-bit NSIS launcher | 32-bit NSIS launcher |
| Authenticode certificate table | Empty; unsigned | Empty; unsigned |
| Requested execution level | `asInvoker` | `asInvoker` |
| NSIS version in manifest | 3.04 | 3.13 |
| Installer size | 137,191,211 bytes | 2,001,114 bytes |
| Installer SHA-256 | `4ed457d6d2486504c91fe14cd65fbbdb39a6d8554c3cdcd81bab8b8f030f4269` | `fdd33cebc521c9cd18cdc9a5fdc0ab226c31e51744d3ef48d2832177e0425c3e` |

These are static observations. REA ZIP inspection evidence: `ev_3c55ccd019c1606a6c4033ec7d682824bb2cbf6c20ee20aaaef44e288b4dc388`; extracted KloudAtlas member: `ev_738dbe3182cb1a0f766377b7718db5c420f983fa3eafe7c8ad7bc9ce9e5f25c3`; PE resource inspections: KloudAtlas `ev_392addaf6f0776ad654d7f57e5c3e25ff0f7050ba4b923aa5817dbc6f9440e38`, Bookmarktivity `ev_264f82f3c73378441c935f6914b20e76dcd99c9f2df09a4ba40b2860457fe66a`. PE certificate-directory values and requested execution levels were checked separately using LLVM and the manifest resource bytes. No executable was run during this inspection.

## Conclusion and remaining evidence

Matching ZIP packaging did not change Bookmarktivity's result, and neither installer has a cryptographic publisher signature. The difference cannot be attributed to ZIP packaging, NSIS versus another installer, a signature, or elevation requested by the launcher. Microsoft SmartScreen evaluates file hashes, download history, publisher signatures, and other reputation signals; the exact decision for these two files is not observable from their bytes alone. An organisation-specific file allow rule is also possible. The different size, resource metadata, and NSIS versions are observed differences, not established causes.

For this test build, ask IT to inspect its Defender/SmartScreen and application-control event record for the Bookmarktivity hash above and compare it with KloudAtlas. IT can decide whether an exact-hash approval or deployment through the organisation's managed installer is appropriate for testing on the corporate PC. A public release needs a trusted code-signing identity and signature verification; even a new signed file can initially show SmartScreen until it builds reputation.

References: [Microsoft SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation), [Microsoft Defender for Endpoint file indicators](https://learn.microsoft.com/en-us/defender-endpoint/indicators-overview), [Microsoft App Control managed installers](https://learn.microsoft.com/en-us/windows/security/threat-protection/windows-defender-application-control/configure-authorized-apps-deployed-with-a-managed-installer).
