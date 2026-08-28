import assert from 'node:assert/strict';
import test from 'node:test';

import { createBolidEyeScaffold } from '../src/animation/bolidEyeScaffold.js';
import {
    BOLID_EYE_MOTION_TIME_CONSTANT,
    advanceEyeMotionToTarget,
    createEyeMotionState
} from '../src/animation/eyeMotion.js';
import { DEFAULT_GEOMETRY } from '../src/geometry/characterGeometry.js';
import { buildAnimationFrameScene } from '../src/render/animationFrameRenderer.js';

const settings = {
    ...DEFAULT_GEOMETRY,
    width: 480,
    height: 480,
    focusMode: 'bolid',
    focusX: 240,
    focusY: 240,
    focusAngle: 0,
    focusDistance: 0,
    motionDuration: 5,
    bolidTargetAngle: 180,
    bolidTargetDistance: 0,
    rayOverrides: [{}, {}, {}, {}, {}],
    eyePerspective: 100,
    eyeSize: 50,
    eyeDistance: 0,
    cute: 50,
    angry: 0,
    headColor: '#ffffff',
    eyeColor: '#000000',
    backgroundColor: '#000000'
};

test('Bolid reuses one time-independent eye scaffold', () => {
    const focus = { x: 240, y: 240 };
    assert.strictEqual(
        createBolidEyeScaffold(settings, focus),
        createBolidEyeScaffold(settings, focus)
    );
});

test('Bolid safety correction stays contained and full-transform inertia removes jumps', () => {
    const frameDuration = 1000 / 60;
    const frameCount = Math.round(settings.motionDuration * 60);
    const motion = createEyeMotionState(BOLID_EYE_MOTION_TIME_CONSTANT);
    let previous = null;
    let maximumCenterDelta = 0;
    let maximumScaleDelta = 0;
    let minimumClearance = Infinity;

    // Warm the periodic filter from the tail of the same loop, mirroring export.
    for (let index = frameCount - 24; index < frameCount; index += 1) {
        const scene = buildAnimationFrameScene(settings, { x: 240, y: 240 }, {
            timeMs: index * frameDuration,
            durationMs: settings.motionDuration * 1000
        });
        advanceEyeMotionToTarget(
            motion,
            scene.eyes.pairCenter,
            frameDuration,
            scene.eyes.fitScale
        );
    }

    for (let index = 0; index < frameCount; index += 1) {
        const scene = buildAnimationFrameScene(settings, { x: 240, y: 240 }, {
            timeMs: index * frameDuration,
            durationMs: settings.motionDuration * 1000
        });
        minimumClearance = Math.min(minimumClearance, scene.eyes.minClearance);
        advanceEyeMotionToTarget(
            motion,
            scene.eyes.pairCenter,
            frameDuration,
            scene.eyes.fitScale
        );
        const current = {
            center: { ...motion.displayedCenter },
            scale: motion.displayedScale
        };
        if (previous) {
            maximumCenterDelta = Math.max(
                maximumCenterDelta,
                Math.hypot(
                    current.center.x - previous.center.x,
                    current.center.y - previous.center.y
                )
            );
            maximumScaleDelta = Math.max(
                maximumScaleDelta,
                Math.abs(current.scale - previous.scale)
            );
        }
        previous = current;
    }

    assert.ok(minimumClearance >= 1.99);
    assert.ok(maximumCenterDelta < 3);
    assert.ok(maximumScaleDelta < 0.005);
});

