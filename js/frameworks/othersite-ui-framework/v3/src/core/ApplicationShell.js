/**
 * ApplicationShell — the declarative engine behind defineTool().
 *
 * Part of Othersite UI Framework v3.
 *
 * Given a single config object it wires together every framework subsystem
 * (settings, render target, sliders, range sliders, panels, color pickers, the
 * dice/random panel, tooltips, dialogs, presets, sharing, export, shortcuts and
 * change-tracking) so a new tool only has to describe its controls and provide a
 * `render(ctx)` function. No tool-specific logic lives here.
 *
 * @see defineTool
 */
import { Settings } from './Settings.js';
import { DOMCache } from './DOMCache.js';
import { ShortcutRouter } from './ShortcutRouter.js';
import { SvgTarget } from '../render/SvgTarget.js';
import { CanvasTarget } from '../render/CanvasTarget.js';
import { SliderController } from '../ui/SliderController.js';
import { RangeSliderController } from '../ui/RangeSliderController.js';
import { PanelManager } from '../ui/PanelManager.js';
import { ColorPicker } from '../ui/ColorPicker.js';
import { UnifiedColorPicker } from '../ui/UnifiedColorPicker.js';
import { DicePanel } from '../ui/DicePanel.js';
import { TooltipService } from '../ui/TooltipService.js';
import { DialogHost } from '../ui/DialogHost.js';
import { PresetStore } from '../preset/PresetStore.js';
import { PresetSession } from '../preset/PresetSession.js';
import { ShareCodec } from '../preset/ShareCodec.js';
import { HistoryBridge } from '../history/HistoryBridge.js';
import { HistoryManager } from '../history/HistoryManager.js';
import { SVGExporter } from '../export/SVGExporter.js';

/** Inline SVGs for the per-preset row action buttons (delete / share / rename). */
const PRESET_ICONS = {
    delete: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12" fill="none"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"><polyline points="5.001144 2.7699421 5.001144 1.7891858 6.998856 1.7891858 6.998856 2.7699421"/><polyline points="8.6261951 2.7699421 8.3008282 10 3.6993139 10 3.37286 2.7699421"/><line x1="2.4330709" y1="2.7699421" x2="9.5669291" y2="2.7699421"/></g></svg>',
    rename: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    share: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M5.7410987,3.4304742l.6124561-.6124561c.7810478-.7810478,2.0473765-.7810478,2.8284243,0l.0000028.0000028c.7810478.7810478.7810478,2.0473765,0,2.8284243l-.6124561.6124561"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M6.2589013,8.5695258l-.6124561.6124561c-.7810478.7810478-2.0473765.7810478-2.8284243,0l-.0000028-.0000028c-.7810478-.7810478-.7810478-2.0473765,0-2.8284243l.6124561-.6124561"/><line x1="7.5184826" y1="4.4815174" x2="4.4815174" y2="7.5184826" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"/></svg>'
};

export class ApplicationShell {
    constructor(config = {}) {
        this.config = config;

        // Subsystems (populated in init()).
        this.settingsStore = null;
        this.settings = null;
        this.domCache = null;
        this.dom = null;
        this.target = null;
        this.sliders = null;
        this.ranges = null;
        this.panels = null;
        this.colorPickers = [];
        this.unifiedColorPicker = null;
        this.dice = null;
        this.tooltips = null;
        this.dialog = null;
        this.presetStore = null;
        this.presets = null;
        this.share = null;
        this.history = null;
        this.exporter = null;
        this.shortcuts = null;

        this._initialized = false;
        this._isInitializing = true;
        this._isApplying = false;
        this._rafId = null;
    }

    /* ================================================================== */
    /*  Initialization                                                    */
    /* ================================================================== */

    async init() {
        const c = this.config;

        this._initSettings();
        this._initDom();
        this._initTarget();
        this._initSliders();
        this._initRanges();
        this._initToggles();
        this._initPanels();
        this._initColorPickers();
        this._initDice();
        this._initTooltips();
        this._initDialog();
        this._initExport();
        this._initHistoryAndPresets();
        this._initShare();
        this._initShortcuts();
        this._initChangeTracking();
        this._initPresetChrome();

        if (typeof c.onInit === 'function') c.onInit(this);

        // First render must run before zoom so the surface has real dimensions.
        this.renderNow();
        this.target.initZoom(c.zoom || {});
        this._bindZoomIndicator();

        // Load presets / shared payload after the first paint.
        await this._bootstrapPresets();

        this._isInitializing = false;
        this.renderNow();
        if (this.settingsStore) this.settingsStore.markClean();
        if (this.presets) this.presets.commit('init');
        this._refreshChrome();

        this._initialized = true;
        if (typeof c.onReady === 'function') c.onReady(this);
        return this;
    }

