# Grainy Land

Static landscape and abstract field generator using the shared YF framework.
Open `grainy_land/` through the YF development server. No build step or remote
runtime dependencies are needed. Rendering requires WebGL.

The default preset is **Ember**, based on `grainy-land-1565559100.json`: seed
1565559100, Glow 0, Grain 55 and Radiant tones at 100. Drift has exactly the same settings as Ember, including the seed, with mode set to Abstract.
The shipped list is Ember, Drift and Quiet dunes; all three use Depth #FF5900.

## Controls

- **Composition:** Landscape / Abstract, scale, complexity, flow, horizon,
  relief, folds and seed. Landscape layouts vary reproducibly with the seed.
  **Folds** adds local curls, pockets and pinched passages; 0 gives simpler forms.
  Generate (R) replaces Auto layers and preserves Pinned and Drawn layers.
  Color, texture, names, order, visibility, opacity and editing locks survive Generate.
- **Layers:** independent draggable panel at the bottom right, expanded by default, up to 480px tall (60% of the desktop viewport).
  The frontmost layer is at the top. Select a row or visible paint on the canvas;
  drag rows to reorder, or use **Cmd+[ / Cmd+]** (Ctrl on Windows/Linux) to move backward/forward. Each row has an isolated
  silhouette thumbnail, visibility, Pin and Lock. Double-click the name to rename.
  **+ Auto** creates a generated layer; **+ Drawn** creates an empty layer and selects
  Brush. **Shift+D** duplicates the selection and preserves its shape (an Auto copy
  starts Pinned); **Delete / Backspace** removes the selected unlocked layer. Each
  command is undoable and stays inactive during text input, dialogs or gestures. Background opens the existing background color picker.
  There are up to 16 layers in each mode, with separate Landscape and Abstract stacks.
- **Auto / Pinned / Drawn:** Auto follows composition settings and is replaced by
  Generate. Moving, resizing or painting an Auto layer pins it automatically.
  Pinned keeps its seed, transforms and brushwork through Generate, while global
  composition settings still affect its geometry. Unpin keeps current edits until
  the next Generate. Drawn geometry ignores Generate and all composition controls;
  its color, spray, softness and glow still follow the material controls.
  **Convert to drawn** preserves the exact current silhouette and strokes at any
  export resolution, then freezes its generated geometry. Conversion is undoable.
- **Lock** separately prevents manual editing, deleting and reordering. It does
  not pin an Auto layer: Generate can still replace it. Visibility can be toggled
  while locked; duplicating a locked layer makes an unlocked copy.
- **Workspace:** Canvas starts collapsed at the top left; Composition is below
  it, with Seed inside Generation. Layer properties appears immediately to the left of Layers
  only for the current selection. It follows Layers until dragged independently;
  its position is constrained to the viewport. Default panels keep a 20px window margin and
  make room for neighboring panels; dragging overrides their default position.
  The draggable Move / Brush / Erase toolbar stays above the canvas, with brush
  size beside it while painting.
- **Layer properties:** color group (Terrain / Depth / Light), opacity, folded
  Transform controls, conversion and duplicate/delete actions. Pin and Lock live
  only in the layer rows; names are edited by double-clicking a row. Mode help
  and stroke/layer counts are tooltips. These use the same four global base colors. Drag on the canvas to move, or use the
  square handle to resize around the visible center. X/Y are canvas percentages;
  Width/Height are percentages of the original layer. Arrow keys move by 0.1%
  (Shift: 1%). **V** selects Move, **B** Brush, **E** Erase. Brush and Erase
  activate editing; clicking an object or a layer selects it for editing.
  An empty-space click on or outside the canvas deselects; panels and toolbars
  keep selection. With Brush/Erase, dragging from empty space still paints.
  Escape cancels a gesture or deselects. Space + drag and zoom remain available.
  Shortcuts do not interfere with text entry. Each gesture is one undo step.
- **Transparent PNG:** the export toggle beside Export PNG removes only the
  background from a single PNG or omits the separate Background PNG from a Layers ZIP.
  Spray edges, layer opacity and glow retain alpha;
  the working preview keeps its background. Saved in JSON, presets and share links.
