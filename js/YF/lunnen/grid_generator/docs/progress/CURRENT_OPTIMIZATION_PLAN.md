# Stabilization and refactoring plan — completed

Updated: 2026-08-12.

JSON files in `presets/` remain the source of truth. Chrome/Safari behavior,
Illustrator-compatible output, canvas-only rotation, surface-local grids and
cross-surface dragging remain release invariants.

## Completed product work

- Surface orientation, visibility, own grid, compact Sides UI and persistence.
- Canvas rotation, screen-axis pan, Fit/zoom and rotated object dragging.
- Full JSON 1.2 round-trip for locks, units, Caption, Lunnen Display, graphics
  constraints and every side-surface setting.
- All 19 source presets migrated and validated from one JSON Schema contract;
  legacy import branches removed.
- UTF-8-safe Illustrator/Quick Look SVG, local outlined-text/PDF dependencies,
  SVG sanitization and deterministic application lifecycle.
- Updated E-ink preset and Caption settings.
- Relative text and graphics widths survive transfer between 12-column Front
  grids and 18-column Left/Right grids, including drag and editor selection.

## Completed optimization sequence

1. `GridGenerator` now supplies explicit frozen ports to preset, export,
   application-event, Grid and object-editor controllers instead of handing
   those priority areas the full composition root.
2. The 2,711-line stylesheet is split into eight ordered modules under
   `styles/`. The 1,096-line application body is split into six raw HTML
   fragments under `src/ui/fragments/`; the root shell stays minimal and waits
   for ordinary same-origin fragment requests before controllers read the DOM.
3. Immutable design-kit SVG templates are fetched and parsed once. Render and
   export timings plus cache hit/request counters are available through
   `GridGenerator.getPerformanceMetrics()`.
4. JSON cloning uses one helper. Import, preset and PDF failures use one
   disposable, accessible, non-blocking notification instead of `alert()`.
5. Source validation, schema freshness, all presets, production build and the
   real browser flow are covered by the final verification matrix.
6. The public `index.html` now points at an atomic set of content-hashed assets
   under `runtime/`. HTML fragments and the three pinned export libraries are
   separate hashed assets; a source fingerprint prevents stale runtime commits.
   Public startup no longer depends on Vite aliases, raw imports or
   `tools/node_modules` and cannot mix modules from different releases.

## Verification baseline

- 50 Node test files / 155 passing tests.
- Browser smoke: `PASS — 76 checks`, including modular shell assembly,
  metrics, asset cache and non-blocking error UI.
- 19/19 presets valid and manifest current.
- Static public module graph: 99 browser-resolvable modules; pinned vendor
  copies verified byte-for-byte.
- Hashed public runtime: 15 assets, source fingerprint verified.
- Vite production build: 105 transformed modules, Safari 17 / Chrome 120
  targets.
- `npm audit`: 0 vulnerabilities.
- Root-visible application files: `index.html`, `script.js`, `style.css`;
  hidden `.gitignore` is intentionally retained.

No code-refactoring stage from this plan remains. Safari and Adobe Illustrator
acceptance is intentionally manual and is tracked separately in
`docs/guides/RELEASE_CHECKLIST.md`.
