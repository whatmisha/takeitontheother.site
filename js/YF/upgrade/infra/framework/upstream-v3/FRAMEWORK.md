# Othersite UI Framework v3

Declarative, renderer-agnostic toolkit for building dark-themed, SVG/Canvas design
tools in the browser. Extracted and generalised from the **Void Typeface** tool.

Where **v2** was a *copy-and-customise template* (`AppTemplate.js` with a hand-written
`init()`), **v3** is an *engine*: you describe a tool with one config object and
`defineTool()` wires up the entire interface and feature set for you — sliders,
dual-handle range sliders, a dice/random panel, color pickers, draggable/collapsible
panels, zoom/pan, undo/redo, presets, share links, export and tooltips.

```
import { defineTool } from '../src/core/defineTool.js';

defineTool({
  renderer: 'svg',
  autoStart: true,
  dom: { canvas: 'canvasContainer', surface: 'mainSvg', zoomIndicator: 'zoomIndicator' },
  settings: { width: 800, height: 800, cols: 6, color: '#82A9D9' },
  controls: { sliders: [{ id: 'colsSlider', valueId: 'colsValue', setting: 'cols', min: 1, max: 24, decimals: 0, baseStep: 1, shiftStep: 4 }] },
  panels: [{ id: 'gridPanel', headerId: 'gridPanelHeader', persistent: true }],
  colorPickers: [{ containerId: 'colorPicker', setting: 'color' }],
  presets: { storageKey: 'myTool', basePath: 'presets' },
  share: {},
  export: { filename: 'art.svg' },
  render(ctx) {
    const { svg, create, width, height, settings } = ctx;
    svg.appendChild(create('rect', { width, height, fill: settings.bg }));
    // ...draw...
  }
});
```

A complete working example lives in [`demo/`](./demo/) — **Pattern Studio**, a generative
grid tool that uses every subsystem and contains zero framework code.

> **ES modules require an HTTP server.** `file://` blocks `import`. Run
> `python3 -m http.server` and open `http://localhost:8000/demo/`.

---

## Directory layout

```
v3/
├── FRAMEWORK.md
├── css/
│   ├── othersite-styles.css ← full design system (ship this)
│   └── tokens.css           ← :root tokens + fonts (override to re-theme)
├── fonts/
├── demo/                    ← Pattern Studio reference tool
│   ├── index.html  tool.js
│   └── presets/             ← seeded preset library (manifest.json + *.json)
└── src/
    ├── index.js             ← public API barrel
    ├── core/
    │   ├── defineTool.js        ← declarative entry point
    │   ├── ApplicationShell.js  ← the engine (init pipeline + wiring)
    │   ├── Settings.js          ← reactive store + dirty tracking
    │   ├── DOMCache.js          ← getElementById cache + Proxy
    │   └── ShortcutRouter.js    ← keyboard shortcuts ("mod+z" …)
    ├── render/
    │   ├── RenderTarget.js      ← abstract surface
    │   ├── SvgTarget.js         ← <svg> + ZoomPanManager + export
    │   └── CanvasTarget.js      ← <canvas> + DPR + zoom/pan
    ├── ui/
    │   ├── SliderController.js       RangeSliderController.js   (dual-handle, NEW vs v2)
    │   ├── PanelManager.js (+collapse) ColorPicker.js
    │   ├── DicePanel.js (NEW)         DialogHost.js (generic <dialog>)
    │   ├── TooltipService.js         ZoomPanManager.js
    ├── history/
    │   ├── HistoryManager.js     ← snapshot undo/redo
    │   └── HistoryBridge.js      ← debounce + transactions (when to snapshot)
    ├── preset/
    │   ├── PresetStore.js        ← localStorage CRUD + seed
    │   ├── PresetSession.js      ← current preset, per-preset history, shared slot
    │   └── ShareCodec.js         ← diff → deflate → base64url URL codec
    ├── export/
    │   ├── SVGExporter.js   TextToPath.js
    ├── effects/
    │   ├── WobblyEffect.js  GradientStrokeEffect.js
    ├── utils/
    │   ├── ColorUtils.js  MathUtils.js  NoiseGenerator.js  DOMUtils.js
    └── geometry/
        └── StrokeGeometry.js     ← pure stripe-layout maths
```

---

## `defineTool(config)` reference

