export const CENTER_FOCUS_TRANSITION_DURATION_MS = 420;

const finiteOr = (value, fallback) => Number.isFinite(Number(value))
    ? Number(value)
    : fallback;

export function sampleLinearFocusTransition(start, end, rawProgress) {
    const progress = Math.max(0, Math.min(1, finiteOr(rawProgress, 0)));
    return {
        x: finiteOr(start?.x, 0) + (finiteOr(end?.x, 0) - finiteOr(start?.x, 0)) * progress,
        y: finiteOr(start?.y, 0) + (finiteOr(end?.y, 0) - finiteOr(start?.y, 0)) * progress
    };
}
