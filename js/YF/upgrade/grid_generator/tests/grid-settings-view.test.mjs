import test from 'node:test';
import assert from 'node:assert/strict';
import { createGridSliderConfigs } from '../src/ui/GridSliderConfig.js';
import { GridSettingsView } from '../src/ui/GridSettingsView.js';

const createClassList = () => {
    const values = new Set();
    return {
        toggle(name, force) {
            if (force) values.add(name);
            else values.delete(name);
        },
        contains: name => values.has(name)
    };
};

class FakeControl {
    constructor() {
        this.listeners = new Map();
        this.classList = createClassList();
        this.checked = false;
    }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }

    emit(type, values = {}) {
        const event = { preventDefault() {}, target: this, ...values };
        this.listeners.get(type)?.forEach(listener => listener(event));
    }

    closest() {
        return { classList: createClassList() };
    }
}

test('grid slider definitions route updates to one command owner', () => {
    const calls = [];
    const methodNames = [
        'handleWidthChange',
        'handleVerticalGeometryChange',
        'handleThicknessChange',
        'handleModuleChange',
        'handleMarginsChange',
        'handleColumnCountChange',
        'handleRowCountChange',
        'handleRowHeightChange'
    ];
    const actions = Object.fromEntries(methodNames.map(name => [
        name,
        (...args) => calls.push([name, ...args])
    ]));
    const configs = createGridSliderConfigs(actions);

    configs.frontWidthSlider.onUpdate();
    configs.frontHeightSlider.onUpdate();
    configs.thicknessSlider.onUpdate();
    configs.gridModuleSlider.onUpdate();
    configs.marginsSlider.onUpdate(2.5);
    configs.columnCountSlider.onUpdate();
    configs.rowCountSlider.onUpdate();
    configs.rowHeightSlider.onUpdate();

    assert.deepEqual(calls, [
        ['handleWidthChange'],
        ['handleVerticalGeometryChange', true],
        ['handleThicknessChange'],
        ['handleModuleChange'],
        ['handleMarginsChange', 2.5],
        ['handleColumnCountChange'],
        ['handleRowCountChange'],
        ['handleRowHeightChange']
    ]);
});

test('grid view binds controls once and routes semantic actions', () => {
    const dom = Object.fromEntries([
        'linkModeOff', 'linkModeRowsHeight', 'linkModeModule', 'marginsUnitMod',
        'marginsUnitMm', 'lockModuleBtn', 'lockMarginsBtn'
    ].map(key => [key, new FakeControl()]));
    const calls = [];
    const host = {
        dom,
        settingsModule: { get: key => key === 'marginsUnit' ? 'mod' : null }
    };
    const actions = {
        setLinkMode: value => calls.push(['link', value]),
        switchMarginsUnit: value => calls.push(['unit', value]),
        toggleLockModule: () => calls.push(['lock', 'module']),
        toggleLockMargins: () => calls.push(['lock', 'margins'])
    };
    const view = new GridSettingsView(host, actions, { documentRef: null });
    view.bind();
    view.bind();

    dom.linkModeModule.emit('change', { target: { value: 'module' } });
    dom.marginsUnitMm.emit('click');
    dom.lockModuleBtn.emit('click');
    dom.lockMarginsBtn.emit('click');

    assert.deepEqual(calls, [
        ['link', 'module'],
        ['unit', 'mm'],
        ['lock', 'module'],
        ['lock', 'margins']
    ]);
});

test('grid view creates row presets and marks the active combination', () => {
    const container = {
        children: [],
        set innerHTML(_value) { this.children = []; },
        appendChild(child) { this.children.push(child); },
        querySelectorAll: () => container.children
    };
    const documentRef = {
        getElementById: id => id === 'rowPresetsContainer' ? container : null,
        createElement: () => {
            const button = new FakeControl();
            button.setAttribute = (name, value) => { button[name] = value; };
            return button;
        }
    };
    const values = { rowCount: 12, rowHeight: 7 };
    const applied = [];
    const host = {
        settingsModule: { get: key => values[key] },
        gridCalculator: {
            findPerfectRowCombinations: () => [
                { rowCount: 12, rowHeight: 7 },
                { rowCount: 8, rowHeight: 11 }
            ]
        }
    };
    const view = new GridSettingsView(host, {
        applyRowPreset: combo => applied.push(combo)
    }, { documentRef });

    view.generateRowPresets();
    assert.equal(container.children.length, 2);
    assert.equal(container.children[0].textContent, '12:7');
    assert.equal(container.children[0].classList.contains('active'), true);
    assert.equal(container.children[1].classList.contains('active'), false);
    container.children[1].emit('click');
    assert.deepEqual(applied, [{ rowCount: 8, rowHeight: 11 }]);
});
