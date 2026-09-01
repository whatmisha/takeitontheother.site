import { createEyeMotionState, advanceEyeMotionToTarget } from '../src/animation/eyeMotion.js';
import { createEyeAnimationTimeline, sampleEyeAnimationTimeline } from '../src/animation/eyeTimeline.js';
import { generateFocusPathForSettings } from '../src/animation/focusPath.js';
import {
    createFocusTimeline,
    resolveFocusStops,
    sampleFocusTimeline
} from '../src/animation/focusTimeline.js';
import { buildCharacterGeometry } from '../src/geometry/characterGeometry.js';
import { buildEyeGeometry, buildEyeLidGeometry } from '../src/geometry/eyeGeometry.js';
import {
    summarizeTimings,
    summarizeWorkerMetrics
} from '../src/benchmark/animationBenchmarkMetrics.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PREVIEW_FPS = 30;
const EXPORT_FPS = 60;
const START_FOCUS = Object.freeze({ x: 240, y: 240 });
const BASE_SETTINGS = Object.freeze({
    coordinateSpaceVersion: 2,
    width: 480,
    height: 480,
    boundaryType: 'circle',
    boundaryCenterX: 240,
    boundaryCenterY: 240,
    boundaryRadius: 240,
    boundaryRadiusX: 240,
    boundaryRadiusY: 240,
    boundaryRotation: 0,
    focusAngle: 0,
    focusDistance: 0,
    focusX: 240,
    focusY: 240,
    rayCount: 5,
    centerAngle: -90,
    angleStep: 36,
    angleSpan: 144,
    rayLength: 240,
    rayWidth: 80,
    roundness: 60,
    cornerSmoothing: 100,
    rayOverrides: [{}, {}, {}, {}, {}],
    headColor: '#ffffff',
    eyeColor: '#000000',
    backgroundColor: '#000000',
    showSphere: false,
    showRayGuides: false,
    showBisectors: false,
    showPoint: false,
    showMotionPath: false,
    followCursor: false,
    eyePerspective: 100,
    eyeSize: 50,
    eyeDistance: 0,
    cute: 50,
    angry: 0,
    motionEmotionVariation: 50,
    motionSeed: 0x51f15e
});

export const ANIMATION_BENCHMARK_SCENARIOS = Object.freeze([
    Object.freeze({
        id: 'short-light',
        duration: 1,
        points: 2,
        complexity: 0,
        stops: 0,
        blinks: 0
    }),
    Object.freeze({
        id: 'medium-balanced',
        duration: 5,
        points: 6,
        complexity: 50,
        stops: 40,
        blinks: 2
    }),
    Object.freeze({
        id: 'long-heavy',
        duration: 10,
        points: 16,
        complexity: 100,
        stops: 100,
        blinks: 12
    })
]);

const now = () => performance.now();
const rounded = (value, digits = 3) => Number((Number(value) || 0).toFixed(digits));

function settingsFor(scenario) {
    return {
        ...BASE_SETTINGS,
        focusMode: 'animate',
        motionDuration: scenario.duration,
        motionPointCount: scenario.points,
        motionComplexity: scenario.complexity,
        motionStops: scenario.stops,
        motionBlinkCount: scenario.blinks
    };
}

function createMotion(settings) {
    const path = generateFocusPathForSettings(settings, START_FOCUS);
    const stops = resolveFocusStops(settings.motionStops);
    const timeline = createFocusTimeline(path, {
        duration: settings.motionDuration,
        ...stops,
        easing: 'ease-in-out',
        seed: settings.motionSeed
    });
    const eyes = createEyeAnimationTimeline(timeline, {
        blinkCount: settings.motionBlinkCount,
        blinkAtStops: true,
        emotionVariation: settings.motionEmotionVariation,
        easing: 'ease-in-out'
    });
    return { path, timeline, eyes };
}

function svgPath(path, fill) {
    const element = document.createElementNS(SVG_NS, 'path');
    element.setAttribute('d', path);
    element.setAttribute('fill', fill);
    return element;
}