    _initSettings() {
        this.settingsStore = new Settings(this.config.settings || {});
        this.settings = this.settingsStore.createProxy();
    }

    _initDom() {
        this.domCache = new DOMCache();
        this.domCache.init(this.config.dom || {});
        this.dom = this.domCache.createProxy();
    }

    _initTarget() {
        const c = this.config;
        const container = this._resolveCanvasContainer();
        if (!container) throw new Error('ApplicationShell: canvas container not found (config.dom.canvas).');
        const opts = {
            width: this._logicalSize().width,
            height: this._logicalSize().height,
            element: c.dom?.surface ? document.getElementById(c.dom.surface) : undefined,
            fitPadding: c.zoom?.fitPadding
        };
        if ((c.renderer || 'svg') === 'canvas') {
            this.target = new CanvasTarget(container, opts);
            this.target.requestRender = () => this.renderNow();
        } else {
            this.target = new SvgTarget(container, opts);
        }
    }

    _initSliders() {
        const defs = this.config.controls?.sliders || [];
        if (!defs.length) return;
        this.sliders = new SliderController(this.settingsStore);
        for (const def of defs) {
            this.sliders.initSlider(def.id, { ...def, onUpdate: () => this.render() });
            if (def.setting != null && this.settingsStore.get(def.setting) != null) {
                this.sliders.setValue(def.id, this.settingsStore.get(def.setting), false);
            }
        }
    }

    _initRanges() {
        const defs = this.config.controls?.ranges || [];
        if (!defs.length) return;
        this.ranges = new RangeSliderController(this.settingsStore);
        for (const def of defs) {
            this.ranges.initRangeSlider(def.containerId, { ...def, onUpdate: () => this.render() });
            const lo = this.settingsStore.get(def.minSetting);
            const hi = this.settingsStore.get(def.maxSetting);
            if (lo != null && hi != null) this.ranges.setValues(def.containerId, lo, hi, false);
        }
    }

    _initToggles() {
        if (this.config.controls?.toggles === false) return;
        const selector = this.config.controls?.toggleSelector
            || '.toggle-chip input[type="checkbox"], input[type="checkbox"][data-setting]';
        document.querySelectorAll(selector).forEach((checkbox) => {
            const key = checkbox.dataset.setting;
            if (!key) return;
            const cur = this.settingsStore.get(key);
            if (typeof cur === 'boolean') checkbox.checked = cur;
            checkbox.addEventListener('change', () => {
                this.settingsStore.set(key, checkbox.checked);
                this.render();
            });
            this.settingsStore.subscribe(key, (v) => { checkbox.checked = !!v; });
        });
    }

    _initPanels() {
        const defs = this.config.panels || [];
        this.panels = new PanelManager();
        for (const def of defs) {
            this.panels.registerPanel(def.id, def);
        }
        if (this.config.collapse !== false) this.panels.initCollapse();
    }

    _initColorPickers() {
        const cfg = this.config.colorPickers;
        if (!cfg) return;

        // Unified mode: a single HSB picker shared across swatch rows
        // ({ containerId, swatches: [...] }). Only one row expands at a time.
        if (!Array.isArray(cfg) && Array.isArray(cfg.swatches)) {
            this.unifiedColorPicker = new UnifiedColorPicker({
                settings: this.settingsStore,
                containerId: cfg.containerId || 'unifiedColorPickerContainer',
                swatches: cfg.swatches,
                onChange: cfg.onChange
            });
            this.unifiedColorPicker.init();
            return;
        }

        const defs = Array.isArray(cfg) ? cfg : [];
        for (const def of defs) {
            const picker = new ColorPicker({
                containerId: def.containerId,
                initialColor: this.settingsStore.get(def.setting) || def.initialColor || '#808080',
                onChange: (hex) => {
                    this.settingsStore.set(def.setting, hex);
                    this.render();
                }
            });
            picker.init();
            // Keep the picker in sync when the setting changes elsewhere.
            this.settingsStore.subscribe(def.setting, (hex) => {
                if (picker.getColor && picker.getColor() !== hex) picker.setColor?.(hex);
            });
            this.colorPickers.push({ def, picker });
        }
    }

    _initDice() {
        const diceCfg = this.config.dice;
        if (!diceCfg || !diceCfg.params?.length) return;
        this.dice = new DicePanel({
            settings: this.settingsStore,
            params: diceCfg.params,
            rng: diceCfg.rng,
            onToggle: () => { this._syncControls(); diceCfg.onToggle?.(this); },
            onUpdate: () => this.render()
        });
        this.dice.init();
    }

    _initTooltips() {
        if (this.config.tooltips === false) return;
        this.tooltips = new TooltipService();
        this.tooltips.init();
    }

