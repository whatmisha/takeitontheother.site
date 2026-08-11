# Current stabilization and refactoring plan

Updated: 2026-08-11.

JSON files in `presets/` remain the source of truth. Refactoring must preserve
Chrome/Safari behavior, Illustrator-compatible export, canvas-only rotation,
surface-local grids and cross-surface object dragging.

## Completed

- Regression foundation and deterministic browser smoke suite.
- Surface orientation, visibility and independent grid model/UI/import/export.
- Canvas rotation, screen-axis panning, zoom/Fit and rotated object dragging.
- Grid rendering, settings, sliders, presets and text-editor decomposition.
- SVG/PDF/JSON export service decomposition.
- Objects navigator and object editor panel decomposition.
- Preset format serialization and current/legacy deserialization split.
- Snapshot history and semantic action transaction split.
- Text block render-model and SVG view split.
- Object drag pointer binding, shared drag state and text resize split.
- Grid mutation commands separated from Grid DOM synchronization.
- Text position bindings separated from surface-aware constraints.
- Panel registry, lifecycle and shared pointer-drag controller unified.
- Surface persistence, geometry, panel commands, layers and grid painting split.
- DOM indexing, generated slider definitions and default settings simplified.
- `script.js` reduced to bootstrap; application composition moved to
  `GridGenerator.js`.
- Application UI synchronization, render scheduling and zoom toolbar split into
  dedicated owners.
- Unused alternate settings serialization and the divergent Python preset
  manifest generator removed.
- Final SVG/PDF/JSON, preset, file-transfer and browser regressions completed.
- Full code, markup, style, test, tooling and repository audit completed.

## Recommended next sequence

1. Sanitize imported/uploaded SVG at the ingress boundary.
2. Replace distributed manual module cache-busting.
3. Make PDF and text-outline dependencies local and offline-capable.
4. Add a versioned validated preset schema and explicit migrations.
5. Narrow remaining whole-host controller dependencies and add disposal
   lifecycle.
6. Split the monolithic HTML/CSS into stable panel/control components.
7. Complete Safari/Illustrator acceptance and repository/documentation cleanup.

The evidence, risks and decision points are recorded in
`FULL_CODE_AUDIT_2026-08-11.md`. Every implementation stage must end with focused
unit tests, the complete test suite and browser smoke.
