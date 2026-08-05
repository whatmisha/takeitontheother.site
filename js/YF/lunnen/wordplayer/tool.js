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
const DEFAULT_FORM_URL = './assets/default-form.svg?v=2';
const DEFAULT_PATTERN_TEXT = `Чтение может стать золотым часом дня — временем, когда всё погружается в цельную особенную атсмосферу и можно вернуться к себе и пережить что-то новое, погрузившись в книгу. В дизайне мы тоже подсвечиваем этот путь — иммерсивность погружения в книгу от лица читателя. Мы показываем именно этот момент перехода — резкость и холод внешнего мира растворяются в тёплом камерном пространстве чтения`;
const DITHER_EMPTY_TONE = 0.05;
const FORM_SETTLE_STEPS = 72;
const FORM_SETTLE_MIN = 12;
const FORM_SETTLE_MAX = 180;
const FORM_MASK_BASE = 540;
const AVAILABLE_MODES = new Set(['dither', 'forms']);
let pillToggleResizeObserver = null;
let glyphMeasureContext = null;

const state = {
    sourceImage: null,
    sourceImageKey: 'gradient',
    imageLabel: 'sample.png',
    ditherCache: { key: '', tones: null },
    formImage: null,
    formImageKey: '',
    formLabel: 'sample.svg',
    formMask: null,
    formMaskKey: '',
    formPhysicsCache: { key: '', letters: null },
    staticFonts: new Map(),
    staticFontPromises: new Map(),
    opentypePromise: null,
    fontPromise: null
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

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
        baseline = 'central',
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
        'dominant-baseline': baseline,
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
    const maskW = aspect >= 1 ? FORM_MASK_BASE : Math.max(220, Math.round(FORM_MASK_BASE * aspect));
    const maskH = aspect >= 1 ? Math.max(220, Math.round(FORM_MASK_BASE / aspect)) : FORM_MASK_BASE;
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

    const nearest = buildNearestBoundaryMap(inside, maskW, maskH);
    state.formMask = nearest ? {
        width: maskW,
        height: maskH,
        inside,
        nearestX: nearest.x,
        nearestY: nearest.y
    } : null;
    state.formMaskKey = key;
    state.formPhysicsCache = { key: '', letters: null };
    return state.formMask;
}

function buildNearestBoundaryMap(inside, width, height) {
    const length = width * height;
    let sourceX = new Int16Array(length);
    let sourceY = new Int16Array(length);
    let targetX = new Int16Array(length);
    let targetY = new Int16Array(length);
    sourceX.fill(-1);
    sourceY.fill(-1);
    let boundaryCount = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const value = inside[index];
            let isBoundary = false;
            for (let offsetY = -1; offsetY <= 1 && !isBoundary; offsetY++) {
                for (let offsetX = -1; offsetX <= 1; offsetX++) {
                    if (offsetX === 0 && offsetY === 0) continue;
                    const nextX = x + offsetX;
                    const nextY = y + offsetY;
                    if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
                        if (value) isBoundary = true;
                        continue;
                    }
                    if (inside[nextY * width + nextX] !== value) {
                        isBoundary = true;
                        break;
                    }
                }
            }
            if (isBoundary) {
                sourceX[index] = x;
                sourceY[index] = y;
                boundaryCount++;
            }
        }
    }
    if (!boundaryCount) return null;

    let jump = 1;
    while (jump < Math.max(width, height)) jump *= 2;
    for (jump /= 2; jump >= 1; jump /= 2) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                let bestX = sourceX[index];
                let bestY = sourceY[index];
                let bestDistance = bestX >= 0
                    ? (bestX - x) ** 2 + (bestY - y) ** 2
                    : Infinity;

                for (let offsetY = -jump; offsetY <= jump; offsetY += jump) {
                    for (let offsetX = -jump; offsetX <= jump; offsetX += jump) {
                        const nextX = x + offsetX;
                        const nextY = y + offsetY;
                        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
                        const nextIndex = nextY * width + nextX;
                        const candidateX = sourceX[nextIndex];
                        const candidateY = sourceY[nextIndex];
                        if (candidateX < 0) continue;
                        const candidateDistance = (candidateX - x) ** 2 + (candidateY - y) ** 2;
                        if (candidateDistance < bestDistance) {
                            bestDistance = candidateDistance;
                            bestX = candidateX;
                            bestY = candidateY;
                        }
                    }
                }
                targetX[index] = bestX;
                targetY[index] = bestY;
            }
        }
        [sourceX, targetX] = [targetX, sourceX];
        [sourceY, targetY] = [targetY, sourceY];
    }

    return { x: sourceX, y: sourceY };
}

