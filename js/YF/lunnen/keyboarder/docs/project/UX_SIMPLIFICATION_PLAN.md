# Keyboarder UX Simplification Plan

Date: 2026-08-02

This plan turns Keyboarder from a broad engineering console into a drawing-first production tool
for creating new keyboard layouts from factory SVG drawings. Existing functionality should be
hidden or moved into advanced/debug surfaces, not deleted, unless a later cleanup explicitly proves
it is obsolete.

## Implementation Log

2026-08-02 first slice:

- Added default `simple` UI mode and hidden advanced/debug controls with `data-advanced-only`.
- Added `?advanced=1` / `?advanced=0` mode switching and `KeyboarderUI.setAdvanced(true|false)`
  for QA.
- Kept the Grid stats readout visible in simple mode.
- Hidden normal-UI controls that mutate physical geometry or expose QA internals.
- Changed `New layout` to open an explanatory popup before file selection.
- Added a unified `New layout` file input for SVG and Keyboarder JSON.
- Added stable sample files at `app/assets/new-layout-sample.svg` and
  `docs/assets/new-layout-sample.svg`.
- Made SVG group matching case-insensitive for `blueprint`, `caps`, and `guides`.
- Enforced `caps` as the required SVG layer while allowing missing `blueprint`.
- Changed warning-level SVG import diagnostics to create the layout immediately instead of blocking.

2026-08-02 second slice:

- Returned the `JSON` export button to the default simple UI.
- Converted the existing Legend editor into a simple-mode key popover positioned near the clicked
  key, while keeping the old right-side Legend panel behavior in advanced mode.
- Added dirty-close protection for unapplied key edits when closing the popover, pressing Escape,
  clicking another key, clicking the canvas background, or navigating away with arrow keys.
- Protected open dirty drafts from being overwritten by unrelated rerenders such as typography or
  guide-inset changes.

2026-08-02 third slice:

- Restored the `Reference` layer toggle to the default simple UI and allowed reference overlays to
  render outside advanced mode.
- Kept `Diff` and structural debug layers advanced-only.
- Reworked template option labels from technical ids into user-facing names while preserving stored
  template ids and JSON compatibility.
- Added per-key color override in the popover. The override is stored as `contentEdits[id].keyColor`,
  exported/imported through Keyboarder JSON, and rendered only on that physical key.

## Product Principles

1. The factory drawing is the source of truth.
   Key size, position, spacing, and row/block geometry come from imported SVG contours. The user
   should not adjust physical key geometry in the normal UI.

2. Geometry is locked after import.
   The normal workflow can change key function, content, icon assignment, style, colors, guide inset,
   and typography. It must not move, resize, add, or delete physical keys.

3. The first screen is the production workflow, not a lab bench.
   Keep common controls visible. Move import reports, verification, JSON tools, geometry sliders,
   compensation tables, and font internals into advanced/debug views.

4. Keep Work 2.0 L as the default preset.
   On a clean load the app should show `Work 2.0 L`, not an empty custom layout or a library/grid
   preset.

5. Keep the compact layout stats visible.
   The Grid/info panel should still show useful readouts such as key count, artboard size, gap,
   legend counts, icon counts, and warnings.

6. Import should be immediate when the file is valid.
   `New layout` should explain the required SVG structure, accept SVG or JSON, and create the new
   layout immediately if the file meets requirements. If it does not, show a focused problem dialog
   explaining what was missing and what the file must contain.

7. Advanced power stays available.
   `Verify`, `Diff`, JSON import/export, reference overlays, geometry controls, compensation tables,
   and font control sheets remain in the codebase, but they should not crowd the default UI.

## Target User Workflow

1. The user receives a factory drawing and minimally edits it so all key contours are readable.

2. The user adds a layer with several accurately drawn key caps in the desired size, spacing, and
   corner radius.

3. The user clicks `New layout`.
   A popup explains the file requirements and provides an example SVG. The popup accepts SVG and
   JSON files.

