# Product definition

## Purpose

Bookmarktivity combines **bookmarks** and **productivity**. It is a standalone desktop workspace for power users who need to find and navigate large bookmark collections quickly, especially with the keyboard. Every result must make its browser and profile of origin clear.

## Confirmed scope

- The app is standalone, not a browser extension. It targets macOS, Windows, and Linux; which platforms ship in the first release remains open.
- Microsoft Edge is the first browser integration. The design must allow additional local browser integrations later.
- Users select individual local profiles in the first Settings tab. Only enabled profiles appear in the workspace or search results. The second Settings tab contains keyboard shortcuts, while the main toolbar contains the light/dark appearance toggle.
- The app reads bookmarks directly from enabled local browser profiles. Initial access is read-only; editing browser data requires a separate, tested design.
- On launch, the app rebuilds its bookmark model and search data in memory from enabled profiles. It does not persist a separate bookmark database initially; revisit a local database if measured performance falls short of expectations.
- Users can manually re-read bookmarks from all enabled sources, one browser source, or one enabled profile. A source-level re-read covers only its enabled profiles; disabled profiles are not read. Re-reading updates only the targeted derived data without writing to browser profiles, reapplies the current query and scope, and reports per-profile read failures without showing stale data as newly refreshed.
- A combined workspace can show bookmarks from multiple enabled profiles while keeping their browser and profile identities distinct. It does not merge profiles or sync data between them.
- The project is open source under the MIT License.

## Search and filtering

Search must support these fields independently and in combination:

- Folder name: a folder result's own name or a bookmark's immediate containing folder name. Ancestor names and the full folder path are not searched by this field.
- Bookmark name.
- Bookmark URL.

Users can search across all fields or restrict a search to any selection of those fields. The query language should support `folder:`, `name:`, and `url:` field prefixes; quoted phrases that match a literal substring anywhere within a field, including part of a word; `AND` and `OR`; and a regular-expression mode controlled by a toggle. Text matching is case-insensitive by default. The search UI should explain active fields and modes so a user can see what a query means.

Folder scope must support both a selected folder **and its descendants** and a selected folder **only**. The `folder:` prefix matches folder names; the folder navigation controls search scope. The exact query syntax for descendants versus direct children remains to be defined. Search within the current result set must be possible, so a user can progressively narrow results without rebuilding the original query. A global search returns to **All bookmarks** across enabled profiles; a search within results retains the current query and scope.

Results include matching folders and bookmarks and show folders first within the chosen sort order. All result folders start collapsed, including in the default view. Expanding one folder reveals its immediate contents while leaving child folders collapsed. A folder matched by a standalone folder-name search includes all bookmarks and subfolders in its subtree, including items whose own names do not match; the user can expand child folders to inspect them. The same rule applies to a standalone folder-name search within results, limited to the current result set. Enabled-profile and active folder-scope restrictions still apply. Other refinements narrow these contents. Compound queries follow their own matching terms; their exact grammar remains an open decision. Other search modes show only matching results. Highlight matching text in visible fields. When a bookmark is selected, show its full folder path and browser/profile source. The **Your Folders** navigation section and its folder branches can be collapsed and expanded individually or with **Collapse all** and **Expand all** controls. These controls change navigation display only; they do not change search scope or collapse state in search results. Folder context menus offer **Expand all** and **Collapse all** for the selected folder and its descendants in either the navigation or results tree. A toolbar toggle shows or hides each folder's total bookmark count, including descendants, across enabled profiles.

Users can choose a relevance order using fuzzy matching and ranking, and explicit orders including recent, date created, date modified, and alphabetical. Only offer an order when the necessary data exists or Bookmarktivity can define it reliably. A stable tie-breaker should keep results from jumping unexpectedly. The precise fuzzy ranking and the meaning of “recent” are open design decisions.

### Query examples to validate in the search design

These illustrate desired behavior, not final parser syntax:

| Query or action | Intent |
| --- | --- |
| `name:"Project plan"` | Match those words anywhere within a longer bookmark name. |
| `url:docs.example.com AND name:guide` | Both conditions must match. |
| `folder:Research` | Match the folder named Research. It starts collapsed; expanding it shows its immediate contents with child folders collapsed. |
| Search in results for `2026` | Narrow the current result set. |
| Limit scope to a folder without descendants | Search direct contents only. |

## Keyboard workflow