function insideFormMask(mask, x, y, settings) {
    if (!mask) return false;
    const mx = clamp(Math.round(x / settings.width * (mask.width - 1)), 0, mask.width - 1);
    const my = clamp(Math.round(y / settings.height * (mask.height - 1)), 0, mask.height - 1);
    return !!mask.inside[my * mask.width + mx];
}

function signedMaskDistance(mask, x, y, settings) {
    const px = clamp(x, 0, mask.width - 1);
    const py = clamp(y, 0, mask.height - 1);
    const index = py * mask.width + px;
    const nearestX = mask.nearestX[index];
    const nearestY = mask.nearestY[index];
    if (nearestX < 0) return 0;
    const scaleX = settings.width / Math.max(1, mask.width - 1);
    const scaleY = settings.height / Math.max(1, mask.height - 1);
    const distance = Math.hypot((nearestX - px) * scaleX, (nearestY - py) * scaleY);
    return mask.inside[index] ? distance : -distance;
}

function sampleFormField(mask, x, y, settings) {
    if (!mask) return null;
    const px = clamp(Math.round(x / settings.width * (mask.width - 1)), 0, mask.width - 1);
    const py = clamp(Math.round(y / settings.height * (mask.height - 1)), 0, mask.height - 1);
    const index = py * mask.width + px;
    const nearestPixelX = mask.nearestX[index];
    const nearestPixelY = mask.nearestY[index];
    if (nearestPixelX < 0) return null;

    const nearX = nearestPixelX / Math.max(1, mask.width - 1) * settings.width;
    const nearY = nearestPixelY / Math.max(1, mask.height - 1) * settings.height;
    const dx = nearX - x;
    const dy = nearY - y;
    const distance = Math.hypot(dx, dy);
    let normalX = 0;
    let normalY = 1;
    if (distance > 0.0001) {
        normalX = dx / distance;
        normalY = dy / distance;
    } else {
        const left = signedMaskDistance(mask, Math.max(0, px - 1), py, settings);
        const right = signedMaskDistance(mask, Math.min(mask.width - 1, px + 1), py, settings);
        const top = signedMaskDistance(mask, px, Math.max(0, py - 1), settings);
        const bottom = signedMaskDistance(mask, px, Math.min(mask.height - 1, py + 1), settings);
        const gradientX = right - left;
        const gradientY = bottom - top;
        const gradientLength = Math.hypot(gradientX, gradientY);
        if (gradientLength > 0.0001) {
            const direction = mask.inside[index] ? -1 : 1;
            normalX = gradientX / gradientLength * direction;
            normalY = gradientY / gradientLength * direction;
        }
    }

    return {
        kind: 'form',
        x: nearX,
        y: nearY,
        distance,
        normalX,
        normalY,
        inside: !!mask.inside[index]
    };
}

function sampleCanvasField(x, y, width, height) {
    const candidates = [
        { kind: 'canvas', x: 0, y: clamp(y, 0, height), distance: Math.abs(x), normalX: -1, normalY: 0 },
        { kind: 'canvas', x: width, y: clamp(y, 0, height), distance: Math.abs(width - x), normalX: 1, normalY: 0 },
        { kind: 'canvas', x: clamp(x, 0, width), y: 0, distance: Math.abs(y), normalX: 0, normalY: -1 },
        { kind: 'canvas', x: clamp(x, 0, width), y: height, distance: Math.abs(height - y), normalX: 0, normalY: 1 }
    ];
    return candidates.reduce((best, candidate) => candidate.distance < best.distance ? candidate : best);
}

function nearestLineAttractor(mask, x, y, settings, preferredKind = null) {
    const form = sampleFormField(mask, x, y, settings);
    const canvas = settings.formCanvasEdges !== false
        ? sampleCanvasField(x, y, settings.width, settings.height)
        : null;
    if (preferredKind === 'form') return form;
    if (preferredKind === 'canvas') return canvas;
    if (!form) return canvas;
    if (!canvas) return form;
    return form.distance <= canvas.distance ? form : canvas;
}

function formEdgeSpread(settings, width, height) {
    return Math.max(1, Math.min(width, height) * clamp(Number(settings.formEdgeSpread ?? 15) / 100, 0.02, 1));
}

