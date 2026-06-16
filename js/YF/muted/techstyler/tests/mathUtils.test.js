import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mod, gcd, areCoprime, clampInt, longestCyclicRun } from '../weave/mathUtils.js';

test('mod is always positive for negative dividends', () => {
    assert.equal(mod(-1, 2), 1);
    assert.equal(mod(-3, 5), 2);
    assert.equal(mod(-10, 3), 2);
    assert.equal(mod(7, 5), 2);
    assert.equal(mod(0, 4), 0);
});

test('mod matches JS % for non-negative input', () => {
    for (let n = 0; n < 50; n++) {
        for (let m = 1; m < 8; m++) {
            assert.equal(mod(n, m), n % m);
        }
    }
});

test('mod rejects non-positive divisor', () => {
    assert.throws(() => mod(5, 0));
    assert.throws(() => mod(5, -2));
});

test('gcd', () => {
    assert.equal(gcd(12, 8), 4);
    assert.equal(gcd(5, 0), 5);
    assert.equal(gcd(0, 0), 0);
    assert.equal(gcd(-12, 8), 4);
    assert.equal(gcd(7, 13), 1);
});

test('areCoprime', () => {
    assert.equal(areCoprime(2, 5), true);
    assert.equal(areCoprime(2, 4), false);
    assert.equal(areCoprime(3, 5), true);
    assert.equal(areCoprime(6, 9), false);
});

test('clampInt clamps and rounds', () => {
    assert.equal(clampInt(5.4, 0, 10), 5);
    assert.equal(clampInt(-3, 0, 10), 0);
    assert.equal(clampInt(99, 0, 10), 10);
    assert.equal(clampInt(NaN, 2, 10), 2);
});

test('longestCyclicRun wraps across the seam', () => {
    assert.equal(longestCyclicRun([1, 0, 0, 1], 1), 2); // wraps: last 1 + first 1
    assert.equal(longestCyclicRun([1, 1, 1, 1], 1), 4); // all-floating
    assert.equal(longestCyclicRun([0, 0, 0, 0], 1), 0);
    assert.equal(longestCyclicRun([1, 0, 1, 0], 1), 1);
    assert.equal(longestCyclicRun([], 1), 0);
});
