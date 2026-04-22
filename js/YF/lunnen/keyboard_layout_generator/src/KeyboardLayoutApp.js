/**
 * KeyboardLayoutApp -- Keyboard Layout Generator
 *
 * Iteration 4a: real typography on keys.
 *   - YSText-Regular from /fonts is loaded via @font-face and used for every
 *     text element on the keyboard graphic (not for the framework UI).
 *   - renderKeyTypography places label / base / shift / ru / ruShift in the
 *     four corners of the key, anchored to an inner padding rectangle that
 *     doubles as the safeguard zone (iteration 4c will make it visible).
 *   - New sliders: Char / Shift char / Label font sizes + Inner pad (all mm).
 *
 * Previously from 3b: key/row CRUD + basic label rendering.
 *   - Inspector adds Key actions (delete / duplicate / move left-right) and
 *     Row actions (delete row / add row above-below / move row up-down).
 *   - Selection overlay is marked as interactive so SVGExporter strips it
 *     out of exported files.
 *
 * Previously from 3a:
 *   - Template (row/key structure) lives in Settings.template as mutable data,
 *     initialized from a deep clone of TEMPLATES[DEFAULT_TEMPLATE_ID].
 *   - Click any key on canvas to select it; click empty area to deselect.
 *   - Inspector exposes per-key id (readonly), label, kind, and absolute mm
 *     overrides for width (wMm) and height (hMm).
 *
 * From iteration 2:
 *   - Declarative row templates with non-standard key widths.
 *   - Fn-row with separate height.
 *   - Additional column (home/end/pgup/pgdn) for laptop-14.
 *   - Arrow cluster in bottom row; absorbs slack into ctrl_r unless ctrl_r has
 *     an explicit wMm override.
 *   - All sizes in mm (1 SVG unit = 1 mm); SVG export preserves the mm unit.
 *   - Two color pickers, layered rendering, presets, SVG/JSON export.
 */

import { Settings }         from '../yf-ui-framework/src/core/Settings.js';
import { DOMCache }         from '../yf-ui-framework/src/core/DOMCache.js';
import { ZoomPanManager }   from '../yf-ui-framework/src/ui/ZoomPanManager.js';
import { SliderController } from '../yf-ui-framework/src/ui/SliderController.js';
import { PanelManager }     from '../yf-ui-framework/src/ui/PanelManager.js';
import { ColorPicker }      from '../yf-ui-framework/src/ui/ColorPicker.js';
import { HistoryManager }   from '../yf-ui-framework/src/history/HistoryManager.js';
import { PresetManager }    from '../yf-ui-framework/src/preset/PresetManager.js';
import { SVGExporter }      from '../yf-ui-framework/src/export/SVGExporter.js';
import { TextToPath }       from '../yf-ui-framework/src/utils/TextToPath.js';
import { ColorUtils }       from '../yf-ui-framework/src/utils/ColorUtils.js';
import { computeLayout }    from './layout/layoutEngine.js';
import { TEMPLATES, DEFAULT_TEMPLATE_ID } from './data/rowTemplates.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Deep clone a plain object (used for making template mutable). */
const clone = (o) => JSON.parse(JSON.stringify(o));

const DEFAULTS = {
    /* SVG size from computeLayout: backdrop = keyboard + Geometry padding. */

    /* Device template id (informational; actual structure lives in `template`) */
    templateId: DEFAULT_TEMPLATE_ID,

    /* Live, editable template. Starts as a deep clone of the default device. */
    template: clone(TEMPLATES[DEFAULT_TEMPLATE_ID]),

    /* Base key geometry (exact from ground_14.svg: pt * 25.4 / 72 = mm) */
    keyWidth:  16.8063,   // 47.6400146 pt
    keyHeight: 16.6764,   // 47.2716272 pt
    gapX:       1.5769,   //  4.4700318 pt
    gapY:       2.1220,   //  6.0151934 pt
    radius:     2.1554,   //  6.1098343 pt
    padding:    2.6480,   //  7.5061725 pt

    /* Fn-row specific */
    fnRowH: 10.9166,      // 30.9448286 pt
    fnGap:   2.1220,      // same as gapY

    /* Typography (mm; 1 pt = 25.4/72 mm).
       Defaults mirror ground_14.svg:
         char       15 pt -> 5.2917 mm  (.st5: Q, ?, 1, ...)
         shift char 12 pt -> 4.2333 mm  (.st3: !, @, #, ...)
         label       9 pt -> 3.1750 mm  (.st6: caps lock, shift, fn, alt, ctrl) */
    fontChar:  5.2917,
    fontShift: 4.2333,
    fontLabel: 3.1750,
    padKeyMm:  2.50,      // Inner padding used for text placement anchors
    fontColor: '#e6e7e8', // Matches ground_14.svg .st5/.st6 color

    /* Colors */
    backdropFill: '#131313',
    keyFill:      '#303030',

    /* Layers */
    showBackdrop:  true,
    showKeys:      true,
    showSafeguard: false
};

/**
 * Walk the template and locate a key by id.
 * Returns { key, row, list, index } or null if not found.
 * `list` is the array the key belongs to (row.keys | row.arrowCluster | null
 * for additionalKey).
 */
function findKeyInTemplate(template, keyId) {
    if (!template?.rows) return null;
    for (const row of template.rows) {
        if (Array.isArray(row.keys)) {
            const i = row.keys.findIndex(k => k.id === keyId);
            if (i !== -1) return { key: row.keys[i], row, list: row.keys, index: i };
        }
        if (Array.isArray(row.arrowCluster)) {
            const i = row.arrowCluster.findIndex(k => k.id === keyId);
            if (i !== -1) return { key: row.arrowCluster[i], row, list: row.arrowCluster, index: i };
        }
        if (row.additionalKey && row.additionalKey.id === keyId) {
            return { key: row.additionalKey, row, list: null, index: -1 };
        }
    }
    return null;
}

class KeyboardLayoutApp {