function toneFromFormDistance(distanceToEdge, edgeSpread, settings) {
    const edgeTone = 1 - clamp(distanceToEdge / Math.max(1, edgeSpread));
    return settings.invertDither ? 1 - edgeTone : edgeTone;
}

function gravityDirectionVector(degrees) {
    const angle = Number(degrees ?? 0) * Math.PI / 180;
    return {
        x: Math.sin(angle),
        y: Math.cos(angle)
    };
}

function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let result = value;
        result = Math.imul(result ^ result >>> 15, result | 1);
        result ^= result + Math.imul(result ^ result >>> 7, result | 61);
        return ((result ^ result >>> 14) >>> 0) / 4294967296;
    };
}

function formPhysicsKey(settings) {
    return [
        state.formMaskKey,
        settings.width,
        settings.height,
        settings.patternText,
        settings.allCaps,
        settings.resolution,
        settings.density,
        settings.weightMin,
        settings.weightMax,
        settings.sizeMin,
        settings.sizeMax,
        settings.rotationMin,
        settings.rotationMax,
        settings.noiseMin,
        settings.noiseMax,
        settings.sizeEnabled,
        settings.weightEnabled,
        settings.rotationEnabled,
        settings.noiseEnabled,
        settings.hideTinyLetters,
        settings.invertDither,
        settings.formEdgeSpread,
        settings.formAttraction,
        settings.formStickiness,
        settings.formFriction,
        settings.formSettlingTime,
        settings.formGravity,
        settings.formGravityDirection,
        settings.formCanvasEdges
    ].join('|');
}

function glyphCollisionMetrics(char, size, weight) {
    if (!glyphMeasureContext) {
        glyphMeasureContext = document.createElement('canvas').getContext('2d');
        glyphMeasureContext.textAlign = 'center';
        glyphMeasureContext.textBaseline = 'alphabetic';
    }
    glyphMeasureContext.font = `${roundWeight(weight)} ${Math.max(1, size)}px "YSTextPattern"`;
    const metrics = glyphMeasureContext.measureText(char);
    const width = Math.max(size * 0.16,
        (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0) || metrics.width);
    const ascent = metrics.actualBoundingBoxAscent || size * 0.76;
    const descent = metrics.actualBoundingBoxDescent || size * 0.2;
    const padding = Math.max(0.08, size * 0.035);
    return {
        halfWidth: width / 2 + padding,
        halfHeight: (ascent + descent) / 2 + padding,
        anchorOffset: Math.max(0.2, (ascent - descent) / 2)
    };
}

function makeFormParticles(settings, mask) {
    const grid = makeResolutionGrid(settings.width, settings.height, settings.resolution, settings.density);
    const base = baseSizeFromGrid(grid, 0.74);
    const chars = cleanPatternText(settings.patternText, settings.allCaps);
    const minWeight = Math.min(settings.weightMin, settings.weightMax);
    const maxWeight = Math.max(settings.weightMin, settings.weightMax);
    const noiseRange = relativeNoiseRange(settings);
    const edgeSpread = formEdgeSpread(settings, settings.width, settings.height);
    const hideTiny = settings.hideTinyLetters !== false;
    const particles = [];

    grid.points.forEach((point, sourceIndex) => {
        if (!insideFormMask(mask, point.x, point.y, settings)) return;
        const initialField = sampleFormField(mask, point.x, point.y, settings);
        if (!initialField) return;
        const initialTone = toneFromFormDistance(initialField.distance, edgeSpread, settings);
        const noise = settings.noiseEnabled !== false
            ? lerp(noiseRange.min, noiseRange.max, initialTone)
            : 0;
        const pitch = Math.min(point.pitchW, point.pitchH);
        const jitter = pitch * clamp(0.28 + noise * 0.36, 0.28, 0.95);
        let baselineX = point.x;
        let baselineY = point.y;
        for (let attempt = 0; attempt < 6; attempt++) {
            const candidateX = point.x + signedNoise(sourceIndex, 31 + attempt * 2) * jitter;
            const candidateY = point.y + signedNoise(sourceIndex, 32 + attempt * 2) * jitter;
            if (insideFormMask(mask, candidateX, candidateY, settings)) {
                baselineX = candidateX;
                baselineY = candidateY;
                break;
            }
        }

        const styleField = sampleFormField(mask, baselineX, baselineY, settings);
        if (!styleField) return;
        const tone = toneFromFormDistance(styleField.distance, edgeSpread, settings);
        const type = typographyFromTone(settings, base, minWeight, maxWeight, tone);
        if (hideTiny && type.size <= Math.max(0.35, base * DITHER_EMPTY_TONE)) return;

        const char = chars[sourceIndex % chars.length];
        const styleRotation = type.rotation * Math.PI / 180;
        const collision = glyphCollisionMetrics(char, type.size, type.weight);
        const anchorOffset = collision.anchorOffset;
        const collisionRadius = Math.hypot(collision.halfWidth, collision.halfHeight);
        const weightMass = lerp(0.62, 1.38, clamp((type.weight - 100) / 800));
        const mass = clamp((type.size / Math.max(0.1, base)) ** 2 * weightMass, 0.35, 3.5);
        particles.push({
            sourceIndex,
            char,
            size: type.size,
            weight: type.weight,
            styleRotation,
            angle: styleRotation,
            angularVelocity: 0,
            anchorOffset,
            halfWidth: collision.halfWidth,
            halfHeight: collision.halfHeight,
            collisionRadius,
            mass,
            x: baselineX + Math.sin(styleRotation) * anchorOffset,
            y: baselineY - Math.cos(styleRotation) * anchorOffset,
            vx: 0,
            vy: 0,
            attachedTo: null,
            attachCooldown: 0,
            bondNormalX: 0,
            bondNormalY: 1,
            orientationX: 0,
            orientationY: 1
        });
    });
    return { particles, grid };
}

