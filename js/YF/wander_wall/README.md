# Wander Wall

Letter wallpaper generator on the shared YF framework. Open `wander_wall/`
through a local HTTP server. The browser has no external runtime dependencies.
Artwork preparation and tests use Node.js 24+ and Sharp.

## Automatic Library

Run `npm ci --prefix wander_wall` once, then `npm run serve:wall` from the YF
directory. The local tool opens at `http://127.0.0.1:8020/wander_wall/` (override
with `PORT`). On each page opening the server scans the library and the browser
loads one catalog snapshot. There is no polling or live replacement of artwork.
An ordinary static server can also serve the tool after `npm run build:wall`.

Add letter PNGs to `graphics/alphabet/set_07/A_01.png`, using any numbered set
and variant. Incomplete sets, gaps and different variant counts are supported.
All discovered variants participate in generation. At least one variant of
each letter used in the current text must exist across the library.
Add decorative PNGs anywhere under `graphics/`, including nested folders in
`blobs`, `crystals`, `prism`, `sparky`, `spheres`, `sticks`, or new categories. All categories
mix in the random object pool. PNGs under `graphics/ground/` are surfaces instead
of free objects. `alphabet` and generated `previews` have their own handling;
files/folders starting with `.` or `_` (such as `_ref.png`) and non-PNG files
are excluded from object discovery. Existing letter and blob IDs stay stable.
Keep file paths stable to preserve references in saved compositions.

`asset-catalog.json` contains stable IDs, content hashes, alpha bounds and
32 x 32 masks. The builder creates small WebP layer thumbnails under
`graphics/previews/` and reuses unchanged metrics. Invalid/transparent images
and duplicate IDs fail the build without publishing a partial catalog.
Original PNGs remain untouched and load only when needed. Asset hashes invalidate
the image cache after a replacement; already-open tabs keep their catalog snapshot.

### GitHub

`.github/workflows/wander-wall-catalog.yml` automatically builds and tests the
catalog after artwork/code pushes and in pull requests. It does not deploy or
commit generated files. To publish newly discovered artwork, the deployment must
run `npm ci --prefix js/YF/wander_wall` and
`npm --prefix js/YF/wander_wall run build`, then publish the generated
`asset-catalog.json` and `graphics/previews/` alongside the originals and tool.
Until that deployment integration is enabled, commit the generated catalog and
previews with the artwork when publishing from a branch.

## Composition

- Up to 32 Latin letters, with spaces allowed. Text applies automatically after
  a 300 ms pause; Enter applies immediately. Edits made during artwork loading
  remain pending and apply next. Empty text produces a shapes-only canvas.
- Alternatives are discovered from the library; currently 18 per letter in six sets.
- Generate randomizes unpinned letters, forms, and layout. Letter order is
  preserved by default. Seed remains internal, not a visible control.
- Fill adjusts packing density. Silhouette masks allow interlocking forms and
  controlled overlaps.
- Rotation range sets random angles from minus to plus 0-180 degrees for free
  letters and forms. Zero makes them upright; pinned angles stay unchanged.
- Edge overflow allows 0-50% of each unpinned layer's rotated bounding box beyond
  each canvas edge during generation. Manual coordinates are unrestricted;
  reducing the limit does not move pinned artwork. Exports clip to the canvas.
- Size range defaults to 0, preserving the ordinary generated sizes. At 100 it
  applies an additional random multiplier from 0.5 to 1.5 to each free letter and
  object; at 50 the range is 0.75-1.25. Sticks retain their doubled base scale.
  Frame constraints can reduce the final size. Pinned, hidden and Surface layers
  are unaffected. The variation is deterministic and does not accumulate.
- Object count controls 0-16 extra objects, with 7 by default. Zero removes
  the extra objects. Objects are sampled without repeats until the catalog has been used once.
  Sticks use twice the original scale range; other categories use the original
  range, limited by frame constraints. Generate randomly interleaves objects between letters while keeping
  pinned and hidden layer slots fixed. Saved compositions are not migrated.
- Surface is always included. Generate randomly places its layer between the
  back and the middle of the stack, unless pinned or hidden. It starts in the
  bottom band of the canvas. The image covers the width without
  stretching; excess foreground is cropped below the frame (and on the sides
  when needed in portrait). Position, scale, rotation and layer order are freely
  editable, like other objects. Visibility and variant changes leave the other
  layers untouched. Generate resets an unpinned visible
  surface; pin, hide/show, undo, presets, JSON, links and PNG work normally.
  Opening an older ground-free document adds a Surface without moving other layers.
- General contains a two-line text field with an inset character counter,
  named desktop/iPhone resolution presets. Custom is the last option and reveals
  width/height fields initialized with the current resolution. Arrow Up/Down
  changes a dimension by 1 px; Shift snaps to the next multiple of 10. Arrow edits
  apply automatically; typed dimensions apply on Enter or leaving the fields.
  Document limits: 1-16384 px per side and 32 megapixels total.
  Same-aspect resizing preserves the arrangement; another aspect repacks free
  elements without replacing their variants. Pinned and hidden transforms stay
  unchanged. Phone presets use physical screen pixels, not Figma frame points.
  The shipped Desktop preset is QHD (2560 x 1440); Mobile is 1320 x 2868.

## Editing