function replacePreview(svg, settings, character, eyes, lids, eyeOffset) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('transform', `translate(${eyeOffset.x} ${eyeOffset.y})`);
    ['left', 'right'].forEach((side) => {
        group.append(
            svgPath(eyes[side].eye1.path, settings.eyeColor),
            svgPath(lids[side].top.path, settings.headColor),
            svgPath(lids[side].bottom.path, settings.headColor)
        );
    });
    svg.replaceChildren(svgPath(character.rounded.path, settings.headColor), group);
    // Force style/layout work so DOM timings are comparable across runs.
    void svg.getBoundingClientRect().width;
}

function createPreviewSurface() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 480 480');
    Object.assign(svg.style, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        width: '480px',
        height: '480px',
        visibility: 'visible'
    });
    document.body.appendChild(svg);
    return svg;
}

function measurePreviewFrame({
    svg,
    settings,
    motion,
    frameIndex,
    previousEyes,
    eyeMotion,
    timings
}) {
    const frameStartedAt = now();
    const timeMs = frameIndex * 1000 / PREVIEW_FPS;
    const focus = sampleFocusTimeline(motion.timeline, timeMs).point;
    const eyeState = sampleEyeAnimationTimeline(motion.eyes, timeMs, settings);
    const frameSettings = { ...settings, focusX: focus.x, focusY: focus.y };

    let startedAt = now();
    const character = buildCharacterGeometry(frameSettings);
    timings.character.push(now() - startedAt);

    startedAt = now();
    const eyes = buildEyeGeometry(frameSettings, character, {
        placementMode: 'local',
        previousEyeGeometry: previousEyes
    });
    timings.eyes.push(now() - startedAt);

    startedAt = now();
    const lids = buildEyeLidGeometry({
        cute: eyeState.cute + (100 - eyeState.cute) * eyeState.blinkAmount,
        angry: eyeState.angry + (100 - eyeState.angry) * eyeState.blinkAmount,
        lidClosure: eyeState.blinkAmount
    }, eyes);
    timings.lids.push(now() - startedAt);
    const eyeOffset = advanceEyeMotionToTarget(
        eyeMotion,
        eyes.pairCenter,
        1000 / PREVIEW_FPS
    );

    startedAt = now();
    replacePreview(svg, frameSettings, character, eyes, lids, eyeOffset);
    timings.dom.push(now() - startedAt);
    timings.total.push(now() - frameStartedAt);
    return eyes;
}

