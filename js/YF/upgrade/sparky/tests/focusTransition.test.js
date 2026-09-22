import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CENTER_FOCUS_TRANSITION_DURATION_MS,
    projectStandardEasing,
    sampleCenterFocusTransition
} from '../src/animation/focusTransition.js';

test('center transition uses a short deliberate duration', () => {
    assert.equal(CENTER_FOCUS_TRANSITION_DURATION_MS, 280);
});

test('center transition uses the project standard easing', () => {
    assert.equal(projectStandardEasing(0), 0);
    assert.equal(projectStandardEasing(1), 1);
    assert.ok(projectStandardEasing(0.5) > 0.7);
    assert.ok(projectStandardEasing(0.5) < 0.85);
});

test('center transition follows the exact straight segment while easing', () => {
    const start = { x: 420, y: 80 };
    const end = { x: 240, y: 240 };
    const midpoint = sampleCenterFocusTransition(start, end, 0.5);
    const xProgress = (midpoint.x - start.x) / (end.x - start.x);
    const yProgress = (midpoint.y - start.y) / (end.y - start.y);

    assert.deepEqual(sampleCenterFocusTransition(start, end, 0), start);
    assert.ok(Math.abs(xProgress - yProgress) < 1e-12);
    assert.ok(xProgress > 0.7);
    assert.deepEqual(sampleCenterFocusTransition(start, end, 1), end);
});

test('center transition clamps progress to the segment endpoints', () => {
    const start = { x: 10, y: 20 };
    const end = { x: 30, y: 40 };
    assert.deepEqual(sampleCenterFocusTransition(start, end, -1), start);
    assert.deepEqual(sampleCenterFocusTransition(start, end, 2), end);
});
