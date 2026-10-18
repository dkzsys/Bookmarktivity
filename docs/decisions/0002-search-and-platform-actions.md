# 0002: Browser-neutral search and desktop platform actions

Status: Accepted

## Decision

Query interpretation, folder scoping, filtering, and sorting operate on browser-neutral bookmark records in `packages/core/`. Search results retain browser, profile, and folder-path identity. Browser adapters provide source data and available metadata; they do not implement product search behavior.

The desktop app owns keyboard interaction, clipboard access, and opening bookmark URLs through platform facilities. A preferred-browser launch remains a product decision until a reliable cross-platform design is established.

## Consequences

- The same search behavior can apply to Edge and future browser sources.
- Search uses only enabled profiles and cannot erase provenance while combining results.
- Sorts requiring missing metadata need an explicit fallback or must be unavailable.
- Platform actions can vary by operating system without changing the core bookmark model.
