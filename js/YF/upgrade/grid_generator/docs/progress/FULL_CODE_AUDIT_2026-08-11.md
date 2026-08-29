# Full code audit — 2026-08-11

Historical snapshot. The post-refactor follow-up is
`FULL_CODE_AUDIT_2026-08-12.md`.

## Scope

The audit covered the complete application entry path, all source modules,
markup, styles, presets, export/import code, tests, project scripts,
documentation and tracked repository artifacts.

Current size:

- 88 JavaScript files in the runtime graph: `script.js`, `GridGenerator.js` and
  86 modules under `src/` (10,288 source lines under `src/`).
- `GridGenerator.js`: 579 lines; `script.js`: 25 lines.
- `index.html`: 1,089 lines, 210 unique ids, no duplicate ids.
- `style.css`: 2,712 lines and about 292 selector groups.
- 43 Node test files with 130 tests, plus a 64-check browser smoke suite.
- 19 checked-in preset JSON files plus their generated manifest.

## Healthy foundations

- All 88 runtime modules are reachable from the application entry point.
- There are no broken relative imports, dependency cycles or orphan runtime
  modules.
- JSON preset files remain the application source of truth. Serialization and
  current/legacy deserialization have one production path.
- Rendering, side geometry, object persistence, history, panels, preset IO and
  export have dedicated owners instead of living in one script.
- `script.js` is now only the bootstrap; `GridGenerator.js` is the composition
  root.
- The current unit/regression suite and deterministic browser smoke suite cover
  the main editing, side-surface, rotation, preset and export flows.
- HTML ids are unique, and the DOM cache derives its index from markup instead
  of maintaining a second manual id list.

## Stabilization completed during this audit

- Added explicit final regression coverage for PDF dimensions/outlining, SVG
  file serialization and delayed Blob URL cleanup.
- Fixed `BrowserFileTransfer` calling an extracted browser timer with an invalid
  receiver.
- Fixed partial PDF dependency initialization: an existing jsPDF no longer
  causes a missing svg2pdf library to be treated as loaded.
- Reduced the old entry script to bootstrap and moved UI synchronization,
  render scheduling and zoom-toolbar ownership into separate modules.
- Removed the unused alternative `Settings.toJSON/fromJSON` serialization path.
- Made the Node manifest generator the only implementation. The shell wrapper
  delegates to it, and the divergent Python generator was removed.
- Replaced the obsolete root README with current startup, architecture, test and
  limitation documentation.

## Findings and recommended order

### 1. Sanitize imported and uploaded SVG

`GraphicsRenderer` inserts `block.svgContent` with `innerHTML`. The file loader
normalizes paint but does not strip scripts, event-handler attributes,
`foreignObject`, external references or CSS URLs. Git presets are trusted, but
the editor also accepts local JSON and SVG files. Add one sanitizer at the
ingress boundary and regression fixtures for hostile SVG before expanding
import functionality.

### 2. Replace manual cache-busting

Version query strings are distributed through the import graph. A missed query
update produced a real stale-module runtime failure during this stabilization.
Use either a small build step with hashed assets, or a documented zero-build
server policy that reliably revalidates the complete module graph. Do not keep
manually incrementing dozens of import URLs.

### 3. Make export dependencies local and deterministic

PDF export loads jsPDF and svg2pdf from two public CDNs; text outlining loads
opentype.js from a third-party CDN. This requires network access and has no local
version lock at runtime. Vendor the three exact browser builds (or bundle them),
then test offline export. Also reset failed loader promises so a transient load
failure can be retried without reloading the app.

### 4. Define and validate the preset schema

The current organized format uses version `1.2`, but import detection is shape
based and values are not validated against a schema. Add a formal schema,
bounded numeric validation and named migrations. Decide how long both the
organized legacy format and untouched flat documents must remain supported.
Keep the preset schema version separate from the application/package version.

### 5. Narrow the composition contracts

The original monolith is gone, but `GridGenerator.js` still constructs and wires
many controllers, and a number of controllers receive the entire host object.
Introduce narrow dependency objects for the busiest controllers and a shared
`dispose()` lifecycle for listener-owning components. Prioritize application
events, grid commands, preset application and object editors. Add direct tests
for the new UI synchronizer, render scheduler and zoom toolbar.

### 6. Split markup and styles by component

`index.html` and `style.css` are now the largest remaining monoliths. CSS has
eight repeated selector groups (`.panel-content` appears four times), eleven
`!important` declarations and several independent scrollbar rule blocks. Move
tokens and reusable controls first, then panel-specific markup/styles. Preserve
the current static deployment and verify panel overflow at the minimum supported
viewport after every extraction.

### 7. Complete real compatibility acceptance

The automated browser suite is Chromium-compatible and currently exercises 64
checks. It is not an actual Safari run, and generated SVG/PDF files have not been
opened by an automated Illustrator workflow. Maintain a small manual release
matrix for Chrome, Safari and Illustrator until those environments can be added
to CI. Include canvas rotation/dragging, side grids, JSON round-trip, outlined
SVG and exact-size PDF.

### 8. Repository and documentation hygiene

The repository currently tracks `.DS_Store` files and `server.log`, and has no
root `.gitignore`. There are 62 files under `docs/`, mostly historical progress
notes. Add ignore rules, remove generated OS/log artifacts and consolidate
history into an archive or one changelog. Application/package/changelog/schema
versions also need an explicit convention.

### 9. Lower-priority performance work

`ExportDocumentBuilder` fetches design-kit SVG references for each relevant
export. Cache parsed immutable assets. Profile before optimizing canvas work;
render scheduling is already centralized, so measurement should precede further
render changes.

## Proposed next delivery sequence

1. SVG ingress sanitizer and malicious-file tests.
2. Cache/build decision and implementation.
3. Local deterministic export dependencies and offline regression.
4. Preset schema, validation and explicit migration policy.
5. Narrow controller dependencies and listener lifecycle.
6. HTML/CSS component extraction with panel-layout visual checks.
7. Repository/document cleanup and release checklist.

Items 2, 4 and 7 require product/workflow decisions before implementation.
