/**
 * HalftoneApp — генератор текстового halftone-паттерна
 * на основе вариативного шрифта Lunnen Display.
 *
 * Layout:
 *   LEFT  — General  (text, colors, format)
 *   RIGHT — Style    (generator mode, halftone controls)
 */

import { Settings }          from './core/Settings.js';
import { DOMCache }           from './core/DOMCache.js';
import { ZoomPanManager }     from './ui/ZoomPanManager.js';
import { SliderController }   from './ui/SliderController.js';
import { PanelManager }       from './ui/PanelManager.js';
import { ColorPicker }        from './ui/ColorPicker.js';
import { HistoryManager }     from './history/HistoryManager.js';
import { SVGExporter }        from './export/SVGExporter.js';
import { TextToPath }         from './utils/TextToPath.js';
import { ImageSampler }       from './ImageSampler.js';
import { HalftoneRenderer }   from './HalftoneRenderer.js';

const FORMATS = {
    '1080×1920': { width: 1080, height: 1920 },
    '1080×1080': { width: 1080, height: 1080 },
    '1080×1440': { width: 1080, height: 1440 },
    '1920×1080': { width: 1920, height: 1080 },
};

class HalftoneApp {

    constructor(overrides = {}) {
        const defaults = {
            artboardWidth:    1080,
            artboardHeight:   1920,
            format:           '1080×1920',
            generatorMode:    'halftone',

            text:             'A',
            bgColor:          '#000000',
            textColor:        '#FFFFFF',
            resolution:       30,
            spacing:          1.0,
            contrast:         70,
            renderMode:       'size',
            fontWeight:       200,
            invertBrightness: false,

            ...overrides
        };

        this.settingsStore = new Settings(defaults);
        this.settings = this.settingsStore.createProxy();

        this.domCache = new DOMCache();
        this.dom = null;

        this.state = { isInitialized: false, isUpdating: false };

        this.zoomPan        = null;
        this.sliders        = null;
        this.panels         = null;
        this.historyManager = null;
        this.svgExporter    = null;
        this.textToPath     = null;
        this.bgColorPicker  = null;
        this.textColorPicker = null;
        this.imageSampler   = new ImageSampler();
        this.renderer       = new HalftoneRenderer();
        this.brightnessMap  = null;

        this._updateDebounceTimer = null;
    }

    /* ================================================================ */
    /*  Init                                                             */
    /* ================================================================ */

    async init() {
        this.domCache.init({
            svg:                  'mainSvg',
            canvas:               'canvasContainer',
            zoomIndicator:        'zoomIndicator',
        });
        this.dom = this.domCache.createProxy();

        this.initSliders();
        this.initPanels();
        this.initHistory();
        this.initExporter();
        this.initCollapse();
        this.initGeneratorModeSelector();
        this.initFormatSelector();
        this.initCustomFormat();
        this.initTextInput();
        this.initColorPickers();
        this.initModeSelector();
        this.initImageUpload();
        this.initInvertToggle();
        this.initButtons();
        this.initModals();
        this.initKeyboardShortcuts();

        await this.loadDefaultImage();

        this.update();
        this.initZoom();

        this.state.isInitialized = true;
    }

    /* ================================================================ */
    /*  Sliders                                                          */
    /* ================================================================ */

