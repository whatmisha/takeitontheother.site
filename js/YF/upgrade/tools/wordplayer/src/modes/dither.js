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
    constructor(onUpdate = () => {}) {
        this.onUpdate = onUpdate;
        this.sourceImage = null;
        this.sourceKey = 'gradient';
        this.worker = null;
        this.requestId = 0;
        this.activeRequestId = 0;
        this.requestedKey = '';
        this.geometryKey = '';
        this.geometry = null;
        this.inFlight = false;
        this.pendingRequest = null;
        this.sentSampleKey = '';
        this.gridCache = { key: '', grid: null };
        this.sceneCache = { key: '', scene: null };
        this.sampleCanvas = document.createElement('canvas');
        this.sampleContext = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    }

    ensureWorker() {
        if (this.worker) return this.worker;
        this.worker = new Worker(new URL('../workers/dither.worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
        this.worker.onerror = (event) => {
            console.error('Dither worker failed:', event.message || event);
            this.inFlight = false;
            this.requestedKey = '';
            this.flushRequest();
        };
        return this.worker;
    }

    setImage(image, key) {
        this.sourceImage = image;
        this.sourceKey = key;
        this.sentSampleKey = '';
        this.invalidate();
    }

    invalidate() {
        this.requestedKey = '';
        this.geometryKey = '';
        this.geometry = null;
        this.pendingRequest = null;
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

    createSample(settings) {
        if (!this.sourceImage) {
            this.sentSampleKey = 'gradient';
            return { key: 'gradient', source: null, transfer: [] };
        }
        const grid = this.getGrid(settings);
        const key = `${this.sourceKey}|${settings.width}|${settings.height}|${grid.cols}|${grid.rows}`;
        if (this.sentSampleKey === key) return { key, source: null, transfer: [] };

        this.sampleCanvas.width = grid.cols;
        this.sampleCanvas.height = grid.rows;
        this.sampleContext.clearRect(0, 0, grid.cols, grid.rows);
        drawImageCover(this.sampleContext, this.sourceImage, grid.cols, grid.rows);
        const pixels = this.sampleContext.getImageData(0, 0, grid.cols, grid.rows).data;
        this.sentSampleKey = key;
        return {
            key,
            source: { width: grid.cols, height: grid.rows, pixels: pixels.buffer },
            transfer: [pixels.buffer]
        };
    }

    queueRequest(settings, key) {
        const snapshot = Object.fromEntries(DITHER_SETTINGS_KEYS.map((name) => [name, settings[name]]));
        this.requestedKey = key;
        this.pendingRequest = {
            key,
            settings: snapshot,
            chars: cleanPatternText(snapshot.patternText, snapshot.allCaps)
        };
        this.flushRequest();
    }

    flushRequest() {
        if (this.inFlight || !this.pendingRequest) return;
        const request = this.pendingRequest;
        this.pendingRequest = null;
        this.requestedKey = request.key;
        const sample = this.createSample(request.settings);
        const id = ++this.requestId;
        this.activeRequestId = id;
        this.inFlight = true;
        this.ensureWorker().postMessage({
            type: 'compute',
            id,
            key: request.key,
            sampleKey: sample.key,
            sampleSource: sample.source,
            settings: request.settings,
            chars: request.chars
        }, sample.transfer);
    }

    handleWorkerMessage(message) {
        if (message.id !== this.activeRequestId) return;
        this.inFlight = false;
        let accepted = false;
        if (message.type === 'result' && message.key === this.requestedKey) {
            const weights = new Uint16Array(message.weights);
            const values = new Float32Array(message.values);
            this.geometry = message.chars.map((char, index) => ({
                char,
                x: values[index * 4],
                y: values[index * 4 + 1],
                size: values[index * 4 + 2],
                rotation: values[index * 4 + 3],
                weight: weights[index],
                baseline: 'middle'
            }));
            this.geometryKey = message.key;
            this.sceneCache.key = '';
            accepted = true;
        } else if (message.type === 'error') {
            console.error(`Dither worker: ${message.message || 'unknown error'}`);
            this.requestedKey = '';
        }
        this.flushRequest();
        if (accepted) this.onUpdate();
    }

    compute(settings) {
        const key = [
            this.sourceKey,
            ...DITHER_SETTINGS_KEYS.map((name) => settings[name])
        ].join('|');
        if (key !== this.geometryKey && key !== this.requestedKey) {
            this.queueRequest(settings, key);
        }

        const sceneKey = `${key}|${settings.inkColor}|${settings.bgColor}|${this.geometryKey}`;
        if (this.sceneCache.key === sceneKey) return this.sceneCache.scene;
        const glyphs = this.geometry
            ? this.geometry.map((glyph) => ({ ...glyph, fill: settings.inkColor }))
            : [];
        const scene = {
            width: settings.width,
            height: settings.height,
            bgColor: settings.bgColor,
            glyphs,
            pending: key !== this.geometryKey
        };
        this.sceneCache = { key: sceneKey, scene };
        return scene;
    }

    destroy() {
        this.worker?.terminate();
        this.worker = null;
    }
}