- **Layers ZIP:** exports every layer, including hidden and editing-locked layers,
  as a separate transparent PNG in one ZIP. When Transparent PNG is off, the
  canvas Background is included as a separate opaque PNG at the bottom of the stack.
  Files are numbered front-to-back like the Layers list; hidden layers have a
  `-hidden` suffix. Each PNG keeps the full export canvas, layer position, opacity,
  spray, glow and reflected color from lower visible coats. Empty layers produce
  clear PNGs. Millimetre documents retain DPI metadata. The two toggles are
  independent: Layers ZIP changes the packaging; Transparent PNG removes the background.
  Rendering is sequential from a snapshot and never changes the editor's visibility,
  selection, document or history. ZIPs are limited to 512 MiB; reduce resolution
  if this limit is reached. An empty stack exports only Background, or reports
  an error when Transparent PNG is on.
- **Brush / Erase:** `[` / `]` decrease/increase size by two percentage points
  (3–60%, hold to repeat). Physical keys work in Russian layout too. They only
  apply to Brush/Erase, outside text fields and outside a running stroke. Add to a selected silhouette or cut it away. Layers above it
  can cover the result. Brush size is a percentage of the shorter canvas side and
  stays consistent while zooming. Move and resize carry the strokes with the layer.
  **Clear strokes** removes brushwork and keeps the underlying silhouette; on an
  empty-base Drawn layer it leaves no paint. Limits are 64 strokes / 1024 sampled
  points per layer, 192 points per stroke. The editor reports reaching a limit
  without dropping existing work. Layers and strokes persist in presets, JSON and
  share links. Detailed drawings produce longer links; JSON is useful for exchange
  (import limit: 4 MiB). Selection, handles and the brush cursor are preview-only.
- **Appearance:** the top-right panel has stacked Color and Surface sections.
  Color contains four editable base colors and folded Advanced tones. Surface
  contains grain, softness, edge variation, contrast and glow. Halo width and
  Glow coverage appear only when Glow is above zero; Landscape-only controls
  disappear in Abstract mode. Selecting Background scrolls to and opens the background picker.
  Both palettes start with background **#2353DB** and Depth **#FF5900**.
- **Advanced tones:** four base color pickers remain unchanged. **Amount** sets
  the strength of added neighboring tones (0 keeps the original automatic shading),
  **Hue range** sets hue separation, **Patch size** sets the size of color variations
  without changing landforms, and **Color bleed** controls reflected neighbor colors
  inside a boundary. These settings do not change the seed or geometry.
- **Character:** Pigment gives soft, uneven warm/cool shading; Pearlescent creates
  broad flowing color shifts; Radiant concentrates brighter tones near folds and
  edges. Glow and contrast remain independently adjustable. Three read-only
  gradient strips preview the terrain, depth and light colors.
- **Edit tones:** collapsed by default inside Advanced tones. Low and High endpoints
  for Terrain, Depth and Light use the shared HSB picker and editable hex fields.
  Editing an endpoint fixes that color; **Auto** returns that endpoint to automatic
  calculation from the current base colors, character and hue range. Unedited
  endpoints keep following those controls. Amount still controls the overall effect;
  at 0, custom tones have no effect. The custom count stays visible when folded.
  Overrides survive Generate, presets, JSON, share links and undo/redo.
- **Softness** adjusts the color transitions and silhouette. **Edge variation**
  varies diffusion along each boundary, from compact edges to scattered pigment.
- **Glow** controls luminous contours; **Glow coverage** sets how much of each
  edge receives light, from isolated accents to broad illumination. **Halo width**
  controls the surrounding aura. Glow 0 disables both the luminous core and aura. **Contrast** changes tonal separation independently.
- **Grain / Grain size:** spray intensity and droplet scale. Dense paint has a
  subtle fine texture; partially covered edges reveal translucent colored droplets.
  Grain is anchored in normalized artwork coordinates and filtered for the current
  pixel size. Grain 0 disables all texture, including changes to Grain size.
- **Canvas:** separate panel, collapsed by default. **Units** switches between
  Pixels and Millimeters. Pixels uses width/height (1–8192 px) and Export resolution
  1× / 2× / 3×. Millimeters uses physical width/height and **DPI** (36–1200, default
  300), and shows the resulting PNG pixel dimensions. Changing DPI keeps the entered
  physical size; dimensions are rounded to whole pixels. Switching units preserves
  the current export's pixel dimensions, including an existing 2× or 3× multiplier.
  Print mode uses DPI directly, without an additional export multiplier.
  For example, 210 × 297 mm at 300 DPI exports 2480 × 3508 px.
  Print dimensions and DPI persist in presets, JSON, share links and undo/redo.
  Oversized print edits are rejected with a message, retaining the previous artwork.
  The maximum remains 8192 px per side and 32 megapixels, also bounded by GPU limits.

