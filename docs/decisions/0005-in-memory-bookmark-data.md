# 0005: Build bookmark data in memory

Status: Accepted

## Decision

On launch, read bookmarks from enabled local browser profiles and build the browser-neutral bookmark model and search data in memory. A manual re-read rebuilds the affected in-memory data from the source. Persist profile selections and app preferences, but do not maintain a separate local database of bookmark contents for the initial implementation.

Keep the model and adapter boundaries independent of this storage choice. Revisit a local database if measurements in the chosen desktop runtime show that launch, refresh, or search performance does not meet expectations.

## Consequences

- Browser profiles remain the source of truth; the in-memory model is derived and can be rebuilt.
- Bookmarks must be read and processed again on each launch. Measure this cost with large synthetic collections across supported platforms.
- Disabling a profile removes its derived data from the workspace without changing browser data.
- A future local database would be a rebuildable cache, not a replacement source of truth, and would need explicit privacy and invalidation behavior.
