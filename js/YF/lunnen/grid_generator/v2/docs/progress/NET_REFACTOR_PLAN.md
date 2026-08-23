# Packaging net refactor — plan and progress

Started: 2026-08-23. This is the `v2` line of work: moving the application from
a fixed front-plus-four-sides box to full packaging nets (dielines) with an
arbitrary number of planes, editable both centrally and individually.

`v2/` is self-contained. It can replace the project root as-is; its development
server runs on `127.0.0.1:8100` (preview on `8101`) so it does not collide with
the root project on `8000`.

## Why the old model blocked this

The five surfaces were not data — they were spread across the code as
assumptions:

- `SurfaceGeometry` hardcoded five rectangles in a cross.
- `SURFACE_IDS` / `SIDE_SURFACE_IDS` fixed the vocabulary in state, rendering,
  hit-testing and the UI.
- The artboard was `frontWidth + 2 * thickness` by
  `frontHeight + 2 * thickness`, which only describes a cross.
- Preset schema 1.2 stores `surfaces` as a fixed-key object with an enum of
  five `surfaceId` values.
- The root panel rendered on a different path than the sides: absolute
  coordinates and no grid context, versus a transformed and clipped group.

## Target model

A net is a tree of planes plus named dimension variables:

```
NetDocument {
  rootId, variables: { W, H, D, ... }, masterGrid, planes: [Plane]
}
Plane {
  id, name, kind: panel|flap|glue,
  size: { width, height },        // mm | variable name | 'fit'
  attach: { to, edge, align, offset } | null,
  contentRotation: 0|90|180|270,
  grid: { mode: inherit|own, own? },
  visible
}
```

Three properties make this work:

- **Relative attachment.** A plane is positioned by a parent edge, not absolute
  coordinates, so changing one dimension reflows the whole net.
- **Named variables.** `W`/`H`/`D` give central editing; a plane that overrides
  a dimension gives individual editing.
- **`fit` dimensions.** A plane can inherit the length of the edge it attaches
  to, which is what keeps a wall flush with its neighbour.

Two orderings are kept apart on purpose:

- Placement order follows the attachment tree.
- Stacking order (`stackOrder`) follows the document's plane array and is both
  the emission order and the hit-test priority order.

## Phase 0 — characterization tests — done

The old behavior is frozen before it is touched.

- `tools/generate-net-golden.js` writes `tests/fixtures/net-golden.json`:
  editor layout scaling, export artboard strings, every surface rectangle,
  transform and local-point mapping at all four rotations, 102 hit-test probes
  per layout case, and resolved geometry plus grid contexts for all 19 presets.
- `tests/net-golden.test.mjs` verifies the sources against it.
- `npm --prefix tools run golden:check` is part of `source:check`, so a stale
  golden fails the build. Regenerate deliberately with `run golden`.

The net was verified to catch regressions: a 0.5 mm shift of one surface fails
three of the six golden tests.

## Phase 1 — plane model under the existing API — done

- `src/surfaces/PlaneDefinition.js` — plane vocabulary, normalization and
  `createBoxNet`, which builds the legacy cross as one ordinary net.
- `src/surfaces/NetLayoutEngine.js` — pure placement, artboard bounds, content
  transforms, local mapping and hit-testing. Broken topology (unknown parent,
  cycle, duplicate id, missing root) is reported in `issues` rather than thrown.
- `SurfaceGeometry.js` is now a thin facade over the engine with unchanged
  signatures. `SurfaceManager` gained `getNet` / `getNetLayout`, and
  `surfaceAtPoint` resolves through the engine.

Byte-identical output: the golden passes unchanged, including exact SVG
transform strings.

## Phase 2 — general artboard and plane-driven rendering — done

- `CanvasRendererController.calculateLayout` scales by the net's union bounds
  instead of the cross formula, and accepts a `net` for non-cross documents.
  `calculateArtboard` gives the export the same millimetre bounds.
- `drawBoxSurfaces` and `drawLabels` iterate the net's planes. The five
  hardcoded rectangles and five hardcoded label positions are gone; labels are
  centred per plane and rotated when a plane is taller than wide.
- `SurfaceRenderer.drawPlaneLayers` iterates the net; the hardcoded
  `sideSurfaces` list is removed from the renderer and from the composition
  root.

`tests/net-render-generalization.test.mjs` renders a seven-plane tuck-end carton
(four walls, glue strip, two flaps) through the production renderer with no
renderer change, and scales it by its own 580×460 artboard.

## Known follow-ups

- **The root panel still renders on its own path.** `drawSideLayers` skips it
  deliberately. Unifying it means routing root text through
  `getGridContext('front')` instead of the implicit global settings, which can
  move text; that needs render-level characterization first.
- **`SurfaceStateStore` still normalizes to exactly five surfaces**, so the net
  cannot yet gain a sixth plane from state or a preset. The renderer and engine
  are ready; the state layer and preset schema 2.0 are next.
- **`getNetLayout` rebuilds the net from the three scaled layout scalars.** Once
  the document carries the net, the layout should carry it too.
- **Overlap semantics** for deliberately stacked planes are settled together
  with plane management UI.

## Invariants held so far

- All 189 tests pass, including the 19-preset golden and architecture tests.
- `npm --prefix tools test` (public runtime check plus tests) is green.
- Preset format 1.2 round-trip, Illustrator-compatible export and
  surface-local grids are unchanged.
