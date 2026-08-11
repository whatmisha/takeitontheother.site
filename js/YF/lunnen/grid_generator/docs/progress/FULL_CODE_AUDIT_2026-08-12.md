# Full code audit — 2026-08-12

## Scope and verification

The follow-up audit covered the application entry point, every runtime module,
markup, styles, presets, schema, import/export paths, tests, build tooling and
active documentation after the legacy removal and root reorganization.

Current baseline:

- 93 runtime modules: `script.js` plus 92 files under `src/`, including the
  generated standalone preset validator.
- `src/core/GridGenerator.js` is 604 lines.
- `index.html`: 1,096 lines and 210 unique ids; no duplicate ids.
- `style.css`: 2,711 lines, 11 `!important` declarations and four separate
  scrollbar families.
- 46 Node test files / 135 passing tests and a 64-check browser smoke suite.
- 19 validated source-of-truth preset JSON files, all version 1.2.
- Vite production build: 360 transformed modules; npm audit: 0 vulnerabilities.

Static graph verification found no broken relative imports, dependency cycles
or orphan source modules. `node --check` passed for every runtime file.

## Resolved since the previous audit

- User-provided SVG now passes a shared sanitizer at file/JSON ingress and again
  before rendering. Executable nodes, handlers, animation, external references
  and unsafe CSS URLs are removed.
- Manual version query strings were removed from the module graph. Vite owns
  development transforms and production asset hashing.
- PDF and text-outline dependencies are pinned locally and loaded only when
  needed. Failed lazy loads are retryable.
- Preset import now rejects flat, partial and pre-1.2 documents explicitly.
  Every checked-in preset was migrated to the complete current contract.
- SVG files start with a UTF-8 BOM and explicit XML declaration. The supplied
  Airis files were valid UTF-8 but lacked both markers; their different Quick
  Look result was therefore a macOS charset-heuristic failure, not corrupted
  application text. Illustrator correctly detected the encoding in both. A
  copy of the failing baseline SVG with the new header rendered Cyrillic
  correctly through the system `qlmanage` Quick Look generator.
- Generated caches/logs/OS metadata were removed; root code and documentation
  were redistributed into `src/`, `tools/` and `docs/`.
- `GridGenerator.dispose()` now owns global listeners, drag/resize gestures,
  panel and slider bindings, timers and scheduled renders. Re-importing the
  application entry point replaces the previous instance instead of stacking
  handlers; a regression test verifies a single keyboard owner.
- Ajv 8.20 compiles `schemas/preset-1.2.schema.json` into an autonomous ESM
  validator. Runtime no longer duplicates validation rules by hand, all 19
  checked-in presets use the same validator, and test/build detect stale output.
- Built-in preset fetches bypass HTTP cache so an older same-named JSON cannot
  be mistaken for the current 1.2 source of truth.

## Remaining findings

### 1. Composition contracts remain broad

Twenty-eight modules still retain `this.host`; the most common cross-owner
accesses are DOM, history, settings, object document and render commands.
`GridGenerator` constructs roughly 35 controllers/managers/services. This is
functional but makes isolated tests and replacement harder. Narrow ports should
be introduced incrementally, not through another all-at-once rewrite.

Priority candidates: `PresetApplicationController`, `ExportDocumentBuilder`,
`ApplicationEventController`, grid command/view controllers and object editors.

### 2. HTML and CSS are the largest monoliths

The source modules are reasonably decomposed, but panel markup remains in a
1,096-line HTML file and all visual rules remain in a 2,711-line stylesheet.
Start with CSS tokens, scrollbar primitives, pills/tabs and numeric controls;
then extract panel-specific styles and markup. Keep `index.html`, `script.js`
and `style.css` as the root shell required by the project.

### 3. Export references are re-fetched

`ExportDocumentBuilder` fetches and parses the same immutable design-kit SVGs
for each reference-enabled export. Cache sanitized parsed templates or source
strings once. This is lower risk than render optimization and has a measurable
export benefit.

### 4. Cloning and error presentation are distributed

Seven modules repeat JSON stringify/parse cloning, and import/export errors use
browser `alert()` in two paths. A shared clone helper and non-blocking error
surface would reduce drift and improve Safari UX, but neither is currently a
correctness blocker.

### 5. Real application acceptance remains manual

The clean production build and Chromium smoke pass, and the system Quick Look
generator accepted the repaired Airis file. This environment cannot automate
Illustrator; a newly exported Airis SVG, Safari and Illustrator should still
follow the maintained release checklist before release.

## Recommended order

1. Narrow preset/export/event dependencies.
2. CSS/control extraction, then panel markup extraction.
3. Immutable export-asset cache and measured performance pass.
4. Shared clone helper and non-blocking errors.
5. Manual release matrix.
