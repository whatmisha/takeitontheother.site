import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFocusPath, sampleFocusPath } from '../src/animation/focusPath.js';
import {
    createFocusTimeline,
    resolveFocusStops,
    sampleFocusTimeline
} from '../src/animation/focusTimeline.js';

const path = generateFocusPath({
    start: { x: 240, y: 240 },
    center: { x: 240, y: 240 },
    radius: 195,
    pointCount: 9,
    complexity: 'medium',
    seed: 42
});

test('timeline duration includes both movement and holds', () => {
    const timeline = createFocusTimeline(path, { duration: 7, pause: 25, seed: 90 });
    const total = timeline.entries.reduce((sum, entry) => sum + entry.durationMs, 0);
    const holds = timeline.entries
        .filter((entry) => entry.type === 'hold')
        .reduce((sum, entry) => sum + entry.durationMs, 0);
    assert.ok(Math.abs(total - 7000) < 1e-6);
    assert.ok(Math.abs(holds - 1750) < 1e-6);
});

test('timeline is seamless at duration boundary', () => {
    const timeline = createFocusTimeline(path, { duration: 5, pause: 12 });
    assert.deepEqual(sampleFocusTimeline(timeline, 0).point, path.anchors[0]);
    assert.deepEqual(sampleFocusTimeline(timeline, 5000).point, path.anchors[0]);
    const beforeEnd = sampleFocusTimeline(timeline, 5000 - 1e-5).point;
    assert.ok(Math.hypot(beforeEnd.x - path.anchors[0].x, beforeEnd.y - path.anchors[0].y) < 0.01);
});

test('skip probability changes stops without changing path geometry', () => {
    const first = createFocusTimeline(path, {
        duration: 5,
        pause: 20,
        skipProbability: 55,
        seed: 300
    });
    const second = createFocusTimeline(path, {
        duration: 5,
        pause: 20,
        skipProbability: 55,
        seed: 300
    });
    assert.deepEqual(first.activeStops, second.activeStops);
    assert.equal(first.path.path, path.path);
    assert.equal(first.activeStops[0], true);
});

test('zero pause produces only movement entries', () => {
    const timeline = createFocusTimeline(path, { duration: 3, pause: 0 });
    assert.equal(timeline.entries.every((entry) => entry.type === 'move'), true);
    assert.equal(timeline.entries.length, path.segments.length);
});

test('easing affects segment progress but keeps endpoints fixed', () => {
    const linear = createFocusTimeline(path, { duration: 4, pause: 0, easing: 'linear' });
    const eased = createFocusTimeline(path, { duration: 4, pause: 0, easing: 'ease-in' });
    const sampleTime = linear.entries[0].durationMs * 0.5;
    const linearPoint = sampleFocusTimeline(linear, sampleTime).point;
    const easedPoint = sampleFocusTimeline(eased, sampleTime).point;
    assert.notDeepEqual(linearPoint, easedPoint);
    assert.deepEqual(sampleFocusTimeline(linear, 0).point, path.anchors[0]);
    assert.deepEqual(sampleFocusTimeline(eased, 0).point, path.anchors[0]);
});

test('100% skipped stops applies easing once across the complete closed path', () => {
    const timeline = createFocusTimeline(path, {
        duration: 5,
        pause: 12,
        skipProbability: 100,
        easing: 'ease-in-out',
        seed: 17
    });
    assert.equal(timeline.globalEasing, true);
    assert.equal(timeline.activeStops[0], true);
    assert.equal(timeline.activeStops.slice(1).every((active) => !active), true);
    assert.equal(timeline.entries.filter((entry) => entry.type === 'hold').length, 1);

    const progress = 0.25;
    const sample = sampleFocusTimeline(
        timeline,
        timeline.movementStartMs + timeline.movementBudgetMs * progress
    );
    const expected = sampleFocusPath(path, 4 * progress ** 3);
    assert.equal(sample.globalEasing, true);
    assert.deepEqual(sample.point, expected.point);
});

test('Stops control maps continuously from uninterrupted motion to full stops', () => {
    assert.deepEqual(resolveFocusStops(0), { pause: 0, skipProbability: 100 });
    assert.deepEqual(resolveFocusStops(40), { pause: 24, skipProbability: 60 });
    assert.deepEqual(resolveFocusStops(100), { pause: 60, skipProbability: 0 });
});
