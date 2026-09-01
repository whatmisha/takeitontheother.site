import { BLINK_TIMING } from './blink.js';
import { FOCUS_MOTION_EASINGS } from './focusTimeline.js?v=20260825-2';
import { clamp } from '../geometry/vector.js';

const BASE_BLINK_DURATION = BLINK_TIMING.close + BLINK_TIMING.hold + BLINK_TIMING.open;
const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const clamp01 = (value) => clamp(value, 0, 1);
const smoothstep = (value) => {
    const amount = clamp01(value);
    return amount * amount * (3 - 2 * amount);
};

function wrapTime(value, duration) {
    return ((value % duration) + duration) % duration;
}

function blinkShape(localTime, timing) {
    if (localTime < 0 || localTime >= timing.duration) return 0;
    if (localTime < timing.close) return smoothstep(localTime / timing.close);
    if (localTime < timing.close + timing.hold) return 1;
    return 1 - smoothstep(
        (localTime - timing.close - timing.hold) / timing.open
    );
}

function scaledBlinkTiming(maxDuration = BASE_BLINK_DURATION) {
    const duration = Math.max(48, Math.min(BASE_BLINK_DURATION, maxDuration));
    const scale = duration / BASE_BLINK_DURATION;
    return {
        close: BLINK_TIMING.close * scale,
        hold: BLINK_TIMING.hold * scale,
        open: BLINK_TIMING.open * scale,
        duration
    };
}

function stopDescriptors(focusTimeline) {
    return focusTimeline.activeStops.flatMap((active, anchorIndex) => {
        if (!active) return [];
        const hold = focusTimeline.entries.find((entry) => (
            entry.type === 'hold' && entry.anchorIndex === anchorIndex
        ));
        if (hold) {
            return [{
                anchorIndex,
                centerMs: (hold.startMs + hold.endMs) / 2,
                startMs: hold.startMs,
                durationMs: hold.durationMs
            }];
        }
        if (anchorIndex === 0) {
            return [{ anchorIndex, centerMs: 0, startMs: 0, durationMs: 0 }];
        }
        const arrival = focusTimeline.entries.find((entry) => (
            entry.type === 'move'
            && focusTimeline.path.segments[entry.segmentIndex].endIndex === anchorIndex
        ));
        return [{
            anchorIndex,
            centerMs: arrival?.endMs || 0,
            startMs: arrival?.endMs || 0,
            durationMs: 0
        }];
    });
}

function distributeAssignments(count, stops) {
    const assignments = new Map(stops.map((stop) => [stop, []]));
    for (let index = 0; index < count; index += 1) {
        const stopIndex = count <= stops.length
            ? count === 1
                ? 0
                : Math.round(index * (stops.length - 1) / (count - 1))
            : index % stops.length;
        assignments.get(stops[stopIndex]).push(index);
    }
    return assignments;
}

function createStopBlinkEvents(focusTimeline, count) {
    const stops = stopDescriptors(focusTimeline);
    if (!stops.length) return [];
    const assignments = distributeAssignments(count, stops);
    const events = [];

    assignments.forEach((indices, stop) => {
        if (!indices.length) return;
        const explicitWindow = stop.durationMs;
        const fallbackWindow = Math.min(900, focusTimeline.durationMs * 0.18);
        const windowDuration = explicitWindow > 0 ? explicitWindow : fallbackWindow;
        const spacing = windowDuration / indices.length;
        const windowStart = explicitWindow > 0
            ? stop.startMs
            : stop.centerMs - windowDuration / 2;
        indices.forEach((_, localIndex) => {
            const centerMs = windowStart + spacing * (localIndex + 0.5);
            const timing = scaledBlinkTiming(spacing * 0.82);
            events.push({
                anchorIndex: stop.anchorIndex,
                centerMs: wrapTime(centerMs, focusTimeline.durationMs),
                startMs: centerMs - timing.close - timing.hold / 2,
                timing
            });
        });
    });
    return events.sort((first, second) => first.centerMs - second.centerMs);
}

function createFreeBlinkEvents(focusTimeline, count) {
    const spacing = focusTimeline.durationMs / count;
    return Array.from({ length: count }, (_, index) => {
        const centerMs = spacing * (index + 0.5);
        const timing = scaledBlinkTiming(spacing * 0.72);
        return {
            anchorIndex: null,
            centerMs,
            startMs: centerMs - timing.close - timing.hold / 2,
            timing
        };
    });
}

export function createEyeAnimationTimeline(focusTimeline, {
    blinkCount = 2,
    blinkAtStops = true,
    emotionVariation = 0,
    easing = 'ease-in-out'
} = {}) {
    const count = Math.round(clamp(finiteOr(blinkCount, 2), 0, 12));
    const onlyAtStops = Boolean(blinkAtStops);
    return {
        durationMs: focusTimeline.durationMs,
        focusTimeline,
        blinkCount: count,
        blinkAtStops: onlyAtStops,
        emotionVariation: clamp(finiteOr(emotionVariation, 0), 0, 100),
        easing: FOCUS_MOTION_EASINGS[easing] ? easing : 'ease-in-out',
        blinkEvents: count <= 0
            ? []
            : onlyAtStops
                ? createStopBlinkEvents(focusTimeline, count)
                : createFreeBlinkEvents(focusTimeline, count)
    };
}

function easedOscillation(phase, cycles, easing) {
    const cycle = ((phase * cycles) % 1 + 1) % 1;
    const quarter = Math.min(3, Math.floor(cycle * 4));
    const progress = cycle * 4 - quarter;
    const eased = FOCUS_MOTION_EASINGS[easing](progress);
    if (quarter === 0) return eased;
    if (quarter === 1) return 1 - eased;
    if (quarter === 2) return -eased;
    return -1 + eased;
}

function deviateFromBase(baseValue, wave, variationRatio) {
    const base = clamp(finiteOr(baseValue, 0), 0, 100);
    const reach = wave >= 0 ? 100 - base : base;
    return clamp(base + wave * reach * variationRatio, 0, 100);
}

export function sampleEyeAnimationTimeline(timeline, rawTimeMs, baseExpression = {}) {
    const timeMs = wrapTime(finiteOr(rawTimeMs, 0), timeline.durationMs);
    const blinkAmount = timeline.blinkEvents.reduce((maximum, event) => {
        const localTime = wrapTime(timeMs - event.startMs, timeline.durationMs);
        return Math.max(maximum, blinkShape(localTime, event.timing));
    }, 0);
    const phase = timeMs / timeline.durationMs;
    const variationRatio = timeline.emotionVariation / 100;
    return {
        timeMs,
        blinkAmount,
        cute: deviateFromBase(
            baseExpression.cute,
            easedOscillation(phase, 1, timeline.easing),
            variationRatio
        ),
        angry: deviateFromBase(
            baseExpression.angry,
            easedOscillation(phase, 2, timeline.easing),
            variationRatio
        )
    };
}
