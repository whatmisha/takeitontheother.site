import test from 'node:test';
import assert from 'node:assert/strict';

import { LunnenDisplayEditorController } from '../src/elements/LunnenDisplayEditorController.js';
import { TextEditorPositionController } from '../src/elements/TextEditorPositionController.js';

class FakeElement {
    constructor(values = {}) {
        Object.assign(this, values);
        this.listeners = new Map();
        this.style ||= {};
    }

    addEventListener(type, callback) {
        const callbacks = this.listeners.get(type) || [];
        callbacks.push(callback);
        this.listeners.set(type, callbacks);
    }

    dispatch(type, event = {}) {
        event.target ||= this;
        for (const callback of this.listeners.get(type) || []) callback(event);
    }

    focus() { this.dispatch('focus'); }
    blur() { this.dispatch('blur'); }
}

function createHistoryHost(block, dom = {}) {
    const calls = [];
    const host = {
        currentEditingBlock: block,
        dom,
        historyManager: {
            beginAction: label => calls.push(`begin:${label}`),
            commitAction: () => calls.push('commit')
        },
        getStateSnapshot: () => ({ snapshot: true }),
        markAsChanged: () => calls.push('changed'),
        updateGrid: () => calls.push('render'),
        objectNavigatorController: { render: () => calls.push('navigator') }
    };
    return { host, calls };
}

test('text surface and alignment controls are independent atomic actions', () => {
    const block = {
        id: 'text',
        surface: 'front',
        x: 1,
        row: 3,
        baselineOffset: 2,
        width: 3,
        alignment: 'left',
        textAlign: 'left',
        alignmentMode: 'baseline',
        lockPosition: true
    };
    const surface = new FakeElement({ value: 'left' });
    const lock = new FakeElement({ checked: false });
    const anchor = new FakeElement({ checked: true });
    const xHeight = new FakeElement({ checked: true });
    const center = new FakeElement({ checked: true });
    const xInput = new FakeElement({ value: 1 });
    const { host, calls } = createHistoryHost(block, {
        paragraphSurfaceSelect: surface,
        paragraphLockPositionToggle: lock,
        paragraphAlignRightToggle: anchor,
        alignmentModeXHeight: xHeight,
        textAlignmentCenter: center,
        paragraphXInput: xInput
    });
    host.getSurfaceGridContext = selected => ({
        columnCount: selected === 'left' ? 6 : 12,
        frontWidth: 100,
        frontHeight: 100,
        gridModule: 5,
        margins: 1,
        rowHeight: 7
    });
    host.moveBlockToSurface = (candidate, selected) => {
        calls.push(`move:${selected}`);
        candidate.surface = selected;
        candidate.x = 1;
        candidate.row = 0;
        candidate.baselineOffset = 0;
    };
    host.rowBaselineToY = (row, offset) => row * 8 + offset;
    host.yToRowBaseline = value => ({
        row: Math.floor(value / 8),
        baselineOffset: value % 8
    });
    host.sliderController = { getDecimalsFromStep: () => 0 };
    const controller = new TextEditorPositionController(host);
    controller.init();

    surface.dispatch('change');
    anchor.dispatch('change');
    lock.dispatch('change');
    xHeight.dispatch('change');
    center.dispatch('change');

    assert.equal(block.surface, 'left');
    assert.equal(block.x, 3);
    assert.equal(block.alignment, 'right');
    assert.equal(block.lockPosition, false);
    assert.equal(block.alignmentMode, 'x-height');
    assert.equal(block.textAlign, 'center');
    assert.equal(xInput.value, 3);
    assert.equal(calls.filter(call => call === 'move:left').length, 1);
    assert.equal(calls.filter(call => call === 'commit').length, 5);
    assert.ok(calls.includes('navigator'));
});

test('Lunnen Display weight and OpenType features record reproducible changes', () => {
    const block = { id: 'display', styleRef: 'lunnenDisplay' };
    const slider = new FakeElement({ value: '400' });
    const value = new FakeElement({ value: '400' });
    const salt = new FakeElement({ checked: true });
    const elements = new Map([
        ['lunnenDisplayWeightSlider', slider],
        ['lunnenDisplayWeightValue', value],
        ['featureSalt', salt]
    ]);
    const { host, calls } = createHistoryHost(block);
    const controller = new LunnenDisplayEditorController(host, {
        documentRef: { getElementById: id => elements.get(id) || null }
    });
    controller.init();

    slider.focus();
    slider.value = '275';
    slider.dispatch('input');
    slider.blur();
    assert.equal(block.fontWeight, 275);
    assert.equal(value.value, 275);

    value.focus();
    value.value = '999';
    value.blur();
    assert.equal(block.fontWeight, 400);
    assert.equal(slider.value, 400);

    salt.dispatch('change');
    assert.deepEqual(block.fontFeatures, {
        salt: true,
        aalt: false,
        ss01: false,
        ss02: false,
        tnum: false,
        dlig: false
    });
    assert.equal(calls.filter(call => call === 'commit').length, 3);
    assert.equal(calls.filter(call => call === 'changed').length, 3);
});
