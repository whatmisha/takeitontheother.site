# Keyboarder shared-framework migration

Keyboarder is the SVG canary. Its runtime imports `defineTool` and `SVGExporter` from the shared public barrel and loads shared framework CSS before `app/theme.css`.

## Preserved application responsibilities

- Keyboard geometry, layouts, legends, content, optics and compensation remain in `app/kb/`.
- Selection, drag editing, legend editing, JSON/SVG/font import and the simple/advanced UI remain in `app/tool.js`.
- Editable-text/outlined SVG export, editable PDF with embedded static or variable TTF data, clean-export reporting and PNG export retain Keyboarder's wrappers.
- YS Text files and the OpenType module used by Keyboarder's typeface/variation pipeline remain application-owned.
- Storage namespaces remain `upgrade:keyboarder:*`.
- DOM structure and application component CSS remain unchanged; UPG-052f adds
  the canonical back link's missing accessible name without changing layout.

## Shared responsibilities

- Shell, SVG render target, zoom, panels, settings, history, presets, sharing and base export infrastructure come from `../../framework/src/index.js`.
- Base CSS, CoFo UI fonts, jsPDF and svg2pdf come from `../framework/`.
- The shared exporter already contains Keyboarder's XML-safe SVG, editable PDF, font embedding and variable-font preservation improvements.

The case of application font URLs was normalized to the actual `fonts/` directory so the isolated copy also works on case-sensitive hosts.

UPG-052f completes the existing `.top-link` contract with
`aria-label="Back to Upgrade Tools"`. Browser comparison at 1280×720 is a zero
visual diff: full selected computed state, toolbar/panels/actions/SVG geometry,
exact keyboard SVG markup and all 82 form states are unchanged.

UPG-053f adds verification only: every panel title resolves to the shared
14.4/500 selector, visible and collapsed headers remain 46 px, and application
CSS is tested not to fork that selector. Colors expands 300×46 → 300×284 and
restores exactly; the 133 295-character keyboard SVG and all 82 inputs remain
unchanged.

UPG-053g supplies role/tabindex, synchronized expanded state and Enter/Space
through the shared manager. Colors repeats 300×46 → 300×284 → 300×46 by
keyboard; panel state, exact keyboard SVG and 82 inputs restore unchanged.
Legend show/hide/edit ownership remains application-private.

Run `npm run test:keyboarder` from `upgrade/` for the boundary, SVG encoding, geometry, model, preset and layout/content checks.
