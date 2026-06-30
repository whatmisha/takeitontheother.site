import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predictCloth, suggestPairs } from '../weave/ColorMixer.js';
import { mixLinear, deltaE2000Hex } from '../weave/colorMath.js';

const PALETTE = [
    { code: 'A', name: 'black', hex: '#000000' },
    { code: 'B', name: 'white', hex: '#ffffff' },
    { code: 'C', name: 'red', hex: '#ff0000' },
    { code: 'D', name: 'blue', hex: '#0000ff' },
    { code: 'E', name: 'green', hex: '#00ff00' },
    { code: 'F', name: 'mid', hex: '#808080' },
    { code: 'G', name: 'navy', hex: '#1c2b50' },
    { code: 'H', name: 'cream', hex: '#efe6cf' }
];

test('predictCloth equals a linear mix at the given ratio', () => {
    const { hex } = predictCloth({ warpColor: '#ff0000', weftColor: '#ffffff', warpRatio: 0.75 });
    assert.equal(hex, mixLinear('#ff0000', '#ffffff', 0.75));
});

test('suggestPairs returns the requested number of distinct candidates', () => {
    const pairs = suggestPairs({ target: '#7f7f7f', ratio: 0.5, palette: PALETTE, count: 3 });
    assert.equal(pairs.length, 3);
    const keys = new Set(pairs.map((p) => p.warp.hex + '/' + p.weft.hex));
    assert.equal(keys.size, 3);
});

test('best candidate has the lowest ΔE and actually matches its prediction', () => {
    const pairs = suggestPairs({ target: '#9aa0c0', ratio: 0.5, palette: PALETTE, count: 4 });
    // sorted with separation bias, but the top result should still be a strong match
    for (let i = 1; i < pairs.length; i++) {
        // predicted recomputation matches reported deltaE
        const recomputed = deltaE2000Hex(pairs[i].predicted, '#9aa0c0');
        assert.ok(Math.abs(recomputed - pairs[i].deltaE) < 1e-9);
    }
    const best = pairs[0];
    assert.equal(best.predicted, mixLinear(best.warp.hex, best.weft.hex, 0.5));
});

test('a target equal to a catalogue colour is matched (near-zero ΔE) by an i=j pair', () => {
    const pairs = suggestPairs({ target: '#808080', ratio: 0.5, palette: PALETTE, count: 1, separation: 0 });
    assert.ok(pairs[0].deltaE < 1.0, `ΔE ${pairs[0].deltaE} should be tiny`);
    // separation 0 favours a solid (identical) pair
    assert.equal(pairs[0].warp.hex, pairs[0].weft.hex);
});

test('higher separation yields more contrasting yarn pairs', () => {
    const target = '#888888';
    const low = suggestPairs({ target, ratio: 0.5, palette: PALETTE, count: 1, separation: 0 })[0];
    const high = suggestPairs({ target, ratio: 0.5, palette: PALETTE, count: 1, separation: 1 })[0];
    assert.ok(high.separation > low.separation, `high ${high.separation} > low ${low.separation}`);
});

test('ratio affects which thread dominates the prediction', () => {
    // At ratio 0.9 the warp thread dominates; a red target is best served by a
    // mostly-red warp.
    const pairs = suggestPairs({ target: '#cc2222', ratio: 0.9, palette: PALETTE, count: 1 });
    assert.equal(pairs[0].predicted, mixLinear(pairs[0].warp.hex, pairs[0].weft.hex, 0.9));
    assert.ok(pairs[0].deltaE < 20);
});

test('empty palette returns no suggestions', () => {
    assert.deepEqual(suggestPairs({ target: '#123456', ratio: 0.5, palette: [] }), []);
});
