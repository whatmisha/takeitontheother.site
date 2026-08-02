# Keyboarder Project Notes

This folder keeps the project documentation and AI handoff files together.

- `PIPELINE.md` describes the design workflow and measured layout rules.
- `TOOL_PLAN.md` tracks implementation stages and current engineering status.
- `HANDOFF.md` is the factual handoff for the next AI session.

Repository structure:

- `app/` - the Keyboarder application code.
- `analysis/` - regression and measurement harnesses.
- `presets/` - shipped app presets listed in `presets/manifest.json`.
- `Fonts/` - YS Text reference and variable fonts used by the app/tests.
- `vendor/` - required runtime third-party code: framework copy plus `opentype`, `jsPDF`, `svg2pdf`.
- `docs/assets/` - screenshots, diagnostic images, and QA preview SVG.
- `reference/keyboards/` and `reference/laptops/` - SVG references, `_curv` visual overlays,
  and `.layout.json` geometry refs for the built-in presets. Work 2.0 L uses
  `reference/keyboards/Work_2_L.svg`, `Work_2_L.layout.json`, and `Work_2_L.legends.json`
  as the canonical former LCAKB23 reference.

Removed during cleanup:

- `ui-framework/` - old source sandbox; active app uses `vendor/framework/`.
- old LCAKB23 archive folders - active Work 2.0 L reference
  files are in `reference/keyboards/`.
- obsolete unlisted preset JSON files (`ansi-*`, `iso-tkl`, `round-mm`, `lcakb23-*` variants);
  built-in app layouts are defined in JS, while `presets/manifest.json` keeps only persisted seed
  JSON models.
