import test from 'node:test';
import assert from 'node:assert/strict';

import { GraphicsEditorInputController } from '../src/elements/GraphicsEditorInputController.js';
import { TextEditorPositionController } from '../src/elements/TextEditorPositionController.js';

function createHost() {
    const context = {
        columnCount: 12,
        planeWidth: 120,
        planeHeight: 120,
        gridModule: 5,
        margins: 1,
        rowHeight: 7
    };
    return {
        dom: {
            paragraphXInput: { value: '' },
            paragraphWidthInput: { value: '' },
            paragraphBaselineInput: { value: '' },
            graphicsWidthInput: { value: '' },
            graphicsHeightInput: { value: '' },
            graphicsRowInput: { value: '' },
            graphicsBaselineInput: { value: '' }
        },
        getSurfaceGridContext: () => context,
        resolveBlockPlane: block => block.planeId || 'front',
        sliderController: {
            getDecimalsFromStep: step => {
                const text = String(step);
                return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0;
            }
        },
        rowBaselineToY: (row, baselineOffset) => row * (context.rowHeight + 1) + baselineOffset,
        yToRowBaseline: y => ({
            row: Math.floor(y / (context.rowHeight + 1)),
            baselineOffset: y % (context.rowHeight + 1)
        }),
        columnsToMm: columns => columns * 10,
        mmToColumns: millimeters => millimeters / 10,
        getBlockY: block => block.row * (context.rowHeight + 1) + block.baselineOffset,
        markAsChanged() {},
        updateGrid() {}
    };
}

function arrow(key, shiftKey = false) {
    return {
        key,
        shiftKey,
        prevented: false,
        preventDefault() { this.prevented = true; }
    };
}

test('text editor arrows keep quarter-column width and surface bounds', () => {
    const host = createHost();
    host.currentEditingBlock = {
        planeId: 'left',
        x: 10,
        row: 0,
        baselineOffset: 3,
        width: 2.5
    };
    const controller = new TextEditorPositionController(host);

    const widthEvent = arrow('ArrowUp');
    controller.handleArrow(widthEvent, 'width', 'paragraphWidthInput');
    assert.equal(widthEvent.prevented, true);
    assert.equal(host.currentEditingBlock.width, 2.75);
    assert.equal(host.dom.paragraphWidthInput.value, '2.75');
    assert.equal(host.currentEditingBlock.x, 10);

    const xEvent = arrow('ArrowUp', true);
    controller.handleArrow(xEvent, 'x', 'paragraphXInput');
    assert.equal(host.currentEditingBlock.x, 12);
    assert.equal(host.currentEditingBlock.width, 1);
    assert.equal(host.dom.paragraphWidthInput.value, '1.00');
});

test('graphics width and height controls preserve aspect ratio', () => {
    const host = createHost();
    const block = {
        planeId: 'right',
        originalWidth: 200,
        originalHeight: 100,
        widthInColumns: 2,
        heightInModules: 2,
        row: 1,
        baselineOffset: 0
    };
    const controller = new GraphicsEditorInputController(host);

    const width = controller.constrainWidth(block, 3);
    assert.equal(width, 3);
    assert.equal(block.heightInModules, 3);
    assert.equal(host.dom.graphicsHeightInput.value, '3.00');

    const height = controller.constrainHeight(block, 4);
    assert.equal(height, 4);
    assert.equal(block.widthInColumns, 4);
    assert.equal(host.dom.graphicsWidthInput.value, '4.00');
});

test('graphics baseline input updates row-local coordinates', () => {
    const host = createHost();
    const block = {
        planeId: 'top',
        heightInModules: 3,
        row: 0,
        baselineOffset: 0
    };
    const controller = new GraphicsEditorInputController(host);

    const displayValue = controller.constrainBaseline(block, 11);
    assert.equal(displayValue, 11);
    assert.equal(block.row, 1);
    assert.equal(block.baselineOffset, 2);
    assert.equal(host.dom.graphicsRowInput.value, 2);
});

test('graphics row keeps one-based display separate from zero-based model data', () => {
    const host = createHost();
    const block = {
        planeId: 'bottom',
        heightInModules: 3,
        row: 0,
        baselineOffset: 4
    };
    const controller = new GraphicsEditorInputController(host);

    const displayValue = controller.constrainRow(block, 2);
    assert.equal(displayValue, 2);
    assert.equal(block.row, 1);
    assert.equal(block.baselineOffset, 0);
    assert.equal(host.dom.graphicsBaselineInput.value, 9);
});
