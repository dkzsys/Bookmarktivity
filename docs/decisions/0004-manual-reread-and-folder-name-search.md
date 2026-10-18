# 0004: Manual source re-read and folder-name matching

Status: Accepted

## Decision

The desktop UI offers a manual re-read of all enabled sources, one browser source, or one enabled profile. A source-level action reads only that source's enabled profiles; a disabled profile cannot be re-read. The browser adapter reads each targeted profile again; the core model and search replace only the targeted derived records while keeping browser and profile identities intact. The UI reapplies the current query, refinement, and folder scope, and reports failures by profile. Re-reading never writes to browser data.

The folder search field and `folder:` prefix match only a folder result's own name or a bookmark's immediate containing folder name. The full path remains available for display and provenance but is not part of folder-name matching. Folder scope is chosen separately from the folder navigation controls.

A folder result matched by a standalone folder-name search starts collapsed. Expanding it reveals all bookmarks and subfolders in its subtree, including names that do not match the query. The same rule applies to a standalone folder-name refinement, limited to the current result set. Enabled-profile and active folder-scope restrictions still apply. Other refinements narrow the contents. This is an explicit browsing behavior for folder-name search; compound queries follow their own matching terms and other search modes show only matching records.

`Option+R` on macOS (`Alt+R` on Windows and Linux) moves focus to the selected visible search result or to the empty-results region. It does not change search conditions.

## Consequences

- Refresh orchestration and per-profile status belong to the desktop UI and browser adapter boundary; browser-independent filtering remains in core.
- Missing or failed source reads must not be presented as successful refreshes.
- Folder-name matching and folder scoping stay distinct operations.
