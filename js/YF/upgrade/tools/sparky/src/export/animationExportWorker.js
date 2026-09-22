import {
    generateFocusPathForSettings,
    rebuildFocusPath
} from '../animation/focusPath.js?v=20260828-1';
import {
    createFocusTimeline,
    resolveFocusStops,
    sampleFocusTimeline
} from '../animation/focusTimeline.js?v=20260826-1';
import {
    createEyeAnimationTimeline,
    createLoopEyeAnimationTimeline,
    sampleEyeAnimationTimeline
} from '../animation/eyeTimeline.js?v=20260828-2';
import {
    createStationaryLoopTimeline,
    sampleLoopFocus
} from '../animation/loopTimeline.js?v=20260827-1';
import { settingsAtBolidTime } from '../animation/bolid.js?v=20260828-3';
import {
    resolveBlinkMotionBlurTime,
    resolveMotionBlur,
    wrapMotionBlurTime
} from '../animation/motionBlur.js?v=20260826-3';
import {
    BOLID_EYE_MOTION_TIME_CONSTANT,
    advanceEyeMotionToTarget,
    createEyeMotionState,
    currentEyeMotionTransform
} from '../animation/eyeMotion.js?v=20260828-1';
import {
    buildAnimationFrameScene,
    drawAnimationFrame
} from '../render/animationFrameRenderer.js?v=20260828-7';
import {
    createAnimationFrameSamples,
    sampleAnimationFrame
} from './animationFrameSamples.js?v=20260827-3';
import { StoredZipBlobBuilder } from './zipStore.js?v=20260825-1';
import { muxAvcToMp4 } from './mp4Muxer.js';
import {
    ANIMATION_EXPORT_FPS,
    ANIMATION_EXPORT_SIZE,
    shouldKnockoutPngEyes
} from './animationExportDefaults.js?v=20260825-2';

let cancelledJob = null;
const EYE_MOTION_WARMUP_FRAMES = 24;
const now = () => globalThis.performance?.now?.() ?? Date.now();

function createBenchmarkMetrics(job, frameCount) {
    if (!job.benchmark) return null;
    return {
        format: job.format,
        frameCount,
        characterMs: 0,
        colorTrailMs: 0,
        eyesMs: 0,
        lidsMs: 0,
        canvasDrawMs: 0,
        timelineMs: 0,
        samplePrecomputeMs: 0,
        eyeWarmupMs: 0,
        pngEncodeMs: 0,
        zipPackageMs: 0,
        videoSubmitMs: 0,
        backpressureWaitMs: 0,
        encoderFlushMs: 0,
        mp4MuxMs: 0,
        intermediateFlushes: 0,
        backpressureWaits: 0,
        maxEncodeQueueSize: 0,
        bufferedPngBytes: 0,
        peakKnownBytes: 0,
        outputBytes: 0,
        totalMs: 0
    };
}

function measure(metrics, key, startedAt) {
    if (metrics) metrics[key] += now() - startedAt;
}

const postProgress = (jobId, completed, total, message) => {
    self.postMessage({ type: 'progress', jobId, completed, total, message });
};

const assertActive = (jobId) => {
    if (cancelledJob === jobId) throw new DOMException('Export cancelled.', 'AbortError');
};

function createMotion(settings, startFocus, motionPath = null) {
    if (settings.focusMode === 'bolid') {
        const timeline = createStationaryLoopTimeline(startFocus, settings.motionDuration);
        const eyeTimeline = createLoopEyeAnimationTimeline(timeline, {
            blinkCount: settings.motionBlinkCount,
            pairedBlinks: true,
            emotionVariation: settings.motionEmotionVariation
        });
        return { path: null, timeline, eyeTimeline };
    }
    const path = motionPath
        ? rebuildFocusPath(motionPath)
        : generateFocusPathForSettings(settings, startFocus);
    const stops = resolveFocusStops(settings.motionStopCount, path.anchors.length);
    const timeline = createFocusTimeline(path, {
        duration: settings.motionDuration,
        ...stops,
        speedVariation: settings.motionSpeedVariation,
        easing: 'ease-in-out',
        seed: settings.motionSeed
    });
    const eyeTimeline = createEyeAnimationTimeline(timeline, {
        blinkCount: settings.motionBlinkCount,
        blinkAtStops: true,
        emotionVariation: settings.motionEmotionVariation,
        easing: 'ease-in-out'
    });
    return { path, timeline, eyeTimeline };
}

