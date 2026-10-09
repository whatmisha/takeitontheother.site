# Wander Wall

Letter wallpaper generator on the shared YF framework. Open `wander_wall/`
through the repository's local HTTP server. No build or external runtime
dependencies are needed.

## Composition

- Up to 32 Latin letters, with spaces allowed. Text applies automatically after
  a 300 ms pause; Enter applies immediately. Edits made during artwork loading
  remain pending and apply next. Empty text produces a shapes-only canvas.
- Nine alternatives per letter: three silhouettes and three treatments per set.
- Generate randomizes unpinned letters, forms, and layout. Letter order is
  preserved by default; Shuffle letters changes their spatial order.
- Fill adjusts packing density. Silhouette masks allow interlocking forms and
  controlled overlaps; transformed bounds stay inside the artboard.
- Include forms and Count control 0-16 extra forms. Forms are sampled without
  repeats until the catalog has been used once.
- Desktop exports 3840 x 2160; iPhone exports 1290 x 2796. Both use the reference's
  four-stop vertical blue gradient. Format changes repack free elements and
  constrain pinned ones to the new artboard.

## Editing

In Change variant mode, click an element to select it and cycle its variant.
Select and move mode only selects on click. Both modes support dragging to move,
the lower-right resize handle, and the circular rotation handle. The Layers
panel also selects without changing artwork. Its front-to-back order matches
the canvas; drag a grip to reorder, or use the selection panel's arrow buttons.
Size and Rotation use shared editable numeric controls alongside their sliders.

Pins are explicit: moving, resizing, rotating, and changing variants preserve
the current pin state. Each layer has a pin button, and Unpin all clears all
pins in one undo step. The list shows Auto/Pinned states and a pinned count.

Generate preserves the exact variant, transform, and layer position of pinned
elements. Editing text retains pins only for unchanged letters at the same text
index. Reducing the form count or disabling forms removes those form instances,
including their pins. Undo restores them.

Each drag is one undo step. Escape cancels an unfinished gesture. Cmd/Ctrl+Z and
Cmd/Ctrl+Shift+Z undo/redo, arrows nudge (Shift: 10 px), P pins, V selects Move
mode, C selects Change variant mode, Shift+V cycles the selected variant,
R generates, and Space-drag pans. Use the zoom controls or Cmd/Ctrl+wheel to zoom.
The shared framework provides the shortcut help and suppresses commands while
typing or using dialogs.

At widths up to 1100 px, Composition, Layers, and Selection share a scrollable
bottom panel. The canvas stays visible above it, with export actions in their
own reserved row. Selecting artwork opens Selection; the chevron collapses the
panel to enlarge the canvas. Tabs support arrow-key navigation.

Presets, share links, JSON, and history store exact instances, not just the seed.
J reveals JSON actions. PNG renders a separate snapshot at full resolution with
no selection UI. Storage is scoped to `upgrade:wander_wall:presets:v1`.

## Assets and Code

- `assets.js`: letter alternatives and the expandable `FORMS` catalog. Add a PNG
  under `graphics/blobs/` and a unique `{ id, name, src }` entry to add a new form.
- `scripts/prepare-assets.mjs`: rebuilds `asset-metrics.json` from alpha bounds
  and 32 x 32 masks, and vendors the used Lucide icons. Requires `sharp` and
  `lucide`; `WANDER_NODE_MODULES` may point to a directory containing these packages.
  Existing artwork is not overwritten. The original PNGs provide export detail.
- `layout.js`: deterministic row anchors, silhouette coverage optimization, and
  gap filling. Pinned elements are obstacles for the remaining composition.
- `document.js`: normalized state, format limits, and versioned JSON validation.
- `editor.js`, `render.js`, `tool.js`: pointer editing, rendering/export, and shared
  framework integration. Selection and gesture previews are transient.

## Verification

`node --test wander_wall/tests/layout.test.mjs` checks both formats, 1-32 letters,
determinism, reading order, bounds, pins, forms, and JSON round trips.

`node wander_wall/tests/browser.mjs` runs Playwright against port 8016 by default.
Set `WANDER_URL`, `WANDER_CHROME`, and `WANDER_NODE_MODULES` for another local
setup. It checks both editing modes, automatic text and in-flight drafts, exact
numeric controls, layer reordering, explicit pins, actual PNG downloads,
mobile panels, presets, import recovery, and share links. Results are in
`tests/acceptance.json`.
