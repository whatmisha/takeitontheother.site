# Keyboarder handoff

This file is a working handoff between AI sessions. Keep it factual and update it after
substantial changes so the next assistant can resume without re-discovering the project.

## Project

Keyboarder is a browser tool for generating keyboard layout artwork from a declarative model.
The domain specification is in `PIPELINE.md`; implementation plan and stage boundaries are in
`TOOL_PLAN.md`.

Important local entry points:

- `index.html` - app shell and panels.
- `app/tool.js` - `defineTool(...)`, settings, controls, render, UI event wiring.
- `app/kb/*` - pure keyboard/domain modules.
- `app/kb/model-io.js` - pure editable-keyboard JSON import/export/sanitize helpers.
- `analysis/*` - Python/Node reference harnesses and source-of-truth measurements.
- `LCAKB23.layout.json` and `LCAKB23.legends.json` - reference outputs for verification.

## Status Before This Handoff

- Stage 0, app scaffold: done.
- Stage 1, beta geometry: done.
- Stage 2, beta legends: core math/rendering was already mostly done before Codex took over:
  opentype metrics, glyph path rendering, slots, contour profiling, optical compensation,
  generated LCAKB23 content, icon library, and legend verification existed.
- Stage 3, beta verification: partially done before Codex; geometry and legend comparison were
  already wired into the `Verify` button and CLI scripts.

## Changes In This Codex Session

- Changed all Grid slider `Shift+Arrow` increments from coarse tenths/five-hundredths to `0.01`.
  A plain arrow still uses `0.001`.
- Set the startup preset to `LCAKB23` via `presets.defaultName`, so a plain app load opens the
  reference layout instead of whichever seed happens to sort first.
- Changed the top-left navigation item from static `Keyboarder` text to a relative link
  `←YF Tools` with `href="../../"`, which resolves from `/js/YF/lunnen/keyboarder/` to
  `/js/YF/`.
- Added a Type panel:
  - `Glyph size`, `Numpad size`, `Secondary size`, `Word size` in pt.
  - `Leading` in pt.
  - `Tracking offset` in em.
  - Compensation mode: `Off`, `Model`, `Model + table`.
  - `Reference type` reset.
- Made the type controls real render inputs. Defaults reproduce the reference:
  - glyph `15.1999`, numpad `13.1732`, secondary `12.0745`, word `9.1199`,
    leading `13.5279`, tracking offset `0`.
- Added a readonly Legend panel:
  - 110-key selector.
  - Shows template, row/block/width, slot elements, size/tracking, and compensation source/value.
  - This is intentionally not an editor yet; click editing belongs to Stage 4.
- Improved the existing `Ink boxes` diagnostic layer:
  - still shows ink boxes and baselines;
  - now also draws cap-box rectangles and x-height lines for text.
- Fixed content attachment when Grid sliders move generated x positions:
  - exact `row+x` matching is still used at the reference geometry;
  - fallback matches by stable order inside each `row/block`, so legends do not disappear when
    the grid is adjusted.
- Fixed `Reference grid` and new `Reference type` reset buttons so slider text fields update
  together with settings.
- Completed Stage 3 verification polish:
  - added a `Diff` layer toggle in Layers;
  - rendered reference and generated key outlines in `#diff`, colored by geometry delta;
  - added `Download JSON` to the Verify dialog;
  - changed `compare()` so it falls back to stable order inside `row/block` when Grid changes
    make exact `row+x` matching impossible.
- Started Stage 4 editing UI:
  - selection state is UI-only and intentionally kept out of tool settings/presets;
  - clicking a key selects it, opens the Legend panel if collapsed, and updates the Legend
    inspector/select;
  - `Shift`/`Cmd`/`Ctrl` click toggles multi-selection;
  - arrow keys move the active key, `Shift+Arrow` extends the selection, `Escape` clears it;
  - `exportSVG()` and `exportPNG()` temporarily hide the selection overlay, then restore it.
- Added the first real legend/content editor:
  - presets now include sanitized `contentEdits` overrides, layered on top of generated
    `app/kb/content/lcakb23.js`;
  - key edits are addressed by stable `row:block:ordinal`, so Grid slider changes do not orphan
    edited legends;
  - the Legend panel now has a template-variant selector, per-element slot/value/size/tracking
    fields, `Apply`, and `Reset`;
  - choosing a template retargets element slots from the selected template variant while preserving
    text/icon payloads where possible;
  - template changes apply to all selected keys, while detailed slot/value fields apply to the
    active key;
  - text elements now have a `Comp` field in px; when filled, it becomes `compOverride` and
    replaces formula/table optical compensation for L/R slots;
  - `Add text` and `Add icon` append draft legend elements to the active key;
  - every legend element row has `Remove`; after removal, `Apply` saves the shortened element
    array;
  - reset removes overrides for the selected keys and falls back to generated content.