Effects never regenerate or move layers. Drop shadow is composited only onto
lower visible objects, never onto Surface or the background. Surface can still
cast shadows onto ordinary objects below it. Background
supports 2-8 gradient colors, or a separate solid color, in a
bottom-right panel collapsed by default. Add inserts an interpolated color into
the widest interval; each color has a remove button, disabled at two colors.
The original four-color gradient and older saved gradients retain their stops.
Shadow is enabled by default, with 50% opacity, 80 px blur, black, 20 px distance
and 90 degrees direction. Only its pill toggle is visible. Distances use exported
image pixels; the original baked lighting is unchanged. Cached untouched shipped
presets receive the new shadow defaults; personally saved presets retain their settings.
Outline has been removed; older documents ignore its settings.
All settings persist in history, presets, JSON and share links, and render in PNG.

Click selects an element; double-click cycles its variant. Drag to move freely,
including far outside the canvas. All four corners and four side midpoints resize
proportionally with the opposite point fixed. Just outside each handle is a rotation
zone with a curved-arrow cursor; resize cursors follow the object's rotation.
Only the selected object's offboard parts are dimmed in the editor. Other layers
are clipped to the frame, and all offboard artwork is excluded from PNG.
F centers the view on a selected element without moving it.
Click a layer row once to select it; double-click to open the variant chooser, with thumbnails and
object-category filtering; Enter on a focused row also opens it. The popup closes
with its framework close icon or Escape. There is no Selection panel.
The Layers panel selects without changing artwork. Its front-to-back order
matches the canvas; drag a grip to reorder, or use Cmd/Ctrl+[ and Cmd/Ctrl+] for
one-step changes. Plain [ sends the selection to the very back; ] brings it to
the very front, preserving all other layer order. These keys do not act in inputs
or open dialogs.

Pins are explicit: moving, resizing, rotating, and changing variants preserve
the current pin state. Each layer has a pin button. Pinned icons are filled;
there is no pinned subtitle, counter, or bulk unpin command.

Eye buttons hide or show individual layers; Delete/Backspace hides the selected
layer without removing a character from Text. Hidden layers stay in the list,
survive Generate, and are excluded from packing, hit testing, and PNG output.
Show all restores them in one undo step. Text changes preserve visibility only
for unchanged letters at the same text index.

Generate preserves the exact variant, transform, and layer position of pinned
elements, even outside the artboard. Editing text retains pins only for unchanged letters at the same text
index. Reducing the object count removes those form instances,
including their pins. Undo restores them.

Each drag is one undo step. Escape cancels an unfinished gesture. Cmd/Ctrl+Z and
Cmd/Ctrl+Shift+Z undo/redo, arrows nudge (Shift: 10 px), P pins,
Shift+V cycles the selected variant, R generates, and Space-drag pans.
Cmd/Ctrl+wheel or Cmd/Ctrl+plus/minus zoom; the top zoom indicator fits the frame.
The shared framework provides the shortcut help and suppresses commands while
typing or using dialogs.

At widths from 769 to 1200 px, narrower panels remain visible alongside the canvas,
below the navigation. At widths up to 768 px (or low landscape windows up to
1000 x 600), General, Composition, Layers, and Background share a scrollable
bottom panel. Selecting artwork does not change tabs. The canvas stays visible
above the panel, with export actions in their own reserved row. The chevron
collapses the panel to enlarge the canvas. Tabs support arrow-key navigation.

Presets, share links, JSON, and history store exact instances, not just the seed.
J reveals JSON actions. PNG renders a separate snapshot at full resolution with
no selection UI. Storage is scoped to `upgrade:wander_wall:presets:v1`.
The shipped Desktop and Mobile presets load once, without overwriting existing
user presets. The framework's Restore default presets command reinstalls them.
Both use Fill 100, Rotation range 30, Size range 50, Edge overflow 0, 10 objects
and Drop shadow enabled, with the initial text `Wander`. Text preserves any Latin
letter case in the input, documents and links; artwork lookup is case-insensitive.
Untouched cached shipped presets regenerate with these
defaults when opened; personally saved or modified presets retain their settings.

## Assets and Code

- `assets.js`: installs the one-time catalog and lazily loads selected originals.
- `scripts/catalog.mjs`, `prepare-assets.mjs`: discover and prepare actual files;
  `WANDER_NODE_MODULES` may point to an existing directory containing Sharp.
- `effects.js`, `effects-ui.js`: normalized effects and shared framework controls.
- `layout.js`: deterministic row anchors, silhouette coverage optimization, and
  gap filling. Pinned elements are obstacles for the remaining composition.
- `ground.js`: aspect-preserving surface sizing and bottom anchoring.
- `document.js`: normalized state, format limits, and versioned JSON validation.
- `resolutions.js`: named pixel presets and custom-dimension validation.
- `variant-picker.js`: thumbnail chooser and concise layer labels.
- `editor.js`, `render.js`, `tool.js`: pointer editing, rendering/export, and shared
  framework integration. Selection and gesture previews are transient.

## Verification

`npm run test:wall` checks discovery, incremental imports, invalid files, effects,
resolution presets and Custom, same-aspect resizing, 1-32 letters,
determinism, reading order, bounds/overflow, rotation limits, pins, hidden layers,
forms, unrestricted manual transforms, legacy defaults, and JSON/share round trips.

`node wander_wall/tests/browser.mjs` runs Playwright against port 8020 by default.
Set `WANDER_URL`, `WANDER_CHROME`, and `WANDER_NODE_MODULES` for another local
setup. It checks click/double-click selection, automatic text and in-flight drafts,
composition controls, layer reordering, explicit pins, actual PNG downloads,
mobile panels, visibility/export, rotation/overflow controls, presets, import
recovery, and share links. Results are in
`tests/acceptance.json`.

`tests/render.html` runs 19 browser pixel checks for object-only shadows, layer
order, hidden/offboard casters, preview scale and PNG parity. `tests/responsive.html`
provides fixed laptop and phone viewports for manual UI checks.
