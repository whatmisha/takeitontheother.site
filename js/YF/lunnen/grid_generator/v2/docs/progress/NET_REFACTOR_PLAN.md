# Packaging net refactor — plan and progress

Started: 2026-08-23. Completed: 2026-08-23.

This is the `v2` line of work: moving the application from a fixed
front-plus-four-sides box to full packaging nets (dielines) with an arbitrary
number of planes, editable both centrally and individually.

`v2/` is self-contained. It can replace the project root as-is; its development
server runs on `127.0.0.1:8100` (preview on `8101`) so it does not collide with
the root project on `8000`.

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
- **Named variables.** `W`/`H`/`D` mirror the three dimension sliders; any other
  variable is owned by the document.
- **`fit` dimensions.** A plane can inherit the length of the edge it attaches
  to, which keeps a wall flush with its neighbour.

Two orderings are kept apart on purpose:

- Placement order follows the attachment tree.
- Stacking order (`stackOrder`) follows the document's plane array and is both
  the emission order and the hit-test priority order.

## Phase 0 — characterization tests — done

- `tools/generate-net-golden.js` writes `tests/fixtures/net-golden.json`.
- `tests/net-golden.test.mjs` verifies the sources against it.
- `npm --prefix tools run golden:check` is part of `source:check`.

## Phase 1 — plane model under the existing API — done

- `src/surfaces/PlaneDefinition.js` — plane vocabulary, normalization,
  `createBoxNet`.
- `src/surfaces/NetLayoutEngine.js` — pure placement, artboard bounds, content
  transforms, local mapping and hit-testing.
- `SurfaceGeometry.js` is a thin facade with unchanged signatures.
- `SurfaceManager.getNet` / `getNetLayout` / `surfaceAtPoint`.

## Phase 2 — general artboard and plane-driven rendering — done

- `CanvasRendererController.calculateLayout` scales by the net's union bounds.
- `calculateArtboard` gives the export the same millimetre bounds.
- `drawBoxSurfaces` and `drawLabels` iterate the net's planes.
- `SurfaceRenderer.drawPlaneLayers` iterates every plane.

## Phase 3 — plane document store — done

- `src/surfaces/PlaneDocumentStore.js` replaces the fixed five-surface
  `SurfaceStateStore`. The document lives in `settings.planeDocument`.
- Planes can be added, removed, reordered and edited individually.
- `W`/`H`/`D` are reserved variables wired to the dimension sliders.
- Legacy five-key `surfaceSettings` maps are still accepted on import.

## Phase 4 — per-plane grid resolution — done

- `src/surfaces/PlaneGridResolver.js` resolves inherited vs own grid contexts.
- Side planes re-derive column and row counts from their local size while
  keeping the master module.
- `tests/plane-grid-resolver.test.mjs` covers the inheritance heuristics.

## Phase 5 — preset format 2.0 and migration — done

- `schemas/preset-2.0.schema.json` defines the net document in presets.
- `src/preset/PresetMigrations.js` lifts 1.2 files to 2.0 on read.
- All 19 source-of-truth presets migrated to version 2.0.
- Objects carry `plane` instead of `surface`.
- `tests/preset-migration.test.mjs` and `tests/preset-schema.test.mjs`.

## Phase 6 — unified render pipeline — done

Every plane, including the root, renders through the same clipped and
transformed layer pipeline in both the editor and the export:

- Editor: `CanvasRendererController.render` → `drawPlaneLayers`.
- Export: `ExportDocumentBuilder.buildDocument` → `drawPlaneLayers`.
- The separate `drawFrontGrid` / `drawFrontObjects` / `drawSideLayers` paths
  are removed.

Root-plane objects now receive an explicit grid context from
`getGridContext(rootId)` instead of implicit global settings.

## Phase 7 — plane management UI — done

- `SurfacePanelController` lists every plane dynamically, supports add/remove,
  visibility, rotation, grid mode, attachment and named variables.
- `SurfacePanelCommands` wraps mutations with undo/redo.
- Canvas click selects the plane under the cursor.
- `tests/surface-panel-controller.test.mjs`.

## Phase 8 — object and navigator integration — done

- Text and graphics blocks use `planeId` (preset field: `plane`).
- `SurfaceCoordinateMapper.resolvePlaneId` resolves object placement.
- Object editors populate plane `<select>` from the live document.
- Cross-plane drag and relative-width transfer work through the mapper.

## Invariants held

- All 214 tests pass, including golden, migration, panel and architecture tests.
- `npm --prefix tools test` (public runtime check plus tests) is green.
- Preset format 1.2 round-trip through migration, Illustrator-compatible export
  and surface-local grids are unchanged for the default five-plane box.
- A seven-plane tuck-end carton renders through the production renderer with no
  renderer change (`tests/net-render-generalization.test.mjs`).

## Deferred (separate iteration)

- **Dieline-specific tooling** — glue tabs, fold lines, cut/crease layers.
- **Overlap semantics UI** — deliberate plane stacking beyond the current
  document-order convention.
- **Multi-select grid editing** — editing several planes' grids at once.
