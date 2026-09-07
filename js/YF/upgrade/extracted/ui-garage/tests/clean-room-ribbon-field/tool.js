import {
    ActionDockController,
    FileIntakeController,
    PresetMenuKeyboardController,
    SeededRandom,
    UnifiedUiController,
    defineTool
} from '../../src/index.js';
import { DOCUMENT_VERSION, TOOL_ID, defaults, normalizeDocument } from './document.js';

let actionDock = null;
let unifiedUi = null;
let presetKeyboard = null;
let fileIntake = null;
let listenerController = null;

function renderPattern({ svg, create, width, height, settings }) {
    svg.appendChild(create('rect', { width, height, fill: settings.background }));
    const random = new SeededRandom(settings.seed || 1);
    const phase = settings.phase * Math.PI / 180;
    for (let ribbon = 0; ribbon < settings.ribbons; ribbon += 1) {
        const baseY = height * (ribbon + 1) / (settings.ribbons + 1);
        const localPhase = phase + random.float(-0.35, 0.35);
        const direction = settings.mirrored && ribbon % 2 ? -1 : 1;
        const points = [];
        for (let step = 0; step <= 80; step += 1) {
            const x = width * step / 80;
            const wave = Math.sin((step / 80) * Math.PI * 2 * settings.frequency * direction + localPhase);
            points.push(`${x.toFixed(2)},${(baseY + wave * settings.amplitude).toFixed(2)}`);
        }
        svg.appendChild(create('polyline', {
            points: points.join(' '), fill: 'none', stroke: settings.color,
            'stroke-width': settings.thickness, 'stroke-linecap': 'round', opacity: random.float(0.62, 1).toFixed(3)
        }));
    }

    if (settings.showGuides) {
        for (let ribbon = 0; ribbon < settings.ribbons; ribbon += 1) {
            const y = height * (ribbon + 1) / (settings.ribbons + 1);
            svg.appendChild(create('line', { x1: 0, y1: y, x2: width, y2: y, stroke: '#777', opacity: 0.3, 'stroke-width': 1, 'stroke-dasharray': 4, 'data-export-exclude': 'true' }));
        }
    }
}

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

function setupPublicControllers(tool) {
    listenerController = new AbortController();
    actionDock = new ActionDockController().init();
    unifiedUi = new UnifiedUiController({
        toolName: 'Ribbon Field',
        summaryProviders: {
            layoutPanel: () => `${tool.settings.ribbons} ribbons`,
            appearancePanel: () => `${tool.settings.frequency} waves`,
            dataPanel: () => fileIntake?.state || 'Empty'
        }
    }).init();
    presetKeyboard = new PresetMenuKeyboardController().init();

    fileIntake = new FileIntakeController({
        root: 'jsonIntake',
        input: 'jsonFileInput',
        trigger: 'jsonDropzone',
        dropzone: 'jsonDropzone',
        status: 'jsonFileStatus',
        removeButton: 'clearJsonFile',
        accept: '.json,application/json',
        maxBytes: 256 * 1024,
        emptyText: 'No document loaded',
        onSelect: async file => {
            const previous = tool.getSnapshot();
            try {
                const imported = await tool.exporter.importJSON(file);
                const normalized = normalizeDocument(imported);
                tool.applySnapshot(normalized);
                tool.history?.notifyChange('import-json');
                tool.history?.flush();
                unifiedUi.refreshSummaries();
                return { statusText: `${file.name} loaded` };
            } catch (error) {
                tool.applySnapshot(previous);
                throw error;
            }
        },
        onError: error => tool.dialog?.alert({ title: 'Import failed', text: error.message })
    }).init();

    bind('[data-history-undo]', 'click', () => { tool.undo(); unifiedUi.refreshSummaries(); });
    bind('[data-history-redo]', 'click', () => { tool.redo(); unifiedUi.refreshSummaries(); });
    bind('#shuffleBtn', 'click', () => tool.settingsStore.set('seed', crypto.getRandomValues(new Uint32Array(1))[0]));
    bind('#exportSvgBtn', 'click', event => withBusy(event.currentTarget, 'Exporting SVG…', () => tool.exportSVG()));
    bind('#exportPngBtn', 'click', event => withBusy(event.currentTarget, 'Exporting PNG…', () => tool.exportPNG('ribbon-field.png', 2)));
    bind('#exportPdfBtn', 'click', event => withBusy(event.currentTarget, 'Exporting PDF…', () => tool.runExport('pdf', ({ signal }) => tool.exporter.exportToPDF(tool.target.element, 'ribbon-field.pdf', { signal, removeInteractive: true, convertTextToOutlines: false, unit: 'px', format: { width: tool.settings.width, height: tool.settings.height } }))));
    bind('#exportJsonBtn', 'click', event => withBusy(event.currentTarget, 'Exporting JSON…', async () => tool.exporter.exportJSON({ schemaVersion: DOCUMENT_VERSION, toolId: TOOL_ID, settings: tool.getSnapshot() }, 'ribbon-field.json')));
    bind('#importJsonBtn', 'click', () => fileIntake.open());
    bind('#presetDropdownToggle', 'click', () => queueMicrotask(() => presetKeyboard.sync()));

    document.documentElement.dataset.starterReady = 'true';
    setStatus('Ready');
}

