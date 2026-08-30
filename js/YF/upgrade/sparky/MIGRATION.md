# Sparky shared-framework migration

Sparky is the priority migration and the mobile acceptance reference. It imports `defineTool` through the shared public barrel and loads the shared framework CSS before its private stylesheet.

## Preserved application responsibilities

- Character, ray and eye geometry; focus modes; blink, bolid and motion-path animation remain under `src/` and `tool.js`.
- The reduced mobile showcase, touch/swipe focus, viewport fitting and mobile copy remain Sparky-owned because no other tool needs that product behavior.
- Static SVG generation and animated MP4/PNG-sequence export remain Sparky-owned.
- Static PNG still delegates rasterization to the framework after Sparky settles animation/eye state.
- The generic export guard is explicitly disabled because Sparky already owns the transient-state preparation policy for static and animated exports.
- Storage remains `upgrade:sparky:presets:v1`; the force-seed and seed-migration policy is unchanged.
- DOM structure and `styles/sparky.css` remain unchanged.

## Shared responsibilities

- Shell, SVG target, settings, history, presets, sharing, panels, shortcuts, sliders, color controls and base raster export come from `../framework/src/index.js`.
- Base CSS and common UI assets come from `../framework/`.
- The generic framework improvements originally developed in Sparky (space shortcut, all-panel toggle, display-only sliders, fit-artboard, non-interactive zoom and preset migration hooks) are now consumed from the common implementation.

## Fonts

Sparky intentionally renders its UI with its existing TT Commons files under the historical `CoFo Sans` family name. The two byte-identical files were moved from the retired local framework directory to `sparky/fonts/`; this preserves layout while making ownership explicit.

Run `npm run test:sparky` from `upgrade/`. Browser acceptance covers desktop plus 390×844 and 430×932 mobile viewports, mode controls, panel/shortcut behavior and static exports.
