import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CENTER_FOCUS_TRANSITION_DURATION_MS,
    sampleLinearFocusTransition
} from '../src/animation/focusTransition.js';

test('center transition uses a short deliberate duration', () => {
    assert.equal(CENTER_FOCUS_TRANSITION_DURATION_MS, 420);
});

test('center transition follows the exact straight segment', () => {
    const start = { x: 420, y: 80 };
    const end = { x: 240, y: 240 };
    assert.deepEqual(sampleLinearFocusTransition(start, end, 0), start);
    assert.deepEqual(sampleLinearFocusTransition(start, end, 0.5), { x: 330, y: 160 });
    assert.deepEqual(sampleLinearFocusTransition(start, end, 1), end);
});

test('center transition clamps progress to the segment endpoints', () => {
    const start = { x: 10, y: 20 };
    const end = { x: 30, y: 40 };
    assert.deepEqual(sampleLinearFocusTransition(start, end, -1), start);
    assert.deepEqual(sampleLinearFocusTransition(start, end, 2), end);
});
