# Changelog

## 2.0.0 — 2026-09-23

- Added `ToolUiController` and promise-owned export feedback with one explicit
  action descriptor for labels, availability, shortcuts and execution.
- Added a portable, configurable `GeneratorHost` adapter with no tool-name or
  source-project branches, plus BFCache-safe controller lifecycles.
- Brought panel actions, pill toggles, segmented choices, color triggers,
  vector collapse icons, dark-button weights and feedback states into the
  shared UI contract and Component Lab.
- Made slider Shift+Arrow steps exactly additive; decimal `0.25 + 0.1` is now
  `0.35` instead of snapping to a coarse grid.
- Made PNG success wait for encoding and download dispatch, preserved the
  previous file-intake source across interrupted replacement, and added reset.
- Defined the portable repository layout: one copied framework at
  `infra/ui-garage/`, with independent tool directories at the repository root.
- Updated the clean scaffolder to create current pill controls and explicit
  export commands without importing framework internals.

## 1.0.2 — 2026-09-08

- Added integer and decimal two-handle range sliders to Component Lab.
- Documented and regression-tested fine, coarse Shift, Home/End and
  opposite-handle keyboard constraints for sliders.
- Added accessible names and dynamic ARIA bounds to range-slider handles.
- Kept the Component Lab dialog and ActionDock previews contained, and removed
  the duplicate shortcut-help trigger.

## 1.0.1 — 2026-09-08

- Restored the canonical vector chevrons and share-link icon across Component
  Lab, both starters and the clean-room proof.
- Added explicit icon geometry and alignment rules so browser font metrics can
  no longer distort toolbar or panel controls.
- Prevented ActionDock shadows from darkening adjacent buttons and restored the
  primary/secondary action hierarchy used by the reference tools.
- Added complete portable defaults for file intake and clear actions, plus the
  missing native-dialog open state.
- Expanded the visual contract to cover preset glyph geometry, sharing and the
  dialog shell, with source-level regression checks for all corrected defects.

## 1.0.0 — 2026-09-06

- Established the stable public API, lifecycle, storage and CSS contracts.
- Added the complete SVG and Canvas starters plus the Ribbon Field clean-room
  proof built without any source application.
- Added Component Lab state ownership, computed-style comparison and keyboard
  walkthrough coverage.
- Added optional namespaced IndexedDB draft recovery, release verification,
  migration guidance and a single extraction gate.
- Proved that the copied folder has no runtime or source dependency on its
  original repository and that the original applications do not depend on it.

## 0.1.0-dev.5 — 2026-09-06

- Completed FX-06 with the full public-API Canvas starter: deterministic
  DPR-aware rendering, zoom/pan, asset and JSON intake, history, presets, share,
  responsive behavior, pixel-safe PNG export and an SVG export hook.
- Made the canonical export shortcut configurable as PNG for Canvas tools.
- Added deterministic raster/vector model tests and completed the clean-start
  documentation for both full starters.

## 0.1.0-dev.4 — 2026-09-06

- Added the full public-API SVG starter with deterministic rendering, controls,
  panels, history, presets, share, validated JSON round-trip, file intake,
  responsive behavior and SVG/PNG/PDF export.
- Added automatic starter-boundary and unique-storage checks to the portable
  verifier.

## 0.1.0-dev.3 — 2026-09-06

- Completed the autonomous portable-folder gate.
- Added real-browser same-origin, network and SVG/PNG/PDF/JSON artifact smoke
  checks that run after copying the folder.
- Added a non-destructive public-API SVG/Canvas clean-tool scaffolder.
- Documented supported browsers and static-server requirements.

## 0.1.0-dev.2 — 2026-09-05

- Added exact stable and optional public API snapshots plus ownership metadata
  for every source module.
- Made application and controller teardown symmetric and re-initializable.
- Added cancellation and cleanup for active exports, imports, timers and Blob
  URLs.
- Removed side-effect auto-init entrypoints from the portable package.
- Removed remaining application-specific comments and CSS names.

## 0.1.0-dev.1 — 2026-09-05

- Created the initial self-contained UI Garage candidate.
- Added shared runtime source, CSS, local fonts, vendor dependencies, tests and
  the Component Lab.
- Made UI summaries, shortcut copy and selectors explicit configuration.
- Removed stage query strings from internal ES module imports.
- Made preset storage namespaces mandatory.
- Added version, manifest and portable-boundary verification metadata.
