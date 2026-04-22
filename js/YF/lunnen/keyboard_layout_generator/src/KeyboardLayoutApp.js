/**
 * KeyboardLayoutApp -- Keyboard Layout Generator
 *
 * Iteration 4a: real typography on keys.
 *   - YSText-Regular from /fonts is loaded via @font-face and used for every
 *     text element on the keyboard graphic (not for the framework UI).
 *   - renderKeyTypography places label / base / shift / ru / ruShift in the
 *     four corners of the key, anchored to an inner padding rectangle that
 *     doubles as the text-safe (guides) zone (iteration 4c will make it visible).
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
 *   - Key color picker, layered rendering, presets, SVG/JSON export.
 */

import { Settings }         from '../yf-ui-framework/src/core/Settings.js';
import { DOMCache }         from '../yf-ui-framework/src/core/DOMCache.js';
import { ZoomPanManager }   from '../yf-ui-framework/src/ui/ZoomPanManager.js';
import { SliderController } from '../yf-ui-framework/src/ui/SliderController.js';
import { PanelManager }     from '../yf-ui-framework/src/ui/PanelManager.js';
import { HistoryManager }   from '../yf-ui-framework/src/history/HistoryManager.js';
import { PresetManager }    from '../yf-ui-framework/src/preset/PresetManager.js';
import { SVGExporter }      from '../yf-ui-framework/src/export/SVGExporter.js';
import { TextToPath }       from '../yf-ui-framework/src/utils/TextToPath.js';
import { ColorUtils }       from '../yf-ui-framework/src/utils/ColorUtils.js';
import { computeLayout }    from './layout/layoutEngine.js';
import { TEMPLATES, DEFAULT_TEMPLATE_ID } from './data/rowTemplates.js';
import { ICONS, iconTransform } from './assets/icons.js';
import { validateTemplate }    from './model/templateSchema.js';
import {
    findKeyInTemplate,
    collectKeyIds as tplCollectKeyIds,
    collectRowIds as tplCollectRowIds,
    uniqueKeyId   as tplUniqueKeyId,
    uniqueRowId   as tplUniqueRowId
}                              from './model/templateOps.js';
import { showToast }           from './ui/Toast.js';
import { renderBackdrop         as rBackdrop         } from './render/renderBackdrop.js';
import { renderGuides          as rGuides            } from './render/renderGuides.js';
import { renderSelectionOverlay as rSelectionOverlay } from './render/renderSelectionOverlay.js';
import { renderTypography       as rTypography       } from './render/renderTypography.js';
import { DragController }         from './ui/DragController.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Deep clone a plain object (used for making template mutable). */
const clone = (o) => JSON.parse(JSON.stringify(o));

const DEFAULTS = {
    /* SVG size from computeLayout: artboard = keyboard block + gapX/gapY margins. */

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
    showGuides: false,

    /* Languages: which glyph sets to render on char keys.
       These toggles affect `base`/`shift` (Latin) and `ru`/`ruShift` (Cyrillic)
       independently. When only one language is on, its glyphs are promoted to
       the primary (left / top-left) position; bottom-right / right-column
       positions become empty. Special-key `label`s are unaffected. */
    showLatin:     true,
    showCyrillic:  true,

    /* Export options (iteration 7).
       These are independent of the preview toggles so a user can, for example,
       hide guides while designing but still ship them in the exported SVG
       so the print shop has the exact text-safe zones. */
    outlineFonts:  false,   // convert <text> -> <path> on SVG/PDF export
    exportGuides:  false    // include Guides layer in the exported file */
};

class KeyboardLayoutApp {

