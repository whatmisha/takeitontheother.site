import test from 'node:test';
import assert from 'node:assert/strict';
import { effectDefaults, normalizeEffects, normalizeGradientStops, addGradientStop, removeGradientStop, gradientLine } from '../effects.js';
import { ShareCodec } from '../../infra/framework/src/index.js';
import { shareDefaults } from '../document.js';
import { normalize, normalizePreset, makeDocument, readDocument } from '../document.js';
import { drawArtwork } from '../render.js';

test('Solid defaults to lavender without changing the gradient, saved colors or legacy share baseline', async () => {
    assert.equal(normalizeEffects({ backgroundMode: 'solid' }).backgroundStart, '#DAD5F1');
    assert.equal(normalizeEffects({}).backgroundStops[0].color, '#D0D2E4');
    const cached = { seeded: true, createdAt: 1, updatedAt: 1, backgroundStart: '#D0D2E4', backgroundStops: effectDefaults.backgroundStops };
    assert.equal(normalizePreset(cached).backgroundStart, '#DAD5F1');
    const legacy = normalizePreset({ ...cached, backgroundStops: undefined, backgroundMidLow: '#9AA0DC', backgroundMidHigh: '#2348B4', backgroundEnd: '#0E257F' });
    assert.equal(legacy.backgroundStart, '#DAD5F1');
    assert.deepEqual(legacy.backgroundStops, effectDefaults.backgroundStops);
    assert.equal(normalizePreset({ ...cached, updatedAt: 2 }).backgroundStart, '#D0D2E4');
    assert.equal(normalizePreset({ ...cached, seeded: false }).backgroundStart, '#D0D2E4');
    assert.equal(shareDefaults.backgroundStart, '#D0D2E4');
    const scene = normalize({ backgroundMode: 'solid' });
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    assert.deepEqual(normalize((await codec.decode(await codec.encode(scene))).full), scene);
});

test('default shadow matches the reference; legacy colors and explicit effect states survive normalization', () => {
    assert.deepEqual(normalizeEffects({}), effectDefaults);
    assert.deepEqual([effectDefaults.shadowEnabled, effectDefaults.shadowOpacity, effectDefaults.shadowBlur, effectDefaults.shadowColor, effectDefaults.shadowDistance, effectDefaults.shadowAngle], [true, 50, 80, '#000000', 20, 90]);
    assert.equal(normalizeEffects({ shadowEnabled: false }).shadowEnabled, false);
    const cached = { seeded: true, createdAt: 1, updatedAt: 1, shadowEnabled: false, shadowBlur: 18, shadowOpacity: 30 };
    assert.equal(normalizePreset(cached).shadowEnabled, true); assert.equal(normalizePreset(cached).shadowBlur, 80);
    assert.equal(normalizePreset({ ...cached, updatedAt: 2 }).shadowEnabled, false);
    assert.equal(normalizePreset({ ...cached, seeded: false }).shadowBlur, 18);
    assert.equal(normalizePreset({ ...cached, sizeRange: 100 }).sizeRange, 50);
    assert.equal(normalizePreset({ ...cached, sizeRange: 75, updatedAt: 2 }).sizeRange, 75);
    assert.equal(normalizePreset({ ...cached, text: 'WANDER' }).text, 'Wander');
    assert.equal(normalizePreset({ ...cached, text: 'waNDer', updatedAt: 2 }).text, 'waNDer');
    const legacy = normalizeEffects({ ...effectDefaults, backgroundStart: '#111111', backgroundMidLow: '#222222', backgroundMidHigh: '#333333', backgroundEnd: '#444444' });
    assert.deepEqual(legacy.backgroundStops.map(stop => stop.color), ['#111111', '#222222', '#333333', '#444444']);
    assert.deepEqual(gradientLine(3840, 2160, 0), [1920, 2160, 1920, 0]);
    assert.ok(Math.abs(gradientLine(3840, 2160, 90)[2] - 3840) < 1e-8);
    const scene = normalize({ text: '', items: [], shadowEnabled: true, outlineEnabled: true, outlineWidth: 18,
        shadowColor: '#ac2012', backgroundStart: '#112233', backgroundMode: 'solid', backgroundAngle: 180 });
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(scene)))), scene);
    const invalid = normalizeEffects({ shadowOpacity: 1000, shadowBlur: -10, outlineWidth: 'bad', outlineColor: 'url(bad)', backgroundMode: 'bad' });
    assert.equal(invalid.shadowOpacity, 100); assert.equal(invalid.shadowBlur, 0);
    assert.equal('outlineEnabled' in scene, false); assert.equal('outlineWidth' in invalid, false); assert.equal('outlineColor' in invalid, false);
    assert.equal(invalid.backgroundMode, 'gradient');
});

test('gradient colors can be added and removed between two and eight with stable endpoints', async () => {
    let stops = [{ color: '#000000', offset: 0 }, { color: '#ffffff', offset: 1 }];
    const initial = structuredClone(stops);
    assert.equal(removeGradientStop(stops, 0), stops);
    stops = addGradientStop(stops);
    assert.deepEqual(stops[1], { color: '#808080', offset: .5 });
    assert.deepEqual(initial, [{ color: '#000000', offset: 0 }, { color: '#ffffff', offset: 1 }]);
    while (stops.length < 8) stops = addGradientStop(stops);
    assert.equal(addGradientStop(stops), stops);
    assert.ok(stops.every((stop, i) => !i || stop.offset > stops[i - 1].offset));
    const scene = normalize({ text: '', items: [], backgroundStops: stops });
    assert.deepEqual(readDocument(makeDocument(scene)), scene);
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    assert.deepEqual(normalize((await codec.decode(await codec.encode(scene))).full), scene);
    while (stops.length > 2) {
        stops = removeGradientStop(stops, 0);
        assert.equal(stops[0].offset, 0); assert.equal(stops.at(-1).offset, 1);
    }
    assert.equal(stops.length, 2);
    assert.equal(normalizeGradientStops({ backgroundStops: [{ color: 'invalid' }] }).length, 4);
    const oversized = normalizeGradientStops({ backgroundStops: Array.from({ length: 12 }, (_, i) => ({ color: '#abcdef', offset: i / 11 })) });
    assert.equal(oversized.length, 8); assert.equal(oversized.at(-1).offset, 1);
});

test('background modes render without the removed outline effect', () => {
    const calls = [], ctx = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}, translate() {}, rotate() {},
        createLinearGradient(...line) { calls.push(line); return { addColorStop(...stop) { calls.push(stop); } }; },
        getTransform: () => ({ a: .5, b: 0 }), drawImage() { calls.push([this.shadowBlur, this.shadowOffsetX, this.shadowOffsetY]); } };
    const item = { asset: 'test', x: .5, y: .5, rotation: 45 };
    const scene = normalize({ text: '', backgroundMode: 'solid', backgroundStart: '#abcdef', shadowEnabled: false, outlineEnabled: true });
    drawArtwork(ctx, { ...scene, items: [item] }, { get: () => ({}) }, { metrics: { test: { bounds: [0, 0, 10, 10] } }, dimensions: () => ({ width: 10, height: 10 }) });
    assert.equal(ctx.fillStyle, '#abcdef'); assert.equal(calls.length, 1);
    calls.length = 0;
    drawArtwork(ctx, { ...scene, backgroundMode: 'gradient', items: [{ ...item, visible: false }] }, { get: () => { throw new Error('hidden asset rendered'); } }, {});
    assert.equal(calls.length, 5);
});
