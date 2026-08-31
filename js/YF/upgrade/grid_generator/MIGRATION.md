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

Run `npm run test:pizza` from `upgrade/` for the complete Pizza Boxer acceptance suite.
