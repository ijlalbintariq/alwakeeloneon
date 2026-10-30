# Precedent graph audit — 31 October 2026

Scope: the precedent research page, judgment reader, standalone graph modal, shared citation hydration and navigation, treatment warnings, and graph/list controls. All changes remain local, as requested. Existing drafting fixes are preserved.

## Fixed defects

| Area | Defect and resulting behavior |
| --- | --- |
| Duplicate links | Hydrating API edges again in the reader could repeat citations. Canonical citation keys now deduplicate links within each direction and treatment, preserve resolved IDs and context, and make repeated hydration idempotent. Distinct recorded treatments remain separate. |
| Missing PLD citations | Text extraction missed journal-first PLD citations and dotted reporters. It now reuses the existing citation parser for standard journal-first/year-first forms and extracts only citations present in the supplied text. |
| Self-links | Spacing, encoding, and equivalent PLD court names could leave self-citations in the graph. Normalization removes them without inventing replacement links. |
| Treatment filters | Aliases such as followed, approved, explained, disapproved, reversed, and case/separator variants did not consistently match filter categories. Graph colors, filters, reader warnings, and card indicators now share treatment grouping. |
| Misleading treatment labels | A hardcoded historical citation was flagged as overruled regardless of metadata. Missing treatment was displayed as Good Law, while several distinct treatments were relabeled as overruled. The hardcoded flag is removed; graph badges retain recorded treatment names, negative groups use a broader label, and missing adverse treatment is described as unrecorded. |
| Navigation targets | Numeric linked judgment IDs could crash string handling. Extracted edge pseudo-IDs could route to nonexistent judgments. The graph and warning banner now use the same target resolver: real linked ID, then citation, with no edge-ID fallback. |
| Repeated activation | Double-click could trigger both the second-click action and a separate double-click action. A single activation path now selects first and opens on the next activation. Graph nodes and list entries support keyboard navigation. |
| Selection | Incoming and outgoing edges sharing an ID could select or open the wrong node. Direction forms part of the selection identity. Filters clear hidden selections, selection survives equivalent rehydration, and changing the anchor resets the view. |
| Search and empty states | List view could retain an invisible search filter. Search is available in both views, trims whitespace, and distinguishes no matching links from no recorded links. Counts describe citation links rather than unique judgments. |
| Citation arrows | Inbound arrows pointed away from the cited anchor. Directed markers now consistently run from the citing judgment to the cited authority. |
| Fullscreen | Parent containers could clip the fixed graph. Fullscreen renders through a body portal, focuses its exit control, and closes with Escape. |
| Pan and layout | Zoom multiplied pointer movement, mouse dragging could lose its endpoint, large graphs were squeezed into an unreadable fixed viewport, and mobile filter pills overflowed. Pointer capture, corrected transform order, scrollable native-size SVGs, and wrapping controls address these issues. |
| Clipboard failures | A denied clipboard write could reject without a handled error. The graph now reports failure through the existing toast. |
| Failed modal loads | A failed detail request could appear as a successful empty citation network. The page now reports a loading error when neither detail nor cached graph/text is available. |
| Async navigation | Older responses could replace newer modal/reader targets, reopen a closed modal, or keep the loading screen active after navigating back. Route changes now own judgment loading and invalidate outstanding reader and modal responses. Closing a modal invalidates its pending work too. |

No dependencies were added. Hydration does not infer favorable or adverse treatment from a citation mention; newly extracted mentions remain neutral references.

## Validation

- 163 relevant unit checks passed across the citation graph, parser, API client, reader/search, cross-module drafting integration, and statutes precedent suites, with no failures or skips.
- All 17 Chrome browser checks passed against the local preview, including treatment filters and exact labels, graph/list search, numeric targets, repeated activation, keyboard access, direction arrows, selection collisions, fullscreen/Escape, mobile wrapping, panning at zoom, large-graph scrolling, failed detail loads, citation-slug routing, and reader/modal response races.
- TypeScript checking (`npm run check`) passed.
- The production frontend build passed using `vite build --outDir /tmp/alwakeelo-graph-build`. Existing chunk-size and outdated Browserslist-data warnings remain.
- The three final navigation races were reproduced as failing Chrome tests before simplifying route loading.
- The mobile graph screenshot was visually inspected at 390 × 844 pixels.
- `git diff --check` passed.

Tests live in `tests/unit/precedent-graph-regressions.test.ts`, `tests/unit/precedent-citation-opening.test.ts`, and `playwright-tests/precedent-graph-regressions.spec.ts`. The citation-opening tests now exercise actual shared client functions instead of copied implementation helpers.

## Limits

Browser checks use the real local UI and installed Chrome with synthetic API responses. They validate interactions and response ordering, not production citation completeness, historical legal treatment, ingestion accuracy, live authentication, or database behavior. No production records were changed, and nothing was committed, pushed, or deployed. This audit does not certify the application as bug-free.
