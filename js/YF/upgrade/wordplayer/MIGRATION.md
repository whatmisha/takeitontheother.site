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

Run `npm run test:wordplayer` from `upgrade/` to verify the boundary contract and both worker suites.
