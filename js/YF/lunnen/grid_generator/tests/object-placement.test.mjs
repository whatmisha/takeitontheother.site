import test from 'node:test';
import assert from 'node:assert/strict';

import { ObjectPlacementController } from '../src/elements/ObjectPlacementController.js';

const context = {
    frontWidth: 120,
    frontHeight: 100,
    gridModule: 5,
    margins: 1,
    columnCount: 12,
    rowCount: 12,
    rowHeight: 7
};

function createHost() {
    const coordinates = {
        getGridContext: () => context,
        getBlockY: block => block.row * 8 + block.baselineOffset,
        yToRowBaseline: y => ({ row: Math.floor(y / 8), baselineOffset: y % 8 }),
        rowBaselineToY: (row, offset) => row * 8 + offset,
        mmToColumns: millimeters => millimeters / 10,
        getSurfacePointer: () => ({
            surface: 'left',
            local: { x: 31, y: 26 },
            context
        })
    };
    return {
        surfaceCoordinates: coordinates,
        objectDocument: { textBlocks: [], graphicsBlocks: [], getBuiltInGraphicsBlocks: () => [] },
        textLayout: { calculateBlockPosition: () => ({ x: 10, y: 10 }) },
        dom: {}
    };
}

test('locked text objects stay inside their selected surface', () => {
    const host = createHost();
    const placement = new ObjectPlacementController(host);
    const block = {
        lockPosition: true,
        surface: 'right',
        x: 20,
        row: 20,
        baselineOffset: 20,
        width: 4,
        alignment: 'left'
    };

    placement.constrain(block, 'text');
    assert.equal(block.x, 9);
    assert.equal(block.row <= 11, true);
    assert.equal(block.baselineOffset <= 7, true);
});

test('unlocked objects keep free coordinates', () => {
    const host = createHost();
    const placement = new ObjectPlacementController(host);
    const block = { lockPosition: false, surface: 'front', x: 20, row: 20, baselineOffset: 20 };

    placement.constrain(block, 'text');
    assert.deepEqual(block, {
        lockPosition: false,
        surface: 'front',
        x: 20,
        row: 20,
        baselineOffset: 20
    });
});

test('pointer placement transfers an object between surfaces before constraining it', () => {
    const host = createHost();
    const placement = new ObjectPlacementController(host);
    const block = {
        id: 'text-1',
        lockPosition: true,
        surface: 'front',
        x: 1,
        row: 0,
        baselineOffset: 0,
        width: 3,
        alignment: 'left'
    };

    assert.equal(placement.positionAtPointer(block, 0, 0, 'text'), true);
    assert.equal(block.surface, 'left');
    assert.equal(block.x >= 1 && block.x <= 10, true);
    assert.equal(block.row >= 0, true);
});

test('graphics width is recalculated from aspect ratio in surface columns', () => {
    const host = createHost();
    const placement = new ObjectPlacementController(host);
    const block = {
        surface: 'top',
        originalWidth: 200,
        originalHeight: 100,
        heightInModules: 3
    };

    placement.recalculateGraphicsWidthFromHeight(block);
    assert.equal(block.widthInColumns, 3);
});
