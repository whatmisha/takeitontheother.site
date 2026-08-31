# Dither shared-framework migration

Dither remains a classic-script Canvas application. Its image transforms,
overlay interaction, preprocessing, dithering algorithms and PNG export were
not rewritten during the shared-framework switch.

## Shared responsibilities

- `js/framework/FrameworkAdapter.js` is the sole active JavaScript façade to
  `framework/src/index.js`.
- Color conversion delegates to the shared `ColorUtils` public API.
- Both draggable panels use the shared `PanelManager` through a small
  `DitherPanelManager` compatibility subclass. The former 118-line local drag
  implementation was removed.
- `framework-base.css` loads the shared framework stylesheet in a lower cascade
  layer. The unlayered Dither stylesheet remains the frozen compatibility skin
  during the parity phase.

## Private responsibilities

- Canvas drawing, image/sample loading, transform handles, overlay hit-testing,
  Floyd-Steinberg/Bayer/random dithering, preprocessing and alpha PNG export
  remain application-owned.
- Dither's panel adapter preserves two source-specific rules: panel content
  clicks do not change stacking, and header dragging is not clamped to the
  viewport.
- The existing 1280×720 vertical overflow and the unsuited mobile layout are
  preserved. Mobile migration is outside Dither's agreed contract.

## Acceptance evidence

- Nine automated tests cover the public framework boundary, CSS ordering,
  panel compatibility and golden synthetic outputs for Bayer,
  Floyd-Steinberg, pixel-size, preprocessing and deterministic random modes.
- At 1280×720 the default full-page screenshot is byte-identical to the source
  (`89276268fa5c9c025ec0d251983e4ca1d1514ea01424d75e5f2d7ed6bff77712`).
- Bayer mode is byte-identical
  (`ef32e2fa9170f4db4fbe91e6ee6340ce3c50ad40646ecc371e2c21582b7b74a9`),
  including the canvas raster and unchanged panel stacking.
- Pixel Size 4 is byte-identical
  (`06d199227bfa668345cb8e13c7fa24ab7b81c071f6c8ca7cde085d7a4dcf1c0d`).
- Default canvas, overlay, both panels, bottom buttons, all recorded inputs and
  help-modal open/closed state match the source metrics exactly.
- Browser console/error capture is clean. `npm run test:dither` and
  `npm run check:isolation` pass.

## Compatibility finding

The base `PanelManager` normally raises a panel on every `mousedown`. Dither's
source changes z-index only when a header drag starts. Applying the base rule
caused a small deterministic repaint difference inside the canvas after a
pattern click. The adapter therefore keeps ordinary content clicks
paint-neutral while retaining shared registration and drag lifecycle behavior.

## G5 navigation finding

The UPG-052c attempt to replace Dither's standalone `.yf-tools-link` with the
canonical `.top-link` was reverted. Although the canvas, overlay, panels,
actions and recorded input geometry remained unchanged, the canvas-area browser
capture changed deterministically from
`aa118d76bc5106b2147d6eeeb1df8a9291a429d1a6d10bcc037d94f50d9e0591` to
`01b73232f98e196aa73cb43ac9bf2a39fdbe2c74f9c5e493e9a9eb18e5a0d4fe`.

Restoring the original link markup and styles restored the exact baseline hash
`aa118d76bc5106b2147d6eeeb1df8a9291a429d1a6d10bcc037d94f50d9e0591`.
Dither therefore keeps its legacy navigation until the raster coupling is
isolated in a dedicated investigation; no changed baseline was accepted.
