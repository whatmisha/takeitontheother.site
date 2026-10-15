import { WIDTH, HEIGHT, FPS } from './model.js';
import { muxAvcToMp4 } from './framework-export.js';
export async function supportedVideoConfig() {
    if (typeof VideoEncoder === 'undefined') throw new Error('MP4 encoding is unavailable in this browser. Use PNG sequence or open Erik in a browser with H.264 WebCodecs support.');
    for (const codec of ['avc1.640028', 'avc1.4d4028', 'avc1.42E028']) {
        try {
            const result = await VideoEncoder.isConfigSupported({ codec, width: WIDTH, height: HEIGHT, framerate: FPS, bitrate: 16_000_000, latencyMode: 'quality', avc: { format: 'avc' } });
            if (result.supported) return result.config;
        } catch { /* Probe the next profile. */ }
    }
    throw new Error('H.264 encoding at 1080p / 30 fps is unavailable. PNG export is still available.');
}
export async function encodeVideo({ frames, renderFrame, onProgress = () => {}, config }) {
    const chunks = []; let description, encoderError, bytes = 0;
    const encoder = new VideoEncoder({
        error(error) { encoderError = error; },
        output(chunk, metadata) {
            const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
            bytes += data.byteLength;
            if (bytes > 256 * 1024 * 1024) { encoderError = new Error('The video is too large. Shorten the text or increase the speed.'); return; }
            chunks.push({ data, timestamp: chunk.timestamp, type: chunk.type });
            if (metadata?.decoderConfig?.description) description = new Uint8Array(metadata.decoderConfig.description);
        }
    });
    encoder.configure(config || await supportedVideoConfig());
    try {
        for (let i = 0; i < frames; i++) {
            if (encoderError) throw encoderError;
            const timestamp = Math.round(i * 1_000_000 / FPS);
            const frame = new VideoFrame(renderFrame(i / FPS), { timestamp, duration: Math.round((i + 1) * 1_000_000 / FPS) - timestamp });
            try { encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 }); } finally { frame.close(); }
            while (encoder.encodeQueueSize > 6) {
                await new Promise(resolve => setTimeout(resolve, 10));
                if (encoderError) throw encoderError;
            }
            if (i % 8 === 0 || i === frames - 1) onProgress(i + 1, frames);
        }
        await encoder.flush();
        if (encoderError) throw encoderError;
        return new Blob([muxAvcToMp4({ chunks, decoderConfig: description, width: WIDTH, height: HEIGHT, fps: FPS })], { type: 'video/mp4' });
    } finally { if (encoder.state !== 'closed') encoder.close(); }
}
