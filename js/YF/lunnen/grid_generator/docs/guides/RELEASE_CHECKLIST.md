# Release checklist

Updated: 2026-08-12.

## Automated — completed

- [x] `npm --prefix tools test` — 155/155 tests.
- [x] `npm --prefix tools run public:check` — browser-resolvable static module
  graph, current schema/manifest, exact vendor copies and current hashed runtime.
- [x] `npm --prefix tools run presets:check` — 19/19 presets and manifest.
- [x] `npm --prefix tools audit --audit-level=low` — 0 vulnerabilities.
- [x] `npm --prefix tools run build` — 105 transformed modules.
- [x] `tests/browser-smoke.html` — `PASS — 76 checks` in the local Chromium
  browser, with no uncaught application errors.

The browser suite runs through the hashed public entry served by the same
ordinary static-server path used by Netlify. It covers JSON round-trip,
New/Front/reverse presets, Caption,
Sides, own grids, all canvas rotations, screen-axis pan, Fit/zoom, rotated
cross-surface dragging, object editors, locks/units, modular shell assembly,
performance metrics, SVG template caching and accessible error presentation.
Outlined SVG and PDF were also exercised with all three lazy local runtime
libraries loaded successfully; the Vite production build passed the same
startup and PDF-runtime checks.
- [x] Airis 14 Back transfers text width `3/12 → 4.5/18` and graphics width
  `2.8/12 → 4.2/18` when moved from Front to Left.

## macOS Quick Look — completed for the reported regression

- [x] The supplied Airis baseline with the repaired BOM/XML encoding header
  renders Cyrillic correctly through the system Quick Look generator.
- [x] Automated SVG tests preserve that UTF-8 header independently of baseline
  visibility.

## Safari — manual release acceptance

- [ ] Open `New`, one Front preset and one Back preset.
- [ ] Check Fit, zoom, four rotations and screen-axis pan.
- [ ] Drag text and graphics between Front and every side.
- [ ] Enable Own Grid; change units, lock and orientation.
- [ ] Export/import JSON and compare Caption, Lunnen Display and Sides.

## Adobe Illustrator — manual release acceptance

- [ ] Open SVG exports with baseline on and off, both as text and with Outline
  fonts.
- [ ] Verify artboard millimeters, Cyrillic, surface orientation, objects and
  clipping.
- [ ] Open the PDF export and verify artboard size and outlined text.
