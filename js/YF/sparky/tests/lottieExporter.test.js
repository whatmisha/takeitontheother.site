import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { createLottieAnimation, sampleLottieFrames } from '../src/export/lottieExporter.js';
import { roundedPolygonToLottie, eyeCurveToLottie, packLottieShape } from '../src/export/lottieGeometry.js';
import { createLottieProperty, simplifyKeyframes } from '../src/export/lottieKeyframes.js';
import { buildCharacterGeometry } from '../src/geometry/characterGeometry.js';
import { createClosedCurvePath } from '../src/geometry/eyeGeometry.js';
import { parseSvgPathData, importSvgPathData } from '../src/animation/svgPathImporter.js';
import { serializeFocusPath } from '../src/animation/focusPath.js';

const basic = JSON.parse(readFileSync(new URL('../presets/basic.json', import.meta.url)));
const settings = { ...basic, focusMode: 'animate', motionDuration: 1, motionPointCount: 6,
    motionComplexity: 30, motionSmoothness: 50, motionStopCount: 3, motionSpeedVariation: 40,
    motionBlinkCount: 2, motionEmotionVariation: 70, motionSeed: 24062026,
    bolidTargetAngle: 180, bolidTargetDistance: 40, bolidIntensity: 100, bolidColorTrail: 0 };
const startFocus = { x: 240, y: 240 };

function inspectProperties(object, visit) {
    if (!object || typeof object !== 'object') return;
    if ('a' in object && 'k' in object) visit(object);
    for (const value of Object.values(object)) inspectProperties(value, visit);
}

test('Lottie geometry retains one topology through sharp, circular and smoothed corners', () => {
    for (const rayCount of [3, 5, 13]) {
        let vertexCount;
        for (const roundness of [0, 0.001, 60, 100]) for (const cornerSmoothing of [0, 50, 100]) {
            const geometry = buildCharacterGeometry({ ...basic, rayCount, roundness, cornerSmoothing, focusX: 400, focusY: 160 });
            const shape = roundedPolygonToLottie(geometry.rounded);
            vertexCount ??= shape.v.length;
            assert.equal(shape.v.length, vertexCount);
            assert.equal(shape.i.length, vertexCount);
            assert.equal(shape.o.length, vertexCount);
            assert.ok(packLottieShape(shape).every(Number.isFinite));
            geometry.rounded.corners.forEach((corner, index) => {
                assert.deepEqual(shape.v[index * 4], [corner.start.x, corner.start.y]);
                assert.deepEqual(shape.v[index * 4 + 3], [corner.end.x, corner.end.y]);
                if (corner.transition) {
                    const point = shape.v[index * 4];
                    const tangent = shape.o[index * 4];
                    assert.ok(Math.abs(point[0] + tangent[0] - corner.transition.incoming.lineControl.x) < 1e-8);
                }
            });
        }
    }
});

test('Lottie eye tangents reproduce the existing SVG cubic curves', () => {
    const frame = sampleLottieFrames({ settings, startFocus }).next().value;
    const points = frame.scene.eyes.left.eye1.points;
    const shape = eyeCurveToLottie(points);
    const svg = parseSvgPathData(createClosedCurvePath(points));
    svg.segments.forEach((segment, index) => {
        const next = (index + 1) % shape.v.length;
        for (let axis = 0; axis < 2; axis += 1) {
            const key = axis === 0 ? 'x' : 'y';
            assert.ok(Math.abs(shape.v[index][axis] + shape.o[index][axis] - segment.control1[key]) < 0.0001);
            assert.ok(Math.abs(shape.v[next][axis] + shape.i[next][axis] - segment.control2[key]) < 0.0001);
        }
    });
});

test('keyframe reduction stays within its declared error and closes the loop', () => {
    const values = Array.from({ length: 120 }, (_, frame) => [Math.sin(frame / 120 * Math.PI * 2), frame < 60 ? 0 : 1]);
    const tolerance = 0.015;
    const property = createLottieProperty(values, { tolerance });
    assert.equal(property.a, 1);
    assert.ok(property.k.length < 40);
    assert.equal(property.k.at(-1).t, values.length);
    assert.deepEqual(property.k.at(-1).s, property.k[0].s);
    const rounded = values.map((sample) => sample.map((v) => Math.round(v * 1000) / 1000));
    rounded.push(rounded[0]);
    const indices = simplifyKeyframes(rounded, tolerance);
    for (let segment = 0; segment < indices.length - 1; segment += 1) {
        const a = indices[segment], b = indices[segment + 1];
        for (let t = a; t <= b; t += 1) for (let axis = 0; axis < 2; axis += 1) {
            const estimated = rounded[a][axis] + (rounded[b][axis] - rounded[a][axis]) * (t - a) / (b - a);
            assert.ok(Math.abs(estimated - rounded[t][axis]) <= tolerance + 1e-9);
        }
    }
    assert.deepEqual(createLottieProperty([[100], [100]], { decode: (v) => v[0] }), { a: 0, k: 100 });
    assert.throws(() => createLottieProperty([[NaN]]), /invalid coordinate/);
    assert.throws(() => simplifyKeyframes([[0], [0, 1]]), /topology/);
});

