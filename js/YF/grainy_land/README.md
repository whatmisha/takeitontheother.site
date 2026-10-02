# Grainy Land

Static landscape and abstract field generator using the shared YF framework.
Open `grainy_land/` through the YF development server. No build step or remote
runtime dependencies are needed. Rendering requires WebGL.

## Controls

- **Composition:** Landscape / Abstract, scale, complexity, flow, horizon,
  relief and seed. Generate (R) changes only the seed.
- **Color & light:** Pigment / Ember palettes and four editable base colors.
  Both reference palettes start with background **#2353DB**.
- **Softness** adjusts the color transitions and silhouette.
- **Glow** controls luminous contours; **Halo width** controls their surrounding
  aura. **Contrast** changes tonal separation independently.
- **Grain / Grain size:** pigment intensity and particle scale. Grain is anchored
  in normalized artwork coordinates, independent of viewport zoom or export size.
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
Scene version 2 uses six independent surfaces: distant terrain, two side banks,
a basin, a foreground fold and a near light plane. Each has separate elevation,
slope, diffusion and local illumination. Abstract mode uses independent rotated
fields and ignores the disabled horizon and relief settings. These normalized
fields provide a place to introduce user-painted shapes later.
`materialColors` derives warm crests, cool reflected light and earth half-tones in
OKLab from the editable anchors. Color changes never reroll geometry. Manual
intermediate colors can be added without changing the scene model.

`render.js` composites the surfaces with local tonal relief, variable edge
diffusion, contour light and grain at multiple scales. Pigment includes colored
deposits and clustered density rather than only additive white noise.
The shared CanvasTarget owns viewport zoom/pan. PNG is rendered afresh at the
requested resolution, without capturing UI or enlarging the preview bitmap.

Painting, direct shape editing, manual intermediate colors, animation and
print color management are deferred. Current output is RGB PNG; future print
support can retain normalized scenes and introduce physical dimensions, output
profiles and tiled rendering. Current seeds are tied to scene version 2. Existing v1 settings JSON still loads,
but renders with the new geometry; it does not reproduce the old v1 image. The
original 20-image review is preserved in `tests/reviews/pigment-20`.

## Verification

`npm run test:grainy` checks reference colors, round trips, sanitization,
geometry independence, deterministic seeds, automatic half-tones and export limits.
Open `tests/renderer.html` on the same local server for 26 real GPU/PNG checks
and generated images. This fixture is separate from the tool's user interface.

Initial acceptance is in `tests/acceptance.json`; scene-v2 evidence is in
`tests/reviews/pigment-v2/acceptance.json`. The latter folder contains the same
20 seeds, full PNGs, reference details, a before/after sheet and material samples.
To regenerate that review, run:

```sh
python3 grainy_land/tests/review-server.py --review pigment-v2 --port 8021
```

Then open `/grainy_land/tests/reviews/pigment-v2/` and use its generate button.
The review server binds to localhost and saves only named review artifacts.
The repository-wide directory-coverage check currently stops at the unrelated,
existing, unregistered `grid_generator_02` directory. No exception was added
to hide it and no historical migration evidence was rewritten.
