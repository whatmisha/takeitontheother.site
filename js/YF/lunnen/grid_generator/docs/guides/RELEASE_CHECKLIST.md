# Release checklist

Updated: 2026-08-12.

## Automated — completed

- [x] `npm --prefix tools test` — 141/141 tests.
- [x] `npm --prefix tools run presets:check` — 19/19 presets and manifest.
- [x] `npm --prefix tools audit --audit-level=low` — 0 vulnerabilities.
- [x] `npm --prefix tools run build` — 371 transformed modules.
- [x] `tests/browser-smoke.html` — `PASS — 70 checks` in the local Chromium
  browser, with no uncaught application errors.

The browser suite covers JSON round-trip, New/Front/reverse presets, Caption,
Sides, own grids, all canvas rotations, screen-axis pan, Fit/zoom, rotated
cross-surface dragging, object editors, locks/units, modular shell assembly,
performance metrics, SVG template caching and accessible error presentation.

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
