# Current stabilization and refactoring plan

Updated: 2026-08-12.

JSON files in `presets/` remain the source of truth. Chrome/Safari behavior,
Illustrator-compatible output, canvas-only rotation, surface-local grids and
cross-surface dragging are release invariants.

## Completed

- Surface orientation, visibility, own grid, panel UI and persistence.
- Canvas rotation, screen-axis pan, Fit/zoom and rotated dragging.
- Full JSON round-trip, including locks, units, Caption, Lunnen Display,
  graphics constraints and all side settings.
- Preset contract fixed at version 1.2; all 19 source presets migrated and
  legacy import branches removed.
- Runtime preset validation and public JSON Schema 1.2.
- One application disposal lifecycle for global listeners, gesture handlers,
  timers and scheduled renders, with a double-bootstrap regression test.
- JSON Schema 1.2 is the single validation contract. Ajv compiles it into a
  checked-in standalone browser validator; tests and builds reject stale code.
- SVG ingress sanitizer with defense-in-depth before `innerHTML` rendering.
- UTF-8 BOM plus XML encoding declaration for macOS Quick Look SVG parsing.
- Local pinned jsPDF, svg2pdf.js and opentype.js; no export CDN dependency.
- Vite build with hashed production assets and no manual module `?v=` strings.
- Root cleanup: visible files are only `index.html`, `script.js`, `style.css`;
  tooling, documentation and composition code live in subdirectories. The
  hidden root `.gitignore` is intentionally retained.
- Release checklist, current format/startup documentation and archived history.
- 135 unit/regression checks, 64 browser checks, production build and zero
  known npm vulnerabilities.

## Proposed next sequence

1. Replace the busiest whole-host controller dependencies with narrow ports,
   starting with preset application, export, grid commands and object editors.
2. Split `style.css` into tokens/shared controls/panel modules, then split the
   large panel markup while preserving the three-file root shell.
3. Cache immutable design-kit SVG assets and measure render/export performance
   before changing canvas algorithms.
4. Consolidate clone helpers and replace blocking import/export alerts with a
   non-blocking error surface.
5. Complete the manual Chrome/Safari/Quick Look/Illustrator matrix in
   `docs/guides/RELEASE_CHECKLIST.md`.

Evidence and risks: `FULL_CODE_AUDIT_2026-08-12.md`.
