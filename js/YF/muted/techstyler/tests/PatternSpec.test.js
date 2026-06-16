import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    Family, Faced, defaultSpec, normalizeSpec, repairSatinStep, repeatSize, describeSpec
} from '../weave/PatternSpec.js';
import { areCoprime } from '../weave/mathUtils.js';

test('defaultSpec returns the requested family', () => {
    assert.equal(defaultSpec(Family.TWILL).family, Family.TWILL);
    assert.equal(defaultSpec().family, Family.PLAIN);
});

test('normalizeSpec clamps out-of-range values', () => {
    const s = normalizeSpec({ family: Family.BASKET, warpGroup: 999, weftGroup: -5, phase: -3 });
    assert.equal(s.warpGroup, 12);
    assert.equal(s.weftGroup, 1);
    assert.equal(s.phase, 0);
});

test('normalizeSpec falls back to plain on unknown family', () => {
    assert.equal(normalizeSpec({ family: 'jacquard' }).family, Family.PLAIN);
});

test('normalizeSpec repairs satin step to a coprime value', () => {
    const s = normalizeSpec({ family: Family.SATIN, n: 6, satinStep: 3 });
    assert.ok(areCoprime(s.satinStep, s.n));
});

test('repairSatinStep keeps step within [1, n-1] and coprime', () => {
    for (let n = 4; n <= 12; n++) {
        for (let step = 1; step <= 20; step++) {
            const r = repairSatinStep(step, n);
            assert.ok(r >= 1 && r <= n - 1, `step ${r} out of range for n ${n}`);
            assert.ok(areCoprime(r, n), `step ${r} not coprime with n ${n}`);
        }
    }
});

test('repeatSize per family', () => {
    assert.deepEqual(repeatSize({ family: Family.PLAIN }), { cols: 2, rows: 2 });
    assert.deepEqual(repeatSize({ family: Family.BASKET, warpGroup: 3, weftGroup: 2 }), { cols: 6, rows: 4 });
    assert.deepEqual(repeatSize({ family: Family.TWILL, over: 3, under: 1 }), { cols: 4, rows: 4 });
    assert.deepEqual(repeatSize({ family: Family.SATIN, n: 8, satinStep: 3 }), { cols: 8, rows: 8 });
});

test('describeSpec produces readable labels', () => {
    assert.equal(describeSpec({ family: Family.PLAIN }), 'PLAIN');
    assert.equal(describeSpec({ family: Family.TWILL, over: 2, under: 2, direction: 1 }), 'TWILL 2/2 Z');
    assert.equal(describeSpec({ family: Family.TWILL, over: 3, under: 1, direction: -1 }), 'TWILL 3/1 S');
    assert.equal(describeSpec({ family: Family.SATIN, n: 5, satinStep: 2, faced: Faced.WARP }), 'SATIN 5/2 warp');
});