4. If the file is valid, the layout is created immediately.
   The canvas switches to the new layout, the info panel updates, and the user can adjust colors,
   corner radius, guide inset, and typography.

5. If the file is invalid, the app opens a problem dialog.
   The dialog lists missing layers, unreadable contours, unsupported file type, or other blocking
   issues, and repeats the minimum file requirements.

6. The user edits content, not geometry.
   They can reorder functions in the bottom row or numpad, reorder F-row icons, choose key templates,
   edit key content, upload SVG icons, adjust typography, and add per-symbol optical overrides.

7. The user exports the final layout.
   Export actions stay visible, but rarer formats and QA artifacts can move into an export menu.

## SVG Import Requirements

Minimum valid SVG:

- Required: a `caps` layer with readable key cap contours.
- Optional: a `blueprint` layer with the factory drawing.
- Optional: a `guides` layer. Later, this can be used to infer guide inset.

Layer matching rules:

- The docs and popup should show strict examples: `blueprint`, `caps`, `guides`.
- Matching should be case-insensitive, so `Caps`, `CAPS`, and `caps` are equivalent.
- Typo-tolerant matching is useful, but not required for the first implementation slice.

Important rule:

- If `blueprint` is missing but `caps` exists, the import is still valid. There is no workflow
  limitation in this case.

Recommended sample asset:

- Copy the provided `sample.svg` into a stable project/app asset path, for example
  `docs/assets/new-layout-sample.svg` for docs and `app/assets/new-layout-sample.svg` if the popup
  needs to link/download it at runtime.

## Priority 0 - Protect The Source-Of-Truth Model

Goal: make sure the normal UI can no longer encourage geometry edits that conflict with imported
drawings.

Implementation:

1. Introduce a default `simple` UI mode and an internal `advanced` or `debug` mode.

2. In `simple` mode, hide physical geometry editing controls:
   - Grid layout select in the left panel.
   - Column pitch.
   - Row pitch.
   - 1U width.
   - Key height.
   - Reference grid button.
   - Key width field in the selected-key editor.
   - Move left/right.
   - Add before/after.
   - Delete/restore key.
   - Add/delete/restore row.

3. Keep the compact info block visible:
   - Keys.
   - Artboard.
   - Gap.
   - Legends.
   - Warnings.

4. Keep geometry controls wired in `advanced` mode for QA and future recovery work.
   Do not delete the underlying settings, layout edit code, import diagnostics, or regression tests.

5. Make `Work 2.0 L` the clean-load default in the top preset dropdown.

Acceptance checks:

- Fresh browser load opens `Work 2.0 L`.
- The left panel still shows key/artboard/gap/legend/warning stats.
- The default UI does not expose controls that can move, resize, add, or delete physical keys.
- Existing advanced controls can still be reached through the chosen advanced/debug entry point.

## Priority 1 - Rebuild `New Layout` Around A Clear Import Popup

Goal: make `New layout` the only normal entry point for creating or loading layouts.

Implementation:

1. Replace the current direct file-pick behavior with a `New layout` popup.

2. The popup should contain concise requirements:
   - Upload an SVG with a `caps` layer.
   - Add `blueprint` if you want to keep the factory drawing in the source file.
   - Add `guides` if available.
   - Layer names are case-insensitive.
   - JSON files exported by Keyboarder can also be loaded here.

3. The popup should include the example SVG:
   - Link/download sample file.
   - Small visual preview is optional.

4. Supported uploads:
   - `.svg` creates a new layout from contours.
   - `.json` imports a Keyboarder model/preset.

5. Valid SVG behavior:
   - Create the layout immediately.
   - Use the file name for the initial layout name.
   - Clear old temporary import/diff states.
   - Reset content edits unless importing a JSON model that contains them.
   - Show a short success toast with key count and warnings count.

6. Invalid SVG behavior:
   - Open a problem dialog instead of silently failing.
   - Show blocking issues first.
   - Include exact missing requirements, for example "No `caps` layer found".
   - Include non-blocking warnings below blockers.
   - Offer `Download report` only in advanced/debug mode.

