import { defineTool } from './ui-framework/src/core/defineTool.js';
import opentypeModule from './vendor/lib/opentype.module.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PATTERN_FONT_URL = './fonts/Yandex%20Sans/YS%20Text%20Variable/YSText-Upright-weight-VF.ttf';
const STATIC_PATTERN_FONT_URLS = new Map(
    Array.from({ length: 9 }, (_, index) => {
        const weight = (index + 1) * 100;
        return [weight, `./assets/pattern-fonts/YSText-Upright-wght-${weight}.ttf`];
    })
);
const DEFAULT_IMAGE_URL = './assets/default-image.png';
const DEFAULT_FORM_URL = './assets/default-form.svg';
const DEFAULT_PATTERN_TEXT = `Чтение может стать золотым часом дня — временем, когда всё погружается в цельную особенную атсмосферу и можно вернуться к себе и пережить что-то новое, погрузившись в книгу. В дизайне мы тоже подсвечиваем этот путь — иммерсивность погружения в книгу от лица читателя. Мы показываем именно этот момент перехода — резкость и холод внешнего мира растворяются в тёплом камерном пространстве чтения`;
const DITHER_EMPTY_TONE = 0.05;
const AVAILABLE_MODES = new Set(['dither', 'forms']);
let pillToggleResizeObserver = null;

const state = {
    sourceImage: null,
    sourceImageKey: 'gradient',
    imageLabel: 'sample.png',
    ditherCache: { key: '', tones: null },
    magneticPoints: [],
    hoverPoint: null,
    formImage: null,
    formImageKey: '',
    formLabel: 'sample.svg',
    formMask: null,
    formMaskKey: '',
    formBoundary: [],
    formSampleCache: { key: '', samples: null },
    staticFonts: new Map(),
    staticFontPromises: new Map(),
    opentypePromise: null,
    fontPromise: null
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function normalizeMode(mode) {
    return AVAILABLE_MODES.has(mode) ? mode : 'dither';
}

function roundWeight(value) {
    return clamp(Math.round(value / 100) * 100, 100, 900);
}

function cleanPatternText(text, allCaps = false) {
    const source = allCaps
        ? String(text || '').toLocaleUpperCase('ru-RU')
        : String(text || '');
    const fallback = allCaps
        ? DEFAULT_PATTERN_TEXT.toLocaleUpperCase('ru-RU')
        : DEFAULT_PATTERN_TEXT;
    const chars = Array.from(source.replace(/\s+/g, ''));
    return chars.length ? chars : Array.from(fallback.replace(/\s+/g, ''));
}

function densityPitchScale(density) {
    const value = clamp(Number(density ?? 0) / 100, -1, 1);
    return value >= 0
        ? lerp(1, 0.62, value)
        : lerp(1, 1.28, -value);
}

function makeResolutionGrid(width, height, resolution, density = 0) {
    const cols = Math.max(1, Math.round(resolution));
    const rows = Math.max(1, Math.round(cols * height / width));
    const cellW = width / cols;
    const cellH = height / rows;
    const pitchScale = densityPitchScale(density);
    const pitchW = cellW * pitchScale;
    const pitchH = cellH * pitchScale;
    const originX = width / 2 - ((cols - 1) * pitchW) / 2;
    const originY = height / 2 - ((rows - 1) * pitchH) / 2;
    const points = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            points.push({
                col,
                row,
                x: originX + col * pitchW,
                y: originY + row * pitchH,
                cellW,
                cellH,
                pitchW,
                pitchH
            });
        }
    }
    return { cols, rows, cellW, cellH, pitchW, pitchH, points };
}

function baseSizeFromGrid(grid, ratio = 0.74) {
    return Math.max(1, Math.min(grid.cellW, grid.cellH) * ratio);
}

function relativeSizeRange(settings) {
    const min = clamp(Number(settings.sizeMin ?? 36) / 100, 0.01, 4);
    const max = clamp(Number(settings.sizeMax ?? 96) / 100, 0.01, 4);
    return {
        min: Math.min(min, max),
        max: Math.max(min, max)
    };
}

function relativeNoiseRange(settings) {
    return {
        min: clamp(Number(settings.noiseMin ?? 0) / 100, 0, 4),
        max: clamp(Number(settings.noiseMax ?? 0) / 100, 0, 4)
    };
}

function signedNoise(index, salt) {
    const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453123;
    return (value - Math.floor(value)) * 2 - 1;
}

function createSvgElement(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => {
        if (value != null) el.setAttribute(key, String(value));
    });
    return el;
}

function addSvgDefs(svg, create) {
    const defs = create('defs');
    const style = create('style');
    style.textContent = `
        @font-face {
            font-family: "YSTextPattern";
            src: url("${PATTERN_FONT_URL}") format("truetype");
            font-weight: 100 900;
            font-style: normal;
        }
        .pattern-letter {
            font-family: "YSTextPattern", sans-serif;
            font-variation-settings: "wght" var(--pattern-weight, 400);
            letter-spacing: 0;
        }
    `;
    defs.appendChild(style);
    svg.appendChild(defs);
}

function drawBackground(ctx) {
    const { svg, create, width, height, settings } = ctx;
    svg.appendChild(create('rect', {
        'data-export-background': 'true',
        x: 0,
        y: 0,
        width,
        height,
        fill: settings.bgColor
    }));
}