Presets, share links, color pickers, slider editing, panel collapse, history,
keyboard help and export feedback use `infra/framework/src/index.js`.
Undo/redo: Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z. Export PNG or Layers ZIP: Cmd/Ctrl+E.
J reveals JSON import/export; saved JSON is a versioned Grainy Land document.
UI language follows the existing English YF interface.

## Architecture and future work

`document.js` owns normalization, limits and the versioned JSON format.
`scene.js` generates normalized geometry independently of color and resolution.
Scene version 4 uses four seeded landscape layouts and six independent surfaces: distant terrain, two side banks,
a basin, a foreground fold and a near light plane. Each has separate elevation,
slope, diffusion and local illumination. Seeded two-dimensional deformations
let surfaces curl around one another; a smooth union creates the foreground pocket
and its open tail. Basin preserves the earlier composition. Ridge opens a diagonal
foreground, Valley uses two unequal shoulders, and Fold raises a tall foreground
mass with a compact edge. A separate random stream selects the layout, leaving
existing Basin seeds and Abstract scenes stable. Color fields follow those deformations, with localized highlights,
reflected neighboring colors and fine spray. Abstract mode uses independent rotated
fields and ignores the disabled horizon and relief settings. Painted masks extend or cut these normalized fields.
`materialColors` derives warm crests, cool reflected light and earth half-tones in
OKLab from the editable anchors. `adjacentColors` adds neighboring endpoints in
OKLCH, reducing chroma to fit RGB without shifting hue through channel clipping.
Independent low-frequency color fields distribute those tones within the surfaces.
Color changes never reroll geometry. Six optional hex endpoints override the
computed colors; null means automatic. They are additive v1 document fields,
so earlier JSON files keep their automatic appearance.

`render.js` composites the surfaces with local tonal relief, variable edge
diffusion, contour light and fine aerosol texture. Each coat has its own jittered
round droplets, accumulated in three thin passes. Coverage fluctuates mainly in
transitions; solid paint retains a faint variation in its own pigment. Broad
cluster noise and foreign-color deposits are removed. Untextured underpaint is
kept separately for reflected light, preventing grain in one coat from becoming
a shared stencil in the next. Pixel-footprint filtering reduces subpixel aliasing
in the preview while keeping droplet locations stable in larger exports.
The shared CanvasTarget owns viewport zoom/pan. PNG is rendered afresh at the
requested resolution, without capturing UI or enlarging the preview bitmap.

`layer-data.js` normalizes bounded layer records and translates legacy forms.
`layers.js` provides immutable add, duplicate, remove, reorder, Pin/Lock and
conversion operations. The optional v1 `landscapeLayers` and `abstractLayers`
arrays contain up to 16 records each. Null uses the six legacy generated forms;
an empty array intentionally contains no layers. Explicit stacks take precedence
and clear the corresponding legacy form array. Old form locks become Pinned layers,
not editing locks. Older JSON retains the same appearance.

`scene.js` resolves each layer from its source seed/layout and source surface,
then applies its transform. Generated layers follow live composition settings;
Drawn layers retain a geometry snapshot. Conversion freezes the analytic base
instead of rasterizing it, so the silhouette is resolution-independent and
unchanged at conversion. New Drawn layers have no generated base. Stable source
identities keep geometry, local shading and spray unchanged when reordered.

`render.js` composites the ordered stack with per-layer visibility, opacity and
color group. A GPU picking pass returns the frontmost visible layer; an isolated
pass renders complete silhouettes for thumbnails. `form-editor.js` binds the
layer list, properties, canvas selection and editing to the shared history.
Editor state and handles are separate from saved artwork and PNG output.

`paint.js` stores bounded polylines and radii in local layer coordinates. Ordered
union/subtraction is baked into two 16-bit distance bounds, sampled in WebGL before
material shading and picking. Continuous capsule segments prevent gaps between
pointer samples. An incremental cache reuses earlier segments while drawing;
preview and PNG use the same distance field. A single tiled texture atlas supports
all 16 layers without requiring a sampler for each one. Only changed paint cells
are uploaded; the atlas is at most 4096 pixels on a side. Brush tool and cursor
size remain transient editor choices, separate from the artwork.

