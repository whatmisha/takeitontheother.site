import test from 'node:test';
import assert from 'node:assert/strict';

import { GraphicsRenderer } from '../src/elements/GraphicsRenderer.js';
import { MathUtils } from '../src/utils/MathUtils.js';

const values = {
    gridModule: 5,
    margins: 2,
    columnCount: 4,
    frontWidth: 100
};

const renderer = new GraphicsRenderer({
    settings: { get: key => values[key] },
    createSvgElement: () => {},
    getContrastColor: () => '#fff',
    getBlockY: block => block.row * 2 + block.baselineOffset
});

const assertClose = (actual, expected) => {
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
};

test('graphics dimensions preserve aspect ratio in height and width modes', () => {
    const heightMode = renderer.calculateDimensions({
        sizeMode: 'height',
        heightInModules: 3,
        originalWidth: 200,
        originalHeight: 100
    });
    assertClose(MathUtils.ptToMm(heightMode.height), 15);
    assertClose(MathUtils.ptToMm(heightMode.width), 30);

    const widthMode = renderer.calculateDimensions({
        sizeMode: 'width',
        widthInColumns: 2,
        originalWidth: 200,
        originalHeight: 100
    });
    assertClose(MathUtils.ptToMm(widthMode.width), 37.5);
    assertClose(MathUtils.ptToMm(widthMode.height), 18.75);
});

test('graphics layout respects scale, baseline and right alignment', () => {
    const left = renderer.calculateLayout({
        x: 2,
        row: 3,
        baselineOffset: 1,
        sizeMode: 'height',
        heightInModules: 2,
        originalWidth: 200,
        originalHeight: 100,
        alignment: 'left'
    }, 10, 20, 200, 2);

    assert.deepEqual(left, { x: 72.5, y: 110, width: 40, height: 20 });

    const right = renderer.calculateLayout({
        x: 2,
        row: 3,
        baselineOffset: 1,
        sizeMode: 'height',
        heightInModules: 2,
        originalWidth: 200,
        originalHeight: 100,
        alignment: 'right'
    }, 10, 20, 200, 2);

    assert.deepEqual(right, { x: 65, y: 110, width: 40, height: 20 });
});

test('export recoloring only replaces black and white paint', () => {
    assert.equal(
        renderer.replaceMonochromeColors('fill: #fff; stroke: black; color: #000', '#82A9D9'),
        'fill: #82A9D9; stroke: #82A9D9; color: #000'
    );
    assert.equal(renderer.isMonochromeColor('#ffffff'), true);
    assert.equal(renderer.isMonochromeColor('none'), false);
    assert.equal(renderer.isMonochromeColor('#123456'), false);
});