Acceptance checks:

- Valid sample SVG creates a layout in one action after file selection.
- SVG with `Caps` instead of `caps` imports successfully.
- SVG with `caps` and no `blueprint` imports successfully.
- SVG with no readable `caps` layer opens a clear problem dialog.
- JSON import still works through `New layout`.

## Priority 2 - Simplify The Main Panels

Goal: keep the visible interface aligned with the real production tasks.

Main top bar:

- Back/YF Tools.
- Preset dropdown, default `Work 2.0 L`.
- Optional link/share button if still useful.
- `New layout`.
- Zoom.

Left panels:

- Layout/info panel:
  - compact stats remain visible;
  - no default geometry sliders except controls that are true styling controls.
- Colors:
  - key color;
  - guide color;
  - legend color;
  - background color.

Center/bottom:

- Export controls:
  - keep `SVG` and `PNG` visible if they are common;
  - move `PDF` into an export menu if screen space matters;
  - move `JSON` and raw `Import` into advanced/debug, because normal loading happens through
    `New layout`.

Layers panel:

- Keep visible:
  - Keys/outlines.
  - Legends/glyphs.
  - Icons.
  - Guides/margins.
  - Ink boxes.

- Hide in default mode:
  - Language dropdown.
  - Columns.
  - Index.
  - Slots.
  - Blocks.
  - Reference.
  - Diff.

- Advanced mode can restore all hidden layer toggles.

Type/style panel:

- Keep visible:
  - glyph size;
  - numpad size;
  - secondary size;
  - word size;
  - leading;
  - tracking offset;
  - guide inset if it fits better here than in the left panel.

- Hide in default mode:
  - compensation mode segmented control;
  - outline/text rendering mode control;
  - font drop zone;
  - font status block;
  - font control sheet;
  - compensation table editor.

Acceptance checks:

- A first-time user sees only controls that map to the stated workflow.
- No default visible control suggests that key geometry is editable.
- Advanced mode still exposes the hidden QA/development tools.

## Priority 3 - Key Popover Editor

Goal: clicking a key opens a small content editor that changes the selected key without occupying
the whole screen.

Behavior:

1. Click a key to open a popover near that key.

2. The popover edits content and styling only.
   It must not expose key width, key position, row edits, or geometry mutation.

3. The popover has draft state.
   If the user changes something and tries to close without pressing `Apply`, show a confirmation:
   apply, discard, or keep editing.

4. `Apply` commits changes to the model.
   `Cancel` or discard restores the selected key to its previous state.

5. Escape behavior:
   - If unchanged, close.
   - If dirty, ask for confirmation.

Editor contents:

- Key template preset select.
- Template preview or slot list.
- Content units:
  - add text;
  - add icon;
  - remove unit;
  - edit text value;
  - choose icon from existing library;
  - upload SVG icon.
- Per-unit settings:
  - slot;
  - size;
  - tracking;
  - optical offset X/Y;
  - color override;
  - style lock checkbox.
- Per-key custom settings:
  - optional key color override;
  - optional custom mode.

Template presets:

- Four corner labels.
- One centered icon.
- One centered text.
- Top/bottom centered text.
- Icon plus caption.
- F-key icon plus fixed F-label.
- Icon-only service key.
- Word label.
- Custom.

Acceptance checks:

- Clicking any key opens the popover.
- Editing without apply cannot be lost accidentally.
- Template changes preserve existing content where slots can be mapped safely.
- Custom mode can add arbitrary text/icon units and key color override.

## Priority 4 - Function Reordering Without Geometry Changes

Status 2026-08-04: first implementation is done for F-row icon dragging, bottom main-row
function swaps, and numpad function swaps.

Goal: allow practical layout variations by moving content/function assignments, never physical keys.

Bottom row and numpad:

1. Done: drag-and-drop swaps key function/content between physical keys in the bottom main row
   and numpad.

