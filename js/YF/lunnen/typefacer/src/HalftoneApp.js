/**
 * HalftoneApp — Lunnen Display Lab (halftone + concentric и др.)
 * на основе вариативного шрифта Lunnen Display.
 *
 * Layout:
 *   LEFT  — General  (text, colors, format)
 *   RIGHT — Style    (generator mode, pattern params)
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
import { ImageSampler }         from './ImageSampler.js';
import { HalftoneRenderer }     from './HalftoneRenderer.js';
import { ConcentricRenderer }   from './ConcentricRenderer.js';

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

            // Halftone params (defaults from screenshot)
            text:             '1234567890',
            bgColor:          '#000000',
            textColor:        '#FFFFFF',
            resolution:       21,
            spacing:          1.0,
            sizeContrast:     100,
            weightContrast:   100,
            renderMode:       'standard',
            fontWeight:       200,
            rotation:         0,
            rotationContrast: 0,
            invertBrightness: false,

            // OpenType features
            otSalt: false,
            otAalt: false,
            otSs01: false,
            otSs02: false,
            otDlig: false,
            otTnum: false,

            // Concentric params (defaults from screenshot)
            concentricCount:         15,
            concentricFontSize:     32,
            concentricFontWeight:   250,
            concentricLetterSpacing: 2.0,
            concentricRndmStart:   100,
            concentricRndmSpacing: 0,
            concentricMinRadius:   40,
            concentricMaxRadius:   0,
            concentricStartAngle:  0,
            concentricCenterX:     50,
            concentricCenterY:     50,

            // Animation params
            animDuration:  10,
            animMaxSpeed:  3,

            ...overrides
        };

        this._animPlaying = false;
        this._animPaused  = false;

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
        this.imageSampler        = new ImageSampler();
        this.halftoneRenderer    = new HalftoneRenderer();
        this.concentricRenderer  = new ConcentricRenderer();
        this.brightnessMap       = null;

        this._updateDebounceTimer = null;
        this._rafId               = null;
    }

    /* ================================================================ */
    /*  Init                                                             */
    /* ================================================================ */

    async init() {
        this.domCache.init({
            svg:           'mainSvg',
            canvas:        'canvasContainer',
            zoomIndicator: 'zoomIndicator',
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
        this.initOTToggles();
        this.initColorPickers();
        this.initModeSelector();
        this.initImageUpload();
        this.initVideoFrameSlider();
        this.initInvertToggle();
        this.initButtons();
        this.initModals();
        this.initKeyboardShortcuts();

        await this.loadDefaultMedia();

        this.update();
        this.initZoom();

        this.state.isInitialized = true;
    }

    /* ================================================================ */
    /*  Sliders                                                          */
    /* ================================================================ */

    initSliders() {
        this.sliders = new SliderController(this.settingsStore);

        // ── Halftone sliders ──
        this.sliders.initSlider('resolutionSlider', {
            valueId: 'resolutionValue', setting: 'resolution',
            min: 5, max: 120, decimals: 0, baseStep: 1, shiftStep: 10,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('spacingSlider', {
            valueId: 'spacingValue', setting: 'spacing',
            min: 0.3, max: 3.0, decimals: 2, baseStep: 0.05, shiftStep: 0.25,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('sizeContrastSlider', {
            valueId: 'sizeContrastValue', setting: 'sizeContrast',
            min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('weightContrastSlider', {
            valueId: 'weightContrastValue', setting: 'weightContrast',
            min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('fontWeightSlider', {
            valueId: 'fontWeightValue', setting: 'fontWeight',
            min: 100, max: 400, decimals: 0, baseStep: 1, shiftStep: 50,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('rotationSlider', {
            valueId: 'rotationValue', setting: 'rotation',
            min: 0, max: 180, decimals: 0, baseStep: 1, shiftStep: 15,
            onUpdate: () => this.debouncedUpdate()
        });

        this.sliders.initSlider('rotationContrastSlider', {
            valueId: 'rotationContrastValue', setting: 'rotationContrast',
            min: 0, max: 360, decimals: 0, baseStep: 1, shiftStep: 15,
            onUpdate: () => this.debouncedUpdate()
        });

        this.sliders.setValue('resolutionSlider',         this.settingsStore.get('resolution'), false);
        this.sliders.setValue('spacingSlider',             this.settingsStore.get('spacing'), false);
        this.sliders.setValue('sizeContrastSlider',        this.settingsStore.get('sizeContrast'), false);
        this.sliders.setValue('weightContrastSlider',      this.settingsStore.get('weightContrast'), false);
        this.sliders.setValue('fontWeightSlider',          this.settingsStore.get('fontWeight'), false);
        this.sliders.setValue('rotationSlider',            this.settingsStore.get('rotation'), false);
        this.sliders.setValue('rotationContrastSlider',    this.settingsStore.get('rotationContrast'), false);

        this._syncModeVisibility();

        // ── Concentric sliders ──
        this.sliders.initSlider('concentricCountSlider', {
            valueId: 'concentricCountValue', setting: 'concentricCount',
            min: 1, max: 100, decimals: 0, baseStep: 1, shiftStep: 5,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricFontSizeSlider', {
            valueId: 'concentricFontSizeValue', setting: 'concentricFontSize',
            min: 4, max: 200, decimals: 0, baseStep: 1, shiftStep: 10,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricFontWeightSlider', {
            valueId: 'concentricFontWeightValue', setting: 'concentricFontWeight',
            min: 100, max: 400, decimals: 0, baseStep: 1, shiftStep: 50,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricLetterSpacingSlider', {
            valueId: 'concentricLetterSpacingValue', setting: 'concentricLetterSpacing',
            min: 1.0, max: 10.0, decimals: 2, baseStep: 0.05, shiftStep: 0.5,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricRndmStartSlider', {
            valueId: 'concentricRndmStartValue', setting: 'concentricRndmStart',
            min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricRndmSpacingSlider', {
            valueId: 'concentricRndmSpacingValue', setting: 'concentricRndmSpacing',
            min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricMinRadiusSlider', {
            valueId: 'concentricMinRadiusValue', setting: 'concentricMinRadius',
            min: 0, max: 500, decimals: 0, baseStep: 1, shiftStep: 20,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricMaxRadiusSlider', {
            valueId: 'concentricMaxRadiusValue', setting: 'concentricMaxRadius',
            min: 0, max: 2000, decimals: 0, baseStep: 1, shiftStep: 50,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricStartAngleSlider', {
            valueId: 'concentricStartAngleValue', setting: 'concentricStartAngle',
            min: 0, max: 360, decimals: 0, baseStep: 1, shiftStep: 15,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricCenterXSlider', {
            valueId: 'concentricCenterXValue', setting: 'concentricCenterX',
            min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricCenterYSlider', {
            valueId: 'concentricCenterYValue', setting: 'concentricCenterY',
            min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10,
            onUpdate: () => this.debouncedUpdate()
        });
        this.sliders.initSlider('concentricRotationSlider', {
            valueId: 'concentricRotationValue', setting: 'rotation',
            min: 0, max: 180, decimals: 0, baseStep: 1, shiftStep: 15,
            onUpdate: () => this.debouncedUpdate()
        });

        this.sliders.initSlider('animDurationSlider', {
            valueId: 'animDurationValue', setting: 'animDuration',
            min: 2, max: 60, decimals: 0, baseStep: 1, shiftStep: 5,
            onUpdate: () => { if (this._animPlaying) this._restartAnimation(); }
        });
        this.sliders.initSlider('animMaxSpeedSlider', {
            valueId: 'animMaxSpeedValue', setting: 'animMaxSpeed',
            min: 1, max: 10, decimals: 0, baseStep: 1, shiftStep: 1,
            onUpdate: () => { if (this._animPlaying) this._restartAnimation(); }
        });

        this.sliders.setValue('concentricCountSlider',       this.settingsStore.get('concentricCount'), false);
        this.sliders.setValue('concentricFontSizeSlider',    this.settingsStore.get('concentricFontSize'), false);
        this.sliders.setValue('concentricFontWeightSlider',  this.settingsStore.get('concentricFontWeight'), false);
        this.sliders.setValue('concentricLetterSpacingSlider', this.settingsStore.get('concentricLetterSpacing'), false);
        this.sliders.setValue('concentricRndmStartSlider',   this.settingsStore.get('concentricRndmStart'), false);
        this.sliders.setValue('concentricRndmSpacingSlider',  this.settingsStore.get('concentricRndmSpacing'), false);
        this.sliders.setValue('concentricMinRadiusSlider',   this.settingsStore.get('concentricMinRadius'), false);
        this.sliders.setValue('concentricMaxRadiusSlider',   this.settingsStore.get('concentricMaxRadius'), false);
        this.sliders.setValue('concentricStartAngleSlider',  this.settingsStore.get('concentricStartAngle'), false);
        this.sliders.setValue('concentricCenterXSlider',     this.settingsStore.get('concentricCenterX'), false);
        this.sliders.setValue('concentricCenterYSlider',     this.settingsStore.get('concentricCenterY'), false);
        this.sliders.setValue('concentricRotationSlider',    this.settingsStore.get('rotation'), false);
        this.sliders.setValue('animDurationSlider',          this.settingsStore.get('animDuration'), false);
        this.sliders.setValue('animMaxSpeedSlider',          this.settingsStore.get('animMaxSpeed'), false);

        this._initAnimButton();
    }

    /* ================================================================ */
    /*  Panels                                                           */
    /* ================================================================ */

    initPanels() {
        this.panels = new PanelManager();
        this.panels.registerPanel('generalPanel', {
            headerId: 'generalPanelHeader', draggable: true, persistent: true
        });
        this.panels.registerPanel('stylePanel', {
            headerId: 'stylePanelHeader', draggable: true, persistent: true
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
        const halftoneEl   = document.getElementById('halftoneControls');
        const concentricEl = document.getElementById('concentricControls');
        if (halftoneEl)   halftoneEl.style.display   = mode === 'halftone'    ? 'block' : 'none';
        if (concentricEl) concentricEl.style.display = mode === 'concentric' ? 'block' : 'none';
        if (mode !== 'concentric') this._stopAnimation();
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
        const defaultText = '1234567890';
        const current = (this.settingsStore.get('text') || '').trim() || defaultText;
        this.settingsStore.set('text', current, true);
        input.value = current;
        input.addEventListener('input', () => {
            const val = input.value || defaultText;
            this.settingsStore.set('text', val);
            this.debouncedUpdate();
        });
    }

    initOTToggles() {
        const features = ['otSalt', 'otAalt', 'otSs01', 'otSs02', 'otDlig', 'otTnum'];
        for (const key of features) {
            const el = document.getElementById(key);
            if (!el) continue;
            el.checked = !!this.settingsStore.get(key);
            el.addEventListener('change', () => {
                this.settingsStore.set(key, el.checked);
                this.debouncedUpdate();
            });
        }
    }

    /* ================================================================ */
    /*  Concentric Animation                                              */
    /* ================================================================ */

    _initAnimButton() {
        const btn = document.getElementById('animPlayPauseBtn');
        if (!btn) return;
        btn.addEventListener('click', () => this._toggleAnimation());
    }

    _toggleAnimation() {
        if (!this._animPlaying) {
            this._startAnimation();
        } else if (this._animPaused) {
            this._resumeAnimation();
        } else {
            this._pauseAnimation();
        }
    }

    _startAnimation() {
        if (this.settings.generatorMode !== 'concentric') return;
        this.update();
        this.concentricRenderer.applyAnimation(this.dom.svg, this.settings);
        this._animPlaying = true;
        this._animPaused  = false;
        this._updateAnimButtonUI();
    }

    _pauseAnimation() {
        this.concentricRenderer.pauseAnimation(this.dom.svg);
        this._animPaused = true;
        this._updateAnimButtonUI();
    }

    _resumeAnimation() {
        this.concentricRenderer.resumeAnimation(this.dom.svg);
        this._animPaused = false;
        this._updateAnimButtonUI();
    }

    _stopAnimation() {
        if (!this._animPlaying) return;
        this.concentricRenderer.stopAnimation(this.dom.svg);
        this._animPlaying = false;
        this._animPaused  = false;
        this._updateAnimButtonUI();
    }

    _restartAnimation() {
        if (!this._animPlaying) return;
        this._stopAnimation();
        this._startAnimation();
    }

    _updateAnimButtonUI() {
        const btn = document.getElementById('animPlayPauseBtn');
        if (!btn) return;
        if (!this._animPlaying) {
            btn.textContent = '▶ Play';
        } else if (this._animPaused) {
            btn.textContent = '▶ Resume';
        } else {
            btn.textContent = '⏸ Pause';
        }
    }

    /* ================================================================ */
    /*  Color Pickers                                                    */
    /* ================================================================ */

    initColorPickers() {
        this.bgColorPicker = new ColorPicker(this.settingsStore, {
            settingKey: 'bgColor',
            defaultColor: '#000000',
            onChange: () => this.debouncedUpdate(),
            elementIds: {
                picker: 'bgHsbPicker', preview: 'bgColorPreview', hexInput: 'bgHexColorInput',
                hueSlider: 'bgHueSlider', saturationSlider: 'bgSaturationSlider', brightnessSlider: 'bgBrightnessSlider',
                hueValue: 'bgHueValue', saturationValue: 'bgSaturationValue', brightnessValue: 'bgBrightnessValue',
            }
        });
        this.bgColorPicker.init();

        this.textColorPicker = new ColorPicker(this.settingsStore, {
            settingKey: 'textColor',
            defaultColor: '#FFFFFF',
            onChange: () => this.debouncedUpdate(),
            elementIds: {
                picker: 'textHsbPicker', preview: 'textColorPreview', hexInput: 'textHexColorInput',
                hueSlider: 'textHueSlider', saturationSlider: 'textSaturationSlider', brightnessSlider: 'textBrightnessSlider',
                hueValue: 'textHueValue', saturationValue: 'textSaturationValue', brightnessValue: 'textBrightnessValue',
            }
        });
        this.textColorPicker.init();
    }

    /* ================================================================ */
    /*  Render mode selector (Standard / Uniform)                        */
    /* ================================================================ */

    initModeSelector() {
        const radios = document.querySelectorAll('input[name="renderMode"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.settingsStore.set('renderMode', radio.value);
                this._syncModeVisibility();
                this.update();
            });
        });
        const current = this.settings.renderMode;
        const active = document.querySelector(`input[name="renderMode"][value="${current}"]`);
        if (active) active.checked = true;
    }

    _syncModeVisibility() {
        const isUniform = this.settings.renderMode === 'uniform';
        const weightGroup         = document.getElementById('fontWeightGroup');
        const weightContrastGroup = document.getElementById('weightContrastGroup');
        if (weightGroup)         weightGroup.style.display         = isUniform ? 'none' : 'block';
        if (weightContrastGroup) weightContrastGroup.style.display = isUniform ? 'none' : 'block';
    }

    /* ================================================================ */
    /*  Media upload (image + video)                                     */
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
            e.preventDefault(); area.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this._handleMediaFile(file);
        });
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) this._handleMediaFile(file);
        });
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => { e.stopPropagation(); this._resetToDefaultImage(); });
        }
    }

    initVideoFrameSlider() {
        const slider  = document.getElementById('videoFrameSlider');
        const valueEl = document.getElementById('videoFrameValue');
        const playBtn = document.getElementById('videoPlayPauseBtn');

        if (slider) {
            slider.addEventListener('input', async () => {
                const pct     = parseFloat(slider.value) / 100;
                const timeSec = pct * this.imageSampler.videoDuration;
                if (valueEl) valueEl.value = timeSec.toFixed(1) + 's';
                await this.imageSampler.seekVideo(timeSec);
                this.invalidateBrightnessMap();
                this.update();
            });
        }

        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (this.imageSampler.isVideoPlaying()) {
                    this._stopPlayback();
                } else {
                    this._startPlayback();
                }
            });
        }
    }

    _startPlayback() {
        this.imageSampler.playVideo().catch(err => console.error('Video play error:', err));
        this._updatePlayPauseUI(true);
        this._rafId = requestAnimationFrame(() => this._playbackLoop());
    }

    _stopPlayback() {
        this.imageSampler.pauseVideo();
        this._updatePlayPauseUI(false);
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    _playbackLoop() {
        if (!this.imageSampler.isVideoPlaying()) {
            this._updatePlayPauseUI(false);
            this._rafId = null;
            return;
        }

        // Sync timeline slider
        const slider  = document.getElementById('videoFrameSlider');
        const valueEl = document.getElementById('videoFrameValue');
        const t   = this.imageSampler.getVideoCurrentTime();
        const dur = this.imageSampler.videoDuration;
        if (slider && dur > 0) slider.value = String((t / dur) * 100);
        if (valueEl) valueEl.value = t.toFixed(1) + 's';

        this.imageSampler.captureCurrentVideoFrame();
        if (this.settings.generatorMode === 'halftone') {
            this.invalidateBrightnessMap();
            this.update();
        }

        this._rafId = requestAnimationFrame(() => this._playbackLoop());
    }

    _updatePlayPauseUI(isPlaying) {
        const btn       = document.getElementById('videoPlayPauseBtn');
        const playIcon  = document.getElementById('videoPlayIcon');
        const pauseIcon = document.getElementById('videoPauseIcon');
        if (!btn) return;
        btn.classList.toggle('playing', isPlaying);
        if (playIcon)  playIcon.style.display  = isPlaying ? 'none'  : '';
        if (pauseIcon) pauseIcon.style.display = isPlaying ? ''      : 'none';
    }

    async _handleMediaFile(file) {
        this._stopPlayback();
        try {
            if (file.type.startsWith('video/')) {
                const { duration } = await this.imageSampler.loadFromVideo(file);
                this._showImageName(file.name);
                this._showVideoFrameSlider(true, duration);
                this._updatePlayPauseUI(false);
            } else {
                await this.imageSampler.loadFromFile(file);
                this._showImageName(file.name);
                this._showVideoFrameSlider(false);
            }
            this.invalidateBrightnessMap();
            this.update();
        } catch (err) { console.error('Media load error:', err); }
    }

    async _handleImageFile(file) {
        return this._handleMediaFile(file);
    }

    async _resetToDefaultImage() {
        this._stopPlayback();
        await this.loadDefaultMedia();
    }

    _showImageName(name) {
        const el = document.getElementById('imageFileName');
        if (el) el.textContent = name;
    }

    _showVideoFrameSlider(visible, duration = 0) {
        const group   = document.getElementById('videoFrameGroup');
        const slider  = document.getElementById('videoFrameSlider');
        const valueEl = document.getElementById('videoFrameValue');
        if (!group) return;
        group.style.display = visible ? 'block' : 'none';
        if (slider)  { slider.value = '0'; }
        if (valueEl) { valueEl.value = '0.0s'; }
        if (visible && slider && duration > 0) {
            slider.setAttribute('data-duration', duration);
        }
    }

    /** Дефолт: зацикленное видео + сразу воспроизведение и обновление халфтона. */
    async loadDefaultMedia() {
        const url  = 'media/9x16_02.mp4';
        const name = '9x16_02.mp4';
        try {
            const { duration } = await this.imageSampler.loadFromVideoURL(url);
            this._showImageName(name);
            this._showVideoFrameSlider(true, duration);
            this.invalidateBrightnessMap();
            this.update();
            this._startPlayback();
        } catch (err) {
            console.warn('Default video not found, falling back to image:', err);
            try {
                await this.imageSampler.loadFromURL('media/9x16_01.png');
                this._showImageName('9x16_01.png');
                this._showVideoFrameSlider(false);
                this.invalidateBrightnessMap();
                this.update();
            } catch (e) { console.warn('Default image not found:', e); }
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
        if (indicator) indicator.addEventListener('click', () => this.zoomPan.fitToScreen());
        this.zoomPan.fitToScreen();
    }

    /* ================================================================ */
    /*  History                                                          */
    /* ================================================================ */

    initHistory() { this.historyManager = new HistoryManager({ maxSize: 50 }); }

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
                if (panel) { panel.classList.toggle('panel-collapsed'); icon.classList.toggle('collapsed'); }
            });
        });
    }

    /* ================================================================ */
    /*  Buttons                                                          */
    /* ================================================================ */

    initButtons() {
        const bind = (id, handler) => { const el = document.getElementById(id); if (el) el.addEventListener('click', handler); };
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
                    ov.classList.remove('active'); ov.setAttribute('aria-hidden', 'true');
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
            if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
            else if (e.key === 'z' && e.shiftKey) { e.preventDefault(); this.redo(); }
            else if (e.key === 'e') { e.preventDefault(); void this.exportSVG(); }
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

            const mode = this.settings.generatorMode;

            if (mode === 'concentric') {
                this.concentricRenderer.render(svg, this.settings);
                if (this._animPlaying && !this._animPaused) {
                    this.concentricRenderer.applyAnimation(svg, this.settings);
                }
            } else {
                const w          = this.settings.artboardWidth;
                const h          = this.settings.artboardHeight;
                const resolution = this.settings.resolution;
                const spacing    = this.settings.spacing;
                const baseCellSize = w / resolution;
                const step = baseCellSize * spacing;
                const cols = Math.ceil(w / step);
                const rows = Math.ceil(h / step);

                if (!this.brightnessMap ||
                    this.brightnessMap.length !== rows ||
                    this.brightnessMap[0]?.length !== cols) {
                    this.brightnessMap = this.imageSampler.getBrightnessMap(cols, rows);
                }
                this.halftoneRenderer.render(svg, this.settings, this.brightnessMap);
            }

            if (this.zoomPan) {
                this.zoomPan.reinitializeSVGDimensions();
                this.zoomPan.centerContent();
            }
        } finally { this.state.isUpdating = false; }
    }

    debouncedUpdate() {
        clearTimeout(this._updateDebounceTimer);
        this._updateDebounceTimer = setTimeout(() => this.update(), 30);
    }

    invalidateBrightnessMap() { this.brightnessMap = null; }

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

    getStateSnapshot() { return this.settingsStore.toJSON(); }

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
        const mode = this.settings.generatorMode;
        const filename = `${mode}_${w}x${h}.svg`;
        await this.svgExporter.exportToFile(svg, filename, {
            removeInteractive: true,
            convertTextToOutlines: convertToOutlines
        });
    }

    exportSettings() {
        const data = this.settingsStore.getAll();
        this.svgExporter.exportJSON(data, 'lunnen-display-lab-settings.json');
    }

    importSettings() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            try {
                const data = await this.svgExporter.importJSON(file);
                this.settingsStore.setMultiple(data);
                this._syncUIFromSettings();
                this.invalidateBrightnessMap();
                this.update();
            } catch (err) { console.error('Import error:', err); }
        };
        input.click();
    }

    _syncUIFromSettings() {
        const s = this.settingsStore;

        this.sliders.setValue('resolutionSlider',      s.get('resolution'), false);
        this.sliders.setValue('spacingSlider',          s.get('spacing'), false);
        this.sliders.setValue('sizeContrastSlider',     s.get('sizeContrast'), false);
        this.sliders.setValue('weightContrastSlider',   s.get('weightContrast'), false);
        this.sliders.setValue('fontWeightSlider',       s.get('fontWeight'), false);
        this.sliders.setValue('rotationSlider',         s.get('rotation'), false);
        this.sliders.setValue('rotationContrastSlider', s.get('rotationContrast'), false);

        this.sliders.setValue('concentricCountSlider',       s.get('concentricCount'), false);
        this.sliders.setValue('concentricFontSizeSlider',    s.get('concentricFontSize'), false);
        this.sliders.setValue('concentricFontWeightSlider',  s.get('concentricFontWeight'), false);
        this.sliders.setValue('concentricLetterSpacingSlider', s.get('concentricLetterSpacing'), false);
        this.sliders.setValue('concentricRndmStartSlider',   s.get('concentricRndmStart'), false);
        this.sliders.setValue('concentricRndmSpacingSlider',  s.get('concentricRndmSpacing'), false);
        this.sliders.setValue('concentricMinRadiusSlider',   s.get('concentricMinRadius'), false);
        this.sliders.setValue('concentricMaxRadiusSlider',   s.get('concentricMaxRadius'), false);
        this.sliders.setValue('concentricStartAngleSlider',  s.get('concentricStartAngle'), false);
        this.sliders.setValue('concentricCenterXSlider',     s.get('concentricCenterX'), false);
        this.sliders.setValue('concentricCenterYSlider',     s.get('concentricCenterY'), false);
        this.sliders.setValue('concentricRotationSlider',    s.get('rotation'), false);
        this.sliders.setValue('animDurationSlider',          s.get('animDuration'), false);
        this.sliders.setValue('animMaxSpeedSlider',          s.get('animMaxSpeed'), false);

        const formatRadio = document.querySelector(`input[name="format"][value="${s.get('format')}"]`);
        if (formatRadio) formatRadio.checked = true;

        const modeRadio = document.querySelector(`input[name="renderMode"][value="${s.get('renderMode')}"]`);
        if (modeRadio) modeRadio.checked = true;

        const textInput = document.getElementById('patternTextInput');
        if (textInput) textInput.value = s.get('text');

        const otFeatures = ['otSalt', 'otAalt', 'otSs01', 'otSs02', 'otDlig', 'otTnum'];
        for (const key of otFeatures) {
            const el = document.getElementById(key);
            if (el) el.checked = !!s.get(key);
        }

        if (this.bgColorPicker)   this.bgColorPicker.setColorFromHex(s.get('bgColor'));
        if (this.textColorPicker) this.textColorPicker.setColorFromHex(s.get('textColor'));

        const genSelect = document.getElementById('generatorModeSelect');
        if (genSelect) genSelect.value = s.get('generatorMode');

        this._syncModeVisibility();
        this._syncCustomFormatVisibility();
        this._syncGeneratorVisibility();
    }
}

export { HalftoneApp };
