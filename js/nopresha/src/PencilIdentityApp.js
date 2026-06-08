import { Settings } from './core/Settings.js';
import { DOMCache } from './core/DOMCache.js';
import { SliderController } from './ui/SliderController.js';
import { PanelManager } from './ui/PanelManager.js';
import { PresetManager } from './preset/PresetManager.js';
import { PencilRenderer } from './generator/PencilRenderer.js';
import { GifEncoder } from './export/GifEncoder.js';

const ANIMATION_DURATION_MS = 3000;
const GIF_FRAME_COUNT = 20;
const GIF_FRAME_DELAY_CS = 15;
const ANIMATION_PARAMETERS = [
    { flag: 'animateThickness', setting: 'pencilWidth', sliderId: 'pencilWidthSlider', min: 2, max: 34, amplitude: 10 },
    { flag: 'animateSoftness', setting: 'pencilSoftness', sliderId: 'pencilSoftnessSlider', min: 0, max: 100, amplitude: 10 },
    { flag: 'animatePigment', setting: 'intensity', sliderId: 'intensitySlider', min: 20, max: 100, amplitude: 10 },
    { flag: 'animateDensity', setting: 'strokeDensity', sliderId: 'strokeDensitySlider', min: 1, max: 100, amplitude: 10 },
    { flag: 'animateHatchDeviation', setting: 'hatchDeviation', sliderId: 'hatchDeviationSlider', min: 0, max: 100, amplitude: 10 },
    { flag: 'animatePalette', setting: 'colorCount', sliderId: 'colorCountSlider', min: 1, max: 8, lowOffset: -1, highOffset: 2, integer: true },
    { flag: 'animateSpread', setting: 'spread', sliderId: 'spreadSlider', min: 0, max: 100, amplitude: 10 },
    { flag: 'animateShapeCharacter', setting: 'shapeCharacter', sliderId: 'shapeCharacterSlider', min: 0, max: 100, amplitude: 10 }
];

export class PencilIdentityApp {
    constructor() {
        this.defaults = {
            width: 1200,
            height: 1200,
            seed: 'few-colors-01',
            pencilWidth: 14,
            pencilSoftness: 58,
            intensity: 86,
            colorCount: 6,
            spread: 64,
            shapeCharacter: 44,
            strokeDensity: 48,
            hatchDeviation: 18,
            paperGrain: 42,
            paletteMode: 'vivid',
            spotBlendMode: 'multiply',
            backgroundColor: '#ffffff',
            eyesColor: '#000000',
            legsColor: '#000000',
            showPaperGrain: false,
            showCharacter: true,
            animateThickness: false,
            animateSoftness: false,
            animatePigment: false,
            animateDensity: false,
            animateHatchDeviation: false,
            animatePalette: false,
            animateSpread: true,
            animateShapeCharacter: false,
            gifExport: false,
            transparentExport: false
        };

        this.settingsStore = new Settings(this.defaults);
        this.settings = this.settingsStore.createProxy();
        this.domCache = new DOMCache();
        this.dom = null;
        this.sliders = null;
        this.panels = null;
        this.presetManager = null;
        this.renderer = new PencilRenderer();
        this.pendingRender = false;
        this.lastRenderInfo = null;
        this.animationFrame = null;
        this.isPlayingAnimation = false;
        this.animationBaseValues = null;
        this.animationTracks = null;
        this.isPlayButtonHovered = false;
    }

    async init() {
        this.domCache.init({
            canvas: 'artCanvas',
            canvasContainer: 'canvasContainer',
            mainPanel: 'mainPanel',
            mainPanelHeader: 'mainPanelHeader',
            drawingPanel: 'drawingPanel',
            drawingPanelHeader: 'drawingPanelHeader',
            colorPanel: 'colorPanel',
            colorPanelHeader: 'colorPanelHeader',
            animationPanel: 'animationPanel',
            animationPanelHeader: 'animationPanelHeader',
            presetDropdown: 'presetDropdown',
            presetDropdownToggle: 'presetDropdownToggle',
            presetDropdownMenu: 'presetDropdownMenu'
        });

        this.dom = this.domCache.createProxy();

        this.initPanels();
        this.initSliders();
        this.initColorInputs();
        this.initToggles();
        this.initSegmentedControls();
        this.initSeed();
        this.initButtons();
        this.initCollapse();
        await this.initCharacterAsset();
        await this.initPresets();
        this.updateExportButtonLabel();
        this.scheduleRender();
    }

