import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createEyeAnimationTimeline,
    sampleEyeAnimationTimeline
} from '../src/animation/eyeTimeline.js';
import { generateFocusPath } from '../src/animation/focusPath.js';
import {
    createFocusTimeline,
    sampleFocusTimeline
} from '../src/animation/focusTimeline.js';
import {
    createAnimationFrameSamples,
    sampleAnimationFrame
} from '../src/export/animationFrameSamples.js';

test('animation frame samples precompute a complete deterministic loop', () => {
    const path = generateFocusPath({
        start: { x: 240, y: 240 },
        center: { x: 240, y: 240 },
        radius: 195,
        pointCount: 6,
        complexity: 50,
        seed: 42
    });
    const timeline = createFocusTimeline(path, {
        duration: 1,
        pause: 24,
        skipProbability: 60,
        seed: 42
    });
    const eyeTimeline = createEyeAnimationTimeline(timeline, {
        blinkCount: 2,
        emotionVariation: 50
    });
    const samples = createAnimationFrameSamples(
        timeline,
        eyeTimeline,
        { cute: 50, angry: 0 },
        60,
        60
    );

    assert.equal(samples.count, 60);
    assert.equal(samples.focusX.length, 60);
    assert.equal(samples.blink.length, 60);
    assert.deepEqual(sampleAnimationFrame(samples, 0), {
        focus: { x: samples.focusX[0], y: samples.focusY[0] },
        eyes: {
            blinkAmount: samples.blink[0],
            cute: samples.cute[0],
            angry: samples.angry[0]
        }
    });
    assert.notDeepEqual(sampleAnimationFrame(samples, 0), sampleAnimationFrame(samples, 30));
    [0, 17, 59].forEach((index) => {
        const timeMs = index * 1000 / 60;
        const directEyes = sampleEyeAnimationTimeline(
            eyeTimeline,
            timeMs,
            { cute: 50, angry: 0 }
        );
        assert.deepEqual(sampleAnimationFrame(samples, index), {
            focus: sampleFocusTimeline(timeline, timeMs).point,
            eyes: {
                blinkAmount: directEyes.blinkAmount,
                cute: directEyes.cute,
                angry: directEyes.angry
            }
        });
    });
});
