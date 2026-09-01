import { clamp } from '../geometry/vector.js';

export const normalizeMotionBlur = (value) => clamp(Number(value) || 0, 0, 100);

export function resolveMotionBlur(value) {
    const strength = normalizeMotionBlur(value);
    if (strength <= 0) {
        return { strength, sampleCount: 1, shutterFrames: 0, offsets: [0] };
    }
    const sampleCount = strength <= 25 ? 3
        : strength <= 50 ? 5
            : strength <= 75 ? 7
                : 9;
    const shutterFrames = 3 * strength / 100;
    const offsets = Array.from({ length: sampleCount }, (_, index) => (
        (index / (sampleCount - 1) - 0.5) * shutterFrames
    ));
    return { strength, sampleCount, shutterFrames, offsets };
}

export function wrapMotionBlurTime(timeMs, durationMs) {
    if (!(durationMs > 0)) return 0;
    return ((timeMs % durationMs) + durationMs) % durationMs;
}

export function previewMotionBlurDeviation(value) {
    return 2.4 * normalizeMotionBlur(value) / 100;
}

export function previewMotionBlurTrail(current, previous, maxLength = 18) {
    const x = (Number(previous?.x) || 0) - (Number(current?.x) || 0);
    const y = (Number(previous?.y) || 0) - (Number(current?.y) || 0);
    const length = Math.hypot(x, y);
    if (length <= 1e-6) return { x: 0, y: 0, length: 0 };
    const scale = Math.min(1, Math.max(0, Number(maxLength) || 0) / length);
    return { x: x * scale, y: y * scale, length: length * scale };
}

export function resolvePreviewMotionBlurGhosts(value, { reduced = false } = {}) {
    const blur = resolveMotionBlur(value);
    if (blur.sampleCount === 1) return [];
    const desiredCount = blur.strength <= 33 ? 1 : blur.strength <= 66 ? 2 : 3;
    const count = reduced ? 1 : desiredCount;
    const strength = blur.strength / 100;
    return Array.from({ length: count }, (_, index) => {
        const amount = (index + 1) / count;
        return {
            offsetFrames: -blur.shutterFrames * amount,
            opacity: strength * (0.2 - amount * 0.1)
        };
    }).reverse();
}