function particleAnchor(particle) {
    return {
        x: particle.x - Math.sin(particle.angle) * particle.anchorOffset,
        y: particle.y + Math.cos(particle.angle) * particle.anchorOffset
    };
}

function createFormPhysicsForce(settings, mask) {
    let particles = [];
    const attractionRange = formEdgeSpread(settings, settings.width, settings.height);
    const lineGravity = clamp(Number(settings.formAttraction ?? 25) / 100);
    const stickiness = clamp(Number(settings.formStickiness ?? 25) / 100);
    const friction = clamp(Number(settings.formFriction ?? 50) / 100);
    const gravityLevel = clamp(Number(settings.formGravity ?? 50) / 100);
    const gravityDirection = gravityDirectionVector(settings.formGravityDirection);
    const gravityAcceleration = gravityLevel * 0.15;
    const lineForceLimit = lineGravity * 0.24;
    const maximumBondForce = lineForceLimit * 0.45 + Math.pow(stickiness, 1.45) * 0.22;
    const springStrength = 0.055 + stickiness * 0.12;
    const contactDamping = 0.18;
    const tangentialFriction = friction * 0.22;

    function force() {
        particles.forEach((particle) => {
            if (particle.attachCooldown > 0) particle.attachCooldown--;
            const anchor = particleAnchor(particle);
            let attractor = nearestLineAttractor(mask, anchor.x, anchor.y, settings, particle.attachedTo);
            let forceX = gravityDirection.x * gravityAcceleration * particle.mass;
            let forceY = gravityDirection.y * gravityAcceleration * particle.mass;
            let lineIntentX = 0;
            let lineIntentY = 0;

            if (particle.attachedTo && attractor) {
                const dx = attractor.x - anchor.x;
                const dy = attractor.y - anchor.y;
                const distance = Math.hypot(dx, dy);
                let normalX = distance > 0.0001 ? dx / distance : particle.bondNormalX;
                let normalY = distance > 0.0001 ? dy / distance : particle.bondNormalY;
                if (distance > 0.0001) {
                    particle.bondNormalX = normalX;
                    particle.bondNormalY = normalY;
                }

                const anchorVelocityX = particle.vx - Math.cos(particle.angle) * particle.anchorOffset * particle.angularVelocity;
                const anchorVelocityY = particle.vy - Math.sin(particle.angle) * particle.anchorOffset * particle.angularVelocity;
                const normalVelocity = anchorVelocityX * normalX + anchorVelocityY * normalY;
                const springForce = distance * springStrength - normalVelocity * particle.mass * contactDamping;

                if (Math.abs(springForce) > maximumBondForce || distance > Math.max(3, particle.size * 1.1)) {
                    particle.attachedTo = null;
                    particle.attachCooldown = 12;
                    attractor = nearestLineAttractor(mask, anchor.x, anchor.y, settings);
                } else {
                    const tangentX = -normalY;
                    const tangentY = normalX;
                    const tangentVelocity = anchorVelocityX * tangentX + anchorVelocityY * tangentY;
                    forceX += normalX * springForce - tangentX * tangentVelocity * particle.mass * tangentialFriction;
                    forceY += normalY * springForce - tangentY * tangentVelocity * particle.mass * tangentialFriction;
                    const intent = lineForceLimit + maximumBondForce * 0.5;
                    lineIntentX = normalX * intent;
                    lineIntentY = normalY * intent;
                }
            }

            if (!particle.attachedTo && attractor) {
                const dx = attractor.x - anchor.x;
                const dy = attractor.y - anchor.y;
                const distance = Math.hypot(dx, dy);
                const normalX = distance > 0.0001 ? dx / distance : attractor.normalX;
                const normalY = distance > 0.0001 ? dy / distance : attractor.normalY;
                const falloff = distance < attractionRange
                    ? Math.pow(1 - distance / attractionRange, 2.2)
                    : 0;
                const lineForce = lineForceLimit * falloff;
                forceX += normalX * lineForce;
                forceY += normalY * lineForce;
                lineIntentX = normalX * lineForce;
                lineIntentY = normalY * lineForce;

                const contactDistance = Math.max(0.9, particle.size * 0.18);
                if (stickiness > 0 && particle.attachCooldown === 0 && distance <= contactDistance) {
                    particle.attachedTo = attractor.kind;
                    particle.bondNormalX = normalX;
                    particle.bondNormalY = normalY;
                }
            }

            particle.orientationX = gravityDirection.x * gravityAcceleration * particle.mass + lineIntentX;
            particle.orientationY = gravityDirection.y * gravityAcceleration * particle.mass + lineIntentY;
            particle.vx += forceX / particle.mass;
            particle.vy += forceY / particle.mass;
        });
    }

    force.initialize = (nextParticles) => {
        particles = nextParticles;
    };
    return force;
}