    _initDialog() {
        if (this.config.dialog === false) return;
        this.dialog = new DialogHost(this.config.dialog || {});
    }

    _initExport() {
        if (this.config.export === false) return;
        this.exporter = new SVGExporter(this.config.export?.exporter || {});
    }

    _initHistoryAndPresets() {
        const snapshot = () => this.getSnapshot();
        const restore = (snap) => this.applySnapshot(snap);

        if (this.config.presets) {
            this.presetStore = new PresetStore({ storageKey: this.config.presets.storageKey || 'othersitePresets' });
            this.presets = new PresetSession({
                store: this.presetStore,
                snapshot,
                restore,
                collect: () => this.getPresetBlob(),
                apply: (blob) => this.applyPresetBlob(blob),
                historyMaxSize: this.config.history?.maxSize ?? 50,
                onChange: () => this._refreshChrome()
            });
            this.history = new HistoryBridge({
                commit: (label) => this.presets.commit(label),
                debounceMs: this.config.history?.debounceMs
            });
        } else if (this.config.history !== false) {
            // History without presets: a single standalone stack.
            this._standaloneHistory = new HistoryManager({ maxSize: this.config.history?.maxSize ?? 50 });
            this.history = new HistoryBridge({
                commit: (label) => this._standaloneHistory.saveSnapshot(snapshot(), label),
                debounceMs: this.config.history?.debounceMs
            });
        }
    }

    _initShare() {
        if (!this.config.share) return;
        this.share = new ShareCodec({
            pristineDefaults: this.settingsStore.getDefaults(),
            ...this.config.share
        });
    }

    _initShortcuts() {
        this.shortcuts = new ShortcutRouter();
        const defaults = {};
        if (this.history || this.presets) {
            defaults['mod+z'] = () => this.undo();
            defaults['mod+shift+z'] = () => this.redo();
        }
        if (this.exporter) defaults['mod+e'] = () => { void this.exportSVG(); };
        this.shortcuts.registerAll(defaults);
        const custom = this.config.shortcuts || {};
        for (const [combo, handler] of Object.entries(custom)) {
            this.shortcuts.register(combo, () => handler(this));
        }
        this.shortcuts.init();
    }

    _initChangeTracking() {
        this.settingsStore.subscribe('*', (newVal, oldVal, key) => {
            if (this._isInitializing || this._isApplying) return;
            this.presets?.markDirty();
            this.history?.notifyChange(`set:${key}`);
            this.render();
        });
        // Slider drags → single history transaction.
        this._bindDragTransactions();
    }

    _bindDragTransactions() {
        if (!this.history) return;
        const begin = () => !this._isApplying && this.history.beginTransaction('drag');
        const end = () => this.history.endTransaction();
        document.querySelectorAll('input[type="range"]').forEach((el) => {
            el.addEventListener('mousedown', begin);
            el.addEventListener('touchstart', begin, { passive: true });
        });
        document.querySelectorAll('.range-slider-thumb').forEach((el) => {
            el.addEventListener('mousedown', begin);
            el.addEventListener('touchstart', begin, { passive: true });
        });
        document.addEventListener('mouseup', end);
        document.addEventListener('touchend', end);
    }

    /* ================================================================== */
    /*  Rendering                                                         */
    /* ================================================================== */

