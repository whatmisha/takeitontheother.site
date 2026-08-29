import assert from 'node:assert/strict';
import test from 'node:test';

import { computeStripeLayout, stripeArcRadius, stripeBandWidth, stripeEndShorten, stripeOffset } from '../src/geometry/StrokeGeometry.js';
import { ShareCodec } from '../src/preset/ShareCodec.js';
import { MathUtils } from '../src/utils/MathUtils.js';
import { NoiseGenerator } from '../src/utils/NoiseGenerator.js';

test('NoiseGenerator is deterministic for a fixed seed and finite across samples', () => {
    const a = new NoiseGenerator(0.314159);
    const b = new NoiseGenerator(0.314159);
    const samplesA = [a.noise2D(0, 0), a.noise2D(1.5, -3), a.getOffset(20, 30, 0.04, 7)];
    const samplesB = [b.noise2D(0, 0), b.noise2D(1.5, -3), b.getOffset(20, 30, 0.04, 7)];
    assert.deepEqual(samplesA, samplesB);
    assert.ok(samplesA.flatMap(value => typeof value === 'object' ? Object.values(value) : [value]).every(Number.isFinite));
});

test('MathUtils unit conversion and range helpers round-trip', () => {
    const mm = 25.4;
    assert.ok(Math.abs(MathUtils.ptToMm(MathUtils.mmToPt(mm)) - mm) < 1e-9);
    assert.equal(MathUtils.clamp(15, 0, 10), 10);
    assert.equal(MathUtils.snapToGrid(12.4, 5), 10);
    assert.equal(MathUtils.roundTo(1.23456, 3), 1.235);
});

test('StripeGeometry keeps band arithmetic consistent', () => {
    const { gap, strokeWidth } = computeStripeLayout(100, 4, 2);
    assert.ok(Math.abs(stripeBandWidth(4, strokeWidth, gap) - 100) < 1e-9);
    assert.equal(stripeOffset(2, strokeWidth, gap), 2 * (strokeWidth + gap));
    assert.equal(stripeArcRadius(2, 80, strokeWidth, gap), 80 - 2 * (strokeWidth + gap));
    assert.equal(stripeEndShorten(8, true, false, true), 4);
    assert.equal(stripeEndShorten(8, false, false, true), 0);
});

test('ShareCodec encodes a compact diff and restores defaults', async () => {
    const codec = new ShareCodec({
        pristineDefaults: { width: 100, color: '#000000', points: [] },
        extraKeys: ['points'],
        quantizableFloatKeys: ['width'],
        decimals: 2
    });
    const encoded = await codec.encode({ width: 123.456, color: '#000000', points: [{ x: 1, y: 2 }] });
    assert.ok(encoded.startsWith('v1.'));
    const decoded = await codec.decode(encoded);
    assert.deepEqual(decoded.full, { width: 123.456, color: '#000000', points: [{ x: 1, y: 2 }] });
    assert.equal(codec.parsePayloadFromHash(`#p=${encoded}`), encoded);
    assert.equal(ShareCodec.slugify('Basic Wild!'), 'basic-wild');
});
