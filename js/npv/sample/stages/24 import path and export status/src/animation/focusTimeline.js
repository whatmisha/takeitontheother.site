import { clamp } from '../geometry/vector.js';
import { createMotionRandom, sampleFocusPathSegment } from './focusPath.js?v=20260826-1';

export const FOCUS_MOTION_EASINGS = Object.freeze({
    linear: (value) => value,
    'ease-in': (value) => value * value * value,
    'ease-out': (value) => 1 - (1 - value) ** 3,
    'ease-in-out': (value) => (
        value < 0.5
            ? 4 * value * value * value
            : 1 - ((-2 * value + 2) ** 3) / 2
    ),
    smooth: (value) => value * value * (3 - 2 * value)
});

const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const copyPoint = (value) => ({ x: value.x, y: value.y });

export const normalizeSpeedVariation = (value) => clamp(finiteOr(value, 0), 0, 100);

export function resolveFocusStops(stops = 1, pointCount = 1) {
    const points = Math.max(1, Math.round(finiteOr(pointCount, 1)));
    const stopCount = Math.round(clamp(finiteOr(stops, 1), 1, points));
    return {
        stopCount,
        pause: Math.min(60, stopCount * 4)
    };
}

function selectActiveStops(anchorCount, stopCount, random) {
    const active = Array(anchorCount).fill(false);
    active[0] = true;
    const candidates = Array.from({ length: Math.max(0, anchorCount - 1) }, (_, index) => index + 1);
    for (let index = candidates.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }
    candidates.slice(0, Math.max(0, stopCount - 1)).forEach((index) => {
        active[index] = true;
    });
    return active;
}

function segmentIndicesBetween(startIndex, endIndex, segmentCount) {
    const indices = [];
    let index = startIndex;
    do {
        indices.push(index);
        index = (index + 1) % segmentCount;
    } while (index !== endIndex);
    return indices;
}

export function createFocusTimeline(path, {
    duration = 5,
    pause,
    stopCount = 1,
    speedVariation = 0,
    easing = 'ease-in-out',
    seed = path.seed
} = {}) {
    if (!path?.segments?.length) throw new Error('Focus timeline requires a non-empty path.');
    const durationMs = clamp(finiteOr(duration, 5), 1, 10) * 1000;
    const resolvedStops = resolveFocusStops(stopCount, path.anchors.length);
    const pauseRatio = clamp(finiteOr(pause, resolvedStops.pause), 0, 80) / 100;
    const speedVariationAmount = normalizeSpeedVariation(speedVariation) / 100;
    const easingName = FOCUS_MOTION_EASINGS[easing] ? easing : 'ease-in-out';
    const random = createMotionRandom((Number(seed) ^ 0x9e3779b9) >>> 0);
    const activeStops = selectActiveStops(
        path.anchors.length,
        resolvedStops.stopCount,
        random
    );
    const activeStopIndices = activeStops.flatMap((active, index) => active ? [index] : []);
    const activeStopCount = activeStopIndices.length;
    const holdBudgetMs = durationMs * pauseRatio;
    const holdDurationMs = activeStopCount ? holdBudgetMs / activeStopCount : 0;
    const movementBudgetMs = durationMs - holdBudgetMs;
    const speedRandom = createMotionRandom((Number(seed) ^ 0x85ebca6b) >>> 0);
    const speedFactors = path.segments.map(() => (
        2 ** ((speedRandom() * 2 - 1) * 2 * speedVariationAmount)
    ));
    const movementWeights = path.segments.map((segment, index) => (
        Math.max(segment.length, 1e-9) / speedFactors[index]
    ));
    const movementWeightTotal = movementWeights.reduce((sum, weight) => sum + weight, 0);
    const equalMoveDuration = movementBudgetMs / path.segments.length;
    const segmentDurations = movementWeights.map((weight) => (
        movementWeightTotal > 1e-9
            ? movementBudgetMs * weight / movementWeightTotal
            : equalMoveDuration
    ));
    const entries = [];
    let cursor = 0;

    const addEntry = (entry) => {
        if (!(entry.durationMs > 1e-9)) return;
        entries.push({ ...entry, startMs: cursor, endMs: cursor + entry.durationMs });
        cursor += entry.durationMs;
    };

    if (activeStops[0]) {
        addEntry({ type: 'hold', anchorIndex: 0, durationMs: holdDurationMs });
    }

    activeStopIndices.forEach((startAnchorIndex, activeIndex) => {
        const endAnchorIndex = activeStopIndices[(activeIndex + 1) % activeStopIndices.length];
        const segmentIndices = segmentIndicesBetween(
            startAnchorIndex,
            endAnchorIndex,
            path.segments.length
        );
        const groupSegmentDurations = segmentIndices.map((index) => segmentDurations[index]);
        addEntry({
            type: 'move',
            startAnchorIndex,
            endAnchorIndex,
            segmentIndices,
            segmentDurations: groupSegmentDurations,
            durationMs: groupSegmentDurations.reduce((sum, value) => sum + value, 0)
        });
        if (endAnchorIndex !== 0) {
            addEntry({ type: 'hold', anchorIndex: endAnchorIndex, durationMs: holdDurationMs });
        }
    });

    if (entries.length) {
        const lastEntry = entries[entries.length - 1];
        const correctedDuration = durationMs - lastEntry.startMs;
        const correction = correctedDuration - lastEntry.durationMs;
        lastEntry.endMs = durationMs;
        lastEntry.durationMs = correctedDuration;
        if (lastEntry.type === 'move' && lastEntry.segmentDurations.length) {
            const lastIndex = lastEntry.segmentDurations.length - 1;
            lastEntry.segmentDurations[lastIndex] += correction;
        }
    }
    const movementEntries = entries.filter((entry) => entry.type === 'move');

    return {
        path,
        durationMs,
        easing: easingName,
        pauseRatio,
        stopCount: activeStopCount,
        speedVariation: speedVariationAmount * 100,
        speedFactors,
        activeStops,
        holdDurationMs,
        movementBudgetMs,
        movementStartMs: entries.find((entry) => entry.type === 'move')?.startMs || 0,
        movementEntries,
        globalEasing: activeStopCount === 1,
        entries
    };
}

