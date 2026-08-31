import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';

class TestImageData {
    constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
    }
}

const originalImageData = globalThis.ImageData;
globalThis.ImageData = TestImageData;

const sourceUrl = new URL('../dither.js', import.meta.url);
const browserSource = await readFile(sourceUrl, 'utf8');
const lifecycleMarker = '// Initialize the tool when the page loads';
const markerIndex = browserSource.indexOf(lifecycleMarker);
assert.notEqual(markerIndex, -1, 'Dither lifecycle marker must remain available to the test loader');

const moduleSource = `${browserSource.slice(0, markerIndex)}export { DitheringTool };\n`;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`;
const { DitheringTool } = await import(moduleUrl);

after(() => {
    if (originalImageData === undefined) {
        delete globalThis.ImageData;
    } else {
        globalThis.ImageData = originalImageData;
    }
});

function pixels(values, width, height) {
    return new TestImageData(new Uint8ClampedArray(values), width, height);
}

function createTool(overrides = {}) {
    const tool = Object.create(DitheringTool.prototype);
    tool.settings = {
        backgroundColor: '#000000',
        threshold: 128,
        pixelSize: 1,
        pattern: 'floyd-steinberg',
        invertImage: false,
        grain: 0,
        gamma: 1,
        blackPoint: 0,
        whitePoint: 255,
        ...overrides
    };
    return tool;
}

test('Bayer matrix and custom background retain their exact 2x2 result', () => {
    const tool = createTool({ pattern: 'bayer', backgroundColor: '#102030' });
    const input = pixels([
        0, 0, 0, 255,       64, 64, 64, 255,
        128, 128, 128, 255, 255, 255, 255, 255
    ], 2, 2);

    const result = tool.applyDithering(input);

    assert.deepEqual([...result.data], [
        16, 32, 48, 255, 16, 32, 48, 255,
        16, 32, 48, 255, 255, 255, 255, 255
    ]);
});

test('Floyd-Steinberg error diffusion retains the legacy threshold behavior', () => {
    const tool = createTool();
    const input = pixels([
        64, 64, 64, 255,
        128, 128, 128, 255,
        192, 192, 192, 255
    ], 3, 1);

    const result = tool.applyDithering(input);

    assert.deepEqual([...result.data], [
        0, 0, 0, 255,
        255, 255, 255, 255,
        255, 255, 255, 255
    ]);
});

test('pixel-size mode samples the top-left pixel and expands nearest-neighbor blocks', () => {
    const tool = createTool({ pattern: 'bayer', pixelSize: 2 });
    const input = pixels([
        0, 0, 0, 255,       40, 40, 40, 255,     200, 200, 200, 255, 80, 80, 80, 255,
        20, 20, 20, 255,    60, 60, 60, 255,     220, 220, 220, 255, 100, 100, 100, 255
    ], 4, 2);

    const result = tool.applyDithering(input);

    assert.equal(result.width, 4);
    assert.equal(result.height, 2);
    assert.deepEqual([...result.data], [
        0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255
    ]);
});

test('preprocessing preserves alpha while applying invert and gamma', () => {
    const tool = createTool({ invertImage: true, gamma: 2 });
    const input = pixels([64, 128, 192, 77], 1, 1);

    const result = tool.applyPreprocessing(input);

    assert.deepEqual([...result.data], [221, 180, 127, 77]);
});

test('random dither stays testable with a fixed random stream', () => {
    const tool = createTool({ pattern: 'random' });
    const input = pixels([
        50, 50, 50, 255,
        200, 200, 200, 255
    ], 2, 1);
    const originalRandom = Math.random;
    const values = [0.1, 0.9];
    Math.random = () => values.shift();

    try {
        const result = tool.applyDithering(input);
        assert.deepEqual([...result.data], [
            255, 255, 255, 255,
            0, 0, 0, 255
        ]);
    } finally {
        Math.random = originalRandom;
    }
});
