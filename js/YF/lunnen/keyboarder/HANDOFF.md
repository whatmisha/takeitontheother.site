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
  - clicking a key selects it and updates the Legend inspector/select;
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
  - reset removes overrides for the selected keys and falls back to generated content.
- Moved the collapsed Legend panel above the bottom export buttons; its header had overlapped the
  `SVG` button at the old bottom position.

## Verification

Commands run successfully:

```sh
node --check app/tool.js
node --check app/kb/legends.js
node --check app/kb/verify.js
node analysis/harness.mjs
node analysis/verify-legends.mjs
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
- Click on a key selects it, updates the Legend panel, and keeps preset label `LCAKB23` (no dirty
  marker).
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

Stage 4 is started, not complete:

- Done: click selection, multi-select, Legend inspector sync, arrow navigation, `Escape` clear,
  preset-backed legend content overrides, active-key slot/value editing, bulk template changes,
  reset selected edits.
- Still remaining: row/key edits, manual compensation overrides, richer model export/import for
  edited keyboard data, and eventually adding/removing legend elements rather than only retargeting
  existing template variants.

## Notes For The Next Assistant

- Keep UI text in English.
- Do not hand-edit `app/kb/content/lcakb23.js` for normal legend/content changes. It is generated
  by `analysis/export_tool.py`; prefer changing the exporter/source pipeline and regenerating.
- `ui-framework/` is intended to be disposable; active code imports from `vendor/framework/`.
- Defaults matter: at reference settings, numerical verification should stay green.
- The tool currently starts from static LCAKB23 data and defaults to the `LCAKB23` preset.
  Import/editing workflows are later stages.
