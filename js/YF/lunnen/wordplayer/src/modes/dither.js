import { DEFAULT_PATTERN_TEXT } from '../config/defaults.js';
import { makeResolutionGrid } from '../core/math.js';

const DITHER_SETTINGS_KEYS = [
    'width', 'height', 'patternText', 'allCaps', 'resolution', 'density',
    'ditherAlgorithm', 'contrast', 'blackPoint', 'whitePoint', 'invertDither',
    'sizeMin', 'sizeMax', 'weightMin', 'weightMax', 'rotationMin', 'rotationMax',
    'noiseMin', 'noiseMax', 'sizeEnabled', 'weightEnabled', 'rotationEnabled',
    'noiseEnabled', 'hideTinyLetters'
];

function cleanPatternText(text, allCaps) {
    const source = allCaps
        ? String(text || '').toLocaleUpperCase('ru-RU')
        : String(text || '');
    const fallback = allCaps
        ? DEFAULT_PATTERN_TEXT.toLocaleUpperCase('ru-RU')
        : DEFAULT_PATTERN_TEXT;
    const chars = Array.from(source.replace(/\s+/g, ''));
    return chars.length ? chars : Array.from(fallback.replace(/\s+/g, ''));
}

function drawImageCover(ctx, image, width, height) {
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const imageAspect = imageWidth / imageHeight;
    const targetAspect = width / height;
    let sx = 0;
    let sy = 0;
    let sw = imageWidth;
    let sh = imageHeight;
    if (imageAspect > targetAspect) {
        sw = imageHeight * targetAspect;
        sx = (imageWidth - sw) / 2;
    } else {
        sh = imageWidth / targetAspect;
        sy = (imageHeight - sh) / 2;
    }
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

export class DitherEngine {
    constructor() {
        this.sourceImage = null;
        this.sourceKey = 'gradient';
        this.toneCache = { key: '', tones: null };
        this.gridCache = { key: '', grid: null };
        this.sceneCache = { key: '', scene: null };
        this.sampleCanvas = document.createElement('canvas');
        this.sampleContext = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    }

    setImage(image, key) {
        this.sourceImage = image;
        this.sourceKey = key;
        this.toneCache.key = '';
        this.sceneCache.key = '';
    }

    invalidate() {
        this.toneCache.key = '';
        this.gridCache.key = '';
        this.sceneCache.key = '';
    }

    getGrid(settings) {
        const key = `${settings.width}|${settings.height}|${settings.resolution}|${settings.density}`;
        if (this.gridCache.key !== key) {
            this.gridCache = {
                key,
                grid: makeResolutionGrid(settings.width, settings.height, settings.resolution, settings.density)
            };
        }
        return this.gridCache.grid;
    }

    buildRawTones(settings, cols, rows) {
        const tones = new Float32Array(cols * rows);
        if (!this.sourceImage) {
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const tone = clamp(x / Math.max(1, cols - 1) * 0.6 + y / Math.max(1, rows - 1) * 0.4);
                    tones[y * cols + x] = settings.invertDither ? 1 - tone : tone;
                }
            }
            return tones;
        }

        this.sampleCanvas.width = cols;
        this.sampleCanvas.height = rows;
        this.sampleContext.clearRect(0, 0, cols, rows);
        drawImageCover(this.sampleContext, this.sourceImage, cols, rows);
        const data = this.sampleContext.getImageData(0, 0, cols, rows).data;
        for (let index = 0, pixel = 0; index < data.length; index += 4, pixel++) {
            tones[pixel] = processedTone(data[index], data[index + 1], data[index + 2], settings);
        }
        return tones;
    }

    getTones(settings, grid) {
        const hideTiny = settings.hideTinyLetters !== false;
        const key = [
            this.sourceKey,
            settings.width,
            settings.height,
            grid.cols,
            grid.rows,
            settings.ditherAlgorithm,
            settings.contrast,
            settings.blackPoint,
            settings.whitePoint,
            settings.invertDither,
            hideTiny
        ].join('|');
        if (this.toneCache.key === key) return this.toneCache.tones;
        const raw = this.buildRawTones(settings, grid.cols, grid.rows);
        const tones = settings.ditherAlgorithm === 'bayer'
            ? applyBayer(raw, grid.cols, grid.rows, hideTiny)
            : applyFloydSteinberg(raw, grid.cols, grid.rows, hideTiny);
        this.toneCache = { key, tones };
        return tones;
    }

    compute(settings) {
        const sceneKey = [
            this.sourceKey,
            settings.width,
            settings.height,
            settings.patternText,
            settings.allCaps,
            settings.resolution,
            settings.density,
            settings.ditherAlgorithm,
            settings.contrast,
            settings.blackPoint,
            settings.whitePoint,
            settings.invertDither,
            settings.sizeMin,
            settings.sizeMax,
            settings.weightMin,
            settings.weightMax,
            settings.rotationMin,
            settings.rotationMax,
            settings.noiseMin,
            settings.noiseMax,
            settings.sizeEnabled,
            settings.weightEnabled,
            settings.rotationEnabled,
            settings.noiseEnabled,
            settings.hideTinyLetters,
            settings.inkColor,
            settings.bgColor
        ].join('|');
        if (this.sceneCache.key === sceneKey) return this.sceneCache.scene;

        const grid = this.getGrid(settings);
        const tones = this.getTones(settings, grid);
        const chars = cleanPatternText(settings.patternText, settings.allCaps);
        const base = Math.max(1, Math.min(grid.cellW, grid.cellH) * 0.74);
        const sizeMin = clamp(Math.min(settings.sizeMin, settings.sizeMax) / 100, 0.01, 4);
        const sizeMax = clamp(Math.max(settings.sizeMin, settings.sizeMax) / 100, 0.01, 4);
        const weightMin = Math.min(settings.weightMin, settings.weightMax);
        const weightMax = Math.max(settings.weightMin, settings.weightMax);
        const noiseMin = clamp(Number(settings.noiseMin ?? 0) / 100, 0, 4);
        const noiseMax = clamp(Number(settings.noiseMax ?? 0) / 100, 0, 4);
        const hideTiny = settings.hideTinyLetters !== false;
        const glyphs = [];
        let sourceIndex = 0;

        for (let row = 0; row < grid.rows; row++) {
            for (let col = 0; col < grid.cols; col++, sourceIndex++) {
                const tone = tones[row * grid.cols + col] || 0;
                if (hideTiny && tone <= EMPTY_TONE) continue;
                const size = base * (settings.sizeEnabled === false ? sizeMax : lerp(sizeMin, sizeMax, tone));
                const weight = settings.weightEnabled === false ? weightMax : lerp(weightMin, weightMax, tone);
                const rotation = settings.rotationEnabled === false
                    ? 0
                    : lerp(Number(settings.rotationMin || 0), Number(settings.rotationMax || 0), tone);
                const noise = settings.noiseEnabled === false ? 0 : lerp(noiseMin, noiseMax, tone);
                const offset = Math.min(grid.cellW, grid.cellH) * noise;
                const x = grid.originX + col * grid.pitchW + signedNoise(sourceIndex, 1) * offset;
                const y = grid.originY + row * grid.pitchH + signedNoise(sourceIndex, 2) * offset;
                if (x < 0 || x > settings.width || y < 0 || y > settings.height) continue;
                glyphs.push({
                    char: chars[sourceIndex % chars.length],
                    x,
                    y,
                    size,
                    weight: roundWeight(weight),
                    rotation,
                    baseline: 'middle',
                    fill: settings.inkColor
                });
            }
        }

        const scene = {
            width: settings.width,
            height: settings.height,
            bgColor: settings.bgColor,
            glyphs
        };
        this.sceneCache = { key: sceneKey, scene };
        return scene;
    }
}
