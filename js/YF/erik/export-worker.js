import { normalize, FPS, hasContent } from './model.js';
import { animationType } from './animations.js';
import { StoredZipWriter } from './framework-export.js';
import { supportedVideoConfig, encodeVideo } from './video.js';
self.onmessage = async ({ data }) => {
    const { type, settings: input, time = 0 } = data;
    let renderer;
    try {
        if (type === 'probe') {
            await supportedVideoConfig(); self.postMessage({ type: 'supported' }); return;
        }
        if (!['mp4', 'sequence', 'frame'].includes(type)) throw new Error('Unknown export format.');
        const config = type === 'mp4' ? await supportedVideoConfig() : null;
        const animation = animationType('crawl'); await animation.load();
        const settings = normalize(input);
        renderer = animation.createRenderer();
        await renderer.loadEnding(settings, data.bitmap);
        const layout = renderer.prepare(settings);
        if (!hasContent(settings)) throw new Error('Add a logo or some text before exporting.');
        const plan = animation.plan(settings, layout);
        const progress = (completed, total) => self.postMessage({ type: 'progress', completed, total });
        let blob, filename;
        if (type === 'frame') {
            const frameTime = Math.min(plan.lastTime, Math.max(0, Math.round(time * FPS) / FPS));
            blob = await renderer.render(settings, frameTime, { transparent: true }).convertToBlob({ type: 'image/png' });
            filename = `erik-${String(Math.round(frameTime * FPS)).padStart(5, '0')}.png`;
        } else if (type === 'sequence') {
            const archive = new StoredZipWriter();
            for (let i = 0; i < plan.frames; i++) {
                const image = await renderer.render(settings, i / FPS, { transparent: true }).convertToBlob({ type: 'image/png' });
                await archive.add(`erik-${String(i).padStart(5, '0')}.png`, image);
                if (i % 5 === 0 || i === plan.frames - 1) progress(i + 1, plan.frames);
            }
            blob = archive.toBlob(); filename = 'erik-png-sequence.zip';
        } else {
            blob = await encodeVideo({ frames: plan.frames, config, renderFrame: t => renderer.render(settings, t), onProgress: progress });
            filename = 'erik.mp4';
        }
        self.postMessage({ type: 'complete', blob, filename, frames: type === 'frame' ? 1 : plan.frames, duration: plan.duration });
    } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
    finally { renderer?.destroy(); }
};
