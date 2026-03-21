# YF UI Framework v2

Dark-themed SVG canvas toolkit for building interactive design tools (grid generators, packaging layout editors, etc.). Extracted and generalized from the [Pizza Boxer grid generator](../grid_generator/).

## Quick Start

1. Copy `v2/` into your project folder.
2. Rename `AppTemplate` class → your tool class.
3. Replace `update()` with your rendering logic.
4. Edit `index.html`: keep the shell, change panel contents.
5. Serve via HTTP (`python3 -m http.server`). **ES modules require a server — `file://` won't work.**

```
your-tool/
├── index.html              ← entry point (loads AppTemplate via <script type="module">)
├── css/yf-styles.css       ← full design system (dark theme, all components)
├── fonts/                  ← TT Commons Classic (400/500), Lunnen Display (variable)
└── src/
    ├── AppTemplate.js      ← wiring example — copy & customize
    ├── core/
    │   ├── Settings.js     ← reactive key-value store
    │   └── DOMCache.js     ← DOM element cache with Proxy
    ├── ui/
    │   ├── ZoomPanManager.js   ← SVG viewBox zoom/pan (Figma-like)
    │   ├── SliderController.js ← range sliders with keyboard, lock, units
    │   ├── PanelManager.js     ← draggable panels, z-index, open/close
    │   ├── ColorPicker.js      ← HSB picker with hex input
    │   └── DragDropManager.js  ← SVG element drag & drop (zoom-aware)
    ├── history/
    │   └── HistoryManager.js   ← undo/redo (snapshot-based)
    ├── preset/
    │   └── PresetManager.js    ← dropdown presets from manifest.json
    ├── export/
    │   └── SVGExporter.js      ← SVG/PDF export, JSON import/export
    └── utils/
        ├── ColorUtils.js   ← HEX↔RGB↔HSB conversions
        ├── MathUtils.js    ← clamp, lerp, roundTo, etc.
        ├── DOMUtils.js     ← DOM helpers
        └── TextToPath.js   ← <text> → <path> via opentype.js (Outline fonts)
```

---

## Architecture

### Initialization Order (in `init()`)

```
1. DOMCache.init()          ← cache DOM elements
2. initSliders()            ← register sliders, sync with Settings
3. initPanels()             ← register draggable panels
4. initColorPicker()        ← HSB picker bound to a setting key
5. initHistory()            ← undo/redo manager
6. initPresets()            ← preset dropdown
7. initExporter()           ← SVG/PDF exporter
8. initCheckboxes()         ← toggle chips ↔ Settings binding
9. initCollapse()           ← panel collapse icons
10. initObjectPropertiesPanel() ← floating properties panel
11. initObjectSelection()   ← canvas click → show properties
12. initButtons()           ← export/import buttons
13. initModals()            ← modal open/close/Escape
14. initKeyboardShortcuts() ← Cmd+Z, Cmd+Shift+Z, Cmd+E
15. update()                ← first render (sets SVG viewBox, width, height)
16. initZoom()              ← ZoomPanManager + fitToScreen
```

**Critical:** `update()` MUST run before `initZoom()` so SVG has correct dimensions.

### Data Flow

```
User interaction → SliderController / ColorPicker / checkbox
                 → Settings.set(key, value)
                 → callback → update()
                 → SVG re-render
                 → ZoomPanManager.reinitializeSVGDimensions()
```

---

## Module Reference

### Settings (`src/core/Settings.js`)

Reactive key-value store. All app state lives here.

| Method | Description |
|--------|-------------|
| `constructor(defaults)` | Initialize with default values object |
| `get(key)` | Get value |
| `set(key, value, silent?)` | Set value; `silent=true` skips notifications |
| `setMultiple(updates, silent?)` | Batch update |
| `subscribe(key, callback)` | Subscribe to changes; `'*'` for all. Returns unsubscribe function |
| `reset()` | Restore all defaults |
| `toJSON()` / `fromJSON(json)` | Serialize / deserialize |
| `createProxy()` | Returns Proxy for `settings.width` syntax |

### DOMCache (`src/core/DOMCache.js`)

