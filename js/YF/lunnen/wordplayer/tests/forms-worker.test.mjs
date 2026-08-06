import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const workerSource = await fs.readFile(
    new URL('../src/workers/forms.worker.js', import.meta.url),
    'utf8'
);
const workerSelf = {};
vm.runInContext(workerSource, vm.createContext({
    self: workerSelf,
    console,
    setTimeout,
    clearTimeout
}));

const maskWidth = 48;
const maskHeight = 48;

function makeMask() {
    const inside = new Uint8Array(maskWidth * maskHeight);
    for (let y = 10; y <= 37; y++) {
        for (let x = 14; x <= 33; x++) inside[y * maskWidth + x] = 1;
    }
    return inside;
}

function isInsideForm(x, y, inside) {
    const maskX = Math.max(0, Math.min(maskWidth - 1, Math.round(x / 120 * (maskWidth - 1))));
    const maskY = Math.max(0, Math.min(maskHeight - 1, Math.round(y / 120 * (maskHeight - 1))));
    return inside[maskY * maskWidth + maskX] === 1;
}

function compute(id, formInsideOut) {
    const inside = makeMask();
    const settings = {
        width: 120,
        height: 120,
        resolution: 16,
        density: 0,
        weightMin: 100,
        weightMax: 500,
        sizeMin: 36,
        sizeMax: 72,
        rotationMin: 0,
        rotationMax: 0,
        noiseMin: 0,
        noiseMax: 0,
        sizeEnabled: false,
        weightEnabled: false,
        rotationEnabled: false,
        noiseEnabled: false,
        hideTinyLetters: false,
        invertDither: false,
        formEdgeSpread: 15,
        formAttraction: 0,
        formStickiness: 0,
        formFriction: 0,
        formLetterSpacing: 0,
        formSettlingTime: 12,
        formGravity: 0,
        formGravityDirection: 0,
        formCanvasEdges: true,
        formInsideOut
    };
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Forms worker timed out')), 5000);
        workerSelf.postMessage = (message) => {
            clearTimeout(timeout);
            resolve({ message, inside });
        };
        workerSelf.onmessage({
            data: {
                type: 'compute',
                id,
                key: `test-${id}-${formInsideOut}`,
                maskKey: `mask-${id}`,
                maskSource: { width: maskWidth, height: maskHeight, inside: inside.buffer },
                settings,
                chars: ['A'],
                fontMetrics: { 'A|500': [0.25, 0.45, 0.25] }
            }
        });
    });
}

function positions(result) {
    const values = new Float32Array(result.message.values);
    return result.message.chars.map((_, index) => ({
        x: values[index * 4],
        y: values[index * 4 + 1]
    }));
}

const normal = await compute(1, false);
const normalPositions = positions(normal);
const normalInside = normalPositions.filter(({ x, y }) => isInsideForm(x, y, normal.inside)).length;
assert.ok(normalPositions.length > 0, 'normal mode should create glyphs');
assert.ok(normalInside / normalPositions.length > 0.8, 'normal mode should fill the form interior');

const inverted = await compute(2, true);
const invertedPositions = positions(inverted);
const invertedInside = invertedPositions.filter(({ x, y }) => isInsideForm(x, y, inverted.inside)).length;
assert.ok(invertedPositions.length > normalPositions.length, 'inside-out should use the remaining canvas area');
assert.equal(invertedInside, 0, 'inside-out glyph anchors should stay outside the form');

console.log(`forms-worker: inside=${normalPositions.length}, outside=${invertedPositions.length}`);