    initSliders() {
        this.sliders = new SliderController(this.settingsStore);

        this.sliders.initSlider('resolutionSlider', {
            valueId:   'resolutionValue',
            setting:   'resolution',
            min:       5,
            max:       120,
            decimals:  0,
            baseStep:  1,
            shiftStep: 10,
            onUpdate:  () => this.debouncedUpdate()
        });

        this.sliders.initSlider('spacingSlider', {
            valueId:   'spacingValue',
            setting:   'spacing',
            min:       0.3,
            max:       3.0,
            decimals:  2,
            baseStep:  0.05,
            shiftStep: 0.25,
            onUpdate:  () => this.debouncedUpdate()
        });

        this.sliders.initSlider('contrastSlider', {
            valueId:   'contrastValue',
            setting:   'contrast',
            min:       0,
            max:       100,
            decimals:  0,
            baseStep:  1,
            shiftStep: 10,
            onUpdate:  () => this.debouncedUpdate()
        });

        this.sliders.initSlider('fontWeightSlider', {
            valueId:   'fontWeightValue',
            setting:   'fontWeight',
            min:       100,
            max:       400,
            decimals:  0,
            baseStep:  1,
            shiftStep: 50,
            onUpdate:  () => this.debouncedUpdate()
        });

        this.sliders.setValue('resolutionSlider',  this.settingsStore.get('resolution'), false);
        this.sliders.setValue('spacingSlider',      this.settingsStore.get('spacing'), false);
        this.sliders.setValue('contrastSlider',     this.settingsStore.get('contrast'), false);
        this.sliders.setValue('fontWeightSlider',   this.settingsStore.get('fontWeight'), false);

        this._syncWeightSliderVisibility();
    }

    /* ================================================================ */
    /*  Panels                                                           */
    /* ================================================================ */

    initPanels() {
        this.panels = new PanelManager();

        this.panels.registerPanel('generalPanel', {
            headerId:   'generalPanelHeader',
            draggable:  true,
            persistent: true
        });

        this.panels.registerPanel('stylePanel', {
            headerId:   'stylePanelHeader',
            draggable:  true,
            persistent: true
        });
    }

    /* ================================================================ */
    /*  Generator mode selector                                          */
    /* ================================================================ */

    initGeneratorModeSelector() {
        const select = document.getElementById('generatorModeSelect');
        if (!select) return;

        select.value = this.settings.generatorMode;

        select.addEventListener('change', () => {
            this.settingsStore.set('generatorMode', select.value);
            this._syncGeneratorVisibility();
            this.invalidateBrightnessMap();
            this.update();
        });

        this._syncGeneratorVisibility();
    }

    _syncGeneratorVisibility() {
        const mode = this.settings.generatorMode;
        const halftoneEl = document.getElementById('halftoneControls');
        if (halftoneEl) halftoneEl.style.display = mode === 'halftone' ? 'block' : 'none';
    }

    /* ================================================================ */
    /*  Format selector                                                  */
    /* ================================================================ */