- Added the first key geometry editor:
  - presets now include sanitized `layoutEdits` overrides, keyed by stable `row:block:ordinal`;
  - the Legend panel has a `Width` field for the active key, in mm;
  - applying a non-flex width override feeds a cloned row model into `buildLayout()`, so the
    existing flex key in that row absorbs the remaining space;
  - applying a source flex key width makes that key explicit and moves the temporary flex role to
    the next suitable key on the right, or to the previous key if the source flex is at row end;
  - a key that is currently acting as the temporary flex absorber is locked until the source flex
    override is reset;
  - `Delete key` stores `layoutEdits[editId].deleted = true` and removes that key from the row
    before `buildLayout()`;
  - row items now carry stable `editId` through `grid.js`, so deleting a key does not shift
    content/layout override addresses for keys to its right;
  - `Restore key` clears the most recent deleted flag without discarding a possible width
    override on the same key;
  - `Add before` / `Add after` insert a blank 1U key next to the active source key in rows that
    have a flex absorber; added keys get IDs like `add:0:main:1` and are stored in `layoutEdits`
    as `{ added: true, before: editId }` or `{ added: true, after: editId }`;
  - add buttons run a trial `buildLayout()` and stay disabled if the proposed insertion would
    make a row overflow or shrink any key below `MIN_KEY_WIDTH_MM`;
  - added keys start with no generated legend content, can be edited through the existing
    `contentEdits` Legend editor, and are not allowed to recursively add more keys after
    themselves yet;
  - `Move left` / `Move right` swap the active key with its visible neighbor inside the same
    row/block; the order is stored in `layoutEdits["order:row:block"].order` as stable `editId`
    values, so legends and width/content overrides travel with the key;
  - `Delete row` stores `layoutEdits["row:N"].deleted = true`, removes that source row, compacts
    rows below upward, and preserves each moved key's source-row `editId`;
  - row delete/restore uses `sourceRow` metadata from `grid.js`; display `row` can change after
    compaction, while edit/content identity stays tied to the original source row;
  - row deletion runs the same layout fit guard plus a rectangle-overlap check, so rows involved
    in numpad `rowSpan` collisions keep `Delete row` disabled;
  - `Restore row` clears the last row delete flag and selects the first key in the restored row;
  - `Add row` duplicates the active original source row below itself as a blank row; the edit is
    stored as `layoutEdits["rowadd:N"] = { rowAdded: true, afterRow, templateRow }`;
  - added rows get synthetic source rows starting at `LCAKB23.rows.length`, so their generated
    keys receive stable edit IDs like `6:main:0` and can use the same width/content/order/delete
    mechanisms as original rows;
  - added-row insertion also runs the fit/overlap guard, auto-selects the first key in the new
    row, and disables `Add row` while a synthetic row is active;
  - `Reference grid` clears `layoutEdits` and also prunes `contentEdits` for added keys, so
    removed added-key or added-row legends do not come back later as orphaned content;
  - `Reset` removes the active key width override.
- Added a first explicit edited-keyboard JSON model:
  - bottom bar now has `JSON` and `Import` buttons;
  - export downloads `keyboarder-lcakb23-model.json`;
  - schema is `keyboarder.model.v1`;
  - the model includes a full normalized `settings` blob for exact round-trip and a readable
    `keyboard` section with `grid`, `type`, `appearance`, and `edits`;
  - decision for v1: keep the duplicated `settings` + `keyboard` structure intentionally;
    `settings` is the lossless app state, while `keyboard` is the domain-readable view;
  - imports accept both the new schema and legacy flat preset blobs;
  - importing opens the data as the framework's shared preset slot, so it can be saved with the
    normal preset flow.
- Extracted model JSON helpers into pure `app/kb/model-io.js` and added
  `analysis/model-io.mjs` to cover schema round-trip, legacy preset import, domain-only import,
  text parsing used by file import, layout edit sanitization, content edit sanitization, and
  unsupported-schema errors.
- Started Stage 5 layout library work:
  - `app/kb/layouts.js` now exports `LAYOUTS` and `LAYOUT_OPTIONS`;
  - built-in source layouts are `LCAKB23`, `ANSI_TKL`, `ISO_TKL`, `ANSI_65`, and `ANSI_60`;
  - the Grid panel has a `Layout` select;
  - switching layouts resets `layoutEdits` and `contentEdits`, clears the deleted-key/row targets,
    and renders immediately so background browser tabs do not wait on a throttled RAF;
  - `layoutName` is part of app settings and the `keyboarder.model.v1` JSON round-trip;
  - JSON export filenames now use the active layout name, e.g. `keyboarder-ansi-tkl-model.json`;
  - `app/kb/content/generated-layouts.js` generates stable generic key labels for non-LCA
    layouts, using row/block/ordinal-compatible content entries;
  - `Reference` and `Diff` are disabled outside `LCAKB23`, and `Verify` now refuses non-reference
    layouts instead of comparing them against the LCAKB23 source;
  - the Layers panel has a `Language` select with `Latin + Cyrillic`, `Latin`, and `Cyrillic`;
  - language switching filters generated text legends only, preserving key geometry, icons, and
    manually edited `contentEdits`;
  - `languageLayer` is part of settings and model JSON;
  - the readout now includes `Warnings`, currently reporting non-standard key widths and keys
    without attached generated content;
  - seed presets now cover the new layout-library workflows: `ANSI TKL`, `ISO TKL`, `ANSI 65%`,
    and `ANSI 60%`;
  - existing shipped LCA presets now explicitly include `layoutName: "LCAKB23"` and
    `languageLayer: "dual"`;
  - `analysis/layout-content.mjs` verifies generated non-LCA content attachment, and
    `analysis/presets.mjs` verifies the shipped preset manifest and layout names.
- Moved the collapsed Legend panel above the bottom export buttons; its header had overlapped the
  `SVG` button at the old bottom position.
