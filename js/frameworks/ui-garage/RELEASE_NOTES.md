# UI Garage 2.0.0

UI Garage 2.0.0 is the current clean distribution for new SVG and Canvas
generators. Copy the complete folder to `infra/ui-garage/` in another
repository; create each tool as a sibling at the repository root. Nothing in
this distribution loads or modifies the project from which it was prepared.

This major release aligns the portable package with the current shared UI:
pill toggles, segmented choices, 30 px color triggers, vector chevrons, panel
actions, button-weight policy, stable preset chrome, panel scrollbars and
promise-owned export feedback. `ToolUiController` now owns command labels,
availability, shortcuts and execution from one action list. `GeneratorHost`
provides an explicit adapter for an existing page without app-name branches;
new tools should normally start with `defineTool`.

Lifecycle work includes safe DOM readiness and BFCache restore, replacement of
observed controllers, reusable file intake with reset and preservation of the
previous source during an interrupted replacement. PNG export is not reported
as successful until encoding and download dispatch finish. Slider keyboard
steps are exact additions/subtractions: fine step with Arrow and coarse step
with Shift+Arrow.

The release includes the stable public JavaScript API, CSS, local CoFo Sans
fonts, vendor libraries and licenses, SVG and Canvas reference applications,
Component Lab, clean-room generator proof, non-destructive scaffolder, 139
Node regression tests, per-file SHA-256 manifest and release verification.

Run `npm run gate:framework-extraction` after every copy. Verify the archive
with the SHA-256 file distributed beside it. See `PROJECT_LAYOUT.md` before
creating tools and `MIGRATION_GUIDE.md` before replacing an older copy.