| Key | Type | Purpose |
|-----|------|---------|
| `renderer` | `'svg' \| 'canvas'` | Surface type. Default `'svg'`. |
| `autoStart` | boolean | Init on `DOMContentLoaded`. Otherwise call `app.init()`. |
| `dom` | object | Element-id map: `canvas` (required), `surface`, `zoomIndicator`, `presetDropdown`, `presetToggle`, `presetMenu`, `saveBtn`, `shareBtn`, plus any custom ids. |
| `settings` | object | Default values. These become the pristine baseline for sharing & history. |
| `controls.sliders` | array | Each: `{ id, valueId, setting, min, max, decimals, baseStep, shiftStep, suffix? }`. |
| `controls.ranges` | array | Dual-handle: `{ containerId, minValueId, maxValueId, minSetting, maxSetting, min, max, decimals, baseStep, shiftStep }`. |
| `controls.toggles` | boolean | Auto-bind `[data-setting]` checkboxes (default `true`). |
| `panels` | array | Each: `{ id, headerId, draggable?, persistent?, initialPosition? }`. |
| `collapse` | boolean | Auto-wire `.collapse-icon` (default `true`). |
| `colorPickers` | array \| object | Array of `{ containerId, setting, initialColor? }` for standalone pickers, **or** `{ containerId, swatches: [{ type, setting, itemId, dotId, hexId, hsbSlotId }] }` for one shared picker docked under the active swatch row. |
| `dice` | object | `{ params: [...], rng?, onToggle? }` — see Dice recipe. |
| `tooltips` | boolean | Enable `[data-tooltip]` service (default `true`). |
| `dialog` | object\|false | DialogHost id overrides, or `false` to disable. |
| `presets` | object | `{ storageKey, basePath?, defaultName?, seed?, pinnedPrefix?, transform?, colorDots?, hasRandom? }`. `colorDots(blob)` → array of `{ kind:'solid'\|'gradient'\|'random', value }` dot specs shown per row; `hasRandom(blob)` → bool toggling the ◆ marker. |
| `share` | object | ShareCodec config: `{ stripKeys?, optionalCacheKeys?, heavyKeys?, extraKeys?, quantizableFloatKeys?, decimals? }`. |
| `export` | object\|false | `{ filename?, outlineFonts?, exporter? }`. |
| `shortcuts` | object | `{ 'mod+s': (app) => … }`. |
| `history` | object\|false | `{ maxSize?, debounceMs? }`. |
| `size` | function | `(settings) => ({ width, height })` if the artboard size is derived. |
| `render` | function | **Required.** `(ctx) => void`. Draws into the surface. |
| `snapshot` / `restore` | function | Custom history snapshot shape. Default = settings object. |
| `collectPreset` / `applyPreset` | function | Custom preset blob (defaults to snapshot/restore). |
| `renderSVG` / `renderTo` | function | For canvas tools that export vector / hi-res raster. |
| `onInit` / `onReady` / `syncControls` / `onChromeRefresh` | function | Lifecycle hooks. |

### The render context (`ctx`)

```js
render(ctx) {
  ctx.app        // ApplicationShell instance
  ctx.settings   // settings proxy (ctx.settings.cols)
  ctx.store      // Settings instance (get/set/subscribe)
  ctx.target     // RenderTarget
  ctx.dom        // DOMCache proxy
  ctx.width      // logical artboard width
  ctx.height     // logical artboard height
  ctx.svg        // <svg> element       (svg renderer only)
  ctx.create     // create(tag, attrs)  (svg renderer only)
  ctx.ctx2d      // CanvasRenderingContext2D (canvas renderer only)
}
```

`render` is called on init, on any settings change (coalesced to one rAF), and on
zoom/pan for canvas. The surface is **cleared and sized for you** before each call.

---

## Initialization pipeline

`ApplicationShell.init()` runs, in order:

```
settings → dom cache → render target → sliders → ranges → toggles →
panels(+collapse) → color pickers → dice → tooltips → dialog → exporter →
history + presets → share → shortcuts → change-tracking → preset chrome →
onInit → first render → initZoom → bootstrap presets (seed / #p= / ?preset=) →
onReady
```

**Data flow:** `control → Settings.set → "*" subscription → markDirty + history
debounce + coalesced render → target.beginFrame → render(ctx) → target.endFrame`.

---

## Recipes

