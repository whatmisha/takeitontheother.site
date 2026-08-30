# Keyboarder shared-framework migration

Keyboarder is the SVG canary. Its runtime imports `defineTool` and `SVGExporter` from the shared public barrel and loads shared framework CSS before `app/theme.css`.

## Preserved application responsibilities

- Keyboard geometry, layouts, legends, content, optics and compensation remain in `app/kb/`.
- Selection, drag editing, legend editing, JSON/SVG/font import and the simple/advanced UI remain in `app/tool.js`.
- Editable-text/outlined SVG export, editable PDF with embedded static or variable TTF data, clean-export reporting and PNG export retain Keyboarder's wrappers.
- YS Text files and the OpenType module used by Keyboarder's typeface/variation pipeline remain application-owned.
- Storage namespaces remain `upgrade:keyboarder:*`.
- DOM structure and application component CSS remain unchanged.

## Shared responsibilities

- Shell, SVG render target, zoom, panels, settings, history, presets, sharing and base export infrastructure come from `../../framework/src/index.js`.
- Base CSS, CoFo UI fonts, jsPDF and svg2pdf come from `../framework/`.
- The shared exporter already contains Keyboarder's XML-safe SVG, editable PDF, font embedding and variable-font preservation improvements.

The case of application font URLs was normalized to the actual `fonts/` directory so the isolated copy also works on case-sensitive hosts.

Run `npm run test:keyboarder` from `upgrade/` for the boundary, SVG encoding, geometry, model, preset and layout/content checks.
