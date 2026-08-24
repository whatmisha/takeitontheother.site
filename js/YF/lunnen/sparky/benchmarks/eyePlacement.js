import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { buildCharacterGeometry } from '../src/geometry/characterGeometry.js';
import { buildEyeGeometry } from '../src/geometry/eyeGeometry.js';
import { distance } from '../src/geometry/vector.js';

const FRAME_COUNT = 120;
const FOCUS_RADIUS = 195.233;
const PARITY_LIMITS = Object.freeze({
    centerPx: 0.25,
    fitScale: 0.002,
    contourPx: 0.25
});
const CONTINUITY_LIMITS = Object.freeze({
    fitScaleStep: 0.081,
    cyclicCenterPx: 0.25,
    cyclicFitScale: 0.002,
    cyclicContourPx: 0.25
});
const PERFORMANCE_LIMITS = Object.freeze({
    localMeanMs: 8,
    localP95Ms: 12,
    framesOver16_7Ms: 3,
    minimumSpeedup: 1.1
});
const baseSettings = {
    rayWidth: 80,
    eyeSize: 30,
    eyePerspective: 50,
    roundness: 60,
    cornerSmoothing: 100
};

function settingsAt(index) {
    const angle = index / FRAME_COUNT * Math.PI * 2;
    return {
        ...baseSettings,
        focusX: 240 + Math.cos(angle) * FOCUS_RADIUS,
        focusY: 240 + Math.sin(angle) * FOCUS_RADIUS
    };
}

function percentile(sorted, amount) {
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * amount))];
}

function timingSummary(mode, durations) {
    const sorted = [...durations].sort((first, second) => first - second);
    const total = sorted.reduce((sum, duration) => sum + duration, 0);
    return {
        mode,
        meanMs: Number((total / sorted.length).toFixed(2)),
        p50Ms: Number(percentile(sorted, 0.5).toFixed(2)),
        p95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
        maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
        framesOver16_7Ms: sorted.filter((duration) => duration > 16.7).length
    };
}

function solverSummary(mode, entries) {
    const numericKeys = [
        'legacyMs',
        'opticalMs',
        'containmentEvaluations',
        'opticalEvaluations',
        'opticalCacheHits',
        'sampleChecks',
        'edgeChecks',
        'crossingChecks',
        'bvhNodeChecks',
        'earlyExits'
    ];
    const averages = Object.fromEntries(numericKeys.map((key) => [
        key,
        Number((entries.reduce((sum, entry) => sum + entry[key], 0) / entries.length).toFixed(2))
    ]));
    const fallbackReasons = entries.reduce((counts, entry) => {
        const reason = entry.fallbackReason || 'none';
        counts[reason] = (counts[reason] || 0) + 1;
        return counts;
    }, {});
    return { mode, averages, fallbackReasons };
}

function maximumContourDelta(interactive, global) {
    let maximum = 0;
    ['left', 'right'].forEach((side) => {
        ['eye1', 'top', 'bottom'].forEach((shape) => {
            interactive[side][shape].points.forEach((value, index) => {
                maximum = Math.max(
                    maximum,
                    distance(value, global[side][shape].points[index])
                );
            });
        });
    });
    return maximum;
}

function eyePaths(geometry) {
    return ['left', 'right'].flatMap((side) => (
        ['eye1', 'top', 'bottom'].map((shape) => geometry[side][shape].path)
    ));
}

async function verifySettleContract(lastInteractive) {
    const before = eyePaths(lastInteractive);
    const toolSource = await readFile(new URL('../tool.js', import.meta.url), 'utf8');
    const settleBody = toolSource.match(
        /function finishInteractivePlacement\([^)]*\)\s*\{([\s\S]*?)\n\}/
    )?.[1] || '';
    const schedulesVisualRecalculation = /setTimeout|requestAnimationFrame|\.render(?:Now)?\s*\(/
        .test(settleBody);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const after = eyePaths(lastInteractive);
    return {
        waitMs: 180,
        pathsUnchanged: before.every((path, index) => path === after[index]),
        settleSchedulesVisualRecalculation: schedulesVisualRecalculation
    };
}

