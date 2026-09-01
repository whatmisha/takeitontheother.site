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

## G5 preset presentation canary

UPG-055c removes Pulsar's complete local preset dropdown base and its duplicate
preset scrollbar selectors. The fixed four-item menu now consumes the shared
component. A scoped bridge preserves only the legacy system 14.4/600 toggle,
asymmetric 8×12×8×20 padding, 400 px overflow, text clipping and selected 600.
The four inline preset objects, `applyPreset`, settings and SVG renderer remain
private. `type="button"`, `aria-controls` and `role="listbox"` were added with
no visual effect.

Closed/open computed-style records are exact. Initial 22 form states, panel
rectangles and 40 180-character SVG hash `97155e5a…` match; Accurate and the
subsequent explicit Voyager selection match their own pre-migration snapshots.
The existing difference between startup defaults/label and an explicitly
applied Voyager preset is recorded rather than changed. Full-page captures have
the same closed/open SVG-only raster jitter (291 RGB channels, maximum delta 2)
while dropdown geometry is exact. Outside click and focus pass with zero browser
errors. Eight tests, the preset contract and Gate G4 pass.

## G5 action-bar rollout

UPG-056d removes Pulsar's complete local `.bottom-buttons` and `.btn-fixed`
component base. The three controls now consume the canonical shared shell via
a scoped `revert-layer` promotion required by the frozen universal reset.
Verify, Copy, SVG download, filename and codec behavior remain app-owned.

The intentional presentation change is CoFo 14.4/600 with 8×15 px padding to
CoFo 16/500 with 8×20 px padding. Group width changes 313.664→366.281 px while
its center, 36 px height and bottom anchor stay exact; the raster difference is
confined to the action bar. Copy still flashes green `✓ Copied!` and restores;
Verify retains the recorded legacy CRC failure and closes normally. All 22
fields, three panel rectangles and the exact 40,180-character SVG hash
`97155e5a…` remain unchanged. Browser/module errors are zero; eight Pulsar tests
and the action contract pass.

## G5 shared verification overlay rollout

UPG-057f routes the existing Verify overlay through the shared
`OverlayDialogHost`. Pulsar retains ownership of codec verification, the known
CRC mismatch, rich result HTML and the decision to open the dialog. The host is
configured with `bindTrigger: false`, so pressing Verify still computes and
writes the result before the presentation lifecycle starts. Duplicate local
close and backdrop handlers and direct `active` writes were removed.

The accepted failure body is byte-identical, including the decoded corrupted
payload. The shell keeps the exact `[340, 223.5859375, 600, 272.8203125]`
rectangle, 30 px padding, 12 px radius, 600 px max-width, 576 px max-height,
background and transform. All 22 fields, the three panel rectangles and the
40,180-character SVG with hash `97155e5a…` remain exact. Copy still flashes
`✓ Copied!` for 1.5 seconds and restores with the same SVG; browser errors are
zero.

The deliberate accessibility additions are initial focus on `modalClose`, a
one-control Tab loop, Escape/backdrop/close-button focus return to `verifyBtn`,
body scroll lock/restore and synchronized `aria-hidden`/`aria-expanded` plus
dialog labelling. Pizza's loaded orphan fragment still has no trigger or JS
controller; Sticky's closed fragment retains its old controller but has no Help
trigger and remains opacity 0/pointer-events none. Neither receives the shared
host. Pulsar passes 8/8, framework 42/42, and full Gate G4 remains green.

## G5 nonblocking export feedback

UPG-057g replaces the three remaining empty-map export `alert` calls with the
shared native `DialogHost`. Pulsar still decides when a map is absent and keeps
the original “Generate a pulsar map first!” message; only presentation and
dismissal are shared. The Verify overlay remains a separate rich-result family
owned by `OverlayDialogHost`.

The added native dialog is closed at startup and introduces no layout geometry.
All 22 fields, three panels, Verify's known CRC failure body and the exact
40,180-character SVG hash `97155e5a…` remain unchanged. The only screenshot
difference is the already recorded reload-only SVG raster jitter (291 RGB
channels, maximum delta 2). There are no browser/module errors. Pulsar passes
8/8, the feedback contract reports zero primary blocking calls, and full Gate
G4 passes.

## G5 shared overlay presentation cleanup

UPG-058e removes Pulsar's duplicated structural overlay, content, close,
scrollbar and responsive shells. Shared CSS owns those rules; Pulsar keeps only
the rich verifier typography. A scoped promotion passes both overlay and native
dialog shells/headings through the frozen universal reset.

All 22 fields, three panels and the 40,180-character SVG hash `97155e5a…` remain
exact. Verify keeps the exact `[340,223.5859375,600,272.8203125]` content,
30 px padding, title 24/600, transitions and failure-body hash `d05830eb…`.
Copy still flashes `✓ Copied!` and restores after 1.5 seconds. The closed raster
difference is only the recorded SVG-local 291 RGB/max 2 jitter. The native
feedback shell is intentionally canonical at 20 px/100%/title 500 instead of
the former overlay-derived 30 px/90%/600. There are no browser errors; Pulsar
passes 8/8, legacy/feedback contracts and full Gate G4 pass.

## G5 universal-reset removal

UPG-058f removes Pulsar's local universal reset and its final four
`all: revert-layer` promotions. Property-level deltas retain compact
range/HSB/choice/preset metrics and rich verifier typography. Capture
`f8b4fa57…`, panels, controls, Verify 600×272.820/body `d05830eb…`, Copy flash
and SVG 40,180/`97155e5a…` remain exact. The only computed-style change is a
hidden unused feedback input receiving canonical shared reset properties.
Pulsar passes 8/8; the final legacy contract reports 0 resets and 0 promotions.