Caches `document.getElementById` calls.

```js
this.domCache.init({ svg: 'mainSvg', canvas: 'canvasContainer' });
this.dom = this.domCache.createProxy();
this.dom.svg  // → document.getElementById('mainSvg')
```

### ZoomPanManager (`src/ui/ZoomPanManager.js`)

SVG viewBox-based zoom and pan (vector, not CSS transform).

| Feature | Input |
|---------|-------|
| Zoom | Cmd/Ctrl + Scroll (centered on cursor) |
| Pan | Scroll/Swipe, or Space + Drag, or Middle mouse + Drag |
| Fit to screen | Cmd/Ctrl + 0 |
| Reset 100% | Cmd/Ctrl + 1 |
| Zoom in/out | Cmd/Ctrl + Plus/Minus |

Key methods: `fitToScreen()`, `resetZoom()`, `reinitializeSVGDimensions()`, `getZoomPercent()`, `destroy()`.

Constructor (third argument):

```js
new ZoomPanManager(container, svg, {
  fitPadding: { top: 20, right: 20, bottom: 20, left: 20 }
});
```

`fitPadding` — inset **inside** `#canvasContainer` (the flex slot between top bar and bottom bar). Defaults are small margins so the artboard fills that slot at “100%” zoom after `fitToScreen()`, matching the original grid tool idea. Wider side panels do not shrink the container rect — only adjust padding if you add chrome **inside** the canvas area.

**Important:** After changing SVG content/size in `update()`, call `reinitializeSVGDimensions()` so zoom calculations use correct dimensions.

### SliderController (`src/ui/SliderController.js`)

Manages `<input type="range">` + `<input type="text">` pairs.

```js
this.sliders.initSlider('widthSlider', {
    valueId:  'widthValue',   // text input ID
    setting:  'width',        // Settings key
    min: 50, max: 1000,
    decimals: 1,
    baseStep: 0.5,            // Arrow key step
    shiftStep: 10,            // Shift+Arrow step
    suffix: '',               // e.g. '°' or '%'
    onUpdate: () => this.update()
});
// Sync slider to Settings value on init:
this.sliders.setValue('widthSlider', this.settingsStore.get('width'), false);
```

Supports: keyboard arrows, Shift for large step, direct text input (Enter to apply, Escape to cancel), lock buttons.

### PanelManager (`src/ui/PanelManager.js`)

Draggable panels with z-index management.

```js
this.panels.registerPanel('mainPanel', {
    headerId:   'mainPanelHeader',
    draggable:  true,
    persistent: true   // persistent panels are not closed by closeAll()
});
this.panels.open('graphicsPanel');
this.panels.close('graphicsPanel');
this.panels.bringToFront('graphicsPanel');
```

### ColorPicker (`src/ui/ColorPicker.js`)

HSB color picker with hex input. Stores color in Settings.

```js
this.colorPicker = new ColorPicker(this.settingsStore, {
    settingKey:   'color',        // Settings key (default: 'color')
    defaultColor: '#808080',
    onChange:      (hex) => this.update()
});
this.colorPicker.init();
```

Required HTML IDs: `colorPreview`, `hexColorInput`, `hsbPicker`, `hueSlider`, `saturationSlider`, `brightnessSlider`, `hueValue`, `saturationValue`, `brightnessValue`.

Toggle: click on `#colorPreview` circle → HSB sliders expand/collapse.

### DragDropManager (`src/ui/DragDropManager.js`)

Drag & drop for SVG elements. Uses `getScreenCTM().inverse()` for correct coordinates at any zoom level.

```js
this.dragDrop = new DragDropManager({
    svgSelector: '#mainSvg',
    snapFunction: (x, y) => ({ x: Math.round(x), y: Math.round(y) }),
    onDragStart: (id, type, data) => {},
    onDrag:      (id, type, dx, dy, data) => {},
    onDragEnd:   (id, type, position, data) => {}
});
```

### HistoryManager (`src/history/HistoryManager.js`)

Snapshot-based undo/redo.

