import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFocusPath, sampleFocusPath } from '../src/animation/focusPath.js';
import {
    createFocusTimeline,
    normalizeSpeedVariation,
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

test('stop count selects the exact deterministic number without changing path geometry', () => {
    const first = createFocusTimeline(path, {
        duration: 5,
        pause: 20,
        stopCount: 3,
        seed: 300
    });
    const second = createFocusTimeline(path, {
        duration: 5,
        pause: 20,
        stopCount: 3,
        seed: 300
    });
    assert.deepEqual(first.activeStops, second.activeStops);
    assert.equal(first.path.path, path.path);
    assert.equal(first.activeStops[0], true);
    assert.equal(first.activeStops.filter(Boolean).length, 3);
});

test('zero pause produces only movement entries', () => {
    const timeline = createFocusTimeline(path, { duration: 3, pause: 0 });
    assert.equal(timeline.entries.every((entry) => entry.type === 'move'), true);
    assert.equal(timeline.entries.length, 1);
    assert.deepEqual(
        timeline.entries[0].segmentIndices,
        path.segments.map((_, index) => index)
    );
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

test('one stop applies easing once across the complete closed path', () => {
    const timeline = createFocusTimeline(path, {
        duration: 5,
        pause: 12,
        stopCount: 1,
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
    assert.ok(Math.hypot(
        sample.point.x - expected.point.x,
        sample.point.y - expected.point.y
    ) < 1e-9);
});

test('Stops resolves to an exact count bounded by Points', () => {
    assert.deepEqual(resolveFocusStops(1, 6), { stopCount: 1, pause: 4 });
    assert.deepEqual(resolveFocusStops(2, 6), { stopCount: 2, pause: 8 });
    assert.deepEqual(resolveFocusStops(20, 6), { stopCount: 6, pause: 24 });
});

test('zero speed variation preserves the existing length-based timing exactly', () => {
    const implicit = createFocusTimeline(path, { duration: 5, pause: 20, seed: 42 });
    const explicit = createFocusTimeline(path, {
        duration: 5,
        pause: 20,
        speedVariation: 0,
        seed: 42
    });
    assert.deepEqual(explicit.entries, implicit.entries);
    assert.ok(explicit.speedFactors.every((factor) => factor === 1));
});

test('speed variation deterministically redistributes movement time without changing loop duration', () => {
    const first = createFocusTimeline(path, {
        duration: 7,
        pause: 25,
        speedVariation: 100,
        seed: 314
    });
    const second = createFocusTimeline(path, {
        duration: 7,
        pause: 25,
        speedVariation: 100,
        seed: 314
    });
    const otherSeed = createFocusTimeline(path, {
        duration: 7,
        pause: 25,
        speedVariation: 100,
        seed: 315
    });
    const segmentDurations = first.movementEntries.flatMap((entry) => entry.segmentDurations);
    assert.deepEqual(first.speedFactors, second.speedFactors);
    assert.deepEqual(first.entries, second.entries);
    assert.notDeepEqual(first.speedFactors, otherSeed.speedFactors);
    const segmentSpeeds = segmentDurations.map((duration, index) => (
        path.segments[index].length / duration
    ));
    assert.ok(Math.max(...segmentSpeeds) / Math.min(...segmentSpeeds) > 2);
    assert.ok(Math.abs(
        first.entries.reduce((sum, entry) => sum + entry.durationMs, 0) - 7000
    ) < 1e-6);
});

test('speed variation keeps one global easing when all intermediate stops are skipped', () => {
    const timeline = createFocusTimeline(path, {
        duration: 5,
        pause: 12,
        stopCount: 1,
        speedVariation: 100,
        easing: 'ease-in-out',
        seed: 17
    });
    const sample = sampleFocusTimeline(
        timeline,
        timeline.movementStartMs + timeline.movementBudgetMs * 0.25
    );
    assert.equal(timeline.globalEasing, true);
    assert.equal(sample.globalEasing, true);
    assert.ok(Number.isFinite(sample.point.x));
    assert.ok(Number.isFinite(sample.point.y));
});

test('speed variation is normalized to the exposed percentage range', () => {
    assert.equal(normalizeSpeedVariation(-10), 0);
    assert.equal(normalizeSpeedVariation(35), 35);
    assert.equal(normalizeSpeedVariation(140), 100);
});

test('two stops create exactly two eased movement spans across all geometric points', () => {
    const timeline = createFocusTimeline(path, {
        duration: 5,
        pause: 8,
        stopCount: 2,
        seed: 91
    });
    assert.equal(timeline.activeStops.filter(Boolean).length, 2);
    assert.equal(timeline.movementEntries.length, 2);
    assert.equal(
        timeline.movementEntries.reduce(
            (sum, entry) => sum + entry.segmentIndices.length,
            0
        ),
        path.segments.length
    );
    assert.ok(timeline.movementEntries.some((entry) => entry.segmentIndices.length > 1));
});
