import { BLINK_TIMING } from './blink.js';
import { FOCUS_MOTION_EASINGS } from './focusTimeline.js?v=20260825-8';
import { clamp } from '../geometry/vector.js';

const BASE_BLINK_DURATION = BLINK_TIMING.close + BLINK_TIMING.hold + BLINK_TIMING.open;
export const MAX_BLINKS_PER_STOP = 2;
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

function fixedBlinkTiming() {
    return {
        close: BLINK_TIMING.close,
        hold: BLINK_TIMING.hold,
        open: BLINK_TIMING.open,
        duration: BASE_BLINK_DURATION
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
                centerMs: (hold.startMs + hold.endMs) / 2
            }];
        }
        if (anchorIndex === 0) {
            return [{ anchorIndex, centerMs: 0 }];
        }
        const arrival = focusTimeline.entries.find((entry) => (
            entry.type === 'move'
            && entry.endAnchorIndex === anchorIndex
        ));
        return [{
            anchorIndex,
            centerMs: arrival?.endMs || 0
        }];
    });
}

function distributeAssignments(count, stops) {
    const assignments = new Map(stops.map((stop) => [stop, []]));
    const assignedCount = Math.min(count, stops.length * MAX_BLINKS_PER_STOP);
    for (let index = 0; index < assignedCount; index += 1) {
        const stopIndex = assignedCount <= stops.length
            ? assignedCount === 1
                ? 0
                : Math.round(index * (stops.length - 1) / (assignedCount - 1))
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
        const timing = fixedBlinkTiming();
        indices.forEach((_, localIndex) => {
            const centerMs = stop.centerMs + localIndex * BASE_BLINK_DURATION;
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
        const timing = fixedBlinkTiming();
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
    const blinkEvents = count <= 0
        ? []
        : onlyAtStops
            ? createStopBlinkEvents(focusTimeline, count)
            : createFreeBlinkEvents(focusTimeline, count);
    return {
        durationMs: focusTimeline.durationMs,
        focusTimeline,
        requestedBlinkCount: count,
        blinkCount: blinkEvents.length,
        blinkAtStops: onlyAtStops,
        emotionVariation: clamp(finiteOr(emotionVariation, 0), 0, 100),
        easing: FOCUS_MOTION_EASINGS[easing] ? easing : 'ease-in-out',
        blinkEvents
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
