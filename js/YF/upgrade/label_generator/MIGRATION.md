# Sticky Fingers shared-framework migration

Sticky Fingers keeps its legacy modular GridGenerator and connects to the shared Upgrade framework through a deliberately small façade. The 10k-line `script.js` was not rewritten.

## Preserved application responsibilities

- Label geometry, grid calculations, text/graphics/barcode objects, edit mode, prepress frames and data-row navigation remain application-owned.
- The existing EAN-13 implementation is unchanged, including the visible console warning for the checked-in sample whose provided checksum is `7` and calculated checksum is `6`.
- SVG/PDF and multi-label export remain application-owned and use the already-localized jsPDF, svg2pdf and OpenType files from `../framework/vendor/`.
- Google Sheets CSV loading remains the only external runtime capability and starts only after the user clicks `Load Data`.
- Domain DOM remains unchanged. UPG-052e replaces only the back link's legacy
  class/text; UPG-053e promotes only panel-title typography in application CSS.
- Sticky Fingers' Lunnen Display files remain private because their hashes differ from the shared framework versions.

## Shared responsibilities

- `src/framework/FrameworkAdapter.js` is the single façade to the public `../framework/src/index.js` contract.
- Color conversion, luminance, contrast and grid-opacity calculations use the shared `ColorUtils`; the local duplicate was removed.
- Byte-identical TT Commons WOFF2/OTF files now load from `../framework/fonts/`; the four local duplicates were removed.
- `presets/manifest.json` is the only preset discovery source. Unused directory-listing and GitHub fallback code was deleted.
- `framework-base.css` loads the shared framework stylesheet in a named lower cascade layer before the frozen Sticky skin. Explicit bridges preserve inherited Arial action buttons and the legacy unbounded edit-panel height until their intentional G5 visual migration.

## Acceptance evidence

- Four automated tests cover the framework boundary, three-file manifest, explicit Google Sheets flow and existing EAN-13 checksum behavior.
- Browser metrics match exactly before/after at 1280×720 in both normal and edit modes: `gridSvg` viewBox `0 0 680 680`, 680×680 artboard, SVG counts, panels, inputs and preset text.
- G5 CSS participation checks compare 214 representative computed-style records in both normal and edit modes. All selected styles, panel visibility, `max-height`, SVG/top/actions geometry and the original 878.703 px long edit panel match after the two documented bridges.
- UPG-052e uses canonical `.top-link`, `←Upgrade Tools` and ARIA. The accepted
  visual difference is CoFo 16/500 with 8×20 px padding instead of the legacy
  system 14.4/600 `←YF Tools` link with 8×15 px padding. Recentring the wider
  toolbar moves preset and Edit Mode together by 27.70 px; their sizes/styles,
  exact normal/edit SVG markup, all 79 form states, panel/action geometry and
  the 878.703 px long edit panel remain unchanged. The three-item manifest
  dropdown still opens with correct ARIA state.
- Laptop → Tablet → Laptop preset switching returns exactly to baseline.
- The checked-in Google Sheets test link loads rows and exposes batch PDF/SVG actions; a reload returns to the original preset state.
- Current-label PDF export loads local OpenType and shared TT Commons successfully, with no dialog or browser error.
- `npm run check:isolation` passes; the only runtime network exception remains user-initiated `docs.google.com/spreadsheets`.

## G5 panel-title rollout

UPG-053e promotes all seven main/editor title wrappers and inline summaries from
13.6 to 14.4 px with an explicit 16 px line-height. The private panel/collapse
controller is unchanged. Normal Data Import remains 300×242; edit-mode Layout
remains 300×878.703, and every main header remains 46 px. Text Styles preserves
an expanded inner section through 300×505 → 300×46 → 300×505 collapse/restore.

Paragraph remains 300×847.492 and Graphics 300×567 with 54 px action headers.
Normal/edit SVG markup and all 79 form states match before/after. The intentional
full-page capture changes are
`2d2e8504548fb9b7aa821165f3987674f9407bb5b01f8583b02ea261ad02d850` →
`164e7ea8b77c18e1caab9105e33d1fa4097d257efc6f9b587b22a1c895e7b64f`
and
`c2d23861865909af98bc7aaae5261ebabb69873c1f6af80f1a9206c06c82f36d` →
`29946506e778ed142f24631037b5c942939f6518d45181a97f7c12d4d285815c`.
Google Sheets remains explicit and user-initiated; the local PDF code path was
not modified. Four tests and the complete isolation check pass.

## G5 native-number boundary

UPG-054i confirms that Sticky Fingers is not part of the text
`.value-display` family. Its active runtime contains 39 static native number
inputs plus one dynamic fixed-column input and zero text value displays. Three
unused local value-display selectors were removed; the shared stylesheet is now
the only base if a text display is added later. No active number-field CSS,
markup or JavaScript changed.

The main `.number-input` contract remains native: 32 px height, 13.6 px system
font, 8 px horizontal padding/top margin and visible browser spinners. The
dynamic fixed-column input remains a private 60×24/16 px variant. The
`NumberInputController` keeps live settings updates, per-field decimals and its
special decimal Shift snap; dynamic column, Paragraph, Graphics and Barcode
fields keep separate application handlers.