- Started Stage 6 SVG drawing import:
  - added pure `app/kb/svg-blueprint.js`;
  - it strips Illustrator private `<metadata>/<i:aipgf>` payloads, keeps ordinary metadata,
    extracts `blueprint` and `caps` groups, parses SVG `<line>` elements, buckets them into
    horizontal/vertical/diagonal lines, counts simple SVG primitives, groups horizontal spans,
    and calibrates basic cap constants from the `caps` rects;
  - it now estimates the straight-edge corner offset `d`, pairs horizontal edges by rounded span,
    verifies both side edges against vertical segments, removes nested bevel candidates, and
    returns recognized key rectangles;
  - diagnostics now separate warning-level suspicious keys from harmless notes such as
    designer-intent non-standard widths;
  - `layoutDraftFromRecognized()` converts detected rectangles into `keyboarder.layoutDraft.v1`,
    a row/block layout draft that can be rendered by the existing `buildLayout()` engine;
  - added `analysis/blueprint-import.mjs`, covering a synthetic SVG and the real `LCAKB23.svg`;
  - real LCAKB23 drawing import currently sees 1658 horizontal lines, 1388 vertical lines,
    884 diagonal lines, 866 paths, 487 horizontal span groups, 110 cap rects, 220 raw key
    candidates, 110 final recognized key rectangles, two double-height keys, zero warnings,
    four notes, zero suspicious keys, and a draft layout with 3 blocks, 6 rows, and 110 keys;
  - current SVG creation UX is top-bar `New layout`, not a persistent Drawing panel: the user
    chooses an SVG only while creating a new custom layout/preset;
  - the earlier `Drawing` panel, `Browse SVG`, drag-and-drop, `Use Draft`, `Draft JSON`, `Clear`,
    Drawing layer toggle, and drawing preview overlay have been removed from the visible workflow;
  - imported drawing analysis is transient and is not saved into presets/model JSON;
  - `showDrawing` remains only as backward-compatible old state and is normalized to `false`;
  - `New layout` writes the generated layout into settings as `customLayout`, derives
    `layoutName` from the SVG file name, syncs Grid sliders, clears layout/content edits,
    disables `Reference`/`Diff`, enters the framework `Unsaved*` preset slot, and renders generic
    labels for every detected key;
  - custom layout naming now checks built-in layout names and saved presets; repeated SVG imports
    get suffixes such as `TEST_LAYOUT_2`;
  - `vendor/framework/src/core/ApplicationShell.js` supports optional
    `presets.suggestSaveName(app)`, and Keyboarder also installs app-level
    `installSuggestedPresetSave()` so `Save preset` opens with the current custom layout name
    prefilled;
  - warning-level imports now show a richer modal report and a `Report JSON` action. The exported
    compact report includes summary lines, groups/elements, calibration, recognized counts,
    estimated grid, diagnostics with key coordinates, and draft stats, but not the raw SVG or line
    buckets. The modal also includes a visual `Key Review` SVG thumbnail: detected keys are shown
    as a miniature layout, warning keys are red, note-only keys are amber, and issue keys are
    labeled by candidate number;
  - imported layout drafts are now compacted for hand-editability: consecutive identical unit
    keys are emitted with `repeat`, semantic per-key names can live in `ids`, and synthetic
    `r123` key IDs are omitted. `buildLayout()`, the Legend editor expansion, and generic
    content generation all understand `repeat + ids`; the existing row/block/ordinal edit IDs
    are still assigned after expansion, so editing and content attachment remain stable;
  - generic labels for imported/custom layouts prefer semantic IDs when present, but hide
    synthetic `r123` IDs and fall back to positional labels such as `main 1`;
  - imported/custom ANSI-like alpha keys with semantic ids `q/w/e/...` now generate
    `tpl: "alpha-dual"` content with Latin in `TL` and Russian ЙЦУКЕН letters in `BR`; `New
    layout` also resets `languageLayer` to `dual` and syncs the Language select so a fresh SVG
    import opens as `Latin + Cyrillic`;
  - `keyboarder.model.v1` now preserves `customLayout` in settings, and custom layouts are also
    exposed in `keyboard.customLayout` on export.
- Polished Stage 6 against `/Users/mishaivanov/Desktop/test_layout.svg`, a compact one-block
  keyboard drawing where `caps` contains only two calibration samples and the up/down arrows are
  two half-height keys stacked inside one normal-key footprint:
  - sparse `caps` is now treated as a calibration sample layer; a cap/key count mismatch becomes
    a note (`caps-used-for-calibration`) when `caps` is clearly sparse, so `Use Draft` is not
    blocked by the new intended workflow;
  - fixed `finiteNumber()` in `app/kb/svg-blueprint.js` so `null` no longer becomes `0`, which
    had produced invalid `colPitch: 0` drafts when `caps` could not directly provide pitch;
  - imported grid pitch now falls back to detected-key gaps and row clusters (`test_layout.svg`
    estimates `colPitch 53.855`, `rowPitch 53.5147`);
  - added Illustrator cubic path-corner recovery for split keys. Ordinary keys still come from
    line pairs; path corners are only used to add half-height stacked keys whose four corners
    form an approximately 1U wide, half-height rectangle;
  - added `stack` support to `grid.js`: a row item can occupy one column while producing two real
    key rectangles with per-child `yOffset`/`h`. Stack child geometry is locked in the UI, but
    their legend content remains editable;
  - generic generated content now respects explicit `editId` entries and understands stacked
    children, so `up` and `down` do not collide on the same row/block ordinal;
  - added semantic id/label inference for this ANSI-like compact shape: rows become `esc`,
    `f1...f13`, `backspace`, `tab`, `caps`, `enter`, `lshift`, `space`, `left`, `up`, `down`,
    `right`, etc. This is a heuristic for this class of layout, not a universal legend parser;
  - fixed `assignEditIds()` in `app/tool.js` so keys that already have edit IDs still occupy
    their visual ordinal. Without this, the right arrow after the stack inherited the stack
    parent ordinal and displayed the wrong generated label;
  - bumped the module query in `index.html` to `app/tool.js?v=20260728-stage6split`.