    initFormatSelector() {
        const radios = document.querySelectorAll('input[name="format"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                const val = radio.value;
                this.settingsStore.set('format', val);
                if (FORMATS[val]) {
                    this.settingsStore.set('artboardWidth',  FORMATS[val].width,  true);
                    this.settingsStore.set('artboardHeight', FORMATS[val].height, true);
                }
                this._syncCustomFormatVisibility();
                this.invalidateBrightnessMap();
                this.update();
            });
        });

        const current = this.settings.format;
        const active = document.querySelector(`input[name="format"][value="${current}"]`);
        if (active) active.checked = true;
    }

    initCustomFormat() {
        const wInput = document.getElementById('customWidthInput');
        const hInput = document.getElementById('customHeightInput');
        if (!wInput || !hInput) return;

        const apply = () => {
            const w = parseInt(wInput.value) || 1080;
            const h = parseInt(hInput.value) || 1920;
            this.settingsStore.set('artboardWidth',  Math.max(100, Math.min(7680, w)), true);
            this.settingsStore.set('artboardHeight', Math.max(100, Math.min(7680, h)), true);
            this.invalidateBrightnessMap();
            this.update();
        };

        wInput.addEventListener('change', apply);
        hInput.addEventListener('change', apply);
        wInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.target.blur(); apply(); } });
        hInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.target.blur(); apply(); } });

        this._syncCustomFormatVisibility();
    }

    _syncCustomFormatVisibility() {
        const el = document.getElementById('customFormatGroup');
        if (!el) return;
        el.style.display = this.settings.format === 'custom' ? 'flex' : 'none';
    }

    /* ================================================================ */
    /*  Text input                                                       */
    /* ================================================================ */

    initTextInput() {
        const input = document.getElementById('patternTextInput');
        if (!input) return;
        input.value = this.settings.text;
        input.addEventListener('input', () => {
            const val = input.value || 'A';
            this.settingsStore.set('text', val);
            this.debouncedUpdate();
        });
    }

    /* ================================================================ */
    /*  Color Pickers (full HSB via framework ColorPicker)               */
    /* ================================================================ */

    initColorPickers() {
        this.bgColorPicker = new ColorPicker(this.settingsStore, {
            settingKey: 'bgColor',
            defaultColor: '#000000',
            onChange: () => this.debouncedUpdate(),
            elementIds: {
                picker:           'bgHsbPicker',
                preview:          'bgColorPreview',
                hexInput:         'bgHexColorInput',
                hueSlider:        'bgHueSlider',
                saturationSlider: 'bgSaturationSlider',
                brightnessSlider: 'bgBrightnessSlider',
                hueValue:         'bgHueValue',
                saturationValue:  'bgSaturationValue',
                brightnessValue:  'bgBrightnessValue',
            }
        });
        this.bgColorPicker.init();

        this.textColorPicker = new ColorPicker(this.settingsStore, {
            settingKey: 'textColor',
            defaultColor: '#FFFFFF',
            onChange: () => this.debouncedUpdate(),
            elementIds: {
                picker:           'textHsbPicker',
                preview:          'textColorPreview',
                hexInput:         'textHexColorInput',
                hueSlider:        'textHueSlider',
                saturationSlider: 'textSaturationSlider',
                brightnessSlider: 'textBrightnessSlider',
                hueValue:         'textHueValue',
                saturationValue:  'textSaturationValue',
                brightnessValue:  'textBrightnessValue',
            }
        });
        this.textColorPicker.init();
    }

    /* ================================================================ */
    /*  Render mode selector (Size / Weight / Both / Uniform)            */
    /* ================================================================ */

    initModeSelector() {
        const radios = document.querySelectorAll('input[name="renderMode"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.settingsStore.set('renderMode', radio.value);
                this._syncWeightSliderVisibility();
                this.update();
            });
        });

        const current = this.settings.renderMode;
        const active = document.querySelector(`input[name="renderMode"][value="${current}"]`);
        if (active) active.checked = true;
    }

    _syncWeightSliderVisibility() {
        const group = document.getElementById('fontWeightGroup');
        if (!group) return;
        const mode = this.settings.renderMode;
        group.style.display = (mode === 'size') ? 'block' : 'none';
    }

    /* ================================================================ */
    /*  Image upload                                                     */
    /* ================================================================ */

    initImageUpload() {
        const area      = document.getElementById('imageUploadArea');
        const fileInput = document.getElementById('imageFileInput');
        const removeBtn = document.getElementById('imageRemoveBtn');

        if (!area || !fileInput) return;

        area.addEventListener('click', (e) => {
            if (e.target.closest('.image-remove-btn')) return;
            fileInput.click();
        });

        area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
        area.addEventListener('dragleave', ()  => area.classList.remove('dragover'));
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) this._handleImageFile(file);
        });

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) this._handleImageFile(file);
        });

        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._resetToDefaultImage();
            });
        }
    }

    async _handleImageFile(file) {
        try {
            await this.imageSampler.loadFromFile(file);
            this._showImageName(file.name);
            this.invalidateBrightnessMap();
            this.update();
        } catch (err) {
            console.error('Image load error:', err);
        }
    }

    async _resetToDefaultImage() {
        await this.loadDefaultImage();
        this._showImageName('9x16_01.png');
        this.update();
    }

    _showImageName(name) {
        const el = document.getElementById('imageFileName');
        if (el) el.textContent = name;
    }

    async loadDefaultImage() {
        try {
            await this.imageSampler.loadFromURL('images/9x16_01.png');
            this._showImageName('9x16_01.png');
            this.invalidateBrightnessMap();
        } catch (err) {
            console.warn('Default image not found, using flat gray:', err);
        }
    }

    /* ================================================================ */
    /*  Invert toggle                                                    */
    /* ================================================================ */

    initInvertToggle() {
        const checkbox = document.getElementById('invertBrightnessToggle');
        if (!checkbox) return;
        checkbox.checked = this.settings.invertBrightness;
        checkbox.addEventListener('change', () => {
            this.settingsStore.set('invertBrightness', checkbox.checked);
            this.update();
        });
    }

    /* ================================================================ */
    /*  Zoom                                                             */
    /* ================================================================ */

    initZoom() {
        const svg    = this.dom.svg;
        const canvas = this.dom.canvas;

        this.zoomPan = new ZoomPanManager(canvas, svg, {
            fitPadding: { top: 20, right: 20, bottom: 20, left: 20 }
        });

        svg._zoomManaged = true;

        canvas.addEventListener('zoomchange', () => {
            const indicator = this.dom.zoomIndicator;
            if (indicator) indicator.textContent = `${this.zoomPan.getZoomPercent()}%`;
        });

        const indicator = this.dom.zoomIndicator;
        if (indicator) {
            indicator.addEventListener('click', () => this.zoomPan.fitToScreen());
        }

        this.zoomPan.fitToScreen();
    }

    /* ================================================================ */
    /*  History                                                          */
    /* ================================================================ */

    initHistory() {
        this.historyManager = new HistoryManager({ maxSize: 50 });
    }

    /* ================================================================ */
    /*  Exporter                                                         */
    /* ================================================================ */

    initExporter() {
        this.textToPath = new TextToPath({
            fontPaths: {
                'Lunnen Display-100': 'fonts/LunnenDisplay-VariableVF.ttf',
                'Lunnen Display-200': 'fonts/LunnenDisplay-VariableVF.ttf',
                'Lunnen Display-300': 'fonts/LunnenDisplay-VariableVF.ttf',
                'Lunnen Display-400': 'fonts/LunnenDisplay-VariableVF.ttf',
            }
        });
        this.svgExporter = new SVGExporter({ textToPath: this.textToPath });
    }

    /* ================================================================ */
    /*  Collapse                                                         */
    /* ================================================================ */

    initCollapse() {
        document.querySelectorAll('.collapse-icon').forEach(icon => {
            icon.addEventListener('click', () => {
                const panel = icon.closest('.controls-panel');
                if (panel) {
                    panel.classList.toggle('panel-collapsed');
                    icon.classList.toggle('collapsed');
                }
            });
        });
    }

    /* ================================================================ */
    /*  Buttons                                                          */
    /* ================================================================ */

    initButtons() {
        const bind = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        };

        bind('exportSvgBtn',      () => { void this.exportSVG(); });
        bind('exportSettingsBtn', () => this.exportSettings());
        bind('importSettingsBtn', () => this.importSettings());
    }

    /* ================================================================ */
    /*  Modals                                                           */
    /* ================================================================ */

    initModals() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(ov => {
                    ov.classList.remove('active');
                    ov.setAttribute('aria-hidden', 'true');
                });
            }
        });
    }

    /* ================================================================ */
    /*  Keyboard shortcuts                                               */
    /* ================================================================ */

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;

            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if (e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.redo();
            } else if (e.key === 'e') {
                e.preventDefault();
                void this.exportSVG();
            }
        });
    }

    /* ================================================================ */
    /*  Main render                                                      */
    /* ================================================================ */

    update() {
        if (this.state.isUpdating) return;
        this.state.isUpdating = true;

        try {
            const svg = this.dom?.svg;
            if (!svg) return;

            const w    = this.settings.artboardWidth;
            const h    = this.settings.artboardHeight;
            const cols = this.settings.resolution;
            const spacing = this.settings.spacing;
            const baseCellSize = w / cols;
            const step = baseCellSize * spacing;
            const rows = Math.ceil(h / step);

            if (!this.brightnessMap ||
                this.brightnessMap.length !== rows ||
                this.brightnessMap[0]?.length !== cols) {
                this.brightnessMap = this.imageSampler.getBrightnessMap(cols, rows);
            }

            this.renderer.render(svg, this.settings, this.brightnessMap);

            if (this.zoomPan) {
                this.zoomPan.reinitializeSVGDimensions();
                this.zoomPan.centerContent();
            }
        } finally {
            this.state.isUpdating = false;
        }
    }

    debouncedUpdate() {
        clearTimeout(this._updateDebounceTimer);
        this._updateDebounceTimer = setTimeout(() => this.update(), 30);
    }

    invalidateBrightnessMap() {
        this.brightnessMap = null;
    }

    /* ================================================================ */
    /*  History                                                          */
    /* ================================================================ */

    undo() {
        if (!this.historyManager?.canUndo()) return;
        const prev = this.historyManager.undo();
        if (prev) this.restoreState(prev);
    }

    redo() {
        if (!this.historyManager?.canRedo()) return;
        const next = this.historyManager.redo();
        if (next) this.restoreState(next);
    }

    getStateSnapshot() {
        return this.settingsStore.toJSON();
    }

    restoreState(snapshot) {
        this.settingsStore.fromJSON(snapshot);
        this.invalidateBrightnessMap();
        this._syncUIFromSettings();
        this.update();
    }

    /* ================================================================ */
    /*  Export                                                           */
    /* ================================================================ */

    async exportSVG() {
        const svg = this.dom?.svg;
        if (!svg) return;
        const convertToOutlines = document.getElementById('convertToOutlinesCheckbox')?.checked ?? false;
        const w = this.settings.artboardWidth;
        const h = this.settings.artboardHeight;
        const filename = `halftone_${w}x${h}.svg`;
        await this.svgExporter.exportToFile(svg, filename, {
            removeInteractive: true,
            convertTextToOutlines: convertToOutlines
        });
    }

    exportSettings() {
        const data = this.settingsStore.getAll();
        this.svgExporter.exportJSON(data, 'halftone-settings.json');
    }

    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            try {
                const data = await this.svgExporter.importJSON(file);
                this.settingsStore.setMultiple(data);
                this._syncUIFromSettings();
                this.invalidateBrightnessMap();
                this.update();
            } catch (err) {
                console.error('Import error:', err);
            }
        };
        input.click();
    }

    _syncUIFromSettings() {
        const s = this.settingsStore;

        this.sliders.setValue('resolutionSlider',  s.get('resolution'),  false);
        this.sliders.setValue('spacingSlider',      s.get('spacing'),     false);
        this.sliders.setValue('contrastSlider',     s.get('contrast'),    false);
        this.sliders.setValue('fontWeightSlider',   s.get('fontWeight'),  false);

        const formatRadio = document.querySelector(`input[name="format"][value="${s.get('format')}"]`);
        if (formatRadio) formatRadio.checked = true;

        const modeRadio = document.querySelector(`input[name="renderMode"][value="${s.get('renderMode')}"]`);
        if (modeRadio) modeRadio.checked = true;

        const textInput = document.getElementById('patternTextInput');
        if (textInput) textInput.value = s.get('text');

        if (this.bgColorPicker)   this.bgColorPicker.setColorFromHex(s.get('bgColor'));
        if (this.textColorPicker) this.textColorPicker.setColorFromHex(s.get('textColor'));

        const genSelect = document.getElementById('generatorModeSelect');
        if (genSelect) genSelect.value = s.get('generatorMode');

        this._syncWeightSliderVisibility();
        this._syncCustomFormatVisibility();
        this._syncGeneratorVisibility();
    }
}

export { HalftoneApp };