    constructor(overrides = {}) {
        this.settingsStore = new Settings({ ...DEFAULTS, ...overrides });
        this.settings      = this.settingsStore.createProxy();

        this.domCache = new DOMCache();
        this.dom      = null;

        this.state = { isInitialized: false, isUpdating: false, selectedKeyId: null };
        this.lastLayout = null;   // Cached layout from most recent update (for inspector lookups)
        this.inspector  = null;   // DOM refs + helpers, populated in initInspector()
        this.historyDebounce = null; // Pending timer for coalesced slider/color pushes

        this.zoomPan        = null;
        this.sliders        = null;
        this.panels         = null;
        this.backdropPicker = null;
        this.historyManager = null;
        this.presetManager  = null;
        this.svgExporter    = null;
        this.textToPath     = null;
    }

    /* ============================================================ */
    /*  Init                                                        */
    /* ============================================================ */

    async init() {
        this.domCache.init({
            svg:                  'mainSvg',
            canvas:               'canvasContainer',
            zoomIndicator:        'zoomIndicator',
            presetDropdown:       'presetDropdown',
            presetDropdownToggle: 'presetDropdownToggle',
            presetDropdownMenu:   'presetDropdownMenu'
        });
        this.dom = this.domCache.createProxy();

        this.initSliders();
        this.initPanels();
        this.initColorPickers();
        this.initHistory();
        this.initPresets();
        this.initExporter();
        this.initCheckboxes();
        this.initCollapse();
        this.initButtons();
        this.initModals();
        this.initKeyboardShortcuts();
        this.initInspector();
        this.initCanvasSelection();
        this.initTemplateActions();

        this.update();
        this.initZoom();

        // Seed history with the initial snapshot so the very first edit is undoable.
        this.pushHistory('initial');

        this.state.isInitialized = true;
        console.log('[KeyboardLayoutApp] initialized - iteration 4a');
    }

    /* ------------------------------------------------------------ */
    /*  Sliders                                                     */
    /* ------------------------------------------------------------ */

    initSliders() {
        this.sliders = new SliderController(this.settingsStore);

        const reg = (id, valueId, setting, opts) => {
            this.sliders.initSlider(id, {
                valueId,
                setting,
                decimals:  opts.decimals  ?? 1,
                baseStep:  opts.baseStep  ?? 0.5,
                shiftStep: opts.shiftStep ?? 5,
                onUpdate:  () => {
                    this.update();
                    // Coalesce rapid slider-drag events into a single history entry.
                    this.schedulePushHistory(`slider:${setting}`);
                },
                min: opts.min,
                max: opts.max
            });
            this.sliders.setValue(id, this.settingsStore.get(setting), false);
        };

        // decimals: 2 preserves mm precision to ~0.01 mm (step 0.01). Sub-step precision
        // (e.g. 16.8063) is stored in Settings verbatim; only the slider thumb snaps.
        reg('keyWidthSlider',  'keyWidthValue',  'keyWidth',  { min: 5,  max: 40, decimals: 2, baseStep: 0.01, shiftStep: 0.5 });
        reg('keyHeightSlider', 'keyHeightValue', 'keyHeight', { min: 5,  max: 40, decimals: 2, baseStep: 0.01, shiftStep: 0.5 });
        reg('keyGapXSlider',   'keyGapXValue',   'gapX',      { min: 0,  max: 8,  decimals: 2, baseStep: 0.01, shiftStep: 0.5 });
        reg('keyGapYSlider',   'keyGapYValue',   'gapY',      { min: 0,  max: 8,  decimals: 2, baseStep: 0.01, shiftStep: 0.5 });
        reg('keyRadiusSlider', 'keyRadiusValue', 'radius',    { min: 0,  max: 10, decimals: 2, baseStep: 0.01, shiftStep: 0.5 });
        reg('paddingSlider',   'paddingValue',   'padding',   { min: 0,  max: 30, decimals: 2, baseStep: 0.05, shiftStep: 1 });
        reg('fnRowHSlider',    'fnRowHValue',    'fnRowH',    { min: 3,  max: 25, decimals: 2, baseStep: 0.01, shiftStep: 0.5 });
        reg('fnGapSlider',     'fnGapValue',     'fnGap',     { min: 0,  max: 15, decimals: 2, baseStep: 0.01, shiftStep: 0.5 });

        reg('fontCharSlider',  'fontCharValue',  'fontChar',  { min: 1,  max: 12, decimals: 2, baseStep: 0.05, shiftStep: 0.5 });
        reg('fontShiftSlider', 'fontShiftValue', 'fontShift', { min: 1,  max: 10, decimals: 2, baseStep: 0.05, shiftStep: 0.5 });
        reg('fontLabelSlider', 'fontLabelValue', 'fontLabel', { min: 1,  max: 8,  decimals: 2, baseStep: 0.05, shiftStep: 0.5 });
        reg('padKeySlider',    'padKeyValue',    'padKeyMm',  { min: 0,  max: 8,  decimals: 2, baseStep: 0.05, shiftStep: 0.5 });
    }

    /* ------------------------------------------------------------ */
    /*  Panels                                                      */
    /* ------------------------------------------------------------ */

    initPanels() {
        this.panels = new PanelManager();
        this.panels.registerPanel('mainPanel',       { headerId: 'mainPanelHeader',      draggable: true, persistent: true });
        this.panels.registerPanel('secondaryPanel',  { headerId: 'secondaryPanelHeader', draggable: true, persistent: true });
        this.panels.registerPanel('objectPropertiesPanel', { headerId: 'objectPropertiesPanelHeader', draggable: true, persistent: false });
    }

    /* ------------------------------------------------------------ */
    /*  Color pickers                                               */
    /* ------------------------------------------------------------ */

    initColorPickers() {
        // Backdrop (standard framework ColorPicker -- uses fixed element IDs)
        this.backdropPicker = new ColorPicker(this.settingsStore, {
            settingKey:   'backdropFill',
            defaultColor: DEFAULTS.backdropFill,
            onChange:     () => {
                this.update();
                this.schedulePushHistory('color:backdrop');
            }
        });
        this.backdropPicker.init();

        // Key fill (manual wire-up since ColorPicker has only one fixed ID set)
        this.initKeyColorPicker();
    }

