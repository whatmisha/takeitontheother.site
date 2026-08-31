# Wordplayer shared-framework migration

Wordplayer is the first application canary for the shared framework. Its runtime now imports `defineTool` only from the framework public barrel and loads the shared framework stylesheet before its own `styles.css`.

## Preserved application responsibilities

- Dither and Forms engines, scene computation, workers and renderers remain under `src/`.
- `WordplayerExporter` remains application-owned. The framework exporter is deliberately disabled with `export: false`.
- Asset loading, font parsing, cached geometry and the `window.wordplayer` compatibility API remain unchanged.
- The storage namespace remains `upgrade:wordplayer:presets:v1`.
- DOM structure and application CSS are unchanged; UPG-052h adds accessible
  back-link semantics to the existing mode-navigation variant.

## Shared responsibilities

- `defineTool`, `ApplicationShell`, settings, history, presets, sharing, panels, sliders, shortcuts, color controls and canvas zoom/pan come from `../framework/src/index.js`.
- CoFo UI fonts and foundation CSS come from `../framework/`.
- The Wordplayer-local CoFo files were byte-identical to the shared files before relocation.

## Intentional framework improvements

Wordplayer now receives the common preset timeout, seeded clean-link behavior, panel utilities and the other documented shared-framework improvements. These do not replace its renderer or exporter.

## G5 navigation variant

Wordplayer deliberately keeps `.mode-nav-button.mode-nav-back` instead of
adopting `.top-link`, because the back action is one segment of the combined
Dither/Forms navigation control. UPG-052h adds the common
`aria-label="Back to Upgrade Tools"` semantics without changing presentation.
At 1280×720 both modes are byte-identical before/after: Dither full-page hash
`eafaf5c4c10c237b60d2b88889deed4372619ca80168a1fb34ade3a3b0deab7c` and
Forms hash `7d3838e2a6ce5b7e062a6b2c73b8ac2bb97662e66a67532e77e4d38d4ab34ef9`.
Mode navigation, panels, Canvas/actions geometry and all 68 form states are
also exact; worker and framework-boundary tests pass.

UPG-053f verifies without a presentation change that General, Pixels, Dither
and Forms titles consume the shared 14.4/500 rule with 46 px headers; the
application stylesheet is tested not to fork the selector. Switching
Dither → Forms → Dither restores panel geometry and all 68 inputs exactly while
the full-page Canvas stays 1280×720. Both worker suites remain green.

UPG-053g adds shared focus/ARIA and Enter/Space collapse without changing CSS.
Dither collapses to its 46 px shell and restores exact panels and all 68 inputs;
mode visibility remains application-owned and both worker suites stay green.

UPG-054e verifies the shared value-display contract without changing
Wordplayer HTML, runtime or CSS. Twenty static slider displays consume the
shared normal/focus/disabled rules and the shared color picker creates three
readonly HSB fields. The only application selector is deliberately preserved
as the eight-field compact Forms extension (3.2 em wide at 11.52 px); the
boundary test now rejects any additional private value-display fork.

At 1280×720 Dither keeps ordinary 135×14.5 fields and 136/670/305.5 px panel
heights, while Forms keeps 36.859×13 fields and its 513 px panel/46 px collapsed
shell. Mode round-trips restore the 1280×720 Canvas, all 68 input states and all
23 displays. Arrow, Shift+Arrow, Escape, blur and Enter were accepted separately
for the ordinary and compact variants; boundary plus both worker suites pass.

Run `npm run test:wordplayer` from `upgrade/` to verify the boundary contract and both worker suites.

## G5 range verification

UPG-054l changes no Wordplayer production source. Twenty ordinary ranges and
the shared three-range HSB picker consume canonical presentation; the sole
private range selector remains the scoped 100% width rule for eight compact
Forms controls. Browser Forms ranges stay 120×10, the panel stays 300×513 and
Canvas stays 1280×720 CSS/2560×1440 backing pixels. Focus and 25→26→25 restore
all inputs and panel geometry; the shared picker docks between Ink/Background.
The running Forms simulation is intentionally not treated as a byte-stable
screenshot baseline.

## G5 native dialog lifecycle

UPG-057c preserves Wordplayer's shared native dialog presentation and private
about/export-error copy while adding `aria-labelledby="dialogTitle"`. Escape
closes the dialog and returns focus to `introHelpBtn`; the shared host now also
handles native cancel/external close, replacement and listener cleanup. Dither
and Forms engines, busy buttons, Canvas and exporters are untouched. Boundary,
both worker suites and full Gate G4 pass.

## G5 tooltip accessibility

UPG-057d applies the shared keyboard tooltip lifecycle to all 22 static hosts
across Dither and Forms. The pointer Copy share link tooltip remains exactly
100.094×25.5 with unchanged position, padding, font and paint. Focus adds a
temporary `aria-describedby`; Escape removes it and leaves focus in place.
Mode-hidden controls, Canvas workers, busy state and exporters are unchanged.
Boundary, both worker suites and Gate G4 pass.
