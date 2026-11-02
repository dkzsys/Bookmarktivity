# Bookmarktivity UI review

Open [bookmarktivity-concepts.html](bookmarktivity-concepts.html) locally. Its three directions use the same synthetic bookmarks and simple search, folder scope, sorting, and selection interactions. This is a design study, not the production application. Browser profile data is not used.

## What the current UI does well

- The folder, results, and detail regions match the core search workflow.
- Browser and profile source stays visible in results and details.
- Search fields, regex mode, scope, sorting, and keyboard commands are discoverable.
- Selected results have a clear detail view with the full path and source.

## What makes it feel generic

1. The dark gradient sidebar, violet highlights, soft shadows, and rounded cards all compete for attention. The bookmark names and URLs should carry the hierarchy.
2. Result cards spend too much vertical space on decoration. For a large collection, users need to scan many records and compare names, URLs, folders, and sources quickly.
3. The top bar contains several equal-weight controls, while search itself also has a large panel and button. This splits focus between navigation, settings, and the main task.
4. Small labels and metadata in the current CSS (often 9–11px) make provenance, URLs, and counts harder to read. Their importance deserves legible type and contrast.
5. Decorative text glyphs and emoji-like symbols vary by platform. A single SVG icon family or text labels would suit this cross-platform desktop tool better.

## Three directions

| Direction | Core idea | Strongest use | Trade-off |
| --- | --- | --- | --- |
| **01 · Workbench** | A precise, familiar desktop utility with neutral surfaces, compact rows, and one muted green accent. | Best default for a broad cross-platform audience. | Less visual personality. |
| **02 · Archive** | A warm reference library with serif titles, paper tones, and spacious groups. | Best when the product should feel like a personal collection. | Fewer visible results; typography needs careful testing on every OS. |
| **03 · Index** | A keyboard-first record index with a narrow rail, dense rows, and a bottom inspector. | Best for large collections and fast repeated search. | Greater learning curve; detail pane is less prominent. |

## Recommendation

Start with **Workbench** as the structural base, then test **Index** row density and its bottom inspector with users who have large collections. Borrow the warmth of **Archive** sparingly if the neutral version feels too clinical. Whichever direction is chosen, retain explicit browser/profile provenance and visible keyboard focus.

The HTML concepts intentionally omit live profile discovery, source re-reading, query grammar, folder tree expansion, and Settings. Those should be evaluated after selecting a visual direction, using the existing product and architecture requirements.
