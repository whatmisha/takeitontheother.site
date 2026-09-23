import test from 'node:test';
import assert from 'node:assert/strict';

import { GridSettingsController } from '../src/ui/GridSettingsController.js';

class TestSettings {
    constructor(values) { this.values = { ...values }; }
    get(key) { return this.values[key]; }
    getAll() { return { ...this.values }; }
    set(key, value) { this.values[key] = value; }
}

const classList = () => {
    const values = new Set();
    return {
        toggle: (name, force) => force ? values.add(name) : values.delete(name),
        contains: name => values.has(name)
    };
};
const control = () => ({
    checked: false,
    classList: classList(),
    addEventListener: () => {},
    closest: () => ({ classList: classList() })
});

const createHost = () => {
    const values = {
        frontWidth: 500,
        frontHeight: 500,
        thickness: 50,
        gridModule: 5,
        margins: 2.5,
        marginsUnit: 'mod',
        columnCount: 12,
        rowCount: 12,
        rowHeight: 7,
        linkMode: 'module',
        lockedModule: false,
        lockedMargins: false,
        lockedModuleValue: null,
        lockedMarginsValue: null,
        showColumns: true,
        showRows: true,
        showBaseline: true,
        showObjects: true,
        showSidePanels: true
    };
    const host = {
        settingsModule: new TestSettings(values),
        dom: {
            linkModeOff: control(),
            linkModeRowsHeight: control(),
            linkModeModule: control(),
            marginsUnitMod: control(),
            marginsUnitMm: control(),
            lockModuleBtn: control(),
            lockMarginsBtn: control(),
            linkedControlsContainer: control(),
            showSidePanels: control(),
            showColumns: control(),
            showRows: control(),
            showBaseline: control(),
            showObjects: control()
        },
        sliderCalls: [],
        sliderController: {
            setValue: (...args) => host.sliderCalls.push(['value', ...args]),
            updateLimits: (...args) => host.sliderCalls.push(['limits', ...args]),
            getValue: () => 2.5
        },
        gridCalculator: {
            calculateModule: () => 4,
            calculateRowCount: () => 14,
            calculateRowHeight: () => 6,
            calculateMargins: () => 3
        },
        historyManager: {
            beginAction: () => { host.begins += 1; },
            commitAction: () => { host.commits += 1; }
        },
        begins: 0,
        commits: 0,
        getStateSnapshot: () => ({}),
        markAsChanged: () => {},
        constrainAllObjectsToGrid: () => {},
        updateGridDebounced: () => {},
        updateGrid: () => {},
        generateRowPresets: () => {},
        updatePresetButtons: () => {},
        typographyUnitController: { switchUnit: () => {} }
    };
    return host;
};

test('grid slider configuration has one owner for Dimensions and Grid controls', () => {
    const controller = new GridSettingsController(createHost());
    const config = controller.getSliderConfigs();
    assert.deepEqual(Object.keys(config).sort(), [
        'columnCountSlider', 'frontHeightSlider', 'frontWidthSlider', 'gridModuleSlider',
        'marginsSlider', 'rowCountSlider', 'rowHeightSlider', 'thicknessSlider'
    ]);
    assert.ok(Object.values(config).every(item => typeof item.onUpdate === 'function'));
});

test('margins unit switch preserves physical millimeters', () => {
    const host = createHost();
    const controller = new GridSettingsController(host);
    controller.switchMarginsUnit('mm');
    assert.equal(host.settingsModule.get('margins'), 2.5);
    assert.equal(host.settingsModule.get('marginsUnit'), 'mm');
    assert.deepEqual(host.sliderCalls.at(-1), ['value', 'marginsSlider', 12.5, false]);

    controller.switchMarginsUnit('mod');
    assert.equal(host.settingsModule.get('margins'), 2.5);
    assert.equal(host.begins, 2);
    assert.equal(host.commits, 2);
});

test('module and margin locks stay mutually exclusive', () => {
    const host = createHost();
    const controller = new GridSettingsController(host);
    controller.toggleLockModule();
    assert.equal(host.settingsModule.get('lockedModule'), true);
    assert.equal(host.settingsModule.get('lockedMargins'), false);
    assert.equal(host.settingsModule.get('gridModule'), 5);
    assert.equal(host.settingsModule.get('margins'), 3);

    controller.toggleLockMargins();
    assert.equal(host.settingsModule.get('lockedModule'), false);
    assert.equal(host.settingsModule.get('lockedMargins'), true);
    assert.equal(host.settingsModule.get('marginsUnit'), 'mm');
    assert.equal(host.begins, 2);
    assert.equal(host.commits, 2);
});

test('UI sync updates values, units, link mode and visibility in one pass', () => {
    const host = createHost();
    host.settingsModule.set('marginsUnit', 'mm');
    host.settingsModule.set('linkMode', 'rows-height');
    const controller = new GridSettingsController(host);
    controller.sync();

    assert.equal(host.dom.linkModeRowsHeight.checked, true);
    assert.equal(host.dom.marginsUnitMm.classList.contains('active'), true);
    assert.equal(host.dom.showColumns.checked, true);
    assert.ok(host.sliderCalls.some(call =>
        call[0] === 'value' && call[1] === 'marginsSlider' && call[2] === 12.5
    ));
});
