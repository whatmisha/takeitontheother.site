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
import { ICONS, iconTransform } from './assets/icons.js';

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

    /* Icon size: target fit-box side in mm. The longest bbox side of the icon
       is scaled to this value; icons keep their aspect ratio. */
    iconSize:  4.0,

    /* Colors */
    backdropFill: '#131313',
    keyFill:      '#303030',

    /* Layers */
    showBackdrop:  true,
    showKeys:      true,
    showSafeguard: false,

    /* Languages: which glyph sets to render on char keys.
       These toggles affect `base`/`shift` (Latin) and `ru`/`ruShift` (Cyrillic)
       independently. When only one language is on, its glyphs are promoted to
       the primary (left / top-left) position; bottom-right / right-column
       positions become empty. Special-key `label`s are unaffected. */
    showLatin:     true,
    showCyrillic:  true,

    /* Export options (iteration 7).
       These are independent of the preview toggles so a user can, for example,
       hide safeguards while designing but still ship them in the exported SVG
       so the print shop has the exact text-safe zones. */
    outlineFonts:    false,   // convert <text> -> <path> on SVG/PDF export
    exportSafeguard: false    // include Safeguard layer in the exported file */
};

/**
 * Walk the template and locate a key by id.
 * Returns { key, row, list, index } or null if not found.
 * `list` is the array the key belongs to (row.keys | row.arrowCluster
 * | template.numpad.keys | null for additionalKey).
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
    if (template.numpad && Array.isArray(template.numpad.keys)) {
        const list = template.numpad.keys;
        const i = list.findIndex(k => k.id === keyId);
        if (i !== -1) return { key: list[i], row: { id: 'numpad', keys: list }, list, index: i };
    }
    return null;
}

class KeyboardLayoutApp {

    constructor(overrides = {}) {
        this.settingsStore = new Settings({ ...DEFAULTS, ...overrides });
        this.settings      = this.settingsStore.createProxy();

        this.domCache = new DOMCache();
        this.dom      = null;

        // `selectedKeyId` = the primary selection (inspector target).
        // `multiSelectIds` = all selected (primary + additional via Shift/Cmd).
        // Both are kept in sync by selectKey / clearSelection.
        this.state = {
            isInitialized:  false,
            isUpdating:     false,
            selectedKeyId:  null,
            multiSelectIds: new Set()
        };
        this.lastLayout = null;   // Cached layout from most recent update (for inspector lookups)
        this.inspector  = null;   // DOM refs + helpers, populated in initInspector()
        this.historyDebounce = null; // Pending timer for coalesced slider/color pushes
        this.inlineEditor = null; // Active inline-label editor {input, keyId, field} | null
        this._dragIndicator     = null;   // <line> drop indicator during drag-reorder
        this._suppressNextClick = false;  // Swallow the post-drag `click` selection

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
        reg('iconSizeSlider',  'iconSizeValue',  'iconSize',  { min: 0,  max: 12, decimals: 2, baseStep: 0.05, shiftStep: 0.5 });
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
            // Zoom/pan changes detach the inline editor from its key visually.
            if (this.inlineEditor) this._finishInlineEdit(true);
        });
        window.addEventListener('resize', () => {
            if (this.inlineEditor) this._finishInlineEdit(true);
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
                    this.state.multiSelectIds.clear();
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

        // "Outline fonts" is a persistent setting, not an ephemeral UI flag, so
        // it plays nicely with undo/redo and settings import/export. We keep
        // the existing non-toggle-chip styling by wiring it manually here.
        const outlineCb = document.getElementById('convertToOutlinesCheckbox');
        if (outlineCb) {
            outlineCb.checked = !!this.settingsStore.get('outlineFonts');
            outlineCb.addEventListener('change', () => {
                this.settingsStore.set('outlineFonts', outlineCb.checked);
                this.pushHistory('toggle:outlineFonts');
            });
            this.settingsStore.subscribe('outlineFonts', (v) => { outlineCb.checked = !!v; });
        }
        const exportSgCb = document.getElementById('exportSafeguardCheckbox');
        if (exportSgCb) {
            exportSgCb.checked = !!this.settingsStore.get('exportSafeguard');
            exportSgCb.addEventListener('change', () => {
                this.settingsStore.set('exportSafeguard', exportSgCb.checked);
                this.update();
                this.pushHistory('toggle:exportSafeguard');
            });
            this.settingsStore.subscribe('exportSafeguard', (v) => { exportSgCb.checked = !!v; });
        }
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

        // Re-render destroys the rect the editor is anchored to. Drop any
        // in-progress inline edit without committing -- the caller of update()
        // is already performing a structural change unrelated to that edit.
        if (this.inlineEditor) this._finishInlineEdit(false);
        // Likewise kill a leftover drag drop-indicator so it doesn't float
        // over the fresh render.
        this._removeDragIndicator();

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

        // Parent group: single "Keys" layer, then one sub-group per row so the
        // exported SVG has clean named layers in Illustrator (row_numbers,
        // row_qwerty, row_asdfgh, ..., row_numpad, row_arrows_*).
        const parent = document.createElementNS(SVG_NS, 'g');
        parent.setAttribute('id', 'Keys');

        const r    = this.settings.radius;
        const fill = this.settings.keyFill;

        // Stable row order = first-seen order in placedKeys (matches template order).
        const rowGroups = new Map();
        const getRow = (rowId) => {
            let g = rowGroups.get(rowId);
            if (g) return g;
            g = document.createElementNS(SVG_NS, 'g');
            g.setAttribute('id', `row_${rowId}`);
            g.setAttribute('data-row-id', rowId);
            rowGroups.set(rowId, g);
            parent.appendChild(g);
            return g;
        };

        // Track the first key in each template-row so we can anchor a drag
        // handle to the row's top-left corner. Rows that don't live in
        // `template.rows` (numpad, arrow cluster belonging to a row_add) get
        // no handle.
        const template = this.settingsStore.get('template');
        const templateRowIds = new Set((template?.rows || []).map(r => r.id));
        const firstKeyPerRow = new Map();

        for (const key of layout.placedKeys) {
            const rowId = key.rowId || 'misc';
            if (templateRowIds.has(rowId) && !firstKeyPerRow.has(rowId)) {
                firstKeyPerRow.set(rowId, key);
            }
            const g = getRow(rowId);

            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x',      key.x);
            rect.setAttribute('y',      key.y);
            rect.setAttribute('width',  key.w);
            rect.setAttribute('height', key.h);
            rect.setAttribute('rx',     r);
            rect.setAttribute('ry',     r);
            rect.setAttribute('fill',   fill);
            rect.setAttribute('id',               `key_${key.id}`);
            rect.setAttribute('data-object-id',   key.id);
            rect.setAttribute('data-object-type', 'key');
            rect.setAttribute('data-row-id',      rowId);
            rect.style.cursor = 'grab';
            rect.addEventListener('click', (e) => {
                e.stopPropagation();
                // Pointer-drag above the threshold sets this flag so the
                // post-drag click doesn't "select" the dropped key.
                if (this._suppressNextClick) {
                    this._suppressNextClick = false;
                    return;
                }
                const additive = e.shiftKey || e.metaKey || e.ctrlKey;
                this.selectKey(key.id, { additive });
            });
            // Double-click enters inline label edit mode (iteration 8a).
            rect.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startInlineEdit(key.id);
            });
            // Drag-to-reorder within the same row (iteration 8b).
            this._initKeyDrag(rect, key);
            g.appendChild(rect);

            this.renderKeyTypography(g, key);
        }

        // Row drag handles (iteration 8b-rest). Anchored to the left edge of
        // each template row inside the backdrop padding. Marked interactive so
        // SVGExporter strips them from the file.
        this._renderRowHandles(parent, firstKeyPerRow, layout);

        svg.appendChild(parent);
    }

    /**
     * Render a small grab handle at the left of every template row so the
     * user can drag-reorder whole rows. The handle is a 3x3 dots grid that
     * sits in the backdrop padding area; it's non-exported (`data-interactive`)
     * and ignores safeguard / keys layers.
     */
    _renderRowHandles(parent, firstKeyPerRow, layout) {
        if (firstKeyPerRow.size === 0) return;

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('id', 'RowHandles');
        g.setAttribute('data-interactive', 'true');

        const dotR    = 0.3;  // mm
        const spacing = 0.9;  // mm between dot centers
        const offsetX = -1.8; // mm to the left of the first key (fits inside default 2.65 mm padding)

        for (const [rowId, key] of firstKeyPerRow.entries()) {
            const cx = key.x + offsetX;
            const cy = key.y + key.h / 2;

            // Hit area: a slightly larger invisible rect for easier grabbing.
            const hit = document.createElementNS(SVG_NS, 'rect');
            const pad = 1.2;
            hit.setAttribute('x',      cx - pad);
            hit.setAttribute('y',      cy - pad * 1.8);
            hit.setAttribute('width',  pad * 2);
            hit.setAttribute('height', pad * 3.6);
            hit.setAttribute('fill',   'transparent');
            hit.setAttribute('data-row-handle', rowId);
            hit.style.cursor = 'grab';
            // A plain click (no drag) on the handle would otherwise bubble to
            // the svg-level click handler and clear the current selection.
            hit.addEventListener('click', (ev) => ev.stopPropagation());

            // Visible grip: 2x3 dots.
            const grip = document.createElementNS(SVG_NS, 'g');
            grip.setAttribute('fill',  '#6a6a6a');
            grip.setAttribute('pointer-events', 'none');
            for (let row = -1; row <= 1; row++) {
                for (let col = 0; col <= 1; col++) {
                    const dot = document.createElementNS(SVG_NS, 'circle');
                    dot.setAttribute('cx', cx - spacing / 2 + col * spacing);
                    dot.setAttribute('cy', cy + row * spacing);
                    dot.setAttribute('r',  dotR);
                    grip.appendChild(dot);
                }
            }

            // Wire drag on the hit rect.
            this._initRowDrag(hit, rowId);

            g.appendChild(grip);
            g.appendChild(hit);
        }
        parent.appendChild(g);
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
        const showPreview = !!this.settings.showSafeguard;
        const showExport  = !!this.settings.exportSafeguard;
        if (!showPreview && !showExport) return;

        const pad = +this.settings.padKeyMm || 0;
        if (pad <= 0) return;

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('id', 'Safeguard');
        g.setAttribute('pointer-events', 'none');
        g.setAttribute('data-role', 'safeguard');

        // Export-only: hide from preview but keep in DOM so the clone we ship
        // to the exporter still contains it. exportSVG / exportPDF strip the
        // inline display:none on any `[data-preview-hidden]` before writing.
        if (!showPreview && showExport) {
            g.setAttribute('data-preview-hidden', 'true');
            g.style.display = 'none';
        }

        const baseR  = +this.settings.radius || 0;
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
            rect.setAttribute('data-row-id',    key.rowId || '');
            rect.setAttribute('data-object-id', key.id);
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
    /**
     * Render a glyph-style icon for a single key.
     *
     * Placement rules (no explicit iconPos yet -- kept simple for MVP):
     *   - function / special kind:   icon is centered in the inner padding box
     *     (either alongside a label in the bottom-left, or as the sole mark).
     *   - char kind (rare -- kept as an escape hatch): icon is placed in the
     *     top-right inner corner so it doesn't collide with letters.
     *
     * The longest bbox side of the icon is scaled to `iconSize`, preserving
     * aspect ratio. If the key is too small to fit the icon within the inner
     * pad, rendering is skipped (prevents visual overflow).
     */
    renderKeyIcon(parent, key) {
        const icon = ICONS[key.icon];
        if (!icon) return;

        const pad       = +this.settings.padKeyMm || 0;
        const requested = +this.settings.iconSize || 4.0;
        if (requested <= 0) return;

        // Keep a small breathing margin between icon and the inner padding edge.
        // For very small keys (arrow-half, tight custom sizes) the icon is
        // scaled down proportionally to fit inside the inner-pad box rather
        // than being skipped entirely.
        const innerW = key.w - pad * 2;
        const innerH = key.h - pad * 2;
        if (innerW <= 0 || innerH <= 0) return;

        const fit = Math.min(requested, innerW, innerH);
        if (fit <= 0) return;

        let xMm, yMm;
        const hasLabel = !!(key.label && String(key.label).length > 0);
        if (key.kind === 'char' || hasLabel) {
            // Label (if any) sits bottom-left -> icon goes top-right.
            xMm = key.x + key.w - pad - fit;
            yMm = key.y + pad;
        } else {
            // Icon-only key: center of the inner padding box.
            xMm = key.x + pad + (innerW - fit) / 2;
            yMm = key.y + pad + (innerH - fit) / 2;
        }

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'key-icon');
        g.setAttribute('transform', iconTransform(icon, fit, xMm, yMm));
        g.setAttribute('pointer-events', 'none');
        g.setAttribute('data-key-id', key.id);
        g.setAttribute('data-icon',   key.icon);

        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d',    icon.d);
        path.setAttribute('fill', this.settings.fontColor || '#e6e7e8');
        g.appendChild(path);

        parent.appendChild(g);
    }

    renderKeyTypography(parent, key) {
        if (key.kind === 'spacer') return;

        // Icons come first so text labels (drawn after) overlay them if they
        // happen to share a corner -- but placement rules below try to avoid
        // collisions anyway. Arrow-half keys get icon-only (no labels/chars).
        if (key.icon) this.renderKeyIcon(parent, key);
        if (key.kind === 'arrow-half') return;

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
            el.setAttribute('data-key-id',       key.id);
            el.textContent = String(text);
            parent.appendChild(el);
        };

        if (key.kind === 'char' && key.chars) {
            const { base, shift, ru, ruShift } = key.chars;
            const showLat = this.settings.showLatin    !== false;
            const showCyr = this.settings.showCyrillic !== false;

            if (shift != null) {
                // Number / punctuation row.
                if (showLat && showCyr) {
                    // 4-quadrant: Latin left, Cyrillic right; shift-top, base-bottom.
                    draw(shift,   { x: leftX,  y: topY,    size: sizeShift, anchor: 'start', baseline: 'hanging' });
                    draw(base,    { x: leftX,  y: bottomY, size: sizeChar,  anchor: 'start', baseline: 'alphabetic' });
                    draw(ruShift, { x: rightX, y: topY,    size: sizeShift, anchor: 'end',   baseline: 'hanging' });
                    draw(ru,      { x: rightX, y: bottomY, size: sizeChar,  anchor: 'end',   baseline: 'alphabetic' });
                } else if (showLat) {
                    // Only Latin: promote to left column (primary).
                    draw(shift, { x: leftX, y: topY,    size: sizeShift, anchor: 'start', baseline: 'hanging' });
                    draw(base,  { x: leftX, y: bottomY, size: sizeChar,  anchor: 'start', baseline: 'alphabetic' });
                } else if (showCyr) {
                    // Only Cyrillic: promote ru/ruShift to left column.
                    draw(ruShift, { x: leftX, y: topY,    size: sizeShift, anchor: 'start', baseline: 'hanging' });
                    draw(ru,      { x: leftX, y: bottomY, size: sizeChar,  anchor: 'start', baseline: 'alphabetic' });
                }
            } else {
                // Letter row.
                if (showLat && showCyr) {
                    draw(base, { x: leftX,  y: topY,    size: sizeChar, anchor: 'start', baseline: 'hanging' });
                    draw(ru,   { x: rightX, y: bottomY, size: sizeChar, anchor: 'end',   baseline: 'alphabetic' });
                } else if (showLat) {
                    draw(base, { x: leftX, y: topY, size: sizeChar, anchor: 'start', baseline: 'hanging' });
                } else if (showCyr) {
                    // Promote Cyrillic letter to the top-left primary slot.
                    draw(ru,   { x: leftX, y: topY, size: sizeChar, anchor: 'start', baseline: 'hanging' });
                }
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
        const primary = this.state.selectedKeyId;
        const ids = this.state.multiSelectIds;
        if (!primary && ids.size === 0) return;

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('id', 'Selection');
        g.setAttribute('pointer-events', 'none');
        g.setAttribute('data-interactive', 'true');

        const inset = 0.35;
        const r = Math.max(0, (this.settings.radius || 0) + inset);

        // Render every selected key's outline. Primary gets a brighter, solid
        // outline; additional selections get a dashed, slightly dimmer one.
        const drawOutline = (key, { isPrimary }) => {
            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x',      key.x - inset);
            rect.setAttribute('y',      key.y - inset);
            rect.setAttribute('width',  key.w + inset * 2);
            rect.setAttribute('height', key.h + inset * 2);
            rect.setAttribute('rx',     r);
            rect.setAttribute('ry',     r);
            rect.setAttribute('fill',   'none');
            rect.setAttribute('stroke', isPrimary ? '#4ea1ff' : '#4ea1ff');
            rect.setAttribute('stroke-width', isPrimary ? '0.45' : '0.3');
            rect.setAttribute('stroke-opacity', isPrimary ? '1' : '0.7');
            rect.setAttribute('stroke-dasharray', isPrimary ? '1.2 0.6' : '0.6 0.6');
            g.appendChild(rect);
        };

        // Draw non-primary first so primary stroke renders on top if overlapping.
        for (const id of ids) {
            if (id === primary) continue;
            const k = layout.placedKeys.find(kk => kk.id === id);
            if (k) drawOutline(k, { isPrimary: false });
        }
        if (primary) {
            const pk = layout.placedKeys.find(k => k.id === primary);
            if (pk) drawOutline(pk, { isPrimary: true });
        }

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
        const addBtn    = document.getElementById('tplAddRowBtn');
        const resetBtn  = document.getElementById('tplResetBtn');
        const exportBtn = document.getElementById('tplExportBtn');
        const importBtn = document.getElementById('tplImportBtn');

        addBtn?.addEventListener('click', () => this.addRowRelative('end'));

        resetBtn?.addEventListener('click', () => {
            const id = this.settingsStore.get('templateId') || DEFAULT_TEMPLATE_ID;
            const src = TEMPLATES[id];
            if (!src) return;
            this.settingsStore.set('template', clone(src));
            this.state.selectedKeyId = null;
            this.state.multiSelectIds.clear();
            this.update();
            this.pushHistory(`template:reset:${id}`);
        });

        exportBtn?.addEventListener('click', () => this.exportTemplate());
        importBtn?.addEventListener('click', () => { void this.importTemplate(); });
    }

    /**
     * Export only the template tree (structure of rows/keys) as a JSON file.
     * Unlike `Export Settings`, this deliberately omits colors, slider values,
     * and visibility toggles -- so a template JSON can be shared/re-used on
     * any Settings baseline without dragging preferences along.
     */
    exportTemplate() {
        const template   = this.settingsStore.get('template');
        const templateId = this.settingsStore.get('templateId') || null;
        if (!template) return;
        const payload = {
            schema:     'keyboard-template/v1',
            templateId,
            template
        };
        this.svgExporter.exportJSON(payload, 'keyboard-template.json');
    }

    /**
     * Load a template JSON file and swap it into `Settings.template`.
     * Accepts the v1 payload ({ schema, templateId, template }) or a bare
     * template object (so users can hand-craft minimal files).
     */
    async importTemplate() {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'application/json,.json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const parsed = await this.svgExporter.importJSON(file);
                const tpl = parsed?.template ?? parsed;
                if (!tpl || !Array.isArray(tpl.rows)) {
                    throw new Error('missing rows[]');
                }
                if (parsed?.templateId) {
                    this.settingsStore.set('templateId', parsed.templateId);
                }
                this.state.selectedKeyId = null;
                this.state.multiSelectIds.clear();
                this.commitTemplate(clone(tpl), { historyLabel: 'template:import' });
            } catch (e) {
                console.error('[KeyboardLayoutApp] template import failed:', e);
                alert('Template import failed: ' + e.message);
            }
        });
        input.click();
    }

    /**
     * Select a key, optionally in additive mode.
     *
     * @param {string}  keyId
     * @param {Object}  [opts]
     * @param {boolean} [opts.additive]  Shift/Cmd+click: toggle in/out of the
     *                                   multi-selection instead of replacing.
     */
    selectKey(keyId, { additive = false } = {}) {
        if (!keyId) return;
        const sel = this.state.multiSelectIds;

        if (additive) {
            if (sel.has(keyId)) {
                sel.delete(keyId);
                if (this.state.selectedKeyId === keyId) {
                    // Primary leaves selection: fall back to any remaining id.
                    const next = sel.values().next().value ?? null;
                    this.state.selectedKeyId = next;
                }
            } else {
                sel.add(keyId);
                this.state.selectedKeyId = keyId;
            }
        } else {
            if (this.state.selectedKeyId === keyId && sel.size === 1) return;
            sel.clear();
            sel.add(keyId);
            this.state.selectedKeyId = keyId;
        }
        this.update();
    }

    clearSelection() {
        if (this.state.selectedKeyId == null && this.state.multiSelectIds.size === 0) return;
        this.state.selectedKeyId = null;
        this.state.multiSelectIds.clear();
        this.update();
    }

    /* ============================================================ */
    /*  Inline label editing (iteration 8a)                         */
    /* ============================================================ */

    /**
     * Open an HTML input over a key so the user can rename it in place.
     *
     * Edit target is picked by kind:
     *   - `char` keys with a `chars.base` glyph  -> edits `chars.base`
     *     (preserves the Latin/Cyrillic rendering rules in renderKeyTypography).
     *   - everything else                        -> edits `label`
     *
     * Positioning uses the live rect's getBoundingClientRect so zoom/pan are
     * honored automatically. The editor is torn down on Enter/Blur (commit),
     * Escape (cancel), window resize, or any re-render.
     */
    startInlineEdit(keyId) {
        // If an editor is already open for another key, commit it first.
        if (this.inlineEditor) this._finishInlineEdit(true);

        const svg = this.dom?.svg;
        const rect = svg?.querySelector(`rect[data-object-id="${CSS.escape(keyId)}"]`);
        if (!rect) return;

        const template = this.settingsStore.get('template');
        const found = findKeyInTemplate(template, keyId);
        if (!found) return;

        // Edit target.
        let field, initial;
        if (found.key.kind === 'char' && found.key.chars && 'base' in found.key.chars) {
            field   = 'chars.base';
            initial = found.key.chars.base ?? '';
        } else {
            field   = 'label';
            initial = found.key.label ?? '';
        }

        const bbox = rect.getBoundingClientRect();
        const input = document.createElement('input');
        input.type  = 'text';
        input.value = initial;
        input.setAttribute('data-inline-editor', 'true');
        input.setAttribute('aria-label', `Edit ${field} of key ${keyId}`);
        Object.assign(input.style, {
            position:     'fixed',
            left:         `${bbox.left}px`,
            top:          `${bbox.top}px`,
            width:        `${Math.max(40, bbox.width)}px`,
            height:       `${Math.max(22, bbox.height)}px`,
            zIndex:       '9999',
            fontFamily:   'YSText-Regular, "YS Text", Helvetica, Arial, sans-serif',
            fontSize:     `${Math.max(11, Math.min(18, bbox.height * 0.4))}px`,
            color:        '#e6e7e8',
            background:   '#1f1f1f',
            border:       '1.5px solid #4ea1ff',
            borderRadius: '4px',
            padding:      '0 6px',
            textAlign:    'center',
            outline:      'none',
            boxShadow:    '0 2px 8px rgba(0,0,0,0.4)'
        });
        document.body.appendChild(input);

        this.inlineEditor = { input, keyId, field, initial };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')      { e.preventDefault(); this._finishInlineEdit(true);  }
            else if (e.key === 'Escape'){ e.preventDefault(); this._finishInlineEdit(false); }
        });
        input.addEventListener('blur', () => this._finishInlineEdit(true));

        requestAnimationFrame(() => { input.focus(); input.select(); });
    }

    /* ============================================================ */
    /*  Drag-reorder within a row (iteration 8b)                    */
    /* ============================================================ */

    /**
     * Wire up pointer-drag on a key rect so the user can reorder it inside
     * its row.
     *
     * Scope for MVP: only plain `row.keys` arrays -- arrow cluster, numpad
     * grid and `row.additionalKey` have structural semantics (grid coordinates,
     * dedicated slot) where a simple left-right swap isn't meaningful. For
     * those keys, pointerdown does nothing and the normal click/dblclick
     * handlers keep working.
     *
     * UX:
     *   - grab cursor at rest, grabbing during drag;
     *   - a 4 px threshold separates click from drag so selection still works;
     *   - a blue drop indicator line shows where the key will land;
     *   - Escape cancels mid-drag without mutating the template.
     */
    _initKeyDrag(rect, key) {
        rect.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const template = this.settingsStore.get('template');
            const found = findKeyInTemplate(template, key.id);
            if (!found || !found.list) return;
            // Only drag within plain row.keys (skip arrow cluster / numpad / additional).
            if (found.list !== found.row.keys) return;
            if (found.row.keys.length <= 1) return;

            const startX = e.clientX;
            const startY = e.clientY;
            const state = {
                active:   false,
                keyId:    key.id,
                row:      found.row,
                oldIndex: found.index,
                rect
            };

            const onMove = (ev) => {
                if (!state.active) {
                    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
                    state.active = true;
                    rect.style.cursor  = 'grabbing';
                    rect.style.opacity = '0.55';
                    // Raise the dragged rect to the top of its row group so the
                    // opacity overlay looks right above its neighbours.
                    rect.parentNode?.appendChild(rect);
                }
                this._updateDragIndicator(state, ev);
            };

            const onUp = (ev) => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup',   onUp);
                document.removeEventListener('keydown',     onKey);
                if (!state.active) return;
                ev.stopPropagation();
                this._suppressNextClick = true;
                this._commitDrag(state, ev, /*cancel*/ false);
            };

            const onKey = (ev) => {
                if (ev.key !== 'Escape' || !state.active) return;
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup',   onUp);
                document.removeEventListener('keydown',     onKey);
                this._commitDrag(state, null, /*cancel*/ true);
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup',   onUp);
            document.addEventListener('keydown',     onKey);
        });
    }

    /**
     * Figure out where in `row.keys` the dragged key should be inserted
     * given the current pointer position. Returns an integer in [0..N].
     */
    _dropIndex(row, ev) {
        const svg = this.dom?.svg;
        if (!svg) return 0;
        let idx = 0;
        for (const k of row.keys) {
            const r = svg.querySelector(`rect[data-object-id="${CSS.escape(k.id)}"]`);
            if (!r) continue;
            const box = r.getBoundingClientRect();
            if (ev.clientX > box.left + box.width / 2) idx++;
            else break;
        }
        return idx;
    }

    _updateDragIndicator(state, ev) {
        const svg = this.dom?.svg;
        if (!svg) return;

        const insertIdx = this._dropIndex(state.row, ev);
        const keys = state.row.keys;

        // Resolve the x in SVG user units. Use the rect attrs (mm) since
        // ZoomPanManager drives everything via viewBox.
        let xMm;
        if (insertIdx === 0) {
            const first = svg.querySelector(`rect[data-object-id="${CSS.escape(keys[0].id)}"]`);
            if (!first) return;
            xMm = +first.getAttribute('x') - 0.3;
        } else {
            const prev = svg.querySelector(`rect[data-object-id="${CSS.escape(keys[insertIdx - 1].id)}"]`);
            if (!prev) return;
            xMm = +prev.getAttribute('x') + +prev.getAttribute('width') + 0.3;
        }

        // Use any rect from the row for vertical extents.
        const ref = svg.querySelector(`rect[data-object-id="${CSS.escape(keys[0].id)}"]`);
        if (!ref) return;
        const y1 = +ref.getAttribute('y') - 0.8;
        const y2 = +ref.getAttribute('y') + +ref.getAttribute('height') + 0.8;

        if (!this._dragIndicator) {
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('stroke',         '#4ea1ff');
            line.setAttribute('stroke-width',   '0.6');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('pointer-events', 'none');
            line.setAttribute('data-interactive', 'true');
            svg.appendChild(line);
            this._dragIndicator = line;
        }
        this._dragIndicator.setAttribute('x1', xMm);
        this._dragIndicator.setAttribute('y1', y1);
        this._dragIndicator.setAttribute('x2', xMm);
        this._dragIndicator.setAttribute('y2', y2);
    }

    _removeDragIndicator() {
        if (this._dragIndicator?.parentNode) {
            this._dragIndicator.parentNode.removeChild(this._dragIndicator);
        }
        this._dragIndicator = null;
    }

    /**
     * Wire pointer-drag on a row's grab handle so the user can reorder whole
     * rows vertically within `template.rows`.
     *
     * Uses the same 4 px threshold and Escape-cancels-drag semantics as key
     * drag-reorder. The drop indicator is a horizontal blue line between rows.
     */
    _initRowDrag(hit, rowId) {
        hit.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            const template = this.settingsStore.get('template');
            const rowIdx = (template?.rows || []).findIndex(r => r.id === rowId);
            if (rowIdx < 0 || template.rows.length <= 1) return;

            const startX = e.clientX;
            const startY = e.clientY;
            const state = {
                active:   false,
                rowId,
                oldIndex: rowIdx,
                handle:   hit
            };

            const onMove = (ev) => {
                if (!state.active) {
                    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
                    state.active = true;
                    hit.style.cursor = 'grabbing';
                }
                this._updateRowDragIndicator(state, ev);
            };

            const onUp = (ev) => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup',   onUp);
                document.removeEventListener('keydown',     onKey);
                if (!state.active) { hit.style.cursor = 'grab'; return; }
                ev.stopPropagation();
                this._commitRowDrag(state, ev, /*cancel*/ false);
            };

            const onKey = (ev) => {
                if (ev.key !== 'Escape' || !state.active) return;
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup',   onUp);
                document.removeEventListener('keydown',     onKey);
                this._commitRowDrag(state, null, /*cancel*/ true);
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup',   onUp);
            document.addEventListener('keydown',     onKey);
        });
    }

    /**
     * For the current cursor Y, compute the insertion slot index in
     * template.rows (0..rows.length). Uses the midline of each row's handle
     * as the split point.
     */
    _rowDropIndex(ev) {
        const svg = this.dom?.svg;
        const template = this.settingsStore.get('template');
        if (!svg || !template) return 0;

        let idx = 0;
        for (const r of template.rows) {
            const handle = svg.querySelector(`[data-row-handle="${CSS.escape(r.id)}"]`);
            if (!handle) continue;
            const box = handle.getBoundingClientRect();
            if (ev.clientY > box.top + box.height / 2) idx++;
            else break;
        }
        return idx;
    }

    _updateRowDragIndicator(state, ev) {
        const svg = this.dom?.svg;
        const template = this.settingsStore.get('template');
        if (!svg || !template) return;

        const insertIdx = this._rowDropIndex(ev);
        const rows = template.rows;

        // Resolve a y in SVG mm coords. Use the first key's rect of the
        // neighboring row as anchor.
        const refRowIdx = insertIdx === 0 ? 0 : insertIdx - 1;
        const refRow = rows[refRowIdx];
        if (!refRow?.keys?.length) return;
        const anchor = svg.querySelector(`rect[data-object-id="${CSS.escape(refRow.keys[0].id)}"]`);
        if (!anchor) return;

        const yMm = insertIdx === 0
            ? +anchor.getAttribute('y') - 0.6
            : +anchor.getAttribute('y') + +anchor.getAttribute('height') + 0.6;

        // Horizontal span: from first key of first row to right edge of
        // the backdrop (approx via widest row). Simpler: use the selected
        // row's left..right extent.
        const firstKeyRect = svg.querySelector(`rect[data-object-id="${CSS.escape(rows[0].keys[0].id)}"]`);
        if (!firstKeyRect) return;
        const x1 = +firstKeyRect.getAttribute('x') - 0.5;
        // Right edge: last key of refRow if it has keys.
        const last = refRow.keys[refRow.keys.length - 1];
        const lastRect = svg.querySelector(`rect[data-object-id="${CSS.escape(last.id)}"]`);
        const x2 = lastRect
            ? (+lastRect.getAttribute('x') + +lastRect.getAttribute('width') + 0.5)
            : (x1 + 100);

        if (!this._dragIndicator) {
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('stroke',         '#4ea1ff');
            line.setAttribute('stroke-width',   '0.6');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('pointer-events', 'none');
            line.setAttribute('data-interactive', 'true');
            svg.appendChild(line);
            this._dragIndicator = line;
        }
        this._dragIndicator.setAttribute('x1', x1);
        this._dragIndicator.setAttribute('y1', yMm);
        this._dragIndicator.setAttribute('x2', x2);
        this._dragIndicator.setAttribute('y2', yMm);
    }

    _commitRowDrag(state, ev, cancel) {
        this._removeDragIndicator();
        if (state.handle) state.handle.style.cursor = 'grab';
        if (cancel || !ev) return;

        const template = this.settingsStore.get('template');
        const rows = template.rows;
        const oldIndex = rows.findIndex(r => r.id === state.rowId);
        if (oldIndex < 0) return;

        const newIndex = this._rowDropIndex(ev);
        const insertAt = newIndex > oldIndex ? newIndex - 1 : newIndex;
        if (insertAt === oldIndex) return;

        const [moved] = rows.splice(oldIndex, 1);
        rows.splice(insertAt, 0, moved);

        this.commitTemplate(template, {
            historyLabel: `row:reorder:${state.rowId}`
        });
    }

    /**
     * Drag-reorder whole rows via the left-edge handle (iteration 8b-rest).
     *
     * Restricted to rows that live in `template.rows`. Numpad and arrow
     * cluster rows are structural and don't appear in template.rows, so their
     * handles don't exist in the first place.
     */
    _initRowDrag(hit, rowId) {
        hit.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            const template = this.settingsStore.get('template');
            const rows = template?.rows || [];
            const oldIndex = rows.findIndex(r => r.id === rowId);
            if (oldIndex < 0 || rows.length <= 1) return;

            const startX = e.clientX;
            const startY = e.clientY;
            const state = {
                active:   false,
                rowId,
                oldIndex,
                hit
            };

            const onMove = (ev) => {
                if (!state.active) {
                    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
                    state.active = true;
                    hit.style.cursor = 'grabbing';
                }
                this._updateRowDragIndicator(state, ev);
            };

            const onUp = (ev) => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup',   onUp);
                document.removeEventListener('keydown',     onKey);
                if (!state.active) return;
                ev.stopPropagation();
                this._commitRowDrag(state, ev, /*cancel*/ false);
            };

            const onKey = (ev) => {
                if (ev.key !== 'Escape' || !state.active) return;
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup',   onUp);
                document.removeEventListener('keydown',     onKey);
                this._commitRowDrag(state, null, /*cancel*/ true);
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup',   onUp);
            document.addEventListener('keydown',     onKey);
        });
    }

    /** Find the insertion index (0..rows.length) for the current cursor Y. */
    _rowDropIndex(ev) {
        const svg = this.dom?.svg;
        if (!svg) return 0;
        const template = this.settingsStore.get('template');
        const rows = template?.rows || [];

        let idx = 0;
        for (const r of rows) {
            // Use the first rect of the row as its vertical reference.
            const rect = svg.querySelector(`[data-row-id="${CSS.escape(r.id)}"]`);
            if (!rect) continue;
            const box = rect.getBoundingClientRect();
            if (ev.clientY > box.top + box.height / 2) idx++;
            else break;
        }
        return idx;
    }

    _updateRowDragIndicator(state, ev) {
        const svg = this.dom?.svg;
        if (!svg) return;
        const template = this.settingsStore.get('template');
        const rows = template?.rows || [];
        const insertIdx = this._rowDropIndex(ev);

        // Figure out the Y (mm) for the indicator line.
        let yMm;
        if (insertIdx === 0) {
            const firstRow = rows[0];
            const ref = svg.querySelector(`rect[data-row-id="${CSS.escape(firstRow.id)}"]`);
            if (!ref) return;
            yMm = +ref.getAttribute('y') - 0.6;
        } else {
            const prevRow = rows[insertIdx - 1];
            const ref = svg.querySelector(`rect[data-row-id="${CSS.escape(prevRow.id)}"]`);
            if (!ref) return;
            yMm = +ref.getAttribute('y') + +ref.getAttribute('height') + 0.6;
        }

        // Use the whole keyboard width for the indicator.
        const backdropW = this.lastLayout?.backdropW || 0;
        const backdropX = this.lastLayout?.backdropX || 0;
        const pad       = +this.settings.padding    || 0;
        const x1 = backdropX + pad;
        const x2 = backdropX + backdropW - pad;

        if (!this._dragIndicator) {
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('stroke',         '#4ea1ff');
            line.setAttribute('stroke-width',   '0.6');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('pointer-events', 'none');
            line.setAttribute('data-interactive', 'true');
            svg.appendChild(line);
            this._dragIndicator = line;
        }
        this._dragIndicator.setAttribute('x1', x1);
        this._dragIndicator.setAttribute('y1', yMm);
        this._dragIndicator.setAttribute('x2', x2);
        this._dragIndicator.setAttribute('y2', yMm);
    }

    _commitRowDrag(state, ev, cancel) {
        this._removeDragIndicator();
        if (state.hit) state.hit.style.cursor = 'grab';
        if (cancel || !ev) return;

        const template = this.settingsStore.get('template');
        const rows = template.rows;
        const oldIndex = rows.findIndex(r => r.id === state.rowId);
        if (oldIndex < 0) return;

        const newIndex = this._rowDropIndex(ev);
        const insertAt = newIndex > oldIndex ? newIndex - 1 : newIndex;
        if (insertAt === oldIndex) return;

        const [moved] = rows.splice(oldIndex, 1);
        rows.splice(insertAt, 0, moved);

        this.commitTemplate(template, { historyLabel: `row:reorder:${state.rowId}` });
    }

    /**
     * Finalize (or cancel) an active drag. On commit, splice the dragged key
     * to the computed insertion index and push one undo entry.
     */
    _commitDrag(state, ev, cancel) {
        this._removeDragIndicator();
        if (state.rect) {
            state.rect.style.cursor  = 'grab';
            state.rect.style.opacity = '';
        }
        if (cancel || !ev) return;

        const template = this.settingsStore.get('template');
        const found = findKeyInTemplate(template, state.keyId);
        if (!found || found.list !== found.row.keys) return;

        const newIndex = this._dropIndex(state.row, ev);
        const oldIndex = found.index;
        // Splice-out + splice-in: if old was before the drop slot, shift by -1.
        const insertAt = newIndex > oldIndex ? newIndex - 1 : newIndex;
        if (insertAt === oldIndex) return; // no-op drop

        const [moved] = found.row.keys.splice(oldIndex, 1);
        found.row.keys.splice(insertAt, 0, moved);

        this.commitTemplate(template, {
            selectKeyId:  state.keyId,
            historyLabel: `key:reorder:${state.keyId}`
        });
    }

    /**
     * Finish the current inline edit.
     *
     * @param {boolean} commit - true = write value back and push history;
     *                           false = drop the input without touching the template.
     */
    _finishInlineEdit(commit) {
        const ed = this.inlineEditor;
        if (!ed) return;
        // Clear the reference BEFORE calling commitTemplate so the recursive
        // update() doesn't try to close the editor we're already finishing.
        this.inlineEditor = null;
        if (ed.input.parentNode) ed.input.parentNode.removeChild(ed.input);
        if (!commit) return;

        const next = ed.input.value;
        if (next === ed.initial) return;

        const template = this.settingsStore.get('template');
        const found = findKeyInTemplate(template, ed.keyId);
        if (!found) return;

        if (ed.field === 'label') {
            found.key.label = next;
        } else if (ed.field === 'chars.base') {
            if (!found.key.chars) found.key.chars = {};
            found.key.chars.base = next;
        }
        this.commitTemplate(template, {
            selectKeyId:  ed.keyId,
            historyLabel: `key:${ed.field}:${ed.keyId}`
        });
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
            wSnap:     $('insKeyWSnap'),
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
            // Bulk-aware: if 2+ keys are selected, apply to all, otherwise fall
            // through to the existing single-key update.
            if (this.state.multiSelectIds.size > 1) {
                const labelKey = Object.keys(partial)[0] ?? 'patch';
                this._patchSelected(partial, `key:${labelKey}`);
            } else {
                this.updateSelectedKey(partial);
            }
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

        // Reset buttons: bulk-aware via _patchSelected helper.
        ins.wReset?.addEventListener('click', () => this._patchSelected({ wMm: undefined }, 'key:wReset'));
        ins.hReset?.addEventListener('click', () => this._patchSelected({ hMm: undefined }, 'key:hReset'));

        // Snap current width to the nearest 0.25 U (= 0.25 * baseW mm).
        // Acts on whichever width is currently effective: wMm override if
        // set, otherwise the ratio-derived width (baseW * w). Result is
        // stored as wMm so subsequent baseW changes don't override it.
        ins.wSnap?.addEventListener('click', () => {
            const ids = this._selectedKeyIds();
            if (ids.length === 0) return;
            const baseW  = +this.settingsStore.get('keyWidth') || 16.8;
            const STEP_U = 0.25;
            const template = this.settingsStore.get('template');
            let changed = 0;
            for (const id of ids) {
                const found = findKeyInTemplate(template, id);
                if (!found) continue;
                const curMm = (isFinite(+found.key.wMm) && +found.key.wMm > 0)
                    ? +found.key.wMm
                    : (baseW * (+found.key.w || 1));
                const u = curMm / baseW;
                const snappedU = Math.max(STEP_U, Math.round(u / STEP_U) * STEP_U);
                found.key.wMm = +(snappedU * baseW).toFixed(4);
                changed++;
            }
            if (!changed) return;
            const label = ids.length > 1 ? `key:snapW:bulk(${changed})` : 'key:snapW';
            this.commitTemplate(template, { historyLabel: label });
        });
    }

    /**
     * Bulk-apply a patch to every currently selected key in one history entry.
     * Patch semantics match updateSelectedKey: `undefined` deletes the field.
     * Falls back to single-key updateSelectedKey when only one is selected
     * (so existing validation / label-syncing stays in one place).
     */
    _patchSelected(partial, actionLabel = 'key:patch') {
        if (this.inspector?.muted) return;
        const ids = this._selectedKeyIds();
        if (ids.length <= 1) {
            this.updateSelectedKey(partial);
            return;
        }
        const template = this.settingsStore.get('template');
        let changed = 0;
        for (const id of ids) {
            const found = findKeyInTemplate(template, id);
            if (!found) continue;
            for (const [field, value] of Object.entries(partial)) {
                if (value === undefined) delete found.key[field];
                else                     found.key[field] = value;
            }
            changed++;
        }
        if (!changed) return;
        this.commitTemplate(template, {
            historyLabel: `${actionLabel}:bulk(${changed})`
        });
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

            // Multi-select presentation:
            //   - Primary key still fills the inspector (so users can see what
            //     they're editing when Snap/Reset/Delete run in bulk).
            //   - Identity fields (id, label, kind) are disabled to prevent
            //     accidentally clobbering every key with one value.
            //   - Row-level actions apply to the primary's row only; left
            //     enabled, but hint shows the bulk count.
            const multiCount = this.state.multiSelectIds.size;
            const isMulti = multiCount > 1;
            if (ins.label) ins.label.disabled = isMulti;
            if (ins.kind)  ins.kind .disabled = isMulti;
            if (ins.idField) ins.idField.disabled = true; // always read-only
            if (isMulti) {
                ins.hint.textContent =
                    `${multiCount} keys selected - width/height, Snap, Reset, Duplicate and Delete act on all`;
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

    /**
     * Delete every selected key in a single history entry.
     *
     * Iterates by-id each time so the intermediate splices don't corrupt
     * the subsequent lookups. Keys outside a list (additionalKey slot) are
     * skipped silently since they're row-positional, not row-members.
     */
    deleteSelectedKey() {
        const ids = this._selectedKeyIds();
        if (ids.length === 0) return;
        const template = this.settingsStore.get('template');
        let changed = 0;
        for (const id of ids) {
            const found = findKeyInTemplate(template, id);
            if (!found || !found.list) continue;
            found.list.splice(found.index, 1);
            changed++;
        }
        if (!changed) return;
        this.state.multiSelectIds.clear();
        const label = ids.length > 1 ? `key:delete:bulk(${changed})` : 'key:delete';
        this.commitTemplate(template, { selectKeyId: null, historyLabel: label });
    }

    duplicateSelectedKey() {
        const ids = this._selectedKeyIds();
        if (ids.length === 0) return;
        const template = this.settingsStore.get('template');
        const newIds = [];
        // Snapshot existing ids ONCE so all duplicates get unique ids vs each
        // other, not just vs the pre-duplicate state.
        const existingIds = this.collectKeyIds(template);
        for (const id of ids) {
            const found = findKeyInTemplate(template, id);
            if (!found || !found.list) continue;
            const copy = clone(found.key);
            copy.id = this.uniqueKeyId(existingIds, found.key.id);
            existingIds.push(copy.id);
            found.list.splice(found.index + 1, 0, copy);
            newIds.push(copy.id);
        }
        if (newIds.length === 0) return;
        // Select the duplicates as the new multi-selection.
        this.state.multiSelectIds = new Set(newIds);
        const primary = newIds[newIds.length - 1];
        const label = ids.length > 1 ? `key:duplicate:bulk(${newIds.length})` : 'key:duplicate';
        this.commitTemplate(template, { selectKeyId: primary, historyLabel: label });
    }

    /**
     * Return the list of keys to act on.
     * Uses `multiSelectIds` if non-empty, otherwise falls back to the
     * legacy single `selectedKeyId`.
     */
    _selectedKeyIds() {
        const set = this.state.multiSelectIds;
        if (set && set.size > 0) return Array.from(set);
        return this.state.selectedKeyId ? [this.state.selectedKeyId] : [];
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

    /**
     * Produce an export-ready clone of the live SVG.
     *
     * - Strips any preview-only `display:none` (lets safeguard layer ship when
     *   `exportSafeguard` is on but `showSafeguard` is off).
     * - Leaves the original DOM untouched; caller gets a detached clone.
     *
     * The SVGExporter clones internally too, so the double-clone is cheap and
     * isolates export-side mutations from the live preview.
     */
    _buildExportSvg() {
        const svg = this.dom?.svg;
        if (!svg) return null;
        const clone = svg.cloneNode(true);
        clone.querySelectorAll('[data-preview-hidden="true"]').forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-preview-hidden');
        });
        // Mirror export dims from the live svg so the exporter can read them.
        const w = svg.getAttribute('data-export-width');
        const h = svg.getAttribute('data-export-height');
        const u = svg.getAttribute('data-export-unit');
        if (w) clone.setAttribute('data-export-width',  w);
        if (h) clone.setAttribute('data-export-height', h);
        if (u) clone.setAttribute('data-export-unit',   u);
        return clone;
    }

    async exportSVG() {
        const clone = this._buildExportSvg();
        if (!clone) return;
        await this.svgExporter.exportToFile(clone, 'keyboard-layout.svg', {
            removeInteractive:     true,
            convertTextToOutlines: !!this.settings.outlineFonts
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
            // UI selection isn't part of the snapshot — clear both primary
            // and multi-select so stale ids don't linger across undo/redo.
            this.state.selectedKeyId = null;
            this.state.multiSelectIds.clear();
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
            padKeySlider:       'padKeyMm',
            iconSizeSlider:     'iconSize'
        };
        for (const [id, key] of Object.entries(map)) {
            const val = this.settingsStore.get(key);
            if (val != null) this.sliders?.setValue(id, val, false);
        }
    }
}

export { KeyboardLayoutApp };
