import assert from 'node:assert/strict';
import test from 'node:test';
import { generateFocusPath } from '../src/animation/focusPath.js';
import { createFocusTimeline, sampleFocusTimeline } from '../src/animation/focusTimeline.js';
import { BLINK_TIMING } from '../src/animation/blink.js';
import {
    createEyeAnimationTimeline,
    MAX_BLINKS_PER_STOP,
    sampleEyeAnimationTimeline
} from '../src/animation/eyeTimeline.js';

const path = generateFocusPath({
    start: { x: 240, y: 240 },
    center: { x: 240, y: 240 },
    radius: 195,
    pointCount: 6,
    complexity: 'soft',
    seed: 42
});

const focusTimeline = createFocusTimeline(path, {
    duration: 5,
    pause: 20,
    skipProbability: 0,
    easing: 'ease-in-out',
    seed: 42
});

test('blink count creates the exact number of deterministic blink events', () => {
    const first = createEyeAnimationTimeline(focusTimeline, { blinkCount: 4 });
    const second = createEyeAnimationTimeline(focusTimeline, { blinkCount: 4 });
    assert.equal(first.blinkEvents.length, 4);
    assert.deepEqual(first.blinkEvents, second.blinkEvents);
});

test('animated blinks use the same relaxed timing as manual blinks', () => {
    const eyeTimeline = createEyeAnimationTimeline(focusTimeline, { blinkCount: 1 });
    const timing = eyeTimeline.blinkEvents[0].timing;
    assert.deepEqual(timing, {
        ...BLINK_TIMING,
        duration: BLINK_TIMING.close + BLINK_TIMING.hold + BLINK_TIMING.open
    });
});

test('stop-only blinks are assigned exclusively to active stop anchors', () => {
    const eyeTimeline = createEyeAnimationTimeline(focusTimeline, {
        blinkCount: 5,
        blinkAtStops: true
    });
    const activeAnchors = new Set(
        focusTimeline.activeStops.flatMap((active, index) => active ? [index] : [])
    );
    assert.equal(eyeTimeline.blinkEvents.length, 5);
    eyeTimeline.blinkEvents.forEach((event) => {
        assert.ok(activeAnchors.has(event.anchorIndex));
    });
});

test('no stop receives more than two blinks even when twelve are requested', () => {
    const singleStopTimeline = createFocusTimeline(path, {
        duration: 1,
        pause: 20,
        skipProbability: 100,
        easing: 'ease-in-out',
        seed: 42
    });
    const eyeTimeline = createEyeAnimationTimeline(singleStopTimeline, {
        blinkCount: 12,
        blinkAtStops: true
    });
    const counts = eyeTimeline.blinkEvents.reduce((result, event) => {
        result.set(event.anchorIndex, (result.get(event.anchorIndex) || 0) + 1);
        return result;
    }, new Map());

    assert.equal(eyeTimeline.blinkEvents.length, MAX_BLINKS_PER_STOP);
    assert.equal(eyeTimeline.requestedBlinkCount, 12);
    assert.equal(eyeTimeline.blinkCount, MAX_BLINKS_PER_STOP);
    assert.equal(Math.max(...counts.values()), MAX_BLINKS_PER_STOP);
    const manualDuration = BLINK_TIMING.close + BLINK_TIMING.hold + BLINK_TIMING.open;
    assert.ok(eyeTimeline.blinkEvents.every((event) => (
        event.timing.duration === manualDuration
    )));
    assert.equal(
        eyeTimeline.blinkEvents[1].centerMs - eyeTimeline.blinkEvents[0].centerMs,
        manualDuration
    );
    assert.equal(
        sampleFocusTimeline(singleStopTimeline, eyeTimeline.blinkEvents[0].centerMs).type,
        'hold'
    );
    assert.equal(
        sampleFocusTimeline(singleStopTimeline, eyeTimeline.blinkEvents[1].centerMs).type,
        'move'
    );
});

test('one blink at a stop always keeps the manual click timing', () => {
    const shortStopTimeline = createFocusTimeline(path, {
        duration: 1,
        pause: 5,
        skipProbability: 100,
        seed: 42
    });
    const eyeTimeline = createEyeAnimationTimeline(shortStopTimeline, {
        blinkCount: 1,
        blinkAtStops: true
    });
    assert.deepEqual(eyeTimeline.blinkEvents[0].timing, {
        ...BLINK_TIMING,
        duration: BLINK_TIMING.close + BLINK_TIMING.hold + BLINK_TIMING.open
    });
});

test('emotion animation starts from the source Cute/Angry combination and loops exactly', () => {
    const eyeTimeline = createEyeAnimationTimeline(focusTimeline, {
        blinkCount: 0,
        emotionVariation: 65
    });
    const base = { cute: 35, angry: 20 };
    assert.deepEqual(
        sampleEyeAnimationTimeline(eyeTimeline, 0, base),
        sampleEyeAnimationTimeline(eyeTimeline, focusTimeline.durationMs, base)
    );
    assert.equal(sampleEyeAnimationTimeline(eyeTimeline, 0, base).cute, 35);
    assert.equal(sampleEyeAnimationTimeline(eyeTimeline, 0, base).angry, 20);
    assert.notDeepEqual(
        sampleEyeAnimationTimeline(eyeTimeline, 1250, base),
        sampleEyeAnimationTimeline(eyeTimeline, 0, base)
    );
});

test('zero variation preserves the source expression throughout the loop', () => {
    const eyeTimeline = createEyeAnimationTimeline(focusTimeline, {
        blinkCount: 0,
        emotionVariation: 0
    });
    const sample = sampleEyeAnimationTimeline(eyeTimeline, 1875, { cute: 72, angry: 14 });
    assert.equal(sample.cute, 72);
    assert.equal(sample.angry, 14);
});

test('emotion transitions use the selected motion easing', () => {
    const base = { cute: 20, angry: 10 };
    const linear = createEyeAnimationTimeline(focusTimeline, {
        blinkCount: 0,
        emotionVariation: 100,
        easing: 'linear'
    });
    const eased = createEyeAnimationTimeline(focusTimeline, {
        blinkCount: 0,
        emotionVariation: 100,
        easing: 'ease-in'
    });
    const timeMs = focusTimeline.durationMs / 8;
    assert.equal(sampleEyeAnimationTimeline(linear, timeMs, base).cute, 60);
    assert.equal(sampleEyeAnimationTimeline(eased, timeMs, base).cute, 30);
});
