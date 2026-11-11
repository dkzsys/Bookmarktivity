# Bookmarktivity full-UI review

**Status:** direction 01 (Native) was adopted for the desktop app on 11 November 2026.

Three complete visual directions for the current desktop app. Unlike the earlier [concepts](../bookmarktivity-concepts.html), each mock keeps **every** element of the shipping UI and works interactively on synthetic data. The data includes Edge, Chrome, Brave, Firefox and Safari profiles, one profile with a read failure and one with a stale-snapshot warning.

Open any file in a browser; the black strip at the top switches between directions.

| File | Direction | Idea |
| --- | --- | --- |
| [01-native.html](01-native.html) | **Native** | A quiet desktop utility. Search lives in the toolbar; search options sit in one filter bar; results are an aligned table (name + URL, location, count, source); the inspector is on the right; settings is a two-pane preferences window. |
| [02-command.html](02-command.html) | **Command** | Keyboard-first and dark by default. A prompt-style query bar with field tokens and an inline "within ›" refinement; dense single-line rows; a bottom inspector; monospace status log; settings as a centred palette. |
| [03-facets.html](03-facets.html) | **Facets** | Search-first and warm. Primary search and "search within results" are shown as steps 1 and 2; fields, matching mode, folder scope and sort become a filter column; rows are larger two-line items; settings is a slide-over drawer. |

Each mock is interactive: typing a search (with field prefixes, quotes, `AND`/`OR`, regex), scrolling and resizing panels, folder scope, expanding and collapsing, right-clicking a folder, the re-read menu, the syntax guide, the light/dark switch, hiding the sidebars and counts, settings (profile toggles, directory controls, shortcut capture), and the default keyboard shortcuts including double Escape.

Review helpers (URL parameters): `?q=research`, `&refine=…`, `&theme=dark`, `&settings=profiles|shortcuts`, `&expand=1`.

## Review of the current UI

What works and should be kept: the folders / results / details structure, visible browser and profile provenance on every row, discoverable shortcuts, and layered search.

Issues with the current styling (`apps/desktop/src/style.css`):

1. **Small type.** Much of the metadata is 9–11px (row paths, source pills, chips, status, labels), so the provenance the product depends on is the hardest text to read. The mocks use 12–13.5px as the floor.
2. **Decoration competes with content.** The gradient sidebar, gradient buttons, hover lift on every button and card, shadows on each result and 39px icon tiles all pull attention away from names and URLs.
3. **Low result density.** Each result is a 68px card with an 8px gap, so about 8 results fit on a laptop screen. Rows in the mocks are 30px (Command), 44px (Native) or 58px (Facets).
4. **Browsers are indistinguishable.** Every source uses the same teal-to-blue gradient letter badge. With five browsers, each badge now needs its own colour.
5. **Platform-dependent glyphs.** `⌕ ▱ ↗ ◫ ⚙ ↻ ▾` render differently on macOS, Windows and Linux. The mocks use one consistent stroke-icon set.
6. **Equal-weight toolbar.** Hide folders, Hide details, Show counts, Settings and the theme switch are all the same text buttons; the mocks make view toggles icons or quieter pills.
7. **Separated controls.** The folder-scope mode select sits at the bottom of the dark sidebar, far from the scope chip and results it affects; sort and re-read are in the results header while the field filters are in the search panel.
8. **Status is easy to miss.** Read failures and stale-snapshot warnings are 10px coloured text under the header. All three mocks give them distinct, readable treatments.
9. **Misleading count.** "All bookmarks" shows the number of enabled profiles, not bookmarks (`App.tsx`, `<span className="count">{enabled.length}</span>`). The mocks show the bookmark total.
10. **Cramped settings.** Settings is a 560px modal that now needs five browser sections. The mocks use a wider two-pane window, a palette, or a full-height drawer.

## Trade-offs

| | Native | Command | Facets |
| --- | --- | --- | --- |
| Visible results (1440×900) | ~11 | ~12 plus inspector | ~4–5 |
| Learning curve | Lowest | Highest | Low |
| Search options | One compact bar | Token row | Filter column (always visible) |
| Details | Right inspector | Bottom inspector (wide screens use space well) | Right card |
| Weak spot | Least personality | Monospace-heavy; bottom inspector costs list height | Fewer rows; folder tree shares the left column with filters |

Suggested path: use **Native** as the base, and borrow the bottom inspector and status log from **Command** as an option for large collections. From **Facets**, consider the numbered "1 Search / 2 Narrow" framing, which makes layered search easier to understand.
