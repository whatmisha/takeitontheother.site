import test from 'node:test';
import assert from 'node:assert/strict';

import { HistoryManager } from '../src/history/HistoryManager.js';
import { ObjectDocumentController } from '../src/elements/ObjectDocumentController.js';
import { PresetApplicationController } from '../src/preset/PresetApplicationController.js';
import { PresetManager } from '../src/preset/PresetManager.js';

class TestSettings {
    constructor(values = {}) { this.values = { ...values }; }
    get(key) { return this.values[key]; }
    getAll() { return { ...this.values }; }
    set(key, value) { this.values[key] = value; }
    setMultiple(values) { Object.assign(this.values, values); }
}

const createHost = () => {
    const objectDocument = new ObjectDocumentController({ includeBuiltIns: false });
    const host = {
        settingsModule: new TestSettings({
            gridModule: 5,
            columnCount: 12,
            rowCount: 12,
            lockedModule: false,
            lockedMargins: false
        }),
        objectDocument,
        presetHistories: new Map(),
        historyManager: new HistoryManager({ maxSize: 50 }),
        currentPresetName: null,
        surfaceManager: { initialize: (...args) => { host.surfaceInit = args; } },
        sliderController: { setValue: (...args) => host.sliderCalls.push(args) },
        gridCalculator: { calculateRowCount: () => 99 },
        sliderCalls: [],
        syncCount: 0,
        gridCount: 0,
        navigatorCount: 0,
        closeCount: 0,
        syncApplicationUI: () => { host.syncCount += 1; },
        updateGrid: () => { host.gridCount += 1; },
        objectNavigatorController: {
            render: () => { host.navigatorCount += 1; }
        },
        objectEditorPanelController: {
            closeTextPanel: () => { host.closeCount += 1; },
            closeGraphicsPanel: () => { host.closeCount += 1; }
        },
        resetChangesFlag: () => { host.resetCount = (host.resetCount || 0) + 1; },
        mmToColumns: millimeters => millimeters / 2,
        recalculateGraphicsWidthFromHeight: block => { block.widthInColumns = 3; },
        svgExporter: { importSettings: async value => value },
        presetManager: { currentPreset: null, addImportedPreset: async () => {} }
    };
    host.gridSettingsController = {
        recalculateWithLockedModule: () => {},
        recalculateWithLockedMargins: () => {},
        generateRowPresets: () => {}
    };
    host.objectPlacementController = {
        recalculateGraphicsWidthFromHeight: block => host.recalculateGraphicsWidthFromHeight(block)
    };
    return host;
};

const preset = {
    settings: {
        frontWidth: 500,
        gridModule: 5,
        columnCount: 12,
        rowCount: 12,
        surfaceSettings: { left: { visible: true } }
    },
    textBlocks: [{ id: 'text-1', text: 'Hello' }],
    graphicsBlocks: [
        { id: 'graphic-1', widthInModules: 2 },
        { id: 'claim', isBuiltIn: true }
    ]
};

test('preset application clones input and applies document defaults', () => {
    const host = createHost();
    const controller = new PresetApplicationController(host);
    controller.applyPreset(preset, 'Front test');

    assert.equal(host.currentPresetName, 'Front test');
    assert.equal(host.settingsModule.get('lineHeightUnit'), 'mod');
    assert.deepEqual(host.surfaceInit, ['Front test', preset.settings.surfaceSettings]);
    assert.equal(host.objectDocument.textBlocks[0].lockPosition, true);
    assert.equal(host.objectDocument.textBlocks[0].textAlign, 'left');
    assert.equal(host.objectDocument.graphicsBlocks[0].lockPosition, true);
    assert.equal(host.objectDocument.getGraphicsBlock('graphic-1').widthInColumns, 5);
    assert.equal(host.objectDocument.getGraphicsBlock('icons'), null);
    assert.equal(host.objectDocument.getGraphicsBlock('claim').isBuiltIn, true);
    assert.equal(preset.textBlocks[0].lockPosition, undefined);
    assert.equal(preset.graphicsBlocks[0].widthInColumns, undefined);
    assert.equal(host.historyManager.history.length, 1);
});

test('snapshot round-trip restores independent document data', () => {
    const host = createHost();
    const controller = new PresetApplicationController(host);
    controller.applyPreset(preset, 'Round trip');
    const snapshot = controller.createSnapshot();

    host.settingsModule.set('frontWidth', 900);
    host.objectDocument.textBlocks[0].text = 'Changed';
    controller.applySnapshot(snapshot);

    assert.equal(host.settingsModule.get('frontWidth'), 500);
    assert.equal(host.settingsModule.get('rowCount'), 12);
    assert.equal(host.objectDocument.textBlocks[0].text, 'Hello');
    assert.notEqual(host.objectDocument.textBlocks, snapshot.document.textBlocks);
    assert.equal(host.historyManager.isRestoring, false);
    assert.equal(host.closeCount, 2);
});