At 1280×720 the old/new normal (`c021f8ed…`) and edit (`ea806751…`) captures
are byte-identical. All 79 form states (73 inputs), 40 native numbers, panels,
680×680 artboard and SVG outputs match: normal 18 640 characters/hash
`1592eaac…`, edit 18 607/hash `8850fd2f…`. Paragraph (300×855.492) and Barcode
Graphics (300×463) editors also retain exact inputs, number-field presentation,
panels and SVG.

Browser behavior confirms Front Width 120.0→120.5→130.5; because the source
updates settings on live input, draft 999 followed by Escape remains 999.0.
Headline keeps 7.00→7.01→7.10. The dynamic fixed-column field retains its own
change-only formatting lifecycle, and a clean reload restores exact normal/edit
baselines. Google Sheets remains the sole user-initiated network exception.
`npm run test:sticky` passes 5/5.

UPG-054p separately fixes Sticky Fingers as the zero-range boundary. The active
runtime has no `input[type="range"]`; all 40 numeric controls remain native
number inputs with application-owned behavior. Dormant legacy range selectors
are deliberately left untouched until the later dead-CSS cleanup, so this
verification cannot alter normal/edit/editor geometry. The five-test suite now
asserts both the zero active inventory and that explicit quarantine.

## G5 shared choice rollout

UPG-054w moves nine `toggle-chip`, ten `checkbox-label`, two radio/label
segments and three `toggle-switch` instances onto the shared presentation
blocks. `style.css` no longer owns their full base/state declarations.
`framework-base.css` contains only the cascade promotion and legacy metrics the
shared base cannot infer: 0.85rem segment text, centered 12 px/13.6 px chips,
zero-sized chip inputs and the final chip group's 8 px bottom interval.

That interval is a measured parity bridge: the first edit-mode verification
showed Layout shrinking from 878.703125 to 870.703125 because the newer shared
last-child rule won inside the framework layer. The candidate was rejected;
the scoped bridge restored the original 300×878.703125 panel before acceptance.

At 1280×720 the complete normal/edit records are exact: all 79 form fields,
28 choice controls, component geometry/computed styles and visible panels.
Normal SVG remains 18 640 characters/hash `1592eaac…`; edit remains 18 607
characters/hash `8850fd2f…`. The accepted full-page captures remain
`164e7ea8…` and `29946506…`. Show objects, Prepress and edit-mode round-trips
restore the exact initial state; the switch retains its 2 px black + 4 px white
focus ring. There are no browser errors and the existing EAN-13 warning remains.
Google Sheets and local PDF/OpenType paths were not changed.

`npm run test:sticky` passes 5/5; `check:toggles` and full Gate G4 pass.

## G5 preset presentation rollout

UPG-055d removes Sticky Fingers' complete local preset dropdown and scrollbar
base. The manifest-only three-item menu now consumes the shared component. A
scoped bridge preserves the legacy system 14.4/600 toggle, asymmetric padding,
400 px overflow, text clipping, selected weight and 6 px scrollbar. Manifest
loading/sorting, JS width measurement/application, data rows, Google Sheets and
exports remain private. Only `aria-controls` was added to the existing button
and listbox semantics.

Closed/open captures and every computed-style record match byte-for-byte.
Laptop initial/restore keeps 79 form states, panels and SVG hash `1592eaac…`;
Monitor keeps 78 states and SVG `e006d2ff…`; Tablet produces its expected SVG
`c0f0bd8…` and returns exactly to Laptop. Edit mode keeps 79 states, Layout
300×878.703125, Data 300×242, Objects 300×383, Text 300×237 and SVG
`8850fd2f…`. Its only screenshot jitter is an 8×8 px SVG-local region
(108 RGB channels, maximum delta 8), outside the toolbar; DOM/style/output
snapshots are exact. Escape closes the menu and browser errors remain zero.
Five tests and the preset contract pass.

## G5 action-bar rollout

UPG-056f removes Sticky Fingers' complete local action-bar/fixed-button base
and duplicate export paint. The shared framework owns the canonical shell;
the application retains muted preset/SVG variants, right-group layout,
edit/data visibility, batch disabled lifecycle, all formats, prepress, data
rows and its explicit user-initiated Google Sheets integration.

The intentional change is Arial 14.4/600 with 8×15 px padding to CoFo Sans
16/500 with 8×20 px padding. The normal group grows 283.211→306.078 px while
its center, bottom anchor and 36 px height stay exact; raster changes are
confined to the action region. Normal keeps 79 fields, Data 300×242 and SVG
18,640/`1592eaac…`; edit keeps 79 fields, Layout 300×878.703125, Objects
300×383, Text 300×237 and SVG 18,607/`8850fd2f…`. Preset, current SVG and PDF
actions do not mutate state; Outline and Prepress round-trip exactly. Browser
errors are zero, the Sheets boundary is unchanged and all five tests pass.

Run `npm run test:sticky` from `upgrade/` for the automated Sticky Fingers checks.