    constructor(overrides = {}) {
        this.settingsStore = new Settings({ ...DEFAULTS, ...overrides });
        // Convention for settings access (enforced informally, not mechanically):
        //   • `this.settings.foo`            — short read for a known static field
        //                                      (geometry sliders, color flags, toggles).
        //   • `this.settingsStore.get(name)` — use when `name` is computed, when
        //                                      you want explicit store semantics, OR
        //                                      when reading `template` / `templateId`
        //                                      (mutable object; reminds the reader to
        //                                      clone before mutation).
        //   • `this.settingsStore.set(...)`  — ALL writes go through the store so the
        //                                      proxy stays read-only and subscriptions fire.
        this.settings      = this.settingsStore.createProxy();
        this._migrateLegacyGuideSettings();

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

        // Drag-reorder UX (keys within / between template rows; whole-row moves) is
        // fully owned by DragController. The controller holds the single
        // drop-indicator element and the suppress-click flag.
        this.dragController = new DragController({
            getSvg:        () => this.dom?.svg,
            getTemplate:   () => this.settingsStore.get('template'),
            getLayout:     () => this.lastLayout,
            getArtboardInsetX: () => this.settings.gapX,
            findKey:       (t, id) => findKeyInTemplate(t, id),
            commitTemplate:(t, opts) => this.commitTemplate(t, opts)
        });

        this.zoomPan        = null;
        this.sliders        = null;
        this.panels         = null;
        this.historyManager = null;
        this.presetManager  = null;
        this.svgExporter    = null;
        this.textToPath     = null;
    }

