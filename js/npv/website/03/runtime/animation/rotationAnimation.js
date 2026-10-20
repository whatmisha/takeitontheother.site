const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function rotationPreviewOffsets(
    progress,
    axis = 'y',
    degrees = 360,
    easing = 'smootherstep'
) {
    const time = clamp(Number(progress) || 0, 0, 1);
    const eased = easing === 'linear'
        ? time
        : time * time * time * (time * (time * 6 - 15) + 10);
    const angle = Number(degrees) * eased;
    return {
        rotationX: axis === 'x' ? angle : 0,
        rotationY: axis === 'y' ? angle : 0,
        rotationZ: axis === 'z' ? angle : 0
    };
}

export function rotationFrameOptions(settings, frameIndex, frameCount) {
    const animation = settings.rotationAnimation;
    const lastFrame = Math.max(1, Number(frameCount) - 1);
    return rotationPreviewOffsets(
        Number(frameIndex) / lastFrame,
        animation.axis,
        animation.degrees,
        animation.easing
    );
}

export function rotationFrameCount(settings, fps = 60) {
    return Math.max(1, Math.round(Number(settings.rotationAnimation.duration) * fps));
}
