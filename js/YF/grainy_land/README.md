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
Its localized fields provide a place to introduce user-painted fields later.
`paletteLUT` derives intermediate shades in OKLab from the four anchors; manual
stops can be added to a future document version without changing geometry.

`render.js` owns the app-specific WebGL renderer, contour light and grain.
The shared CanvasTarget owns viewport zoom/pan. PNG is rendered afresh at the
requested resolution, without capturing UI or enlarging the preview bitmap.

Painting, direct shape editing, manual intermediate colors, animation and
print color management are deferred. Current output is RGB PNG; future print
support can retain normalized scenes and introduce physical dimensions, output
profiles and tiled rendering. Current seeds are tied to scene version 1.

## Verification

`npm run test:grainy` checks reference colors, round trips, sanitization,
geometry independence, deterministic seeds, automatic half-tones and export limits.
Open `tests/renderer.html` on the same local server for 18 real GPU/PNG checks
and generated images. This fixture is separate from the tool's user interface.

The dated evidence is in `tests/acceptance.json`.
The repository-wide directory-coverage check currently stops at the unrelated,
existing, unregistered `grid_generator_02` directory. No exception was added
to hide it and no historical migration evidence was rewritten.