test('switching presets restores the latest per-preset history state', () => {
    const host = createHost();
    const controller = new PresetApplicationController(host);
    controller.applyPreset(preset, 'Preset A');
    host.settingsModule.set('frontWidth', 640);

    controller.applyPreset({ ...preset, settings: { ...preset.settings, frontWidth: 300 } }, 'Preset B');
    const result = controller.applyPreset(preset, 'Preset A');

    assert.equal(result.restoredFromHistory, true);
    assert.equal(host.settingsModule.get('frontWidth'), 640);
    assert.equal(host.historyManager.history.length, 2);
});

test('history identity follows preset ids even when display names collide', () => {
    const host = createHost();
    const controller = new PresetApplicationController(host);
    host.presetManager.currentPreset = 'imported-a';
    controller.applyPreset(preset, 'Custom — Same name');
    host.settingsModule.set('frontWidth', 610);
    host.historyManager.saveSnapshot(controller.createSnapshot(), 'resize A');

    host.presetManager.currentPreset = 'imported-b';
    controller.applyPreset(
        { ...preset, settings: { ...preset.settings, frontWidth: 320 } },
        'Custom — Same name'
    );
    assert.equal(host.settingsModule.get('frontWidth'), 320);

    host.presetManager.currentPreset = 'imported-a';
    controller.applyPreset(preset, 'Custom — Same name');
    assert.equal(host.settingsModule.get('frontWidth'), 610);
});

test('failed preset application rolls back the active document and history', () => {
    const host = createHost();
    const controller = new PresetApplicationController(host);
    controller.applyPreset(preset, 'Stable');
    const stableHistory = host.historyManager;
    let shouldFail = true;
    host.syncApplicationUI = () => {
        if (shouldFail) {
            shouldFail = false;
            throw new Error('render failure');
        }
    };

    assert.throws(
        () => controller.applyPreset(
            { ...preset, settings: { ...preset.settings, frontWidth: 999 } },
            'Broken'
        ),
        /render failure/
    );
    assert.equal(host.currentPresetName, 'Stable');
    assert.equal(host.settingsModule.get('frontWidth'), 500);
    assert.equal(host.historyManager, stableHistory);
});

test('import keeps normalized JSON independent from the source of truth', async () => {
    const host = createHost();
    const normalized = { ...preset, presetName: 'Imported' };
    host.svgExporter.importSettings = async () => normalized;
    let imported;
    host.presetManager.addImportedPreset = async (data, displayName) => {
        imported = { data, displayName };
    };
    const controller = new PresetApplicationController(host);

    await controller.importFile({});
    imported.data.textBlocks[0].text = 'Local copy';

    assert.equal(imported.displayName, 'Custom — Imported');
    assert.equal(normalized.textBlocks[0].text, 'Hello');
});

test('re-importing a custom preset does not stack synthetic name prefixes', async () => {
    const host = createHost();
    host.svgExporter.importSettings = async () => ({
        ...preset,
        presetName: 'Custom — Custom — E-ink, 148.5×203×43.5mm — 26.08.10, 11:07'
    });
    let importedName;
    host.presetManager.addImportedPreset = async (_data, displayName) => {
        importedName = displayName;
    };
    const controller = new PresetApplicationController(host);

    await controller.importFile({});

    assert.equal(importedName, 'Custom — E-ink, 148.5×203×43.5mm — 26.08.10, 11:07');
});

test('PresetManager awaits application and rolls selection back on failure', async () => {
    const originalAlert = globalThis.alert;
    const originalConsoleError = console.error;
    globalThis.alert = () => {};
    console.error = () => {};
    try {
        const manager = new PresetManager({
            dropdownMenu: { querySelectorAll: () => [] },
            dropdownToggle: {
                getAttribute: () => 'false',
                style: {}
            },
            onPresetLoad: async () => { throw new Error('application failed'); }
        });
        manager.currentPreset = 'old.json';
        manager.currentPresetName = 'Old';
        manager.presetWidths = { 'old.json': 100, 'new.json': 120 };
        manager.loadPreset = async () => manager.onPresetLoad({}, 'New');

        const selected = await manager.selectPreset('new.json', 'New');

        assert.equal(selected, false);
        assert.equal(manager.currentPreset, 'old.json');
        assert.equal(manager.currentPresetName, 'Old');
    } finally {
        globalThis.alert = originalAlert;
        console.error = originalConsoleError;
    }
});

test('PresetManager initialization awaits the default preset selection', async () => {
    const originalFetch = globalThis.fetch;
    let selectionFinished = false;
    globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ presets: [{ name: '+ New', file: 'New.json' }] })
    });
    try {
        const manager = new PresetManager();
        manager.selectPreset = async () => {
            await Promise.resolve();
            selectionFinished = true;
            return true;
        };
        manager.initializeDropdown = async () => manager.selectPreset('New.json', '+ New');

        const initialized = await manager.init();

        assert.equal(initialized, true);
        assert.equal(selectionFinished, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