2. Done: geometry remains unchanged:
   - x/y/w/h do not change;
   - guide positions follow the physical key;
   - only function/content assignment changes.

3. Done: this is modelled as `contentEdits`, not as `layoutEdits`.

F-row icons:

1. Done: dragging within the top row changes icon assignments only.

2. Done: text labels stay on their original physical keys.

3. Example behavior:
   - Drag F1's icon onto `esc`: the icon moves/swaps, while `esc` and `F1` labels stay where they
     were.
   - Drag F12 onto the icon-only key to its right: icons swap, and each icon uses the destination
     key's composition/alignment rules.

4. Done: the first implementation covers the top/F row; it also covers bottom main-row and numpad
   function swaps.

Acceptance checks:

- Done: dragging bottom-row functions changes content but not geometry.
- Done: dragging numpad functions changes content but not geometry.
- Done: dragging F-row icons preserves F-label and esc/service labels.
- Done: export reflects the changed content assignments.

## Priority 5 - SVG Icon Library And Upload

Status 2026-08-03: first slice is done.

Goal: support replacing and extending icon content without touching geometry.

Implementation:

1. Done: the key popover has an icon picker for icon rows.

2. Partial: existing and uploaded icons are selectable by name. Visual previews are still open.

3. Done: upload accepts SVG only from the key popover.

4. Done for path-only SVG: uploaded SVG is sanitized and normalized into `customIcons`:
   - no scripts;
   - no external images;
   - self-contained `<path d="...">` data only;
   - `viewBox` or numeric `width`/`height` becomes icon `w/h/ox/oy`;
   - clear error if the SVG cannot be used.

   Still open: shape conversion (`rect`, `circle`, `polygon`, text) and SVG transforms. For now,
   flatten/expand artwork to paths before upload.

5. Done: uploaded icons become session/project assets in JSON/presets and can be assigned to other
   keys.

6. Done: uploaded icons render through the same icon placement and clean SVG export path. Icon
   `W/H` now scales path geometry against each icon's natural `w/h`.

Acceptance checks:

- Done: uploading a valid simple SVG icon makes it available in the picker.
- Done: invalid SVG icon shows a clear error for unsupported SVG structures.
- Done: assigned uploaded icons export correctly; covered by `analysis/browser-variable-font-smoke.mjs`.

## Priority 6 - Typography Styles, Latin/Cyrillic Split, And Per-Symbol Overrides

Goal: support precise typographic corrections without turning the main UI into a font lab.

Style model:

1. Keep global keyboard text styles:
   - glyph;
   - numpad;
   - secondary;
   - word;
   - service/F labels as needed.

2. Latin and Cyrillic are linked by default.

3. Add an `Unlink Cyrillic` option.
   When enabled, Cyrillic gets its own size/tracking/offset/style values while still sharing the
   same physical key geometry.

4. Font family changes are rare.
   Move font upload and font selection into an advanced style dialog, not the always-visible panel.

Per-symbol override:

1. Overrides apply to one concrete content element on one concrete key.

2. Add a style lock checkbox on the element.

3. Locked element settings:
   - size override;
   - tracking override;
   - X optical offset;
   - Y optical offset;
   - color override;
   - optional font/style override.

4. Offsets are relative to the guide/slot anchor.
   If guide inset changes, the symbol still follows the guide and then applies its override offset.

5. Do not lock the symbol to absolute canvas coordinates.

Acceptance checks:

- One specific symbol can be adjusted without changing matching symbols elsewhere.
- Guide inset changes still move the adjusted symbol with the slot.
- Cyrillic can be unlinked and styled independently.
- Font upload remains available but hidden from the default UI.

## Priority 7 - Advanced And QA Mode

Goal: preserve existing engineering tools without exposing them in the production UI.

Advanced entry point options:

- URL parameter, for example `?advanced=1`.
- Keyboard shortcut.
- Small disclosure in a settings/help menu.

Advanced tools to keep:

