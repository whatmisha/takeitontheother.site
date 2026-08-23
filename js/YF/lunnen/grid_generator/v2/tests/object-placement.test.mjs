import test from 'node:test';
import assert from 'node:assert/strict';

import { ObjectPlacementController } from '../src/elements/ObjectPlacementController.js';

const context = {
    planeWidth: 120,
    planeHeight: 100,
    gridModule: 5,
    margins: 1,
    columnCount: 12,
    rowCount: 12,
    rowHeight: 7
};
const leftContext = {
    ...context,
    planeWidth: 100,
    columnCount: 18
};

function createHost() {
    const coordinates = {
        getGridContext: surface => surface === 'left' ? leftContext : context,
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
        resolveBlockPlane: block => block.planeId || 'front',
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
        planeId: 'right',
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
    const block = { lockPosition: false, planeId: 'front', x: 20, row: 20, baselineOffset: 20 };

    placement.constrain(block, 'text');
    assert.deepEqual(block, {
        lockPosition: false,
        planeId: 'front',
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
        planeId: 'front',
        x: 1,
        row: 0,
        baselineOffset: 0,
        width: 3,
        alignment: 'left'
    };

    assert.equal(placement.positionAtPointer(block, 0, 0, 'text'), true);
    assert.equal(block.planeId, 'left');
    assert.equal(block.width, 4.5);
    assert.equal(block.x >= 1 && block.x <= 10, true);
    assert.equal(block.row >= 0, true);
});

test('surface transfer preserves text width as a share of the selected surface grid', () => {
    const host = createHost();
    const placement = new ObjectPlacementController(host);
    const block = {
        id: 'text-relative',
        lockPosition: true,
        planeId: 'front',
        x: 6,
        row: 4,
        baselineOffset: 2,
        width: 4,
        alignment: 'left'
    };

    placement.moveToSurface(block, 'left', 'text');

    assert.equal(block.width, 6);
    assert.equal(block.planeId, 'left');
    assert.deepEqual([block.x, block.row, block.baselineOffset], [1, 0, 0]);
});

test('surface transfer preserves graphics width ratio in both sizing modes', () => {
    const host = createHost();
    const placement = new ObjectPlacementController(host);
    const widthSized = {
        planeId: 'front',
        sizeMode: 'width',
        widthInColumns: 4,
        heightInModules: 3,
        originalWidth: 200,
        originalHeight: 100
    };

    placement.transferRelativeWidth(widthSized, 'left', 'graphics');
    assert.equal(widthSized.widthInColumns, 6);
    assert.equal(widthSized.planeId, 'left');

    const heightSized = {
        planeId: 'front',
        sizeMode: 'height',
        widthInColumns: 1,
        heightInModules: 3,
        originalWidth: 200,
        originalHeight: 100
    };
    const sourceWidth = placement.getWidthInColumns(heightSized, 'graphics', context);
    placement.transferRelativeWidth(heightSized, 'left', 'graphics');
    const targetWidth = placement.getWidthInColumns(heightSized, 'graphics', leftContext);

    assert.ok(Math.abs(sourceWidth / context.columnCount - targetWidth / leftContext.columnCount) < 1e-5);
    assert.equal(
        heightSized.widthInColumns,
        Number.parseFloat((sourceWidth / context.columnCount * leftContext.columnCount).toFixed(4))
    );
});

test('graphics width is recalculated from aspect ratio in surface columns', () => {
    const host = createHost();
    const placement = new ObjectPlacementController(host);
    const block = {
        planeId: 'top',
        originalWidth: 200,
        originalHeight: 100,
        heightInModules: 3
    };

    placement.recalculateGraphicsWidthFromHeight(block);
    assert.equal(block.widthInColumns, 3);
});
