import { clamp } from '../geometry/vector.js';
import { createMotionRandom, sampleFocusPath, sampleFocusPathSegment } from './focusPath.js?v=20260825-8';

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

export function resolveFocusStops(stops = 40) {
    const amount = clamp(finiteOr(stops, 40), 0, 100);
    return {
        pause: amount * 0.6,
        skipProbability: 100 - amount
    };
}

export function createFocusTimeline(path, {
    duration = 5,
    pause = 12,
    skipProbability = 0,
    easing = 'ease-in-out',
    seed = path.seed
} = {}) {
    if (!path?.segments?.length) throw new Error('Focus timeline requires a non-empty path.');
    const durationMs = clamp(finiteOr(duration, 5), 1, 10) * 1000;
    const pauseRatio = clamp(finiteOr(pause, 12), 0, 80) / 100;
    const skipRatio = clamp(finiteOr(skipProbability, 0), 0, 100) / 100;
    const easingName = FOCUS_MOTION_EASINGS[easing] ? easing : 'ease-in-out';
    const random = createMotionRandom((Number(seed) ^ 0x9e3779b9) >>> 0);
    const activeStops = path.anchors.map((_, index) => index === 0 || random() >= skipRatio);
    const activeStopCount = activeStops.filter(Boolean).length;
    const holdBudgetMs = durationMs * pauseRatio;
    const holdDurationMs = activeStopCount ? holdBudgetMs / activeStopCount : 0;
    const movementBudgetMs = durationMs - holdBudgetMs;
    const equalMoveDuration = movementBudgetMs / path.segments.length;
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

    path.segments.forEach((segment, index) => {
        const moveDuration = path.totalLength > 1e-9
            ? movementBudgetMs * segment.length / path.totalLength
            : equalMoveDuration;
        addEntry({ type: 'move', segmentIndex: index, durationMs: moveDuration });
        const destination = segment.endIndex;
        if (destination !== 0 && activeStops[destination]) {
            addEntry({ type: 'hold', anchorIndex: destination, durationMs: holdDurationMs });
        }
    });

    if (entries.length) {
        entries[entries.length - 1].endMs = durationMs;
        entries[entries.length - 1].durationMs = durationMs - entries[entries.length - 1].startMs;
    }

    return {
        path,
        durationMs,
        easing: easingName,
        pauseRatio,
        skipRatio,
        activeStops,
        holdDurationMs,
        movementBudgetMs,
        movementStartMs: entries.find((entry) => entry.type === 'move')?.startMs || 0,
        globalEasing: skipRatio >= 1,
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


    if (timeline.globalEasing) {
        const linearProgress = timeline.movementBudgetMs <= 1e-9
            ? 1
            : clamp(
                (timeMs - timeline.movementStartMs) / timeline.movementBudgetMs,
                0,
                1
            );
        const easedProgress = FOCUS_MOTION_EASINGS[timeline.easing](linearProgress);
        const sample = sampleFocusPath(timeline.path, easedProgress);
        return {
            point: sample.point,
            timeMs,
            type: 'move',
            segmentIndex: sample.segmentIndex,
            segmentProgress: sample.segmentProgress,
            progress: linearProgress,
            easedProgress,
            globalEasing: true
        };
    }

    const linearProgress = entry.durationMs <= 1e-9
        ? 1
        : clamp((timeMs - entry.startMs) / entry.durationMs, 0, 1);
    const easedProgress = FOCUS_MOTION_EASINGS[timeline.easing](linearProgress);
    return {
        point: sampleFocusPathSegment(
            timeline.path.segments[entry.segmentIndex],
            easedProgress
        ),
        timeMs,
        type: 'move',
        segmentIndex: entry.segmentIndex,
        progress: linearProgress,
        easedProgress
    };
}
