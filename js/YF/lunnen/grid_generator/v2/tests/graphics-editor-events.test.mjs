import test from 'node:test';
import assert from 'node:assert/strict';

import { GraphicsEditorEventController } from '../src/elements/GraphicsEditorEventController.js';

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
}

function createHost(block, dom = {}) {
    const calls = [];
    const host = {
        resolveBlockPlane: block => block.planeId || 'front',
        currentEditingGraphicsId: block.id,
        dom,
        objectDocument: {
            getGraphicsBlock: id => id === block.id ? block : null
        },
        historyManager: {
            beginAction: label => calls.push(`begin:${label}`),
            commitAction: () => calls.push('commit')
        },
        getStateSnapshot: () => ({ snapshot: true }),
        markAsChanged: () => calls.push('changed'),
        updateGrid: () => calls.push('render'),
        objectNavigatorController: {
            render: () => calls.push('navigator')
        },
        graphicsEditorInputController: {
            initGraphicsInputs: () => calls.push('inputs')
        },
        moveBlockToSurface: (candidate, surface) => {
            calls.push(`move:${surface}`);
            candidate.planeId = surface;
            candidate.x = 1;
            candidate.row = 0;
            candidate.baselineOffset = 0;
        }
    };
    return { host, calls };
}

test('graphics surface, constraint and alignment changes are atomic document actions', () => {
    const block = {
        id: 'graphic',
        planeId: 'front',
        x: 5,
        row: 4,
        baselineOffset: 3,
        lockPosition: true,
        alignment: 'left'
    };
    const surfaceSelect = new FakeElement({ value: 'left' });
    const lockToggle = new FakeElement({ checked: false });
    const alignToggle = new FakeElement({ checked: true });
    const { host, calls } = createHost(block, {
        graphicsSurfaceSelect: surfaceSelect,
        graphicsLockPositionToggle: lockToggle,
        graphicsAlignRightToggle: alignToggle
    });
    const controller = new GraphicsEditorEventController(host, {
        documentRef: { getElementById: () => null }
    });
    controller.init();

    surfaceSelect.dispatch('change');
    lockToggle.dispatch('change');
    alignToggle.dispatch('change');

    assert.equal(block.planeId, 'left');
    assert.deepEqual([block.x, block.row, block.baselineOffset], [1, 0, 0]);
    assert.equal(block.lockPosition, false);
    assert.equal(block.alignment, 'right');
    assert.equal(calls.filter(call => call === 'move:left').length, 1);
    assert.equal(calls.filter(call => call === 'inputs').length, 1);
    assert.equal(calls.filter(call => call === 'changed').length, 3);
    assert.equal(calls.filter(call => call === 'commit').length, 3);
    assert.ok(calls.includes('navigator'));
});

test('graphics size-mode conversion uses the selected surface own grid', () => {
    const block = {
        id: 'graphic',
        planeId: 'left',
        sizeMode: 'height',
        heightInModules: 2,
        widthInColumns: 1,
        originalWidth: 200,
        originalHeight: 100
    };
    const widthMode = new FakeElement({ checked: true });
    const heightMode = new FakeElement({ checked: false });
    const widthInput = new FakeElement({ value: '' });
    const heightInput = new FakeElement({ value: '' });
    const { host, calls } = createHost(block, {
        graphicsSizeModeWidth: widthMode,
        graphicsSizeModeHeight: heightMode,
        graphicsWidthGroup: new FakeElement(),
        graphicsHeightGroup: new FakeElement(),
        graphicsWidthInput: widthInput,
        graphicsHeightInput: heightInput
    });
    const convertedSurfaces = [];
    host.getSurfaceGridContext = surface => {
        assert.equal(surface, 'left');
        return { gridModule: 4 };
    };
    host.mmToColumns = (millimeters, surface) => {
        convertedSurfaces.push(surface);
        return millimeters / 8;
    };
    host.columnsToMm = (columns, surface) => {
        convertedSurfaces.push(surface);
        return columns * 8;
    };
    const controller = new GraphicsEditorEventController(host, {
        documentRef: { getElementById: () => null }
    });
    controller.init();

    widthMode.dispatch('change');
    assert.equal(block.sizeMode, 'width');
    assert.equal(block.widthInColumns, 2);
    assert.equal(widthInput.value, '2.00');
    assert.equal(host.dom.graphicsWidthGroup.style.display, 'flex');
    assert.equal(host.dom.graphicsHeightGroup.style.display, 'none');

    block.widthInColumns = 3;
    widthMode.checked = false;
    heightMode.checked = true;
    heightMode.dispatch('change');
    assert.equal(block.sizeMode, 'height');
    assert.equal(block.heightInModules, 3);
    assert.equal(heightInput.value, '3.00');
    assert.deepEqual(convertedSurfaces, ['left', 'left']);
    assert.equal(calls.filter(call => call === 'commit').length, 2);
});
