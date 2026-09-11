import { muxAvcToMp4 } from '../../src/export/mp4Muxer.js';
import { StoredZipBlobBuilder } from '../../src/export/zipStore.js';
import {
    animationExportDimensions,
    cascadeGenerationAtPhase,
    CASCADE_EXPORT_FPS,
    motionFrameCount
} from './motion.js';
import { renderCascadeCanvas } from './renderer.js';

function postProgress(jobId, completed, total, message) {
    self.postMessage({ type: 'progress', jobId, completed, total, message });
}

function renderFrame(context, canvas, job, frameIndex, frameCount, transparent) {
    const phase = frameIndex / frameCount;
    renderCascadeCanvas(context, canvas.width, canvas.height, job.settings, {
        transparent,
        generation: cascadeGenerationAtPhase(phase, job.settings)
    });
}

async function exportPngSequence(job) {
    const frameCount = motionFrameCount(job.settings);
    const dimensions = animationExportDimensions(job.settings);
    const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
    const context = canvas.getContext('2d', { alpha: true });
    const archive = new StoredZipBlobBuilder();
    const digits = Math.max(4, String(frameCount).length);
    const transparent = Boolean(job.settings.transparentExport);

    for (let index = 0; index < frameCount; index += 1) {
        renderFrame(context, canvas, job, index, frameCount, transparent);
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        archive.add(
            `${job.baseName}_${String(index + 1).padStart(digits, '0')}.png`,
            new Uint8Array(await blob.arrayBuffer())
        );
        if (index === 0 || (index + 1) % 15 === 0 || index === frameCount - 1) {
            postProgress(job.jobId, index + 1, frameCount, `Rendering PNG ${index + 1} of ${frameCount}`);
        }
    }
    postProgress(job.jobId, frameCount, frameCount, 'Packaging PNG sequence');
    return {
        blob: archive.toBlob(),
        mimeType: 'application/zip',
        filename: `${job.baseName}-png-sequence.zip`
    };
}

async function supportedAvcConfig(width, height) {
    if (typeof VideoEncoder === 'undefined') {
        throw new Error('This browser does not support WebCodecs H.264 export.');
    }
    for (const codec of ['avc1.640028', 'avc1.4d4028', 'avc1.42E028']) {
        const config = {
            codec,
            width,
            height,
            framerate: CASCADE_EXPORT_FPS,
            bitrate: 14_000_000,
            bitrateMode: 'variable',
            latencyMode: 'quality',
            avc: { format: 'avc' }
        };
        try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (support.supported) return support.config;
        } catch {
            // Continue with the next AVC profile.
        }
    }
    throw new Error('H.264 encoding is unavailable for this export size.');
}

async function waitForCapacity(encoder) {
    while (encoder.encodeQueueSize > 8) {
        await new Promise((resolve) => {
            const finish = () => {
                encoder.removeEventListener('dequeue', finish);
                resolve();
            };
            encoder.addEventListener('dequeue', finish, { once: true });
            if (encoder.encodeQueueSize <= 8) finish();
        });
    }
}

async function exportMp4(job) {
    const frameCount = motionFrameCount(job.settings);
    const dimensions = animationExportDimensions(job.settings);
    const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
    const context = canvas.getContext('2d', { alpha: false });
    const chunks = [];
    let decoderConfig = null;
    let encoderError = null;
    const encoder = new VideoEncoder({
        error(error) { encoderError = error; },
        output(chunk, metadata) {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            chunks.push({ data, timestamp: chunk.timestamp, type: chunk.type });
            if (metadata?.decoderConfig?.description) {
                decoderConfig = new Uint8Array(metadata.decoderConfig.description);
            }
        }
    });
    encoder.configure(await supportedAvcConfig(dimensions.width, dimensions.height));
    const frameDuration = 1_000_000 / CASCADE_EXPORT_FPS;

    try {
        for (let index = 0; index < frameCount; index += 1) {
            if (encoderError) throw encoderError;
            renderFrame(context, canvas, job, index, frameCount, false);
            const frame = new VideoFrame(canvas, {
                timestamp: Math.round(index * frameDuration),
                duration: Math.round(frameDuration)
            });
            encoder.encode(frame, { keyFrame: index === 0 || index % CASCADE_EXPORT_FPS === 0 });
            frame.close();
            if (encoder.encodeQueueSize > 8) await waitForCapacity(encoder);
            if (index === 0 || (index + 1) % 15 === 0 || index === frameCount - 1) {
                postProgress(job.jobId, index + 1, frameCount, `Encoding frame ${index + 1} of ${frameCount}`);
            }
        }
        await encoder.flush();
        if (encoderError) throw encoderError;
    } finally {
        if (encoder.state !== 'closed') encoder.close();
    }

    postProgress(job.jobId, frameCount, frameCount, 'Packaging MP4');
    const video = muxAvcToMp4({
        chunks,
        decoderConfig,
        width: dimensions.width,
        height: dimensions.height,
        fps: CASCADE_EXPORT_FPS
    });
    return {
        data: video.buffer,
        mimeType: 'video/mp4',
        filename: `${job.baseName}.mp4`
    };
}

self.addEventListener('message', async (event) => {
    const job = event.data;
    if (job?.type !== 'export') return;
    try {
        if (typeof OffscreenCanvas === 'undefined') {
            throw new Error('This browser cannot render animation frames in a background worker.');
        }
        const result = job.format === 'png-sequence'
            ? await exportPngSequence(job)
            : await exportMp4(job);
        if (result.blob) self.postMessage({ type: 'complete', jobId: job.jobId, ...result });
        else self.postMessage({ type: 'complete', jobId: job.jobId, ...result }, [result.data]);
    } catch (error) {
        self.postMessage({
            type: 'error',
            jobId: job.jobId,
            message: error?.message || String(error)
        });
    }
});
