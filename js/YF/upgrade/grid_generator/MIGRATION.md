# Pizza Boxer shared-framework migration

Pizza Boxer keeps its modular vanilla-JavaScript Grid Application and Vite production pipeline. It consumes shared capabilities through one explicit adapter instead of being rewritten around `defineTool`.

## Preserved application responsibilities

- Grid document, surfaces, placement, objects, typography, render scheduling and canvas geometry remain under `src/`.
- Pizza Boxer's panel, slider, history, zoom, preset, draft-recovery and export controllers remain application-owned because they implement product-specific transactions and document behavior.
- Schema 1.2, all 19 bundled presets and the 15-file content-hashed public runtime contract are unchanged.
- JSON, SVG and outlined PDF export retain Pizza Boxer's document builders and lazy local vendor loaders.
- The Vite source/build/public-runtime reproducibility checks remain authoritative.
- IndexedDB remains isolated as `upgrade-pizza-boxer-v1`.
- Domain DOM structure remains unchanged. UPG-052d replaces only the back
  link's legacy class; UPG-053d promotes only panel-title typography in the
  source stylesheet and generated runtime.

## Shared responsibilities

- `src/framework/FrameworkAdapter.js` is the only application boundary to `../framework/src/index.js`.
- Color conversion, luminance, contrast and grid-opacity calculations now use the common `ColorUtils` implementation.
- The previous application-local `src/utils/ColorUtils.js` duplicate was removed after unit and browser parity checks.
- The generated production entry keeps the shared framework external and imports `../../../framework/src/index.js` at runtime. This path resolves inside `upgrade`; framework improvements therefore do not require another private framework copy.
- `framework-base.css` now loads the shared framework stylesheet in a named lower cascade layer before the frozen production bundle. One explicit bridge preserves the action buttons' former inherited Arial until their intentional G5 visual migration.

## Acceptance evidence

- 165 original tests plus JavaScript- and CSS-boundary tests pass (167/167).
- The source graph, schema, 19-preset manifest, local vendors and 15 hashed runtime assets pass reproducibility checks.
- Browser before/after metrics match exactly at 1280×720: `gridSvg` viewBox `0 0 680 680`, canvas/body geometry, SVG counts, panel positions and form values.
- Panel collapse/restore and SVG export work without module, application or browser-console errors.
- Before/after G5 CSS checks cover 289 representative elements: selected computed styles, panel/canvas/toolbar geometry and collapse/restore state are exact after the single documented Arial bridge.
- UPG-052d uses canonical `.top-link`, `←Upgrade Tools` and ARIA through the
  source fragment and reproducible production document. The accepted visual
  difference is CoFo 16/500 with 8×20 px padding instead of the legacy system
  14.4/600 with 8×15 px padding. Recentring the wider toolbar moves the three
  neighboring controls together by 6.86 px; their sizes and computed styles,
  all panel/SVG geometry, exact generated SVG markup and all 113 form states
  remain unchanged. Grid-panel collapse/restore returns to the exact prior
  rectangle.
- `npm run check:isolation` confirms that runtime paths and storage remain inside `upgrade`.

## G5 panel-title rollout

UPG-053d promotes the seven main/editor panel titles and their inline summaries
from 13.6 to 14.4 px. The explicit 16 px line-height preserves the 46 px main
headers; the action-bearing Paragraph and Graphics headers remain 54 px. The
change is made in `styles/layout-panels.css` and propagated through the existing
reproducible build to a new 15-asset public runtime.

The intentional default capture change is
`4d4a278f057e7c6e81cde9911211cf90f731bd424b1ddf78b88a87f42ffd78bf` →
`6fbbb2fc013372dcbef7a9dcdfa24cd44889c3a7e92122996b040fa89d93175a`.
All five default shells, right-stack expansion/collapse, title/summary texts and
ARIA states are retained. Paragraph remains 300×680, Graphics 300×451, the SVG
remains 1280×720 with exact 94 374-character markup, and all 113 form states and
bottom actions match the pre-change baseline. The accepted differences are only
font/glyph metrics inside fixed headers.

## G5 value-display rollout

UPG-054g removes only Pizza Boxer's duplicate `.value-display` base and focus
rules from `styles/controls.css`. Normal, focus and disabled presentation now
comes from the shared stylesheet; `.control-group label .value-display` remains
as the sole private layout extension. The application-owned
`SliderController`, `SliderHistoryController`, 29 range inputs, settings
callbacks and nine standalone Paragraph/Graphics editor fields are unchanged.
The source/build/release pipeline regenerated the 15 content-hashed public
assets (`PublicEntry-BHgSr6RE.css`, `PublicEntry-DQlud4F0.js`).

At 1280×720 the 38 displays differ only by the accepted removal of legacy
`min-width: 40px` and `padding-right: 4px`. Ordinary visible fields shrink from
144.5 to 140.5 px, move 4 px right and retain their right edge; Graphics Height
keeps its private adjacent-control position while shrinking by the same 4 px.
Font, color, 15 px height, values and tabular-number presentation are exact.
Default, Paragraph (300×680) and Graphics (300×451) captures retain all 113
input states, 29 ranges, panel/surface geometry and the exact 94 374-character
SVG (`4abbde0d…`).

Browser acceptance confirms Front Width 500.0→501.0 by Arrow and →510.0 by
Shift+Arrow, Escape rollback of draft 999, blur commit at 501.5 and Enter restore
to 500.0 with exact SVG/state. Grid collapse/restore is 300×526.1016 → 300×46
→ 300×526.1016. The dedicated mouse gesture, document mouseup, focus/blur,
Arrow/Shift and `setting: null` Escape tests remain green; the complete Pizza
suite passes 167/167.

