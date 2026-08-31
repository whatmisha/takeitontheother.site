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

## G5 value-display rollout

UPG-054h removes Dither's unscoped `.value-display` base and focus rules. The
shared stylesheet now owns normal/focus/disabled presentation. Dither retains
only a scoped flex-layout extension and its existing `.hsb-value` variant;
percentage/degree formatting, focus snapshots, private range handlers, cache
invalidation, Canvas processing and PNG export remain application-owned.

A direct move from the legacy `font-variant-numeric: normal` to shared
`tabular-nums` changed the default full-page capture from `89276268…` to
`c799d96b…` and the canvas-area capture from `aa118d76…` to `698cacf2…` even
though all DOM values and geometry were exact. Per Dither's documented rollback
rule, that single glyph-metric change was rejected. Scoped normal glyph metrics
restore the original raster while the unscoped base/focus duplicate stays
removed. The ten visible fields now compute `min-width: auto` instead of 40 px,
but remain at the exact 140.5×15 positions; the three HSB fields retain their
private 40 px presentation.

Final browser evidence is byte-identical for default (`89276268…`, canvas
`aa118d76…`), Bayer (`ef32e2fa…`, canvas `01021af1…`) and Pixel Size 4
(`06d19922…`, canvas `0941d49e…`). All 38 inputs, 13 ranges, both panels,
bottom actions, 1280×860 document and Canvas/overlay geometry match. Expanded
HSB also matches after animation settles (`c580826c…`, canvas `26c782d3…`), and
closing the help modal returns the exact default bytes.

Browser keyboard checks retain Scale's percentage-space behavior
(100%→101%→111%, Escape→100%; 125% blur keeps the source's native slider
coercion to 1.3) and Rotation's degree behavior (0°→1°→11°, Escape→0°).
The boundary suite additionally guards focus-snapshot rollback, raster cache
invalidation and the unchanged PNG `toBlob` path. `npm run test:dither` passes
10/10.

## G5 private-range boundary

UPG-054p makes no production change and formally excludes all 13 Dither ranges
from the shared range skin. The ten ordinary and three HSB controls keep their
1 px tracks, 10 px thumbs, `-4.5px` WebKit centering, hover `scale(1.3)` and
private default cursor. The controller retains six 16 ms debounced raster
updates alongside immediate transform/rotation paths, private value formatting
and cache invalidation. The accepted default/Bayer/Pixel Size 4 Canvas evidence
above remains valid because Dither production sources have not changed. The
expanded boundary suite passes 11/11.

## G5 raster-safe shared choice rollout

UPG-054x removes Dither's full local `checkbox-label` and segmented
base/state blocks. The shared framework now presents the two effect switches
and the three pattern radios. Dither keeps only the measured compatibility
values that differ from the shared default: 0.85rem segment text, 1 px top/left
label margins, 2 px bottom margin and `gap: normal`.

The first after capture shortened the segment by 2 px and was rejected. The
scoped bridge restores the exact 44.6015625 px segment, both checkbox positions,
38 form states, both panels and Canvas/overlay geometry. The four bottom-bar
export controls remain private native 16×16 checkboxes; ×2/×4/×8 exclusivity
and alpha/export behavior were not moved into the framework.

Default, Bayer and Pixel Size 4 comparisons report zero changed RGB channels
across the 246,440-pixel Canvas region. The only non-raster difference observed
in the Pixel Size 4 full-page harness is a 2 px automatic scroll position in
the right panel, with every changed pixel confined to x≥976. Invert and Show
Effect off/on cycles change the raster and return it exactly; the private ×2
checkbox restores its initial state. Pattern focus remains a 2 px outline with
2 px offset. Browser errors are zero.

`npm run test:dither` passes 11/11; `check:toggles` and full Gate G4 pass.

## G5 raster-safe action-bar rollout

UPG-056g removes Dither's local fixed-button base and promotes the shared shell
through the frozen reset. Dither retains only its 20 px left anchor/z-index,
36 px destructive remove controls, four native 16×16 raster-export labels and
all private processing/export behavior.

The intentional ordinary-button change is Arial 14.4/600, 8×15 px, 1 px border
and 35.5 px height to CoFo Sans 16/500, 8×20 px, no border and 36 px. Bar width
changes 904.695→947.742 px while the left and bottom anchors remain exact.
Default, Bayer and Pixel Size 4 each produce the same full-page difference
`21675/max255/[8,400,623,423]`, entirely outside the Canvas region: Canvas pixels,
38 fields, both panels and Canvas/overlay geometry are unchanged. Transparency,
exclusive ×2/×4/×8, PNG ×2, disabled/no-image and reload restoration pass with
zero browser errors. All 11 Dither tests and the action contract pass.

## G5 shared overlay lifecycle canary

UPG-057e moves only the existing Help overlay lifecycle into the shared
`OverlayDialogHost`. Dither still owns the complete markup, instructions and
CSS. Its adapter is the sole import boundary, while `openModal()` and
`closeModal()` remain thin compatibility methods. The duplicate app-local
Escape, help-button, close-button, backdrop, class and body-overflow handlers
were removed.

The closed default page, Bayer and Pixel Size 4 states are exact before/after:
all recorded controls, both panels, Canvas/overlay geometry and full-page RGB
captures have zero differences. The open content also retains its exact
600×483.523 px rectangle, 30 px padding, 12 px radius, 600 px max-width,
576 px max-height, background and transform. The only accepted open-state
visual delta is the focus indicator moving from the Help trigger to the close
button; no content or layout pixels moved.

The shared host adds initial focus, a one-control Tab loop, Escape and backdrop
dismissal, focus return to `helpButton`, `aria-haspopup`/`aria-controls`/
`aria-expanded`, and exact scroll restoration. Browser checks cover all of
those states with no module error. Framework tests pass 41/41, Dither 11/11,
and the full Gate G4 remains green.