for (const mode of ['animate', 'bolid']) test(`Lottie ${mode} exports animated vectors, masks and a seamless endpoint without raster assets`, () => {
    const input = { ...settings, focusMode: mode, bolidColorTrail: 100, motionBlur: 100 };
    const snapshot = JSON.stringify(input);
    const progress = [];
    const animation = createLottieAnimation({ settings: input, startFocus, onProgress: (value) => progress.push(value) });
    const json = JSON.stringify(animation);
    assert.equal(JSON.stringify(input), snapshot);
    assert.equal(animation.op, 60);
    assert.equal(animation.fr, 60);
    assert.equal(animation.w, 1080);
    assert.deepEqual(animation.assets, []);
    assert.equal(animation.layers.length, mode === 'bolid' ? 8 : 2);
    assert.ok(animation.layers.every((layer) => layer.ty === 4));
    assert.equal(animation.layers[0].masksProperties[0].mode, 'a');
    assert.ok(!json.includes('data:image'));
    assert.deepEqual([progress[0], progress.at(-1)], [0, 60]);
    let animatedShapes = 0;
    inspectProperties(animation, (property) => {
        if (property.a !== 1) return;
        assert.deepEqual(property.k[0].s, property.k.at(-1).s);
        assert.equal(property.k.at(-1).t, animation.op);
        if (property.k[0].s[0]?.v) {
            animatedShapes += 1;
            const count = property.k[0].s[0].v.length;
            for (const key of property.k) assert.equal(key.s[0].v.length, count);
        }
    });
    assert.ok(animatedShapes >= 3);
});

test('Lottie uses the authored SVG path and leaves its source intact', () => {
    const imported = importSvgPathData('M 10 10 L 90 10 L 60 80 Z', { startFocus, center: startFocus, radius: 180 });
    const motionPath = serializeFocusPath(imported);
    const snapshot = JSON.stringify(motionPath);
    const standard = sampleLottieFrames({ settings, startFocus }).next().value;
    const authored = sampleLottieFrames({ settings, startFocus, motionPath }).next().value;
    assert.notDeepEqual(authored.focus, standard.focus);
    assert.equal(JSON.stringify(motionPath), snapshot);
});

test('Lottie validates the animation mode and duration', () => {
    assert.throws(() => createLottieAnimation({ settings: { ...settings, focusMode: 'manual' }, startFocus }), /Path or Bolid/);
    assert.throws(() => createLottieAnimation({ settings: { ...settings, motionDuration: NaN }, startFocus }), /duration/);
});


test('the real export worker produces Lottie without Canvas or WebCodecs', async () => {
    const worker = new Worker(`
        const { parentPort, workerData } = require('node:worker_threads');
        globalThis.OffscreenCanvas = undefined;
        globalThis.Path2D = undefined;
        globalThis.VideoEncoder = undefined;
        globalThis.self = {
            postMessage(message, transfer) { parentPort.postMessage(message, transfer); },
            addEventListener(type, callback) {
                parentPort.on('message', data => callback({ data }));
                parentPort.postMessage({ type: 'ready' });
            }
        };
        import(workerData.url).catch(error => { throw error; });
    `, { eval: true, workerData: { url: new URL('../src/export/animationExportWorker.js', import.meta.url).href } });
    try {
        const result = await new Promise((resolve, reject) => {
            worker.on('error', reject);
            worker.on('message', (message) => {
                if (message.type === 'ready') worker.postMessage({
                    type: 'export', jobId: 'lottie-test', format: 'lottie', settings,
                    startFocus, baseName: 'sparky-test'
                });
                if (message.type === 'error') reject(new Error(message.message));
                if (message.type === 'complete') resolve(message);
            });
        });
        assert.equal(result.jobId, 'lottie-test');
        assert.equal(result.filename, 'sparky-test-lottie.json');
        assert.equal(result.blob.type, 'application/json');
        const animation = JSON.parse(await result.blob.text());
        assert.equal(animation.op, 60);
        assert.equal(animation.layers.length, 2);
    } finally { await worker.terminate(); }
});
