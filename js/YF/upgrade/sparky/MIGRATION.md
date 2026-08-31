# Sparky shared-framework migration

Sparky is the priority migration and the mobile acceptance reference. It imports `defineTool` through the shared public barrel and loads the shared framework CSS before its private stylesheet.

## Preserved application responsibilities

- Character, ray and eye geometry; focus modes; blink, bolid and motion-path animation remain under `src/` and `tool.js`.
- The reduced mobile showcase, touch/swipe focus, viewport fitting and mobile copy remain Sparky-owned because no other tool needs that product behavior.
- Static SVG generation and animated MP4/PNG-sequence export remain Sparky-owned.
- Static PNG still delegates rasterization to the framework after Sparky settles animation/eye state.
- The generic export guard is explicitly disabled because Sparky already owns the transient-state preparation policy for static and animated exports.
- Storage remains `upgrade:sparky:presets:v1`; the force-seed and seed-migration policy is unchanged.
- DOM structure and `styles/sparky.css` remain unchanged; UPG-052g adds the
  canonical back link's missing accessible name without changing layout.

## Shared responsibilities

- Shell, SVG target, settings, history, presets, sharing, panels, shortcuts, sliders, color controls and base raster export come from `../framework/src/index.js`.
- Base CSS and common UI assets come from `../framework/`.
- The generic framework improvements originally developed in Sparky (space shortcut, all-panel toggle, display-only sliders, fit-artboard, non-interactive zoom and preset migration hooks) are now consumed from the common implementation.

## Fonts

Sparky intentionally renders its UI with its existing TT Commons files under the historical `CoFo Sans` family name. The two byte-identical files were moved from the retired local framework directory to `sparky/fonts/`; this preserves layout while making ownership explicit.

UPG-052g completes the existing `.top-link` contract with
`aria-label="Back to Upgrade Tools"`. Desktop browser state is an exact visual
match, including toolbar/panels/actions, generated character SVG and all 68
form states. The source diff is attribute-only and neither shared nor Sparky
CSS selects `aria-label`, so the accepted 390×844 and 430×932 mobile geometry
and safe-area behavior cannot be affected; the mobile showcase remains covered
by the full 196-test suite.

UPG-053f verifies without a runtime or CSS change that all four panel titles
consume the shared 14.4/500 rule. Sparky's private font intentionally keeps each
header and collapsed shell at 47 px. Shape collapse/restore returns the exact
panel state, 26 806-character character SVG and all 68 inputs. The boundary test
now rejects a private `.panel-header span:first-child` override; because this
step adds no visual selector, the accepted mobile layouts remain unchanged.

UPG-053g makes the existing collapse icons focusable shared controls with
synchronized expanded state and Enter/Space behavior. It removes runtime
`aria-hidden` without changing markup source or CSS; no Sparky selector targets
the added attributes. Keyboard collapse/restore keeps the 47 px shell, exact
character SVG and 68 inputs. The mobile showcase logic remains private and the
196-test suite stays green.

UPG-054d verifies the shared value-display contract without changing Sparky
HTML, runtime or CSS. Its 24 static domain displays already consume the shared
slider presentation; three additional readonly HSB displays are created by the
shared color picker. The boundary test now fixes that inventory, the shared
normal/focus/disabled states and the absence of any private value-display fork.
At 1280×720 the 26 806-character character SVG, all 68 inputs, 27 displays and
four panel rectangles restore exactly; Arrow, Shift+Arrow, Escape, blur and the
47 px collapsed Shape shell retain their behavior. With no visual source diff,
the accepted 390×844 and 430×932 mobile baselines remain unchanged and are still
protected by the complete 196-test suite.

Run `npm run test:sparky` from `upgrade/`. Browser acceptance covers desktop plus 390×844 and 430×932 mobile viewports, mode controls, panel/shortcut behavior and static exports.

## G5 range verification

UPG-054l is verification-only: Sparky production sources do not change. The
boundary test fixes 24 static ordinary ranges, the shared three-range HSB
picker and the absence of any private thumb/track skin. Browser runtime has 27
ranges; ordinary controls are 260×10 with 6/12 px margins, HSB controls are
244×10, and picker docking between Head and Eyes works. Ray Count 5→6→5
changes and then exactly restores the 26 806-character SVG. With no production
diff, the accepted desktop and 390×844/430×932 mobile baselines remain intact.
