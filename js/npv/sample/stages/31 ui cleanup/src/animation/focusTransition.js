export const CENTER_FOCUS_TRANSITION_DURATION_MS = 280;

const PROJECT_STANDARD_EASING = Object.freeze({
    x1: 0.4,
    y1: 0,
    x2: 0.2,
    y2: 1
});

const finiteOr = (value, fallback) => Number.isFinite(Number(value))
    ? Number(value)
    : fallback;

const clampProgress = (value) => Math.max(0, Math.min(1, finiteOr(value, 0)));

const cubicBezierCoordinate = (time, control1, control2) => {
    const inverse = 1 - time;
    return (3 * inverse * inverse * time * control1)
        + (3 * inverse * time * time * control2)
        + (time * time * time);
};

export function projectStandardEasing(rawProgress) {
    const progress = clampProgress(rawProgress);
    if (progress === 0 || progress === 1) return progress;

    let lower = 0;
    let upper = 1;
    for (let iteration = 0; iteration < 20; iteration += 1) {
        const time = (lower + upper) / 2;
        const x = cubicBezierCoordinate(
            time,
            PROJECT_STANDARD_EASING.x1,
            PROJECT_STANDARD_EASING.x2
        );
        if (x < progress) lower = time;
        else upper = time;
    }

    return cubicBezierCoordinate(
        (lower + upper) / 2,
        PROJECT_STANDARD_EASING.y1,
        PROJECT_STANDARD_EASING.y2
    );
}

export function sampleCenterFocusTransition(start, end, rawProgress) {
    const progress = projectStandardEasing(rawProgress);
    return {
        x: finiteOr(start?.x, 0) + (finiteOr(end?.x, 0) - finiteOr(start?.x, 0)) * progress,
        y: finiteOr(start?.y, 0) + (finiteOr(end?.y, 0) - finiteOr(start?.y, 0)) * progress
    };
}