- Verify.
- Diff.
- Reference overlay.
- JSON export/import.
- Import report download.
- Geometry sliders.
- Reference grid.
- Columns/index/slots/blocks overlays.
- Text outline/render mode.
- Compensation mode and compensation table editor.
- Font drop zone and font diagnostics.
- Raw selected-key geometry controls.
- Row/key add/delete/restore controls.

Acceptance checks:

- Default mode is simple.
- Advanced mode can still reproduce current QA workflows.
- Regression scripts that rely on hidden features keep passing.

## Priority 8 - Future Backlog

These are useful, but secondary to the main workflow.

1. Use `guides` layer to infer guide inset.

2. Typo-tolerant layer matching:
   - `cap`;
   - `keycaps`;
   - `guid`;
   - common misspellings.

3. Better import preview:
   - show detected `blueprint`, `caps`, `guides`;
   - show key count;
   - show artboard and gap;
   - show warnings before creation only when there are meaningful risks.

4. Persist custom user icon libraries.

5. Export/import reusable template sets.

6. Add named style presets for different factories or keyboard families.

7. Add visual before/after comparison mode for generated layout vs `_curv.svg` references, hidden
   under QA by default.

## Suggested Implementation Order

1. Add `simple`/`advanced` UI mode and hide dangerous or rare controls in default mode.

2. Ensure clean default preset is `Work 2.0 L`.

3. Preserve and polish the compact info block in the left panel.

4. Replace direct `New layout` file pick with the import popup.

5. Add case-insensitive layer recognition and the "caps without blueprint is valid" rule to visible
   diagnostics.

6. Add the invalid-import problem dialog.

7. Move JSON import into `New layout`; keep raw JSON buttons advanced-only.

8. Create the key popover editor shell with apply/discard dirty-state protection.

9. Move current Legend editor capabilities into the popover, initially using existing template and
   content edit data.

10. Add template preset names and safer slot mapping.

11. Add custom key mode and per-key color override.

12. Done: add SVG-only path icon upload and icon picker. Remaining refinement: icon previews and
    path conversion for basic SVG shapes/transforms.

13. Done: add F-row icon drag-and-drop with labels fixed in place.

14. Done: add bottom-row and numpad function drag-and-drop.

15. Add per-symbol lock and relative X/Y optical offsets.

16. Add Latin/Cyrillic linked style model and `Unlink Cyrillic`.

17. Move font upload/selection into an advanced style dialog.

18. Add `guides` layer guide-inset inference.

19. Add typo-tolerant layer names and richer import preview.

20. Revisit advanced/debug controls after the simplified workflow has been used on several real
    factory drawings.

## Test Plan

Automated checks:

- Existing model IO round-trip.
- Existing preset manifest check.
- Existing SVG import stress check.
- Existing browser smoke now covers valid path-only SVG icon upload into the picker and clean SVG
  export.
- New import fixture checks:
  - valid `caps` + `blueprint`;
  - valid `Caps` + `Blueprint`;
  - valid `caps` only;
  - missing `caps`;
  - invalid SVG icon upload.
- UI state checks:
  - clean load shows `Work 2.0 L`;
  - simple mode hides geometry mutation controls;
  - advanced mode shows hidden QA controls.

Browser/manual checks:

- Import sample SVG through `New layout`.
- Confirm invalid import problem dialog copy is understandable.
- Toggle visible layers: keys, legends, icons, guides, ink boxes.
- Change colors, guide inset, and typography sizes.
- Click a key, edit content, close dirty popover, verify confirmation.
- Apply popover changes and export SVG.
- Drag F-row icons and verify labels stay fixed.
- Drag bottom-row/numpad functions and verify geometry stays fixed.
- Add per-symbol override, then change guide inset and verify the symbol follows the slot plus
  override.

Definition of done:

- The default interface supports the full stated production workflow without requiring advanced
  controls.
- All current QA/debug functionality remains available somewhere outside the default UI.
- Geometry cannot be accidentally edited in the normal workflow.
- New layouts can be created from valid SVG files immediately, with clear feedback for invalid
  files.