    initKeyColorPicker() {
        const preview  = document.getElementById('keyColorPreview');
        const hexInput = document.getElementById('keyHexColorInput');
        const picker   = document.getElementById('keyHsbPicker');
        const hueSlider = document.getElementById('keyHueSlider');
        const satSlider = document.getElementById('keySaturationSlider');
        const briSlider = document.getElementById('keyBrightnessSlider');
        const hueVal = document.getElementById('keyHueValue');
        const satVal = document.getElementById('keySaturationValue');
        const briVal = document.getElementById('keyBrightnessValue');

        if (!preview || !hexInput || !picker) return;

        let hsb  = { h: 0, s: 0, b: 0 };
        let busy = false;

        const syncUI = (hex) => {
            busy = true;
            if (preview)  preview.style.backgroundColor = hex;
            if (hexInput) hexInput.value = hex;
            if (hueSlider) hueSlider.value = hsb.h;
            if (satSlider) satSlider.value = hsb.s;
            if (briSlider) briSlider.value = hsb.b;
            if (hueVal) hueVal.value = String(hsb.h);
            if (satVal) satVal.value = String(hsb.s);
            if (briVal) briVal.value = String(hsb.b);
            this.updateKeyGradients(hsb, hueSlider, satSlider, briSlider);
            busy = false;
        };

        // setHex(hex, triggerUpdate) -- shared setter for both user action and init
        const setHex = (hex, triggerUpdate) => {
            if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
            const rgb = ColorUtils.hexToRgb(hex);
            if (!rgb) return;
            hsb = ColorUtils.rgbToHsb(rgb.r, rgb.g, rgb.b);
            syncUI(hex);
            this.settingsStore.set('keyFill', hex);
            if (triggerUpdate) {
                this.update();
                this.schedulePushHistory('color:key');
            }
        };

        const fromHSB = () => {
            if (busy) return;
            const rgb = ColorUtils.hsbToRgb(hsb.h, hsb.s, hsb.b);
            const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
            syncUI(hex);
            this.settingsStore.set('keyFill', hex);
            this.update();
            this.schedulePushHistory('color:key');
        };

        preview.addEventListener('click', () => {
            picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
        });
        hexInput.addEventListener('input', (e) => {
            if (!busy) setHex(e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value, true);
        });
        if (hueSlider) hueSlider.addEventListener('input', (e) => { hsb.h = +e.target.value; fromHSB(); });
        if (satSlider) satSlider.addEventListener('input', (e) => { hsb.s = +e.target.value; fromHSB(); });
        if (briSlider) briSlider.addEventListener('input', (e) => { hsb.b = +e.target.value; fromHSB(); });
        document.addEventListener('click', (e) => {
            if (picker.style.display === 'none') return;
            if (picker.contains(e.target) || preview.contains(e.target)) return;
            picker.style.display = 'none';
        });

        // Init: sync UI only, do NOT call update() -- main init() will call it later
        setHex(this.settingsStore.get('keyFill') || DEFAULTS.keyFill, false);
    }

    updateKeyGradients(hsb, hueSlider, satSlider, briSlider) {
        if (!hueSlider) return;
        hueSlider.style.background =
            'linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)';
        if (satSlider) {
            const full = ColorUtils.hsbToRgb(hsb.h, 100, hsb.b);
            const gray = ColorUtils.hsbToRgb(hsb.h, 0,   hsb.b);
            satSlider.style.background = `linear-gradient(to right,${ColorUtils.rgbToHex(gray.r,gray.g,gray.b)},${ColorUtils.rgbToHex(full.r,full.g,full.b)})`;
        }
        if (briSlider) {
            const bright = ColorUtils.hsbToRgb(hsb.h, hsb.s, 100);
            briSlider.style.background = `linear-gradient(to right,#000000,${ColorUtils.rgbToHex(bright.r,bright.g,bright.b)})`;
        }
    }

    /* ------------------------------------------------------------ */
    /*  Zoom                                                        */
    /* ------------------------------------------------------------ */

    initZoom() {
        const svg    = this.dom.svg;
        const canvas = this.dom.canvas;
        this.zoomPan = new ZoomPanManager(canvas, svg, {
            fitPadding: { top: 24, right: 24, bottom: 24, left: 24 }
        });
        canvas.addEventListener('zoomchange', () => {
            const ind = this.dom.zoomIndicator;
            if (ind) ind.textContent = `${this.zoomPan.getZoomPercent()}%`;
        });
        const ind = this.dom.zoomIndicator;
        if (ind) ind.addEventListener('click', () => this.zoomPan.fitToScreen());
        this.zoomPan.fitToScreen();
    }

    /* ------------------------------------------------------------ */
    /*  History / Presets / Exporter                                */
    /* ------------------------------------------------------------ */

    initHistory() {
        this.historyManager = new HistoryManager({ maxSize: 50 });
    }

    initPresets() {
        this.presetManager = new PresetManager({
            dropdown:       this.dom.presetDropdown,
            dropdownToggle: this.dom.presetDropdownToggle,
            dropdownMenu:   this.dom.presetDropdownMenu,
            onPresetLoad:   (data) => {
                try {
                    // PresetManager passes a parsed object; Settings.fromJSON expects a string.
                    const obj  = (typeof data === 'string') ? JSON.parse(data) : data;
                    const json = (typeof data === 'string') ? data : JSON.stringify(data);
                    this.settingsStore.fromJSON(json);
                    // Reset live template from the starter TEMPLATES map if the preset only
                    // references it by id (keeps preset JSON compact and re-usable).
                    if (obj.templateId && !obj.template) {
                        const t = TEMPLATES[obj.templateId];
                        if (t) this.settingsStore.set('template', clone(t));
                    }
                    this.state.selectedKeyId = null;
                    this.historyManager?.setRestoring(true);
                    try {
                        this.syncSliders();
                        this.syncColorPickers();
                        this.update();
                    } finally {
                        this.historyManager?.setRestoring(false);
                    }
                    // Preset is a fresh baseline: drop any stale undo stack and reseed.
                    this.historyManager?.clear();
                    this.pushHistory('preset:load');
                } catch (e) {
                    console.error('[KeyboardLayoutApp] preset load failed:', e);
                }
            }
        });
        this.presetManager.init();
    }