function normalizeAngle(angle) {
    let result = angle;
    while (result > Math.PI) result -= Math.PI * 2;
    while (result < -Math.PI) result += Math.PI * 2;
    return result;
}

function settleParticleAngles(particles) {
    particles.forEach((particle) => {
        const forceLength = Math.hypot(particle.orientationX, particle.orientationY);
        if (forceLength <= 0.0001) return;
        const targetAngle = Math.atan2(-particle.orientationX, particle.orientationY) + particle.styleRotation;
        const difference = normalizeAngle(targetAngle - particle.angle);
        particle.angularVelocity += difference * 0.075 / Math.sqrt(particle.mass);
        particle.angularVelocity *= 0.72;
        particle.angle = normalizeAngle(particle.angle + particle.angularVelocity);
    });
}

function rectangleProjectionRadius(particle, axisX, axisY) {
    const cos = Math.cos(particle.angle);
    const sin = Math.sin(particle.angle);
    const horizontal = Math.abs(cos * axisX + sin * axisY) * particle.halfWidth;
    const vertical = Math.abs(-sin * axisX + cos * axisY) * particle.halfHeight;
    return horizontal + vertical;
}

function rectangleContact(first, second) {
    const deltaX = second.x + second.vx - first.x - first.vx;
    const deltaY = second.y + second.vy - first.y - first.vy;
    const firstCos = Math.cos(first.angle);
    const firstSin = Math.sin(first.angle);
    const secondCos = Math.cos(second.angle);
    const secondSin = Math.sin(second.angle);
    const axes = [
        [firstCos, firstSin],
        [-firstSin, firstCos],
        [secondCos, secondSin],
        [-secondSin, secondCos]
    ];
    let minimumOverlap = Infinity;
    let normalX = 0;
    let normalY = 0;

    for (const [axisX, axisY] of axes) {
        const centerDistance = deltaX * axisX + deltaY * axisY;
        const overlap = rectangleProjectionRadius(first, axisX, axisY)
            + rectangleProjectionRadius(second, axisX, axisY)
            - Math.abs(centerDistance);
        if (overlap <= 0) return null;
        if (overlap < minimumOverlap) {
            minimumOverlap = overlap;
            const direction = centerDistance < 0 ? -1 : 1;
            normalX = axisX * direction;
            normalY = axisY * direction;
        }
    }
    return { overlap: minimumOverlap, normalX, normalY };
}

