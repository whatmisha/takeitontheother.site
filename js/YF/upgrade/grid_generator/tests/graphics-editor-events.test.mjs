import test from 'node:test';
import assert from 'node:assert/strict';

import { GraphicsEditorEventController } from '../src/elements/GraphicsEditorEventController.js';

class FakeElement {
    constructor(values = {}) {
        Object.assign(this, values);
        this.listeners = new Map();
        this.attributes = new Map();
        this.style ||= {};
        this.dataset ||= {};
        const classes = new Set();
        this.classList ||= {
            add: value => classes.add(value),
            remove: value => classes.delete(value),
            contains: value => classes.has(value)
        };
    }

    addEventListener(type, callback) {
        const callbacks = this.listeners.get(type) || [];
        callbacks.push(callback);
        this.listeners.set(type, callbacks);
    }

    removeEventListener(type, callback) {
        const callbacks = this.listeners.get(type) || [];
        this.listeners.set(type, callbacks.filter(candidate => candidate !== callback));
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    contains(target) { return target === this; }
    click() { this.clickCount = (this.clickCount || 0) + 1; }

    dispatch(type, event = {}) {
        event.target ||= this;
        event.preventDefault ||= function preventDefault() { this.defaultPrevented = true; };
        event.stopPropagation ||= function stopPropagation() { this.propagationStopped = true; };
        for (const callback of this.listeners.get(type) || []) callback(event);
        return event;
    }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function createHost(block, dom = {}) {
    const calls = [];
    const host = {
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
            candidate.surface = surface;
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
        surface: 'front',
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

    assert.equal(block.surface, 'left');
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
        surface: 'left',
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

test('graphics SVG FileIntake accepts extension-only drops and rejects other files', async () => {
    const block = { id: 'graphic' };
    const zone = new FakeElement({ tagName: 'DIV' });
    const input = new FakeElement({ tagName: 'INPUT', id: 'svgFileInput', files: [], value: '' });
    const status = new FakeElement({ tagName: 'P', id: 'svgFileStatus', textContent: '' });
    const { host } = createHost(block, {
        fileUploadArea: zone,
        svgFileInput: input,
        svgFileStatus: status
    });
    const handled = [];
    host.graphicsAssetController = {
        handleFile: async file => {
            handled.push(file.name);
            status.textContent = `✓ ${file.name}`;
            return block;
        }
    };
    const controller = new GraphicsEditorEventController(host, {
        documentRef: { getElementById: () => null }
    });
    controller.init();

    zone.dispatch('drop', {
        dataTransfer: { files: [{ name: 'wrong.json', type: 'application/json', size: 10 }] }
    });
    await settle();
    assert.deepEqual(handled, []);
    assert.equal(status.dataset.fileState, 'error');

    zone.dispatch('drop', {
        dataTransfer: { files: [{ name: 'mark.svg', type: '', size: 20 }] }
    });
    await settle();
    assert.deepEqual(handled, ['mark.svg']);
    assert.equal(status.dataset.fileState, 'ready');
    assert.equal(status.textContent, '✓ mark.svg');
    controller.dispose();
    assert.equal(input.listeners.get('change')?.length || 0, 0);
});
