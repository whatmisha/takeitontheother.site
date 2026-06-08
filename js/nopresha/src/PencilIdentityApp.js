import { Settings } from './core/Settings.js';
import { DOMCache } from './core/DOMCache.js';
import { SliderController } from './ui/SliderController.js';
import { PanelManager } from './ui/PanelManager.js';
import { PresetManager } from './preset/PresetManager.js';
import { PencilRenderer } from './generator/PencilRenderer.js';

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
            showPaperGrain: true,
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
            canvasMeta: 'canvasMeta',
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
        await this.initPresets();
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
            ['hatchDeviationSlider', 'hatchDeviationValue', 'hatchDeviation', 0, 100, 0, 1, 10],
            ['paperGrainSlider', 'paperGrainValue', 'paperGrain', 0, 100, 0, 1, 10]
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
                if (key !== 'transparentExport') {
                    this.scheduleRender();
                }
            });
        });
    }

    initColorInputs() {
        const input = document.getElementById('backgroundColorInput');
        if (!input) return;
        input.value = this.normalizeHexColor(this.settingsStore.get('backgroundColor'));
        input.addEventListener('input', () => {
            this.settingsStore.set('backgroundColor', this.normalizeHexColor(input.value));
            this.scheduleRender();
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
        bind('exportPngBtn', () => this.exportPNG());
        bind('resetBtn', () => this.reset());
        bind('exportSettingsBtn', () => this.exportSettings());
        bind('importSettingsBtn', () => document.getElementById('settingsFileInput')?.click());

        const fileInput = document.getElementById('settingsFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (event) => this.importSettings(event));
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
        if (this.dom.canvasMeta) {
            this.dom.canvasMeta.textContent = `${this.lastRenderInfo.width} x ${this.lastRenderInfo.height} PNG`;
        }
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
            hatchDeviation: 'hatchDeviationSlider',
            paperGrain: 'paperGrainSlider'
        };

        Object.entries(sliderIds).forEach(([setting, sliderId]) => {
            this.sliders?.setValue(sliderId, this.settingsStore.get(setting), false);
        });

        const seedInput = document.getElementById('seedInput');
        if (seedInput) seedInput.value = this.settings.seed;

        const backgroundColorInput = document.getElementById('backgroundColorInput');
        if (backgroundColorInput) {
            backgroundColorInput.value = this.normalizeHexColor(this.settingsStore.get('backgroundColor'));
        }

        document.querySelectorAll('input[type="checkbox"][data-setting]').forEach((checkbox) => {
            checkbox.checked = Boolean(this.settingsStore.get(checkbox.dataset.setting));
        });

        [
            ['paletteMode', 'paletteMode'],
            ['spotBlendMode', 'spotBlendMode']
        ].forEach(([name, setting]) => {
            document.querySelectorAll(`input[name="${name}"]`).forEach((radio) => {
                radio.checked = radio.value === this.settingsStore.get(setting);
            });
        });
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

    normalizeHexColor(value) {
        const color = String(value || '').trim();
        return /^#[0-9a-f]{6}$/i.test(color) ? color : '#ffffff';
    }
}