```js
this.historyManager = new HistoryManager({ maxSize: 50 });
// After each user action:
this.historyManager.commitAction(this.getStateSnapshot());
// Undo/redo:
const prev = this.historyManager.undo();  // returns snapshot or null
const next = this.historyManager.redo();
```

### PresetManager (`src/preset/PresetManager.js`)

Loads presets from `presets/manifest.json`.

```json
// presets/manifest.json
{ "presets": [{ "name": "Default", "file": "default.json" }] }
```

```js
this.presetManager = new PresetManager({
    dropdown:       document.getElementById('presetDropdown'),
    dropdownToggle: document.getElementById('presetDropdownToggle'),
    dropdownMenu:   document.getElementById('presetDropdownMenu'),
    onPresetLoad:   (data) => { this.settingsStore.fromJSON(data); this.update(); }
});
this.presetManager.init();
```

### SVGExporter (`src/export/SVGExporter.js`)

Export SVG to file, PDF (via CDN jsPDF + svg2pdf), JSON import/export.

**Export is always the full logical artboard**, not the current on-screen crop. `ZoomPanManager` changes the live `viewBox` for zoom/pan; before serialization, `normalizeSvgForExport()` resets the clone to `viewBox="0 0 width height"` using numeric `width`/`height` on the root `<svg>` (set these in `update()`). Zoom and pan never affect the downloaded file.

Fallback if `width`/`height` are missing: `data-export-width` / `data-export-height`, then 500×500 with a console warning.

```js
this.svgExporter = new SVGExporter({ textToPath: myTextToPathInstance }); // optional
await this.svgExporter.exportToFile(svg, 'export.svg', {
    removeInteractive: true,
    convertTextToOutlines: true  // requires textToPath
});
await this.svgExporter.exportToPDF(svg, 'export.pdf', { unit: 'mm' });
this.svgExporter.exportJSON(data, 'settings.json');
const imported = await this.svgExporter.importJSON(file);
```

### TextToPath (`src/utils/TextToPath.js`)

Converts all `<text>` nodes to `<path>` using opentype.js (CDN) and font files under `fonts/`. Map `font-family` + `font-weight` to files via `fontPaths` (constructor option to extend/override). For outline export, `<text>` must use a font declared in `fontPaths` (template uses TT Commons Classic 400).

---

## HTML Structure

### Required IDs

The framework expects these HTML element IDs (all optional — missing ones are silently skipped):

**Canvas:** `canvasContainer`, `mainSvg`
**Zoom:** `zoomIndicator`
**Presets:** `presetDropdown`, `presetDropdownToggle`, `presetDropdownMenu`
**Color picker:** `colorPreview`, `hexColorInput` (add class `hex-color-input` for styling), `hsbPicker`, `hueSlider`, `saturationSlider`, `brightnessSlider`, `hueValue`, `saturationValue`, `brightnessValue`
**Export:** `exportSvgBtn`, `convertToOutlinesCheckbox`
**Object properties:** `objectPropertiesPanel`, `objectPropertiesPanelHeader`, `objectPropertiesPanelTitle`, `objectPropertiesCloseBtn`, `objectPropertiesInfo`, `objectNameInput`, `objectVisibleCheckbox`
**Modal:** `modalOverlay` (class `modal-overlay`, toggled via class `active`)

### Object Selection Pattern

Add `data-object-id` and `data-object-type` to SVG elements to make them clickable:

```js
rect.setAttribute('data-object-id', 'my-rect-1');
rect.setAttribute('data-object-type', 'shape');
```

Click on such element → `objectPropertiesPanel` opens next to it. Click outside → panel closes.

### Toggle Chips (layer visibility)

```html
<input type="checkbox" id="showGrid" data-setting="showGrid" checked>
```

The `data-setting` attribute links the checkbox to `Settings`. AppTemplate auto-binds all `.toggle-chip input[type="checkbox"]` elements.

### Outline Fonts Toggle

Located in bottom buttons next to Export SVG. When checked, `exportSVG()` passes `convertTextToOutlines: true` to `SVGExporter`. Requires `textToPath` instance in `SVGExporter` constructor for actual conversion.

---

## CSS Design System (`css/yf-styles.css`)

