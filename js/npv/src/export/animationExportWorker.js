import { buildGlobalScene } from '../geometry/globalGeometry.js';
import { drawSceneOnContext } from '../render/globalRenderer.js';
import { muxAvcToMp4 } from './mp4Muxer.js';
import { StoredZipBlobBuilder } from './zipStore.js';
import { rotationFrameCount, rotationFrameOptions } from '../animation/rotationAnimation.js';

const FPS = 60;
const SIZE = 1080;

function postProgress(jobId, completed, total, message) {
    self.postMessage({ type: 'progress', jobId, completed, total, message });
}

function slowMotionFactorForJob(job) {
    return job.format === 'mp4'
        ? Math.max(1, Number(job.slowMotionFactor) || 1)
        : 1;
}

function frameCountForJob(job) {
    const baseFrameCount = job.animationKind === 'rotation'
        ? rotationFrameCount(job.settings, FPS)
        : Math.max(1, Math.round(job.settings.duration * FPS));
    return Math.max(1, Math.round(baseFrameCount * slowMotionFactorForJob(job)));
}

function sceneForFrame(job, frameIndex, frameCount) {
    if (job.animationKind === 'rotation') {
        return buildGlobalScene(
            { ...job.settings, animationMode: 'static' },
            rotationFrameOptions(job.settings, frameIndex, frameCount)
        );
    }
    return buildGlobalScene(job.settings, {
        timeSeconds: frameIndex / (FPS * slowMotionFactorForJob(job))
    });
}

function drawFrame(context, job, frameIndex, frameCount) {
    const scene = sceneForFrame(job, frameIndex, frameCount);
    drawSceneOnContext(context, scene, { size: SIZE, transparent: false });
}

async function exportPngSequence(job) {
    const frameCount = frameCountForJob(job);
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const context = canvas.getContext('2d', { alpha: true });
    const archive = new StoredZipBlobBuilder();
    const digits = Math.max(4, String(frameCount).length);

    for (let index = 0; index < frameCount; index += 1) {
        const scene = sceneForFrame(job, index, frameCount);
        drawSceneOnContext(context, scene, { size: SIZE, transparent: true });
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
            width: SIZE,
            height: SIZE,
            framerate: FPS,
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

async function exportMp4(job) {
    const frameCount = frameCountForJob(job);
    const canvas = new OffscreenCanvas(SIZE, SIZE);
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
    const frameDuration = 1_000_000 / FPS;

    try {
        for (let index = 0; index < frameCount; index += 1) {
            if (encoderError) throw encoderError;
            drawFrame(context, job, index, frameCount);
            const frame = new VideoFrame(canvas, {
                timestamp: Math.round(index * frameDuration),
                duration: Math.round(frameDuration)
            });
            encoder.encode(frame, { keyFrame: index === 0 || index % FPS === 0 });
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
        width: SIZE,
        height: SIZE,
        fps: FPS
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
