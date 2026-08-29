import { DEFAULT_PATTERN_TEXT } from '../config/defaults.js';

const FORM_MASK_BASE = 540;
const FORM_METRIC_CACHE_LIMIT = 2048;
const PHYSICS_KEYS = [
    'width', 'height', 'patternText', 'allCaps', 'resolution', 'density',
    'weightMin', 'weightMax', 'sizeMin', 'sizeMax', 'rotationMin', 'rotationMax',
    'noiseMin', 'noiseMax', 'sizeEnabled', 'weightEnabled', 'rotationEnabled',
    'noiseEnabled', 'hideTinyLetters', 'invertDither', 'formEdgeSpread',
    'formAttraction', 'formStickiness', 'formFriction', 'formLetterSpacing',
    'formSettlingTime', 'formGravity', 'formGravityDirection', 'formCanvasEdges',
    'formInsideOut'
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

function physicsKey(settings, formKey) {
    return [formKey, ...PHYSICS_KEYS.map((key) => settings[key])].join('|');
}

function drawFormToMask(context, image, width, height) {
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const margin = 0.08;
    const boxWidth = width * (1 - margin * 2);
    const boxHeight = height * (1 - margin * 2);
    const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export class FormsEngine {
    constructor(onUpdate = () => {}) {
        this.onUpdate = onUpdate;
        this.formImage = null;
        this.formKey = '';
        this.worker = null;
        this.requestId = 0;
        this.requestedKey = '';
        this.geometryKey = '';
        this.geometry = null;
        this.sceneCache = { key: '', scene: null };
        this.sentMaskKey = '';
        this.measureCanvas = document.createElement('canvas');
        this.measureContext = this.measureCanvas.getContext('2d');
        this.metricCache = new Map();
    }

    ensureWorker() {
        if (this.worker) return this.worker;
        this.worker = new Worker(new URL('../workers/forms.worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
        this.worker.onerror = (event) => console.error('Forms worker failed:', event.message || event);
        return this.worker;
    }

    invalidate() {
        this.requestedKey = '';
        this.geometryKey = '';
        this.geometry = null;
        this.sceneCache.key = '';
    }

    invalidateMetrics() {
        this.metricCache.clear();
        this.invalidate();
    }

    setFormImage(image, key) {
        this.formImage = image;
        this.formKey = key;
        this.requestedKey = '';
        this.geometryKey = '';
        this.geometry = null;
        this.sceneCache.key = '';
        this.sentMaskKey = '';
    }

    createMaskSource(settings, maskKey) {
        const aspect = settings.width / settings.height;
        const width = aspect >= 1 ? FORM_MASK_BASE : Math.max(220, Math.round(FORM_MASK_BASE * aspect));
        const height = aspect >= 1 ? Math.max(220, Math.round(FORM_MASK_BASE / aspect)) : FORM_MASK_BASE;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.clearRect(0, 0, width, height);
        drawFormToMask(context, this.formImage, width, height);
        const data = context.getImageData(0, 0, width, height).data;
        const inside = new Uint8Array(width * height);
        for (let index = 0, pixel = 0; index < data.length; index += 4, pixel++) {
            inside[pixel] = data[index + 3] > 12 ? 1 : 0;
        }
        this.sentMaskKey = maskKey;
        return { width, height, inside: inside.buffer };
    }

    metricFor(char, weight) {
        const key = `${char}|${weight}`;
        if (this.metricCache.has(key)) {
            const cached = this.metricCache.get(key);
            this.metricCache.delete(key);
            this.metricCache.set(key, cached);
            return cached;
        }
        const size = 100;
        this.measureContext.textAlign = 'center';
        this.measureContext.textBaseline = 'alphabetic';
        this.measureContext.font = `${weight} ${size}px "YSTextPattern"`;
        const metrics = this.measureContext.measureText(char);
        const width = Math.max(size * 0.16,
            (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0) || metrics.width);
        const ascent = metrics.actualBoundingBoxAscent || size * 0.76;
        const descent = metrics.actualBoundingBoxDescent || size * 0.2;
        const result = [width / 2 / size, (ascent + descent) / 2 / size, Math.max(0.2, (ascent - descent) / 2) / size];
        if (this.metricCache.size >= FORM_METRIC_CACHE_LIMIT) {
            this.metricCache.delete(this.metricCache.keys().next().value);
        }
        this.metricCache.set(key, result);
        return result;
    }

    buildMetrics(chars) {
        const metrics = {};
        const uniqueChars = new Set([...chars, '?']);
        for (const char of uniqueChars) {
            for (let weight = 100; weight <= 900; weight += 100) {
                metrics[`${char}|${weight}`] = this.metricFor(char, weight);
            }
        }
        return metrics;
    }

    request(settings, key) {
        const chars = cleanPatternText(settings.patternText, settings.allCaps);
        const maskKey = `${this.formKey}|${settings.width}|${settings.height}`;
        const maskSource = this.sentMaskKey === maskKey ? null : this.createMaskSource(settings, maskKey);
        const id = ++this.requestId;
        this.requestedKey = key;
        const payload = {
            type: 'compute',
            id,
            key,
            maskKey,
            maskSource,
            settings: Object.fromEntries(PHYSICS_KEYS.map((name) => [name, settings[name]])),
            chars,
            fontMetrics: this.buildMetrics(chars)
        };
        const transfer = maskSource ? [maskSource.inside] : [];
        this.ensureWorker().postMessage(payload, transfer);
    }

    handleWorkerMessage(message) {
        if (message.type !== 'result' || message.id !== this.requestId) return;
        const weights = new Uint16Array(message.weights);
        const values = new Float32Array(message.values);
        this.geometry = message.chars.map((char, index) => ({
            char,
            x: values[index * 4],
            y: values[index * 4 + 1],
            size: values[index * 4 + 2],
            rotation: values[index * 4 + 3],
            weight: weights[index],
            baseline: 'alphabetic'
        }));
        this.geometryKey = message.key;
        this.sceneCache.key = '';
        this.onUpdate();
    }

    compute(settings) {
        const key = physicsKey(settings, this.formKey);
        if (this.formImage && key !== this.requestedKey && key !== this.geometryKey) {
            this.request(settings, key);
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
            pending: this.formImage && key !== this.geometryKey
        };
        this.sceneCache = { key: sceneKey, scene };
        return scene;
    }

    destroy() {
        this.worker?.terminate();
        this.worker = null;
    }
}
