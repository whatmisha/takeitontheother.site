import assert from 'node:assert/strict';
import test from 'node:test';

import { ExportGuard } from '../src/export/ExportGuard.js';
import { SVGExporter, svgDocumentString } from '../src/export/SVGExporter.js';
import { computeStripeLayout, stripeArcRadius, stripeBandWidth, stripeEndShorten, stripeOffset } from '../src/geometry/StrokeGeometry.js';
import { ShareCodec } from '../src/preset/ShareCodec.js';
import { MathUtils } from '../src/utils/MathUtils.js';
import { NoiseGenerator } from '../src/utils/NoiseGenerator.js';
import { SeededRandom } from '../src/utils/SeededRandom.js';

test('NoiseGenerator is deterministic for a fixed seed and finite across samples', () => {
    const a = new NoiseGenerator(0.314159);
    const b = new NoiseGenerator(0.314159);
    const samplesA = [a.noise2D(0, 0), a.noise2D(1.5, -3), a.getOffset(20, 30, 0.04, 7)];
    const samplesB = [b.noise2D(0, 0), b.noise2D(1.5, -3), b.getOffset(20, 30, 0.04, 7)];
    assert.deepEqual(samplesA, samplesB);
    assert.ok(samplesA.flatMap(value => typeof value === 'object' ? Object.values(value) : [value]).every(Number.isFinite));
});

test('SeededRandom provides reproducible streams, ranges and serialisable state', () => {
    const first = new SeededRandom('demo-seed');
    const second = new SeededRandom('demo-seed');
    assert.deepEqual(
        [first.next(), first.float(-2, 2), first.int(3, 9), first.bool(0.75)],
        [second.next(), second.float(-2, 2), second.int(3, 9), second.bool(0.75)]
    );
    const state = first.getState();
    const clone = first.clone();
    assert.equal(clone.getState(), state);
    assert.equal(clone.next(), first.next());
    assert.deepEqual(first.fork('detail').next(), new SeededRandom('demo-seed:detail').next());
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

test('svgDocumentString creates a standalone ASCII-safe XML document', () => {
    const document = svgDocumentString('<svg><text>Привет 👋</text></svg>');
    assert.ok(document.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg>'));
    assert.match(document, /&#x41F;&#x440;/);
    assert.match(document, /&#x1F44B;/);
    assert.ok(!document.includes('Привет'));
});

test('SVGExporter registers editable PDF fonts and preserves variable data on request', () => {
    const calls = [];
    const metadata = { subset: {}, rawData: new Uint8Array([1, 2, 3]) };
    const pdf = {
        addFileToVFS: (...args) => calls.push(['vfs', ...args]),
        addFont: (...args) => calls.push(['font', ...args]),
        setFont: (...args) => calls.push(['set', ...args]),
        getFont: () => ({ metadata })
    };
    new SVGExporter()._registerPDFFonts(pdf, [{
        fileName: 'Variable.ttf', family: 'Variable', weight: 500,
        data: new Uint8Array([0, 255]), preserveVariations: true
    }]);
    assert.deepEqual(calls[0], ['vfs', 'Variable.ttf', 'AP8=']);
    assert.deepEqual(calls[1], ['font', 'Variable.ttf', 'Variable', 'normal', 500]);
    assert.deepEqual(metadata.subset.encode(), [1, 2, 3]);
});

test('ExportGuard restores state changed by export preparation or rendering', async () => {
    let state = { seed: 7, cache: ['preview'] };
    const phases = [];
    const guard = new ExportGuard({
        capture: () => state,
        prepare: ({ format }) => { phases.push(`prepare:${format}`); state.seed = 99; },
        restore: (snapshot, { format }) => { phases.push(`restore:${format}`); state = snapshot; }
    });
    const result = await guard.run('svg', () => {
        phases.push('export');
        state.cache.push('rerolled');
        return 'done';
    });
    assert.equal(result, 'done');
    assert.deepEqual(state, { seed: 7, cache: ['preview'] });
    assert.deepEqual(phases, ['prepare:svg', 'export', 'restore:svg']);
});