- Started Stage 7 production export polish:
  - regenerated `app/kb/content/lcakb23.js` with the source icon group for every icon element
    (`icons` or `f-icons`), and updated `analysis/export_tool.py` so future regeneration
    preserves that field;
  - `cleanElement()` / model JSON sanitization now preserves an icon element's export group,
    defaulting manual new icons to `icons`;
  - fixed a latent runtime bug in the Legend editor by wiring the missing `cleanElement()`
    wrapper in `app/tool.js`;
  - SVG rendering now splits icon artwork into separate `#icons` and `#f-icons` groups, matching
    the Illustrator layer structure in `PIPELINE.md`;
  - the Legend element editor keeps the icon group in hidden row state, so selecting an F-key
    and pressing `Apply` does not silently move that icon from `f-icons` to `icons`.
  - added a bottom-bar `PDF` export button;
  - `app.exportPDF()` calls the framework's existing `SVGExporter.exportToPDF()` with
    `unit: "mm"` and an explicit `{ width, height }` page format computed from the current
    SVG artboard via the fixed `25.4 / 72` conversion;
  - clean export hiding now covers PDF as well as SVG/PNG, so selection stays out of production
    files;
  - PDF filenames use the active layout slug, e.g. `keyboarder-lcakb23.pdf`.
  - localized production export dependencies: `vendor/lib/jspdf.umd.min.js` and
    `vendor/lib/svg2pdf.umd.min.js` are shipped with the app and included from `index.html`;
  - `vendor/framework/src/export/SVGExporter.js` now prefers those local PDF libraries, with a
    same-origin lazy loader fallback if the static tags are removed;
  - `vendor/framework/src/export/TextToPath.js` now imports local
    `vendor/lib/opentype.module.js` instead of jsDelivr;
  - custom app wiring now runs in `onInit`, before preset seed bootstrap, so export/editor buttons
    are attached even if seed loading is slow;
  - `vendor/framework/src/preset/PresetStore.js` now applies a 5-second timeout to seed manifest
    and preset JSON fetches to avoid indefinite startup waits on broken local origins.
  - added a Type panel `Outlines` / `Text` mode for legend output;
  - default `legendTextMode` remains `outlines`, preserving the current exact path rendering;
  - in `text` mode, `#glyphs` renders SVG `<text>` elements with the same baseline coordinates,
    em letter-spacing, and the active legend font family (`YS Text` by default; session imports
    use generated `Keyboarder Session Font N` families);
  - `legendTextMode` is included in presets/model JSON and in the exported `keyboard.type`
    section.
  - added a compact compensation table editor in the Type panel:
    choose a punctuation character, edit `L`/`R` table values in em-units, apply, reset the
    selected character, or reset the whole table;
  - table edits are stored as `compensationTableEdits` on top of generated
    `YS_TEXT_REGULAR.table`; numeric edits round to hundredths, and `null` deletes a side from the
    effective table;
  - compensation caches and layout signatures now include table edits, so changes immediately
    reposition affected edge legends;
  - `Reference type` clears `compensationTableEdits`, and model JSON includes it in
    `keyboard.type`.
  - `Batch SVG` was implemented earlier but has been removed from the UI and active code after
    user feedback; production export is now the explicit `Language` selection plus normal `SVG`.
- Completed the main Stage 8 automatic font compensation code:
  - added pure `app/kb/fontprobe.js`;
  - it probes a parsed `Typeface` for names, units per em, geometric-priority cap/x-height,
    ascender/descender, italic angle, weight/width class, measured vertical stem width, flat/round
    sidebearing calibration, and `fvar` variation axes/named instances;
  - `autoCompensationParams()` returns a Compensator-compatible params object with `eps`/`w`
    scaled from measured stem width, coefficients scaled from flat/round sidebearing delta, and a
    rough generated punctuation table for fonts that have no hand-tuned table;
  - for YS Text Regular, auto params intentionally reproduce the current reference values:
    `eps = 32`, `w = 300`, and the same coefficients as `YS_TEXT_REGULAR`;
  - `runCompensationInvariants()` checks flat-stem, monotonic `H < S < O < A < W`, and symmetry
    invariants without needing a manually placed reference layout;
  - added `analysis/fontprobe.mjs`, covering YS Text Regular, YS Text Variable (`wght`/`wdth`
    axes, defaults `400`/`100`, named instances visible), and several local YS Text weights for
    broader diagnostic coverage;
  - replaced the old single `FONT_IMPORT` state with a session font registry;
  - the Type panel now has `Drop font file`, `Browse Font`, `Reference font`, `Active font`,
    variable `Instance` and axis controls, `Apply selected`, and `Control sheet`;
  - imported TTF/OTF/WOFF/WOFF2 files are parsed through `parseFont()`, probed through
    `fontprobe.js`, stored as session profiles, and applied to the active live renderer by
    changing the active registry entry;
  - `TYPEFACE_SIG` now includes the active font registry signature, so changing fonts or variable
    coordinates invalidates cached legends instead of reusing old outlines/ink boxes;
  - `slots.js` now accepts `typefaceFor(el)` and `compForElement(el)`, so baseline placement,
    ink boxes, and L/R optical compensation are computed from each text element's resolved font;
  - text elements can carry a sanitized `fontId`, preserved by `model-io`; Legend editor has a
    per-row `Font` select, and `Apply selected` writes the active font to all selected keys'
    text elements;
  - custom fonts use `autoCompensationParams()` as the base params for `Compensator`; the
    editable punctuation table overlays the active base table instead of always overlaying
    `YS_TEXT_REGULAR.table`;
  - SVG `<text>` mode now uses the resolved legend font family, writes `data-font-id`, applies
    CSS `font-variation-settings`, and embeds session font faces in SVG `<defs>` as data URLs
    for standalone text-mode SVG export;
  - `Control sheet` exports a visual SVG sheet with control characters for all loaded font
    profiles, edge-aligned through their active compensation model;
  - imported font binaries are session-only and are not persisted into presets or
    `keyboarder.model.v1` JSON. Their in-memory data URLs are used only for current text-mode
    SVG export.
  - caveat: the bundled `opentype.js` reads `fvar` axes/instances but does not apply `gvar`
    deltas to outline contours. Variable axes therefore affect UI/profile/cache and SVG text CSS;
    outline preview/export still uses the loaded default contours until the font engine is
    upgraded.

