# 0001: Standalone desktop app with Edge as the first browser

Status: Accepted

## Decision

Bookmarktivity is a cross-platform standalone desktop app, not a browser extension. Microsoft Edge is the first browser integration. Users select which local Edge profiles to include; the profiles and their bookmarks remain distinct.

## Consequences

- The desktop app must discover and access user-selected local browser profiles.
- Browser-specific code belongs behind an adapter boundary.
- The shared bookmark model must preserve browser and profile provenance.
- The desktop runtime and first-release operating systems remain open decisions.
- The first-release editing behavior remains an open decision.