- Global search: `Command+F` on macOS and `Ctrl+F` on Windows and Linux returns to **All bookmarks** across enabled profiles, clears the search-within-results filter, scrolls to the primary search field, and focuses it. It retains the primary query and its field/mode choices so the user can revise them.
- Search within results: `Option+F` on macOS and `Alt+F` on Windows and Linux scrolls to and focuses the refinement field without changing the current global query or folder scope.
- Navigate to results: `Command+G` on macOS and `Alt+R` on Windows and Linux focuses the selected visible result, or the empty-results region when there is no result. It does not alter the query, scope, or enabled profiles.
- Profiles & settings: `Command+,` on macOS and `Ctrl+,` on Windows and Linux opens the settings dialog.
- Folder rows in every new result set start collapsed. Expanding a parent leaves its child folders collapsed.
- `Command+E` / `Command+Shift+E` on macOS, or `Ctrl+E` / `Ctrl+Shift+E` on Windows and Linux, expands or collapses the focused folder and all of its descendants. The same actions are available from a folder's context menu. Both shortcuts can be reassigned in Settings.
- Pressing `Escape` twice in quick succession clears search queries, folder scope, field restrictions, regex mode, and result filtering; it restores the default sort and collapsed result view. Enabled profile choices remain unchanged.
- In **Your Folders**, Up/Down move through visible folders, Right expands a collapsed branch or moves to its first child, and Left collapses an expanded branch or moves to its parent. The section itself is a keyboard-operable disclosure.
- In search results, Up/Down move through visible results. Right expands a selected folder and Left collapses it; when already expanded or collapsed, the respective arrow moves to its first visible child or parent where available. Tab and Shift+Tab move through interactive controls with visible focus.
- Enter on a bookmark opens it in the system default browser. Enter on a folder opens or expands that folder rather than trying to launch a URL.
- `Command+C` on macOS or `Ctrl+C` on Windows and Linux copies the selected bookmark URL, when the result list has focus. Normal text-copy behavior remains available inside editable fields.
- Allow shortcut configuration in Settings, including conflict detection and a way to restore defaults.
- Opening a bookmark in a configured preferred browser with `Command+Enter` on macOS or `Ctrl+Enter` on Windows and Linux is a desired enhancement, pending a reliable cross-platform browser-launch design.

Keyboard navigation, selection, and shortcuts must work consistently across the combined workspace, search results, folder view, and Settings where applicable. Visible focus and discoverable shortcut labels are part of the workflow.

## Design principles

- Preserve each bookmark's browser and profile provenance throughout reading, display, search, and any future edits.
- Make profile inclusion explicit and reversible; disabling a profile removes its data from the workspace without changing the browser profile.
- Keep browser-specific access behind adapters and browser-independent search and navigation behavior in core.
- Use local browser data only for features the user enabled; avoid collecting unrelated profile data.
- Make bulk operations previewable and recoverable before offering changes to browser data.

## Terms

- **Browser profile:** A browser-managed identity and local data area, such as an Edge profile.
- **Enabled profile:** A browser profile the user has selected for inclusion in Bookmarktivity.
- **Bookmark source:** The browser and profile from which a bookmark came.
- **Combined workspace:** A view across enabled profiles that keeps each bookmark's source visible.
- **Folder scope:** The subtree, or direct contents only, within which a search runs.
- **Search in results:** An additional filter applied to the current result set.
- **Manual re-read:** A user action that reads bookmarks again from all enabled sources, one source's enabled profiles, or one enabled profile, then reapplies the current view without writing to browser data.

## Open product and implementation decisions

- Which of macOS, Windows, and Linux ship in the first release, and which browser integrations follow Edge.
- Which subset of the search and keyboard workflow forms the first usable release.
- Exact query grammar and precedence for prefixes, quotes, `AND`/`OR`, regex mode, and folder scope; how invalid expressions are reported.
- How a folder name match interacts with folder scoping.
- Fuzzy ranking, “recent” data source, metadata availability across browsers, and fallback behavior for missing dates.
- Whether bookmark data also refreshes automatically, how deleted or moved browser bookmarks are reflected after a re-read, and what measured performance would justify a local database.
- How to discover and launch a preferred browser on each platform, including when it is unavailable.
- Whether a later release edits browser bookmarks; any such design needs concurrency, backup, recovery, and compatibility testing.

Do not treat open decisions or desired enhancements as implemented commitments.
