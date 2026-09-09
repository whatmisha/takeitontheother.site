import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CLASSIC_LORENZ, integrateLorenz, lorenzDerivative, rk4Step } from '../lorenz/src/lorenz.js';
import { projectTrajectory } from '../lorenz/src/projection.js';
import { preparePixelPositions, renderLorenzSvg } from '../lorenz/src/renderer.js';

const defaults = {
    ...CLASSIC_LORENZ,
    dt: 0.005,
    pointCount: 4000,
    warmupSteps: 1000,
    sampleStride: 1,
    rotationX: -8,
    rotationY: 15,
    rotationZ: 0,
    perspective: 34,
    viewScale: 1,
    pixelWidth: 2,
    pixelHeight: 2,
    gridStep: 2,
    opacity: 90,
    pixelColor: '#ffffff',
    backgroundColor: '#000000',
    showAxes: false
};

test('Lorenz derivative matches the canonical equations', () => {
    assert.deepEqual(lorenzDerivative(1, 2, 3, 10, 28, 8 / 3), [10, 23, -6]);
});

test('the non-zero equilibria have zero derivative', () => {
    const x = Math.sqrt((8 / 3) * (28 - 1));
    const derivative = lorenzDerivative(x, x, 27, 10, 28, 8 / 3);
    derivative.forEach((value) => assert.ok(Math.abs(value) < 1e-12));
});

test('RK4 converges when a step is split in two', () => {
    const one = rk4Step(0, 1, 1.05, 0.01, 10, 28, 8 / 3);
    const half = rk4Step(0, 1, 1.05, 0.005, 10, 28, 8 / 3);
    const two = rk4Step(...half, 0.005, 10, 28, 8 / 3);
    one.forEach((value, index) => assert.ok(Math.abs(value - two[index]) < 2e-6));
});

test('classic integration is deterministic, bounded, and fills both lobes', () => {
    const first = integrateLorenz(defaults);
    const second = integrateLorenz(defaults);
    assert.equal(first.diverged, false);
    assert.equal(first.pointCount, defaults.pointCount);
    assert.deepEqual(first.points, second.points);
    assert.ok(first.bounds.minX < -10);
    assert.ok(first.bounds.maxX > 10);
    assert.ok(first.bounds.maxZ > 35);
});

test('projection fits the requested artboard', () => {
    const trajectory = integrateLorenz(defaults);
    const projected = projectTrajectory(trajectory, defaults, 960, 960);
    for (let offset = 0; offset < projected.points.length; offset += 3) {
        assert.ok(projected.points[offset] >= 0 && projected.points[offset] <= 960);
        assert.ok(projected.points[offset + 1] >= 0 && projected.points[offset + 1] <= 960);
    }
});

test('raster snapping keeps only the foremost sample in each cell', () => {
    const projected = {
        points: new Float32Array([1.1, 1.1, -1, 1.4, 1.4, 2, 5, 5, 0])
    };
    const pixels = preparePixelPositions(projected, { gridStep: 2 });
    assert.equal(pixels.pixelCount, 2);
    assert.deepEqual([...pixels.points], [6, 6, 0, 2, 2, 2]);
});

test('SVG export uses one compact path for all vector pixels', () => {
    const trajectory = integrateLorenz({ ...defaults, pointCount: 500 });
    const svg = renderLorenzSvg(960, 960, defaults, trajectory);
    assert.match(svg, /<rect[^>]+fill="#000000"/);
    assert.match(svg, /<path d="M/);
    assert.equal((svg.match(/<circle/g) || []).length, 0);
    assert.equal((svg.match(/<path /g) || []).length, 1);
});

test('Lorenz is a standalone tool with no YF Tools navigation button', () => {
    const html = readFileSync(new URL('../lorenz/index.html', import.meta.url), 'utf8');
    assert.doesNotMatch(html, /YF Tools|Othersite UI|href="\.\.\/"/);
    assert.match(html, /name="artboardFormat" value="square"/);
    assert.match(html, /id="gridStepSlider"/);
    assert.match(html, /id="unifiedColorPickerContainer"/);
});

test('all registered Lorenz controls exist in the standalone document', () => {
    const html = readFileSync(new URL('../lorenz/index.html', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../lorenz/tool.js', import.meta.url), 'utf8');
    const ids = [...source.matchAll(/(?:id|valueId|containerId|itemId|dotId|hexId|hsbSlotId|headerId): '([^']+)'/g)]
        .map((match) => match[1]);
    ids.forEach((id) => assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`));
});