## Verification

Commands run successfully:

```sh
node --check app/tool.js
node --check app/kb/grid.js
node --check app/kb/legends.js
node --check app/kb/layouts.js
node --check app/kb/verify.js
node --check app/kb/model-io.js analysis/model-io.mjs
node --check app/kb/content/generated-layouts.js analysis/layout-content.mjs analysis/presets.mjs
node --check app/kb/svg-blueprint.js analysis/blueprint-import.mjs
node --check app/kb/fontprobe.js analysis/fontprobe.mjs
node analysis/harness.mjs
node analysis/verify-legends.mjs
node analysis/model-io.mjs
node analysis/layout-content.mjs
node analysis/presets.mjs
node analysis/blueprint-import.mjs
node analysis/fontprobe.mjs
python3 analysis/export_tool.py
PYTHONPYCACHEPREFIX=/tmp/keyboarder-pycache python3 -m py_compile analysis/export_tool.py
git diff --check
```

Geometry check against `LCAKB23.layout.json`:

- 110 generated keys vs 110 reference keys.
- Pass.
- Worst geometry delta: `0.0000876 px`.

Legend check against `LCAKB23.legends.json`:

- 110/110 keys received content.
- 204 legend elements, 408 checked coordinates.
- Pass.
- Formula compensation RMSE: `0.1099 px` with tolerance `0.12 px`.
- Known named exceptions remain the same: `2.4G`, `num lock`, and comma in `FR`.

Browser smoke:

- Fresh app load on `http://127.0.0.1:8008/`: 110 keys, 176 glyph paths, 15 `#icons` entries,
  13 `#f-icons` entries, and no console warnings/errors.
- Selecting a key and clicking `Add icon` adds an icon row in the Legend editor with no console
  errors.
- PDF/export-library smoke: local `jsPDF` and `svg2pdf` bundles are present in `vendor/lib/` and
  loaded by static script tags; the `PDF` button is enabled, the artboard remains
  `1169.1846855 × 328.6893243 px` -> `412.462 × 115.954 mm`, 110 keys render, and no current
  console warnings/errors were introduced. Browser automation did not surface a `download` event
  for either the new `PDF` path or the existing blob-based `JSON` path, so saved-file inspection
  remains a manual QA item rather than a confirmed app failure.
- Legend text mode smoke on `http://127.0.0.1:8015/`: default `Outlines` renders 176
  `#glyphs path` nodes and 0 `#glyphs text` nodes; after clicking `Text`, `#glyphs` renders 0
  paths and 176 text nodes, the first text is `esc`, its `font-family` is `YS Text`, keys remain
  110, icons remain split as 15 `#icons` and 13 `#f-icons`, and the current console is clean.
- Stage 8 font import smoke on `http://127.0.0.1:8015/`:
  - baseline reference font status shows `YS Text Regular`, `UPM 1000`, `cap 717`, `x 519`,
    `stem 94`, invariant `pass`, 176 `#glyphs path` nodes, and `Reference font` disabled;
  - using `Browse Font` with local `Fonts/YS Text/YS Text-Bold.ttf` switches status to
    `YS Text Bold`, reports file size `231.6 KB`, `stem 143`, auto comp `eps 48.68`,
    `w 456.38`, generated table count `7`, installs the custom `@font-face`, keeps 176
    outline paths, enables `Reference font`, and produces no console errors;
  - clicking `Reference font` removes the custom `@font-face`, returns to `YS Text Regular`,
    disables the reset button, and keeps 176 outline paths;
  - after the reset, `Text` mode renders 176 text nodes with `font-family="YS Text"`, and
    returning to `Outlines` restores 176 paths.
- Stage 8 final browser smoke on `http://127.0.0.1:8015/`:
  - top-left nav text is `←YF Tools` and its relative `href` is `../../`;
  - baseline has one `Active font` option, 176 outline paths, and no axis rows;
  - browsing local `Fonts/YS Text Variable/YSText-Upright-weight-VF.ttf` adds a second font
    profile, shows two axis rows (`wght=400`, `wdth=100`), exposes named instances including
    YS Text weights/widths, keeps 176 outline paths, installs one session `@font-face`, and
    leaves the console clean;
  - selecting a named variable instance updates coordinates to `wght 800, wdth 100` and keeps
    176 outline paths;
  - `Apply selected` writes the active session `fontId` into the active key's text element; the
    Legend editor font select shows that session profile and the preset becomes dirty as expected;
  - switching to `Text` mode renders 176 text nodes, the first selected text has the session
    `data-font-id`, `font-family="Keyboarder Session Font 1"`, CSS
    `font-variation-settings:"wght" 800, "wdth" 100`, and SVG `#font-faces style` contains a
    data URL for standalone text-mode SVG export;
  - clicking `Control sheet` produced no runtime errors, though the Browser plugin still did not
    surface a download event for this programmatic blob download path.
