import { roundWeight } from '../core/math.js';
import { renderSceneToCanvas } from '../render/canvas-renderer.js';

const staticFontUrls = new Map(
    Array.from({ length: 9 }, (_, index) => {
        const weight = (index + 1) * 100;
        return [weight, new URL(`../../assets/pattern-fonts/YSText-Upright-wght-${weight}.ttf`, import.meta.url).href];
    })
);

function escapeXml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(content, filename, mimeType) {
    downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export class WordplayerExporter {
    constructor() {
        this.opentypePromise = null;
        this.fonts = new Map();
        this.fontPromises = new Map();
    }

    async getOpenType() {
        if (!this.opentypePromise) {
            this.opentypePromise = import('../../vendor/lib/opentype.module.js')
                .then((module) => module.default || module);
        }
        return this.opentypePromise;
    }

    async loadFont(weight) {
        const rounded = roundWeight(weight);
        if (this.fonts.has(rounded)) return this.fonts.get(rounded);
        if (this.fontPromises.has(rounded)) return this.fontPromises.get(rounded);
        const promise = this.getOpenType().then((opentype) => new Promise((resolve, reject) => {
            opentype.load(staticFontUrls.get(rounded) || staticFontUrls.get(400), (error, font) => {
                if (error) reject(error);
                else {
                    this.fonts.set(rounded, font);
                    resolve(font);
                }
            });
        }));
        this.fontPromises.set(rounded, promise);
        return promise;
    }

    async exportCurvedSvg(scene) {
        const weights = [...new Set(scene.glyphs.map((glyph) => roundWeight(glyph.weight)))];
        await Promise.all(weights.map((weight) => this.loadFont(weight)));
        const parts = [
            `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`,
            `<rect width="${scene.width}" height="${scene.height}" fill="${escapeXml(scene.bgColor)}"/>`
        ];
        for (const glyph of scene.glyphs) {
            const font = this.fonts.get(roundWeight(glyph.weight)) || this.fonts.get(400);
            const sourceGlyph = font.charToGlyph(glyph.char);
            const scale = glyph.size / font.unitsPerEm;
            const advance = (sourceGlyph.advanceWidth || font.unitsPerEm * 0.5) * scale;
            const baseline = glyph.baseline === 'alphabetic'
                ? 0
                : (font.ascender + font.descender) * scale / 2;
            const path = sourceGlyph.getPath(-advance / 2, baseline, glyph.size);
            parts.push(
                `<path d="${path.toPathData(2)}" fill="${escapeXml(glyph.fill)}" ` +
                `transform="translate(${glyph.x.toFixed(3)} ${glyph.y.toFixed(3)}) rotate(${glyph.rotation.toFixed(3)})"/>`
            );
        }
        parts.push('</svg>');
        downloadText(parts.join(''), 'wordplayer-curves.svg', 'image/svg+xml;charset=utf-8');
    }

    async exportPng(scene, { scale = 3, transparent = false } = {}) {
        const canvas = renderSceneToCanvas(scene, { scale, transparent });
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Could not encode PNG');
        downloadBlob(blob, 'wordplayer.png');
    }
}
