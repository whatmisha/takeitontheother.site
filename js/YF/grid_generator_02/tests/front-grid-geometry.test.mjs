import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateBaselineRects,
    calculateColumnRects,
    calculateRowRects
} from '../src/grid/FrontGridGeometry.js';

test('front column geometry preserves margins, scale and gutter', () => {
    const rects = calculateColumnRects({
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        scale: 2,
        module: 2,
        margins: 1,
        columnCount: 3,
        columnWidth: 10
    });

    assert.deepEqual(rects, [
        { x: 14, y: 24, width: 20, height: 72 },
        { x: 38, y: 24, width: 20, height: 72 },
        { x: 62, y: 24, width: 20, height: 72 }
    ]);
});

test('front row geometry stops before overflowing the panel', () => {
    const rects = calculateRowRects({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        scale: 1,
        module: 5,
        margins: 1,
        rowCount: 4,
        rowHeight: 2
    });

    assert.deepEqual(rects, [
        { x: 5, y: 5, width: 90, height: 10 },
        { x: 5, y: 20, width: 90, height: 10 },
        { x: 5, y: 35, width: 90, height: 10 }
    ]);
});

test('front baseline geometry fills only the area inside margins', () => {
    const rects = calculateBaselineRects({
        x: 0,
        y: 0,
        width: 100,
        height: 30,
        scale: 1,
        module: 5,
        margins: 1
    });

    assert.deepEqual(rects, [
        { x: 5, y: 5, width: 90, height: 5 },
        { x: 5, y: 10, width: 90, height: 5 },
        { x: 5, y: 15, width: 90, height: 5 },
        { x: 5, y: 20, width: 90, height: 5 }
    ]);
});