### Add a slider
```html
<div class="control-group">
  <label for="gapSlider"><span>Gap <span class="unit">px</span></span>
    <input type="text" class="value-display" id="gapValue" value="8"></label>
  <input type="range" id="gapSlider" min="0" max="40" step="1">
</div>
```
```js
controls: { sliders: [
  { id: 'gapSlider', valueId: 'gapValue', setting: 'gap', min: 0, max: 40, decimals: 0, baseStep: 1, shiftStep: 5 }
]}
```

### Add a dual-handle range slider + dice toggle
```html
<div class="control-group dice-slider-group">
  <label><span>Size
    <button class="dice-btn dice-btn--diamond" id="sizeDice" data-param="size"></button></span>
    <input type="text" class="value-display" id="sizeValue"></label>
  <div class="dice-single" id="sizeSingle"><input type="range" id="sizeSlider" min="0.05" max="1" step="0.01"></div>
  <div class="dice-range" id="sizeRange" style="display:none;">
    <div id="sizeRangeSlider" class="range-slider-container"></div>
    <div class="range-slider-values">
      <input type="text" class="value-display" id="sizeMinValue">
      <input type="text" class="value-display" id="sizeMaxValue">
    </div>
  </div>
</div>
```
```js
controls: {
  sliders: [{ id: 'sizeSlider', valueId: 'sizeValue', setting: 'size', min: 0.05, max: 1, decimals: 2, baseStep: 0.01, shiftStep: 0.1 }],
  ranges:  [{ containerId: 'sizeRangeSlider', minValueId: 'sizeMinValue', maxValueId: 'sizeMaxValue',
              minSetting: 'sizeMin', maxSetting: 'sizeMax', min: 0.05, max: 1, decimals: 2, baseStep: 0.01, shiftStep: 0.1 }]
},
dice: { params: [{ key: 'size', flag: 'randomSize', label: 'Size',
        diceId: 'sizeDice', singleId: 'sizeSingle', rangeId: 'sizeRange',
        min: 0.05, max: 1, decimals: 2, rangeMinKey: 'sizeMin', rangeMaxKey: 'sizeMax' }] }
```
The dice flips `randomSize` and swaps the single ↔ range control. `app.dice.randomize()`
rolls fresh values for every enabled parameter.

### Add a toggle
```html
<label class="toggle-chip"><input type="checkbox" id="showGrid" data-setting="showGrid"><span>Grid</span></label>
```
No JS — `data-setting` auto-binds (set `controls.toggles: false` to opt out).

### Add color pickers

Two modes are supported.

**Simple** — one standalone HSB picker per container:
```html
<span class="color-swatch" id="swatch"></span>
<div id="colorPicker"></div>
```
```js
colorPickers: [{ containerId: 'colorPicker', setting: 'color' }]
// Toggle visibility from a swatch:
app.colorPickers.find(p => p.def.setting === 'color').picker.toggle();
```

**Unified** (recommended) — a single HSB picker shared across swatch rows,
where only one row expands at a time, each row has a round preview dot on the
left and its own hex `<input>`, and the active row gets a highlighted plate.
Use the `.color-swatch-row` / `.color-swatch-compact` / `.color-hsb-slot`
markup, with one row's slot holding the shared container:
```html
<div class="color-swatches-compact">
  <div class="color-swatch-row">
    <div class="color-swatch-compact" id="shapeColorItem" data-color-type="shape">
      <button class="color-dot color-dot--expandable" id="shapeColorPreview"></button>
      <span class="color-label">Shape</span>
      <input class="color-swatch-hex" id="shapeColorHex">
    </div>
    <div class="color-hsb-slot" id="shapeColorHsbSlot">
      <div id="unifiedColorPickerContainer"></div>
    </div>
  </div>
  <!-- more rows; their .color-hsb-slot stays empty -->
</div>
```
```js
colorPickers: {
  containerId: 'unifiedColorPickerContainer',
  swatches: [
    { type: 'shape', setting: 'color', itemId: 'shapeColorItem', dotId: 'shapeColorPreview', hexId: 'shapeColorHex', hsbSlotId: 'shapeColorHsbSlot' }
    // ...one entry per row
  ]
}
// Access the controller via app.unifiedColorPicker (e.g. .sync()).
```

