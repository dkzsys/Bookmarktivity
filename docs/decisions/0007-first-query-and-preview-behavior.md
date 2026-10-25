# 0007: First query grammar and synthetic browser preview

Status: Accepted for the first implementation

## Decision

The first parser accepts whitespace-separated terms, field prefixes name:, url:, and folder:, quoted phrases, explicit AND, and OR. Adjacent terms imply AND; AND has precedence over OR. Matching is case-insensitive. Unquoted terms match substrings or a nearby word within one or two edits, depending on length; quoted phrases require contiguous text within a field, not whole-field equality. Invalid syntax is reported in the result area. Regex mode applies the full primary query to the selected fields, runs in a worker, and is stopped after a short timeout. The refinement query uses the same text grammar and narrows the primary result set.

Text searches also run in the worker. They are debounced and can finish without a fixed timeout; a newer query stops an older in-flight search. Only the latest result is displayed. The UI shows a searching state until that result arrives. The regex timeout remains because a pathological expression can keep the worker busy indefinitely.

A single folder: term, or an unprefixed term with only the folder field selected, is a standalone folder search. Matching folder rows start collapsed and can reveal their descendants. A compound query uses ordinary term matching.

The browser preview loads synthetic records from apps/desktop/src/sample.ts. It cannot read local Edge data. Native profile access is available only through Tauri commands; the host checks enabled profile IDs before reading.

Search, refinement, result-focus, and copy shortcuts can be changed in Settings. Duplicate bindings are rejected and defaults can be restored. Double Escape, tree navigation, and Enter remain fixed.

## Consequences

- Search behavior is explicit and testable without a browser adapter.
- Regex execution cannot block the React thread indefinitely.
- The preview can be reviewed without access to private browser data.
- Ranking can be refined after measuring large real collections. Release-platform validation remains separate work.
