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

## Remaining sequence

1. Split `ObjectDragController` into pointer events, drag state and cross-surface transfer.
2. Finish separating `GridSettingsController` commands from UI synchronization.
3. Split `TextEditorPositionController` input binding from surface-aware constraints.
4. Unify `PanelManager` and `PanelUiController` lifecycle responsibilities.
5. Split `SurfaceManager`, `SurfacePanelController` and `SurfaceRenderer` state/UI/rendering.
6. Simplify `DOMCache`, static configuration and remaining large services.
7. Reduce `script.js` to the application composition root and remove remaining legacy paths.
8. Run final import/export, preset, Chrome/Safari-compatible UI and Illustrator SVG/PDF regression.

Every stage ends with focused unit tests, the complete test suite and browser smoke.
