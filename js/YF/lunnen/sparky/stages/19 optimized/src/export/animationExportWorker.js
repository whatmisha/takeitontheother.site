import {
    generateFocusPathForSettings,
    rebuildFocusPath
} from '../animation/focusPath.js?v=20260825-6';
import {
    createFocusTimeline,
    resolveFocusStops,
    sampleFocusTimeline
} from '../animation/focusTimeline.js?v=20260825-6';
import {
    createEyeAnimationTimeline
} from '../animation/eyeTimeline.js?v=20260825-9';
import {
    advanceEyeMotionToTarget,
    createEyeMotionState
} from '../animation/eyeMotion.js?v=20260825-1';
import {
    buildAnimationFrameScene,
    drawAnimationFrame
} from '../render/animationFrameRenderer.js?v=20260825-4';
import {
    createAnimationFrameSamples,
    sampleAnimationFrame
} from './animationFrameSamples.js?v=20260825-2';
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
    const path = motionPath
        ? rebuildFocusPath(motionPath)
        : generateFocusPathForSettings(settings, startFocus);
    const stops = resolveFocusStops(settings.motionStops);
    const timeline = createFocusTimeline(path, {
        duration: settings.motionDuration,
        ...stops,
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

function createLoopingEyeMotion(settings, timeline, frameCount, fps) {
    const motion = createEyeMotionState();
    const frameDuration = 1000 / fps;
    const warmupCount = Math.min(frameCount, EYE_MOTION_WARMUP_FRAMES);
    for (let index = frameCount - warmupCount; index < frameCount; index += 1) {
        const focus = sampleFocusTimeline(timeline, index * frameDuration).point;
        const scene = buildAnimationFrameScene(settings, focus);
        advanceEyeMotionToTarget(motion, scene.eyes.pairCenter, frameDuration);
    }
    return motion;
}

function drawMotionFrame(context, size, settings, samples, motion, frameIndex, fps, options = {}, metrics = null) {
    const state = sampleAnimationFrame(samples, frameIndex);
    const scene = buildAnimationFrameScene(settings, state.focus, { metrics });
    const eyeOffset = advanceEyeMotionToTarget(
        motion,
        scene.eyes.pairCenter,
        1000 / fps
    );
    drawAnimationFrame(context, size, size, settings, state.focus, {
        ...options,
        eyeState: state.eyes,
        eyeOffset,
        scene,
        metrics
    });
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
    const archive = new StoredZipBlobBuilder();
    const digits = Math.max(4, String(frameCount).length);

    for (let index = 0; index < frameCount; index += 1) {
        assertActive(jobId);
        drawMotionFrame(context, size, settings, samples, eyeMotion, index, fps, {
            transparentBackground: true,
            knockoutEyes: shouldKnockoutPngEyes(settings)
        }, benchmarkMetrics);
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
            drawMotionFrame(
                context,
                size,
                settings,
                samples,
                eyeMotion,
                index,
                fps,
                {},
                benchmarkMetrics
            );
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
