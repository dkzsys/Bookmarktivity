# 0009: User-selected browser data access on macOS

## Decision

On macOS, offer a native folder picker in profile settings for each browser's user-data directory. The picker is initiated by the user and selects one browser directory at a time. Store the selected path in the existing per-browser preference, then rediscover profiles and re-read only profiles that are enabled. Preserve profile identities when the selected path resolves to the same canonical directory as the previous default.

Profile discovery reports access failures instead of treating denied directories or bookmark files as absent. The UI directs the user to the folder picker when macOS denies access. No broad Full Disk Access request is part of this flow.

## Context

macOS 27 added protections for other applications' data directories, including browser profile locations. Automatic discovery can fail even when the standard directory still exists. A manually typed path cannot itself grant macOS file access; a user-selected folder through the system picker can. The application continues to read browser bookmarks only for profiles the user has enabled, and never writes to browser data.
