import test from 'node:test';
import assert from 'node:assert/strict';

import { GridCalculator } from '../src/grid/GridCalculator.js';

const values = {
    frontWidth: 500,
    frontHeight: 500,
    gridModule: 5,
    margins: 2.5,
    rowCount: 12,
    rowHeight: 7,
    columnCount: 12,
    lockedMargins: false,
    lockedMarginsValue: null
};
const calculator = new GridCalculator({ get: key => values[key] });

test('grid calculator keeps linked row and module math reciprocal', () => {
    assert.equal(calculator.calculateRowCount(), 12);
    assert.equal(calculator.calculateRowHeight(), 7);
    assert.equal(calculator.calculateModule(), 5);
    assert.equal(calculator.calculateMargins(), 2.5);
});

test('grid calculator respects locked physical margins', () => {
    values.lockedMargins = true;
    values.lockedMarginsValue = 12.5;
    assert.equal(calculator.calculateModule(), 5);
    values.lockedMargins = false;
    values.lockedMarginsValue = null;
});

test('grid calculator exposes only active grid geometry', () => {
    assert.equal(calculator.calculateColumnWidth(), 35);
    assert.ok(calculator.findPerfectRowCombinations().some(
        item => item.rowCount === 12 && item.rowHeight === 7
    ));
    assert.equal('gridPositionToXY' in calculator, false);
    assert.equal('calculateBlockPosition' in calculator, false);
});
