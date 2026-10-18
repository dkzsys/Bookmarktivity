# 0003: Search shortcuts and folder tree interaction

Status: Accepted

## Decision

The desktop UI treats `Command+F` (`Ctrl+F` on Windows and Linux) as global search. It returns to All bookmarks across enabled profiles, clears search within results, and focuses the primary query while keeping that query and its field/mode choices. `Option+F` (`Alt+F` on Windows and Linux) focuses search within the current results without changing the underlying query or folder scope.

Two `Escape` presses in quick succession reset search queries, folder scope, field restrictions, regex mode, sort, and collapsed result branches. They do not change which browser profiles are enabled.

The Your Folders section and its branches are disclosures, with Collapse all and Expand all controls for the navigation branches. These controls do not change the active folder scope or search-result expansion. Folder rows in search results also expand and collapse. Up/Down navigate visible rows; Right expands or moves into a branch; Left collapses or moves to its parent. The eligible result set can include a matched folder's full subtree for a standalone folder-name search, as specified in [decision 0004](0004-manual-reread-and-folder-name-search.md).

## Consequences

- The desktop UI owns shortcut handling, focus, and expansion state.
- Core filtering determines the eligible result set before the UI arranges it as a tree. Expansion only reveals records already eligible for that search mode.
- Visible shortcut labels and focus state are needed in the desktop design.
