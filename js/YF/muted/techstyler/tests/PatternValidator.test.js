import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSpec, analyze, isInterlaced } from '../weave/PatternValidator.js';
import { generate, generatePlain, generateTwill } from '../weave/PatternGenerator.js';
import { Family } from '../weave/PatternSpec.js';

test('validateSpec accepts a coprime satin', () => {
    const r = validateSpec({ family: Family.SATIN, n: 5, satinStep: 2 });
    assert.equal(r.ok, true);
    assert.equal(r.errors.length, 0);
});

test('validateSpec warns on degenerate satin step', () => {
    const r = validateSpec({ family: Family.SATIN, n: 5, satinStep: 1 });
    assert.ok(r.warnings.some((w) => /degenerate|twill/i.test(w)));
});

test('analyze counts a plain weave as fully interlaced and balanced', () => {
    const a = analyze(generatePlain({ rows: 2, cols: 2, phase: 0 }));
    assert.equal(a.warpRatio, 0.5);
    assert.equal(a.maxWarpFloat, 1);
    assert.equal(a.maxWeftFloat, 1);
    assert.equal(a.interlaced, true);
    assert.deepEqual(a.looseWarps, []);
});

test('analyze finds float length of a twill', () => {
    // 3/1 twill: warp floats of 3, weft floats of 1.
    const a = analyze(generateTwill({ over: 3, under: 1, step: 1, direction: 1 }));
    assert.equal(a.maxWarpFloat, 3);
    assert.equal(a.maxWeftFloat, 1);
    assert.equal(a.interlaced, true);
});

test('analyze detects loose (unbound) threads', () => {
    // A column of all 1s = warp never caught by weft.
    const m = [
        [1, 0],
        [1, 1]
    ];
    const a = analyze(m);
    assert.equal(a.interlaced, false);
    assert.deepEqual(a.looseWarps, [0]);
});

test('isInterlaced convenience matches analyze', () => {
    const m = generate({ family: Family.SATIN, n: 5, satinStep: 2 });
    assert.equal(isInterlaced(m), analyze(m).interlaced);
});

test('satin float length grows with n', () => {
    const a5 = analyze(generate({ family: Family.SATIN, n: 5, satinStep: 2 }));
    const a8 = analyze(generate({ family: Family.SATIN, n: 8, satinStep: 3 }));
    assert.ok(a8.maxWarpFloat > a5.maxWarpFloat);
});