    initPanels() {
        this.panels = new PanelManager();
        this.panels.registerPanel('mainPanel', {
            headerId: 'mainPanelHeader',
            draggable: true,
            persistent: true
        });

        this.panels.registerPanel('drawingPanel', {
            headerId: 'drawingPanelHeader',
            draggable: true,
            persistent: true
        });

        this.panels.registerPanel('colorPanel', {
            headerId: 'colorPanelHeader',
            draggable: true,
            persistent: true
        });

        this.panels.registerPanel('animationPanel', {
            headerId: 'animationPanelHeader',
            draggable: true,
            persistent: true
        });
    }

    initSliders() {
        this.sliders = new SliderController(this.settingsStore);

        [
            ['widthSlider', 'widthValue', 'width', 512, 2400, 0, 16, 160],
            ['heightSlider', 'heightValue', 'height', 512, 2400, 0, 16, 160],
            ['pencilWidthSlider', 'pencilWidthValue', 'pencilWidth', 2, 34, 0, 1, 4],
            ['pencilSoftnessSlider', 'pencilSoftnessValue', 'pencilSoftness', 0, 100, 0, 1, 10],
            ['intensitySlider', 'intensityValue', 'intensity', 20, 100, 0, 1, 10],
            ['colorCountSlider', 'colorCountValue', 'colorCount', 1, 8, 0, 1, 1],
            ['spreadSlider', 'spreadValue', 'spread', 0, 100, 0, 1, 10],
            ['shapeCharacterSlider', 'shapeCharacterValue', 'shapeCharacter', 0, 100, 0, 1, 10],
            ['strokeDensitySlider', 'strokeDensityValue', 'strokeDensity', 1, 100, 0, 1, 10],
            ['hatchDeviationSlider', 'hatchDeviationValue', 'hatchDeviation', 0, 100, 0, 1, 10]
        ].forEach(([sliderId, valueId, setting, min, max, decimals, baseStep, shiftStep]) => {
            this.sliders.initSlider(sliderId, {
                valueId,
                setting,
                min,
                max,
                decimals,
                baseStep,
                shiftStep,
                onUpdate: () => this.scheduleRender()
            });
            this.sliders.setValue(sliderId, this.settingsStore.get(setting), false);
        });
    }

    initToggles() {
        document.querySelectorAll('input[type="checkbox"][data-setting]').forEach((checkbox) => {
            const key = checkbox.dataset.setting;
            checkbox.checked = Boolean(this.settingsStore.get(key));
            checkbox.addEventListener('change', () => {
                this.settingsStore.set(key, checkbox.checked);
                if (key === 'gifExport') {
                    this.updateExportButtonLabel();
                }
                if (!['transparentExport', 'gifExport'].includes(key) && !key.startsWith('animate')) {
                    this.scheduleRender();
                }
            });
        });
    }

    initColorInputs() {
        document.querySelectorAll('input[type="color"][data-color-setting]').forEach((input) => {
            const key = input.dataset.colorSetting;
            input.value = this.normalizeHexColor(this.settingsStore.get(key));
            input.addEventListener('input', () => {
                this.settingsStore.set(key, this.normalizeHexColor(input.value));
                this.scheduleRender();
            });
        });
    }

