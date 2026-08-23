import assert from 'node:assert/strict';
import test from 'node:test';

import {
    advanceAdaptiveFocusMotion,
    createAdaptiveFocusMotion,
    resetAdaptiveFocusMotion,
    retargetAdaptiveFocusMotion,
    settleAdaptiveFocusMotion
} from '../src/animation/focusMotion.js';

test('a large cursor jump can never leave the rendered Focus far behind', () => {
    const motion = createAdaptiveFocusMotion({ maxLag: 8 });
    resetAdaptiveFocusMotion(motion, { x: 120, y: 120 });
    const moved = retargetAdaptiveFocusMotion(motion, { x: 360, y: 360 }, 16);
    assert.ok(moved.lag <= 8 + 1e-9);
    assert.ok(Math.hypot(
        motion.displayed.x - motion.target.x,
        motion.displayed.y - motion.target.y
    ) <= 8 + 1e-9);
});

test('fast pointer motion gets a shorter response than precise slow motion', () => {
    const slow = createAdaptiveFocusMotion();
    resetAdaptiveFocusMotion(slow, { x: 240, y: 240 });
    retargetAdaptiveFocusMotion(slow, { x: 241, y: 240 }, 32);

    const fast = createAdaptiveFocusMotion();
    resetAdaptiveFocusMotion(fast, { x: 240, y: 240 });
    retargetAdaptiveFocusMotion(fast, { x: 280, y: 240 }, 32);

    assert.ok(fast.speed > slow.speed);
    assert.ok(fast.timeConstant < slow.timeConstant);
});

test('the rendered Focus approaches continuously and settles exactly for export', () => {
    const motion = createAdaptiveFocusMotion();
    resetAdaptiveFocusMotion(motion, { x: 240, y: 240 });
    retargetAdaptiveFocusMotion(motion, { x: 248, y: 240 }, 16);
    const before = motion.displayed.x;
    const frame = advanceAdaptiveFocusMotion(motion, 32);
    assert.ok(frame.point.x > before && frame.point.x < 248);
    settleAdaptiveFocusMotion(motion);
    assert.deepEqual(motion.displayed, { x: 248, y: 240 });
});
