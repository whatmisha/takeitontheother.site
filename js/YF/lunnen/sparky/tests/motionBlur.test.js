import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BLINK_MOTION_BLUR_SCALE,
    normalizeMotionBlur,
    previewMotionBlurDeviation,
    previewMotionBlurTrail,
    resolveBlinkMotionBlurTime,
    resolvePreviewMotionBlurGhosts,
    resolveMotionBlur,
    wrapMotionBlurTime
} from '../src/animation/motionBlur.js';

test('zero motion blur preserves the single-sample render path', () => {
    assert.deepEqual(resolveMotionBlur(0), {
        strength: 0,
        sampleCount: 1,
        shutterFrames: 0,
        offsets: [0]
    });
    assert.equal(previewMotionBlurDeviation(0), 0);
});

test('motion blur strength increases shutter duration and sample quality', () => {
    const light = resolveMotionBlur(20);
    const strong = resolveMotionBlur(100);
    assert.equal(light.sampleCount, 3);
    assert.equal(strong.sampleCount, 9);
    assert.ok(strong.shutterFrames > light.shutterFrames);
    assert.equal(strong.offsets[0], -1.5);
    assert.equal(strong.offsets.at(-1), 1.5);
});

test('motion blur samples wrap seamlessly across both ends of the loop', () => {
    assert.equal(wrapMotionBlurTime(-25, 1000), 975);
    assert.equal(wrapMotionBlurTime(1025, 1000), 25);
});

test('blink motion blur uses a quarter-length shutter without changing the frame center', () => {
    assert.equal(BLINK_MOTION_BLUR_SCALE, 0.25);
    assert.equal(resolveBlinkMotionBlurTime(1000, 900, 5000), 975);
    assert.equal(resolveBlinkMotionBlurTime(1000, 1100, 5000), 1025);
    assert.equal(resolveBlinkMotionBlurTime(10, -90, 1000), 985);
    assert.equal(resolveBlinkMotionBlurTime(1000, 900, 5000, 0), 1000);
    assert.equal(resolveBlinkMotionBlurTime(1000, 900, 5000, 1), 900);
});

test('preview trail points from the current focus toward its previous position', () => {
    assert.deepEqual(
        previewMotionBlurTrail({ x: 20, y: 10 }, { x: 10, y: 5 }),
        { x: -10, y: -5, length: Math.hypot(10, 5) }
    );
    const capped = previewMotionBlurTrail({ x: 100, y: 0 }, { x: 0, y: 0 }, 18);
    assert.deepEqual(capped, { x: -18, y: 0, length: 18 });
});

test('preview uses at most three cheap history contours and one while adjusting', () => {
    assert.equal(resolvePreviewMotionBlurGhosts(20).length, 1);
    assert.equal(resolvePreviewMotionBlurGhosts(50).length, 2);
    assert.equal(resolvePreviewMotionBlurGhosts(100).length, 3);
    assert.equal(resolvePreviewMotionBlurGhosts(100, { reduced: true }).length, 1);
    assert.deepEqual(resolvePreviewMotionBlurGhosts(0), []);
    const strong = resolvePreviewMotionBlurGhosts(100);
    assert.ok(strong.every((ghost) => (
        ghost.offsetFrames < 0 && ghost.opacity > 0
    )));
    assert.equal(strong[0].opacity, 0.15);
    assert.ok(strong.at(-1).opacity > 0.21);
});

test('motion blur input is normalized to the exposed percentage range', () => {
    assert.equal(normalizeMotionBlur(-10), 0);
    assert.equal(normalizeMotionBlur(140), 100);
});