- Compensation table editor smoke on `http://127.0.0.1:8015/`: the editor lists 31 characters;
  selecting `~`, setting `L` to `20.25`, and applying shows `edited · L 20.25 · R -` with reset
  buttons enabled; `Reset char` returns `reference · L 11.8 · R -`, disables both reset buttons,
  keeps 110 keys and 176 glyph paths, and produces no console warnings/errors.
- Obsolete Batch SVG smoke: the old batch button had worked in browser QA, but it has now been
  removed from the UI and active code because it is not part of the user's production workflow.

Browser QA on `http://127.0.0.1:8000/`:

- Fresh load with no share/preset URL shows preset `LCAKB23`.
- Type and Legend panels are present.
- Legend selector has 110 options.
- Stats show `176 strings, 28 icons`.
- With legend/icon layers enabled, SVG contains 176 glyph paths and 28 icon paths.
- `Ink boxes` overlay renders diagnostic children.
- Grid `Shift+ArrowUp` test on `Column pitch`: `19.001 mm -> 19.010 mm`.
- `Diff` layer renders 220 rects at default settings: 110 reference outlines and 110 generated
  outlines.
- `Verify` dialog contains `Close` and `Download JSON` buttons.
- Default selection is key 0 (`R1 main · esc`), with one visible `#selection rect`.
- Click on a key opens a collapsed Legend panel, selects the key, updates the Legend panel, and
  keeps preset label `LCAKB23` (no dirty marker).
- `Shift` click and `Shift+ArrowRight` both produce a 2-key selection.
- Plain `ArrowRight` moves to the next key and collapses to one selected key.
- `Escape` clears the selection and the Legend panel shows `No key selected.`
- Legend editor QA:
  - changing active `esc` text to `TEST` updates the selector label and inspector, and marks
    preset `LCAKB23 *`;
  - `Reset` restores `esc`;
  - changing a single key to `word-center · MC` updates template and slot placement;
  - multi-selecting F5/F6 and applying `word-center · MC` changes both keys;
  - resetting the multi-selection restores the original `fkey-icon+label` content.
  - setting `Comp` on `esc` to `0.5` changes the inspector from `formula` to `manual 0.500`;
  - resetting the key clears the manual compensation and restores formula compensation.
  - adding a text element to F5, setting it to `QA`, and applying changes F5 from 2 to 3 legend
    elements;
  - removing F5's icon row and applying leaves the label plus `QA`;
  - resetting F5 restores the original icon+label pair.
- Key width editor QA:
  - default `esc` is a source flex key, but its `Width` field is editable and shows `25.302`;
  - selecting F5 opens Legend, enables `Width`, and shows `16.402`;
  - applying `18.000` changes F5 width from `46.494 px` to `51.024 px`;
  - the row's flex `esc` width shrinks from `71.722 px` to `67.192 px`;
  - F6's x-position stays stable because the row remainder is absorbed before it;
  - `Reset` restores F5/esc widths and disables the reset button again.
  - applying `20.000` to source flex `esc` changes esc width from `71.722 px` to `56.693 px`;
  - F1 becomes the temporary flex absorber, grows from `46.494 px` to `61.523 px`, and F2's
    x-position stays stable;
  - selecting F1 after that shows `Width` locked with the flex-derived title;
  - resetting `esc` restores esc/F1 widths.
- Key delete/restore QA:
  - deleting F5 changes the rendered key count from 110 to 109;
  - the row flex `esc` grows from `71.722 px` to `125.583 px`;
  - current index 5 becomes F6 and keeps its own `backlight` / `F6` legend, confirming stable
    edit/content IDs after deletion;
  - `Restore key` returns the key count to 110 and restores F5 at its original x/width.
- Key add/delete/restore QA:
  - clicking F5 on the canvas opens a collapsed Legend panel and selects `R1 main · brightness-up`;
  - `Add after` F5 changes the rendered key count from 110 to 111;
  - the inserted-after key is selected, blank, and has `No legend elements.`;
  - neighboring labels stay stable: F5 remains `brightness-up`, F6 remains `backlight`;
  - adding text `NEW` to the inserted key updates it to `R1 main · NEW`;
  - deleting that added key returns the count to 110 and enables `Restore R1 main added #1`;
  - restoring returns the count to 111 and brings back the added key with `NEW`;
  - after `Reference grid`, adding after F5 again produces a blank added key, confirming orphaned
    added-key `contentEdits` were pruned.
- Key add-before QA:
  - `Add before` F5 changes the rendered key count from 110 to 111;
  - the inserted-before key appears between `brightness-down` and `brightness-up`;
  - F5 and F6 keep their own legends after the insertion;
  - selecting original F5 after the insertion shows both add buttons disabled because the row no
    longer has enough flex capacity for another 1U key.
- Key reorder QA:
  - moving F5 left swaps it with F4: the selector order becomes `brightness-up`,
    `brightness-down`, `backlight`;
  - F5 remains selected after moving, now at the new index;
  - moving F5 right restores the original order;
  - an added blank key can move right through F6 and remains selected;
  - `Move left` is disabled on the first key (`esc`), while `Move right` remains enabled.