`canvas-size.js` owns unit conversion, physical dimensions and export bounds.
Print documents retain the requested millimetres and derive their integer pixel
size from DPI. Legacy documents default to Pixels. `png-export.js` renders the
full print raster and writes the PNG pHYs chunk (pixels/metre with CRC), replacing
any browser density metadata while preserving compressed image bytes. See the
[PNG specification](https://www.w3.org/TR/png-3/#11pHYs). Preview rendering is bounded
separately from full-size export to avoid allocating print-sized preview surfaces.

Animation, tiled export and print color management are deferred. Current output is
RGB PNG with physical-size metadata; it is not a CMYK or ICC conversion. Current seeds are tied to scene version 4. Existing v1 settings JSON still loads,
but renders with the new geometry and material; it does not reproduce images
from previous scene versions. The
original 20-image review is preserved in `tests/reviews/pigment-20`.

## Verification

`npm run test:grainy` checks reference colors, round trips, sanitization,
geometry independence, deterministic seeds, automatic half-tones and export limits.
Layer tests cover migration, all three modes, independent Lock, ordering, empty
stacks, conversion, limits and JSON/share round trips. The GPU fixture also checks
pixel-exact conversion, frozen Drawn geometry, opacity, visibility, 16 painted
layers, picking and PNG export. Print checks cover unit switching, DPI, oversized
requests, persistence, independent CRC validation and a real A4 PNG export.
Open `tests/renderer.html` on the same local server for real GPU/PNG checks
and generated images. This fixture is separate from the tool's user interface.
Open `tests/layers-export.html` for real ZIP/PNG checks: hidden and empty drawn
layers, opacity, full canvas dimensions, progress, DPI metadata and reassembling
Landscape/Abstract layers with glow and reflected colors. Node tests independently
validate ZIP structure, UTF-8 filenames, CRCs, limits and cancellation.

Initial acceptance is in `tests/acceptance.json`; scene-v2 evidence and its
archived 20-image review are in `tests/reviews/pigment-v2`. Adjacent-tone evidence
is in `tests/reviews/tones-v1/acceptance.json`. That review compares disabled tones
with all three characters on both palettes using identical geometry in each row.
The color and forms reviews are archived. The current spray review uses the ten
scene-v3 renders as its unchanged baseline. To regenerate the spray comparison:

```sh
python3 grainy_land/tests/review-server.py --review spray-v1 --port 8024
```

Open `/grainy_land/tests/reviews/spray-v1/` and use its save-comparison button.
Ten new PNGs use the same settings and seeds as the even-numbered files in
`tests/reviews/forms-v3`. The review includes both palettes, glow, abstract mode,
and matching detail crops alongside the two references. Its `acceptance.json`
records the checks, including fine interior texture, absence of coarse patches,
stronger texture at boundaries, and preview/export agreement. The review server
binds to localhost and saves only named review artifacts.

The composition review in `tests/reviews/composition-v4` compares 20 seed values
in both current palettes (40 before and 40 after images). Run the review server
with `--review composition-v4 --port 8025`, then open that folder's page. The
baseline captures published commit `45b9c16`; it is fixed. Both sides use Depth
#FF5900. Compressed 960×540 WebP images focus this review on composition; the GPU
fixture separately checks full-resolution PNG and fine spray.

Completed roadmap stages: composition diversity, manual adjacent-tone correction,
direct editing of large forms, painting masks with brush/eraser, and the independent
Layers panel with Auto / Pinned / Drawn modes and editing locks, and physical print
dimensions with DPI metadata in PNG.
Next: tiled high-resolution export and print color management.
Animation remains a later option.

New settings retain JSON schema v1 compatibility. Missing fields get safe defaults;
the preset migration fills missing tone fields in known shipped presets marked
`seeded`, updates cached built-in Ember and Drift to their current settings, removes
the retired built-in Pigment, and sets Depth #FF5900 in Quiet dunes.
Saved user presets are preserved. New parameters are
included in preset saving, undo/redo, share links and JSON round trips.

The repository-wide directory-coverage check currently stops at the unrelated,
existing, unregistered `grid_generator_02` directory. No exception was added
to hide it and no historical migration evidence was rewritten.

The editor uses the shared UI contract for button segments, appearance section headings,
object-list states and metadata, panel actions, and native disclosures with panel
chevrons. Application CSS owns layout and artwork thumbnails. Run
`npm run check:ui-contract` to check Grainy Land alongside the eight other tools;
GeneratorHost initializes its shared controller directly rather than auto-init.
