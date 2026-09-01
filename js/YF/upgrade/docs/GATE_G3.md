# Gate G3 — Primary tools on the shared framework

Gate G3 covers the five primary tools: Wordplayer, Keyboarder, Sparky, Pizza Boxer and Sticky Fingers.

## Static acceptance

Run from `upgrade/`:

```sh
npm run gate:g3:static
```

The current gate checks source provenance, local assets, storage and filesystem/network boundaries, 34 framework conformance tests, 196 Sparky tests, 167 Pizza Boxer tests, Wordplayer worker suites, Keyboarder domain/export suites and four Sticky Fingers boundary/domain checks.

## Browser acceptance recorded

- Wordplayer: exact Canvas geometry and Dither/Forms mode parity.
- Keyboarder: exact 110-cap SVG geometry, text/outline switching, SVG export and editable embedded-font PDF.
- Sparky: exact desktop geometry plus 390×844 and 430×932 mobile parity, touch interaction, modes, panels and static exports.
- Pizza Boxer: exact 1280×720 DOM/SVG/panel/value parity, panel interaction and SVG export; its hashed Vite entry imports the shared public barrel at runtime.
- Sticky Fingers: exact normal/edit layout parity, all three manifest presets, Laptop ↔ Tablet round-trip, live Google Sheets load and local-font PDF export. The existing EAN-13 checksum warning is intentionally preserved.

## Result

All five primary tools use `framework/src/index.js` directly or through a documented façade. No application imports runtime files outside `upgrade`, and Sparky remains the protected compatibility sentinel.
