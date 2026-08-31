# Wander Bender shared-framework migration

Wander Bender keeps the original three-mode application and its Paper.js
geometry. The migration replaces only generic UI infrastructure and external
runtime delivery; it does not rewrite Radial, Random or Flow Field behavior.

## Shared responsibilities

- `js/framework/FrameworkAdapter.js` is the only active JavaScript façade to
  `framework/src/index.js`.
- Sliders use the shared `SliderController` directly.
- Panel registration, drag lifecycle and collapse behavior use the shared
  `PanelManager` through a small `WanderPanelManager` compatibility subclass.
- `css/framework-base.css` loads the shared framework stylesheet in a lower
  cascade layer. The two original Wander stylesheets remain the unlayered
  compatibility skin during the parity phase.
- Paper.js 0.12.17 is loaded from the local shared vendor directory.

## Private responsibilities

- `RadialMode`, `RandomMode`, `FlowFieldMode`, Paper.js boolean geometry,
  extraction state, SVG rendering and SVG export remain application-owned.
- Wander's `ZoomPanManager` remains private because its minimum zoom, fixed
  360/120 padding and viewBox behavior differ materially from the shared zoom.
- The panel adapter preserves the legacy drag-position write: it does not reset
  the existing CSS `transform` when writing `left` and `top`.
- The original long Random and Flow Field panels remain taller than a 720 px
  viewport. This desktop behavior is intentional parity; mobile support is not
  part of Wander's agreed contract.
- The `pattern/` implementation remains donor evidence only. It is not copied
  into, imported by or served from the active Wander runtime.

## Acceptance evidence

- Ten automated tests cover the public framework boundary, local Paper.js,
  CSS ordering, panel compatibility, all three deterministic modes, extraction
  lifecycle, shape sampling and spatial hashing.
- At 1280×720 the source and Upgrade canvas/panel regions are pixel-identical in
  Radial, Random and Flow Field. The required back-link text is the only
  full-page relocation difference.
- Recorded Upgrade captures: Radial
  `70c2f6a7c9e3b2ae9e10bed0c3a8354e716e97e748512dd1c25b1287fdc9dc4e`,
  Random `4ead03902dfb9bae9ddb558d46406236637885ac30b4300fd7281550aa1c1648`
  and Flow Field
  `00508f2619213ee3486e15ba3a334d1ebe8a0babbc89c9cfab55322dbd748707`.
- The default modes retain 3 radial elements, 20 seeded random elements and 41
  seeded flow elements. Their generated SVG markup matches the source.
- Changing Rays from 3 to 6 produces exact source/Upgrade canvas and panel
  captures (`f76a378a6ebd20f3f7b6376f521070d67f552560d64757feaee6398dbca43abe`
  and `59f824b7c6d8a92898c0579f9f7c116d1b822152ade8e17d905040760da380f6`).
- Collapsing the panel preserves its exact 300×46 geometry and pixels
  (`fd096747e1c4719df52c4b8117c775529d14e3671bd10cac71b39da484a0d536`).
- Extracting and resetting a ray preserves exact SVG markup and canvas pixels
  (`1ce78532787ecd53d954d56a8eee7fff5fcea9645d75b752544a69d7c5e52436`).
- `npm run test:wander` and `npm run check:isolation` pass. No active Wander
  runtime reference leaves `upgrade/`.

## Compatibility findings

The shared stylesheet normally caps panel height and visually dims disabled
controls. Both rules changed the frozen Random/Flow layout and the source
appearance of the automatic Stroke and Corner Radius controls. The parity
bridge explicitly restores the source values until the post-parity visual
unification phase.

## G5 navigation rollout

UPG-052a intentionally replaces the legacy `.yf-tools-link` with the canonical
shared `.top-link` contract. The link keeps `href="../"` and the text
`←Upgrade Tools`, adds `aria-label="Back to Upgrade Tools"`, and now uses the
shared CoFo Sans 16/500 presentation with 8×20 px padding. The before/after
full-page hashes are
`129b488a1f8b8c821d579f7911f32cc2acb8497c14a035e7e20a8215add3e2e9`
and `e040205fbba7a5cddbe2c5112afe2bde47f3554f1e5b4bf8986990ea797236bc`.

This is an accepted visual difference, not a new parity baseline. The zoom
button remains 65×36, panel and SVG rectangles are unchanged, and generated
Radial SVG markup is byte-identical. A narrow app rule promotes shared padding
above the legacy universal reset; it can be removed with the old stylesheet in
UPG-058.

## G5 panel title canary

UPG-053b promotes the single panel title from the legacy 13.6 px to the shared
14.4 px / 500 presentation. System-font normal line metrics initially added one
pixel to the header, so that intermediate result was rejected. An explicit
16 px line-height preserves the exact 46 px header, 300×605.703 px panel and
46 px collapsed shell.

The accepted intentional diff is limited to title glyph width (99.445 →
104.563 px) and the full-page hash (`e040205…` → `ea74b23…`). Header padding,
panel/content/SVG geometry, all 41 inputs, exact Radial/Random/Flow SVG markup,
collapse/restore and the tested drag-position adapter remain unchanged.

## G5 collapse accessibility

UPG-053g adds shared role/tabindex, synchronized expanded state and Enter/Space
to the existing icon. The accepted title capture remains byte-identical at
`ea74b23924a91b9cdffd2e942243f065ec9b66e3ec8433c13cdcf6056f963ae7`.
Keyboard collapse is still 300×46 and restores the exact 300×605.703 panel,
Radial SVG and all 41 inputs; the private drag-position adapter is unchanged.

## G5 value-display rollout

UPG-054c moves all 19 base value displays and tabular-number typography to the
shared stylesheet. The legacy wrapper/layout and all range rules remain local.
Wander intentionally keeps its Auto/Max extension: disabled displays remain
opacity 0.3 with a `not-allowed` cursor, while disabled ranges keep their
legacy fully visible presentation.

Seven visible Radial displays keep 15 px height and the same right edge; removal
of legacy min-width/right padding changes each box from 144.5 to 140.5 px and
moves its left edge 4 px. The panel remains exactly 300×605.703, all 41 inputs
restore, and Radial/Random/Flow SVG hashes stay exact. Auto/Max off/on behavior
is unchanged. With width 30, Stroke stays disabled at 25 and Corner Radius at
the dynamic maximum 15; old/new CSS tabs produce the same `b6564ee2…` SVG.
Arrow/Shift+Arrow/Escape behavior, 10 tests, isolation and full Gate G4 pass.

## G5 ordinary-range rollout

UPG-054m removes the local ordinary range/thumb/track/hover/focus duplicate;
all 19 ranges now consume shared presentation. A 6 px top-margin bridge remains
above the unlayered reset. Private Auto/Max disabled styling is unchanged:
ranges remain opacity 1 with pointer/white thumb while displays remain 0.3 and
`not-allowed`.

The 1280×720 normal capture, all 19 range records, 48 controls and the
300×605.703 panel are byte/geometry exact. Radial/Random/Flow screenshots and
1 838/12 261/26 292-character SVGs match before/after. Auto/Max off/on and
width 30 still produce stroke 25, corner maximum/value 15 and the same disabled
states; clean reload restores the exact Radial baseline. Ten tests, isolation
and Gate G4 pass.
