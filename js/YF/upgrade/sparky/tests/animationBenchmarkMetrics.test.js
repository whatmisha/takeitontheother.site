import assert from 'node:assert/strict';
import test from 'node:test';

import {
    percentile,
    summarizeTimings,
    summarizeWorkerMetrics
} from '../src/benchmark/animationBenchmarkMetrics.js';

test('animation benchmark timing summaries use stable nearest-rank percentiles', () => {
    assert.equal(percentile([9, 1, 5, 3], 0.5), 3);
    assert.equal(percentile([9, 1, 5, 3], 0.95), 9);
    assert.deepEqual(summarizeTimings([5, 10, 20, 40], {
        frameBudgetMs: 16.7,
        droppedBudgetMs: 33.3
    }), {
        samples: 4,
        totalMs: 75,
        meanMs: 18.75,
        p50Ms: 10,
        p95Ms: 40,
        maxMs: 40,
        framesOverBudget: 2,
        droppedFrames: 1,
        droppedFrameRate: 0.25
    });
});

test('worker metrics expose comparable per-frame phases and memory ratios', () => {
    const summary = summarizeWorkerMetrics({
        frameCount: 60,
        totalMs: 1200,
        characterMs: 300,
        eyesMs: 480,
        outputBytes: 1000,
        peakKnownBytes: 2500,
        intermediateFlushes: 4,
        maxEncodeQueueSize: 9
    });

    assert.equal(summary.framesPerSecond, 50);
    assert.equal(summary.phases.characterMs.perFrameMs, 5);
    assert.equal(summary.phases.eyesMs.perFrameMs, 8);
    assert.equal(summary.peakMemoryToFileRatio, 2.5);
    assert.equal(summary.intermediateFlushes, 4);
    assert.equal(summary.maxEncodeQueueSize, 9);
});
