import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

const workerSource = await fs.readFile(
    new URL('../src/workers/dither.worker.js', import.meta.url),
    'utf8'
);
const workerSelf = {};
vm.runInContext(workerSource, vm.createContext({ self: workerSelf, console }));

const settings = {
    width: 430,
    height: 574,
    resolution: 180,
    density: 0,
    ditherAlgorithm: 'floyd',
    contrast: 2,
    blackPoint: 40,
    whitePoint: 200,
    invertDither: false,
    sizeMin: 36,
    sizeMax: 96,
    weightMin: 100,
    weightMax: 500,
    rotationMin: -15,
    rotationMax: 15,
    noiseMin: 0,
    noiseMax: 20,
    sizeEnabled: true,
    weightEnabled: true,
    rotationEnabled: true,
    noiseEnabled: true,
    hideTinyLetters: true
};

function compute(id, overrides = {}, sampleSource = null) {
    let result = null;
    workerSelf.postMessage = (message) => { result = message; };
    workerSelf.onmessage({
        data: {
            type: 'compute',
            id,
            key: `dither-${id}`,
            sampleKey: sampleSource ? 'sample-image' : 'gradient',
            sampleSource,
            settings: { ...settings, ...overrides },
            chars: ['W', 'O', 'R', 'D']
        }
    });
    assert.ok(result, 'worker should return a result synchronously');
    assert.equal(result.type, 'result');
    return result;
}

const startedAt = performance.now();
const floyd = compute(1);
assert.ok(floyd.chars.length > 10_000, 'high-resolution Floyd output should contain glyphs');
assert.equal(new Uint16Array(floyd.weights).length, floyd.chars.length);
assert.equal(new Float32Array(floyd.values).length, floyd.chars.length * 4);

const cols = settings.resolution;
const rows = Math.round(cols * settings.height / settings.width);
const pixels = new Uint8ClampedArray(cols * rows * 4);
for (let index = 0; index < pixels.length; index += 4) {
    const value = Math.round((index / 4 % cols) / Math.max(1, cols - 1) * 255);
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = 255;
}
const bayer = compute(2, { ditherAlgorithm: 'bayer' }, {
    width: cols,
    height: rows,
    pixels: pixels.buffer
});
assert.ok(bayer.chars.length > 10_000, 'high-resolution Bayer output should contain glyphs');
assert.ok([...new Float32Array(bayer.values).subarray(0, 200)].every(Number.isFinite));

const duration = performance.now() - startedAt;
assert.ok(duration < 3000, `high-resolution dither took too long: ${duration.toFixed(1)}ms`);
console.log(`dither-worker: floyd=${floyd.chars.length}, bayer=${bayer.chars.length}, ${duration.toFixed(1)}ms`);
