# 0009: User-selected browser data access on macOS

## Decision

On macOS, offer a native folder picker in profile settings for each browser's user-data directory. The picker is initiated by the user and selects one browser directory at a time. Store the selected path in the existing per-browser preference, then rediscover profiles and re-read only profiles that are enabled. Preserve profile identities when the selected path resolves to the same canonical directory as the previous default.

Profile discovery reports access failures instead of treating denied directories or bookmark files as absent. For automatic discovery on macOS 27, the UI provides a shortcut to the Full Disk Access pane in System Settings and directs the user to retry discovery after granting access. Bookmarktivity cannot grant Full Disk Access itself. The folder picker remains for custom user-data locations and is not described as a substitute for Full Disk Access to protected default locations.

## Context

macOS 27 added protections for other applications' data directories, including browser profile locations. Automatic discovery can fail even when the standard directory still exists. The application continues to read browser bookmarks only for profiles the user has enabled, and never writes to browser data.
