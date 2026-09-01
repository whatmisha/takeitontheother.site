import assert from 'node:assert/strict';
import test from 'node:test';

import {
    advanceEyeMotion,
    advanceEyeMotionToTarget,
    createEyeMotionState,
    retargetEyeMotion,
    snapEyeMotion
} from '../src/animation/eyeMotion.js';

test('retargeting preserves the displayed center and then approaches continuously', () => {
    const motion = createEyeMotionState();
    retargetEyeMotion(motion, { x: 240, y: 270 }, 0);
    const first = retargetEyeMotion(motion, { x: 320, y: 300 }, 1000);
    assert.deepEqual(first, { x: -80, y: -30, settled: false });
    const next = advanceEyeMotion(motion, 1016);
    assert.ok(next.x > -80 && next.x < 0);
    assert.ok(next.y > -30 && next.y < 0);
});

test('a moving target never teleports the displayed eye rig', () => {
    const motion = createEyeMotionState();
    retargetEyeMotion(motion, { x: 200, y: 260 }, 0);
    retargetEyeMotion(motion, { x: 300, y: 260 }, 16);
    advanceEyeMotion(motion, 32);
    const before = { ...motion.displayedCenter };
    retargetEyeMotion(motion, { x: 340, y: 300 }, 48);
    assert.ok(motion.displayedCenter.x > before.x);
    assert.ok(motion.displayedCenter.x < 300);
    assert.ok(motion.displayedCenter.y >= before.y);
    assert.ok(motion.displayedCenter.y < 300);
});

test('snapping makes export geometry exact', () => {
    const motion = createEyeMotionState();
    retargetEyeMotion(motion, { x: 240, y: 270 }, 0);
    retargetEyeMotion(motion, { x: 360, y: 180 }, 16);
    assert.deepEqual(snapEyeMotion(motion), { x: 0, y: 0, settled: true });
    assert.deepEqual(motion.displayedCenter, motion.targetCenter);
});

test('fixed-step eye motion converges to the same state across a loop seam', () => {
    const frameCount = 60;
    const frameDuration = 1000 / 60;
    const targets = Array.from({ length: frameCount }, (_, index) => {
        const angle = index / frameCount * Math.PI * 2;
        return { x: 240 + Math.cos(angle) * 40, y: 260 + Math.sin(angle) * 24 };
    });
    const motion = createEyeMotionState();

    targets.slice(-24).forEach((target) => {
        advanceEyeMotionToTarget(motion, target, frameDuration);
    });
    advanceEyeMotionToTarget(motion, targets[0], frameDuration);
    const first = { ...motion.displayedCenter };
    targets.slice(1).forEach((target) => {
        advanceEyeMotionToTarget(motion, target, frameDuration);
    });
    advanceEyeMotionToTarget(motion, targets[0], frameDuration);

    assert.ok(Math.hypot(
        motion.displayedCenter.x - first.x,
        motion.displayedCenter.y - first.y
    ) < 1e-6);
    assert.notDeepEqual(first, targets[0]);
});