    /** Schedule a coalesced render on the next animation frame. */
    render() {
        if (this._rafId != null) return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            this.renderNow();
        });
    }

    /** Render immediately (synchronous). */
    renderNow() {
        const { width, height } = this._logicalSize();
        this.target.setLogicalSize(width, height);
        this.target.beginFrame();
        const ctx = this._renderContext();
        if (typeof this.config.render === 'function') {
            this.config.render(ctx);
        }
        this.target.endFrame();
    }

    _renderContext() {
        const { width, height } = this._logicalSize();
        return {
            app: this,
            settings: this.settings,
            store: this.settingsStore,
            target: this.target,
            dom: this.dom,
            width,
            height,
            svg: this.target.type === 'svg' ? this.target.element : null,
            ctx2d: this.target.type === 'canvas' ? this.target.ctx : null,
            create: this.target.type === 'svg' ? this.target.create.bind(this.target) : null
        };
    }

    _logicalSize() {
        const c = this.config;
        if (typeof c.size === 'function') {
            const s = c.size(this.settings || c.settings || {});
            return { width: s.width || 500, height: s.height || 500 };
        }
        const w = (this.settings && this.settings.width) ?? c.settings?.width ?? 500;
        const h = (this.settings && this.settings.height) ?? c.settings?.height ?? 500;
        return { width: w, height: h };
    }

    /* ================================================================== */
    /*  History / snapshots                                               */
    /* ================================================================== */

    getSnapshot() {
        if (typeof this.config.snapshot === 'function') return this.config.snapshot(this);
        return this.settingsStore.toObject();
    }

    applySnapshot(snap) {
        this._isApplying = true;
        try {
            if (typeof this.config.restore === 'function') {
                this.config.restore(this, snap);
            } else {
                this.settingsStore.fromJSON(snap, true);
            }
        } finally {
            this._isApplying = false;
        }
        this._syncControls();
        this.renderNow();
        this._refreshChrome();
    }

    undo() {
        if (this.history) this.history.flush();
        let done = false;
        if (this.presets) done = this.presets.undo();
        else if (this._standaloneHistory?.canUndo()) {
            const snap = this._standaloneHistory.undo();
            if (snap) { this.applySnapshot(snap); done = true; }
        }
        return done;
    }

    redo() {
        let done = false;
        if (this.presets) done = this.presets.redo();
        else if (this._standaloneHistory?.canRedo()) {
            const snap = this._standaloneHistory.redo();
            if (snap) { this.applySnapshot(snap); done = true; }
        }
        return done;
    }

    /* ================================================================== */
    /*  Presets                                                           */
    /* ================================================================== */

    /** Blob persisted for a preset. Override via config.collectPreset. */
    getPresetBlob() {
        if (typeof this.config.collectPreset === 'function') return this.config.collectPreset(this);
        return this.settingsStore.toObject();
    }

    /** Apply a stored preset blob. Override via config.applyPreset. */
    applyPresetBlob(blob) {
        this._isApplying = true;
        try {
            if (typeof this.config.applyPreset === 'function') this.config.applyPreset(this, blob);
            else this.settingsStore.fromJSON(blob, true);
        } finally {
            this._isApplying = false;
        }
        this._syncControls();
        this.renderNow();
    }

    async _bootstrapPresets() {
        if (!this.presets) return;
        const c = this.config.presets;
        if (c.seed !== false) {
            await this.presetStore.loadSeed({
                basePath: c.basePath || 'presets',
                transform: c.transform
            });
        }

        // 1) Full share payload in the hash (#p=...)
        if (this.share) {
            const payload = this.share.parsePayloadFromHash(location.hash);
            if (payload) {
                const decoded = await this.share.decode(payload);
                if (decoded) {
                    this.presets.openShared(decoded.full);
                    this._refreshChrome();
                    return;
                }
            }
            // 2) Short slug (?preset=...)
            const slug = this.share.parseShortSlugFromLocation(location);
            if (slug) {
                const match = this.presetStore.getNames().find(n => ShareCodec.slugify(n) === slug);
                if (match) { this.presets.switchTo(match); this._refreshChrome(); return; }
            }
        }

        // 3) Default / first preset, or a clean New slot when the library is empty.
        const names = this.presetStore.getNames({ pinnedPrefix: c.pinnedPrefix });
        const initial = c.defaultName && this.presetStore.has(c.defaultName)
            ? c.defaultName
            : names[0];
        if (initial) this.presets.switchTo(initial);
        else this.presets.openNew(this.settingsStore.getDefaults());
        this._refreshChrome();
    }

    /* ================================================================== */
    /*  Export                                                            */
    /* ================================================================== */

    async exportSVG(filename) {
        if (!this.exporter) return;
        const name = filename || this.config.export?.filename || 'export.svg';
        if (this.target.type === 'svg') {
            const outlines = document.getElementById('convertToOutlinesCheckbox')?.checked
                ?? this.config.export?.outlineFonts ?? false;
            await this.exporter.exportToFile(this.target.element, name, {
                removeInteractive: true,
                convertTextToOutlines: outlines
            });
        } else {
            // Canvas tools provide an SVG string via config.renderSVG(ctx) if needed.
            const svgString = typeof this.config.renderSVG === 'function'
                ? this.config.renderSVG(this._renderContext())
                : await this.target.toSVGString();
            if (!svgString) { console.warn('exportSVG: no SVG available for canvas target.'); return; }
            this._downloadText(svgString, name, 'image/svg+xml');
        }
    }

    async exportPNG(filename, scale = 2) {
        const name = filename || (this.config.export?.filename || 'export').replace(/\.svg$/, '') + '.png';
        const { width, height } = this._logicalSize();
        if (this.target.type === 'canvas') {
            // Re-render at logical size into an offscreen canvas for crisp output.
            const off = document.createElement('canvas');
            off.width = width * scale;
            off.height = height * scale;
            const octx = off.getContext('2d');
            octx.setTransform(scale, 0, 0, scale, 0, 0);
            if (typeof this.config.renderTo === 'function') {
                this.config.renderTo({ ...this._renderContext(), ctx2d: octx });
            } else {
                octx.drawImage(this.target.element, 0, 0, width, height);
            }
            off.toBlob((blob) => this._downloadBlob(blob, name));
        } else {
            const svgString = await this.target.toSVGString();
            await this._rasterizeSVG(svgString, width * scale, height * scale, name);
        }
    }

    /* ================================================================== */
    /*  Chrome (preset label, zoom indicator, control sync)               */
    /* ================================================================== */

    _resolveCanvasContainer() {
        return this.dom?.canvas
            || document.getElementById(this.config.dom?.canvas || 'canvasContainer');
    }

    _bindZoomIndicator() {
        const indicator = this.dom?.zoomIndicator
            || document.getElementById(this.config.dom?.zoomIndicator || 'zoomIndicator');
        if (!indicator) return;
        this.target.onZoomChange((pct) => { indicator.textContent = `${pct}%`; });
        indicator.addEventListener('click', () => this.target.fitToScreen());
        indicator.textContent = `${this.target.getZoomPercent()}%`;
    }

    /** Re-sync every control to current settings (after preset/undo). */
    _syncControls() {
        const store = this.settingsStore;
        (this.config.controls?.sliders || []).forEach((def) => {
            if (def.setting != null) this.sliders?.setValue(def.id, store.get(def.setting), false);
        });
        (this.config.controls?.ranges || []).forEach((def) => {
            const lo = store.get(def.minSetting);
            const hi = store.get(def.maxSetting);
            if (lo != null && hi != null) this.ranges?.setValues(def.containerId, lo, hi, false);
        });
        // Checkboxes (bound silently — fromJSON(silent) does not notify subscribers).
        const sel = this.config.controls?.toggleSelector
            || '.toggle-chip input[type="checkbox"], input[type="checkbox"][data-setting]';
        document.querySelectorAll(sel).forEach((checkbox) => {
            const key = checkbox.dataset.setting;
            if (key && typeof store.get(key) === 'boolean') checkbox.checked = store.get(key);
        });
        // Color pickers.
        this.colorPickers.forEach(({ def, picker }) => {
            const hex = store.get(def.setting);
            if (hex && picker.setColor) picker.setColor(hex);
        });
        this.unifiedColorPicker?.sync();
        this.dice?.sync();
        if (typeof this.config.syncControls === 'function') this.config.syncControls(this);
    }

    /** Update preset label / dirty indicator / dropdown. */
    _refreshChrome() {
        if (typeof this.config.onChromeRefresh === 'function') {
            this.config.onChromeRefresh(this);
        }
        this._renderPresetDropdown();
    }

    /** Wire the preset dropdown toggle, Save and Share buttons (once). */
    _initPresetChrome() {
        if (!this.presets || this._presetChromeBound) return;
        this._presetChromeBound = true;
        const dropdown = document.getElementById(this.config.dom?.presetDropdown || 'presetDropdown');
        const toggle = document.getElementById(this.config.dom?.presetToggle || 'presetDropdownToggle');
        const menu = document.getElementById(this.config.dom?.presetMenu || 'presetDropdownMenu');
        if (toggle && menu) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = menu.classList.toggle('active');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            document.addEventListener('click', (e) => {
                if (dropdown && !dropdown.contains(e.target)) {
                    menu.classList.remove('active');
                    toggle.setAttribute('aria-expanded', 'false');
                }
            });
        }
        const saveBtn = document.getElementById(this.config.dom?.saveBtn || 'savePresetBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => { void this.savePreset(); });
        const shareBtn = document.getElementById(this.config.dom?.shareBtn || 'presetToolbarShareBtn');
        if (shareBtn) shareBtn.addEventListener('click', () => { void this._handleShareClick(shareBtn); });
    }

    async _handleShareClick(btn) {
        const url = await this.copyShareLink();
        if (url && btn) {
            const prev = btn.getAttribute('title');
            btn.setAttribute('title', 'Link copied!');
            setTimeout(() => btn.setAttribute('title', prev || 'Copy share link'), 1500);
        }
    }

    _renderPresetDropdown() {
        if (!this.presets) return;
        const toggle = document.getElementById(this.config.dom?.presetToggle || 'presetDropdownToggle');
        const menu = document.getElementById(this.config.dom?.presetMenu || 'presetDropdownMenu');
        const saveBtn = document.getElementById(this.config.dom?.saveBtn || 'savePresetBtn');
        if (toggle) {
            const labelEl = toggle.querySelector('.preset-dropdown-text')
                || toggle.querySelector('[data-preset-label]');
            if (labelEl) labelEl.textContent = this._presetToggleLabel();
        }
        if (saveBtn) {
            saveBtn.style.display = (this.presets.isDirty || this.presets.isShared) ? '' : 'none';
        }
        if (!menu) return;

        const cfg = this.config.presets;
        const onNew = this.presets.isNew;
        const dirty = this.presets.isDirty;
        menu.innerHTML = '';

        // "+ New" — clean defaults baseline.
        menu.appendChild(this._buildPresetItem(menu, {
            value: '__new__', label: '+ New', selected: onNew && !dirty
        }));

        // "Unsaved*" — current edited state while still on New.
        if (onNew && dirty) {
            const blob = this.getPresetBlob();
            menu.appendChild(this._buildPresetItem(menu, {
                value: '__unsaved__', label: 'Unsaved*', selected: true,
                colors: this._presetColorDots(blob), hasRandom: this._presetHasRandom(blob),
                share: !!this.share
            }));
        }

        // Saved presets.
        const names = this.presetStore.getNames({ pinnedPrefix: cfg.pinnedPrefix });
        names.forEach((name) => {
            const blob = this.presetStore.load(name);
            menu.appendChild(this._buildPresetItem(menu, {
                value: name, label: name, selected: name === this.presets.currentName,
                colors: this._presetColorDots(blob), hasRandom: this._presetHasRandom(blob),
                actions: true, share: !!this.share
            }));
        });

        // Utility rows.
        const restore = document.createElement('li');
        restore.className = 'preset-dropdown-item preset-dropdown-item-utility';
        restore.dataset.value = '__restore_defaults__';
        restore.setAttribute('role', 'option');
        restore.textContent = '\u21bb restore default presets';
        restore.addEventListener('click', () => { menu.classList.remove('active'); this._handlePresetMenuAction('__restore_defaults__'); });
        menu.appendChild(restore);

        if (names.length) {
            const del = document.createElement('li');
            del.className = 'preset-dropdown-item preset-dropdown-item-danger';
            del.dataset.value = '__delete_all__';
            del.setAttribute('role', 'option');
            del.textContent = '\u00d7 delete all';
            del.addEventListener('click', () => { menu.classList.remove('active'); this._handlePresetMenuAction('__delete_all__'); });
            menu.appendChild(del);
        }
    }

    /** Toggle button caption reflecting current preset + dirty state. */
    _presetToggleLabel() {
        const p = this.presets;
        if (p.isShared) return p.isDirty ? 'Unsaved*' : 'Shared preset';
        if (p.isNew) return p.isDirty ? 'Unsaved*' : 'New';
        const base = p.currentName || 'Presets';
        return p.isDirty ? `${base} *` : base;
    }

    /** Build one <li> dropdown row (preset, New or Unsaved). */
    _buildPresetItem(menu, { value, label, selected, colors = [], hasRandom = false, actions = false, share = false }) {
        const item = document.createElement('li');
        item.className = 'preset-dropdown-item';
        item.dataset.value = value;
        item.setAttribute('role', 'option');
        if (selected) item.classList.add('selected');

        const nameEl = document.createElement('span');
        nameEl.className = 'preset-dropdown-item-name';
        nameEl.textContent = label;
        nameEl.title = label;
        item.appendChild(nameEl);

        const trailing = document.createElement('span');
        trailing.className = 'preset-dropdown-item-trailing';

        if (actions) {
            const group = document.createElement('span');
            group.className = 'preset-dropdown-item-actions';
            group.appendChild(this._buildPresetActionBtn('delete', value, PRESET_ICONS.delete, 'Delete'));
            if (share) group.appendChild(this._buildPresetActionBtn('share', value, PRESET_ICONS.share, 'Copy share link'));
            group.appendChild(this._buildPresetActionBtn('rename', value, PRESET_ICONS.rename, 'Rename'));
            trailing.appendChild(group);
        } else if (share && value === '__unsaved__') {
            const group = document.createElement('span');
            group.className = 'preset-dropdown-item-actions';
            group.appendChild(this._buildPresetActionBtn('share', value, PRESET_ICONS.share, 'Copy share link'));
            trailing.appendChild(group);
        }

        if ((colors && colors.length) || hasRandom) {
            const ci = document.createElement('span');
            ci.className = 'preset-dropdown-item-colors';
            if (hasRandom) ci.appendChild(this._buildRandomDiamond());
            (colors || []).forEach((spec) => ci.appendChild(this._buildColorDot(spec)));
            trailing.appendChild(ci);
        }

        if (trailing.childNodes.length) item.appendChild(trailing);

        item.addEventListener('click', (e) => {
            if (e.target.closest('.preset-dropdown-item-action')) return;
            menu.classList.remove('active');
            this._handlePresetMenuAction(value);
        });
        return item;
    }

    _buildPresetActionBtn(action, presetName, svg, title) {
        const btn = document.createElement('span');
        btn.className = 'preset-dropdown-item-action';
        btn.dataset.action = action;
        btn.dataset.preset = presetName;
        btn.title = title;
        btn.setAttribute('role', 'button');
        btn.innerHTML = svg;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._handlePresetItemAction(action, presetName);
        });
        return btn;
    }

    _buildColorDot(spec) {
        const dot = document.createElement('span');
        dot.className = 'preset-dropdown-color-dot';
        if (!spec) return dot;
        if (spec.kind === 'gradient' && spec.value) {
            dot.classList.add('preset-dropdown-color-dot--gradient');
            dot.style.background = `linear-gradient(135deg, ${spec.value.start}, ${spec.value.end})`;
        } else if (spec.kind === 'random') {
            dot.classList.add('preset-dropdown-color-dot--random');
        } else {
            dot.style.background = (spec && spec.value) || '#000000';
        }
        return dot;
    }

    _buildRandomDiamond() {
        const wrap = document.createElement('span');
        wrap.className = 'preset-dropdown-item-random';
        wrap.title = 'Contains random parameters';
        wrap.innerHTML = '<svg class="preset-dropdown-random-shape" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10" focusable="false"><path fill="currentColor" d="M5 0L10 5 5 10 0 5z"/></svg>';
        return wrap;
    }

    _presetColorDots(blob) {
        const fn = this.config.presets?.colorDots;
        if (typeof fn !== 'function' || !blob) return [];
        try { return fn(blob, this) || []; } catch (_) { return []; }
    }

    _presetHasRandom(blob) {
        const fn = this.config.presets?.hasRandom;
        if (typeof fn !== 'function' || !blob) return false;
        try { return !!fn(blob, this); } catch (_) { return false; }
    }

    /* ------------------------------ menu actions ------------------------------ */

    async _handlePresetMenuAction(value) {
        if (value === '__unsaved__') return; // current state — nothing to do
        if (value === '__new__') return this._pickNew();
        if (value === '__restore_defaults__') {
            if (this.dialog) {
                const ok = await this.dialog.confirm({
                    title: 'Restore default presets?',
                    text: 'This deletes all your presets and restores the shipped library. This cannot be undone.',
                    confirmText: 'Restore', danger: true
                });
                if (!ok) return;
            }
            return this.restoreDefaultPresets();
        }
        if (value === '__delete_all__') return this._deleteAllPresets();
        return this._handlePresetPick(value);
    }

    async _handlePresetItemAction(action, name) {
        if (action === 'delete') return this._deletePreset(name);
        if (action === 'share') return this._sharePreset(name);
        if (action === 'rename') return this._renamePreset(name);
    }

    /** Confirm before leaving an edited preset. Returns true to proceed. */
    async _guardUnsaved() {
        if (!this.presets.isDirty || !this.dialog) return true;
        const name = this.presets.isEphemeral ? 'Unsaved' : (this.presets.currentName || '');
        const result = await this.dialog.show({
            title: 'Unsaved changes',
            text: `You have unsaved changes${name ? ` in "${name}"` : ''}.`,
            buttons: [
                { id: 'save', text: 'Save', type: 'primary' },
                { id: 'discard', text: 'Discard', type: 'secondary' },
                { id: 'cancel', text: 'Cancel', type: 'ghost' }
            ]
        });
        if (result.action === 'cancel') return false;
        if (result.action === 'save') {
            if (this.presets.isEphemeral) return await this.savePreset();
            this.presets.saveCurrent();
        }
        return true;
    }

    async _pickNew() {
        if (this.presets.isNew && !this.presets.isDirty) return;
        if (!(await this._guardUnsaved())) return;
        this.presets.openNew(this.settingsStore.getDefaults());
        this._refreshChrome();
    }

    async _handlePresetPick(name) {
        if (name === this.presets.currentName) return;
        if (!(await this._guardUnsaved())) return;
        this.presets.switchTo(name);
        this._refreshChrome();
    }

    async _deletePreset(name) {
        if (this.dialog) {
            const ok = await this.dialog.confirm({
                title: 'Delete preset?', text: `Delete "${name}"? This cannot be undone.`,
                confirmText: 'Delete', danger: true
            });
            if (!ok) return;
        }
        const wasCurrent = name === this.presets.currentName;
        this.presets.delete(name);
        if (wasCurrent) this.presets.openNew(this.settingsStore.getDefaults());
        this._refreshChrome();
    }

    async _deleteAllPresets() {
        if (this.dialog) {
            const ok = await this.dialog.confirm({
                title: 'Delete all presets?', text: 'This removes every saved preset. This cannot be undone.',
                confirmText: 'Delete all', danger: true
            });
            if (!ok) return;
        }
        this.presets.deleteAll();
        this.presets.openNew(this.settingsStore.getDefaults());
        this._refreshChrome();
    }

    async _renamePreset(name) {
        if (!this.dialog) return;
        const newName = await this.dialog.prompt({
            title: 'Rename preset', value: name, placeholder: 'Preset name', confirmText: 'Rename'
        });
        if (!newName || newName === name) return;
        const res = this.presets.rename(newName, name);
        if (!res.ok) {
            if (res.reason === 'exists') {
                await this.dialog.alert({ title: 'Name taken', text: `A preset named "${newName}" already exists.` });
            }
            return;
        }
        this._refreshChrome();
    }

    async _sharePreset(name) {
        if (!this.share) return;
        const useCurrent = name === '__unsaved__' || name === '__new__' || name === this.presets.currentName;
        const blob = useCurrent ? this.getPresetBlob() : this.presetStore.load(name);
        if (!blob) return;
        const prefix = this.share.buildShareUrlPrefix();
        const { encoded } = await this.share.encodeWithBudget(blob, { urlPrefix: prefix });
        const url = prefix + encoded;
        let copied = false;
        try { await navigator.clipboard.writeText(url); copied = true; } catch (_) { /* ignore */ }
        this._showToast(copied ? 'Link copied' : 'Could not copy link');
    }

    /** Wipe persisted presets and reseed the shipped library. */
    async restoreDefaultPresets() {
        const c = this.config.presets;
        this.presetStore.clearAll();
        this.presets.histories.clear();
        this.presets.currentName = null;
        this.presets._dirty = false;
        if (c.seed !== false) {
            await this.presetStore.loadSeed({ basePath: c.basePath || 'presets', force: true, transform: c.transform });
        }
        const names = this.presetStore.getNames({ pinnedPrefix: c.pinnedPrefix });
        const initial = c.defaultName && this.presetStore.has(c.defaultName) ? c.defaultName : names[0];
        if (initial) this.presets.switchTo(initial);
        else this.presets.openNew(this.settingsStore.getDefaults());
        this._refreshChrome();
    }

    /** Transient status toast (reuses the .void-share-toast styling). */
    _showToast(message) {
        let el = document.getElementById('presetShareToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'presetShareToast';
            el.className = 'void-share-toast';
            el.setAttribute('role', 'status');
            (document.querySelector('.top-links') || document.body).appendChild(el);
        }
        el.textContent = message;
        el.hidden = false;
        el.classList.add('void-share-toast--visible');
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            el.classList.remove('void-share-toast--visible');
            el.hidden = true;
        }, 2200);
    }

    /** Save the current preset (used by a Save button). Returns success. */
    async savePreset() {
        if (!this.presets) return false;
        if (this.presets.isEphemeral) {
            const wasShared = this.presets.isShared;
            const name = this.dialog
                ? await this.dialog.prompt({ title: 'Save preset', placeholder: 'Preset name', confirmText: 'Save' })
                : prompt('Preset name');
            if (!name) return false;
            let res = wasShared
                ? this.presets.saveSharedToLibrary(name, { overwrite: false })
                : this.presets.saveAs(name);
            if (!res.ok && res.reason === 'exists') {
                const replace = this.dialog
                    ? await this.dialog.confirm({ title: 'Replace preset?', text: `"${name}" already exists.`, confirmText: 'Replace', danger: true })
                    : confirm(`"${name}" already exists. Replace?`);
                if (!replace) return false;
                res = wasShared
                    ? this.presets.saveSharedToLibrary(name, { overwrite: true })
                    : this.presets.saveAs(name, { overwrite: true });
            }
            this._refreshChrome();
            return !!res.ok;
        }
        this.presets.saveCurrent();
        this._refreshChrome();
        return true;
    }

    /** Copy a share link for the current preset to the clipboard. */
    async copyShareLink() {
        if (!this.share) return null;
        const blob = this.getPresetBlob();
        const prefix = this.share.buildShareUrlPrefix();
        const { encoded } = await this.share.encodeWithBudget(blob, { urlPrefix: prefix });
        const url = prefix + encoded;
        try { await navigator.clipboard.writeText(url); } catch (_) { /* ignore */ }
        return url;
    }

    /* ------------------------------- internals -------------------------------- */

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    _downloadText(text, filename, mime) {
        this._downloadBlob(new Blob([text], { type: mime }), filename);
    }

    async _rasterizeSVG(svgString, w, h, filename) {
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => this._downloadBlob(b, filename));
    }

    destroy() {
        if (this._rafId != null) cancelAnimationFrame(this._rafId);
        this.shortcuts?.destroy();
        this.tooltips?.destroy();
        this.target?.destroy();
    }
}