const sampleMotionFocus = (timeline, timeMs) => (
    sampleLoopFocus(timeline, timeMs, sampleFocusTimeline).point
);

function createLoopingEyeMotion(settings, timeline, frameCount, fps) {
    const motion = createEyeMotionState(
        settings.focusMode === 'bolid' ? BOLID_EYE_MOTION_TIME_CONSTANT : undefined
    );
    const frameDuration = 1000 / fps;
    const warmupCount = Math.min(
        frameCount,
        settings.focusMode === 'bolid' ? 40 : EYE_MOTION_WARMUP_FRAMES
    );
    for (let index = frameCount - warmupCount; index < frameCount; index += 1) {
        const timeMs = index * frameDuration;
        const focus = sampleMotionFocus(timeline, timeMs);
        const scene = buildAnimationFrameScene(settings, focus, {
            timeMs,
            durationMs: timeline.durationMs
        });
        advanceEyeMotionToTarget(
            motion,
            scene.eyes.pairCenter,
            frameDuration,
            scene.eyes.fitScale
        );
    }
    return motion;
}

function drawMotionFrame(context, size, settings, samples, motion, frameIndex, fps, options = {}, metrics = null) {
    const state = sampleAnimationFrame(samples, frameIndex);
    const scene = buildAnimationFrameScene(settings, state.focus, {
        metrics,
        timeMs: frameIndex * 1000 / fps,
        durationMs: settings.motionDuration * 1000
    });
    advanceEyeMotionToTarget(
        motion,
        scene.eyes.pairCenter,
        1000 / fps,
        scene.eyes.fitScale
    );
    const eyeOffset = currentEyeMotionTransform(motion);
    drawAnimationFrame(context, size, size, settings, state.focus, {
        ...options,
        eyeState: state.eyes,
        eyeOffset,
        scene,
        metrics
    });
}

function createMotionBlurBuffers(size, value) {
    const blur = resolveMotionBlur(value);
    if (blur.sampleCount === 1) return { blur };
    const sampleCanvas = new OffscreenCanvas(size, size);
    const accumulationCanvas = new OffscreenCanvas(size, size);
    return {
        blur,
        sampleCanvas,
        sampleContext: sampleCanvas.getContext('2d', { alpha: true }),
        accumulationCanvas,
        accumulationContext: accumulationCanvas.getContext('2d', { alpha: true })
    };
}