    initExporter() {
        this.textToPath  = new TextToPath({ fontPaths: { 'YSText-Regular-400': 'fonts/YSText-Regular.ttf' } });
        this.svgExporter = new SVGExporter({ textToPath: this.textToPath });
    }

    /* ------------------------------------------------------------ */
    /*  Checkboxes / Collapse / Buttons / Modals / Shortcuts        */
    /* ------------------------------------------------------------ */

    initCheckboxes() {
        document.querySelectorAll('.toggle-chip input[type="checkbox"]').forEach((cb) => {
            const key = cb.dataset.setting;
            if (!key) return;
            cb.checked = this.settingsStore.get(key) ?? cb.checked;
            cb.addEventListener('change', () => {
                this.settingsStore.set(key, cb.checked);
                this.update();
                this.pushHistory(`toggle:${key}`);
            });
            this.settingsStore.subscribe(key, (v) => { cb.checked = v; });
        });
    }

    initCollapse() {
        document.querySelectorAll('.collapse-icon').forEach((icon) => {
            icon.addEventListener('click', () => {
                const panel = icon.closest('.controls-panel');
                if (!panel) return;
                panel.classList.toggle('panel-collapsed');
                icon.classList.toggle('collapsed');
            });
        });
    }

    initButtons() {
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        bind('exportSvgBtn',      () => { void this.exportSVG(); });
        bind('exportSettingsBtn', () => { this.exportSettings(); });
        bind('importSettingsBtn', () => { void this.importSettings(); });
    }