function teardownPublicControllers() {
    listenerController?.abort();
    listenerController = null;
    fileIntake?.destroy();
    presetKeyboard?.destroy();
    unifiedUi?.destroy();
    actionDock?.destroy();
    fileIntake = null;
    presetKeyboard = null;
    unifiedUi = null;
    actionDock = null;
    delete document.documentElement.dataset.starterReady;
}

const app = defineTool({
    renderer: 'svg',
    dom: {
        canvas: 'canvasContainer',
        surface: 'mainSvg',
        zoomIndicator: 'zoomIndicator',
        presetDropdown: 'presetDropdown',
        presetToggle: 'presetDropdownToggle',
        presetMenu: 'presetDropdownMenu',
        saveBtn: 'savePresetBtn',
        shareBtn: 'presetToolbarShareBtn'
    },
    settings: defaults,
    controls: {
        sliders: [
            { id: 'ribbonsSlider', valueId: 'ribbonsValue', setting: 'ribbons', min: 2, max: 40, decimals: 0, baseStep: 1, shiftStep: 4 },
            { id: 'amplitudeSlider', valueId: 'amplitudeValue', setting: 'amplitude', min: 0, max: 240, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'frequencySlider', valueId: 'frequencyValue', setting: 'frequency', min: 0.25, max: 8, decimals: 2, baseStep: 0.05, shiftStep: 0.5 },
            { id: 'thicknessSlider', valueId: 'thicknessValue', setting: 'thickness', min: 1, max: 48, decimals: 0, baseStep: 1, shiftStep: 4 },
            { id: 'phaseSlider', valueId: 'phaseValue', setting: 'phase', min: 0, max: 360, decimals: 0, baseStep: 1, shiftStep: 15, suffix: '°' }
        ],
        toggles: true
    },
    panels: [
        { id: 'layoutPanel', headerId: 'layoutPanelHeader', persistent: true },
        { id: 'appearancePanel', headerId: 'appearancePanelHeader', persistent: true },
        { id: 'dataPanel', headerId: 'dataPanelHeader', persistent: true }
    ],
    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'shape', setting: 'color', itemId: 'shapeColorItem', dotId: 'shapeColorPreview', hexId: 'shapeColorHex', hsbSlotId: 'shapeColorHsbSlot' },
            { type: 'background', setting: 'background', itemId: 'backgroundColorItem', dotId: 'backgroundColorPreview', hexId: 'backgroundColorHex', hsbSlotId: 'backgroundColorHsbSlot' }
        ]
    },
    presets: {
        storageKey: 'ui-garage:ribbon-field:presets:v1',
        basePath: './presets',
        defaultName: 'Starter',
        colorDots: blob => [{ kind: 'solid', value: blob.color }, { kind: 'solid', value: blob.background }],
        suggestSaveName: tool => `${tool.settings.ribbons} ribbons`
    },
    history: { maxSize: 80, debounceMs: 120 },
    share: { quantizableFloatKeys: ['amplitude', 'frequency', 'thickness', 'phase'] },
    export: { filename: 'ribbon-field.svg' },
    dialog: {},
    mobile: { className: 'is-mobile', query: '(max-width: 768px)' },
    render: renderPattern,
    onReady: setupPublicControllers,
    onDestroy: teardownPublicControllers
});

await app.init();
window.__uiGarageCleanRoomTool = app;

export { app, renderPattern };
