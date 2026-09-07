import {
    ActionDockController,
    FileIntakeController,
    PresetMenuKeyboardController,
    UnifiedUiController,
    defineTool
} from '../../src/index.js';
import { DOCUMENT_VERSION, TOOL_ID, defaults, normalizeDocument } from './document.js';
import { drawRaster, renderVectorHook } from './render.js';

let actionDock = null;
let unifiedUi = null;
let presetKeyboard = null;
let assetIntake = null;
let jsonIntake = null;
let listenerController = null;
let activeReader = null;
let assetImage = null;
let assetDataUrl = '';

function setStatus(message, state = 'ready') {
    const status = document.querySelector('#operationStatus');
    status.textContent = message;
    status.dataset.state = state;
}

async function withBusy(button, message, operation) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setStatus(message, 'loading');
    try {
        await operation();
        setStatus('Ready');
    } catch (error) {
        setStatus('Error', 'error');
        await app.dialog?.alert({ title: 'Operation failed', text: error.message });
    } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }
}

function bind(selector, event, handler) {
    document.querySelector(selector)?.addEventListener(event, handler, { signal: listenerController.signal });
}

function readDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        activeReader = reader;
        reader.onload = () => { if (activeReader === reader) activeReader = null; resolve(String(reader.result)); };
        reader.onerror = () => { if (activeReader === reader) activeReader = null; reject(reader.error || new Error('Could not read image.')); };
        reader.onabort = () => reject(new DOMException('Image read aborted.', 'AbortError'));
        reader.readAsDataURL(file);
    });
}

function decodeImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('The selected file is not a decodable image.'));
        image.src = source;
    });
}

function clearAsset(tool) {
    if (assetImage) assetImage.src = '';
    assetImage = null;
    assetDataUrl = '';
    tool.renderNow();
    unifiedUi?.refreshSummaries();
}

function setupPublicControllers(tool) {
    listenerController = new AbortController();
    actionDock = new ActionDockController().init();
    unifiedUi = new UnifiedUiController({
        toolName: 'Raster Texture Starter',
        summaryProviders: {
            texturePanel: () => `${tool.settings.density} marks`,
            appearancePanel: () => tool.settings.square ? 'Squares' : 'Circles',
            assetPanel: () => assetIntake?.currentFile?.name || 'No asset'
        }
    }).init();
    presetKeyboard = new PresetMenuKeyboardController().init();

    assetIntake = new FileIntakeController({
        root: 'assetIntake', input: 'assetFileInput', trigger: 'assetDropzone', dropzone: 'assetDropzone',
        status: 'assetFileStatus', removeButton: 'clearAssetFile', accept: 'image/*', maxBytes: 12 * 1024 * 1024,
        emptyText: 'No image loaded',
        onSelect: async file => {
            const dataUrl = await readDataUrl(file);
            const image = await decodeImage(dataUrl);
            if (assetImage) assetImage.src = '';
            assetImage = image;
            assetDataUrl = dataUrl;
            tool.renderNow();
            queueMicrotask(() => unifiedUi.refreshSummaries());
            return { statusText: `${file.name} loaded` };
        },
        onRemove: () => clearAsset(tool),
        onError: error => tool.dialog?.alert({ title: 'Image import failed', text: error.message })
    }).init();

    jsonIntake = new FileIntakeController({
        root: 'jsonIntake', input: 'jsonFileInput', trigger: 'jsonDropzone', status: 'jsonFileStatus',
        accept: '.json,application/json', maxBytes: 256 * 1024, emptyText: 'No settings file',
        onSelect: async file => {
            const previous = tool.getSnapshot();
            try {
                const imported = await tool.exporter.importJSON(file);
                tool.applySnapshot(normalizeDocument(imported));
                tool.history?.notifyChange('import-json');
                tool.history?.flush();
                unifiedUi.refreshSummaries();
                return { statusText: `${file.name} loaded` };
            } catch (error) {
                tool.applySnapshot(previous);
                throw error;
            }
        },
        onError: error => tool.dialog?.alert({ title: 'Settings import failed', text: error.message })
    }).init();

    bind('[data-history-undo]', 'click', () => { tool.undo(); unifiedUi.refreshSummaries(); });
    bind('[data-history-redo]', 'click', () => { tool.redo(); unifiedUi.refreshSummaries(); });
    bind('#shuffleBtn', 'click', () => tool.settingsStore.set('seed', crypto.getRandomValues(new Uint32Array(1))[0]));
    bind('#exportPng1Btn', 'click', event => withBusy(event.currentTarget, 'Exporting PNG…', () => tool.exportPNG('raster-texture.png', 1)));
    bind('#exportPng2Btn', 'click', event => withBusy(event.currentTarget, 'Exporting 2× PNG…', () => tool.exportPNG('raster-texture@2x.png', 2)));
    bind('#exportSvgBtn', 'click', event => withBusy(event.currentTarget, 'Exporting SVG…', () => tool.exportSVG('raster-texture.svg')));
    bind('#exportJsonBtn', 'click', event => withBusy(event.currentTarget, 'Exporting JSON…', () => tool.exporter.exportJSON({ schemaVersion: DOCUMENT_VERSION, toolId: TOOL_ID, settings: tool.getSnapshot() }, 'raster-texture.json')));
    bind('#importJsonBtn', 'click', () => jsonIntake.open());
    bind('#presetDropdownToggle', 'click', () => queueMicrotask(() => presetKeyboard.sync()));

    document.documentElement.dataset.starterReady = 'true';
    setStatus('Ready');
}