    initModals() {
        const close = (overlay) => { overlay.classList.remove('active'); overlay.setAttribute('aria-hidden', 'true'); };
        document.querySelectorAll('.modal-close').forEach((btn) => {
            btn.addEventListener('click', () => { const o = btn.closest('.modal-overlay'); if (o) close(o); });
        });
        document.querySelectorAll('.modal-overlay').forEach((o) => {
            o.addEventListener('click', (e) => { if (e.target === o) close(o); });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(close);
        });
    }

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            // On macOS with Shift held down, e.key is 'Z' (uppercase), not 'z'.
            // Normalize so Cmd+Shift+Z matches without surprises.
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
            else if (key === 'z' && e.shiftKey) { e.preventDefault(); this.redo(); }
            else if (key === 'e') { e.preventDefault(); void this.exportSVG(); }
        });
    }

    /* ============================================================ */
    /*  Render                                                      */
    /* ============================================================ */

    update() {
        if (this.state.isUpdating) return;
        this.state.isUpdating = true;

        try {
            const svg = this.dom?.svg;
            if (!svg) return;

            while (svg.firstChild) svg.removeChild(svg.firstChild);

            const template = this.settingsStore.get('template')
                            ?? TEMPLATES[this.settingsStore.get('templateId')]
                            ?? TEMPLATES[DEFAULT_TEMPLATE_ID];

            const engineSettings = this.settingsStore.getAll();

            const layout = computeLayout(template, engineSettings);
            this.lastLayout = layout;

            const w = layout.backdropW;
            const h = layout.backdropH;

            // viewBox matches backdrop (keys + backdrop padding).
            svg.setAttribute('width',  `${w}mm`);
            svg.setAttribute('height', `${h}mm`);
            svg.setAttribute('data-export-width',  w);
            svg.setAttribute('data-export-height', h);
            svg.setAttribute('data-export-unit',   'mm');
            if (!this.zoomPan) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

            this.renderBackdrop(svg, layout);
            this.renderKeys(svg, layout);
            this.renderSafeguard(svg, layout);
            this.renderSelectionOverlay(svg, layout);

            if (this.zoomPan) {
                this.zoomPan.reinitializeSVGDimensions();
                this.zoomPan.centerContent?.();
            }
            this.syncInspector();
        } finally {
            this.state.isUpdating = false;
        }
    }

    renderBackdrop(svg, layout) {
        if (!this.settings.showBackdrop) return;
        const g    = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('id', 'Back');
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x',      layout.backdropX);
        rect.setAttribute('y',      layout.backdropY);
        rect.setAttribute('width',  layout.backdropW);
        rect.setAttribute('height', layout.backdropH);
        rect.setAttribute('fill',   this.settings.backdropFill);
        g.appendChild(rect);
        svg.appendChild(g);
    }

    renderKeys(svg, layout) {
        if (!this.settings.showKeys) return;
        const g    = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('id', 'Keys');
        const r    = this.settings.radius;
        const fill = this.settings.keyFill;

        for (const key of layout.placedKeys) {
            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x',      key.x);
            rect.setAttribute('y',      key.y);
            rect.setAttribute('width',  key.w);
            rect.setAttribute('height', key.h);
            rect.setAttribute('rx',     r);
            rect.setAttribute('ry',     r);
            rect.setAttribute('fill',   fill);
            rect.setAttribute('data-object-id',   key.id);
            rect.setAttribute('data-object-type', 'key');
            rect.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectKey(key.id);
            });
            g.appendChild(rect);

            this.renderKeyTypography(g, key);
        }
        svg.appendChild(g);
    }

    /**
     * Draws the safeguard (inner inset) rectangle for every key.
     *
     * The inset equals `padKeyMm` � the same value that anchors all on-key
     * typography, so what users see as the safeguard outline is literally
     * the text placement boundary.
     *
     * Rendered as a regular, non-interactive SVG layer, so toggling
     * `showSafeguard` affects both canvas preview and exported SVG.
     */
    renderSafeguard(svg, layout) {
        if (!this.settings.showSafeguard) return;
        const pad = +this.settings.padKeyMm || 0;
        if (pad <= 0) return;

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('id', 'Safeguard');
        g.setAttribute('pointer-events', 'none');

        const baseR = +this.settings.radius || 0;
        const innerR = Math.max(0, baseR - pad);

        for (const key of layout.placedKeys) {
            const iw = key.w - pad * 2;
            const ih = key.h - pad * 2;
            if (iw <= 0 || ih <= 0) continue;

            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x',      key.x + pad);
            rect.setAttribute('y',      key.y + pad);
            rect.setAttribute('width',  iw);
            rect.setAttribute('height', ih);
            rect.setAttribute('rx',     innerR);
            rect.setAttribute('ry',     innerR);
            rect.setAttribute('fill',   'none');
            rect.setAttribute('stroke', '#4ea1ff');
            rect.setAttribute('stroke-width', '0.15');
            g.appendChild(rect);
        }
        svg.appendChild(g);
    }

    /**
     * Render typography on a single key.
     *
     *   - `kind: special | function` with `label`: small label pinned to bottom-left.
     *   - `kind: char` with `chars.base` only (letter rows): base glyph top-left,
     *     Cyrillic glyph (`chars.ru`) bottom-right.
     *   - `kind: char` with `chars.shift` (number / punctuation rows):
     *         shift glyph top-left, base glyph bottom-left,
     *         shift-Cyrillic top-right, base-Cyrillic bottom-right.
     *
     * All coordinates are anchored to the inner padding rectangle
     * (key.x + padKey .. key.x + key.w - padKey) so edits to `padKeyMm`
     * reflow all labels simultaneously.
     */
    renderKeyTypography(parent, key) {
        if (key.kind === 'arrow-half' || key.kind === 'spacer') return;

        const pad       = +this.settings.padKeyMm || 0;
        const sizeChar  = +this.settings.fontChar  || 5;
        const sizeShift = +this.settings.fontShift || 4;
        const sizeLabel = +this.settings.fontLabel || 3;

        // Bail if the key is so small that padding alone would invert the inner box.
        if (key.w < pad * 2 || key.h < pad * 2) return;

        const leftX   = key.x + pad;
        const rightX  = key.x + key.w  - pad;
        // Baselines. "top" approximates cap-height drop from the top edge,
        // "bottom" sits exactly on the inner bottom padding line.
        const topY    = key.y + pad;
        const bottomY = key.y + key.h - pad;

        const draw = (text, { x, y, size, anchor, baseline }) => {
            if (text === '' || text == null) return;
            const el = document.createElementNS(SVG_NS, 'text');
            el.setAttribute('class',             'key-text');
            el.setAttribute('x',                 x);
            el.setAttribute('y',                 y);
            el.setAttribute('font-size',         size.toFixed(2));
            el.setAttribute('font-family',       'YSText-Regular, YS Text, sans-serif');
            el.setAttribute('fill',              this.settings.fontColor || '#e6e7e8');
            el.setAttribute('text-anchor',       anchor);
            el.setAttribute('dominant-baseline', baseline);
            el.setAttribute('pointer-events',    'none');
            el.textContent = String(text);
            parent.appendChild(el);
        };

        if (key.kind === 'char' && key.chars) {
            const { base, shift, ru, ruShift } = key.chars;
            if (shift != null) {
                // Number / punctuation row: 4-quadrant layout.
                draw(shift,   { x: leftX,  y: topY,    size: sizeShift, anchor: 'start', baseline: 'hanging' });
                draw(base,    { x: leftX,  y: bottomY, size: sizeChar,  anchor: 'start', baseline: 'alphabetic' });
                draw(ruShift, { x: rightX, y: topY,    size: sizeShift, anchor: 'end',   baseline: 'hanging' });
                draw(ru,      { x: rightX, y: bottomY, size: sizeChar,  anchor: 'end',   baseline: 'alphabetic' });
            } else {
                // Letter row: base top-left, Cyrillic bottom-right.
                draw(base, { x: leftX,  y: topY,    size: sizeChar, anchor: 'start', baseline: 'hanging' });
                draw(ru,   { x: rightX, y: bottomY, size: sizeChar, anchor: 'end',   baseline: 'alphabetic' });
            }
            return;
        }

        // Special / function keys: label in the bottom-left corner.
        if (key.label) {
            draw(key.label, { x: leftX, y: bottomY, size: sizeLabel, anchor: 'start', baseline: 'alphabetic' });
        }
    }

    /**
     * Draws a dashed outline around the currently selected key (if any).
     * Kept as a separate top layer so it always renders above keys without
     * intercepting clicks.
     */
    renderSelectionOverlay(svg, layout) {
        const id = this.state.selectedKeyId;
        if (!id) return;
        const key = layout.placedKeys.find(k => k.id === id);
        if (!key) return;

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('id', 'Selection');
        g.setAttribute('pointer-events', 'none');
        // Marks this group as on-screen-only so SVGExporter.removeInteractiveElements
        // strips it before writing the file.
        g.setAttribute('data-interactive', 'true');

        const inset = 0.35;
        const r = Math.max(0, (this.settings.radius || 0) + inset);
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x',      key.x - inset);
        rect.setAttribute('y',      key.y - inset);
        rect.setAttribute('width',  key.w + inset * 2);
        rect.setAttribute('height', key.h + inset * 2);
        rect.setAttribute('rx',     r);
        rect.setAttribute('ry',     r);
        rect.setAttribute('fill',   'none');
        rect.setAttribute('stroke', '#4ea1ff');
        rect.setAttribute('stroke-width', '0.35');
        rect.setAttribute('stroke-dasharray', '1.2 0.8');
        g.appendChild(rect);
        svg.appendChild(g);
    }

    /* ============================================================ */
    /*  Selection + inspector                                       */
    /* ============================================================ */

    initCanvasSelection() {
        // Clicking on empty canvas (or backdrop layer) clears the selection.
        const svg = this.dom?.svg;
        if (!svg) return;
        svg.addEventListener('click', (e) => {
            const target = e.target;
            const isKey = target?.getAttribute?.('data-object-type') === 'key';
            if (!isKey) this.clearSelection();
        });
    }

    /**
     * Template-level actions that work without any selection:
     *   - "+ Add row" appends a row at the bottom (same shape as Inspector's
     *     "+ row below", but selection-agnostic).
     *   - "Reset template" reloads the current preset's starter template.
     */
    initTemplateActions() {
        const addBtn   = document.getElementById('tplAddRowBtn');
        const resetBtn = document.getElementById('tplResetBtn');

        addBtn?.addEventListener('click', () => this.addRowRelative('end'));

        resetBtn?.addEventListener('click', () => {
            const id = this.settingsStore.get('templateId') || DEFAULT_TEMPLATE_ID;
            const src = TEMPLATES[id];
            if (!src) return;
            this.settingsStore.set('template', clone(src));
            this.state.selectedKeyId = null;
            this.update();
            this.pushHistory(`template:reset:${id}`);
        });
    }

    selectKey(keyId) {
        if (this.state.selectedKeyId === keyId) return;
        this.state.selectedKeyId = keyId;
        this.update();
    }

    clearSelection() {
        if (this.state.selectedKeyId == null) return;
        this.state.selectedKeyId = null;
        this.update();
    }

    initInspector() {
        const $ = (id) => document.getElementById(id);
        this.inspector = {
            panel:     $('objectPropertiesPanel'),
            closeBtn:  $('objectPropertiesCloseBtn'),
            idField:   $('insKeyId'),
            label:     $('insKeyLabel'),
            kind:      $('insKeyKind'),
            w:         $('insKeyW'),
            wReset:    $('insKeyWReset'),
            h:         $('insKeyH'),
            hReset:    $('insKeyHReset'),
            hint:      $('insKeyHint'),

            keyMoveLeft:   $('insKeyMoveLeft'),
            keyMoveRight:  $('insKeyMoveRight'),
            keyDuplicate:  $('insKeyDuplicate'),
            keyDelete:     $('insKeyDelete'),

            rowMoveUp:     $('insRowMoveUp'),
            rowMoveDown:   $('insRowMoveDown'),
            rowAddAbove:   $('insRowAddAbove'),
            rowAddBelow:   $('insRowAddBelow'),
            rowDelete:     $('insRowDelete'),
            rowHint:       $('insRowHint'),

            muted:     false
        };

        const ins = this.inspector;
        if (!ins.panel) return;

        ins.closeBtn?.addEventListener('click', () => this.clearSelection());

        ins.keyMoveLeft ?.addEventListener('click', () => this.moveSelectedKey(-1));
        ins.keyMoveRight?.addEventListener('click', () => this.moveSelectedKey(+1));
        ins.keyDuplicate?.addEventListener('click', () => this.duplicateSelectedKey());
        ins.keyDelete   ?.addEventListener('click', () => this.deleteSelectedKey());

        ins.rowMoveUp   ?.addEventListener('click', () => this.moveSelectedRow(-1));
        ins.rowMoveDown ?.addEventListener('click', () => this.moveSelectedRow(+1));
        ins.rowAddAbove ?.addEventListener('click', () => this.addRowRelative('above'));
        ins.rowAddBelow ?.addEventListener('click', () => this.addRowRelative('below'));
        ins.rowDelete   ?.addEventListener('click', () => this.deleteSelectedRow());

        const patch = (partial) => {
            if (ins.muted) return;
            this.updateSelectedKey(partial);
        };

        ins.kind?.addEventListener('change', () => patch({ kind: ins.kind.value }));

        // Text + number fields: apply on blur or Enter. Per-keystroke updates
        // would re-render and reset the caret position as syncInspector rewrites
        // the field value.
        const bindText = (input, field, { allowEmpty = true } = {}) => {
            const apply = () => {
                const raw = input.value;
                if (raw === '' && !allowEmpty) return;
                patch({ [field]: raw });
            };
            input.addEventListener('blur', apply);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); apply(); input.blur(); }
            });
        };
        const bindNumber = (input, field) => {
            const apply = () => {
                const raw = input.value.trim();
                if (raw === '') { patch({ [field]: undefined }); return; }
                const num = parseFloat(raw);
                if (!isFinite(num) || num <= 0) return;
                patch({ [field]: num });
            };
            input.addEventListener('blur', apply);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); apply(); input.blur(); }
            });
        };
        if (ins.label) bindText(ins.label, 'label');
        if (ins.w) bindNumber(ins.w, 'wMm');
        if (ins.h) bindNumber(ins.h, 'hMm');

        ins.wReset?.addEventListener('click', () => patch({ wMm: undefined }));
        ins.hReset?.addEventListener('click', () => patch({ hMm: undefined }));
    }

    /**
     * Refreshes inspector fields from the currently selected key.
     * Called after every render so slider-driven geometry changes are reflected.
     */
    syncInspector() {
        const ins = this.inspector;
        if (!ins?.panel) return;

        const id = this.state.selectedKeyId;
        if (!id) {
            ins.panel.classList.remove('active');
            return;
        }

        const template = this.settingsStore.get('template');
        const found = findKeyInTemplate(template, id);
        if (!found) {
            ins.panel.classList.remove('active');
            this.state.selectedKeyId = null;
            return;
        }

        const placed = this.lastLayout?.placedKeys?.find(k => k.id === id);
        const key    = found.key;

        ins.panel.classList.add('active');
        ins.muted = true;
        try {
            const active = document.activeElement;
            const setIfIdle = (el, value) => { if (el && el !== active) el.value = value; };

            setIfIdle(ins.idField, key.id ?? '');
            setIfIdle(ins.label,   key.label ?? '');
            setIfIdle(ins.kind,    key.kind ?? 'special');

            const hasWOv = isFinite(+key.wMm) && +key.wMm > 0;
            const hasHOv = isFinite(+key.hMm) && +key.hMm > 0;
            const curW   = placed?.w ?? 0;
            const curH   = placed?.h ?? 0;

            setIfIdle(ins.w, hasWOv ? (+key.wMm).toFixed(4) : curW.toFixed(4));
            setIfIdle(ins.h, hasHOv ? (+key.hMm).toFixed(4) : curH.toFixed(4));

            ins.wReset.disabled = !hasWOv;
            ins.hReset.disabled = !hasHOv;

            const baseW = +this.settingsStore.get('keyWidth') || 16.8;
            const parts = [];
            parts.push(`row: ${found.row.id}`);
            if (key.w != null && !hasWOv) parts.push(`w ratio: ${(+key.w).toFixed(4)} x baseW (${(baseW * key.w).toFixed(3)} mm)`);
            if (!hasWOv)                   parts.push(`width follows Base width`);
            if (!hasHOv)                   parts.push(`height follows row default`);
            ins.hint.textContent = parts.join(' - ');

            // Update availability of CRUD buttons based on current position.
            // additionalKey lives outside the `keys`/`arrowCluster` arrays,
            // so key-level CRUD is disabled for it (it's a row-slot, not a row member).
            const inList   = !!found.list;
            const listLen  = inList ? found.list.length : 0;
            const rows     = template.rows;
            const rowIdx   = rows.indexOf(found.row);
            const isLastRow= rows.length <= 1;

            if (ins.keyMoveLeft)  ins.keyMoveLeft .disabled = !inList || found.index <= 0;
            if (ins.keyMoveRight) ins.keyMoveRight.disabled = !inList || found.index >= listLen - 1;
            if (ins.keyDuplicate) ins.keyDuplicate.disabled = !inList;
            if (ins.keyDelete)    ins.keyDelete   .disabled = !inList;

            if (ins.rowMoveUp)    ins.rowMoveUp   .disabled = rowIdx <= 0;
            if (ins.rowMoveDown)  ins.rowMoveDown .disabled = rowIdx < 0 || rowIdx >= rows.length - 1;
            if (ins.rowDelete)    ins.rowDelete   .disabled = isLastRow;

            if (ins.rowHint) {
                ins.rowHint.textContent =
                    `row "${found.row.id}" - ${rowIdx + 1} of ${rows.length}` +
                    (found.list ? `, key ${found.index + 1} of ${listLen}` : ' (additional slot)');
            }
        } finally {
            ins.muted = false;
        }
    }

    /**
     * Applies a partial patch to the currently selected key in Settings.template.
     * Keys set to `undefined` in the patch are deleted from the key object
     * (so "Reset" removes an override rather than storing 0 / null).
     */
    updateSelectedKey(patch) {
        const id = this.state.selectedKeyId;
        if (!id) return;

        const template = this.settingsStore.get('template');
        const found = findKeyInTemplate(template, id);
        if (!found) return;

        for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) delete found.key[k];
            else found.key[k] = v;
        }

        // Notify subscribers by reassigning with a shallow-new wrapper.
        // `Settings.set` only fires notifications when value !== oldValue, so
        // we pass a fresh top-level object to force the reactive path.
        this.settingsStore.set('template', { ...template });
        this.update();
        const label = Object.keys(patch).join(',');
        this.pushHistory(`key:edit:${label}`);
    }

    /* ============================================================ */
    /*  Key / Row CRUD                                              */
    /* ============================================================ */

    /** Collect all key ids currently present anywhere in the template. */
    collectKeyIds(template) {
        const out = new Set();
        for (const row of template.rows || []) {
            for (const k of row.keys || [])         out.add(k.id);
            for (const k of row.arrowCluster || []) out.add(k.id);
            if (row.additionalKey) out.add(row.additionalKey.id);
        }
        return out;
    }

    collectRowIds(template) {
        return new Set((template.rows || []).map(r => r.id));
    }

    /** Produce an id not already present in `existing`: base, base_copy, base_copy2, ... */
    uniqueKeyId(existing, base) {
        const seed = String(base || 'key').replace(/_copy\d*$/, '');
        let candidate = `${seed}_copy`;
        let i = 1;
        while (existing.has(candidate)) {
            i += 1;
            candidate = `${seed}_copy${i}`;
        }
        return candidate;
    }

    uniqueRowId(existing, base) {
        const seed = String(base || 'row');
        let candidate = seed;
        let i = 1;
        while (existing.has(candidate)) {
            i += 1;
            candidate = `${seed}${i}`;
        }
        return candidate;
    }

    /** Commit a mutated template and keep selection coherent. */
    commitTemplate(template, { selectKeyId = this.state.selectedKeyId, historyLabel = 'template' } = {}) {
        this.state.selectedKeyId = selectKeyId;
        this.settingsStore.set('template', { ...template });
        this.update();
        this.pushHistory(historyLabel);
    }

    deleteSelectedKey() {
        const id = this.state.selectedKeyId;
        if (!id) return;
        const template = this.settingsStore.get('template');
        const found = findKeyInTemplate(template, id);
        if (!found || !found.list) return;

        found.list.splice(found.index, 1);
        this.commitTemplate(template, { selectKeyId: null, historyLabel: 'key:delete' });
    }

    duplicateSelectedKey() {
        const id = this.state.selectedKeyId;
        if (!id) return;
        const template = this.settingsStore.get('template');
        const found = findKeyInTemplate(template, id);
        if (!found || !found.list) return;

        const copy = clone(found.key);
        copy.id = this.uniqueKeyId(this.collectKeyIds(template), found.key.id);
        found.list.splice(found.index + 1, 0, copy);
        this.commitTemplate(template, { selectKeyId: copy.id, historyLabel: 'key:duplicate' });
    }

    /** Move the selected key by `dir` (+1 right, -1 left) within its array. */
    moveSelectedKey(dir) {
        const id = this.state.selectedKeyId;
        if (!id || !dir) return;
        const template = this.settingsStore.get('template');
        const found = findKeyInTemplate(template, id);
        if (!found || !found.list) return;

        const target = found.index + dir;
        if (target < 0 || target >= found.list.length) return;

        const [k] = found.list.splice(found.index, 1);
        found.list.splice(target, 0, k);
        this.commitTemplate(template, { historyLabel: `key:move:${dir > 0 ? 'right' : 'left'}` });
    }

    /**
     * Add a new row with one placeholder key. `position` is 'above' / 'below' /
     * 'end' (relative to the row that contains the currently selected key;
     * 'end' just pushes to the bottom of the template).
     */
    addRowRelative(position) {
        const template = this.settingsStore.get('template');
        const rows = template.rows;
        const selectedId = this.state.selectedKeyId;

        const rowIds = this.collectRowIds(template);
        const keyIds = this.collectKeyIds(template);
        const newRowId = this.uniqueRowId(rowIds, 'row');
        const newKeyId = this.uniqueKeyId(keyIds, 'key');

        const newRow = {
            id: newRowId,
            keys: [ { id: newKeyId, kind: 'special', w: 1.0, label: 'new' } ]
        };

        let insertIdx = rows.length;
        if (position !== 'end' && selectedId) {
            const found = findKeyInTemplate(template, selectedId);
            if (found) {
                const ri = rows.indexOf(found.row);
                insertIdx = (position === 'above') ? ri : ri + 1;
            }
        }
        rows.splice(insertIdx, 0, newRow);
        this.commitTemplate(template, { selectKeyId: newKeyId, historyLabel: `row:add:${position}` });
    }

    deleteSelectedRow() {
        const id = this.state.selectedKeyId;
        if (!id) return;
        const template = this.settingsStore.get('template');
        if (!template.rows || template.rows.length <= 1) return;

        const found = findKeyInTemplate(template, id);
        if (!found) return;

        const rowIdx = template.rows.indexOf(found.row);
        if (rowIdx === -1) return;

        template.rows.splice(rowIdx, 1);
        this.commitTemplate(template, { selectKeyId: null, historyLabel: 'row:delete' });
    }

    moveSelectedRow(dir) {
        const id = this.state.selectedKeyId;
        if (!id || !dir) return;
        const template = this.settingsStore.get('template');
        const found = findKeyInTemplate(template, id);
        if (!found) return;

        const rows = template.rows;
        const rowIdx = rows.indexOf(found.row);
        const target = rowIdx + dir;
        if (rowIdx === -1 || target < 0 || target >= rows.length) return;

        const [r] = rows.splice(rowIdx, 1);
        rows.splice(target, 0, r);
        this.commitTemplate(template, { historyLabel: `row:move:${dir > 0 ? 'down' : 'up'}` });
    }

    /* ============================================================ */
    /*  Undo / Redo                                                 */
    /* ============================================================ */

    /**
     * Push current settings (including template, selection, colors, geometry)
     * into HistoryManager. No-op during an undo/redo restore.
     */
    pushHistory(label = 'edit') {
        if (!this.historyManager) return;
        if (this.historyManager.isRestoring) return;
        this.historyManager.saveSnapshot(this.getStateSnapshot(), label);
    }

    /**
     * Coalesces rapid-fire changes (slider drag, color-picker scrub) into a
     * single history entry that fires ~350 ms after the last change.
     */
    schedulePushHistory(label = 'edit', delay = 350) {
        if (!this.historyManager) return;
        if (this.historyManager.isRestoring) return;
        if (this.historyDebounce) clearTimeout(this.historyDebounce);
        this.historyDebounce = setTimeout(() => {
            this.historyDebounce = null;
            this.pushHistory(label);
        }, delay);
    }

    undo() {
        if (!this.historyManager?.canUndo()) return;
        if (this.historyDebounce) {
            clearTimeout(this.historyDebounce);
            this.historyDebounce = null;
            // Flush any pending slider-scrub snapshot before walking back,
            // otherwise undo would skip over the in-flight edit.
            this.pushHistory('flush');
        }
        const prev = this.historyManager.undo();
        if (prev) this.restoreState(prev);
    }

    redo() {
        if (!this.historyManager?.canRedo()) return;
        if (this.historyDebounce) {
            clearTimeout(this.historyDebounce);
            this.historyDebounce = null;
        }
        const next = this.historyManager.redo();
        if (next) this.restoreState(next);
    }

    /* ============================================================ */
    /*  Export                                                      */
    /* ============================================================ */

    async exportSVG() {
        const svg = this.dom?.svg;
        if (!svg) return;
        const outlines = document.getElementById('convertToOutlinesCheckbox')?.checked ?? false;
        await this.svgExporter.exportToFile(svg, 'keyboard-layout.svg', {
            removeInteractive: true,
            convertTextToOutlines: outlines
        });
    }

    exportSettings() {
        this.svgExporter.exportJSON(this.getStateSnapshot(), 'keyboard-layout-settings.json');
    }

    async importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                this.restoreState(await this.svgExporter.importJSON(file));
                this.historyManager?.clear();
                this.pushHistory('import');
            } catch (e) { console.error('[KeyboardLayoutApp] import failed:', e); }
        });
        input.click();
    }

    /* ============================================================ */
    /*  Snapshots                                                   */
    /* ============================================================ */

    getStateSnapshot() { return this.settingsStore.toJSON(); }

    restoreState(snapshot) {
        // Guard against self-snapshotting while we reapply a historical state:
        // fromJSON ? update ? any onChange listeners must NOT push a new entry.
        this.historyManager?.setRestoring(true);
        try {
            this.settingsStore.fromJSON(snapshot);
            this.state.selectedKeyId = null;   // UI selection isn't part of the snapshot
            this.syncSliders();
            this.syncColorPickers();
            this.update();
        } finally {
            this.historyManager?.setRestoring(false);
        }
    }

    /**
     * Reflect current backdropFill / keyFill back into their picker UIs.
     * Called after a preset load or undo/redo so the swatches and hex inputs
     * don't lag behind the actual Settings values.
     */
    syncColorPickers() {
        const backdrop = this.settingsStore.get('backdropFill');
        if (backdrop && this.backdropPicker?.setColorFromHex) {
            this.backdropPicker.setColorFromHex(backdrop);
        }
        const keyFill = this.settingsStore.get('keyFill');
        if (keyFill) {
            const preview  = document.getElementById('keyColorPreview');
            const hexInput = document.getElementById('keyHexColorInput');
            if (preview)  preview.style.backgroundColor = keyFill;
            if (hexInput) hexInput.value = keyFill;
        }
    }

    syncSliders() {
        const map = {
            keyWidthSlider:     'keyWidth',
            keyHeightSlider:    'keyHeight',
            keyGapXSlider:      'gapX',
            keyGapYSlider:      'gapY',
            keyRadiusSlider:    'radius',
            paddingSlider:      'padding',
            fnRowHSlider:       'fnRowH',
            fnGapSlider:        'fnGap',
            fontCharSlider:     'fontChar',
            fontShiftSlider:    'fontShift',
            fontLabelSlider:    'fontLabel',
            padKeySlider:       'padKeyMm'
        };
        for (const [id, key] of Object.entries(map)) {
            const val = this.settingsStore.get(key);
            if (val != null) this.sliders?.setValue(id, val, false);
        }
    }
}

export { KeyboardLayoutApp };