async function benchmarkPreview(scenario) {
    const settings = settingsFor(scenario);
    const motion = createMotion(settings);
    const svg = createPreviewSurface();
    const initialCharacter = buildCharacterGeometry(settings);
    let previousEyes = buildEyeGeometry(settings, initialCharacter, { placementMode: 'global' });
    const eyeMotion = createEyeMotionState();
    const timings = { total: [], character: [], eyes: [], lids: [], dom: [] };

    for (let index = -12; index < 0; index += 1) {
        const warmupTimings = { total: [], character: [], eyes: [], lids: [], dom: [] };
        previousEyes = measurePreviewFrame({
            svg,
            settings,
            motion,
            frameIndex: Math.max(0, index + 12),
            previousEyes,
            eyeMotion,
            timings: warmupTimings
        });
    }

    const frameCount = Math.round(scenario.duration * PREVIEW_FPS);
    for (let index = 0; index < frameCount; index += 1) {
        previousEyes = measurePreviewFrame({
            svg,
            settings,
            motion,
            frameIndex: index,
            previousEyes,
            eyeMotion,
            timings
        });
        if ((index + 1) % 60 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    svg.remove();

    const summaryOptions = {
        frameBudgetMs: 1000 / 60,
        droppedBudgetMs: 1000 / PREVIEW_FPS
    };
    return {
        scenario,
        frameCount,
        total: summarizeTimings(timings.total, summaryOptions),
        phases: {
            character: summarizeTimings(timings.character, summaryOptions),
            eyes: summarizeTimings(timings.eyes, summaryOptions),
            lids: summarizeTimings(timings.lids, summaryOptions),
            dom: summarizeTimings(timings.dom, summaryOptions)
        }
    };
}

async function readMemory() {
    if (performance.memory?.usedJSHeapSize) {
        return { bytes: performance.memory.usedJSHeapSize, source: 'performance.memory' };
    }
    if (typeof performance.measureUserAgentSpecificMemory === 'function') {
        try {
            const result = await Promise.race([
                performance.measureUserAgentSpecificMemory(),
                new Promise((resolve) => setTimeout(() => resolve(null), 1000))
            ]);
            if (result) {
                return { bytes: result.bytes, source: 'measureUserAgentSpecificMemory' };
            }
        } catch {
            // Precise memory measurement may be unavailable despite a capable browser.
        }
    }
    return { bytes: 0, source: 'unavailable' };
}

async function runWorkerExport(scenario, format) {
    const settings = settingsFor(scenario);
    const jobId = `benchmark-${scenario.id}-${format}-${Date.now()}`;
    const worker = new Worker(
        new URL('../src/export/animationExportWorker.js?benchmark=20260825-1', import.meta.url),
        { type: 'module' }
    );
    const timerLatencies = [];
    let expectedTimer = now() + 16;
    const timer = setInterval(() => {
        const current = now();
        timerLatencies.push(Math.max(0, current - expectedTimer));
        expectedTimer = current + 16;
    }, 16);
    const initialMemory = await readMemory();
    let peakMemoryBytes = initialMemory.bytes;
    let memorySource = initialMemory.source;
    let memoryProbe = Promise.resolve();
    const sampleMemory = () => {
        memoryProbe = memoryProbe.then(async () => {
            const sample = await readMemory();
            peakMemoryBytes = Math.max(peakMemoryBytes, sample.bytes);
            memorySource = sample.source;
        });
    };
    const startedAt = now();

    try {
        const result = await new Promise((resolve, reject) => {
            worker.addEventListener('message', (event) => {
                const message = event.data;
                if (message?.jobId !== jobId) return;
                if (message.type === 'progress') {
                    sampleMemory();
                    return;
                }
                if (message.type === 'complete') {
                    resolve(message);
                    return;
                }
                reject(new Error(message.message || `${format} benchmark failed`));
            });
            worker.addEventListener('error', (event) => {
                reject(new Error(event.message || `${format} benchmark worker failed`));
            }, { once: true });
            worker.postMessage({
                type: 'export',
                jobId,
                format,
                settings,
                startFocus: START_FOCUS,
                baseName: `benchmark-${scenario.id}`,
                benchmark: true
            });
        });
        sampleMemory();
        await memoryProbe;
        const wallTimeMs = now() - startedAt;
        return {
            scenario,
            format,
            status: 'complete',
            wallTimeMs: rounded(wallTimeMs),
            wallFramesPerSecond: rounded(
                scenario.duration * EXPORT_FPS * 1000 / wallTimeMs
            ),
            outputBytes: result.blob?.size
                || result.data?.byteLength
                || result.benchmarkMetrics?.outputBytes
                || 0,
            inputLatency: summarizeTimings(timerLatencies, {
                frameBudgetMs: 16.7,
                droppedBudgetMs: 50
            }),
            memory: {
                source: memorySource,
                initialBytes: initialMemory.bytes,
                peakBytes: peakMemoryBytes,
                deltaBytes: Math.max(0, peakMemoryBytes - initialMemory.bytes)
            },
            worker: summarizeWorkerMetrics(result.benchmarkMetrics)
        };
    } catch (error) {
        return {
            scenario,
            format,
            status: 'error',
            error: error?.message || String(error)
        };
    } finally {
        clearInterval(timer);
        worker.terminate();
    }
}

export async function runAnimationPipelineBenchmark({ profile = 'standard' } = {}) {
    const scenarios = profile === 'quick'
        ? ANIMATION_BENCHMARK_SCENARIOS.slice(0, 1)
        : ANIMATION_BENCHMARK_SCENARIOS;
    const startedAt = new Date().toISOString();
    const preview = [];
    const exports = [];

    for (const scenario of scenarios) preview.push(await benchmarkPreview(scenario));
    for (const scenario of scenarios) {
        exports.push(await runWorkerExport(scenario, 'mp4'));
        exports.push(await runWorkerExport(scenario, 'png-sequence'));
    }

    return {
        version: 1,
        profile,
        startedAt,
        completedAt: new Date().toISOString(),
        passed: exports.every((entry) => entry.status === 'complete'),
        environment: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemoryGb: navigator.deviceMemory || null,
            crossOriginIsolated,
            offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
            videoEncoder: typeof VideoEncoder !== 'undefined'
        },
        configuration: {
            previewFps: PREVIEW_FPS,
            exportFps: EXPORT_FPS,
            exportSize: 1080,
            scenarios
        },
        preview,
        exports
    };
}
