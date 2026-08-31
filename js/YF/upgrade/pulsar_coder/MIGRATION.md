# Pulsar Coder shared-framework migration

Pulsar Coder remains a static ES-module application. Its codec, ray geometry,
SVG renderer and application-specific zoom rules were not rewritten during the
shared-framework switch.

## Shared responsibilities

- `js/framework/FrameworkAdapter.js` is the sole active JavaScript façade to
  `framework/src/index.js`.
- `PanelManager` and `SliderController` now come from the shared public barrel.
  The two local copies were removed; both checked-in examples use the façade.
- `css/framework-base.css` loads the shared framework stylesheet first and in a
  lower cascade layer. The unlayered v1 Pulsar skin remains the compatibility
  override during the parity phase.
- Four unused TT Commons files that were byte-identical to shared files were
  removed. Their canonical copies remain in `framework/fonts/`.

## Private responsibilities

- UTF-8 framing, CRC32, repetition ECC, seeded ray distribution, SVG geometry,
  presets, center dragging and export remain application-owned.
- `js/ui/ZoomPanManager.js` remains private because its fit/minimum-zoom and
  coordinate behavior differs materially from the current shared manager.
- The old ColorPicker/ColorUtils and DOM utility files are retained only for the
  legacy component example; they are not imported by `index.html`.
- Lunnen Display remains private because its hashes differ from the shared font.

## Acceptance evidence

- Eight automated tests cover the façade, private zoom boundary, CSS ordering,
  centralized fonts and deterministic codec values.
- At 1280×720, before/after state is byte-for-byte equal for the recorded metric
  object: 1000×720 SVG, viewBox `0 0 1000 1000`, 231 lines, all panel geometry,
  inputs, Voyager preset text, 240 encoded bits and CRC32 `DDC73540`.
- Visual panel expand/collapse returns from 404 px to 46 px; ArrowUp changes ray
  count 14→15; Dense preset produces 20 rays and 244 SVG lines; reload restores
  Voyager exactly; SVG download produces no browser error.
- Loading shared CSS as an ordinary stylesheet changed Encoding panel height
  from 214.6015625 px to 220 px. The lower cascade layer restores exact parity
  while keeping the shared stylesheet active.
- `npm run test:pulsar` and `npm run check:isolation` pass.

## Recorded source defect

The original `verifyPulsar()` reconstruction interleaves rays even though
`splitBitsToRays()` partitions the stream into contiguous chunks. Therefore the
default Voyager payload reports a CRC failure before and after migration. A
regression test records this existing behavior; fixing it is a separate domain
change and must not be mixed with parity migration.

## G5 navigation rollout

UPG-052b intentionally replaces the legacy `.yf-tools-link` with the canonical
shared `.top-link` and adds `aria-label="Back to Upgrade Tools"`. The link moves
from the legacy system 14.4/600, 8×15 px presentation to shared CoFo Sans
16/500, 8×20 px. Full-page hashes change from
`ea0d817dcc07ca9bfb317d4a846c6919ea82f7ed5df53ad1cc3da51b38d94faf`
to `b6472733b2121fe15c6a161003f1e8e97e767d7607020274dbfd95fa1590c42a`.

Preset and zoom control sizes, all three panel rectangles, `pulsarSvg`
geometry/markup and every recorded input remain exact. A narrow padding rule
promotes the shared component above the legacy universal reset and is scheduled
for removal with the legacy stylesheet in UPG-058.

## G5 panel-title rollout

UPG-053c promotes the three panel titles from the legacy 13.6 px to the shared
14.4 px contract. An explicit 16 px line-height prevents the font-size promotion
from changing the 46 px header boxes or any panel anchor. The default Main,
Encoding and Visual rects remain 300×560, 300×214.6016 and 300×46; expanded
Visual remains 300×404 and collapsed Main remains 300×46.

The intentional full-page capture change is
`8f2688addbe699f00c5567d27e4112e825ee79f5fff23567c82aa2eaf71eeaa5` →
`435f6961e44d1a85ad379474d938099374b75929fb7cba3b9255ad6b4b0a007a`.
The 1000×720 SVG rect and exact 40 180-character markup, all 22 form states,
collapse/restore classes and content padding remain unchanged. Eight Pulsar
tests and the complete isolation check pass.

## G5 collapse accessibility

UPG-053g removes Pulsar's duplicate click-only handler and calls the shared
`panelManager.initCollapse()`. The three icons now expose role/tabindex,
synchronized expanded state and Enter/Space. There is no visual change: the
full-page capture remains byte-identical at
`435f6961e44d1a85ad379474d938099374b75929fb7cba3b9255ad6b4b0a007a`.
Keyboard-expanded Visual remains 300×404, collapsed Main remains 300×46, and
the exact 40 180-character SVG plus all 22 inputs restore unchanged.

## G5 value-display canary

UPG-054b removes only Pulsar's duplicate base `.value-display` normal/focus
rules. The eight numeric displays now consume shared transparent/tabular,
focus and disabled presentation; local wrapper/layout and every range rule stay
private. A boundary test prevents reintroducing the local base selector.

The accepted visual difference is limited to removal of legacy
`min-width: 40px` and 4 px right padding. Display boxes remain 15 px high and
keep the same right edge, while width changes 144.5→140.5 px. All range rects
and min/max/step, panel rectangles, 22 form states and the exact
40 180-character SVG remain unchanged after reload. Arrow 14→15,
Shift+Arrow 14→16, Enter/blur, Escape and live range behavior match the
pre-change baseline. Eight Pulsar tests, isolation and full Gate G4 pass.

## G5 ordinary-range canary

UPG-054k removes Pulsar's duplicate ordinary range/thumb/track/hover/focus
skin. All eight active ranges now consume shared presentation. One narrow
`margin-top: 6px` bridge remains because the frozen unlayered universal reset
would otherwise beat the lower-layer framework margin and move every range.
Controller/config/codec behavior and the inactive legacy HSB block are not
changed.

At 1280×720 the before/after normal, hover and focus captures are byte-exact.
All eight range records retain 252×10 geometry, min/max/step, 6 px top and 0 px
bottom margins; panels, canvas and 22 input/select states are exact. The SVG
remains 40 180 characters with hash `97155e5a…`. Live range 14→15→14, draft
999 + Escape, Arrow and Enter restoration preserve the accepted lifecycle.
Eight Pulsar tests, isolation and full Gate G4 pass.