function drawMotionBlurFrame(
    context,
    size,
    settings,
    motion,
    frameIndex,
    fps,
    timeline,
    eyeTimeline,
    buffers,
    options = {},
    metrics = null
) {
    const centerTime = frameIndex * 1000 / fps;
    const centerFocus = sampleMotionFocus(timeline, centerTime);
    const centerScene = buildAnimationFrameScene(settings, centerFocus, {
        metrics,
        timeMs: centerTime,
        durationMs: timeline.durationMs
    });
    advanceEyeMotionToTarget(
        motion,
        centerScene.eyes.pairCenter,
        1000 / fps,
        centerScene.eyes.fitScale
    );
    const eyeOffset = currentEyeMotionTransform(motion);
    const { blur, sampleContext, sampleCanvas, accumulationContext, accumulationCanvas } = buffers;
    accumulationContext.save();
    accumulationContext.setTransform(1, 0, 0, 1, 0, 0);
    accumulationContext.clearRect(0, 0, size, size);
    accumulationContext.globalCompositeOperation = 'lighter';
    accumulationContext.globalAlpha = 1 / blur.sampleCount;
    blur.offsets.forEach((offsetFrames) => {
        const rawTime = centerTime + offsetFrames * 1000 / fps;
        const time = wrapMotionBlurTime(
            rawTime,
            timeline.durationMs
        );
        const focus = sampleMotionFocus(timeline, time);
        const expression = settingsAtBolidTime(settings, time, timeline.durationMs);
        const eyes = sampleEyeAnimationTimeline(eyeTimeline, time, expression);
        const blinkTime = resolveBlinkMotionBlurTime(
            centerTime,
            rawTime,
            timeline.durationMs
        );
        const blinkExpression = settingsAtBolidTime(
            settings,
            blinkTime,
            timeline.durationMs
        );
        const blink = sampleEyeAnimationTimeline(eyeTimeline, blinkTime, blinkExpression);
        const scene = buildAnimationFrameScene(settings, focus, {
            metrics,
            timeMs: time,
            durationMs: timeline.durationMs
        });
        drawAnimationFrame(sampleContext, size, size, settings, focus, {
            ...options,
            eyeState: { ...eyes, blinkAmount: blink.blinkAmount },
            eyeOffset,
            scene,
            metrics
        });
        accumulationContext.drawImage(sampleCanvas, 0, 0);
    });
    accumulationContext.restore();
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, size, size);
    context.drawImage(accumulationCanvas, 0, 0);
    context.restore();
}

async function exportPngSequence(job) {
    const { jobId, settings, startFocus, motionPath, baseName } = job;
    const fps = ANIMATION_EXPORT_FPS;
    const size = ANIMATION_EXPORT_SIZE;
    const frameCount = Math.round(settings.motionDuration * fps);
    const benchmarkMetrics = createBenchmarkMetrics(job, frameCount);
    const totalStartedAt = now();
    let startedAt = now();
    const { timeline, eyeTimeline } = createMotion(settings, startFocus, motionPath);
    measure(benchmarkMetrics, 'timelineMs', startedAt);
    startedAt = now();
    const samples = createAnimationFrameSamples(
        timeline,
        eyeTimeline,
        settings,
        frameCount,
        fps
    );
    measure(benchmarkMetrics, 'samplePrecomputeMs', startedAt);
    startedAt = now();
    const eyeMotion = createLoopingEyeMotion(settings, timeline, frameCount, fps);
    measure(benchmarkMetrics, 'eyeWarmupMs', startedAt);
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d', { alpha: true });
    const motionBlurBuffers = createMotionBlurBuffers(size, settings.motionBlur);
    const archive = new StoredZipBlobBuilder();
    const digits = Math.max(4, String(frameCount).length);

    for (let index = 0; index < frameCount; index += 1) {
        assertActive(jobId);
        const drawOptions = {
            transparentBackground: true,
            knockoutEyes: shouldKnockoutPngEyes(settings)
        };
        if (motionBlurBuffers.blur.sampleCount > 1) {
            drawMotionBlurFrame(
                context, size, settings, eyeMotion, index, fps,
                timeline, eyeTimeline, motionBlurBuffers, drawOptions, benchmarkMetrics
            );
        } else {
            drawMotionFrame(
                context, size, settings, samples, eyeMotion, index, fps,
                drawOptions, benchmarkMetrics
            );
        }
        startedAt = now();
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        measure(benchmarkMetrics, 'pngEncodeMs', startedAt);
        const data = new Uint8Array(await blob.arrayBuffer());
        archive.add(
            `${baseName}_${String(index + 1).padStart(digits, '0')}.png`,
            data
        );
        if (benchmarkMetrics) {
            benchmarkMetrics.bufferedPngBytes = archive.dataBytes;
            benchmarkMetrics.peakKnownBytes = Math.max(
                benchmarkMetrics.peakKnownBytes,
                archive.retainedBytes
            );
        }
        if (index === 0 || (index + 1) % Math.max(1, Math.round(fps / 4)) === 0) {
            postProgress(jobId, index + 1, frameCount, `Rendering PNG ${index + 1} of ${frameCount}`);
        }
    }

    assertActive(jobId);
    postProgress(jobId, frameCount, frameCount, 'Packaging PNG sequence');
    startedAt = now();
    const archiveBlob = archive.toBlob();
    measure(benchmarkMetrics, 'zipPackageMs', startedAt);
    if (benchmarkMetrics) {
        benchmarkMetrics.outputBytes = archiveBlob.size;
        benchmarkMetrics.peakKnownBytes = Math.max(
            benchmarkMetrics.peakKnownBytes,
            archive.retainedBytes
        );
        benchmarkMetrics.totalMs = now() - totalStartedAt;
    }
    return {
        data: archiveBlob,
        mimeType: 'application/zip',
        filename: `${baseName}-png-sequence.zip`,
        benchmarkMetrics
    };
}

