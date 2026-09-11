import { cascadeStageCount } from './cascadeGeometry.js';

export const CASCADE_EXPORT_FPS = 60;
export const CASCADE_EXPORT_MAX_SIZE = 1080;

const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizePhase = (phase) => ((finiteNumber(phase, 0) % 1) + 1) % 1;

export function stepDuration(settings = {}) {
    return clamp(finiteNumber(settings.stepDuration, 0.5), 0.1, 2);
}

export function motionStepCount(settings = {}) {
    return cascadeStageCount(settings) * 2;
}

export function motionLoopDuration(settings = {}) {
    return stepDuration(settings) * motionStepCount(settings);
}

export function motionFrameCount(settings = {}, fps = CASCADE_EXPORT_FPS) {
    return Math.max(1, Math.round(motionLoopDuration(settings) * fps));
}

export function motionPhaseAtTime(elapsedSeconds, settings = {}, startPhase = 0) {
    return normalizePhase(startPhase + Math.max(0, finiteNumber(elapsedSeconds, 0)) / motionLoopDuration(settings));
}

export function advanceMotionPhase(phase, elapsedMilliseconds, settings = {}) {
    return motionPhaseAtTime(Math.max(0, finiteNumber(elapsedMilliseconds, 0)) / 1000, settings, phase);
}

export function cascadeGenerationAtPhase(phase, settings = {}) {
    const stageCount = cascadeStageCount(settings);
    const stepCount = stageCount * 2;
    const step = Math.min(stepCount - 1, Math.floor(normalizePhase(phase) * stepCount));
    return step < stageCount ? step : stepCount - 1 - step;
}

export function animationExportDimensions(settings = {}, maxSize = CASCADE_EXPORT_MAX_SIZE) {
    const width = Math.max(2, finiteNumber(settings.width, 768));
    const height = Math.max(2, finiteNumber(settings.height, 1000));
    const scale = maxSize / Math.max(width, height);
    const even = (value) => Math.max(2, Math.round(value / 2) * 2);
    return { width: even(width * scale), height: even(height * scale) };
}
