import { muxAvcToMp4 } from '../../src/export/mp4Muxer.js';
import { StoredZipBlobBuilder } from '../../src/export/zipStore.js';
import { integrateLorenz } from './lorenz.js';
import {
    MOTION_EXPORT_FPS,
    MOTION_EXPORT_SIZE,
    motionExportFrameCount,
    motionPhaseAtTime
} from './motion.js';
import { renderLorenzCanvas } from './renderer.js';

function postProgress(jobId, completed, total, message) {
    self.postMessage({ type: 'progress', jobId, completed, total, message });
}

function renderFrame(context, job, trajectory, frameIndex, transparent) {
    const motionPhase = motionPhaseAtTime(
        frameIndex / MOTION_EXPORT_FPS,
        job.settings.motionSpeed
    );
    renderLorenzCanvas(
        context,
        MOTION_EXPORT_SIZE,
        MOTION_EXPORT_SIZE,
        { ...job.settings, animateParticles: true },
        trajectory,
        { transparent, motionPhase }
    );
}

async function exportPngSequence(job, trajectory) {
    const frameCount = motionExportFrameCount(job.settings);
    const canvas = new OffscreenCanvas(MOTION_EXPORT_SIZE, MOTION_EXPORT_SIZE);
    const context = canvas.getContext('2d', { alpha: true });
    const archive = new StoredZipBlobBuilder();
    const digits = Math.max(4, String(frameCount).length);
    const transparent = Boolean(job.settings.transparentExport);

    for (let index = 0; index < frameCount; index++) {
        context.clearRect(0, 0, MOTION_EXPORT_SIZE, MOTION_EXPORT_SIZE);
        renderFrame(context, job, trajectory, index, transparent);
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

async function supportedAvcConfig() {
    if (typeof VideoEncoder === 'undefined') {
        throw new Error('This browser does not support WebCodecs H.264 export.');
    }
    for (const codec of ['avc1.640028', 'avc1.4d4028', 'avc1.42E028']) {
        const config = {
            codec,
            width: MOTION_EXPORT_SIZE,
            height: MOTION_EXPORT_SIZE,
            framerate: MOTION_EXPORT_FPS,
            bitrate: 16_000_000,
            bitrateMode: 'variable',
            latencyMode: 'quality',
            avc: { format: 'avc' }
        };
        try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (support.supported) return support.config;
        } catch {
            // Try the next AVC profile.
        }
    }
    throw new Error('H.264 encoding is unavailable at 1080×1080 and 60 fps.');
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

async function exportMp4(job, trajectory) {
    const frameCount = motionExportFrameCount(job.settings);
    const canvas = new OffscreenCanvas(MOTION_EXPORT_SIZE, MOTION_EXPORT_SIZE);
    const context = canvas.getContext('2d', { alpha: false });
    const chunks = [];
    let decoderConfig = null;
    let encoderError = null;
    const encoder = new VideoEncoder({
        error(error) {
            encoderError = error;
        },
        output(chunk, metadata) {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            chunks.push({ data, timestamp: chunk.timestamp, type: chunk.type });
            if (metadata?.decoderConfig?.description) {
                decoderConfig = new Uint8Array(metadata.decoderConfig.description);
            }
        }
    });
    encoder.configure(await supportedAvcConfig());
    const frameDuration = 1_000_000 / MOTION_EXPORT_FPS;

    try {
        for (let index = 0; index < frameCount; index++) {
            if (encoderError) throw encoderError;
            renderFrame(context, job, trajectory, index, false);
            const frame = new VideoFrame(canvas, {
                timestamp: Math.round(index * frameDuration),
                duration: Math.round(frameDuration)
            });
            encoder.encode(frame, {
                keyFrame: index === 0 || index % MOTION_EXPORT_FPS === 0
            });
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
        width: MOTION_EXPORT_SIZE,
        height: MOTION_EXPORT_SIZE,
        fps: MOTION_EXPORT_FPS
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
        const trajectory = integrateLorenz(job.settings);
        if (trajectory.diverged || trajectory.pointCount < 1) {
            throw new Error('The trajectory diverged. Reduce the time step or system parameters.');
        }
        const result = job.format === 'png-sequence'
            ? await exportPngSequence(job, trajectory)
            : await exportMp4(job, trajectory);
        if (result.blob) {
            self.postMessage({ type: 'complete', jobId: job.jobId, ...result });
        } else {
            self.postMessage({ type: 'complete', jobId: job.jobId, ...result }, [result.data]);
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            jobId: job.jobId,
            message: error?.message || String(error)
        });
    }
});
