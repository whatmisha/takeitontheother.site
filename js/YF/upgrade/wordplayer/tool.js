import { defineTool, FileIntakeController } from '../framework/src/index.js?v=g6-capabilities-1';
import { DEFAULT_SETTINGS, SLIDER_DEFINITIONS } from './src/config/defaults.js';
import { WordplayerExporter } from './src/export/exporters.js';
import { AssetController } from './src/io/assets.js?v=g6-file-intake-2';
import { DitherEngine } from './src/modes/dither.js';
import { FormsEngine } from './src/modes/forms.js';
import { drawScene } from './src/render/canvas-renderer.js';
import { normalizeMode, WordplayerUI } from './src/ui/controls.js?v=g6-file-intake-1';

let app = null;
let currentScene = null;
const ditherEngine = new DitherEngine(() => app?.renderNow());
const formsEngine = new FormsEngine(() => app?.renderNow());
const exporter = new WordplayerExporter();
const assets = new AssetController({ ditherEngine, formsEngine, getApp: () => app });
const ui = new WordplayerUI({
    assets,
    exporter,
    getScene: () => currentScene,
    FileIntakeController
});

function snapshot(appInstance) {
    return { settings: appInstance.settingsStore.toObject() };
}

function restore(appInstance, source) {
    const settings = source?.settings || source || {};
    appInstance.settingsStore.fromJSON({ ...settings, mode: normalizeMode(settings.mode) }, true);
    ditherEngine.invalidate();
    formsEngine.invalidate();
}

function colorDots(blob) {
    const settings = blob?.settings || blob || {};
    return [
        { kind: 'solid', value: settings.inkColor || '#ffffff' },
        { kind: 'solid', value: settings.bgColor || '#0d0d0d' }
    ];
}

function computeScene(settings) {
    return settings.mode === 'forms'
        ? formsEngine.compute(settings)
        : ditherEngine.compute(settings);
}

app = defineTool({
    renderer: 'canvas',
    autoStart: true,
    dom: {
        canvas: 'canvasContainer',
        surface: 'mainCanvas',
        zoomIndicator: 'zoomIndicator'
    },
    settings: DEFAULT_SETTINGS,
    controls: {
        sliders: SLIDER_DEFINITIONS,
        toggles: true
    },
    panels: [
        { id: 'textPanel', headerId: 'textPanelHeader', persistent: true },
        { id: 'pixelsPanel', headerId: 'pixelsPanelHeader', persistent: true },
        { id: 'ditherPanel', headerId: 'ditherPanelHeader', persistent: true },
        { id: 'formsPanel', headerId: 'formsPanelHeader', persistent: true }
    ],
    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'ink', setting: 'inkColor', label: 'Ink', itemId: 'inkColorItem', dotId: 'inkColorPreview', hexId: 'inkColorHex', hsbSlotId: 'inkColorHsbSlot' },
            { type: 'bg', setting: 'bgColor', label: 'Background', itemId: 'bgColorItem', dotId: 'bgColorPreview', hexId: 'bgColorHex', hsbSlotId: 'bgColorHsbSlot' }
        ]
    },
    presets: {
        storageKey: 'upgrade:wordplayer:presets:v1',
        basePath: 'presets',
        colorDots,
        hasRandom: () => false
    },
    share: {
        quantizableFloatKeys: ['contrast']
    },
    export: false,
    zoom: {
        fitPadding: { top: 92, right: 360, bottom: 86, left: 360 }
    },
    history: {
        debounceMs: 120
    },
    shortcuts: {
        'mod+e': () => document.getElementById('exportSvgBtn')?.click()
    },
    snapshot,
    restore,
    collectPreset: snapshot,
    applyPreset: restore,
    syncControls: (appInstance) => ui.sync(appInstance),
    onChromeRefresh: (appInstance) => ui.sync(appInstance),
    render(ctx) {
        currentScene = computeScene(ctx.settings);
        drawScene(ctx.ctx2d, currentScene);
    },
    onReady(appInstance) {
        ui.bind(appInstance);
        void assets.loadDefaultImage();
        if (appInstance.settings.mode === 'forms') void assets.ensureDefaultForm();
        document.fonts?.load('400 16px "YSTextPattern"').then(() => {
            formsEngine.invalidateMetrics();
            appInstance.renderNow();
        });
        window.wordplayer = {
            app: appInstance,
            assets,
            ditherEngine,
            formsEngine,
            get scene() { return currentScene; },
            exportCurves: () => exporter.exportCurvedSvg(currentScene),
            exportPNG: () => exporter.exportPng(currentScene, { transparent: appInstance.settings.exportTransparent, scale: 3 })
        };
    }
});

export default app;
