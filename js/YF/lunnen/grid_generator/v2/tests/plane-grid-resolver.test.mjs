import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveInheritedCounts, resolvePlaneGridContext } from '../src/surfaces/PlaneGridResolver.js';
import { GridCalculator } from '../src/grid/GridCalculator.js';

const masterGrid = {
    module: 5,
    margins: 2,
    columns: 4,
    rows: 12,
    rowHeight: 7
};

test('the root plane takes the master grid verbatim', () => {
    const context = resolvePlaneGridContext({
        masterGrid,
        isRoot: true,
        planeWidth: 500,
        planeHeight: 500,
        referenceWidth: 500,
        referenceHeight: 500
    });

    assert.equal(context.gridModule, 5);
    assert.equal(context.margins, 2);
    assert.equal(context.columnCount, 4);
    assert.equal(context.rowCount, 12);
    assert.equal(context.rowHeight, 7);
    assert.equal(context.planeWidth, 500);
    assert.equal(context.planeHeight, 500);
});

test('a plane whose width matches a reference edge reuses that edge count', () => {
    const alongWidth = resolveInheritedCounts({
        masterGrid,
        planeWidth: 500,
        planeHeight: 50,
        referenceWidth: 500,
        referenceHeight: 300
    });
    assert.equal(alongWidth.columns, masterGrid.columns);

    const alongHeight = resolveInheritedCounts({
        masterGrid,
        planeWidth: 300,
        planeHeight: 50,
        referenceWidth: 500,
        referenceHeight: 300
    });
    assert.equal(alongHeight.columns, masterGrid.rows);
});

test('an unrelated width fits as many master-width columns as physically fit', () => {
    // Master columns are (500 - 2*2*5 - 3*5) / 4 = 116.25 mm wide with a 5 mm gutter.
    const counts = resolveInheritedCounts({
        masterGrid,
        planeWidth: 260,
        planeHeight: 50,
        referenceWidth: 500,
        referenceHeight: 300
    });

    assert.equal(counts.columns, 2);
    assert.ok(counts.columns < masterGrid.columns);
});

test('an own grid overrides inheritance but still clamps margins to the plane', () => {
    const context = resolvePlaneGridContext({
        masterGrid,
        planeGrid: { module: 5, margins: 40, columns: 3, rows: 2, rowHeight: 4 },
        inherits: false,
        planeWidth: 100,
        planeHeight: 60,
        referenceWidth: 500,
        referenceHeight: 300
    });

    assert.equal(context.columnCount, 3);
    assert.equal(context.rowCount, 2);
    assert.equal(context.rowHeight, 4);
    // 40 modules of margin cannot fit a 60 mm plane: (60 / (2*5)) - 0.01 = 5.99.
    assert.equal(context.margins, 5.99);
});

test('counts never fall below one on a plane thinner than one module', () => {
    const context = resolvePlaneGridContext({
        masterGrid,
        planeWidth: 2,
        planeHeight: 2,
        referenceWidth: 500,
        referenceHeight: 300
    });

    assert.equal(context.columnCount, 1);
    assert.equal(context.rowCount, 1);
});

test('the grid calculator measures the plane it is given, not the root', () => {
    const settings = new Map(Object.entries({
        gridModule: 5,
        margins: 2,
        rowHeight: 7,
        rowCount: 12,
        columnCount: 4,
        frontWidth: 500,
        frontHeight: 500,
        lockedMargins: false,
        lockedMarginsValue: null
    }));
    const store = { get: key => settings.get(key) };

    const rootCalculator = new GridCalculator(store);
    const wallCalculator = new GridCalculator(store, {
        getPlaneSize: () => ({ width: 500, height: 50 })
    });

    assert.equal(rootCalculator.calculateRowCount(), 12);
    assert.equal(wallCalculator.calculateRowCount(), 1);
    assert.equal(rootCalculator.calculateColumnWidth(), wallCalculator.calculateColumnWidth());
    assert.ok(wallCalculator.calculateModule() < rootCalculator.calculateModule());
});
