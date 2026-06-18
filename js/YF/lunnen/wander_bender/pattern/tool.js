/**
 * Pattern Bender — generative pattern tool built on Othersite UI Framework v3.
 *
 * Based on the "Random" mode of Wander Bender. Every value is in millimetres
 * (1 SVG user unit = 1 mm), and the exported SVG carries explicit `mm` units so
 * it opens in Illustrator at the exact physical size.
 *
 * Randomisation (the ◆ dice) is available on every parameter except the canvas
 * size. Geometry parameters (length, thickness, corner, arc) vary *per element*
 * within their range; scalar parameters (count, density, extracted, stroke)
 * resolve to a single seeded value within their range.
 */
import { defineTool } from './src/core/defineTool.js';
import { createShapeFromLine } from './shapes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* Deterministic PRNG so renders + undo/redo are reproducible. */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const lerpRange = (lo, hi, t) => {
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    return a + (b - a) * t;
};

/* Declared before defineTool(): autoStart runs init() synchronously on module
 * evaluation, and render() touches this flag — keep it out of the TDZ. */
let _paperReady = false;

const app = defineTool({
    renderer: 'svg',
    autoStart: true,

    dom: {
        canvas: 'canvasContainer',
        surface: 'mainSvg',
        zoomIndicator: 'zoomIndicator',
        presetDropdown: 'presetDropdown',
        presetToggle: 'presetDropdownToggle',
        presetMenu: 'presetDropdownMenu',
        saveBtn: 'savePresetBtn',
        shareBtn: 'presetToolbarShareBtn'
    },

    settings: {
        // Canvas (mm) — no randomisation.
        canvasW: 500,
        canvasH: 500,

        // Element geometry (mm) — randomisable per element.
        length: 90, lengthMin: 40, lengthMax: 160, randLength: false,
        thickness: 32, thicknessMin: 16, thicknessMax: 60, randThickness: false,
        cornerRadius: 16, cornerMin: 0, cornerMax: 30, randCornerRadius: false,
        arc: 0, arcMin: 0, arcMax: 80, randArc: false,
        stroke: 26, strokeMin: 10, strokeMax: 40, randStroke: false,

        // Distribution — scalar randomisation.
        count: 40, countMin: 10, countMax: 120, randCount: false,
        density: 35, densityMin: 0, densityMax: 80, randDensity: false,
        extracted: 0, extractedMin: 0, extractedMax: 20, randExtracted: false,

        seed: 12345,

        // Colors.
        strokeColor: '#ffffff',
        bgColor: '#0a0a0a'
    },

    // Artboard size is driven by the canvas settings (in mm).
    size: (s) => ({ width: s.canvasW || 500, height: s.canvasH || 500 }),

    controls: {
        sliders: [
            { id: 'canvasWSlider', valueId: 'canvasWValue', setting: 'canvasW', min: 100, max: 1200, decimals: 0, baseStep: 10, shiftStep: 50 },
            { id: 'canvasHSlider', valueId: 'canvasHValue', setting: 'canvasH', min: 100, max: 1200, decimals: 0, baseStep: 10, shiftStep: 50 },
            { id: 'lengthSlider', valueId: 'lengthValue', setting: 'length', min: 1, max: 500, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'thicknessSlider', valueId: 'thicknessValue', setting: 'thickness', min: 1, max: 500, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'cornerSlider', valueId: 'cornerValue', setting: 'cornerRadius', min: 0, max: 250, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'arcSlider', valueId: 'arcValue', setting: 'arc', min: 0, max: 250, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'strokeSlider', valueId: 'strokeValue', setting: 'stroke', min: 1, max: 100, decimals: 0, baseStep: 1, shiftStep: 5 },
            { id: 'countSlider', valueId: 'countValue', setting: 'count', min: 1, max: 500, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'densitySlider', valueId: 'densityValue', setting: 'density', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'extractedSlider', valueId: 'extractedValue', setting: 'extracted', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 5 },
            { id: 'seedSlider', valueId: 'seedValue', setting: 'seed', min: 1, max: 99999, decimals: 0, baseStep: 1, shiftStep: 100 }
        ],
        ranges: [
            { containerId: 'lengthRangeSlider', minValueId: 'lengthMinValue', maxValueId: 'lengthMaxValue', minSetting: 'lengthMin', maxSetting: 'lengthMax', min: 1, max: 500, decimals: 0, baseStep: 1, shiftStep: 10 },
            { containerId: 'thicknessRangeSlider', minValueId: 'thicknessMinValue', maxValueId: 'thicknessMaxValue', minSetting: 'thicknessMin', maxSetting: 'thicknessMax', min: 1, max: 500, decimals: 0, baseStep: 1, shiftStep: 10 },
            { containerId: 'cornerRangeSlider', minValueId: 'cornerMinValue', maxValueId: 'cornerMaxValue', minSetting: 'cornerMin', maxSetting: 'cornerMax', min: 0, max: 250, decimals: 0, baseStep: 1, shiftStep: 10 },
            { containerId: 'arcRangeSlider', minValueId: 'arcMinValue', maxValueId: 'arcMaxValue', minSetting: 'arcMin', maxSetting: 'arcMax', min: 0, max: 250, decimals: 0, baseStep: 1, shiftStep: 10 },
            { containerId: 'strokeRangeSlider', minValueId: 'strokeMinValue', maxValueId: 'strokeMaxValue', minSetting: 'strokeMin', maxSetting: 'strokeMax', min: 1, max: 100, decimals: 0, baseStep: 1, shiftStep: 5 },
            { containerId: 'countRangeSlider', minValueId: 'countMinValue', maxValueId: 'countMaxValue', minSetting: 'countMin', maxSetting: 'countMax', min: 1, max: 500, decimals: 0, baseStep: 1, shiftStep: 10 },
            { containerId: 'densityRangeSlider', minValueId: 'densityMinValue', maxValueId: 'densityMaxValue', minSetting: 'densityMin', maxSetting: 'densityMax', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { containerId: 'extractedRangeSlider', minValueId: 'extractedMinValue', maxValueId: 'extractedMaxValue', minSetting: 'extractedMin', maxSetting: 'extractedMax', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 5 }
        ],
        toggles: true
    },

    dice: {
        params: [
            { key: 'length', flag: 'randLength', label: 'Длина', diceId: 'lengthDice', singleId: 'lengthSingle', rangeId: 'lengthRange', valueId: 'lengthValue', min: 1, max: 500, decimals: 0, rangeMinKey: 'lengthMin', rangeMaxKey: 'lengthMax' },
            { key: 'thickness', flag: 'randThickness', label: 'Ширина', diceId: 'thicknessDice', singleId: 'thicknessSingle', rangeId: 'thicknessRange', valueId: 'thicknessValue', min: 1, max: 500, decimals: 0, rangeMinKey: 'thicknessMin', rangeMaxKey: 'thicknessMax' },
            { key: 'cornerRadius', flag: 'randCornerRadius', label: 'Скругление', diceId: 'cornerDice', singleId: 'cornerSingle', rangeId: 'cornerRange', valueId: 'cornerValue', min: 0, max: 250, decimals: 0, rangeMinKey: 'cornerMin', rangeMaxKey: 'cornerMax' },
            { key: 'arc', flag: 'randArc', label: 'Изгиб', diceId: 'arcDice', singleId: 'arcSingle', rangeId: 'arcRange', valueId: 'arcValue', min: 0, max: 250, decimals: 0, rangeMinKey: 'arcMin', rangeMaxKey: 'arcMax' },
            { key: 'stroke', flag: 'randStroke', label: 'Обводка', diceId: 'strokeDice', singleId: 'strokeSingle', rangeId: 'strokeRange', valueId: 'strokeValue', min: 1, max: 100, decimals: 0, rangeMinKey: 'strokeMin', rangeMaxKey: 'strokeMax' },
            { key: 'count', flag: 'randCount', label: 'Количество', diceId: 'countDice', singleId: 'countSingle', rangeId: 'countRange', valueId: 'countValue', min: 1, max: 500, decimals: 0, rangeMinKey: 'countMin', rangeMaxKey: 'countMax' },
            { key: 'density', flag: 'randDensity', label: 'Плотность', diceId: 'densityDice', singleId: 'densitySingle', rangeId: 'densityRange', valueId: 'densityValue', min: 0, max: 100, decimals: 0, rangeMinKey: 'densityMin', rangeMaxKey: 'densityMax' },
            { key: 'extracted', flag: 'randExtracted', label: 'Выделенные', diceId: 'extractedDice', singleId: 'extractedSingle', rangeId: 'extractedRange', valueId: 'extractedValue', min: 0, max: 100, decimals: 0, rangeMinKey: 'extractedMin', rangeMaxKey: 'extractedMax' }
        ]
    },

    panels: [
        { id: 'canvasPanel', headerId: 'canvasPanelHeader', persistent: true },
        { id: 'shapePanel', headerId: 'shapePanelHeader', persistent: true },
        { id: 'distPanel', headerId: 'distPanelHeader', persistent: true },
        { id: 'colorsPanel', headerId: 'colorsPanelHeader', persistent: true }
    ],

    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'stroke', setting: 'strokeColor', label: 'Обводка', itemId: 'strokeColorItem', dotId: 'strokeColorPreview', hexId: 'strokeColorHex', hsbSlotId: 'strokeColorHsbSlot' },
            { type: 'bg', setting: 'bgColor', label: 'Фон', itemId: 'bgColorItem', dotId: 'bgColorPreview', hexId: 'bgColorHex', hsbSlotId: 'bgColorHsbSlot' }
        ]
    },

    presets: {
        storageKey: 'othersitePatternBender',
        basePath: 'presets',
        defaultName: 'Default',
        colorDots: (blob) => {
            const stroke = blob.strokeColor || '#ffffff';
            const bg = blob.bgColor || '#000000';
            const dots = [{ kind: 'solid', value: stroke }];
            if (stroke.toLowerCase() !== bg.toLowerCase()) dots.push({ kind: 'solid', value: bg });
            return dots;
        },
        hasRandom: (blob) => !!(blob.randLength || blob.randThickness || blob.randCornerRadius ||
            blob.randArc || blob.randStroke || blob.randCount || blob.randDensity || blob.randExtracted)
    },

    share: {},
    // Custom mm-aware SVG export is wired in onReady; disable the framework one.
    export: false,

    render(ctx) {
        const { svg, create, width, height, settings, app } = ctx;
        const s = settings;

        // Background.
        svg.appendChild(create('rect', { x: 0, y: 0, width, height, fill: s.bgColor }));

        if (typeof paper === 'undefined') return;
        ensurePaper();

        // --- Resolve scalar parameters (count / density / stroke / extracted) ---
        const scalarRng = mulberry32(((s.seed >>> 0) ^ 0x9e3779b9) >>> 0);
        const resolveScalar = (flag, base, lo, hi) => {
            if (!s[flag]) return base;
            return Math.round(lerpRange(Number(lo), Number(hi), scalarRng()));
        };
        const count = Math.max(1, resolveScalar('randCount', s.count, s.countMin, s.countMax));
        const density = resolveScalar('randDensity', s.density, s.densityMin, s.densityMax);
        const stroke = Math.max(0.1, resolveScalar('randStroke', s.stroke, s.strokeMin, s.strokeMax));
        let extractedCount = resolveScalar('randExtracted', s.extracted, s.extractedMin, s.extractedMax);
        extractedCount = Math.max(0, Math.min(count, extractedCount));

        // --- Manual-extraction state: reset when the element set changes ---
        const sig = `${width}|${height}|${count}|${density}|${s.seed}`;
        if (!app._pattern || app._pattern.sig !== sig) {
            app._pattern = { sig, manual: new Map() };
        }
        const manual = app._pattern.manual;

        // --- Build elements deterministically ---
        const rng = mulberry32((s.seed >>> 0) || 1);
        const minDist = (density / 100) * s.length * 1.5; // mm between element centers
        const placed = [];
        const elements = [];
        for (let i = 0; i < count; i++) {
            let x = 0, y = 0;
            for (let attempt = 0; attempt < 24; attempt++) {
                x = rng() * width;
                y = rng() * height;
                if (minDist <= 0) break;
                let ok = true;
                for (const p of placed) {
                    const dx = p.x - x, dy = p.y - y;
                    if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
                }
                if (ok) break;
            }
            placed.push({ x, y });

            const angle = rng() * 360;
            // Always roll geometry randoms so toggling a flag never reshuffles others.
            const rl = rng(), rt = rng(), rc = rng(), ra = rng();
            const len = Math.max(1, s.randLength ? lerpRange(s.lengthMin, s.lengthMax, rl) : s.length);
            const th = Math.max(1, s.randThickness ? lerpRange(s.thicknessMin, s.thicknessMax, rt) : s.thickness);
            let corner = s.randCornerRadius ? lerpRange(s.cornerMin, s.cornerMax, rc) : s.cornerRadius;
            corner = Math.min(corner, th / 2);
            const arc = s.randArc ? lerpRange(s.arcMin, s.arcMax, ra) : s.arc;

            elements.push({ x, y, angle, len, th, corner, arc });
        }

        // --- Determine extracted set: N auto (seeded) + manual click overrides ---
        const autoSet = new Set();
        if (extractedCount > 0) {
            const order = [];
            for (let i = 0; i < count; i++) order.push(i);
            const autoRng = mulberry32(((s.seed >>> 0) ^ 0x85ebca6b) >>> 0);
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(autoRng() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            for (let i = 0; i < extractedCount; i++) autoSet.add(order[i]);
        }
        const isExtracted = (i) => manual.has(i) ? manual.get(i) : autoSet.has(i);
        app._pattern.isExtracted = isExtracted;

        // --- Build paper shapes; collect per-element path data, unite the rest ---
        paper.project.activeLayer.removeChildren();
        const elementDs = new Array(count).fill(null);
        let unionPath = null;

        for (let i = 0; i < count; i++) {
            const e = elements[i];
            const res = createShapeFromLine([{ x: 0, y: 0 }, { x: e.len, y: 0 }, e.arc], e.th, e.corner, e.len / 2);
            if (!res) continue;
            const { shape, pivotPoint } = res;
            shape.translate(new paper.Point(e.x - pivotPoint.x, e.y - pivotPoint.y));
            shape.rotate(e.angle, new paper.Point(e.x, e.y));
            elementDs[i] = shape.pathData;

            if (isExtracted(i)) {
                shape.remove();
                continue;
            }
            if (unionPath === null) {
                unionPath = shape;
            } else {
                const united = unionPath.unite(shape);
                unionPath.remove();
                shape.remove();
                unionPath = united;
            }
        }

        // United (non-extracted) outline.
        if (unionPath) {
            const path = create('path', {
                d: unionPath.pathData,
                fill: 'none',
                stroke: s.strokeColor,
                'stroke-width': stroke,
                'stroke-linejoin': 'round'
            });
            path.classList.add('pattern-union');
            svg.appendChild(path);
            unionPath.remove();
        }
        paper.project.activeLayer.removeChildren();

        // Interactive hit areas for non-extracted elements (click → extract).
        for (let i = 0; i < count; i++) {
            if (isExtracted(i) || !elementDs[i]) continue;
            const hit = create('path', { d: elementDs[i], fill: 'transparent', stroke: 'none' });
            hit.classList.add('hit-area');
            hit.dataset.i = String(i);
            hit.style.cursor = 'pointer';
            hit.addEventListener('click', (ev) => { ev.stopPropagation(); toggleExtract(app, i); });
            svg.appendChild(hit);
        }

        // Extracted elements: filled with background, own outline, click → return.
        for (let i = 0; i < count; i++) {
            if (!isExtracted(i) || !elementDs[i]) continue;
            const path = create('path', {
                d: elementDs[i],
                fill: s.bgColor,
                stroke: s.strokeColor,
                'stroke-width': stroke,
                'stroke-linejoin': 'round'
            });
            path.classList.add('extracted-shape');
            path.dataset.i = String(i);
            path.style.cursor = 'pointer';
            path.addEventListener('click', (ev) => { ev.stopPropagation(); toggleExtract(app, i); });
            svg.appendChild(path);
        }
    },

    onReady(appInstance) {
        document.getElementById('exportSvgBtn')?.addEventListener('click', () => exportPatternSVG(appInstance));
        document.getElementById('exportPngBtn')?.addEventListener('click', () => appInstance.exportPNG('pattern.png'));
        document.getElementById('resetExtractedBtn')?.addEventListener('click', () => {
            if (appInstance._pattern) appInstance._pattern.manual = new Map();
            appInstance.renderNow();
        });
        document.getElementById('shuffleBtn')?.addEventListener('click', () => {
            appInstance.dice?.randomize();
            const seed = 1 + Math.floor(Math.random() * 99999);
            appInstance.settingsStore.set('seed', seed);
            appInstance.sliders?.setValue('seedSlider', seed, false);
        });
        // Custom mm-aware export on Cmd/Ctrl+E.
        appInstance.shortcuts?.register('mod+e', () => exportPatternSVG(appInstance));
    }
});

/* ---------------------------------------------------------------------- */

function ensurePaper() {
    if (_paperReady) return;
    paper.setup(new paper.Size(1, 1));
    _paperReady = true;
}

/** Toggle a single element's extracted state (manual override) and re-render. */
function toggleExtract(app, i) {
    if (!app._pattern) return;
    const current = app._pattern.isExtracted ? app._pattern.isExtracted(i) : false;
    app._pattern.manual.set(i, !current);
    app.renderNow();
}

/**
 * Export the artboard as an SVG with explicit millimetre dimensions so it opens
 * at the correct physical size in Illustrator. Strips interactive hit areas.
 */
function exportPatternSVG(app) {
    const svg = app.target.element;
    const w = app.settings.canvasW;
    const h = app.settings.canvasH;

    const clone = svg.cloneNode(true);
    clone.querySelectorAll('.hit-area').forEach((el) => el.remove());
    clone.setAttribute('xmlns', SVG_NS);
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
    clone.setAttribute('width', `${w}mm`);
    clone.setAttribute('height', `${h}mm`);
    clone.removeAttribute('x');
    clone.removeAttribute('y');
    clone.removeAttribute('style');

    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pattern-${w}x${h}mm.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 200);
}

export default app;
