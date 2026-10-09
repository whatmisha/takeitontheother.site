import test from 'node:test';
import assert from 'node:assert/strict';
import { effectDefaults, normalizeEffects, gradientLine } from '../effects.js';
import { normalize, makeDocument, readDocument } from '../document.js';
import { drawArtwork } from '../render.js';

test('legacy documents retain the reference gradient and disabled effects', () => {
    assert.deepEqual(normalizeEffects({}), effectDefaults);
    assert.deepEqual(gradientLine(3840, 2160, 0), [1920, 2160, 1920, 0]);
    assert.ok(Math.abs(gradientLine(3840, 2160, 90)[2] - 3840) < 1e-8);
    const scene = normalize({ text: '', items: [], shadowEnabled: true, outlineEnabled: true, outlineWidth: 18,
        shadowColor: '#ac2012', backgroundStart: '#112233', backgroundMode: 'solid', backgroundAngle: 180 });
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(scene)))), scene);
    const invalid = normalizeEffects({ shadowOpacity: 1000, shadowBlur: -10, outlineWidth: 'bad', outlineColor: 'url(bad)', backgroundMode: 'bad' });
    assert.equal(invalid.shadowOpacity, 100); assert.equal(invalid.shadowBlur, 0);
    assert.equal(invalid.outlineWidth, effectDefaults.outlineWidth); assert.equal(invalid.outlineColor, effectDefaults.outlineColor);
    assert.equal(invalid.backgroundMode, 'gradient');
});

test('background modes and shadow dimensions are consistent at preview and export scales', () => {
    const calls = [], ctx = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}, translate() {}, rotate() {},
        createLinearGradient(...line) { calls.push(line); return { addColorStop(...stop) { calls.push(stop); } }; },
        getTransform: () => ({ a: .5, b: 0 }), drawImage() { calls.push([this.shadowBlur, this.shadowOffsetX, this.shadowOffsetY]); } };
    const item = { asset: 'test', x: .5, y: .5, rotation: 45 };
    const scene = normalize({ text: '', backgroundMode: 'solid', backgroundStart: '#abcdef', shadowEnabled: true, shadowBlur: 20, shadowDistance: 10 });
    drawArtwork(ctx, { ...scene, items: [item] }, { get: () => ({}) }, { metrics: { test: { bounds: [0, 0, 10, 10] } }, dimensions: () => ({ width: 10, height: 10 }) });
    assert.equal(ctx.fillStyle, '#abcdef'); assert.equal(calls.length, 1); assert.equal(calls[0][0], 10); assert.equal(calls[0][2], 5);
    calls.length = 0;
    drawArtwork(ctx, { ...scene, backgroundMode: 'gradient', items: [{ ...item, visible: false }] }, { get: () => { throw new Error('hidden asset rendered'); } }, {});
    assert.equal(calls.length, 5);
});
