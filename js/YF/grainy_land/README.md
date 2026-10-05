# Grainy Land

Static landscape and abstract field generator using the shared YF framework.
Open `grainy_land/` through the YF development server. No build step or remote
runtime dependencies are needed. Rendering requires WebGL.

The default preset is **Ember**, based on `grainy-land-1565559100.json`: seed
1565559100, Glow 0, Grain 55 and Radiant tones at 100. All four shipped presets use Depth #FF5900.

## Controls

- **Composition:** Landscape / Abstract, scale, complexity, flow, horizon,
  relief, folds and seed. Landscape layouts vary reproducibly with the seed. **Folds** adds local curls, pockets and pinched passages;
  0 gives simpler layered forms. Generate (R) changes the seed and replaces unlocked
  forms, preserving locked forms and all color and texture settings.
- **Edit forms (E):** off by default. Select the visible paint on the image or a
  named form in the panel. Drag to move, or use the square handle to resize around
  the visible center. X/Y are offsets as percentages of the canvas; Width/Height
  are percentages of the original form. Arrow keys move by 0.1% (Shift: 1%).
  Editing locks the form automatically; **Lock / Unlock** controls whether Generate
  keeps it. Unlock leaves it in place until Generate; **Reset form** restores that
  form from the current seed. Global composition controls still affect locked forms.
  Landscape and Abstract retain separate edits. Each drag is one undo step; Escape
  cancels an active drag or exits editing. Space + drag and zoom remain available.
  Edits persist in presets, share links and JSON. Selection outlines are preview-only.
- **Color:** four editable base colors.
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
- **Canvas:** separate panel, collapsed by default; custom width and height and
  Export resolution 1× / 2× / 3× for PNG.
  The maximum is 8192 px per side and 32 megapixels, also bounded by GPU limits.

Presets, share links, color pickers, slider editing, panel collapse, history,
keyboard help and export feedback use `infra/framework/src/index.js`.
Undo/redo: Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z. PNG: Cmd/Ctrl+E.
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
fields and ignores the disabled horizon and relief settings. These normalized
fields provide a place to introduce user-painted shapes later.
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

`form-editor.js` uses the same GPU geometry pass for visible-form picking. Each
edited form stores a bounded normalized transform and its source seed/layout;
its phases, local geometry and spray seed survive Generate. Unedited files retain
identity transforms. Editor selection and handles use a separate canvas and never
enter the PNG renderer. The optional v1 `landscapeForms` and `abstractForms` arrays
contain at most six entries; null keeps fully automatic generation.

Painting, animation and
print color management are deferred. Current output is RGB PNG; future print
support can retain normalized scenes and introduce physical dimensions, output
profiles and tiled rendering. Current seeds are tied to scene version 4. Existing v1 settings JSON still loads,
but renders with the new geometry and material; it does not reproduce images
from previous scene versions. The
original 20-image review is preserved in `tests/reviews/pigment-20`.

## Verification

`npm run test:grainy` checks reference colors, round trips, sanitization,
geometry independence, deterministic seeds, automatic half-tones and export limits.
Open `tests/renderer.html` on the same local server for real GPU/PNG checks
and generated images. This fixture is separate from the tool's user interface.

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

The completed first roadmap stage adds composition diversity. Remaining stages:
manual adjacent-tone correction; direct editing and locking of large forms;
painting large masks on the canvas; physical print dimensions and color-managed
high-resolution export. Animation remains a later option.

New settings retain JSON schema v1 compatibility. Missing fields get safe defaults;
the preset migration fills missing tone fields in known shipped presets marked
`seeded`, updates cached built-in Ember to the current default settings, and sets
Depth #FF5900 in all other cached built-ins.
Saved user presets are preserved. New parameters are
included in preset saving, undo/redo, share links and JSON round trips.

The repository-wide directory-coverage check currently stops at the unrelated,
existing, unregistered `grid_generator_02` directory. No exception was added
to hide it and no historical migration evidence was rewritten.
