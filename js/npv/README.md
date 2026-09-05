# Sphere + Flat

Two related parametric ellipse-pattern generators. `index.html` contains the spherical tool and `flat.html` contains the planar tool. The application is entirely contained in the root HTML files, `styles/`, `src/`, and `tests/` paths; it does not import anything from `framework/`, `sample/`, or `references/`.

## Local use

```sh
npm run serve
```

Open `http://127.0.0.1:8000/`.

Use the `Sphere` and `Flat` tabs beside `←YF Tools` to switch generators.

## Geometry model

- `Ellipses` is the number of simultaneously visible marks.
- Every density slot owns two unique antipodal marks, so the back half of the sphere exists and is revealed by rotation.
- The default `Packed` preset uses 15 antipodal pairs, Perspective 50, Coverage 100%, and a 4 px no-overlap gap.
- `Packed` derives each mark radius from the nearest boundary of its local spherical cell. At the default 30 physical marks it uses an exact icosidodecahedral lattice, so every nearest-neighbor gap is identical and every mark has the same size. Other densities use the relaxed spherical lattice and make the small local size corrections forced by spherical topology.
- `Tessellated` relaxes the centers into a near-triangular spherical lattice (the spherical analogue of a hexagonal plane pattern) while retaining one global diameter. `Progressive` preserves existing centers while new ones fill the largest gaps, which is best for Grow animation. `Rings` deliberately keeps visible latitude bands for a more constructed graphic rhythm.
- The first 18 physical marks form a regular antiprism: every mark has exactly the same nearest-neighbor distance. Additional antipodal pairs use deterministic farthest-point insertion and occupy the largest remaining geodesic gaps.
- A mark is a sampled geodesic disk on the sphere, not a flat ellipse touching it at one point. Its projected vector boundary wraps around the surface and is clipped by the physical silhouette.
- All marks conform fully to the spherical surface. `Packed` uses the local cell radius; the other distributions use one physical angular radius.
- Perspective uses a close camera with automatic reframing. The upper end is deliberately extreme, while the complete sphere remains inside the artboard.
- Front-facing marks are always opaque. `Back side` renders only the occluded surface at a fixed 20% opacity.
- Guides render rotating front and back latitude/longitude wireframes using the same perspective projection as the marks.
- Relative overrides multiply physical angular size. Fixed overrides convert the requested front-on pixel diameter into a physical angular size.
- `Coverage` replaces `Diameter` in Packed because the local cells, not a global pixel size, determine the marks. With `No overlap` enabled its honest maximum is 100%; disabling it exposes controlled overlap values.
- Slider ranges stay fixed. In the other distributions, a conflicting density, sphere, or gap change moves the current `Diameter` down to the nearest renderable value instead of changing the end of its scale. The same rule applies to other dependent controls such as Packed coverage.
- `No overlap` constrains the undistorted base pattern. Deliberate local transforms and `Magnet growth` are applied afterward, so they do not stall against an invisible packing ceiling.
- `Magnet growth` only enlarges marks inside its green spherical field; it never moves their centers. Dependent field controls are disabled while growth is zero, and manual coordinates remain visible but inactive while the field follows the cursor.
- Magnet controls live in their own bottom-right panel; Transform contains rotation only.

All numeric slider values are editable text fields. Enter or blur applies a typed value, Escape restores it, arrows step by one slider increment, and Shift+arrows step by ten increments.

## Flat model

- `Basic` enlarges the ellipse under the cursor and spreads a distance-based influence to its neighbors.
- `Maximum size`, `Field radius`, and `Falloff curve` separately control the peak, affected area, and the soft/linear/tight shape of that transition.
- `Person` snaps the field to a vertical pair whose radii and center spacing use the exact proportions from `references/person_01.svg`, independent of the base ellipse aspect ratio.
- Person reverses the field: the reference icon remains fixed while surrounding ellipses shrink toward `Minimum size`. `Field radius` and `Falloff curve` control the complete transition back to the regular pattern.
- Person targets use a short temporal interpolation, so entering and leaving a snapped pair never changes its size in a single frame.
- `Canvas width/height` controls the artboard from 80 to 1920 px; the default remains 640×480. The lattice lives in a permanent center-origin coordinate space, so resizing reveals or clips cells on every edge without changing any existing mark coordinates. `Spacing X/Y` remains center-to-center.
- `Paired tiles` offsets complete two-row bands instead of individual rows. This produces a brick/hex-like rhythm while keeping every potential head exactly above its shoulders.
- Click the artboard to pin any number of field points while retaining the live cursor field. Every point freezes its mode, radius, falloff, and size limit; later control changes apply only to the live field and future pins. Each point can be disabled or deleted from its coordinate pill.
- Field coordinates stay editable while `Follows cursor` is active and track the pointer live. They are signed absolute pixel coordinates in the permanent center-origin space. Resizing changes only their projection into the SVG, so their values and their position relative to the pattern remain unchanged.
- Person pins begin with `P`. With `Guide` enabled, field outlines are dashed by default and become solid and highlighted while their pinned-field toggle is hovered or focused.
- `[` and `]` change the field radius by 5 px; holding Shift changes it by 15 px.
- Flat has its own undo/redo history, share links, multi-field guide, zoom/pan, and clean SVG/2× PNG export at the current canvas dimensions.

## Export

- Static: clean SVG and 1080×1080 PNG.
- Grow mode: 1080×1080, 60 fps MP4/H.264 and transparent PNG sequence ZIP.
- Animation export runs in a worker, replaces the export buttons with progress, and supports cancellation.

The temporary play button beside the zoom control uses the current preset's saved `rotationAnimation` settings (`axis`, `degrees`, `duration`, and `easing`), then returns to the exact stored view without changing scene settings, history, or preset state. Defaults and `Iconic Five` use one three-second 360° X turn; `Person Five` uses a three-second 180° X turn. Both use soft quintic acceleration and deceleration, with no secondary-axis wobble. Transform sliders display the effective angles throughout the preview. Rotation animation settings are included in JSON exports, share links, history, sessions, and saved presets; older JSON files receive the default animation settings when loaded.

`Person Five` is the initial preset. When this default changes, an older modified browser session is preserved as a uniquely named `Recovered session` user preset before the new default opens. Transform uses screen-oriented coordinates: Rotation X turns the sphere horizontally, Rotation Y turns it vertically, and Rotation Z spins it in the canvas plane. Existing JSON and browser states from the earlier world-axis mapping are converted on load and resaved with `rotationCoordinateMode: "screen"`.

`Reset position` at the bottom of Transform returns all three rotation axes to 0° in one undoable action.

When `Field follows cursor` is active, the disabled X/Y controls display the live field coordinates. Clicking the artboard fixes the field at that point, turns cursor following off, and re-enables manual X/Y editing. Dragging still rotates the sphere without fixing the field.

The Selection panel and canvas mark picking are currently inactive. The dormant sizing implementation remains isolated in the source so it can be restored with the panel later.

Run the focused regression suite with `npm test`.