    /**
     * Rename migration: `showSafeguard` / `exportSafeguard` -> `showGuides` / `exportGuides`.
     * Call after any full Settings merge (constructor, preset load, undo/redo).
     */
    _migrateLegacyGuideSettings() {
        const d = this.settingsStore.data;
        if (!d) return;
        if (d.showGuides === undefined && d.showSafeguard !== undefined) {
            d.showGuides = d.showSafeguard;
        }
        delete d.showSafeguard;
        if (d.exportGuides === undefined && d.exportSafeguard !== undefined) {
            d.exportGuides = d.exportSafeguard;
        }
        delete d.exportSafeguard;
        /* Obsolete: artboard margin now follows gapX / gapY in layoutEngine. */
        delete d.padding;
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
                    this._migrateLegacyGuideSettings();
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
        const exportGuidesCb = document.getElementById('exportGuidesCheckbox');
        if (exportGuidesCb) {
            exportGuidesCb.checked = !!this.settingsStore.get('exportGuides');
            exportGuidesCb.addEventListener('change', () => {
                this.settingsStore.set('exportGuides', exportGuidesCb.checked);
                this.update();
                this.pushHistory('toggle:exportGuides');
            });
            this.settingsStore.subscribe('exportGuides', (v) => { exportGuidesCb.checked = !!v; });
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
            // Skip when the user is typing into any input / textarea / the
            // inline editor / contenteditable — we don't want Delete to nuke
            // keys while someone is editing a label.
            if (this._isTypingInInput(e.target)) return;

            const mod = e.metaKey || e.ctrlKey;
            const key = e.key.toLowerCase();

            if (mod) {
                if (key === 'z' && !e.shiftKey)    { e.preventDefault(); this.undo(); return; }
                if (key === 'z' &&  e.shiftKey)    { e.preventDefault(); this.redo(); return; }
                if (key === 'e')                   { e.preventDefault(); void this.exportSVG(); return; }
                return;
            }

            // Non-modifier shortcuts: only fire when something is selected.
            const hasSelection =
                this.state.selectedKeyId != null ||
                this.state.multiSelectIds.size > 0;

            if (key === 'escape') {
                if (this.inlineEditor) { this._finishInlineEdit(false); return; }
                if (hasSelection)      { this.clearSelection(); e.preventDefault(); }
                return;
            }

            if ((key === 'delete' || key === 'backspace') && hasSelection) {
                e.preventDefault();
                this.deleteSelectedKey();
                return;
            }
        });
    }

    /**
     * True when an event target is a real user-typing surface (input, textarea,
     * contenteditable, or the inline-rename editor). Used to gate keyboard
     * shortcuts so e.g. Delete doesn't nuke keys while the user types.
     */
    _isTypingInInput(target) {
        if (!target || target.nodeType !== 1) return false;
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (target.isContentEditable) return true;
        return false;
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
        this.dragController._removeIndicator();

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

            // viewBox matches artboard (keys + gapX/gapY margins).
            svg.setAttribute('width',  `${w}mm`);
            svg.setAttribute('height', `${h}mm`);
            svg.setAttribute('data-export-width',  w);
            svg.setAttribute('data-export-height', h);
            svg.setAttribute('data-export-unit',   'mm');
            if (!this.zoomPan) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

            this.renderBackdrop(svg, layout);
            this.renderKeys(svg, layout);
            this.renderGuides(svg, layout);
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
        rBackdrop(svg, layout, {
            showBackdrop: this.settings.showBackdrop,
            backdropFill: this.settings.backdropFill
        });
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
                if (this.dragController.shouldSuppressNextClick()) return;
                const additive = e.shiftKey || e.metaKey || e.ctrlKey;
                this.selectKey(key.id, { additive });
            });
            // Double-click enters inline label edit mode (iteration 8a).
            rect.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startInlineEdit(key.id);
            });
            // Drag-to-reorder keys (same row or another row; iteration 8b+).
            this._initKeyDrag(rect, key);
            g.appendChild(rect);

            this.renderKeyTypography(g, key);
        }

        // Row drag handles (iteration 8b-rest). Anchored left of each template row
        // in the gap margin. Marked interactive so SVGExporter strips them.
        this._renderRowHandles(parent, firstKeyPerRow, layout);

        svg.appendChild(parent);
    }

    /**
     * Render a small grab handle at the left of every template row so the
     * user can drag-reorder whole rows. The handle is a 3x3 dots grid that
     * sits in the left margin (gapX); it's non-exported (`data-interactive`)
     * and ignores guides / keys layers.
     */
    _renderRowHandles(parent, firstKeyPerRow, layout) {
        if (firstKeyPerRow.size === 0) return;

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('id', 'RowHandles');
        g.setAttribute('data-interactive', 'true');

        // Handle sits left of keys in the gap margin. Offset scales with gapX,
        // clamped to [0.8..2.4] mm from the key edge.
        const gx      = +this.settings.gapX || 1.6;
        const offsetX = -Math.max(0.8, Math.min(2.4, gx * 0.7));
        const dotR    = 0.3;                   // mm
        const spacing = 0.9;                   // mm between dot centers

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
     * Draws the guides (inner inset) rectangle for every key.
     *
     * The inset equals `padKeyMm` - the same value that anchors all on-key
     * typography, so what users see as the guides outline is literally
     * the text placement boundary.
     *
     * Rendered as a regular, non-interactive SVG layer, so toggling
     * `showGuides` affects both canvas preview and exported SVG.
     */
    renderGuides(svg, layout) {
        rGuides(svg, layout, {
            showGuides:   this.settings.showGuides,
            exportGuides: this.settings.exportGuides,
            padKeyMm:     this.settings.padKeyMm,
            radius:       this.settings.radius
        });
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
    /**
     * Build the render-context bag that the pure typography/icon modules
     * need. Single source of truth so we don't drift between callers.
     */
    _typographyCtx() {
        return {
            icons:         ICONS,
            iconTransform: iconTransform,
            padKeyMm:      this.settings.padKeyMm,
            iconSize:      this.settings.iconSize,
            fontChar:      this.settings.fontChar,
            fontShift:     this.settings.fontShift,
            fontLabel:     this.settings.fontLabel,
            fontColor:     this.settings.fontColor,
            showLatin:     this.settings.showLatin,
            showCyrillic:  this.settings.showCyrillic
        };
    }

    renderKeyTypography(parent, key) {
        rTypography(parent, key, this._typographyCtx());
    }

    /**
     * Draws a dashed outline around the currently selected key (if any).
     * Kept as a separate top layer so it always renders above keys without
     * intercepting clicks.
     */
    renderSelectionOverlay(svg, layout) {
        rSelectionOverlay(svg, layout, {
            primaryId:   this.state.selectedKeyId,
            selectedIds: this.state.multiSelectIds,
            radius:      this.settings.radius
        });
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
    /*  Drag-reorder (logic in src/ui/DragController.js)            */
    /* ============================================================ */

    _initKeyDrag(rect, key)  { this.dragController.bindKey(rect, key); }
    _initRowDrag(hit, rowId) { this.dragController.bindRowHandle(hit, rowId); }


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
            const baseW  = +this.settings.keyWidth || 16.8;
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

            const baseW = +this.settings.keyWidth || 16.8;
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

    // Thin instance-wrappers so call sites stay short. Underlying logic lives
    // in src/model/templateOps.js and is covered by unit tests.
    collectKeyIds(template) { return tplCollectKeyIds(template); }
    collectRowIds(template) { return tplCollectRowIds(template); }
    uniqueKeyId(existing, base) { return tplUniqueKeyId(existing, base); }
    uniqueRowId(existing, base) { return tplUniqueRowId(existing, base); }

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
            existingIds.add(copy.id);
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
     * - Strips any preview-only `display:none` (lets guides layer ship when
     *   `exportGuides` is on but `showGuides` is off).
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
        try {
            await this.svgExporter.exportToFile(clone, 'keyboard-layout.svg', {
                removeInteractive:     true,
                convertTextToOutlines: !!this.settings.outlineFonts
            });
            const w = +clone.getAttribute('data-export-width')  || 0;
            const h = +clone.getAttribute('data-export-height') || 0;
            this.showToast(
                `Exported ${w.toFixed(1)}x${h.toFixed(1)} mm SVG`,
                'success'
            );
        } catch (e) {
            console.error('[KeyboardLayoutApp] SVG export failed:', e);
            this.showToast(`SVG export failed: ${e.message}`, 'error');
        }
    }

    /**
     * Proxy to the Toast module. Kept as an instance method so future
     * extensions (stacking, queueing, dedup) can hook in without touching
     * every call site.
     */
    showToast(message, variant = 'info', opts = {}) {
        return showToast(message, variant, opts);
    }

    /**
     * Save the current layout to a JSON file.
     *
     * Despite the button being labelled "Export Settings" for UI consistency
     * with the YF framework, the payload intentionally contains ONLY the
     * layout template (rows/keys/overrides) — NOT colors, slider values, or
     * visibility toggles. This lets layouts be shared and re-used on any
     * Settings baseline without dragging unrelated preferences along.
     *
     * Schema: { schema: 'keyboard-template/v1', templateId, template }
     */
    exportSettings() {
        const template   = this.settingsStore.get('template');
        const templateId = this.settingsStore.get('templateId') || null;
        if (!template) return;
        const payload = {
            schema:     'keyboard-template/v1',
            templateId,
            template
        };
        try {
            this.svgExporter.exportJSON(payload, 'keyboard-layout.json');
            this.showToast(
                `Exported ${template.rows?.length ?? 0} rows as JSON`,
                'success'
            );
        } catch (e) {
            console.error('[KeyboardLayoutApp] JSON export failed:', e);
            this.showToast(`JSON export failed: ${e.message}`, 'error');
        }
    }

    /**
     * Load a layout JSON file and swap it into `Settings.template`.
     * Accepts the v1 payload ({ schema, templateId, template }) or a bare
     * template object (so users can hand-craft minimal files).
     */
    async importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const parsed = await this.svgExporter.importJSON(file);
                const tpl = parsed?.template ?? parsed;
                // validateTemplate throws a descriptive TemplateError with
                // a path like "rows[2].keys[4].wMm" on the first violation.
                validateTemplate(tpl);
                if (parsed?.templateId) {
                    this.settingsStore.set('templateId', parsed.templateId);
                }
                this.state.selectedKeyId = null;
                this.state.multiSelectIds.clear();
                this.commitTemplate(clone(tpl), { historyLabel: 'template:import' });
                this.showToast(`Imported ${tpl.rows.length} rows from "${file.name}"`, 'success');
            } catch (e) {
                console.error('[KeyboardLayoutApp] import failed:', e);
                this.showToast(`Import failed: ${e.message}`, 'error');
            }
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
            this._migrateLegacyGuideSettings();
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
     * Reflect current keyFill back into the key color picker UI.
     * Called after a preset load or undo/redo so the swatch and hex input
     * don't lag behind the actual Settings value.
     */
    syncColorPickers() {
        const keyFill = this.settings.keyFill;
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
