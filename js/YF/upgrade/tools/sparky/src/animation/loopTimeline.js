import { clamp } from '../geometry/vector.js';

const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function createStationaryLoopTimeline(focus, duration = 5) {
    return {
        kind: 'stationary',
        durationMs: clamp(finiteOr(duration, 5), 1, 10) * 1000,
        focus: {
            x: finiteOr(focus?.x, 240),
            y: finiteOr(focus?.y, 240)
        }
    };
}

export function sampleLoopFocus(timeline, rawTimeMs, movingSampler) {
    if (timeline?.kind !== 'stationary') return movingSampler(timeline, rawTimeMs);
    const duration = Math.max(1, timeline.durationMs);
    const timeMs = ((finiteOr(rawTimeMs, 0) % duration) + duration) % duration;
    return {
        point: { ...timeline.focus },
        timeMs,
        type: 'hold',
        progress: timeMs / duration
    };
}
