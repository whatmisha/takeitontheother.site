# Grainy Land

Static landscape and abstract field generator using the shared YF framework.
Open `grainy_land/` through the YF development server. No build step or remote
runtime dependencies are needed. Rendering requires WebGL.

The default preset is **Ember**, retaining the original parameters from `grainy-land-1565559100.json`: seed
1565559100, Glow 0, Grain 55, Radiant tones at 100, and depth color #D43C00.

## Controls

- **Composition:** Landscape / Abstract, scale, complexity, flow, horizon,
  relief, folds and seed. **Folds** adds local curls, pockets and pinched passages;
  0 gives simpler layered forms. Generate (R) changes only the seed.
- **Color & light:** Pigment / Ember palettes and four editable base colors.
  Both reference palettes start with background **#2353DB**.
- **Adjacent tones:** four base color pickers remain unchanged. **Amount** sets
  the strength of added neighboring tones (0 keeps the original automatic shading),
  **Hue range** sets hue separation, **Patch size** sets the size of color variations
  without changing landforms, and **Color bleed** controls reflected neighbor colors
  inside a boundary. These settings do not change the seed or geometry.
- **Character:** Pigment gives soft, uneven warm/cool shading; Pearlescent creates
  broad flowing color shifts; Radiant concentrates brighter tones near folds and
  edges. Glow and contrast remain independently adjustable. Three read-only
  gradient strips preview the derived terrain, depth and light colors.
- **Softness** adjusts the color transitions and silhouette. **Edge variation**
  varies diffusion along each boundary, from compact edges to scattered pigment.
- **Glow** controls luminous contours; **Glow coverage** sets how much of each
  edge receives light, from isolated accents to broad illumination. **Halo width**
  controls the surrounding aura. Glow 0 disables both the luminous core and aura. **Contrast** changes tonal separation independently.
- **Grain / Grain size:** spray intensity and droplet scale. Dense paint has a
  subtle fine texture; partially covered edges reveal translucent colored droplets.
  Grain is anchored in normalized artwork coordinates and filtered for the current
  pixel size. Grain 0 disables all texture, including changes to Grain size.
- **Canvas:** four aspect ratios, custom dimensions and PNG 1× / 2× / 3×.
  The maximum is 8192 px per side and 32 megapixels, also bounded by GPU limits.

Presets, share links, color pickers, slider editing, panel collapse, history,
keyboard help and export feedback use `infra/framework/src/index.js`.
Undo/redo: Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z. PNG: Cmd/Ctrl+E.
J reveals JSON import/export; saved JSON is a versioned Grainy Land document.
UI language follows the existing English YF interface.

## Architecture and future work

`document.js` owns normalization, limits and the versioned JSON format.
`scene.js` generates normalized geometry independently of color and resolution.
Scene version 3 uses six independent surfaces: distant terrain, two side banks,
a basin, a foreground fold and a near light plane. Each has separate elevation,
slope, diffusion and local illumination. Seeded two-dimensional deformations
let surfaces curl around one another; a smooth union creates the foreground pocket
and its open tail. Color fields follow those deformations, with localized highlights,
reflected neighboring colors and fine spray. Abstract mode uses independent rotated
fields and ignores the disabled horizon and relief settings. These normalized
fields provide a place to introduce user-painted shapes later.
`materialColors` derives warm crests, cool reflected light and earth half-tones in
OKLab from the editable anchors. `adjacentColors` adds neighboring endpoints in
OKLCH, reducing chroma to fit RGB without shifting hue through channel clipping.
Independent low-frequency color fields distribute those tones within the surfaces.
Color changes never reroll geometry. Manual
intermediate colors can be added without changing the scene model.

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

Painting, direct shape editing, manual intermediate colors, animation and
print color management are deferred. Current output is RGB PNG; future print
support can retain normalized scenes and introduce physical dimensions, output
profiles and tiled rendering. Current seeds are tied to scene version 3. Existing v1 settings JSON still loads,
but renders with the new geometry and material; it does not reproduce images
from previous scene versions. The
original 20-image review is preserved in `tests/reviews/pigment-20`.

## Verification

`npm run test:grainy` checks reference colors, round trips, sanitization,
geometry independence, deterministic seeds, automatic half-tones and export limits.
Open `tests/renderer.html` on the same local server for 47 real GPU/PNG checks
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

New settings retain JSON schema v1 compatibility. Missing fields get safe defaults;
the preset migration fills missing tone fields in known shipped presets marked
`seeded` and updates the cached built-in Ember to the current default settings.
Saved user presets are preserved. New parameters are
included in preset saving, undo/redo, share links and JSON round trips.

The repository-wide directory-coverage check currently stops at the unrelated,
existing, unregistered `grid_generator_02` directory. No exception was added
to hide it and no historical migration evidence was rewritten.
