# Keyboarder Project Notes

This folder keeps the project documentation and AI handoff files together.

- `PIPELINE.md` describes the design workflow and measured layout rules.
- `TOOL_PLAN.md` tracks implementation stages and current engineering status.
- `HANDOFF.md` is the factual handoff for the next AI session.

Repository structure:

- `app/` - the Keyboarder application code.
- `analysis/` - regression and measurement harnesses.
- `presets/` - shipped app presets.
- `Fonts/` - YS Text reference and variable fonts used by the app/tests.
- `vendor/` - required runtime third-party code: framework copy plus `opentype`, `jsPDF`, `svg2pdf`.
- `docs/assets/` - screenshots, diagnostic images, and QA preview SVG.
- `reference/lcakb23/` - canonical LCAKB23 reference SVG and verification JSON artifacts.

Removed during cleanup:

- `ui-framework/` - old source sandbox; active app uses `vendor/framework/`.
- `LCAKB23/` - old Illustrator/source archive with duplicate SVG/font; active reference files are in `reference/lcakb23/`.
