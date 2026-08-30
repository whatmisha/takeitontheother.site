# Wordplayer shared-framework migration

Wordplayer is the first application canary for the shared framework. Its runtime now imports `defineTool` only from the framework public barrel and loads the shared framework stylesheet before its own `styles.css`.

## Preserved application responsibilities

- Dither and Forms engines, scene computation, workers and renderers remain under `src/`.
- `WordplayerExporter` remains application-owned. The framework exporter is deliberately disabled with `export: false`.
- Asset loading, font parsing, cached geometry and the `window.wordplayer` compatibility API remain unchanged.
- The storage namespace remains `upgrade:wordplayer:presets:v1`.
- DOM structure and application CSS are unchanged.

## Shared responsibilities

- `defineTool`, `ApplicationShell`, settings, history, presets, sharing, panels, sliders, shortcuts, color controls and canvas zoom/pan come from `../framework/src/index.js`.
- CoFo UI fonts and foundation CSS come from `../framework/`.
- The Wordplayer-local CoFo files were byte-identical to the shared files before relocation.

## Intentional framework improvements

Wordplayer now receives the common preset timeout, seeded clean-link behavior, panel utilities and the other documented shared-framework improvements. These do not replace its renderer or exporter.

Run `npm run test:wordplayer` from `upgrade/` to verify the boundary contract and both worker suites.
