import {
    generateFocusPathForSettings,
    rebuildFocusPath
} from '../animation/focusPath.js?v=20260828-1';
import {
    createFocusTimeline,
    resolveFocusStops,
    sampleFocusTimeline
} from '../animation/focusTimeline.js?v=20260826-1';
import {
    createEyeAnimationTimeline,
    createLoopEyeAnimationTimeline
} from '../animation/eyeTimeline.js?v=20260828-2';
import {
    createStationaryLoopTimeline,
    sampleLoopFocus
} from '../animation/loopTimeline.js?v=20260827-1';
import { BOLID_EYE_MOTION_TIME_CONSTANT, advanceEyeMotionToTarget, createEyeMotionState } from '../animation/eyeMotion.js?v=20260828-1';
import { buildAnimationFrameScene } from '../render/animationFrameRenderer.js?v=lottie-1';
const EYE_MOTION_WARMUP_FRAMES = 24;

export function createMotion(settings, startFocus, motionPath = null) {
    if (settings.focusMode === 'bolid') {
        const timeline = createStationaryLoopTimeline(startFocus, settings.motionDuration);
        const eyeTimeline = createLoopEyeAnimationTimeline(timeline, {
            blinkCount: settings.motionBlinkCount,
            pairedBlinks: true,
            emotionVariation: settings.motionEmotionVariation
        });
        return { path: null, timeline, eyeTimeline };
    }
    const path = motionPath
        ? rebuildFocusPath(motionPath)
        : generateFocusPathForSettings(settings, startFocus);
    const stops = resolveFocusStops(settings.motionStopCount, path.anchors.length);
    const timeline = createFocusTimeline(path, {
        duration: settings.motionDuration,
        ...stops,
        speedVariation: settings.motionSpeedVariation,
        easing: 'ease-in-out',
        seed: settings.motionSeed
    });
    const eyeTimeline = createEyeAnimationTimeline(timeline, {
        blinkCount: settings.motionBlinkCount,
        blinkAtStops: true,
        emotionVariation: settings.motionEmotionVariation,
        easing: 'ease-in-out'
    });
    return { path, timeline, eyeTimeline };
}

export const sampleMotionFocus = (timeline, timeMs) => (
    sampleLoopFocus(timeline, timeMs, sampleFocusTimeline).point
);

export function createLoopingEyeMotion(settings, timeline, frameCount, fps) {
    const motion = createEyeMotionState(
        settings.focusMode === 'bolid' ? BOLID_EYE_MOTION_TIME_CONSTANT : undefined
    );
    const frameDuration = 1000 / fps;
    const warmupCount = Math.min(
        frameCount,
        settings.focusMode === 'bolid' ? 40 : EYE_MOTION_WARMUP_FRAMES
    );
    for (let index = frameCount - warmupCount; index < frameCount; index += 1) {
        const timeMs = index * frameDuration;
        const focus = sampleMotionFocus(timeline, timeMs);
        const scene = buildAnimationFrameScene(settings, focus, {
            timeMs,
            durationMs: timeline.durationMs
        });
        advanceEyeMotionToTarget(
            motion,
            scene.eyes.pairCenter,
            frameDuration,
            scene.eyes.fitScale
        );
    }
    return motion;
}