async function supportedAvcConfig(width, height, fps) {
    if (typeof VideoEncoder === 'undefined') {
        throw new Error('This browser does not support WebCodecs H.264 export.');
    }
    const bitrate = width >= 960 ? 16_000_000 : 6_000_000;
    const codecs = ['avc1.640028', 'avc1.4d4028', 'avc1.42E028'];
    for (const codec of codecs) {
        const config = {
            codec,
            width,
            height,
            framerate: fps,
            bitrate,
            bitrateMode: 'variable',
            latencyMode: 'quality',
            avc: { format: 'avc' }
        };
        try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (support.supported) return support.config;
        } catch {
            // Try the next broadly supported AVC profile.
        }
    }
    throw new Error('H.264 encoding is unavailable for the selected resolution and frame rate.');
}

async function waitForEncoderCapacity(encoder, maximumQueueSize) {
    while (encoder.encodeQueueSize > maximumQueueSize) {
        await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                encoder.removeEventListener('dequeue', finish);
                resolve();
            };
            encoder.addEventListener('dequeue', finish, { once: true });
            // Avoid missing a dequeue that happened between the outer check
            // and listener registration.
            if (encoder.encodeQueueSize <= maximumQueueSize) finish();
        });
    }
}

async function exportMp4(job) {
    const { jobId, settings, startFocus, motionPath, baseName } = job;
    const fps = ANIMATION_EXPORT_FPS;
    const size = ANIMATION_EXPORT_SIZE;
    const frameCount = Math.round(settings.motionDuration * fps);
    const benchmarkMetrics = createBenchmarkMetrics(job, frameCount);
    const totalStartedAt = now();
    let startedAt = now();
    const { timeline, eyeTimeline } = createMotion(settings, startFocus, motionPath);
    measure(benchmarkMetrics, 'timelineMs', startedAt);
    startedAt = now();
    const samples = createAnimationFrameSamples(
        timeline,
        eyeTimeline,
        settings,
        frameCount,
        fps
    );
    measure(benchmarkMetrics, 'samplePrecomputeMs', startedAt);
    startedAt = now();
    const eyeMotion = createLoopingEyeMotion(settings, timeline, frameCount, fps);
    measure(benchmarkMetrics, 'eyeWarmupMs', startedAt);
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d', { alpha: false });
    const motionBlurBuffers = createMotionBlurBuffers(size, settings.motionBlur);
    const chunks = [];
    let decoderConfig = null;
    let encoderError = null;
    const config = await supportedAvcConfig(size, size, fps);
    const encoder = new VideoEncoder({
        error(error) {
            encoderError = error;
        },
        output(chunk, metadata) {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            chunks.push({ data, timestamp: chunk.timestamp, type: chunk.type });
            const description = metadata?.decoderConfig?.description;
            if (description) decoderConfig = new Uint8Array(description);
        }
    });
    encoder.configure(config);
    const microsecondsPerFrame = 1_000_000 / fps;

    try {
        for (let index = 0; index < frameCount; index += 1) {
            assertActive(jobId);
            if (encoderError) throw encoderError;
            if (motionBlurBuffers.blur.sampleCount > 1) {
                drawMotionBlurFrame(
                    context, size, settings, eyeMotion, index, fps,
                    timeline, eyeTimeline, motionBlurBuffers, {}, benchmarkMetrics
                );
            } else {
                drawMotionFrame(
                    context, size, settings, samples, eyeMotion, index, fps,
                    {}, benchmarkMetrics
                );
            }
            const frame = new VideoFrame(canvas, {
                timestamp: Math.round(index * microsecondsPerFrame),
                duration: Math.round(microsecondsPerFrame)
            });
            startedAt = now();
            encoder.encode(frame, { keyFrame: index === 0 || index % fps === 0 });
            measure(benchmarkMetrics, 'videoSubmitMs', startedAt);
            frame.close();
            if (benchmarkMetrics) {
                benchmarkMetrics.maxEncodeQueueSize = Math.max(
                    benchmarkMetrics.maxEncodeQueueSize,
                    encoder.encodeQueueSize
                );
            }
            if (encoder.encodeQueueSize > 8) {
                if (benchmarkMetrics) benchmarkMetrics.backpressureWaits += 1;
                startedAt = now();
                await waitForEncoderCapacity(encoder, 8);
                measure(benchmarkMetrics, 'backpressureWaitMs', startedAt);
            }
            if (index === 0 || (index + 1) % Math.max(1, Math.round(fps / 4)) === 0) {
                postProgress(jobId, index + 1, frameCount, `Encoding frame ${index + 1} of ${frameCount}`);
            }
        }
        startedAt = now();
        await encoder.flush();
        measure(benchmarkMetrics, 'encoderFlushMs', startedAt);
        if (encoderError) throw encoderError;
    } finally {
        if (encoder.state !== 'closed') encoder.close();
    }

    assertActive(jobId);
    postProgress(jobId, frameCount, frameCount, 'Packaging MP4');
    startedAt = now();
    const video = muxAvcToMp4({
        chunks,
        decoderConfig,
        width: size,
        height: size,
        fps
    });
    measure(benchmarkMetrics, 'mp4MuxMs', startedAt);
    if (benchmarkMetrics) {
        benchmarkMetrics.outputBytes = video.byteLength;
        benchmarkMetrics.peakKnownBytes = chunks.reduce(
            (sum, chunk) => sum + chunk.data.byteLength,
            0
        ) + video.byteLength;
        benchmarkMetrics.totalMs = now() - totalStartedAt;
    }
    return {
        data: video,
        mimeType: 'video/mp4',
        filename: `${baseName}.mp4`,
        benchmarkMetrics
    };
}

self.addEventListener('message', async (event) => {
    const job = event.data;
    if (job?.type === 'cancel') {
        cancelledJob = job.jobId;
        return;
    }
    if (job?.type !== 'export') return;
    cancelledJob = null;
    try {
        if (typeof OffscreenCanvas === 'undefined' || typeof Path2D === 'undefined') {
            throw new Error('This browser cannot render animation frames in a background worker.');
        }
        const result = job.format === 'png-sequence'
            ? await exportPngSequence(job)
            : await exportMp4(job);
        if (result.data instanceof Blob) {
            self.postMessage({
                type: 'complete',
                jobId: job.jobId,
                ...result,
                data: null,
                blob: result.data
            });
        } else {
            const buffer = result.data.buffer;
            self.postMessage({
                type: 'complete',
                jobId: job.jobId,
                ...result,
                data: buffer
            }, [buffer]);
        }
    } catch (error) {
        self.postMessage({
            type: error?.name === 'AbortError' ? 'cancelled' : 'error',
            jobId: job.jobId,
            message: error?.message || String(error)
        });
    }
});