function teardownPublicControllers() {
    listenerController?.abort();
    activeReader?.abort();
    activeReader = null;
    assetIntake?.destroy();
    jsonIntake?.destroy();
    presetKeyboard?.destroy();
    unifiedUi?.destroy();
    actionDock?.destroy();
    assetIntake = null;
    jsonIntake = null;
    presetKeyboard = null;
    unifiedUi = null;
    actionDock = null;
    if (assetImage) assetImage.src = '';
    assetImage = null;
    assetDataUrl = '';
    delete document.documentElement.dataset.starterReady;
}

const app = defineTool({
    renderer: 'canvas',
    dom: {
        canvas: 'canvasContainer', surface: 'mainCanvas', zoomIndicator: 'zoomIndicator',
        presetDropdown: 'presetDropdown', presetToggle: 'presetDropdownToggle', presetMenu: 'presetDropdownMenu',
        saveBtn: 'savePresetBtn', shareBtn: 'presetToolbarShareBtn'
    },
    settings: defaults,
    controls: {
        sliders: [
            { id: 'densitySlider', valueId: 'densityValue', setting: 'density', min: 20, max: 500, decimals: 0, baseStep: 1, shiftStep: 20 },
            { id: 'radiusSlider', valueId: 'radiusValue', setting: 'radius', min: 2, max: 64, decimals: 0, baseStep: 1, shiftStep: 4 },
            { id: 'jitterSlider', valueId: 'jitterValue', setting: 'jitter', min: 0, max: 1, decimals: 2, baseStep: 0.01, shiftStep: 0.1 },
            { id: 'opacitySlider', valueId: 'opacityValue', setting: 'opacity', min: 0, max: 1, decimals: 2, baseStep: 0.01, shiftStep: 0.1 },
            { id: 'assetOpacitySlider', valueId: 'assetOpacityValue', setting: 'assetOpacity', min: 0, max: 1, decimals: 2, baseStep: 0.01, shiftStep: 0.1 }
        ],
        toggles: true
    },
    panels: [
        { id: 'texturePanel', headerId: 'texturePanelHeader', persistent: true },
        { id: 'appearancePanel', headerId: 'appearancePanelHeader', persistent: true },
        { id: 'assetPanel', headerId: 'assetPanelHeader', persistent: true }
    ],
    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'mark', setting: 'color', itemId: 'markColorItem', dotId: 'markColorPreview', hexId: 'markColorHex', hsbSlotId: 'markColorHsbSlot' },
            { type: 'background', setting: 'background', itemId: 'backgroundColorItem', dotId: 'backgroundColorPreview', hexId: 'backgroundColorHex', hsbSlotId: 'backgroundColorHsbSlot' }
        ]
    },
    presets: {
        storageKey: 'ui-garage:canvas-full:presets:v1', basePath: './presets', defaultName: 'Starter',
        colorDots: blob => [{ kind: 'solid', value: blob.color }, { kind: 'solid', value: blob.background }],
        suggestSaveName: tool => `${tool.settings.density} marks`
    },
    history: { maxSize: 80, debounceMs: 120 },
    share: { quantizableFloatKeys: ['radius', 'jitter', 'opacity', 'assetOpacity'] },
    export: {
        filename: 'raster-texture.svg',
        primaryFormat: 'png',
        primaryFilename: 'raster-texture@2x.png',
        primaryScale: 2
    },
    dialog: {},
    mobile: { className: 'is-mobile', query: '(max-width: 768px)' },
    zoom: { fitPadding: { top: 72, right: 72, bottom: 86, left: 72 } },
    render: context => drawRaster(context, assetImage),
    renderTo: context => drawRaster(context, assetImage),
    renderSVG: context => renderVectorHook(context, assetDataUrl),
    onReady: setupPublicControllers,
    onDestroy: teardownPublicControllers
});

await app.init();
window.__uiGarageCanvasStarter = app;

export { app };
