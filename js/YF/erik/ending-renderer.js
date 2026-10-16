import { hasEnding, endingAt, lottieFrame } from './ending-model.js';
import { loadLottie, svgBitmap } from './ending-assets.js';
export class EndingRenderer {
    constructor() { this.key = null; this.pending = null; this.asset = null; this.generation = 0; }
    async load(settings, bitmap) {
        const asset = settings.endingAsset;
        const key = hasEnding(settings) && settings.endingType !== 'text' ? asset.kind + ':' + asset.data : null;
        if (key === this.key) { bitmap?.close(); return this.pending; }
        this.key = key; const generation = ++this.generation;
        this.asset?.destroy(); this.asset = null;
        if (!key) { bitmap?.close(); this.pending = null; return; }
        this.pending = (async () => {
            let resource;
            if (asset.kind === 'svg') { const image = bitmap || await svgBitmap(asset); resource = { canvas: image, destroy: () => image.close() }; }
            else resource = await loadLottie(asset);
            if (generation !== this.generation) { resource.destroy(); return; }
            this.asset = resource;
        })().catch(error => { if (generation === this.generation) this.key = null; throw error; });
        return this.pending;
    }
    text(settings) {
        const key = JSON.stringify([settings.endingText, settings.weight, settings.tracking, settings.textColor]);
        if (key === this.textKey) return this.textCanvas;
        const surface = new OffscreenCanvas(1920, 1080), ctx = surface.getContext('2d');
        ctx.font = `${settings.weight} 240px "Erik Lunnen"`; ctx.letterSpacing = `${settings.tracking}px`;
        const lines = settings.endingText.split('\n'), metrics = lines.map(line => ctx.measureText(line)), lineHeight = 300;
        const width = Math.max(1, ...metrics.map(m => m.actualBoundingBoxLeft + m.actualBoundingBoxRight));
        const height = (lines.length - 1) * lineHeight + (metrics[0]?.actualBoundingBoxAscent || 0) + (metrics.at(-1)?.actualBoundingBoxDescent || 0);
        const fit = Math.min(1920 / (width + 8), 1080 / (height + 8));
        ctx.translate(960, (1080 - height * fit) / 2); ctx.scale(fit, fit); ctx.fillStyle = settings.textColor;
        lines.forEach((line, i) => ctx.fillText(line, -(metrics[i].actualBoundingBoxRight - metrics[i].actualBoundingBoxLeft) / 2, i * lineHeight + metrics[0].actualBoundingBoxAscent));
        this.textKey = key; this.textCanvas = surface; return surface;
    }
    render(base, settings, time, plan) {
        const scene = endingAt(settings, plan, time);
        if (!scene.visible || scene.alpha <= 0) return base;
        let source;
        if (settings.endingType === 'text') source = this.text(settings);
        else if (this.asset) {
            if (this.asset.player) this.asset.player.setFrame(lottieFrame(scene.time, this.asset.duration, this.asset.totalFrames));
            source = this.asset.canvas;
        }
        if (!source) return base;
        const surface = this.output ||= new OffscreenCanvas(base.width, base.height);
        if (surface.width !== base.width || surface.height !== base.height) { surface.width = base.width; surface.height = base.height; }
        const ctx = surface.getContext('2d'); ctx.clearRect(0, 0, surface.width, surface.height); ctx.drawImage(base, 0, 0);
        const scale = settings.endingScale / 100 * Math.min(surface.width / source.width, surface.height / source.height);
        const width = source.width * scale, height = source.height * scale;
        ctx.globalAlpha = scene.alpha; ctx.drawImage(source, (surface.width - width) / 2, (surface.height - height) / 2, width, height); ctx.globalAlpha = 1;
        return surface;
    }
    destroy() { this.generation++; this.asset?.destroy(); this.asset = null; this.textCanvas = null; this.output = null; }
}