export function sampleFocusTimeline(timeline, rawTimeMs) {
    const duration = timeline.durationMs;
    const numeric = finiteOr(rawTimeMs, 0);
    const timeMs = ((numeric % duration) + duration) % duration;
    const entry = timeline.entries.find((candidate) => timeMs < candidate.endMs)
        || timeline.entries[timeline.entries.length - 1];
    if (!entry || entry.type === 'hold') {
        const anchor = timeline.path.anchors[entry?.anchorIndex ?? 0];
        return {
            point: copyPoint(anchor),
            timeMs,
            type: 'hold',
            anchorIndex: entry?.anchorIndex ?? 0,
            progress: 0
        };
    }


    const linearProgress = entry.durationMs <= 1e-9
        ? 1
        : clamp((timeMs - entry.startMs) / entry.durationMs, 0, 1);
    const easedProgress = FOCUS_MOTION_EASINGS[timeline.easing](linearProgress);
    const sample = sampleMovementEntry(timeline, entry, easedProgress);
    return {
        point: sample.point,
        timeMs,
        type: 'move',
        segmentIndex: sample.segmentIndex,
        segmentProgress: sample.segmentProgress,
        progress: linearProgress,
        easedProgress,
        globalEasing: timeline.globalEasing
    };
}

function sampleMovementEntry(timeline, entry, progress) {
    const target = clamp(progress, 0, 1) * entry.durationMs;
    let traversed = 0;
    for (let index = 0; index < entry.segmentIndices.length; index += 1) {
        const segmentIndex = entry.segmentIndices[index];
        const segmentDuration = entry.segmentDurations[index];
        const end = traversed + segmentDuration;
        if (target <= end || index === entry.segmentIndices.length - 1) {
            const localProgress = segmentDuration <= 1e-9
                ? 0
                : clamp((target - traversed) / segmentDuration, 0, 1);
            return {
                point: sampleFocusPathSegment(
                    timeline.path.segments[segmentIndex],
                    localProgress
                ),
                segmentIndex,
                segmentProgress: localProgress
            };
        }
        traversed = end;
    }
    const segmentIndex = entry.segmentIndices[0] || 0;
    return {
        point: sampleFocusPathSegment(timeline.path.segments[segmentIndex], 0),
        segmentIndex,
        segmentProgress: 0
    };
}