function drawLetter(ctx, options) {
    const { create, svg } = ctx;
    const {
        char,
        x,
        y,
        size,
        weight,
        rotation = 0,
        fill,
        extraClass = ''
    } = options;
    if (!Number.isFinite(size) || size <= 0) return;

    const roundedWeight = roundWeight(weight);
    const el = create('text', {
        x: 0,
        y: 0,
        class: `pattern-letter ${extraClass}`.trim(),
        fill,
        'font-family': 'YSTextPattern',
        'font-size': size.toFixed(3),
        'font-weight': roundedWeight,
        'data-weight': roundedWeight,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rotation.toFixed(3)})`,
        style: `--pattern-weight:${roundedWeight};font-variation-settings:"wght" ${roundedWeight};`
    });
    el.textContent = char;
    svg.appendChild(el);
}

function processedToneFromRgb(r, g, b, settings) {
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const range = Math.max(1, settings.whitePoint - settings.blackPoint);
    let value = clamp((luminance - settings.blackPoint) / range);
    value = clamp((value - 0.5) * settings.contrast + 0.5);
    const tone = 1 - value;
    return settings.invertDither ? 1 - tone : tone;
}

function drawImageCover(ctx, image, destW, destH) {
    const imgW = image.naturalWidth || image.width;
    const imgH = image.naturalHeight || image.height;
    const imgAspect = imgW / imgH;
    const destAspect = destW / destH;
    let sx = 0;
    let sy = 0;
    let sw = imgW;
    let sh = imgH;
    if (imgAspect > destAspect) {
        sw = imgH * destAspect;
        sx = (imgW - sw) / 2;
    } else {
        sh = imgW / destAspect;
        sy = (imgH - sh) / 2;
    }
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, destW, destH);
}

function buildRawToneGrid(settings, cols, rows) {
    const tones = new Float32Array(cols * rows);
    if (!state.sourceImage) {
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const dx = x / Math.max(1, cols - 1);
                const dy = y / Math.max(1, rows - 1);
                const tone = clamp((dx * 0.6 + dy * 0.4));
                tones[y * cols + x] = settings.invertDither ? 1 - tone : tone;
            }
        }
        return tones;
    }

    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const off = canvas.getContext('2d', { willReadFrequently: true });
    off.clearRect(0, 0, cols, rows);
    drawImageCover(off, state.sourceImage, cols, rows);
    const { data } = off.getImageData(0, 0, cols, rows);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        tones[p] = processedToneFromRgb(data[i], data[i + 1], data[i + 2], settings);
    }
    return tones;
}

function applyBayerDither(raw, cols, rows, hideTiny) {
    const matrix = [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21]
    ];
    const out = new Float32Array(raw.length);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const idx = y * cols + x;
            if (hideTiny && raw[idx] <= DITHER_EMPTY_TONE) {
                out[idx] = 0;
                continue;
            }
            const threshold = (matrix[y % 8][x % 8] + 0.5) / 64;
            const bit = raw[idx] >= threshold ? 1 : 0;
            out[idx] = clamp(raw[idx] * 0.32 + bit * 0.68);
        }
    }
    return out;
}

function applyFloydSteinbergDither(raw, cols, rows, hideTiny) {
    const working = new Float32Array(raw);
    const out = new Float32Array(raw.length);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const idx = y * cols + x;
            if (hideTiny && raw[idx] <= DITHER_EMPTY_TONE) {
                working[idx] = 0;
                out[idx] = 0;
                continue;
            }
            const oldValue = clamp(working[idx]);
            const bit = oldValue >= 0.5 ? 1 : 0;
            const error = oldValue - bit;
            out[idx] = clamp(raw[idx] * 0.28 + bit * 0.72);
            if (x + 1 < cols) working[idx + 1] += error * 7 / 16;
            if (y + 1 < rows) {
                if (x > 0) working[idx + cols - 1] += error * 3 / 16;
                working[idx + cols] += error * 5 / 16;
                if (x + 1 < cols) working[idx + cols + 1] += error * 1 / 16;
            }
        }
    }
    return out;
}

function getDitherTones(settings, grid) {
    const hideTiny = settings.hideTinyLetters !== false;
    const key = [
        state.sourceImageKey,
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

    if (state.ditherCache.key === key && state.ditherCache.tones) {
        return state.ditherCache.tones;
    }

    const raw = buildRawToneGrid(settings, grid.cols, grid.rows);
    const tones = settings.ditherAlgorithm === 'bayer'
        ? applyBayerDither(raw, grid.cols, grid.rows, hideTiny)
        : applyFloydSteinbergDither(raw, grid.cols, grid.rows, hideTiny);

    state.ditherCache = { key, tones };
    return tones;
}

function typographyFromTone(settings, base, minWeight, maxWeight, tone) {
    const sizeRange = relativeSizeRange(settings);
    const sizeEnabled = settings.sizeEnabled !== false;
    const weightEnabled = settings.weightEnabled !== false;
    const rotationEnabled = settings.rotationEnabled !== false;
    return {
        size: base * (sizeEnabled ? lerp(sizeRange.min, sizeRange.max, tone) : sizeRange.max),
        weight: weightEnabled ? lerp(minWeight, maxWeight, tone) : maxWeight,
        rotation: rotationEnabled ? lerp(Number(settings.rotationMin ?? 0), Number(settings.rotationMax ?? 0), tone) : 0
    };
}

function renderDither(ctx) {
    const { settings, width, height } = ctx;
    const chars = cleanPatternText(settings.patternText, settings.allCaps);
    const grid = makeResolutionGrid(width, height, settings.resolution, settings.density);
    const tones = getDitherTones(settings, grid);
    const base = baseSizeFromGrid(grid, 0.74);
    const minWeight = Math.min(settings.weightMin, settings.weightMax);
    const maxWeight = Math.max(settings.weightMin, settings.weightMax);
    const noiseRange = relativeNoiseRange(settings);
    const hideTiny = settings.hideTinyLetters !== false;

    grid.points.forEach((point, index) => {
        const tone = tones[point.row * grid.cols + point.col] ?? 0;
        if (hideTiny && tone <= DITHER_EMPTY_TONE) return;
        const char = chars[index % chars.length];
        const type = typographyFromTone(settings, base, minWeight, maxWeight, tone);
        const noise = settings.noiseEnabled !== false
            ? lerp(noiseRange.min, noiseRange.max, tone)
            : 0;
        const offset = Math.min(point.cellW, point.cellH) * noise;
        const x = point.x + signedNoise(index, 1) * offset;
        const y = point.y + signedNoise(index, 2) * offset;
        if (x < 0 || x > width || y < 0 || y > height) return;
        drawLetter(ctx, {
            char,
            x,
            y,
            size: type.size,
            weight: type.weight,
            rotation: type.rotation,
            fill: settings.inkColor
        });
    });
}

function currentMagneticSources(settings, includeHover = true) {
    const sources = state.magneticPoints.slice();
    if (includeHover && state.hoverPoint) {
        sources.push({
            x: state.hoverPoint.x,
            y: state.hoverPoint.y,
            force: settings.fieldForce,
            radius: settings.fieldRadius,
            preview: true
        });
    }
    return sources;
}

function magneticFieldAt(x, y, settings) {
    let vx = 0;
    let vy = 0;
    let influence = 0;
    const sources = currentMagneticSources(settings);
    sources.forEach((source) => {
        const d = dist(x, y, source.x, source.y);
        if (d > source.radius) return;
        if (d <= 0.001) {
            influence = Math.max(influence, source.force / 100);
            return;
        }
        const amount = Math.pow(1 - d / source.radius, 2) * source.force / 100;
        vx += (source.x - x) / d * amount;
        vy += (source.y - y) / d * amount;
        influence = Math.max(influence, amount);
    });
    return { vx, vy, influence: clamp(influence) };
}

function renderFields(ctx) {
    const { settings, width, height } = ctx;
    const chars = cleanPatternText(settings.patternText, settings.allCaps);
    const grid = makeResolutionGrid(width, height, settings.resolution);
    const base = baseSizeFromGrid(grid, 0.68);
    const minWeight = Math.min(settings.weightMin, settings.weightMax);
    const maxWeight = Math.max(settings.weightMin, settings.weightMax);
    const sizeRange = relativeSizeRange(settings);

    grid.points.forEach((point, index) => {
        const field = magneticFieldAt(point.x, point.y, settings);
        const hasDirection = Math.hypot(field.vx, field.vy) > 0.0001;
        const response = settings.fieldResponse;
        const neutralWeight = lerp(minWeight, maxWeight, 0.72);
        const offsetScale = settings.fieldRadius * 0.48;
        const x = clamp(point.x + field.vx * offsetScale, 0, width);
        const y = clamp(point.y + field.vy * offsetScale, 0, height);
        let size = base * lerp(sizeRange.max, sizeRange.min, field.influence);
        let weight = lerp(neutralWeight, minWeight, field.influence);
        let rotation = 0;

        if ((response === 'rotate' || response === 'all') && hasDirection) {
            rotation = Math.atan2(field.vy, field.vx) * 180 / Math.PI;
        }
        if (response === 'size' || response === 'all') {
            size = base * lerp(sizeRange.max, sizeRange.min, field.influence);
        }
        if (response === 'weight' || response === 'all') {
            weight = lerp(neutralWeight, minWeight, field.influence);
        }

        drawLetter(ctx, {
            char: chars[index % chars.length],
            x,
            y,
            size,
            weight,
            rotation,
            fill: settings.inkColor
        });
    });

    if (settings.showGuides) drawMagneticGuides(ctx);
}

function drawMagneticGuides(ctx) {
    const { svg, create, settings } = ctx;
    state.magneticPoints.forEach((point) => {
        svg.appendChild(create('circle', {
            class: 'magnet-ui',
            'data-interactive': 'true',
            cx: point.x,
            cy: point.y,
            r: 4,
            fill: '#ff4242',
            opacity: 0.9
        }));
        svg.appendChild(create('circle', {
            class: 'magnet-ui',
            'data-interactive': 'true',
            cx: point.x,
            cy: point.y,
            r: point.radius,
            fill: 'none',
            stroke: '#ff4242',
            'stroke-width': 1,
            opacity: 0.25
        }));
    });
    if (state.hoverPoint) {
        svg.appendChild(create('circle', {
            class: 'magnet-ui',
            'data-interactive': 'true',
            cx: state.hoverPoint.x,
            cy: state.hoverPoint.y,
            r: settings.fieldRadius,
            fill: 'none',
            stroke: '#ffffff',
            'stroke-width': 1,
            opacity: 0.22
        }));
    }
}

function loadImageFromUrl(url, label, app) {
    const image = new Image();
    image.onload = () => {
        state.sourceImage = image;
        state.sourceImageKey = `${label}:${image.naturalWidth}x${image.naturalHeight}:${Date.now()}`;
        state.imageLabel = label;
        state.ditherCache.key = '';
        syncStatusLabels();
        app.renderNow();
    };
    image.src = url;
}

function loadImageFile(file, app) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadImageFromUrl(reader.result, file.name, app);
    reader.readAsDataURL(file);
}

function drawFormImageToMask(ctx, image, maskW, maskH) {
    const imgW = image.naturalWidth || image.width;
    const imgH = image.naturalHeight || image.height;
    const margin = 0.08;
    const boxW = maskW * (1 - margin * 2);
    const boxH = maskH * (1 - margin * 2);
    const scale = Math.min(boxW / imgW, boxH / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    ctx.drawImage(image, (maskW - dw) / 2, (maskH - dh) / 2, dw, dh);
}

function normalizeFormSvg(svgText) {
    const parsed = new DOMParser().parseFromString(String(svgText || ''), 'image/svg+xml');
    if (parsed.querySelector('parsererror')) return null;
    const svg = parsed.querySelector('svg');
    if (!svg) return null;
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.querySelectorAll('script, metadata, style, title, desc').forEach((node) => node.remove());
    svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline').forEach((node) => {
        node.removeAttribute('class');
        node.removeAttribute('style');
        node.removeAttribute('opacity');
        node.removeAttribute('fill-opacity');
        node.removeAttribute('stroke');
        node.removeAttribute('stroke-width');
        node.setAttribute('fill', '#000');
    });
    return new XMLSerializer().serializeToString(svg);
}

function ensureFormMask(settings) {
    if (!state.formImage) return null;
    const key = `${state.formImageKey}|${settings.width}|${settings.height}`;
    if (state.formMaskKey === key && state.formMask) return state.formMask;

    const aspect = settings.width / settings.height;
    const maskBase = 720;
    const maskW = aspect >= 1 ? maskBase : Math.max(240, Math.round(maskBase * aspect));
    const maskH = aspect >= 1 ? Math.max(240, Math.round(maskBase / aspect)) : maskBase;
    const canvas = document.createElement('canvas');
    canvas.width = maskW;
    canvas.height = maskH;
    const off = canvas.getContext('2d', { willReadFrequently: true });
    off.clearRect(0, 0, maskW, maskH);
    drawFormImageToMask(off, state.formImage, maskW, maskH);
    const imageData = off.getImageData(0, 0, maskW, maskH);
    const inside = new Uint8Array(maskW * maskH);
    for (let i = 0, p = 0; i < imageData.data.length; i += 4, p++) {
        inside[p] = imageData.data[i + 3] > 12 ? 1 : 0;
    }

    const boundary = [];
    const sampleEvery = 1;
    for (let y = 1; y < maskH - 1; y += sampleEvery) {
        for (let x = 1; x < maskW - 1; x += sampleEvery) {
            const idx = y * maskW + x;
            if (!inside[idx]) continue;
            const hasOutsideNeighbor =
                !inside[idx - 1] || !inside[idx + 1] ||
                !inside[idx - maskW] || !inside[idx + maskW] ||
                !inside[idx - maskW - 1] || !inside[idx - maskW + 1] ||
                !inside[idx + maskW - 1] || !inside[idx + maskW + 1];
            if (hasOutsideNeighbor) {
                boundary.push({
                    x: x / (maskW - 1) * settings.width,
                    y: y / (maskH - 1) * settings.height
                });
            }
        }
    }

    state.formMask = { width: maskW, height: maskH, inside };
    state.formBoundary = boundary;
    state.formMaskKey = key;
    state.formSampleCache = { key: '', samples: null };
    return state.formMask;
}

function insideFormMask(mask, x, y, settings) {
    if (!mask) return false;
    const mx = clamp(Math.floor(x / settings.width * mask.width), 0, mask.width - 1);
    const my = clamp(Math.floor(y / settings.height * mask.height), 0, mask.height - 1);
    return !!mask.inside[my * mask.width + mx];
}

function nearestBoundaryPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const point of state.formBoundary) {
        const d = (point.x - x) ** 2 + (point.y - y) ** 2;
        if (d < bestD) {
            bestD = d;
            best = point;
        }
    }
    return best ? { ...best, distance: Math.sqrt(bestD) } : null;
}

function getFormSamples(settings, grid, mask) {
    const key = [
        state.formMaskKey,
        settings.width,
        settings.height,
        grid.cols,
        grid.rows,
        grid.pitchW.toFixed(4),
        grid.pitchH.toFixed(4)
    ].join('|');
    if (state.formSampleCache.key === key && state.formSampleCache.samples) {
        return state.formSampleCache.samples;
    }

    const samples = grid.points.map((point) => {
        const nearest = nearestBoundaryPoint(point.x, point.y);
        if (!nearest) return null;
        return {
            inside: insideFormMask(mask, point.x, point.y, settings),
            nearX: nearest.x,
            nearY: nearest.y,
            distance: nearest.distance
        };
    });
    state.formSampleCache = { key, samples };
    return samples;
}

function formEdgeSpread(settings, width, height) {
    return Math.max(1, Math.min(width, height) * clamp(Number(settings.formEdgeSpread ?? 34) / 100, 0.02, 1));
}

function toneFromFormDistance(distanceToEdge, edgeSpread, settings) {
    const edgeTone = 1 - clamp(distanceToEdge / Math.max(1, edgeSpread));
    return settings.invertDither ? 1 - edgeTone : edgeTone;
}

function renderForms(ctx) {
    const { settings, width, height } = ctx;
    const mask = ensureFormMask(settings);
    if (!mask || !state.formBoundary.length) return;

    const chars = cleanPatternText(settings.patternText, settings.allCaps);
    const grid = makeResolutionGrid(width, height, settings.resolution, settings.density);
    const samples = getFormSamples(settings, grid, mask);
    const base = baseSizeFromGrid(grid, 0.74);
    const minWeight = Math.min(settings.weightMin, settings.weightMax);
    const maxWeight = Math.max(settings.weightMin, settings.weightMax);
    const noiseRange = relativeNoiseRange(settings);
    const hideTiny = settings.hideTinyLetters !== false;
    const edgeSpread = formEdgeSpread(settings, width, height);
    const lineGravity = clamp(Number(settings.formAttraction ?? 45) / 100);
    const globalGravity = clamp(Number(settings.formGravity ?? 12) / 100);
    const gravityAngle = Number(settings.formGravityDirection ?? 90) * Math.PI / 180;
    const gravityShift = Math.min(width, height) * 0.18 * globalGravity;
    const gravityX = Math.cos(gravityAngle) * gravityShift;
    const gravityY = Math.sin(gravityAngle) * gravityShift;

    grid.points.forEach((point, index) => {
        const sample = samples[index];
        if (!sample || !sample.inside) return;

        const edgeTone = 1 - clamp(sample.distance / edgeSpread);
        const tone = toneFromFormDistance(sample.distance, edgeSpread, settings);
        if (hideTiny && tone <= DITHER_EMPTY_TONE) return;

        const type = typographyFromTone(settings, base, minWeight, maxWeight, tone);
        const noise = settings.noiseEnabled !== false
            ? lerp(noiseRange.min, noiseRange.max, tone)
            : 0;
        const noiseOffset = Math.min(point.cellW, point.cellH) * noise;
        let x = point.x;
        let y = point.y;

        if (lineGravity > 0 && sample.distance > 0.001) {
            const lineFalloff = lerp(0.22, 1, Math.pow(edgeTone, 0.7));
            const maxLineShift = edgeSpread * 0.76 * lineGravity * lineFalloff;
            const lineShift = Math.min(sample.distance, maxLineShift);
            x += (sample.nearX - point.x) / sample.distance * lineShift;
            y += (sample.nearY - point.y) / sample.distance * lineShift;
        }

        x += gravityX + signedNoise(index, 5) * noiseOffset;
        y += gravityY + signedNoise(index, 6) * noiseOffset;
        if (x < 0 || x > width || y < 0 || y > height) return;

        drawLetter(ctx, {
            char: chars[index % chars.length],
            x,
            y,
            size: type.size,
            weight: type.weight,
            rotation: type.rotation,
            fill: settings.inkColor
        });
    });
}

function drawFormGuides(ctx, mask, gravityX, gravityY) {
    if (!mask) return;
    const { svg, create, settings } = ctx;
    state.formBoundary.forEach((point, index) => {
        if (index % 4 !== 0) return;
        svg.appendChild(create('circle', {
            class: 'form-boundary-dot',
            'data-interactive': 'true',
            cx: point.x,
            cy: point.y,
            r: 1.15,
            fill: '#49a8ff',
            opacity: 0.45
        }));
    });
    svg.appendChild(create('circle', {
        class: 'gravity-ui',
        'data-interactive': 'true',
        cx: gravityX,
        cy: gravityY,
        r: 6,
        fill: 'none',
        stroke: settings.inkColor,
        'stroke-width': 1.5,
        opacity: 0.65
    }));
}

function loadFormFromSvgText(svgText, label, app) {
    const normalizedSvg = normalizeFormSvg(svgText);
    if (!normalizedSvg) {
        app.dialog?.alert({
            title: 'SVG form',
            text: 'Could not read this SVG. Try a file with a filled vector shape.'
        });
        return;
    }
    const blob = new Blob([normalizedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
        state.formImage = image;
        state.formImageKey = `${label}:${Date.now()}`;
        state.formLabel = label;
        state.formMaskKey = '';
        state.formSampleCache = { key: '', samples: null };
        URL.revokeObjectURL(url);
        syncStatusLabels();
        app.renderNow();
    };
    image.onerror = () => {
        URL.revokeObjectURL(url);
        app.dialog?.alert({
            title: 'SVG form',
            text: 'Could not load this SVG. Try a file with a filled shape on a transparent background.'
        });
    };
    image.src = url;
}

function loadFormFromUrl(url, label, app) {
    fetch(url)
        .then((response) => {
            if (!response.ok) throw new Error(`Could not load ${url}`);
            return response.text();
        })
        .then((svgText) => loadFormFromSvgText(svgText, label, app))
        .catch((error) => {
            console.error(error);
            app.dialog?.alert({
                title: 'SVG form',
                text: 'Could not load the default SVG form.'
            });
        });
}

function loadFormFile(file, app) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadFormFromSvgText(String(reader.result), file.name, app);
    reader.readAsText(file);
}

function getPointerInSvg(event, app) {
    const svg = app.target.element;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
}

function commitCustomChange(app, label) {
    app.presets?.markDirty();
    app.history?.beginTransaction(label);
    app.history?.endTransaction();
    app.renderNow();
    app.presets?.markDirty();
}

function addMagneticPoint(app, point) {
    app.history?.beginTransaction('add magnetic point');
    state.magneticPoints.push({
        x: clamp(point.x, 0, app.settings.width),
        y: clamp(point.y, 0, app.settings.height),
        force: app.settings.fieldForce,
        radius: app.settings.fieldRadius
    });
    app.history?.endTransaction();
    app.presets?.markDirty();
    app.renderNow();
}

function setGravityPoint(app, point) {
    app.history?.beginTransaction('set gravity');
    app.settingsStore.set('gravityX', clamp(point.x / app.settings.width * 100, 0, 100));
    app.settingsStore.set('gravityY', clamp(point.y / app.settings.height * 100, 0, 100));
    app.history?.endTransaction();
    app.presets?.markDirty();
    app.renderNow();
}

function syncStatusLabels() {
    const imageStatus = document.getElementById('imageStatus');
    if (imageStatus) imageStatus.textContent = state.imageLabel;
    const formStatus = document.getElementById('formStatus');
    if (formStatus) formStatus.textContent = state.formLabel;
}

function syncPixelParameterControls(settings) {
    const groups = {
        sizeEnabled: ['sizeMin', 'sizeMax'],
        weightEnabled: ['weightMin', 'weightMax'],
        rotationEnabled: ['rotationMin', 'rotationMax'],
        noiseEnabled: ['noiseMin', 'noiseMax']
    };
    Object.entries(groups).forEach(([setting, prefixes]) => {
        const disabled = settings[setting] === false;
        prefixes.forEach((prefix) => {
            const slider = document.getElementById(`${prefix}Slider`);
            const value = document.getElementById(`${prefix}Value`);
            [slider, value].forEach((el) => {
                if (el) el.disabled = disabled;
            });
            slider?.closest('.control-group')?.classList.toggle('disabled', disabled);
        });
    });
}

function updatePillToggleRows() {
    document.querySelectorAll('.pill-toggle-row').forEach((row) => {
        const toggles = Array.from(row.children)
            .filter((child) => child.classList?.contains('pill-toggle'))
            .filter((child) => getComputedStyle(child).display !== 'none');
        toggles.forEach((toggle) => toggle.classList.remove('pill-toggle--single-last-row'));
        const last = toggles[toggles.length - 1];
        if (!last) return;
        const lastTop = last.offsetTop;
        const lastRow = toggles.filter((toggle) => Math.abs(toggle.offsetTop - lastTop) < 2);
        if (lastRow.length === 1) last.classList.add('pill-toggle--single-last-row');
    });
}

function schedulePillToggleRowsUpdate() {
    requestAnimationFrame(updatePillToggleRows);
}

function initPillToggleRows() {
    pillToggleResizeObserver?.disconnect();
    pillToggleResizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(schedulePillToggleRowsUpdate)
        : null;
    document.querySelectorAll('.pill-toggle-row').forEach((row) => {
        pillToggleResizeObserver?.observe(row);
    });
    window.addEventListener('resize', schedulePillToggleRowsUpdate);
    schedulePillToggleRowsUpdate();
}

function syncCustomControls(app) {
    const settings = app.settingsStore.toObject();
    const mode = normalizeMode(settings.mode);
    if (settings.mode !== mode) {
        app.settingsStore.set('mode', mode);
        return;
    }
    document.querySelector('.container')?.setAttribute('data-mode', mode);
    const textInput = document.getElementById('patternTextInput');
    if (textInput && textInput.value !== settings.patternText) textInput.value = settings.patternText;
    const widthInput = document.getElementById('widthValue');
    if (widthInput && widthInput.value !== String(settings.width)) widthInput.value = String(settings.width);
    const heightInput = document.getElementById('heightValue');
    if (heightInput && heightInput.value !== String(settings.height)) heightInput.value = String(settings.height);
    document.querySelectorAll('input[name="mode"]').forEach((input) => {
        input.checked = input.value === mode;
    });
    document.querySelectorAll('input[name="ditherAlgorithm"]').forEach((input) => {
        input.checked = input.value === settings.ditherAlgorithm;
    });
    document.querySelectorAll('input[name="fieldResponse"]').forEach((input) => {
        input.checked = input.value === settings.fieldResponse;
    });
    document.querySelectorAll('input[name="formFill"]').forEach((input) => {
        input.checked = input.value === settings.formFill;
    });
    syncPixelParameterControls(settings);
    syncStatusLabels();
    schedulePillToggleRowsUpdate();
}

function bindCustomControls(app) {
    const setSetting = (key, value) => app.settingsStore.set(key, value);
    const bindNumericInput = (id, setting, min, max) => {
        const input = document.getElementById(id);
        if (!input) return;
        const sync = (value) => {
            const rounded = Math.round(Number(value));
            input.value = String(Number.isFinite(rounded) ? rounded : app.settingsStore.get(setting));
        };
        const commit = () => {
            const parsed = Number.parseFloat(String(input.value).replace(',', '.'));
            const fallback = Number(app.settingsStore.get(setting));
            const next = clamp(Number.isFinite(parsed) ? Math.round(parsed) : fallback, min, max);
            input.value = String(next);
            setSetting(setting, next);
        };
        input.addEventListener('change', commit);
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                input.blur();
            }
        });
        app.settingsStore.subscribe(setting, sync);
        sync(app.settingsStore.get(setting));
    };

    document.getElementById('patternTextInput')?.addEventListener('input', (event) => {
        setSetting('patternText', event.target.value);
    });
    bindNumericInput('widthValue', 'width', 200, 2000);
    bindNumericInput('heightValue', 'height', 200, 2000);
    document.querySelectorAll('input[name="mode"]').forEach((input) => {
        input.addEventListener('change', () => {
            if (input.checked) {
                setSetting('mode', normalizeMode(input.value));
                syncCustomControls(app);
            }
        });
    });
    document.querySelectorAll('input[name="ditherAlgorithm"]').forEach((input) => {
        input.addEventListener('change', () => {
            if (input.checked) setSetting('ditherAlgorithm', input.value);
        });
    });
    document.querySelectorAll('input[name="fieldResponse"]').forEach((input) => {
        input.addEventListener('change', () => {
            if (input.checked) setSetting('fieldResponse', input.value);
        });
    });
    document.querySelectorAll('input[name="formFill"]').forEach((input) => {
        input.addEventListener('change', () => {
            if (input.checked) setSetting('formFill', input.value);
        });
    });
    ['sizeEnabled', 'weightEnabled', 'rotationEnabled', 'noiseEnabled'].forEach((key) => {
        app.settingsStore.subscribe(key, () => syncPixelParameterControls(app.settingsStore.toObject()));
    });

    const imageInput = document.getElementById('imageInput');
    document.getElementById('imageLoadBtn')?.addEventListener('click', () => imageInput?.click());
    imageInput?.addEventListener('change', (event) => {
        loadImageFile(event.target.files?.[0], app);
        event.target.value = '';
    });

    const formInput = document.getElementById('formInput');
    document.getElementById('formLoadBtn')?.addEventListener('click', () => formInput?.click());
    formInput?.addEventListener('change', (event) => {
        loadFormFile(event.target.files?.[0], app);
        event.target.value = '';
    });

    document.getElementById('clearFieldsBtn')?.addEventListener('click', () => {
        app.history?.beginTransaction('clear magnetic points');
        state.magneticPoints = [];
        app.history?.endTransaction();
        app.presets?.markDirty();
        app.renderNow();
    });

    document.getElementById('exportPngBtn')?.addEventListener('click', () => {
        window.wordplayerLastAction = 'png-export-click';
        void exportPng(app);
    });
    document.getElementById('exportSvgBtn')?.addEventListener('click', () => {
        window.wordplayerLastAction = 'svg-export-click';
        const curves = document.getElementById('convertToOutlinesCheckbox')?.checked;
        if (curves) void exportCurvedSvg(app);
        else void app.exportSVG('wordplayer.svg');
    });
    document.getElementById('introHelpBtn')?.addEventListener('click', () => {
        app.dialog?.alert({
            title: 'Wordplayer',
            text: 'Dither maps an image through text. Forms fills an SVG shape with text driven by distance to the vector edge.'
        });
    });

    const svg = app.target.element;
    svg.addEventListener('pointermove', (event) => {
        if (app.settings.mode !== 'fields') return;
        state.hoverPoint = getPointerInSvg(event, app);
        app.render();
    });
    svg.addEventListener('pointerleave', () => {
        if (!state.hoverPoint) return;
        state.hoverPoint = null;
        app.render();
    });
    svg.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const point = getPointerInSvg(event, app);
        if (!point) return;
        if (app.settings.mode === 'fields') {
            addMagneticPoint(app, point);
        }
    });

    app.settingsStore.subscribe('mode', () => syncCustomControls(app));
    app.settingsStore.subscribe('*', (_next, _prev, key) => {
        if (key === 'width' || key === 'height') {
            state.formMaskKey = '';
            state.formSampleCache = { key: '', samples: null };
        }
    });
}

function appSnapshot(app) {
    return {
        settings: app.settingsStore.toObject(),
        magneticPoints: state.magneticPoints.map((point) => ({ ...point }))
    };
}

function appRestore(app, snapshot) {
    const settings = snapshot?.settings || snapshot || {};
    settings.mode = normalizeMode(settings.mode);
    app.settingsStore.fromJSON(settings, true);
    state.magneticPoints = Array.isArray(snapshot?.magneticPoints)
        ? snapshot.magneticPoints.map((point) => ({ ...point }))
        : [];
    state.hoverPoint = null;
    state.ditherCache.key = '';
    state.formMaskKey = '';
}

function presetBlob(app) {
    return appSnapshot(app);
}

function applyPresetBlob(app, blob) {
    appRestore(app, blob);
}

function colorDots(blob) {
    const settings = blob?.settings || blob || {};
    return [
        { kind: 'solid', value: settings.inkColor || '#ffffff' },
        { kind: 'solid', value: settings.bgColor || '#0d0d0d' }
    ];
}

async function loadOpentype() {
    if (window.opentype) return window.opentype;
    window.opentype = opentypeModule;
    return window.opentype;
}

async function loadStaticPatternFont(weight) {
    const roundedWeight = roundWeight(weight);
    if (state.staticFonts.has(roundedWeight)) return state.staticFonts.get(roundedWeight);
    if (state.staticFontPromises.has(roundedWeight)) return state.staticFontPromises.get(roundedWeight);
    const fontUrl = STATIC_PATTERN_FONT_URLS.get(roundedWeight) || STATIC_PATTERN_FONT_URLS.get(400);
    const promise = loadOpentype().then((opentype) => new Promise((resolve, reject) => {
        opentype.load(fontUrl, (error, font) => {
            if (error) reject(error);
            else {
                state.staticFonts.set(roundedWeight, font);
                resolve(font);
            }
        });
    }));
    state.staticFontPromises.set(roundedWeight, promise);
    return promise;
}

function replaceTextWithPath(textElement, font) {
    const text = textElement.textContent || '';
    if (!text) return null;
    const fontSize = parseFloat(textElement.getAttribute('font-size') || '16');
    const fill = textElement.getAttribute('fill') || '#000';
    const opacity = textElement.getAttribute('opacity');
    const transform = textElement.getAttribute('transform');
    const glyph = font.charToGlyph(text);
    const scale = fontSize / font.unitsPerEm;
    const advance = (glyph.advanceWidth || font.unitsPerEm * 0.5) * scale;
    const baseline = (font.ascender + font.descender) * scale / 2;
    const path = glyph.getPath(-advance / 2, baseline, fontSize);
    const pathElement = createSvgElement('path', {
        d: path.toPathData(2),
        fill,
        transform,
        opacity
    });
    return pathElement;
}

async function exportCurvedSvg(app) {
    try {
        window.wordplayerLastAction = 'curves-export-start';
        const live = app.target.element;
        const clone = live.cloneNode(true);
        clone.setAttribute('xmlns', SVG_NS);
        clone.setAttribute('width', app.settings.width);
        clone.setAttribute('height', app.settings.height);
        clone.setAttribute('viewBox', `0 0 ${app.settings.width} ${app.settings.height}`);
        clone.querySelectorAll('[data-interactive="true"]').forEach((node) => node.remove());
        const textElements = Array.from(clone.querySelectorAll('text.pattern-letter'));
        const usedWeights = Array.from(new Set(textElements.map((textElement) => {
            const weight = parseFloat(textElement.getAttribute('data-weight') || textElement.getAttribute('font-weight') || '400');
            return roundWeight(weight);
        })));
        await Promise.all(usedWeights.map((weight) => loadStaticPatternFont(weight)));
        textElements.forEach((textElement) => {
            const weight = parseFloat(textElement.getAttribute('data-weight') || textElement.getAttribute('font-weight') || '400');
            const font = state.staticFonts.get(roundWeight(weight)) || state.staticFonts.get(400);
            const path = replaceTextWithPath(textElement, font);
            if (path) textElement.replaceWith(path);
        });
        const serialized = new XMLSerializer().serializeToString(clone);
        downloadText(serialized, 'wordplayer-curves.svg', 'image/svg+xml;charset=utf-8');
        window.wordplayerLastAction = 'curves-export-complete';
    } catch (error) {
        window.wordplayerLastAction = 'curves-export-failed';
        app.dialog?.alert({
            title: 'Curves export',
            text: 'Could not prepare curved SVG in this browser session. PNG export is still available.'
        });
        console.error(error);
    }
}

async function exportPng(app, scale = 3) {
    try {
        const clone = app.target.element.cloneNode(true);
        clone.setAttribute('xmlns', SVG_NS);
        clone.setAttribute('width', app.settings.width);
        clone.setAttribute('height', app.settings.height);
        clone.setAttribute('viewBox', `0 0 ${app.settings.width} ${app.settings.height}`);
        clone.style.width = '';
        clone.style.height = '';
        clone.removeAttribute('style');
        clone.querySelectorAll('[data-interactive="true"]').forEach((node) => node.remove());
        if (app.settings.exportTransparent) {
            clone.querySelectorAll('[data-export-background="true"]').forEach((node) => node.remove());
        }
        const serialized = new XMLSerializer().serializeToString(clone);
        await app._rasterizeSVG(serialized, app.settings.width * scale, app.settings.height * scale, 'wordplayer.png');
    } catch (error) {
        app.dialog?.alert({
            title: 'PNG export',
            text: 'Could not export PNG in this browser session.'
        });
        console.error(error);
    }
}

function downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

const app = defineTool({
    renderer: 'svg',
    autoStart: true,
    dom: {
        canvas: 'canvasContainer',
        surface: 'mainSvg',
        zoomIndicator: 'zoomIndicator'
    },
    settings: {
        width: 430,
        height: 574,
        mode: 'dither',
        patternText: DEFAULT_PATTERN_TEXT,
        weightMin: 100,
        weightMax: 500,
        sizeMin: 36,
        sizeMax: 96,
        rotationMin: 0,
        rotationMax: 0,
        noiseMin: 0,
        noiseMax: 0,
        resolution: 72,
        density: 0,
        inkColor: '#ffffff',
        bgColor: '#0d0d0d',
        allCaps: true,
        sizeEnabled: true,
        weightEnabled: true,
        rotationEnabled: true,
        noiseEnabled: true,
        hideTinyLetters: true,
        invertDither: false,
        showGuides: false,
        exportTransparent: true,
        ditherAlgorithm: 'floyd',
        contrast: 2,
        blackPoint: 40,
        whitePoint: 200,
        fieldResponse: 'rotate',
        fieldForce: 58,
        fieldRadius: 150,
        formFill: 'inside',
        formEdgeSpread: 34,
        formAttraction: 45,
        formGravity: 12,
        formGravityDirection: 90,
        formPrecision: 100,
        gravityX: 50,
        gravityY: 50
    },
    controls: {
        sliders: [
            { id: 'weightMinSlider', valueId: 'weightMinValue', setting: 'weightMin', min: 100, max: 900, decimals: 0, baseStep: 10, shiftStep: 100 },
            { id: 'weightMaxSlider', valueId: 'weightMaxValue', setting: 'weightMax', min: 100, max: 900, decimals: 0, baseStep: 10, shiftStep: 100 },
            { id: 'sizeMinSlider', valueId: 'sizeMinValue', setting: 'sizeMin', min: 5, max: 200, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'sizeMaxSlider', valueId: 'sizeMaxValue', setting: 'sizeMax', min: 5, max: 200, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'rotationMinSlider', valueId: 'rotationMinValue', setting: 'rotationMin', min: -180, max: 180, decimals: 0, baseStep: 1, shiftStep: 15 },
            { id: 'rotationMaxSlider', valueId: 'rotationMaxValue', setting: 'rotationMax', min: -180, max: 180, decimals: 0, baseStep: 1, shiftStep: 15 },
            { id: 'noiseMinSlider', valueId: 'noiseMinValue', setting: 'noiseMin', min: 0, max: 200, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'noiseMaxSlider', valueId: 'noiseMaxValue', setting: 'noiseMax', min: 0, max: 200, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'resolutionSlider', valueId: 'resolutionValue', setting: 'resolution', min: 8, max: 180, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'densitySlider', valueId: 'densityValue', setting: 'density', min: -100, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'contrastSlider', valueId: 'contrastValue', setting: 'contrast', min: 0.2, max: 3, decimals: 2, baseStep: 0.01, shiftStep: 0.1 },
            { id: 'blackPointSlider', valueId: 'blackPointValue', setting: 'blackPoint', min: 0, max: 250, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'whitePointSlider', valueId: 'whitePointValue', setting: 'whitePoint', min: 5, max: 255, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'fieldForceSlider', valueId: 'fieldForceValue', setting: 'fieldForce', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'fieldRadiusSlider', valueId: 'fieldRadiusValue', setting: 'fieldRadius', min: 20, max: 700, decimals: 0, baseStep: 1, shiftStep: 25 },
            { id: 'formEdgeSpreadSlider', valueId: 'formEdgeSpreadValue', setting: 'formEdgeSpread', min: 2, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'formAttractionSlider', valueId: 'formAttractionValue', setting: 'formAttraction', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'formGravitySlider', valueId: 'formGravityValue', setting: 'formGravity', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'formGravityDirectionSlider', valueId: 'formGravityDirectionValue', setting: 'formGravityDirection', min: -180, max: 180, decimals: 0, baseStep: 1, shiftStep: 15 }
        ],
        toggles: true
    },
    panels: [
        { id: 'textPanel', headerId: 'textPanelHeader', persistent: true },
        { id: 'pixelsPanel', headerId: 'pixelsPanelHeader', persistent: true },
        { id: 'ditherPanel', headerId: 'ditherPanelHeader', persistent: true },
        { id: 'fieldsPanel', headerId: 'fieldsPanelHeader', persistent: true },
        { id: 'formsPanel', headerId: 'formsPanelHeader', persistent: true }
    ],
    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'ink', setting: 'inkColor', label: 'Ink', itemId: 'inkColorItem', dotId: 'inkColorPreview', hexId: 'inkColorHex', hsbSlotId: 'inkColorHsbSlot' },
            { type: 'bg', setting: 'bgColor', label: 'Background', itemId: 'bgColorItem', dotId: 'bgColorPreview', hexId: 'bgColorHex', hsbSlotId: 'bgColorHsbSlot' }
        ]
    },
    presets: {
        storageKey: 'wordplayerPresetsV13',
        basePath: 'presets',
        colorDots,
        hasRandom: () => false
    },
    share: {
        quantizableFloatKeys: ['contrast']
    },
    export: {
        filename: 'wordplayer.svg'
    },
    zoom: {
        fitPadding: { top: 92, right: 360, bottom: 86, left: 360 }
    },
    history: {
        debounceMs: 120
    },
    snapshot: appSnapshot,
    restore: appRestore,
    collectPreset: presetBlob,
    applyPreset: applyPresetBlob,
    syncControls: syncCustomControls,
    onChromeRefresh: syncCustomControls,
    render(ctx) {
        addSvgDefs(ctx.svg, ctx.create);
        drawBackground(ctx);
        if (ctx.settings.mode === 'forms') renderForms(ctx);
        else renderDither(ctx);
    },
    onReady(appInstance) {
        bindCustomControls(appInstance);
        initPillToggleRows();
        syncCustomControls(appInstance);
        window.wordplayer = {
            app: appInstance,
            state,
            exportCurves: () => exportCurvedSvg(appInstance),
            exportPNG: () => exportPng(appInstance)
        };
        loadImageFromUrl(DEFAULT_IMAGE_URL, 'sample.png', appInstance);
        loadFormFromUrl(DEFAULT_FORM_URL, 'sample.svg', appInstance);
    }
});

export default app;
