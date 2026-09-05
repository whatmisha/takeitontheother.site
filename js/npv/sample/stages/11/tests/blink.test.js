import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BLINK_TIMING,
    advanceBlink,
    createBlinkState,
    resetBlink,
    triggerBlink
} from '../src/animation/blink.js';

test('blink closes, briefly holds, and returns to the configured expression', () => {
    const blink = createBlinkState();
    triggerBlink(blink, 0);
    const middle = advanceBlink(blink, BLINK_TIMING.close / 2);
    assert.ok(middle.amount > 0 && middle.amount < 1);
    assert.equal(advanceBlink(blink, BLINK_TIMING.close).amount, 1);
    assert.equal(advanceBlink(blink, BLINK_TIMING.close + BLINK_TIMING.hold / 2).amount, 1);
    const opening = advanceBlink(blink, BLINK_TIMING.close + BLINK_TIMING.hold + BLINK_TIMING.open / 2);
    assert.ok(opening.amount > 0 && opening.amount < 1);
    assert.deepEqual(
        advanceBlink(blink, BLINK_TIMING.close + BLINK_TIMING.hold + BLINK_TIMING.open),
        { amount: 0, active: false }
    );
});

test('retriggering a blink continues from the current visual amount', () => {
    const blink = createBlinkState();
    triggerBlink(blink, 0);
    const before = advanceBlink(blink, 45).amount;
    const retriggered = triggerBlink(blink, 45);
    assert.equal(retriggered.amount, before);
    assert.ok(advanceBlink(blink, 55).amount >= before);
});

test('reset removes the transient expression before export', () => {
    const blink = createBlinkState();
    triggerBlink(blink, 0);
    advanceBlink(blink, 45);
    assert.deepEqual(resetBlink(blink), { amount: 0, active: false });
    assert.equal(blink.phase, 'idle');
});