- Row delete/restore QA:
  - deleting the F-row changes rendered key count from 110 to 89;
  - the number row compacts to the top (`firstRectY` stays at the top-row y);
  - the first visible keys become `~`, `!`, `@`, `#`, `;`, confirming source-row content IDs
    survived the display-row shift;
  - `Restore row` returns the key count to 110 and restores `esc` as the first key;
  - `Delete row` is disabled on the ASDF row because deleting it would create a numpad `rowSpan`
    overlap.
- Row add/delete/restore QA:
  - with Legend expanded, `Add row` below the F-row changes the rendered key count from 110 to 131;
  - the added row is selected at index 21 and appears as `R2 main · blank`;
  - all duplicated keys start with no generated legend content and show `No legend elements.`;
  - deleting the added row returns the count to 110 and enables `Restore added row #1`;
  - restoring the added row returns the count to 131 and reselects the blank added-row key;
  - adding text `ROW` to that synthetic key changes its label to `R2 main · ROW`;
  - after `Reference grid`, adding the row again produces a blank key, confirming synthetic-row
    `contentEdits` were pruned.
- Collapsed Legend QA after the row-add work:
  - collapsing Legend and clicking the first key on the canvas expands the panel, selects
    `R1 main · esc`, and leaves `panel-collapsed = false`.
- JSON model QA:
  - `node analysis/model-io.mjs` confirms the exported `keyboarder.model.v1` shape imports back
    to the same normalized settings, and that domain-only JSON and legacy flat preset blobs import;
  - the same script now also tests `parseKeyboardModelJSONText()`, which is the parsing path used
    by the file input handler after `file.text()`;
  - fresh browser load shows `JSON` and `Import` in the bottom bar;
  - both buttons hit-test as the topmost element at their centers;
  - `Import` has `accept="application/json,.json"`;
  - clicking `JSON` produced no console errors, but the Browser plugin did not surface a download
    event for the programmatic `<a download>` path, so the actual saved-file payload was not
    inspected through Browser automation.
- Stage 5 layout smoke:
  - fresh load shows `LCAKB23`, 5 layout options, 110 caps, and `Reference`/`Diff` enabled;
  - switching to `ANSI_TKL` renders 87 caps, `ISO_TKL` renders 88, `ANSI_65` renders 63, and
    `ANSI_60` renders 58;
  - generated labels attach to every non-LCA key: `ANSI_TKL` renders 87 strings, `ISO_TKL`
    renders 88, `ANSI_65` renders 63, and `ANSI_60` renders 58;
  - non-LCA layouts disable `Reference` and `Diff`, keep both unchecked, and show no warnings
    after generated labels attach;
  - switching back to `LCAKB23` renders 110 caps and restores generated legends;
  - `Verify` on `ANSI_TKL` opens an error dialog saying verification is only available for the
    `LCAKB23` reference layout;
  - on `LCAKB23`, `Language` keeps geometry stable: dual renders 176 text legends, `Latin`
    renders 143, `Cyrillic` renders 150, and returning to dual restores 176;
  - fresh-origin preset seed smoke on `http://127.0.0.1:8007/` showed the new shipped presets in
    the menu, and applying `ANSI TKL` switched to `ANSI_TKL` with 87 keys, 87 strings, and no
    warnings;
  - current-port console logs for the fresh smoke had no warnings or errors.
- Historical Stage 6 Drawing-panel smoke, superseded by the current `New layout` flow:
  - on `http://127.0.0.1:8007/`, `Browse SVG` accepted local `LCAKB23.svg`;
  - the Drawing status reported `blueprint yes`, `caps yes`, 1658 H lines, 1388 V lines,
    884 diagonal lines, 866 paths, 487 span groups, 110 caps, 1U width `46.4941`, height
    `46.1885`, pitch `53.861 × 53.5121`, `Detected: 110 keys from 220 candidates, d 3.3779`,
    and `Issues: 0 warnings, 4 notes`;
  - the preview rendered 3930 SVG lines in `#imported-blueprint`, 110 recognized rects in
    `#imported-candidates`, 110 yellow normal rects, 0 red suspicious rects, and 2
    double-height rects;
  - the Drawing status included `Draft: 3 blocks, 6 rows, 110 keys`; `Draft JSON` is disabled
    before import and enabled after import;
  - `Use Draft` switched the active layout to `IMPORTED_SVG`, added `IMPORTED_SVG · custom` to
    the Grid layout select, rendered 110 keys and 110 generic text legends, disabled
    `Reference`/`Diff`, and produced no console warnings/errors;
  - toggling the `Drawing` layer hid the preview (`0` lines) and restored it (`3930` lines);
  - current-port console logs for this smoke had no warnings or errors.
- Historical Stage 6 Drawing-panel smoke for the user's compact drawing, now powered through
  `New layout` instead:
  - on `http://127.0.0.1:8015/?stage6split=20260728b`, `Browse SVG` accepted
    `/Users/mishaivanov/Desktop/test_layout.svg`;
  - Drawing status reported 1199 H lines, 1046 V lines, 632 diagonal lines, 580 paths,
    435 span groups, 2 cap calibration rects, recovered pitch `53.855 × 53.5147`,
    `Detected: 78 keys from 154 candidates, d 3.3783, 1 stack`, `Issues: 0 warnings, 5 notes`,
    and `Draft: 1 blocks, 6 rows, 78 keys, 1 stack`;
  - `Use Draft` was enabled and switched to `IMPORTED_SVG`;
  - rendered caps count is 78, with exactly two small keys at heights `22.5339` and `22.5342`;
  - Text mode rendered 78 SVG `<text>` nodes and 0 glyph paths; top-row labels are
    `esc`, `F1`...`F13`, and the stacked arrow labels include `up` and `down`;
  - browser console errors after the smoke: none.

