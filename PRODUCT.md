# Product definition

## Purpose

Bookmarktivity combines **bookmarks** and **productivity**. It is a standalone desktop workspace for power users who need to find and navigate large bookmark collections quickly, especially with the keyboard. Every result must make its browser and profile of origin clear.

## Confirmed scope

- The app is standalone, not a browser extension. It targets macOS, Windows, and Linux; which platforms ship in the first release remains open.
- Microsoft Edge is the first browser integration. The design must allow additional local browser integrations later.
- Users configure browsers and select individual local profiles in Settings. Only enabled profiles appear in the workspace or search results.
- The app reads bookmarks directly from enabled local browser profiles. Initial access is read-only; editing browser data requires a separate, tested design.
- A combined workspace can show bookmarks from multiple enabled profiles while keeping their browser and profile identities distinct. It does not merge profiles or sync data between them.
- The project is open source under the MIT License.

## Search and filtering

Search must support these fields independently and in combination:

- Folder name, including the containing folder path.
- Bookmark name.
- Bookmark URL.

Users can search across all fields or restrict a search to any selection of those fields. The query language should support `folder:`, `name:`, and `url:` field prefixes; quoted phrases for exact text matching; `AND` and `OR`; and a regular-expression mode controlled by a toggle. Text matching is case-insensitive by default. The search UI should explain active fields and modes so a user can see what a query means.

Folder scope must support both a selected folder **and its descendants** and a selected folder **only**. For example, `folder:` can identify a folder scope, but the exact syntax for distinguishing descendants from direct children remains to be defined. Search within the current result set must be possible, so a user can progressively narrow results without rebuilding the original query.

Results include matching folders and bookmarks and show folders first within the chosen sort order. The result list shows only matches under the enabled profiles and active folder scope; matching a folder name must not silently expose every nonmatching bookmark below it. Highlight matching text in visible fields. When a bookmark is selected, show its full folder path and browser/profile source.

Users can choose a relevance order using fuzzy matching and ranking, and explicit orders including recent, date created, date modified, and alphabetical. Only offer an order when the necessary data exists or Bookmarktivity can define it reliably. A stable tie-breaker should keep results from jumping unexpectedly. The precise fuzzy ranking and the meaning of “recent” are open design decisions.

### Query examples to validate in the search design

These illustrate desired behavior, not final parser syntax:

| Query or action | Intent |
| --- | --- |
| `name:"Project plan"` | Exact phrase in a bookmark name. |
| `url:docs.example.com AND name:guide` | Both conditions must match. |
| `folder:Research` | Scope or match by folder; exact interpretation must be settled. |
| Search in results for `2026` | Narrow the current result set. |
| Limit scope to a folder without descendants | Search direct contents only. |

## Keyboard workflow

- Search focus: `Command+F` on macOS and `Ctrl+F` on Windows and Linux.
- Move through results with Up/Down; use Left/Right to collapse or expand folders in a tree view. Tab and Shift+Tab move through interactive controls with visible focus.
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

## Open product and implementation decisions

- Which of macOS, Windows, and Linux ship in the first release, and which browser integrations follow Edge.
- Which subset of the search and keyboard workflow forms the first usable release.
- Exact query grammar and precedence for prefixes, quotes, `AND`/`OR`, regex mode, and folder scope; how invalid expressions are reported.
- Whether quoted text means an exact phrase or a full-field match, and how a folder name match interacts with folder scoping.
- Fuzzy ranking, “recent” data source, metadata availability across browsers, and fallback behavior for missing dates.
- Whether Bookmarktivity maintains a local index, how it refreshes, and how deleted or moved browser bookmarks are reflected.
- How to discover and launch a preferred browser on each platform, including when it is unavailable.
- Whether a later release edits browser bookmarks; any such design needs concurrency, backup, recovery, and compatibility testing.

Do not treat open decisions or desired enhancements as implemented commitments.
