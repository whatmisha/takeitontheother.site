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
    const cellWidth = width / settings.columns;
    const cellHeight = height / settings.rows;
    const base = Math.min(cellWidth, cellHeight) * settings.scale;
    const random = new SeededRandom(settings.seed || 1);

    for (let row = 0; row < settings.rows; row += 1) {
        for (let column = 0; column < settings.columns; column += 1) {
            const x = column * cellWidth + cellWidth / 2;
            const y = row * cellHeight + cellHeight / 2;
            const size = base * random.float(0.72, 1);
            if (settings.square) {
                const shape = create('rect', { x: x - size / 2, y: y - size / 2, width: size, height: size, rx: size * 0.08, fill: settings.color });
                shape.setAttribute('transform', `rotate(${settings.rotation} ${x} ${y})`);
                svg.appendChild(shape);
            } else {
                const shape = create('ellipse', { cx: x, cy: y, rx: size / 2, ry: size * 0.34, fill: settings.color });
                shape.setAttribute('transform', `rotate(${settings.rotation + random.float(-12, 12)} ${x} ${y})`);
                svg.appendChild(shape);
            }
        }
    }

    if (settings.showGuides) {
        for (let column = 0; column <= settings.columns; column += 1) {
            svg.appendChild(create('line', { x1: column * cellWidth, y1: 0, x2: column * cellWidth, y2: height, stroke: '#777', opacity: 0.35, 'stroke-width': 1, 'data-export-exclude': 'true' }));
        }
        for (let row = 0; row <= settings.rows; row += 1) {
            svg.appendChild(create('line', { x1: 0, y1: row * cellHeight, x2: width, y2: row * cellHeight, stroke: '#777', opacity: 0.35, 'stroke-width': 1, 'data-export-exclude': 'true' }));
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
        toolName: 'Vector Pattern Starter',
        summaryProviders: {
            layoutPanel: () => `${tool.settings.columns} × ${tool.settings.rows}`,
            appearancePanel: () => tool.settings.square ? 'Squares' : 'Ellipses',
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
    bind('#exportPngBtn', 'click', event => withBusy(event.currentTarget, 'Exporting PNG…', () => tool.exportPNG('vector-pattern.png', 2)));
    bind('#exportPdfBtn', 'click', event => withBusy(event.currentTarget, 'Exporting PDF…', () => tool.runExport('pdf', ({ signal }) => tool.exporter.exportToPDF(tool.target.element, 'vector-pattern.pdf', { signal, removeInteractive: true, convertTextToOutlines: false, unit: 'px', format: { width: tool.settings.width, height: tool.settings.height } }))));
    bind('#exportJsonBtn', 'click', event => withBusy(event.currentTarget, 'Exporting JSON…', async () => tool.exporter.exportJSON({ schemaVersion: DOCUMENT_VERSION, toolId: TOOL_ID, settings: tool.getSnapshot() }, 'vector-pattern.json')));
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
            { id: 'columnsSlider', valueId: 'columnsValue', setting: 'columns', min: 2, max: 24, decimals: 0, baseStep: 1, shiftStep: 4 },
            { id: 'rowsSlider', valueId: 'rowsValue', setting: 'rows', min: 2, max: 24, decimals: 0, baseStep: 1, shiftStep: 4 },
            { id: 'scaleSlider', valueId: 'scaleValue', setting: 'scale', min: 0.1, max: 1, decimals: 2, baseStep: 0.01, shiftStep: 0.1 },
            { id: 'rotationSlider', valueId: 'rotationValue', setting: 'rotation', min: 0, max: 360, decimals: 0, baseStep: 1, shiftStep: 15, suffix: '°' }
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
        storageKey: 'ui-garage:svg-full:presets:v1',
        basePath: './presets',
        defaultName: 'Starter',
        colorDots: blob => [{ kind: 'solid', value: blob.color }, { kind: 'solid', value: blob.background }],
        suggestSaveName: tool => `${tool.settings.columns} × ${tool.settings.rows}`
    },
    history: { maxSize: 80, debounceMs: 120 },
    share: { quantizableFloatKeys: ['scale', 'rotation'] },
    export: { filename: 'vector-pattern.svg' },
    dialog: {},
    mobile: { className: 'is-mobile', query: '(max-width: 768px)' },
    render: renderPattern,
    onReady: setupPublicControllers,
    onDestroy: teardownPublicControllers
});

await app.init();
window.__uiGarageSvgStarter = app;

export { app, renderPattern };