function createRectangleCollisionForce(strength = 0.78) {
    let particles = [];
    let cellSize = 1;

    function force() {
        const buckets = new Map();
        particles.forEach((particle) => {
            const cellX = Math.floor((particle.x + particle.vx) / cellSize);
            const cellY = Math.floor((particle.y + particle.vy) / cellSize);
            const key = `${cellX},${cellY}`;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(particle);
        });

        particles.forEach((first) => {
            const cellX = Math.floor((first.x + first.vx) / cellSize);
            const cellY = Math.floor((first.y + first.vy) / cellSize);
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                for (let offsetX = -1; offsetX <= 1; offsetX++) {
                    const nearby = buckets.get(`${cellX + offsetX},${cellY + offsetY}`);
                    if (!nearby) continue;
                    nearby.forEach((second) => {
                        if (second.index <= first.index) return;
                        const dx = second.x + second.vx - first.x - first.vx;
                        const dy = second.y + second.vy - first.y - first.vy;
                        const broadRadius = first.collisionRadius + second.collisionRadius;
                        if (dx * dx + dy * dy >= broadRadius * broadRadius) return;
                        const contact = rectangleContact(first, second);
                        if (!contact) return;

                        const inverseFirst = 1 / first.mass;
                        const inverseSecond = 1 / second.mass;
                        const inverseTotal = inverseFirst + inverseSecond;
                        const correction = Math.min(contact.overlap, Math.min(first.halfHeight, second.halfHeight)) * strength;
                        const firstShare = inverseFirst / inverseTotal;
                        const secondShare = inverseSecond / inverseTotal;
                        first.x -= contact.normalX * correction * firstShare;
                        first.y -= contact.normalY * correction * firstShare;
                        second.x += contact.normalX * correction * secondShare;
                        second.y += contact.normalY * correction * secondShare;

                        const relativeVelocity = (second.vx - first.vx) * contact.normalX
                            + (second.vy - first.vy) * contact.normalY;
                        if (relativeVelocity < 0) {
                            const impulse = -relativeVelocity / inverseTotal;
                            first.vx -= contact.normalX * impulse * inverseFirst;
                            first.vy -= contact.normalY * impulse * inverseFirst;
                            second.vx += contact.normalX * impulse * inverseSecond;
                            second.vy += contact.normalY * impulse * inverseSecond;
                        }
                    });
                }
            }
        });
    }

    force.initialize = (nextParticles) => {
        particles = nextParticles;
        const largestRadius = particles.reduce((largest, particle) => Math.max(largest, particle.collisionRadius), 0.5);
        cellSize = Math.max(1, largestRadius * 2);
    };
    return force;
}

function constrainFormParticles(particles, width, height, enabled) {
    if (!enabled) return;
    particles.forEach((particle) => {
        const extentX = Math.min(rectangleProjectionRadius(particle, 1, 0), width / 2);
        const extentY = Math.min(rectangleProjectionRadius(particle, 0, 1), height / 2);
        if (particle.x < extentX) {
            particle.x = extentX;
            particle.vx = Math.max(0, particle.vx) * 0.08;
        } else if (particle.x > width - extentX) {
            particle.x = width - extentX;
            particle.vx = Math.min(0, particle.vx) * 0.08;
        }
        if (particle.y < extentY) {
            particle.y = extentY;
            particle.vy = Math.max(0, particle.vy) * 0.08;
        } else if (particle.y > height - extentY) {
            particle.y = height - extentY;
            particle.vy = Math.min(0, particle.vy) * 0.08;
        }
    });
}

function settleFormParticles(settings, mask) {
    const key = formPhysicsKey(settings);
    if (state.formPhysicsCache.key === key && state.formPhysicsCache.letters) {
        return state.formPhysicsCache.letters;
    }
    const d3 = window.d3;
    if (!d3?.forceSimulation) return [];

    const { particles } = makeFormParticles(settings, mask);
    const settlingSteps = clamp(
        Math.round(Number(settings.formSettlingTime ?? FORM_SETTLE_STEPS)),
        FORM_SETTLE_MIN,
        FORM_SETTLE_MAX
    );
    const simulation = d3.forceSimulation(particles)
        .stop()
        .randomSource(seededRandom(hashString(key)))
        .alpha(1)
        .alphaDecay(0)
        .velocityDecay(0.105)
        .force('form-physics', createFormPhysicsForce(settings, mask))
        .force('letter-collision', createRectangleCollisionForce());

    for (let step = 0; step < settlingSteps; step++) {
        simulation.tick();
        settleParticleAngles(particles);
        constrainFormParticles(particles, settings.width, settings.height, settings.formCanvasEdges !== false);
    }
    simulation.stop();
    state.formPhysicsCache = { key, letters: particles };
    return particles;
}

