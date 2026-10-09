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
`blobs`, `crystals`, `prism`, `spheres`, `sticks`, or new categories. All categories
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
  preserved by default; Shuffle letters changes their spatial order.
- Fill adjusts packing density. Silhouette masks allow interlocking forms and
  controlled overlaps.
- Rotation range sets random angles from minus to plus 0-180 degrees for free
  letters and forms. Zero makes them upright; pinned angles stay unchanged.
- Edge overflow allows 0-50% of each unpinned layer's rotated bounding box beyond
  each canvas edge during generation. Manual coordinates are unrestricted;
  reducing the limit does not move pinned artwork. Exports clip to the canvas.
- Include objects and Count control 0-16 extra objects. Objects are sampled without
  repeats until the catalog has been used once.
- Include ground adds one surface behind every other layer. Height sets its
  bottom band to 10-60% of the canvas. The image covers the width without
  stretching; excess foreground is cropped below the frame (and on the sides
  when needed in portrait). Its position, rotation and layer order are fixed,
  independent of ordinary object overflow. Height, toggle and variant changes
  leave the other layers untouched. Generate changes an unpinned visible
  surface; pin, hide/show, undo, presets, JSON, links and PNG work normally.
  Older documents stay ground-free until Include ground is enabled.
- General contains text, named desktop/iPhone resolution presets and pixel
  width/height inputs. Editing either dimension selects Custom, even when it
  matches an existing preset. Enter or leaving the dimension fields applies
  both values together. Limits: 1-16384 px per side and 32 megapixels total.
  Same-aspect resizing preserves the arrangement; another aspect repacks free
  elements without replacing their variants. Pinned and hidden transforms stay
  unchanged. Phone presets use physical screen pixels, not Figma frame points.
  Default output remains Desktop 4K (3840 x 2160).

## Editing

Effects never regenerate or move layers. Shadow and outline affect letters and
free objects, not the ground surface. Background supports a
four-color gradient with direction, or a solid color. Shadow has color, opacity,
blur, distance and direction; outline has color and width. Width, blur and distance
are measured in exported image pixels. The original baked lighting is unchanged.
Effects are disabled by default for backwards compatibility. Drop shadow and
Outline are direct pill toggles; enabled effects expose their parameters.
All settings persist in history, presets, JSON and share links, and render in PNG.

Click selects an element; double-click cycles its variant. Drag to move freely,
including far outside the canvas. The lower-right handle resizes, and the circular
handle rotates. Offboard artwork is dimmed in the editor but excluded from PNG.
Locate layer centers the view on a selected element without moving it.
The variant chooser shows thumbnails and object-category filtering. Ground
variant and height live in its Selection panel. The Layers
panel also selects without changing artwork. Its front-to-back order matches
the canvas; drag a grip to reorder, or use the selection panel's arrow buttons.
Size and Rotation use shared editable numeric controls alongside their sliders.

Pins are explicit: moving, resizing, rotating, and changing variants preserve
the current pin state. Each layer has a pin button, and Unpin all clears all
pins in one undo step. The list shows pinned/hidden states and a pinned count.

Eye buttons hide or show individual layers; Delete/Backspace hides the selected
layer without removing a character from Text. Hidden layers stay in the list,
survive Generate, and are excluded from packing, hit testing, and PNG output.
Show all restores them in one undo step. Text changes preserve visibility only
for unchanged letters at the same text index; form count/off works as before.

Generate preserves the exact variant, transform, and layer position of pinned
elements, even outside the artboard. Editing text retains pins only for unchanged letters at the same text
index. Reducing the form count or disabling forms removes those form instances,
including their pins. Undo restores them.

Each drag is one undo step. Escape cancels an unfinished gesture. Cmd/Ctrl+Z and
Cmd/Ctrl+Shift+Z undo/redo, arrows nudge (Shift: 10 px), P pins,
Shift+V cycles the selected variant, R generates, and Space-drag pans.
Cmd/Ctrl+wheel or Cmd/Ctrl+plus/minus zoom; the top zoom indicator fits the frame.
The shared framework provides the shortcut help and suppresses commands while
typing or using dialogs.

At widths up to 1200 px, General, Composition, Layers, and Selection share a scrollable
bottom panel. The canvas stays visible above it, with export actions in their
own reserved row. Selecting artwork opens Selection; the chevron collapses the
panel to enlarge the canvas. Tabs support arrow-key navigation.

Presets, share links, JSON, and history store exact instances, not just the seed.
J reveals JSON actions. PNG renders a separate snapshot at full resolution with
no selection UI. Storage is scoped to `upgrade:wander_wall:presets:v1`.

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
setup. It checks click/double-click selection, automatic text and in-flight drafts, exact
numeric controls, layer reordering, explicit pins, actual PNG downloads,
mobile panels, visibility/export, rotation/overflow controls, presets, import
recovery, and share links. Results are in
`tests/acceptance.json`.
