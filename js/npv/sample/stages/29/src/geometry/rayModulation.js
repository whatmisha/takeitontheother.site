import { clamp } from './vector.js';

export const MAX_RAY_VARIATION_DEPTH = 0.6;

export const normalizeRayVariation = (value) => clamp(Number(value) || 0, 0, 100);
export const normalizeRayFrequency = (value) => clamp(Number(value) || 1, 1, 6);
export const normalizeRayPhase = (value) => clamp(Number(value) || 0, 0, 360);
export const normalizeRayMotion = (value) => clamp(Number(value) || 0, 0, 4);

export function rayModulationAmount(settings, index, count) {
    const frequency = normalizeRayFrequency(settings.rayModulationFrequency);
    const phase = (Number(settings.rayModulationPhase) || 0) * Math.PI / 180;
    const position = Math.max(0, Number(index) || 0) / Math.max(1, Number(count) || 1);
    return Math.sin(position * Math.PI * 2 * frequency + phase);
}

export function rayVariationFactor(value, modulation) {
    const depth = normalizeRayVariation(value) / 100 * MAX_RAY_VARIATION_DEPTH;
    return 1 + depth * modulation;
}

export function settingsAtRayMotionTime(settings, rawTimeMs, durationMs) {
    const motion = normalizeRayMotion(settings.rayMotion);
    const duration = Math.max(1, Number(durationMs) || Number(settings.motionDuration) * 1000 || 1000);
    const time = ((Number(rawTimeMs) || 0) % duration + duration) % duration;
    return {
        ...settings,
        rayModulationPhase: normalizeRayPhase(settings.rayModulationPhase)
            + motion * 360 * time / duration
    };
}
