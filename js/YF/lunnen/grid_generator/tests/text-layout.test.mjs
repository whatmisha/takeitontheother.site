import test from 'node:test';
import assert from 'node:assert/strict';

import { TextLayout } from '../src/elements/TextLayout.js';

const settings = {
    gridModule: 5,
    margins: 2
};
const contexts = {
    front: { gridModule: 5, margins: 2, columnCount: 4, frontWidth: 100 },
    left: { gridModule: 4, margins: 1, columnCount: 2, frontWidth: 50 }
};
const measurementContext = {
    font: '',
    measureText: text => ({ width: text.length * 10 })
};
const layout = new TextLayout({
    settings: { get: key => settings[key] },
    getSurfaceGridContext: surface => contexts[surface],
    getBlockY: block => block.row * 2 + block.baselineOffset,
    createMeasurementContext: () => measurementContext
});

test('text width and position use the selected surface grid', () => {
    assert.equal(layout.calculateBlockWidth({ surface: 'front', width: 2 }), 37.5);
    assert.equal(layout.calculateBlockWidth({ surface: 'left', width: 2 }), 42);

    assert.deepEqual(layout.calculateBlockPosition({
        surface: 'front', x: 2, row: 3, baselineOffset: 1, alignment: 'left'
    }, 2), { x: 62.5, y: 70 });
    assert.deepEqual(layout.calculateBlockPosition({
        surface: 'front', x: 2, row: 3, baselineOffset: 1, alignment: 'right'
    }, 2), { x: 95, y: 70 });
});

test('baseline snapping keeps special first-line alignment unsnapped', () => {
    assert.equal(layout.snapToBaseline(73, 20, 2, true, 'baseline'), 70);
    assert.equal(layout.snapToBaseline(73, 20, 2, false, 'baseline'), 72.5);
    assert.equal(layout.snapToBaseline(73, 20, 2, true, 'x-height'), 73);
    assert.equal(layout.snapToBaseline(73, 20, 2, true, 'cap-height'), 73);
});

test('measurement includes tracking and reuses its canvas context', () => {
    assert.equal(layout.measureTextWidth('abc', 10, 1, 0.1), 32);
    assert.match(measurementContext.font, /^500 10px/);
    assert.equal(layout.measurementContext, measurementContext);
});

test('wrapping preserves non-breaking spaces as one token', () => {
    assert.deepEqual(layout.wrapText('alpha beta', 55, 10, 1), ['alpha', 'beta']);
    assert.deepEqual(layout.wrapText('a\u00A0b c', 35, 10, 1), ['a\u00A0b', 'c']);
    assert.deepEqual(layout.tokenizeLine('one\ttwo'), ['one', ' ', 'two']);
});
