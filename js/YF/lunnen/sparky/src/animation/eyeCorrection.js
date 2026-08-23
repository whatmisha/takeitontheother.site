const mix = (from, to, amount) => from + (to - from) * amount;

export function createEyeCorrection(fromGeometry, targetGeometry, startTime, duration = 100) {
    return {
        from: {
            pairCenter: { ...fromGeometry.pairCenter },
            fitScale: fromGeometry.fitScale
        },
        to: {
            pairCenter: { ...targetGeometry.pairCenter },
            fitScale: targetGeometry.fitScale
        },
        targetGeometry,
        startTime,
        duration: Math.max(1, duration),
        placement: {
            pairCenter: { ...fromGeometry.pairCenter },
            fitScale: fromGeometry.fitScale
        }
    };
}

export function sampleEyeCorrection(correction, now) {
    const linear = Math.max(0, Math.min(1, (now - correction.startTime) / correction.duration));
    const eased = linear * linear * linear * (linear * (linear * 6 - 15) + 10);
    correction.placement = {
        pairCenter: {
            x: mix(correction.from.pairCenter.x, correction.to.pairCenter.x, eased),
            y: mix(correction.from.pairCenter.y, correction.to.pairCenter.y, eased)
        },
        fitScale: mix(correction.from.fitScale, correction.to.fitScale, eased)
    };
    return {
        placement: correction.placement,
        progress: linear,
        done: linear >= 1
    };
}

export function eyeCorrectionDistance(fromGeometry, targetGeometry) {
    return Math.hypot(
        fromGeometry.pairCenter.x - targetGeometry.pairCenter.x,
        fromGeometry.pairCenter.y - targetGeometry.pairCenter.y,
        (fromGeometry.fitScale - targetGeometry.fitScale) * 100
    );
}