function runParityBenchmark() {
    const initialSettings = settingsAt(0);
    const initialHead = buildCharacterGeometry(initialSettings);
    let previousInteractive = buildEyeGeometry(initialHead.values, initialHead, {
        placementMode: 'global'
    });
    const initialInteractive = previousInteractive;
    const localDurations = [];
    const globalDurations = [];
    const localSolverMetrics = [];
    const globalSolverMetrics = [];
    const parity = {
        maxCenterPx: 0,
        maxFitScale: 0,
        maxContourPx: 0,
        worstFrame: 0,
        allContained: true
    };
    const continuity = {
        maxFitScaleStep: 0,
        maxPairCenterStep: 0,
        globalFallbacks: 0,
        cyclicCenterPx: 0,
        cyclicFitScale: 0,
        cyclicContourPx: 0
    };

    for (let index = 1; index <= FRAME_COUNT; index += 1) {
        const settings = settingsAt(index);
        const head = buildCharacterGeometry(settings);
        const previousFrame = previousInteractive;

        let startedAt = performance.now();
        const interactive = buildEyeGeometry(head.values, head, {
            placementMode: 'local',
            previousEyeGeometry: previousFrame
        });
        localDurations.push(performance.now() - startedAt);
        localSolverMetrics.push(interactive.solverMetrics);
        continuity.maxFitScaleStep = Math.max(
            continuity.maxFitScaleStep,
            Math.abs(interactive.fitScale - previousFrame.fitScale)
        );
        continuity.maxPairCenterStep = Math.max(
            continuity.maxPairCenterStep,
            distance(interactive.pairCenter, previousFrame.pairCenter)
        );
        if (interactive.placementMode !== 'local') continuity.globalFallbacks += 1;

        startedAt = performance.now();
        const global = buildEyeGeometry(head.values, head, {
            placementMode: 'global',
            previousEyeGeometry: previousFrame
        });
        globalDurations.push(performance.now() - startedAt);
        globalSolverMetrics.push(global.solverMetrics);

        const centerDelta = distance(interactive.pairCenter, global.pairCenter);
        const scaleDelta = Math.abs(interactive.fitScale - global.fitScale);
        const contourDelta = maximumContourDelta(interactive, global);
        if (centerDelta > parity.maxCenterPx) {
            parity.maxCenterPx = centerDelta;
            parity.worstFrame = index;
        }
        parity.maxFitScale = Math.max(parity.maxFitScale, scaleDelta);
        parity.maxContourPx = Math.max(parity.maxContourPx, contourDelta);
        parity.allContained = parity.allContained
            && interactive.minClearance + 0.025 >= interactive.guard
            && global.minClearance + 0.025 >= global.guard;
        previousInteractive = interactive;
    }
    continuity.cyclicCenterPx = distance(
        initialInteractive.pairCenter,
        previousInteractive.pairCenter
    );
    continuity.cyclicFitScale = Math.abs(
        initialInteractive.fitScale - previousInteractive.fitScale
    );
    continuity.cyclicContourPx = maximumContourDelta(initialInteractive, previousInteractive);

    return {
        parity,
        continuity,
        lastInteractive: previousInteractive,
        results: [
            timingSummary('global', globalDurations),
            timingSummary('local', localDurations)
        ],
        phases: [
            solverSummary('global', globalSolverMetrics),
            solverSummary('local', localSolverMetrics)
        ]
    };
}

// Warm the geometry code before collecting comparable timings.
runParityBenchmark();
const benchmark = runParityBenchmark();
const settle = await verifySettleContract(benchmark.lastInteractive);
const speedup = benchmark.results[0].meanMs / Math.max(0.01, benchmark.results[1].meanMs);
const localTiming = benchmark.results[1];
const passed = benchmark.parity.maxCenterPx < PARITY_LIMITS.centerPx
    && benchmark.parity.maxFitScale < PARITY_LIMITS.fitScale
    && benchmark.parity.maxContourPx < PARITY_LIMITS.contourPx
    && benchmark.parity.allContained
    && benchmark.continuity.maxFitScaleStep <= CONTINUITY_LIMITS.fitScaleStep
    && benchmark.continuity.cyclicCenterPx < CONTINUITY_LIMITS.cyclicCenterPx
    && benchmark.continuity.cyclicFitScale < CONTINUITY_LIMITS.cyclicFitScale
    && benchmark.continuity.cyclicContourPx < CONTINUITY_LIMITS.cyclicContourPx
    && benchmark.continuity.globalFallbacks === 0
    && localTiming.meanMs < PERFORMANCE_LIMITS.localMeanMs
    && localTiming.p95Ms < PERFORMANCE_LIMITS.localP95Ms
    && localTiming.framesOver16_7Ms <= PERFORMANCE_LIMITS.framesOver16_7Ms
    && speedup >= PERFORMANCE_LIMITS.minimumSpeedup
    && settle.pathsUnchanged
    && !settle.settleSchedulesVisualRecalculation;

console.log(JSON.stringify({
    passed,
    frames: FRAME_COUNT,
    speedup: Number(speedup.toFixed(2)),
    limits: {
        parity: PARITY_LIMITS,
        continuity: CONTINUITY_LIMITS,
        performance: PERFORMANCE_LIMITS
    },
    parity: {
        ...benchmark.parity,
        maxCenterPx: Number(benchmark.parity.maxCenterPx.toFixed(4)),
        maxFitScale: Number(benchmark.parity.maxFitScale.toFixed(6)),
        maxContourPx: Number(benchmark.parity.maxContourPx.toFixed(4))
    },
    continuity: Object.fromEntries(Object.entries(benchmark.continuity).map(([key, value]) => [
        key,
        typeof value === 'number' ? Number(value.toFixed(6)) : value
    ])),
    settle,
    results: benchmark.results,
    phases: benchmark.phases
}, null, 2));

if (!passed) process.exitCode = 1;