function renderForms(ctx) {
    const { settings, width, height } = ctx;
    const mask = ensureFormMask(settings);
    if (!mask) return;

    settleFormParticles(settings, mask).forEach((particle) => {
        const anchor = particleAnchor(particle);
        drawLetter(ctx, {
            char: particle.char,
            x: anchor.x,
            y: anchor.y,
            size: particle.size,
            weight: particle.weight,
            rotation: particle.angle * 180 / Math.PI,
            baseline: 'alphabetic',
            fill: settings.inkColor
        });
    });
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
        state.formImageKey = `svg:${hashString(normalizedSvg)}`;
        state.formLabel = label;
        state.formMaskKey = '';
        state.formPhysicsCache = { key: '', letters: null };
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
    const lightGroupLabel = document.getElementById('lightToneGroupLabel');
    if (lightGroupLabel) lightGroupLabel.textContent = mode === 'forms' ? 'Far from edge' : 'Light pixels';
    const darkGroupLabel = document.getElementById('darkToneGroupLabel');
    if (darkGroupLabel) darkGroupLabel.textContent = mode === 'forms' ? 'Near edge' : 'Dark pixels';
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
            text: 'Dither maps an image through text. Forms settles letters inside an SVG with gravity, contour attraction, adhesion and friction.'
        });
    });

    app.settingsStore.subscribe('mode', () => syncCustomControls(app));
    app.settingsStore.subscribe('*', (_next, _prev, key) => {
        if (key === 'width' || key === 'height') {
            state.formMaskKey = '';
            state.formPhysicsCache = { key: '', letters: null };
        }
    });
}

function appSnapshot(app) {
    return { settings: app.settingsStore.toObject() };
}

function appRestore(app, snapshot) {
    const settings = snapshot?.settings || snapshot || {};
    settings.mode = normalizeMode(settings.mode);
    app.settingsStore.fromJSON(settings, true);
    state.ditherCache.key = '';
    state.formMaskKey = '';
    state.formPhysicsCache = { key: '', letters: null };
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
    const dominantBaseline = textElement.getAttribute('dominant-baseline');
    const baseline = dominantBaseline === 'alphabetic'
        ? 0
        : (font.ascender + font.descender) * scale / 2;
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
        noiseMin: 100,
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
        exportTransparent: true,
        ditherAlgorithm: 'floyd',
        contrast: 2,
        blackPoint: 40,
        whitePoint: 200,
        formEdgeSpread: 15,
        formAttraction: 25,
        formStickiness: 25,
        formFriction: 50,
        formSettlingTime: 72,
        formGravity: 50,
        formGravityDirection: 135,
        formCanvasEdges: true
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
            { id: 'formEdgeSpreadSlider', valueId: 'formEdgeSpreadValue', setting: 'formEdgeSpread', min: 2, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'formAttractionSlider', valueId: 'formAttractionValue', setting: 'formAttraction', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'formStickinessSlider', valueId: 'formStickinessValue', setting: 'formStickiness', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'formFrictionSlider', valueId: 'formFrictionValue', setting: 'formFriction', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'formSettlingTimeSlider', valueId: 'formSettlingTimeValue', setting: 'formSettlingTime', min: 12, max: 180, decimals: 0, baseStep: 1, shiftStep: 12 },
            { id: 'formGravitySlider', valueId: 'formGravityValue', setting: 'formGravity', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'formGravityDirectionSlider', valueId: 'formGravityDirectionValue', setting: 'formGravityDirection', min: -180, max: 180, decimals: 0, baseStep: 1, shiftStep: 15 }
        ],
        toggles: true
    },
    panels: [
        { id: 'textPanel', headerId: 'textPanelHeader', persistent: true },
        { id: 'pixelsPanel', headerId: 'pixelsPanelHeader', persistent: true },
        { id: 'ditherPanel', headerId: 'ditherPanelHeader', persistent: true },
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
        storageKey: 'wordplayerPresetsV18',
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
        document.fonts?.load('400 16px "YSTextPattern"').then(() => {
            state.formPhysicsCache = { key: '', letters: null };
            if (appInstance.settings.mode === 'forms') appInstance.renderNow();
        });
    }
});

export default app;
