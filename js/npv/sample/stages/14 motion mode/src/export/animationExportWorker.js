import { generateFocusPathForSettings } from '../animation/focusPath.js';
import { createFocusTimeline, sampleFocusTimeline } from '../animation/focusTimeline.js';
import { drawAnimationFrame } from '../render/animationFrameRenderer.js';
import { createStoredZip } from './zipStore.js';
import { muxAvcToMp4 } from './mp4Muxer.js';

let cancelledJob = null;

const postProgress = (jobId, completed, total, message) => {
    self.postMessage({ type: 'progress', jobId, completed, total, message });
};

const assertActive = (jobId) => {
    if (cancelledJob === jobId) throw new DOMException('Export cancelled.', 'AbortError');
};

function createMotion(settings, startFocus) {
    const path = generateFocusPathForSettings(settings, startFocus);
    const timeline = createFocusTimeline(path, {
        duration: settings.motionDuration,
        pause: settings.motionPause,
        skipProbability: settings.motionSkipProbability,
        easing: settings.motionEasing,
        seed: settings.motionSeed
    });
    return { path, timeline };
}

function frameFocus(timeline, frameIndex, fps) {
    return sampleFocusTimeline(timeline, frameIndex * 1000 / fps).point;
}

async function exportPngSequence(job) {
    const { jobId, settings, startFocus, baseName } = job;
    const fps = settings.motionFps;
    const size = settings.motionResolution;
    const frameCount = Math.round(settings.motionDuration * fps);
    const { timeline } = createMotion(settings, startFocus);
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d', { alpha: true });
    const files = [];
    const digits = Math.max(4, String(frameCount).length);

    for (let index = 0; index < frameCount; index += 1) {
        assertActive(jobId);
        drawAnimationFrame(context, size, size, settings, frameFocus(timeline, index, fps), {
            transparentBackground: settings.motionTransparentBackground,
            knockoutEyes: settings.motionKnockoutEyes
        });
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        files.push({
            name: `${baseName}_${String(index + 1).padStart(digits, '0')}.png`,
            data: new Uint8Array(await blob.arrayBuffer())
        });
        if (index === 0 || (index + 1) % Math.max(1, Math.round(fps / 4)) === 0) {
            postProgress(jobId, index + 1, frameCount, `Rendering PNG ${index + 1} of ${frameCount}`);
        }
    }

    assertActive(jobId);
    postProgress(jobId, frameCount, frameCount, 'Packaging PNG sequence');
    const archive = createStoredZip(files);
    return {
        data: archive,
        mimeType: 'application/zip',
        filename: `${baseName}-png-sequence.zip`
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

async function exportMp4(job) {
    const { jobId, settings, startFocus, baseName } = job;
    const fps = settings.motionFps;
    const size = settings.motionResolution;
    const frameCount = Math.round(settings.motionDuration * fps);
    const { timeline } = createMotion(settings, startFocus);
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
            drawAnimationFrame(context, size, size, settings, frameFocus(timeline, index, fps));
            const frame = new VideoFrame(canvas, {
                timestamp: Math.round(index * microsecondsPerFrame),
                duration: Math.round(microsecondsPerFrame)
            });
            encoder.encode(frame, { keyFrame: index === 0 || index % fps === 0 });
            frame.close();
            if (encoder.encodeQueueSize > 8) await encoder.flush();
            if (index === 0 || (index + 1) % Math.max(1, Math.round(fps / 4)) === 0) {
                postProgress(jobId, index + 1, frameCount, `Encoding frame ${index + 1} of ${frameCount}`);
            }
        }
        await encoder.flush();
        if (encoderError) throw encoderError;
    } finally {
        if (encoder.state !== 'closed') encoder.close();
    }

    assertActive(jobId);
    postProgress(jobId, frameCount, frameCount, 'Packaging MP4');
    const video = muxAvcToMp4({
        chunks,
        decoderConfig,
        width: size,
        height: size,
        fps
    });
    return {
        data: video,
        mimeType: 'video/mp4',
        filename: `${baseName}.mp4`
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
        const buffer = result.data.buffer;
        self.postMessage({ type: 'complete', jobId: job.jobId, ...result, data: buffer }, [buffer]);
    } catch (error) {
        self.postMessage({
            type: error?.name === 'AbortError' ? 'cancelled' : 'error',
            jobId: job.jobId,
            message: error?.message || String(error)
        });
    }
});
