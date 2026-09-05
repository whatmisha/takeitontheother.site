export function percentile(values, amount) {
    if (!values.length) return 0;
    const sorted = [...values].sort((first, second) => first - second);
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil(sorted.length * amount) - 1)
    );
    return sorted[index];
}

const rounded = (value, digits = 3) => Number((Number(value) || 0).toFixed(digits));

export function summarizeTimings(values, {
    frameBudgetMs = 1000 / 60,
    droppedBudgetMs = frameBudgetMs
} = {}) {
    const totalMs = values.reduce((sum, value) => sum + value, 0);
    const framesOverBudget = values.filter((value) => value > frameBudgetMs).length;
    const droppedFrames = values.filter((value) => value > droppedBudgetMs).length;
    return {
        samples: values.length,
        totalMs: rounded(totalMs),
        meanMs: rounded(values.length ? totalMs / values.length : 0),
        p50Ms: rounded(percentile(values, 0.5)),
        p95Ms: rounded(percentile(values, 0.95)),
        maxMs: rounded(values.length ? Math.max(...values) : 0),
        framesOverBudget,
        droppedFrames,
        droppedFrameRate: rounded(values.length ? droppedFrames / values.length : 0, 5)
    };
}

export function summarizeWorkerMetrics(metrics) {
    const frames = Math.max(1, Number(metrics?.frameCount) || 1);
    const phaseKeys = [
        'characterMs',
        'eyesMs',
        'lidsMs',
        'canvasDrawMs',
        'timelineMs',
        'samplePrecomputeMs',
        'eyeWarmupMs',
        'pngEncodeMs',
        'zipPackageMs',
        'videoSubmitMs',
        'backpressureWaitMs',
        'encoderFlushMs',
        'mp4MuxMs'
    ];
    const phases = Object.fromEntries(phaseKeys.map((key) => [key, {
        totalMs: rounded(metrics?.[key]),
        perFrameMs: rounded((metrics?.[key] || 0) / frames)
    }]));
    const totalMs = Number(metrics?.totalMs) || 0;
    const outputBytes = Number(metrics?.outputBytes) || 0;
    const peakKnownBytes = Number(metrics?.peakKnownBytes) || 0;
    return {
        frameCount: frames,
        totalMs: rounded(totalMs),
        framesPerSecond: rounded(totalMs > 0 ? frames * 1000 / totalMs : 0),
        outputBytes,
        peakKnownBytes,
        peakMemoryToFileRatio: rounded(outputBytes > 0 ? peakKnownBytes / outputBytes : 0),
        bufferedPngBytes: Number(metrics?.bufferedPngBytes) || 0,
        intermediateFlushes: Number(metrics?.intermediateFlushes) || 0,
        backpressureWaits: Number(metrics?.backpressureWaits) || 0,
        maxEncodeQueueSize: Number(metrics?.maxEncodeQueueSize) || 0,
        phases
    };
}
