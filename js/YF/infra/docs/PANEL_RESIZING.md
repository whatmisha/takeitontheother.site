# Shared vertical panel resizing

Implemented 2026-10-15. UI-only enhancement; no generator data, renderers,
exporters, presets, JSON schemas or undo history are changed.

## User contract

- A panel becomes resizable when its automatic layout (including a nested Layers
  list) actually overflows, or when restoring an explicit saved height. Overflow
  caused by another resized panel must never create eligibility. Once eligible,
  its invisible edge remains available during
  the visit, even if the expanded panel no longer needs a scrollbar.
- Ordinary panels resize from the bottom; bottom-anchored panels from the top.
  The hit area is 6 px high, inset 8 px from rounded corners. Only `ns-resize`
  identifies it; there is no visible handle. Keyboard focus has a focus outline.
- Double-click the edge to restore automatic height. Keyboard users can focus
  the separator and use Up/Down (10 px), Shift+Up/Down (50 px), or Home (reset).
  Escape, pointer cancellation and window blur cancel an unfinished drag.
- Collapsed panels have no active resize edge and retain their standard header
  height. Expanding restores the preferred height.
- Heights and resize priority are local UI preferences under
  `yf:panel-heights:v1:<tool-directory>`. Storage denial/corruption is non-fatal.
  Saved heights are constrained to the current window without overwriting the
  preferred size just because the window became smaller.
- Desktop fine pointers only. Mobile/bottom-sheet layouts retain their native
  behavior; returning to desktop restores preferences. Grainy Land's desktop
  threshold follows its existing 1200 px layout breakpoint.

## Integration

`infra/framework/src/ui/panelResizeAutoInit.js` is loaded once by every tool
entry (including Pizza Boxer 02 and the concurrently added Erik). It owns a
single `PanelResizeController` and handles pagehide/pageshow including BFCache.
Styles are imported by `infra/framework/css/ui-contract.css`.

The controller discovers `.controls-panel` with an id and direct `.panel-header`
and `.panel-content` children. Mutation/resize observers cover late creation,
conditional visibility and dynamic content. They do not observe canvas changes
as panel layout changes. Listener and observer ownership is cleaned up on exit.

Existing drag/collapse managers are unchanged, including Pizza Boxer's private
runtime and Sticky Fingers' legacy manager. The pointer sequence on the resize
edge is consumed before those managers can start dragging the whole panel.

### Linked layout compatibility

| Consumer | Shared height budget |
| --- | --- |
| Pizza Boxer / Pizza Boxer 02 | Actual `.controls-panel-stack` containers; native gaps and bounds |
| Wordplayer | General + visible Dither/Forms panel; bottom reserve 74 px, gap 12 px |
| Grainy Land | Canvas + Composition + Animation; Appearance + Layers; native 4/20 px gaps |
| Wander Wall | General + Composition; Layers + Background; 20 px gaps |
| Random Lines / Rays | Settings + Tone; top 76 px, bottom reserve 88 px, gap 12 px |

The actively resized member takes priority within the remaining space. Compact
neighbors retain their full automatic content height: growing Composition cannot
introduce a scrollbar in Animation. Only naturally overflowing or explicitly
resized members give up content area. Previous eligibility on a shorter viewport
does not make an otherwise compact neighbor flexible. Layers retains space for
non-scrolling action rows and at least 80 px of list when the viewport permits.
The 80 px preference never takes space away from a fitting compact neighbor.
When the column is full, growth stops. A viewport too short to fit the automatic
layout can still require scrolling; that is separate from neighbor resizing.
Other independent floating windows are not repositioned. Manually dragged panels
leave automatic columns.

Before allocation, the controller removes only its own sizing/position attributes
from all panels and measures their automatic layout synchronously, before paint.
It then reapplies preferences and restores scroll positions. This avoids learning
minimum heights or eligibility from its own previous squeezed layout, and handles
reload, reset, conditional content and responsive changes without stale metrics.
Linked limits are calculated even before the first resize gesture.

These explicit compatibility profiles live at the top of the controller. A new
tool with independent standard panels needs only the shared entry script and
stylesheet. A new linked column needs a profile (or a standard stack container).
The Keyboarder Legend popover is top-positioned, unlike its advanced-mode panel.

## Verification

- `node --test infra/framework/tests/panel-resize.test.mjs`: storage, edges,
  budget allocation, cancel/reset, keyboard, mobile, ownership and entry wiring.
- `npm run test:framework`, `npm run test:ui-audit`, `npm run check:ui-contract`.
- Browser inspection of all original 19 entries: single controller handle per
  standard panel, only overflowing/open panels eligible.
- Wordplayer: real pointer drag on both edges; neighbors stay separated; resize
  priority survives reload; double-click restores automatic heights.
- Pizza Boxer: Sides/Grid share the stack height, including a collapsed neighbor.
- Sparky: short viewport, shrink, collapse to 47 px, re-expand to saved height,
  return to full viewport, reset to original natural height.
- Keyboarder: temporary Legend editor becomes resizable when short viewport
  causes overflow; its bottom edge changes height without editing the legend.
- Grainy Land: nested Layers scroll area retains fixed action rows while its
  neighboring Appearance panel grows. Native browser resize grip is removed.
- Responsive check: all resize attributes/handles inactive in mobile layout.
- Erik: overflowing Crawl panel changes height and resets without changing text.
- 33 resize-specific tests and all 139 framework tests pass; keyboard, UI audit,
  Wordplayer, Sticky Fingers and both Pizza Boxer suites also pass.
- Both Pizza Boxer source templates retain the entry script. Production builds
  and runtime/source checks pass; compiled application assets are byte-identical
  to their previous versions (only entry HTML and source fingerprints changed).

### Compact-neighbor regression (2026-10-15)

Verified in the browser with actual resize gestures, not just arithmetic tests:

| Tool / viewport | Resize action | Protected neighbor after resizing |
| --- | --- | --- |
| Grainy Land / 1280×720 | Grow Composition | Animation 173 px, no overflow |
| Wordplayer / 1280×720 | Grow General four times | Dither 304 px, no overflow |
| Wander Wall / 1280×500 | Grow Composition three times | General 199 px, no overflow |
| Random Lines / 1280×600 | Expand Settings, grow Tone | Settings 150 px, no overflow |
| Rays / 1280×700 | Expand Settings, grow Tone | Settings 206 px, no overflow |
| Pizza Boxer / 1280×720 | Expand Sides, try to grow it | Grid retains 574.35 px, no new overflow |
| Pizza Boxer 02 / 1280×720 | Expand Grid, shrink/grow/reset | Collapsed neighbor stays 47 px; stack remains linked |

Also checked Grainy Land after reload with a saved Composition height, a real
mouse drag, preserved scroll position during further resizing, inactive handles
at its responsive breakpoint, and double-click reset. Animation stayed scroll-free.

The separate `check:boundaries` gate currently reports the pre-existing
uncatalogued `grid_generator_02` directory. Registering or removing that tool is
outside this UI change; it is not hidden by weakening the catalog validator.
