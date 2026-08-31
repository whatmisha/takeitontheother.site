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

UPG-054f verifies two distinct value-display contracts without changing
Keyboarder HTML, runtime or CSS. Three readonly HSB fields remain canonical
shared color-picker controls (12.8 px, transparent, 135×14.5 when visible).
Six grid fields remain private 100×26 mono editors with border/background,
three decimals, ` mm` suffix and their own `NUMERIC_CONTROLS` binder. The
boundary test fixes those inventories, allows only the existing scoped private
selectors and rejects private focus/disabled state forks.

At 1280×720 Colors remains 46 px collapsed, 284 px expanded and 453 px with Key
HSB open; all transitions preserve the 133 295-character/hash `f1c3d795…`
keyboard SVG and 82 input states. Arrow, Shift+Arrow, Escape and comma/suffix
blur parsing retain their private behavior. Because a three-decimal display can
round a more precise preset value on manual commit, exact geometry is restored
by reload/preset application rather than by retyping the displayed value; a
clean reload returns exact SVG, inputs, displays and panels. All six Keyboarder
boundary/domain suites pass.

Run `npm run test:keyboarder` from `upgrade/` for the boundary, SVG encoding, geometry, model, preset and layout/content checks.

## G5 range verification

UPG-054l changes no Keyboarder production source. It has zero ordinary ranges
and exactly three shared HSB ranges created by `ColorPicker`; the theme has no
private range selector. Browser Colors expands to 300×453 with a 260×161 picker
and three 244×10 gradient controls; docking between Cap/Guide/Ink rows works.
The existing integer HSB conversion can normalize achromatic `#aaaaaa` to
`#ababab` after a manual edit. This is recorded as color behavior, not changed
here; clean reload restores the exact 133 295-character SVG and `#aaaaaa`.