- **Theme:** Dark (`#000` bg, `#1a1a1a` panels, `#fff` text)
- **Fonts:** TT Commons Classic (UI), Lunnen Display (decorative)
- **Variables:** All colors, spacing, radii, transitions are CSS custom properties in `:root`
- **Sections:** 30 numbered sections (font-face → responsive)

Key CSS classes:

| Class | Purpose |
|-------|---------|
| `.controls-panel` | Fixed-position side panel |
| `.controls-panel-left` | Left-positioned panel |
| `.paragraph-settings-panel` | Floating panel (hidden by default, `.active` to show) |
| `.panel-collapsed` | Panel with collapsed body |
| `.toggle-chip` | Pill-shaped checkbox with icon |
| `.segmented-control` | Radio button group styled as tabs |
| `.hsb-picker` | Color picker container |
| `.hex-color-input` | Styled hex color text input |
| `.modal-overlay` / `.modal-overlay.active` | Modal backdrop |
| `.toggle-switch` / `.toggle-slider` | iOS-style toggle (used for Outline fonts) |

---

## Common Patterns

### Creating a New Tool

```js
import { Settings } from './core/Settings.js';
// ... other imports

class MyTool {
    constructor() {
        this.settingsStore = new Settings({
            width: 500, height: 300,
            gridSize: 10, color: '#82A9D9',
            showGrid: true
        });
        this.settings = this.settingsStore.createProxy();
        // ... same init pattern as AppTemplate
    }

    update() {
        const svg = this.dom.svg;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const w = this.settings.width;
        const h = this.settings.height;
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        // ... your rendering logic
        if (this.zoomPan) this.zoomPan.reinitializeSVGDimensions();
    }
}
```

### Adding a New Slider

1. Add HTML in panel:
```html
<div class="control-group">
    <label for="gridSizeSlider">
        <span>Grid Size <span class="unit">mm</span></span>
        <input type="text" class="value-display" id="gridSizeValue" value="10">
    </label>
    <input type="range" id="gridSizeSlider" min="1" max="50" step="1" value="10">
</div>
```

2. Register in JS:
```js
this.sliders.initSlider('gridSizeSlider', {
    valueId: 'gridSizeValue', setting: 'gridSize',
    min: 1, max: 50, decimals: 0, baseStep: 1, shiftStep: 5,
    onUpdate: () => this.update()
});
this.sliders.setValue('gridSizeSlider', this.settingsStore.get('gridSize'), false);
```

### Adding a Floating Properties Panel

1. Add `<aside class="controls-panel paragraph-settings-panel" id="myPanel" style="display:none;">` to HTML.
2. Register: `this.panels.registerPanel('myPanel', { headerId: 'myPanelHeader', draggable: true, persistent: false });`
3. Show: `this.panels.open('myPanel');`

---

## Known Gotchas

1. **ES modules need HTTP server.** `file://` protocol blocks `import` statements (CORS).
2. **SVG element must be empty in HTML.** `update()` populates it; hardcoded content causes size mismatch with ZoomPanManager.
3. **Call `reinitializeSVGDimensions()` after changing SVG size** in `update()`, otherwise zoom/pan uses stale dimensions.
4. **`initZoom()` must run after first `update()`** so SVG has correct `width`/`height` attributes for `fitToScreen()`.
5. **Slider HTML `value` attributes are overridden** by `setValue()` during init. Don't rely on HTML defaults — set them in Settings constructor.
6. **`hexColorInput` needs class `hex-color-input`** for dark-themed styling (CSS uses class selector, not ID).
7. **PresetManager expects `presets/manifest.json`** relative to `index.html`. If no presets, it logs a warning and shows "No presets available".
8. **PDF export loads jsPDF + svg2pdf from CDN** on first call. Requires internet connection.
9. **Outline fonts** loads opentype.js from CDN and font files from `fonts/`; offline export of outlined text needs those assets cached or self-hosted.
10. **`dominant-baseline` on `<text>`** is not fully emulated in TextToPath — for pixel-perfect baseline, adjust Y after conversion or extend `TextToPath`.