    initSegmentedControls() {
        [
            ['paletteMode', 'paletteMode'],
            ['spotBlendMode', 'spotBlendMode']
        ].forEach(([name, setting]) => {
            document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
                radio.checked = radio.value === this.settingsStore.get(setting);
                radio.addEventListener('change', () => {
                    if (!radio.checked) return;
                    this.settingsStore.set(setting, radio.value);
                    this.scheduleRender();
                });
            });
        });
    }

    initSeed() {
        const input = document.getElementById('seedInput');
        const applySeed = () => {
            const nextSeed = input.value.trim() || this.makeSeed();
            input.value = nextSeed;
            this.settingsStore.set('seed', nextSeed);
            this.scheduleRender();
        };

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                input.blur();
                applySeed();
            }
            if (event.key === 'Escape') {
                input.value = this.settings.seed;
                input.blur();
            }
        });
        input.addEventListener('blur', applySeed);
    }

    initButtons() {
        const bind = (id, handler) => {
            const element = document.getElementById(id);
            if (element) element.addEventListener('click', handler);
        };

        bind('rerollSeedBtn', () => this.regenerate());
        bind('playAnimationBtn', () => this.playAnimation());
        bind('exportPngBtn', () => this.exportArtwork());
        bind('resetBtn', () => this.reset());
        bind('exportSettingsBtn', () => this.exportSettings());
        bind('importSettingsBtn', () => document.getElementById('settingsFileInput')?.click());

        const fileInput = document.getElementById('settingsFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (event) => this.importSettings(event));
        }

        const playButton = document.getElementById('playAnimationBtn');
        if (playButton) {
            playButton.addEventListener('mouseenter', () => {
                this.isPlayButtonHovered = true;
                this.updatePlayButtonLabel();
            });
            playButton.addEventListener('mouseleave', () => {
                this.isPlayButtonHovered = false;
                this.updatePlayButtonLabel();
            });
        }
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

    async initCharacterAsset() {
        try {
            const svgText = await this.loadText('assets/character.svg');
            this.renderer.setCharacterSvg(svgText);
        } catch (error) {
            console.warn('Character asset failed to load:', error);
        }
    }

    async initPresets() {
        this.presetManager = new PresetManager({
            dropdown: this.dom.presetDropdown,
            dropdownToggle: this.dom.presetDropdownToggle,
            dropdownMenu: this.dom.presetDropdownMenu,
            onPresetLoad: (data) => {
                this.settingsStore.fromJSON(data);
                this.syncControls();
                this.scheduleRender();
            }
        });
        await this.presetManager.init();
    }

    scheduleRender() {
        if (this.pendingRender) return;
        this.pendingRender = true;
        window.setTimeout(() => {
            this.pendingRender = false;
            this.render();
        }, 0);
    }

    render() {
        const canvas = this.dom?.canvas;
        if (!canvas) return;
        this.lastRenderInfo = this.renderer.render(canvas, this.settingsStore.getAll());
        canvas.dataset.renderDurationMs = String(this.lastRenderInfo.durationMs);
        canvas.dataset.seed = this.lastRenderInfo.seed;
        canvas.dataset.coloredSamples = String(this.lastRenderInfo.coloredSamples);
        canvas.dataset.spotCount = String(this.lastRenderInfo.spotCount);
    }

    playAnimation() {
        if (this.isPlayingAnimation) {
            this.stopAnimation();
            return;
        }
        if (!this.hasEnabledAnimationParameters()) return;

        const startedAt = performance.now();
        this.animationBaseValues = this.getAnimationBaseValues();
        this.animationTracks = this.createAnimationTracks(this.animationBaseValues, this.settingsStore.getAll());

        this.isPlayingAnimation = true;
        this.updatePlayButtonLabel();
        this.applyAnimatedValues(this.animationTracks, 0);

        const tick = (now) => {
            const progress = ((now - startedAt) % ANIMATION_DURATION_MS) / ANIMATION_DURATION_MS;
            this.applyAnimatedValues(this.animationTracks, progress);
            this.animationFrame = requestAnimationFrame(tick);
        };

        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.animationFrame = requestAnimationFrame(tick);
    }

    stopAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.animationBaseValues) {
            this.restoreAnimationBaseValues(this.animationBaseValues);
        }

        this.animationFrame = null;
        this.isPlayingAnimation = false;
        this.animationBaseValues = null;
        this.animationTracks = null;
        this.updatePlayButtonLabel();
    }

    restoreAnimationBaseValues(baseValues) {
        ANIMATION_PARAMETERS.forEach((parameter) => {
            this.setAnimatedSlider(parameter.sliderId, baseValues[parameter.setting]);
        });
        this.scheduleRender();
    }

    applyAnimatedValues(tracks, progress) {
        if (!tracks) return;
        ANIMATION_PARAMETERS.forEach((parameter) => {
            if (!this.settingsStore.get(parameter.flag)) return;
            const track = tracks[parameter.setting];
            if (!track) return;
            this.setAnimatedSlider(parameter.sliderId, this.getAnimatedTrackValue(parameter, track, progress));
        });
        this.scheduleRender();
    }

    setAnimatedSlider(sliderId, value) {
        this.sliders?.setValue(sliderId, value, false);
    }

    getAnimatedTrackValue(parameter, track, progress) {
        if (progress < 1 / 3) {
            return this.formatAnimatedValue(parameter, lerp(track.start, track.firstTarget, smoothstep(progress * 3)));
        }
        if (progress < 2 / 3) {
            return this.formatAnimatedValue(parameter, lerp(track.firstTarget, track.secondTarget, smoothstep((progress - 1 / 3) * 3)));
        }
        return this.formatAnimatedValue(parameter, lerp(track.secondTarget, track.start, smoothstep((progress - 2 / 3) * 3)));
    }

    createAnimationTracks(baseValues, settings) {
        return ANIMATION_PARAMETERS.reduce((tracks, parameter) => {
            if (!settings[parameter.flag]) return tracks;

            const range = this.getAnimationRange(parameter, baseValues[parameter.setting]);
            const direction = Math.random() < 0.5 ? -1 : 1;
            const start = this.getRandomAnimationStart(parameter, range);
            tracks[parameter.setting] = {
                start,
                firstTarget: direction > 0 ? range.high : range.low,
                secondTarget: direction > 0 ? range.low : range.high
            };
            return tracks;
        }, {});
    }

    getAnimationRange(parameter, baseValue) {
        const base = Number(baseValue) || 0;
        const low = parameter.lowOffset !== undefined
            ? base + parameter.lowOffset
            : base - parameter.amplitude;
        const high = parameter.highOffset !== undefined
            ? base + parameter.highOffset
            : base + parameter.amplitude;

        return {
            low: this.formatAnimatedValue(parameter, low),
            high: this.formatAnimatedValue(parameter, high)
        };
    }

    getRandomAnimationStart(parameter, range) {
        if (parameter.integer) {
            const min = Math.ceil(range.low);
            const max = Math.floor(range.high);
            const innerMin = max - min >= 2 ? min + 1 : min;
            const innerMax = max - min >= 2 ? max - 1 : max;
            return randomInteger(innerMin, innerMax);
        }
        const value = lerp(range.low, range.high, Math.random());
        return this.formatAnimatedValue(parameter, value);
    }

    formatAnimatedValue(parameter, value) {
        const clamped = clamp(value, parameter.min, parameter.max);
        return parameter.integer ? Math.round(clamped) : clamped;
    }

    hasEnabledAnimationParameters() {
        return ANIMATION_PARAMETERS.some((parameter) => this.settingsStore.get(parameter.flag));
    }

    getAnimationBaseValues(settings = this.settingsStore.getAll()) {
        return ANIMATION_PARAMETERS.reduce((values, parameter) => {
            values[parameter.setting] = settings[parameter.setting];
            return values;
        }, {});
    }

    regenerate() {
        const seed = this.makeSeed();
        this.settingsStore.set('seed', seed);
        const input = document.getElementById('seedInput');
        if (input) input.value = seed;
        this.scheduleRender();
    }

    reset() {
        this.settingsStore.reset();
        this.syncControls();
        this.scheduleRender();
    }

    syncControls() {
        const sliderIds = {
            width: 'widthSlider',
            height: 'heightSlider',
            pencilWidth: 'pencilWidthSlider',
            pencilSoftness: 'pencilSoftnessSlider',
            intensity: 'intensitySlider',
            colorCount: 'colorCountSlider',
            spread: 'spreadSlider',
            shapeCharacter: 'shapeCharacterSlider',
            strokeDensity: 'strokeDensitySlider',
            hatchDeviation: 'hatchDeviationSlider'
        };

        Object.entries(sliderIds).forEach(([setting, sliderId]) => {
            this.sliders?.setValue(sliderId, this.settingsStore.get(setting), false);
        });

        const seedInput = document.getElementById('seedInput');
        if (seedInput) seedInput.value = this.settings.seed;

        document.querySelectorAll('input[type="color"][data-color-setting]').forEach((input) => {
            input.value = this.normalizeHexColor(this.settingsStore.get(input.dataset.colorSetting));
        });

        document.querySelectorAll('input[type="checkbox"][data-setting]').forEach((checkbox) => {
            checkbox.checked = Boolean(this.settingsStore.get(checkbox.dataset.setting));
        });
        this.updateExportButtonLabel();
        this.updatePlayButtonLabel();

        [
            ['paletteMode', 'paletteMode'],
            ['spotBlendMode', 'spotBlendMode']
        ].forEach(([name, setting]) => {
            document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
                radio.checked = radio.value === this.settingsStore.get(setting);
            });
        });
    }

    exportArtwork() {
        if (this.settings.gifExport) {
            this.exportGIF();
            return;
        }
        this.exportPNG();
    }

    exportPNG() {
        const settings = this.settingsStore.getAll();
        const exportCanvas = document.createElement('canvas');
        this.renderer.render(exportCanvas, {
            ...settings,
            transparentBackground: Boolean(settings.transparentExport),
            showPaperGrain: settings.transparentExport ? false : settings.showPaperGrain
        });

        exportCanvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const suffix = settings.transparentExport ? '-transparent' : '';
            link.download = `nopresha-pencil-${this.settings.seed}${suffix}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    async exportGIF() {
        const settings = this.settingsStore.getAll();
        const exportButton = document.getElementById('exportPngBtn');
        const originalText = exportButton?.textContent || 'Export GIF';
        const exportCanvas = document.createElement('canvas');
        const width = Math.round(settings.width);
        const height = Math.round(settings.height);
        const encoder = new GifEncoder(width, height, {
            delayCentiseconds: GIF_FRAME_DELAY_CS,
            transparent: Boolean(settings.transparentExport)
        });
        const animationTracks = this.createAnimationTracks(this.getAnimationBaseValues(settings), settings);

        if (exportButton) {
            exportButton.textContent = 'Rendering GIF';
            exportButton.classList.add('is-busy');
            exportButton.disabled = true;
        }

        try {
            for (let frame = 0; frame < GIF_FRAME_COUNT; frame += 1) {
                const progress = frame / (GIF_FRAME_COUNT - 1);
                const animatedSettings = this.getAnimationFrameSettings(settings, progress, animationTracks);

                this.renderer.render(exportCanvas, {
                    ...animatedSettings,
                    transparentBackground: Boolean(settings.transparentExport),
                    showPaperGrain: settings.transparentExport ? false : settings.showPaperGrain
                });

                const ctx = exportCanvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, width, height);
                encoder.addFrame(imageData, GIF_FRAME_DELAY_CS);

                await waitForFrame();
            }

            const blob = encoder.finish();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const transparentSuffix = settings.transparentExport ? '-transparent' : '';
            link.href = url;
            link.download = `nopresha-pencil-${this.settings.seed}${transparentSuffix}.gif`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } finally {
            if (exportButton) {
                exportButton.disabled = false;
                exportButton.classList.remove('is-busy');
                exportButton.textContent = originalText;
                this.updateExportButtonLabel();
            }
        }
    }

    updateExportButtonLabel() {
        const button = document.getElementById('exportPngBtn');
        if (button && !button.classList.contains('is-busy')) {
            button.textContent = this.settingsStore.get('gifExport') ? 'Export GIF' : 'Export PNG';
        }
    }

    updatePlayButtonLabel() {
        const button = document.getElementById('playAnimationBtn');
        if (!button) return;
        button.classList.toggle('is-active', this.isPlayingAnimation);
        if (!this.isPlayingAnimation) {
            button.textContent = 'Play';
            return;
        }
        button.textContent = this.isPlayButtonHovered ? 'Stop' : 'Playing';
    }

    getAnimationFrameSettings(settings, progress, tracks) {
        return ANIMATION_PARAMETERS.reduce((animatedSettings, parameter) => {
            if (settings[parameter.flag] && tracks?.[parameter.setting]) {
                animatedSettings[parameter.setting] = this.getAnimatedTrackValue(parameter, tracks[parameter.setting], progress);
            }
            return animatedSettings;
        }, { ...settings });
    }

    exportSettings() {
        const blob = new Blob([JSON.stringify(this.settingsStore.getAll(), null, 2)], {
            type: 'application/json;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `nopresha-pencil-${this.settings.seed}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    importSettings(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            this.settingsStore.fromJSON(reader.result);
            this.syncControls();
            this.scheduleRender();
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    makeSeed() {
        return `nopresha-${Math.floor(Date.now() % 1000000).toString(36)}`;
    }

    async loadText(src) {
        const response = await fetch(src);
        if (!response.ok) {
            throw new Error(`Unable to load text: ${src}`);
        }
        return response.text();
    }

    normalizeHexColor(value) {
        const color = String(value || '').trim();
        return /^#[0-9a-f]{6}$/i.test(color) ? color : '#ffffff';
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smoothstep(t) {
    const clamped = clamp(t, 0, 1);
    return clamped * clamped * (3 - 2 * clamped);
}

function waitForFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