Note: the Browser plugin's console log API kept an old error entry from an earlier failed reload
after it was fixed. Current DOM probes confirmed the app initializes and renders.

Local server logs also show 404s for `/fonts/CoFoSans-*.woff2` and `.woff`. Those files are not
present inside this `keyboarder/` workspace; the app still renders with fallback UI fonts. This
looks pre-existing and was not changed in this session.

## Current Stage Assessment

Stages 0-3 are now effectively complete for beta generation and verification:

- legends render as outlines from the local TTF;
- type sizes/leading/tracking/compensation are exposed in UI;
- legend inspection exists;
- diagnostic overlays cover guides, slots, ink boxes, cap boxes, baseline, and x-height;
- verification still passes at defaults;
- Diff and JSON verification report export are in place.

Stage 4 is complete for code:

- Done: click selection, multi-select, Legend inspector sync, arrow navigation, `Escape` clear,
  preset-backed legend content overrides, active-key slot/value editing, bulk template changes,
  add/remove legend elements, reset selected edits, manual compensation overrides in px for text
  L/R slots, key width overrides with row flex recalculation including source flex keys,
  deleting/restoring individual keys, and adding blank individual keys before/after source keys
  in flex-backed rows, moving keys left/right inside a row/block, deleting/restoring whole rows
  when the resulting layout has no overlaps, and adding/restoring blank duplicate rows below
  original source rows.
- Done: first model JSON export/import round-trip shape with `keyboarder.model.v1`, normalized
  settings, explicit domain fields, and pure Node coverage in `analysis/model-io.mjs`.
- Remaining QA note: JSON file import through the browser picker was not re-smoked in this
  Stage 8 pass. The parsing/normalization path behind it is covered in Node, and the Browser
  file chooser flow itself was confirmed by the Stage 8 font-import smoke.

Stage 5 is complete for code:

- Done: built-in layout registry, Grid layout selector, active-layout render path, active-layout
  JSON `layoutName`, language layer switching (`dual`/`latin`/`cyrillic`) without geometry
  changes, generated labels for non-LCA layouts, shipped seed presets for `ANSI_TKL`, `ISO_TKL`,
  `ANSI_65`, and `ANSI_60`, non-reference `Reference`/`Diff`/`Verify` guard, and warnings
  readout.
- Manual note: existing localStorage origins that were already seeded before this change may need
  the preset menu's restore-default action, or a fresh origin, before the new shipped presets show
  up. Non-LCA labels are generic generated labels, not designer-measured content.
Stage 6 is started:

- Done: SVG drawing ingestion/draft creation: strip Illustrator private payloads,
  extract `blueprint`/`caps`, bucket line segments, cap calibration, candidate key rectangles
  from paired horizontal edges, side-edge verification, nesting removal, suspicious-key
  diagnostics, conversion into `keyboarder.layoutDraft.v1`, and the current top-bar `New layout`
  workflow that creates a transient custom layout/preset without drawing an overlay on an opened
  preset.
- Still remaining: deeper production polish for imported layouts, especially more real-world SVG
  QA. Visual suspected-key review and compact `u`/`repeat` draft structure with semantic `ids`
  are now implemented.

Stage 7 main code items are complete:

- Done: Illustrator-like SVG icon layer split (`icons` / `f-icons`), PDF export button with
  physically exact mm page format, clean export hiding for PDF, local `jsPDF` / `svg2pdf` /
  `opentype.js` dependencies, guarded seed preset loading, and legend output mode UI
  (`Outlines` / `Text`), and the compensation table editor. `Batch SVG` was removed after user
  feedback; use the Language select plus normal `SVG` export instead.
- Still remaining: stronger manual QA of downloaded PDF/SVG files in Illustrator/PDF viewer.

Stage 8 main code items are complete:

- Done: pure font probing/autocalibration module plus Node coverage for YS Text Regular and YS
  Text Variable plus local YS Text weight diagnostics.
- Done: session font registry, live font upload/drop, active font selection, variable instance
  and axis controls, active-font autocompensation, per-element `fontId` assignment in Legend
  editor and model IO, session font SVG text export defs, visual control sheet generation, and
  probe/invariant status.
- Remaining caveats: downloaded PDF/SVG files generated with custom fonts still need manual
  Illustrator/PDF-viewer QA; true variable outline instancing needs a future font-engine upgrade
  because bundled `opentype.js` exposes `fvar` but does not apply `gvar` deltas to contours.

## Notes For The Next Assistant

- Keep UI text in English.
- Do not hand-edit `app/kb/content/lcakb23.js` for normal legend/content changes. It is generated
  by `analysis/export_tool.py`; prefer changing the exporter/source pipeline and regenerating.
- `ui-framework/` is intended to be disposable; active code imports from `vendor/framework/`.
- Defaults matter: at reference settings, numerical verification should stay green.
- The tool currently starts from static LCAKB23 data and defaults to the `LCAKB23` preset.
  Editing, model JSON import/export, Stage 5 layout-library workflows, and language layer
  switching now exist; SVG drawing import has its first importable draft slice; Stage 7 export
  polish has local PDF/outline libraries, a mm-sized PDF button, and selectable legend output as
  outlines or SVG text, plus editable punctuation compensation table overrides and language-layer
  batch SVG export. Stage 8 has font probing/autocalibration, session font registry, variable
  controls, multi-font text assignment, and control sheet export; only manual export QA and the
  future `gvar` outline-engine upgrade remain as caveats.