### Enable presets, sharing and export
```js
presets: { storageKey: 'myTool', basePath: 'presets' },   // reads presets/manifest.json
share:   { quantizableFloatKeys: ['size'] },               // shorter share URLs
export:  { filename: 'art.svg' }
```
Provide a `presets/manifest.json` (`{ "presets": [{ "name", "file" }] }`) and one JSON
per preset (the saved settings blob). The framework renders the full preset dropdown
and management UI:

- **+ New** — reset to clean defaults (becomes "Unsaved*" once edited);
- **Save** — update the current preset, or save the New/shared state under a name;
- **Share** — copy a share link, both from the toolbar and per row (◧ icon);
- **Rename** / **Delete** — per-row actions;
- **× delete all** — remove every saved preset;
- **↻ restore default presets** — wipe and reseed the shipped library;
- per-row **color dots** + **◆ random marker** via the `colorDots` / `hasRandom` hooks;
- the unsaved-changes guard dialog and `?preset=slug` / `#p=…` URL routing.

All of this is also reachable programmatically: `app.savePreset()`,
`app.restoreDefaultPresets()`, and `app.presets.{openNew,switchTo,saveAs,delete,deleteAll,rename}()`.

### Custom keyboard shortcut
```js
shortcuts: { 'mod+s': (app) => app.savePreset(), 'shift+r': (app) => app.dice.randomize() }
```

---

## Render targets

| | `SvgTarget` | `CanvasTarget` |
|--|-------------|----------------|
| Draw with | `ctx.create(tag, attrs)` → `ctx.svg.appendChild(...)` | `ctx.ctx2d` in logical coords |
| Zoom/pan | `ZoomPanManager` (vector viewBox) | DPR-aware transform |
| Export | native SVG/PDF via `SVGExporter`; PNG via rasterise | PNG direct; SVG via `config.renderSVG` |

Pick `renderer: 'canvas'` for pixel/perf-heavy tools (like Void), `'svg'` for vector
tools that want crisp SVG/PDF export for free.

---

## Migration v2 → v3

| v2 | v3 |
|----|----|
| Copy `AppTemplate.js`, rewrite `init()` | Write a `defineTool({...})` config |
| `new Settings(defaults)` + manual proxy | `settings:` block (proxy auto-created, + dirty tracking) |
| Manual `initSliders/initPanels/...` | `controls`, `panels`, `colorPickers` arrays |
| `update()` method | `render(ctx)` function |
| `getStateSnapshot()/restoreState()` | `snapshot`/`restore` (default = settings) |
| Manual zoom wiring | automatic via render target + `dom.zoomIndicator` |
| manifest-based PresetManager | `PresetStore` (localStorage) + `PresetSession` |
| — (no sharing) | `share:` block → `ShareCodec` |
| — (no range sliders / dice) | `controls.ranges` + `dice` |
| — (overlay modals) | native `<dialog>` `DialogHost` |

The UI components (`SliderController`, `PanelManager`, `ColorPicker`, `ZoomPanManager`)
keep the same public API, so existing markup and per-component calls still work.

---

## What's generic vs app-specific

v3 ships **only generic** building blocks. Domain logic stays in your tool:

- **In the framework:** all of `src/` + the design-system CSS.
- **In your app:** the `render(ctx)` body, the settings schema, control registries,
  preset library, and any domain modules (for Void: the glyph renderer, alphabet,
  module drawer, endpoint detector, glyph editor — none of which belong here).

For tools with bespoke randomisation or snapshot shapes, supply `snapshot`/`restore`
and `collectPreset`/`applyPreset`, and feed `ShareCodec` your `stripKeys` /
`optionalCacheKeys` / `quantizableFloatKeys`.

---

## Gotchas

1. **Serve over HTTP** — ES modules need it.
2. **Leave the `<svg>`/`<canvas>` empty in HTML** — `render()` populates it; the target
   sizes it. Hardcoded content breaks zoom dimensions.
3. **Set every adjustable value in `settings`** — HTML `value` attributes are overridden
   on init, and the pristine defaults drive share-diffing and history.
4. **Preset loads / undo apply silently** — UI re-sync happens in `_syncControls`; for
   custom widgets, use the `syncControls(app)` hook.
5. **PDF export & outline fonts load from CDN** (jsPDF, opentype.js) on first use.
6. **Re-theme via `tokens.css`** — override the `--color-*` / `--spacing-*` custom
   properties; don't fork component CSS.
```