## G5 ordinary-range rollout

UPG-054n removes only Pizza Boxer's duplicate ordinary range
base/thumb/track/hover/focus declarations from `styles/controls.css`. The 26
ordinary ranges now consume the shared framework presentation; one scoped
`margin-top: 6px` bridge remains above the unlayered universal margin reset.
The three `.hsb-control-group` ranges keep their private 8 px thumb, dynamic
gradients and color lifecycle. `SliderController`, `SliderHistoryController`,
settings callbacks and document state are unchanged. The synchronized public
runtime still contains 15 assets (`PublicEntry-B5mPN2xZ.css`,
`PublicEntry-BAyvpc0p.js`).

At 1280×720 cached pre-change and rebuilt runtimes are byte-identical in
default (`7e902c4c…`), ordinary hover (`d3518732…`), ordinary focus
(`13cb4e1e…`) and open HSB (`d3332fc7…`) states. All 29 ranges, 113 form states,
panels, 1280×720 SVG surface and exact 94 374-character SVG match. With the Grid
panel collapsed equally, Graphics (300×451) and Paragraph (300×680) captures
are also byte-identical and retain exact editor state and 94 384-character SVG.

The complete 167-test suite proves one history transaction per mouse gesture,
document-level mouseup commit and independent keyboard focus/blur groups. Live
5→6→5 values match across old/new runtimes; clean reload restores the exact
baseline.

UPG-054o separately re-verifies the private HSB boundary. At 213/40/85 the
picker remains 260×135.5 with three 260×10 ranges; changing saturation to 50
updates `#82A9D9` to `#6c9dd9` and injects only the expected 10 px dynamic
tracks with 8 px thumbs. Returning through the application control to 40 and
committing `#82A9D9` restores the exact 94 380-character SVG. The color-panel
tests now pin the private gradient and thumb/track geometry without moving this
behavior into the shared ColorPicker.

## G5 choice-control rollout

UPG-054v removes Pizza Boxer's complete local `toggle-chip`, `checkbox-label`,
radio/label segmented-control and export `toggle-switch` presentation blocks.
The 15 chips, seven compact checkbox labels, four segments and one switch now
consume the shared stylesheet. Surface tabs, Graphics size-mode flex rules,
all state controllers and the four lock buttons remain application-owned.

`framework-base.css` uses a scoped `revert-layer` promotion and the frozen
0.85rem segment token. Three narrow compatibility rules preserve the old reset
ordering for show-chip group padding, checkbox chip input dimensions and
control-group segment labels; they do not duplicate component paint. The
reproducible release contains 15 assets (`PublicEntry-Dt3y0kz_.css`,
`PublicEntry-DDM8ChsA.js`).

The 1280×720 default before/after screenshot is byte-identical
(`1dfbb49ac2b3aa3…`). All 113 form states, 36 choice states, component computed
styles, five panel shells and the exact 94 374-character SVG (`4abbde0d…`)
match. Paragraph remains 300×680 and Graphics 300×451 with identical complete
state records. Show Columns, Link Mode, x-height and Outline Fonts round-trips
restore all inputs and the exact SVG; the switch keyboard focus ring remains
2/4 px. The public-runtime check, all 167 Pizza tests and full Gate G4 pass.

## G5 preset-toolbar rollout

UPG-055e removes the complete local preset dropdown base from
`styles/toolbar.css`. Shared framework CSS now owns dropdown positioning,
toggle/menu/item paint, animation and selected state. The bridge retains only
the repository view's exact system font, asymmetric toggle padding, 400 px
scroll limit, clipping and selected weight. Divider rows remain the sole
private visual extension; preset repository, schema 1.2, imports, per-preset
history and draft recovery remain application-owned.

The source workspace fragment adds `aria-controls` without a visual change.
The public document renderer now rewrites the source-relative
`../../framework-base.css` URL to `./framework-base.css` independently of
its cache-buster. Boundary tests pin both source and generated paths; this
prevents a release build from silently dropping the shared layer.

At 1280×720 the complete closed and open computed-style records and geometry
match the pre-rollout baseline. `New → E-ink → New` preserves all 113 form
states, panels, and exact SVG markup: 94,374 characters / `4abbde0d…` for
New and 78,234 / `9d4f24e9…` for E-ink. Escape closes the listbox and restores
focus to its toggle, with no browser errors. The synchronized release remains
15 hashed assets and the full suite passes 167/167.

Run `npm run test:pizza` from `upgrade/` for the complete Pizza Boxer acceptance suite.

## G5 action-bar rollout

UPG-056e removes the complete local action-bar/fixed-button base and the
duplicate export-button paint. The shared framework owns the canonical shell;
Pizza Boxer retains only its muted Setup buttons, bordered PDF variant and
right-group layout. JSON/SVG/PDF handlers, Outline Fonts, schema/history/import,
draft recovery, filenames and renderers remain application-owned.

The intentional change is Arial 14.4/600 with 8×15 px padding to CoFo Sans
16/500 with 8×20 px padding. The bar remains exactly [320,664,640,36], semantic
paint and the right edge of Outline Fonts remain stable, and the raster diff is
confined to the action region. Browser JSON, SVG and PDF actions leave all 113
fields, panels and exact SVG unchanged. New→E-ink→New retains 94,374/
`4abbde0d…`, 78,234/`9d4f24e9…`, 94,374/`4abbde0d…`. The synchronized release
contains 15 hashed assets; browser errors are zero and all 167 tests pass.
