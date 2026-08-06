const EMPTY_TONE = 0.05;

let sampleKey = 'gradient';
let samplePixels = null;
let sampleWidth = 0;
let sampleHeight = 0;
let toneCache = { key: '', tones: null };

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const roundWeight = (value) => clamp(Math.round(Number(value) / 100) * 100, 100, 900);

function signedNoise(index, salt) {
    const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453123;
    return (value - Math.floor(value)) * 2 - 1;
}

function makeGrid(width, height, resolution, density = 0) {
    const cols = Math.max(1, Math.round(resolution));
    const rows = Math.max(1, Math.round(cols * height / width));
    const cellW = width / cols;
    const cellH = height / rows;
    const densityValue = clamp(Number(density || 0) / 100, -1, 1);
    const pitchScale = densityValue >= 0 ? lerp(1, 0.62, densityValue) : lerp(1, 1.28, -densityValue);
    const pitchW = cellW * pitchScale;
    const pitchH = cellH * pitchScale;
    return {
        cols,
        rows,
        cellW,
        cellH,
        pitchW,
        pitchH,
        originX: width / 2 - ((cols - 1) * pitchW) / 2,
        originY: height / 2 - ((rows - 1) * pitchH) / 2
    };
}

function processedTone(r, g, b, settings) {
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const range = Math.max(1, settings.whitePoint - settings.blackPoint);
    let value = clamp((luminance - settings.blackPoint) / range);
    value = clamp((value - 0.5) * settings.contrast + 0.5);
    const tone = 1 - value;
    return settings.invertDither ? 1 - tone : tone;
}

function buildRawTones(settings, cols, rows) {
    const tones = new Float32Array(cols * rows);
    if (!samplePixels || sampleWidth !== cols || sampleHeight !== rows) {
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const tone = clamp(x / Math.max(1, cols - 1) * 0.6 + y / Math.max(1, rows - 1) * 0.4);
                tones[y * cols + x] = settings.invertDither ? 1 - tone : tone;
            }
        }
        return tones;
    }
    for (let index = 0, pixel = 0; index < samplePixels.length; index += 4, pixel++) {
        tones[pixel] = processedTone(samplePixels[index], samplePixels[index + 1], samplePixels[index + 2], settings);
    }
    return tones;
}

function applyBayer(raw, cols, rows, hideTiny) {
    const matrix = [
        0, 32, 8, 40, 2, 34, 10, 42,
        48, 16, 56, 24, 50, 18, 58, 26,
        12, 44, 4, 36, 14, 46, 6, 38,
        60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 35, 9, 41,
        51, 19, 59, 27, 49, 17, 57, 25,
        15, 47, 7, 39, 13, 45, 5, 37,
        63, 31, 55, 23, 61, 29, 53, 21
    ];
    const out = new Float32Array(raw.length);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const index = y * cols + x;
            if (hideTiny && raw[index] <= EMPTY_TONE) continue;
            const threshold = (matrix[(y % 8) * 8 + (x % 8)] + 0.5) / 64;
            const bit = raw[index] >= threshold ? 1 : 0;
            out[index] = clamp(raw[index] * 0.32 + bit * 0.68);
        }
    }
    return out;
}

function applyFloydSteinberg(raw, cols, rows, hideTiny) {
    const working = new Float32Array(raw);
    const out = new Float32Array(raw.length);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const index = y * cols + x;
            if (hideTiny && raw[index] <= EMPTY_TONE) {
                working[index] = 0;
                continue;
            }
            const oldValue = clamp(working[index]);
            const bit = oldValue >= 0.5 ? 1 : 0;
            const error = oldValue - bit;
            out[index] = clamp(raw[index] * 0.28 + bit * 0.72);
            if (x + 1 < cols) working[index + 1] += error * 7 / 16;
            if (y + 1 < rows) {
                if (x > 0) working[index + cols - 1] += error * 3 / 16;
                working[index + cols] += error * 5 / 16;
                if (x + 1 < cols) working[index + cols + 1] += error / 16;
            }
        }
    }
    return out;
}

function getTones(settings, grid) {
    const hideTiny = settings.hideTinyLetters !== false;
    const key = [
        sampleKey,
        grid.cols,
        grid.rows,
        settings.ditherAlgorithm,
        settings.contrast,
        settings.blackPoint,
        settings.whitePoint,
        settings.invertDither,
        hideTiny
    ].join('|');
    if (toneCache.key === key) return toneCache.tones;
    const raw = buildRawTones(settings, grid.cols, grid.rows);
    const tones = settings.ditherAlgorithm === 'bayer'
        ? applyBayer(raw, grid.cols, grid.rows, hideTiny)
        : applyFloydSteinberg(raw, grid.cols, grid.rows, hideTiny);
    toneCache = { key, tones };
    return tones;
}

function compute(payload) {
    const { settings, chars } = payload;
    const grid = makeGrid(settings.width, settings.height, settings.resolution, settings.density);
    const tones = getTones(settings, grid);
    const base = Math.max(1, Math.min(grid.cellW, grid.cellH) * 0.74);
    const sizeMin = clamp(Math.min(settings.sizeMin, settings.sizeMax) / 100, 0.01, 4);
    const sizeMax = clamp(Math.max(settings.sizeMin, settings.sizeMax) / 100, 0.01, 4);
    const weightMin = Math.min(settings.weightMin, settings.weightMax);
    const weightMax = Math.max(settings.weightMin, settings.weightMax);
    const noiseMin = clamp(Number(settings.noiseMin ?? 0) / 100, 0, 4);
    const noiseMax = clamp(Number(settings.noiseMax ?? 0) / 100, 0, 4);
    const hideTiny = settings.hideTinyLetters !== false;
    const weights = new Uint16Array(grid.cols * grid.rows);
    const values = new Float32Array(grid.cols * grid.rows * 4);
    const outputChars = [];
    let sourceIndex = 0;
    let count = 0;

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
            outputChars.push(chars[sourceIndex % chars.length]);
            weights[count] = roundWeight(weight);
            values[count * 4] = x;
            values[count * 4 + 1] = y;
            values[count * 4 + 2] = size;
            values[count * 4 + 3] = rotation;
            count++;
        }
    }

    const resultWeights = weights.slice(0, count);
    const resultValues = values.slice(0, count * 4);
    self.postMessage({
        type: 'result',
        id: payload.id,
        key: payload.key,
        chars: outputChars,
        weights: resultWeights.buffer,
        values: resultValues.buffer
    }, [resultWeights.buffer, resultValues.buffer]);
}

self.onmessage = (event) => {
    const payload = event.data;
    if (payload.type !== 'compute') return;
    if (payload.sampleSource) {
        sampleKey = payload.sampleKey;
        sampleWidth = payload.sampleSource.width;
        sampleHeight = payload.sampleSource.height;
        samplePixels = new Uint8ClampedArray(payload.sampleSource.pixels);
        toneCache.key = '';
    } else if (payload.sampleKey === 'gradient') {
        sampleKey = 'gradient';
        sampleWidth = 0;
        sampleHeight = 0;
        samplePixels = null;
        toneCache.key = '';
    } else if (payload.sampleKey !== sampleKey) {
        self.postMessage({ type: 'error', id: payload.id, key: payload.key, message: 'Missing image sample' });
        return;
    }
    compute(payload);
};
