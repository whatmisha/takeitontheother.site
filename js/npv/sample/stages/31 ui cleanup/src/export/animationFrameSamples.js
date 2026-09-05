import { sampleEyeAnimationTimeline } from '../animation/eyeTimeline.js?v=20260828-2';
import { sampleFocusTimeline } from '../animation/focusTimeline.js?v=20260826-1';
import { sampleLoopFocus } from '../animation/loopTimeline.js?v=20260827-1';
import { settingsAtBolidTime } from '../animation/bolid.js?v=20260828-3';

export function createAnimationFrameSamples(
    timeline,
    eyeTimeline,
    settings,
    frameCount,
    fps
) {
    const count = Math.max(0, Math.round(Number(frameCount) || 0));
    const rate = Math.max(1, Number(fps) || 60);
    const focusX = new Float64Array(count);
    const focusY = new Float64Array(count);
    // Float64 preserves the exact JS Number values used by the previous
    // per-frame sampler, keeping pixel parity while still providing compact,
    // contiguous lookup tables.
    const blink = new Float64Array(count);
    const cute = new Float64Array(count);
    const angry = new Float64Array(count);

    for (let index = 0; index < count; index += 1) {
        const timeMs = index * 1000 / rate;
        const focus = sampleLoopFocus(timeline, timeMs, sampleFocusTimeline).point;
        const expression = settingsAtBolidTime(settings, timeMs, timeline.durationMs);
        const eyes = sampleEyeAnimationTimeline(eyeTimeline, timeMs, expression);
        focusX[index] = focus.x;
        focusY[index] = focus.y;
        blink[index] = eyes.blinkAmount;
        cute[index] = eyes.cute;
        angry[index] = eyes.angry;
    }

    return { count, fps: rate, focusX, focusY, blink, cute, angry };
}

export function sampleAnimationFrame(samples, rawIndex) {
    const index = Math.max(0, Math.min(
        samples.count - 1,
        Math.round(Number(rawIndex) || 0)
    ));
    return {
        focus: { x: samples.focusX[index], y: samples.focusY[index] },
        eyes: {
            blinkAmount: samples.blink[index],
            cute: samples.cute[index],
            angry: samples.angry[index]
        }
    };
}
