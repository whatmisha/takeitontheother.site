/**
 * Keyboarder — этапы 1–2 (геометрия и легенды).
 *
 * Тонкий слой: настройки, реестр контролов и render(ctx). Вся предметная логика — в app/kb/*,
 * вся инфраструктура (слайдеры, панели, зум, история, пресеты, шаринг, экспорт) — во фреймворке.
 *
 * В интерфейсе размеры сетки — только мм, кегли (когда появятся) — только pt. Внутри геометрия
 * по-прежнему в px (= pt = 1/72″), перевод через toPx / toMm.
 */
import { defineTool } from '../vendor/framework/src/core/defineTool.js';
import { buildLayout, gapOf, widthInU } from './kb/grid.js';
import { attachGuides } from './kb/guides.js';
import { LCAKB23 } from './kb/layouts.js';
import { toMm, toPx } from './kb/units.js';
import { loadTypeface } from './kb/typography.js';
import { Compensator, YS_TEXT_REGULAR } from './kb/compensate.js';
import { attachContent, buildLegends, textPath } from './kb/legends.js';
import {
    loadReference, loadLegendReference, compare, reportHtml,
    compareLegends, legendsReportHtml, GEOMETRY_TOLERANCE
} from './kb/verify.js';
import CONTENT from './kb/content/lcakb23.js';
import ICONS from './kb/icons/lcakb23.js';
import ICON_OPTICS from './kb/icons/lcakb23-optics.js';

const REF = LCAKB23.grid;
const SIZE_EPS = 0.0001;

const TYPE_DEFAULTS = {
    glyphSize: 15.1999,
    numpadSize: 13.1732,
    secondarySize: 12.0745,
    wordSize: 9.1199,
    leading: CONTENT.interline,
    trackingOffset: 0
};

const SLIDER_BY_SETTING = {
    colPitch: 'colPitchSlider',
    rowPitch: 'rowPitchSlider',
    keyWidth1U: 'keyWidthSlider',
    keyHeight: 'keyHeightSlider',
    cornerRadius: 'radiusSlider',
    guideInset: 'insetSlider',
    glyphSize: 'glyphSizeSlider',
    numpadSize: 'numpadSizeSlider',
    secondarySize: 'secondarySizeSlider',
    wordSize: 'wordSizeSlider',
    leading: 'leadingSlider',
    trackingOffset: 'trackingOffsetSlider'
};

/** Эталонная сетка в мм — то, что видит и правит пользователь. */
const REF_MM = {
    colPitch: toMm(REF.colPitch),
    rowPitch: toMm(REF.rowPitch),
    keyWidth1U: toMm(REF.keyWidth1U),
    keyHeight: toMm(REF.keyHeight),
    cornerRadius: toMm(REF.cornerRadius),
    guideInset: toMm(REF.guideInset)
};

/**
 * Эталонные прямоугольники для слоя «Эталон». Заполняется асинхронно в onReady.
 * Объявление обязано быть выше render(): при уже загруженном DOM defineTool вызывает init()
 * синхронно, и обращение к переменной в её temporal dead zone уронило бы первый кадр.
 */
let REFERENCE = null;

/**
 * Гарнитура. До её загрузки инструмент рисует геометрию без надписей: шрифт весит 200 КБ,
 * и ждать его, чтобы показать первый кадр, незачем.
 */
let TYPEFACE = null;
let COMP_CACHE = new Map();
let SELECTION = { active: 0, indices: [0] };

function compFor(s) {
    if (!TYPEFACE || s.compensationMode === 'off') return null;
    const mode = s.compensationMode || 'table';
    if (!COMP_CACHE.has(mode)) {
        const params = mode === 'model'
            ? { ...YS_TEXT_REGULAR, table: {} }
            : YS_TEXT_REGULAR;
        COMP_CACHE.set(mode, new Compensator(TYPEFACE, params));
    }
    return COMP_CACHE.get(mode);
}

/** Значения сетки из настроек (мм) — в форму, которую ждёт buildLayout (px). */
const gridFrom = (s) => ({
    colPitch: toPx(s.colPitch),
    rowPitch: toPx(s.rowPitch),
    keyWidth1U: toPx(s.keyWidth1U),
    keyHeight: toPx(s.keyHeight),
    cornerRadius: toPx(s.cornerRadius),
    guideInset: toPx(s.guideInset),
    origin: REF.origin
});

const typeSigFrom = (s) => JSON.stringify({
    glyphSize: s.glyphSize,
    numpadSize: s.numpadSize,
    secondarySize: s.secondarySize,
    wordSize: s.wordSize,
    leading: s.leading,
    trackingOffset: s.trackingOffset,
    compensationMode: s.compensationMode
});

function sizeRole(size) {
    if (Math.abs(size - TYPE_DEFAULTS.glyphSize) < SIZE_EPS) return 'glyphSize';
    if (Math.abs(size - TYPE_DEFAULTS.numpadSize) < SIZE_EPS) return 'numpadSize';
    if (Math.abs(size - TYPE_DEFAULTS.secondarySize) < SIZE_EPS) return 'secondarySize';
    if (Math.abs(size - TYPE_DEFAULTS.wordSize) < SIZE_EPS) return 'wordSize';
    return null;
}

function applyTypeSettings(keys, s) {
    for (const k of keys) {
        k.elements = (k.elements || []).map((el) => {
            if (el.kind !== 'txt') return el;
            const role = sizeRole(el.size);
            return {
                ...el,
                size: role ? s[role] : el.size,
                tracking: (el.tracking || 0) + (s.trackingOffset || 0),
                baseSize: el.size,
                role: role || 'custom'
            };
        });
    }
}

/**
 * Пересчёт раскладки. Кэшируется по подписи сетки: render вызывается и при смене цвета,
 * а геометрия при этом не меняется.
 */
let cached = { sig: null, data: null };
function layoutFor(s) {
    const g = gridFrom(s);
    const sig = JSON.stringify(g) + typeSigFrom(s) + (TYPEFACE ? '·tf' : '');
    if (cached.sig !== sig) {
        const data = buildLayout(LCAKB23, g);
        attachGuides(data.keys, g.guideInset);
        attachContent(data.keys, CONTENT);
        applyTypeSettings(data.keys, s);
        data.legends = TYPEFACE
            ? buildLegends(data.keys, {
                tf: TYPEFACE, comp: compFor(s),
                interline: s.leading, iconOptics: ICON_OPTICS
            })
            : [];
        cached = { sig, data };
    }
    return cached.data;
}

const app = defineTool({
    renderer: 'svg',
    autoStart: true,

    dom: { canvas: 'canvasContainer', surface: 'mainSvg', zoomIndicator: 'zoomIndicator' },

    /**
     * Артборд клавиатуры очень широкий и низкий (отношение 3.6:1), а панели — оверлеи поверх
     * канваса. Без боковых отступов «вписать в экран» прячет крайние клавиши под панелями.
     */
    zoom: { fitPadding: { top: 24, right: 335, bottom: 24, left: 335 } },

    settings: {
        // Сетка в мм. Четыре размера независимы: по X макет круглый, по Y сжат на 0.648 %.
        colPitch: REF_MM.colPitch,
        rowPitch: REF_MM.rowPitch,
        keyWidth1U: REF_MM.keyWidth1U,
        keyHeight: REF_MM.keyHeight,
        cornerRadius: REF_MM.cornerRadius,
        guideInset: REF_MM.guideInset,

        // Type sizes are pt. Internally 1 px = 1 pt, so no conversion is needed.
        glyphSize: TYPE_DEFAULTS.glyphSize,
        numpadSize: TYPE_DEFAULTS.numpadSize,
        secondarySize: TYPE_DEFAULTS.secondarySize,
        wordSize: TYPE_DEFAULTS.wordSize,
        leading: TYPE_DEFAULTS.leading,
        trackingOffset: TYPE_DEFAULTS.trackingOffset,
        compensationMode: 'table',

        showCaps: true,
        showGuides: false,
        showGlyphs: true,
        showIcons: true,
        showColumns: false,
        showIndex: false,
        showInk: false,
        showSlots: false,
        showRef: false,
        showDiff: false,
        showBlocks: false,

        capColor: '#1e1e1e',
        guideColor: '#2353db',
        inkColor: '#aaaaaa',
        bgColor: '#808080'
    },

    controls: {
        // Ranges and steps in mm; value-display shows “N.NNN mm”, no px duplicate.
        sliders: [
            { id: 'colPitchSlider', valueId: 'colPitchValue', setting: 'colPitch', min: 10, max: 28, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
            { id: 'rowPitchSlider', valueId: 'rowPitchValue', setting: 'rowPitch', min: 10, max: 28, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
            { id: 'keyWidthSlider', valueId: 'keyWidthValue', setting: 'keyWidth1U', min: 7, max: 26, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
            { id: 'keyHeightSlider', valueId: 'keyHeightValue', setting: 'keyHeight', min: 7, max: 26, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
            { id: 'radiusSlider', valueId: 'radiusValue', setting: 'cornerRadius', min: 0, max: 7, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
            { id: 'insetSlider', valueId: 'insetValue', setting: 'guideInset', min: 0, max: 6.5, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },

            { id: 'glyphSizeSlider', valueId: 'glyphSizeValue', setting: 'glyphSize', min: 6, max: 24, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' pt' },
            { id: 'numpadSizeSlider', valueId: 'numpadSizeValue', setting: 'numpadSize', min: 6, max: 24, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' pt' },
            { id: 'secondarySizeSlider', valueId: 'secondarySizeValue', setting: 'secondarySize', min: 6, max: 24, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' pt' },
            { id: 'wordSizeSlider', valueId: 'wordSizeValue', setting: 'wordSize', min: 5, max: 18, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' pt' },
            { id: 'leadingSlider', valueId: 'leadingValue', setting: 'leading', min: 6, max: 24, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' pt' },
            { id: 'trackingOffsetSlider', valueId: 'trackingOffsetValue', setting: 'trackingOffset', min: -0.08, max: 0.08, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' em' }
        ],
        toggles: true
    },

    panels: [
        { id: 'gridPanel', headerId: 'gridPanelHeader', persistent: true },
        { id: 'layersPanel', headerId: 'layersPanelHeader', persistent: true },
        { id: 'typePanel', headerId: 'typePanelHeader', persistent: true },
        { id: 'legendPanel', headerId: 'legendPanelHeader', persistent: true },
        { id: 'colorsPanel', headerId: 'colorsPanelHeader', persistent: true }
    ],

    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'cap', setting: 'capColor', label: 'Key', itemId: 'capColorItem', dotId: 'capColorPreview', hexId: 'capColorHex', hsbSlotId: 'capColorHsbSlot' },
            { type: 'guide', setting: 'guideColor', label: 'Guide', itemId: 'guideColorItem', dotId: 'guideColorPreview', hexId: 'guideColorHex', hsbSlotId: 'guideColorHsbSlot' },
            { type: 'ink', setting: 'inkColor', label: 'Legend', itemId: 'inkColorItem', dotId: 'inkColorPreview', hexId: 'inkColorHex', hsbSlotId: 'inkColorHsbSlot' },
            { type: 'bg', setting: 'bgColor', label: 'Background', itemId: 'bgColorItem', dotId: 'bgColorPreview', hexId: 'bgColorHex', hsbSlotId: 'bgColorHsbSlot' }
        ]
    },

    presets: {
        storageKey: 'keyboarder',
        basePath: 'presets',
        defaultName: 'LCAKB23',
        colorDots: (b) => [
            { kind: 'solid', value: b.capColor || '#1e1e1e' },
            { kind: 'solid', value: b.bgColor || '#808080' }
        ]
    },
    share: { quantizableFloatKeys: [] },
    export: { filename: 'keyboarder.svg' },

    /** Артборд зависит от сетки, поэтому размер отдаём хуком. */
    size(s) {
        const { bounds } = layoutFor(s);
        return { width: bounds.w, height: bounds.h };
    },

    render(ctx) {
        const { svg, create, width, height, settings: s } = ctx;
        const { keys, grid } = layoutFor(s);
        const gap = gapOf(grid);

        svg.appendChild(create('rect', { x: 0, y: 0, width, height, fill: s.bgColor }));

        if (s.showBlocks) {
            const g = create('g', { id: 'blocks' });
            for (const b of LCAKB23.blocks) {
                if (b.width == null) continue;
                g.appendChild(create('rect', {
                    x: b.x - gap / 2, y: grid.origin.y - gap / 2,
                    width: b.width + gap, height: height - 2 * grid.origin.y + gap,
                    fill: 'none', stroke: '#3d7fd9', 'stroke-width': 0.4, 'stroke-dasharray': '3 2'
                }));
            }
            svg.appendChild(g);
        }

        if (s.showColumns) {
            const g = create('g', { id: 'columns', opacity: 0.35 });
            for (let x = grid.origin.x; x < width; x += grid.colPitch) {
                g.appendChild(create('line', {
                    x1: x, y1: 0, x2: x, y2: height, stroke: '#4a4f55', 'stroke-width': 0.3
                }));
            }
            for (let r = 0; r <= LCAKB23.rows.length; r++) {
                const y = grid.origin.y + r * grid.rowPitch;
                g.appendChild(create('line', {
                    x1: 0, y1: y, x2: width, y2: y, stroke: '#4a4f55', 'stroke-width': 0.3
                }));
            }
            svg.appendChild(g);
        }

        // Эталон подложкой: пунктир поверх заливки, чтобы расхождение было видно сразу.
        if (s.showRef && REFERENCE) {
            const g = create('g', { id: 'reference' });
            for (const r of REFERENCE) {
                g.appendChild(create('rect', {
                    x: r.x, y: r.y, width: r.w, height: r.h,
                    rx: grid.cornerRadius, ry: grid.cornerRadius,
                    fill: 'none', stroke: '#ffa500', 'stroke-width': 0.5, 'stroke-dasharray': '2 1.5'
                }));
            }
            svg.appendChild(g);
        }

        if (s.showCaps) {
            const g = create('g', { id: 'caps' });
            for (const k of keys) {
                g.appendChild(create('rect', {
                    x: k.x, y: k.y, width: k.w, height: k.h,
                    rx: grid.cornerRadius, ry: grid.cornerRadius, fill: s.capColor
                }));
            }
            svg.appendChild(g);
        }

        if (s.showGuides) {
            const g = create('g', { id: 'guides' });
            for (const k of keys) {
                g.appendChild(create('rect', {
                    x: k.guide.x0, y: k.guide.y0, width: k.guide.w, height: k.guide.h,
                    fill: 'none', stroke: s.guideColor, 'stroke-width': 0.5
                }));
            }
            svg.appendChild(g);
        }

        if (s.showDiff && REFERENCE) {
            svg.appendChild(renderGeometryDiff(create, keys, grid, REFERENCE));
        }

        const selection = renderSelection(create, keys, grid);
        if (selection) svg.appendChild(selection);

        const legends = layoutFor(s).legends;

        // Надписи — кривыми из TTF, а не <text>: результат не зависит от того, установлен ли
        // YS Text у пользователя, и совпадает с тем, что уйдёт в экспорт (решение 2).
        if (s.showGlyphs && TYPEFACE) {
            const g = create('g', { id: 'glyphs', fill: s.inkColor });
            for (const el of legends) {
                if (el.kind !== 'txt') continue;
                const d = textPath(TYPEFACE, el);
                if (d) g.appendChild(create('path', { d }));
            }
            svg.appendChild(g);
        }

        if (s.showIcons) {
            const g = create('g', { id: 'icons', fill: s.inkColor });
            for (const el of legends) {
                if (el.kind !== 'ico') continue;
                const ico = ICONS[el.icon];
                if (!ico) continue;
                const wrap = create('g', {
                    transform: `translate(${el.x - ico.ox} ${el.y - ico.oy})`
                });
                wrap.appendChild(create('path', { d: ico.d }));
                g.appendChild(wrap);
            }
            svg.appendChild(g);
        }

        // Диагностика: чернильный габарит показывает, насколько знак выпущен за кромку поля.
        if (s.showInk) {
            const g = create('g', { id: 'ink' });
            for (const el of legends) {
                const box = el.kind === 'txt' && el.ink
                    ? { x: el.ink[0], y: el.ink[1], width: el.ink[2], height: el.ink[3] }
                    : el.kind === 'ico' ? { x: el.x, y: el.y, width: el.w, height: el.h } : null;
                if (!box) continue;
                g.appendChild(create('rect', {
                    ...box, fill: 'none', stroke: '#3d7fd9', 'stroke-width': 0.2
                }));
                if (el.kind === 'txt') {
                    const k = el.size / TYPEFACE.upm;
                    const capTop = el.by - TYPEFACE.capHeight * k;
                    const xTop = el.by - TYPEFACE.xHeight * k;
                    g.appendChild(create('rect', {
                        x: el.bx, y: capTop,
                        width: el.advw, height: TYPEFACE.capHeight * k,
                        fill: 'none', stroke: '#6fbf73', 'stroke-width': 0.16
                    }));
                    g.appendChild(create('line', {
                        x1: el.bx, y1: el.by, x2: el.bx + el.advw, y2: el.by,
                        stroke: '#ffa500', 'stroke-width': 0.2
                    }));
                    g.appendChild(create('line', {
                        x1: el.bx, y1: xTop, x2: el.bx + el.advw, y2: xTop,
                        stroke: '#d1b65b', 'stroke-width': 0.16, 'stroke-dasharray': '0.5 0.5'
                    }));
                }
            }
            svg.appendChild(g);
        }

        if (s.showSlots) {
            const g = create('g', {
                id: 'slot-codes', 'font-size': 2.6, fill: '#3d7fd9', 'font-family': 'monospace'
            });
            for (const el of legends) {
                const t = create('text', {
                    x: el.kind === 'txt' ? el.bx : el.x,
                    y: (el.kind === 'txt' ? el.by : el.y + el.h) + 3
                });
                t.textContent = el.slot;
                g.appendChild(t);
            }
            svg.appendChild(g);
        }

        if (s.showIndex) {
            const g = create('g', { id: 'labels', 'font-size': 4, fill: '#1c1f22', 'font-family': 'monospace' });
            for (const k of keys) {
                const t = create('text', { x: k.guide.x0, y: k.guide.y0 + 4 });
                t.textContent = `${k.row}·${widthInU(k.w, grid).toFixed(2)}`;
                g.appendChild(t);
            }
            svg.appendChild(g);
        }

        updateReadout(s, keys, grid, legends);
        updateLegendInspector(s, keys, grid, legends);
        syncCompensationMode(s);
    },

    onReady(readyApp) {
        installCleanExports(readyApp);

        document.getElementById('exportSvgBtn')?.addEventListener('click', () => readyApp.exportSVG());
        document.getElementById('exportPngBtn')?.addEventListener('click', () => readyApp.exportPNG());

        const syncSliders = (values) => {
            for (const [setting, value] of Object.entries(values)) {
                const id = SLIDER_BY_SETTING[setting];
                if (id) readyApp.sliders?.setValue(id, value, false);
            }
        };

        document.getElementById('resetGridBtn')?.addEventListener('click', () => {
            const values = { ...REF_MM };
            readyApp.settingsStore.setMultiple(values);
            syncSliders(values);
        });

        document.getElementById('resetTypeBtn')?.addEventListener('click', () => {
            const values = {
                ...TYPE_DEFAULTS,
                compensationMode: 'table'
            };
            readyApp.settingsStore.setMultiple(values);
            syncSliders(values);
        });

        document.getElementById('legendKeySelect')?.addEventListener('change', (e) => {
            selectKey(readyApp, Number(e.target.value) || 0);
        });

        document.querySelectorAll('#compModeGroup [data-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                readyApp.settingsStore.set('compensationMode', btn.dataset.mode);
            });
        });

        readyApp.dom?.surface?.addEventListener('click', (e) => {
            const key = keyAtClientPoint(readyApp.dom.surface, layoutFor(readyApp.settings).keys, e.clientX, e.clientY);
            if (key) selectKey(readyApp, key.i, { toggle: e.shiftKey || e.metaKey || e.ctrlKey });
            else if (!e.shiftKey) selectKey(readyApp, null);
        });

        document.addEventListener('keydown', (e) => {
            if (isTypingTarget(e.target)) return;
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) return;
            if (e.key === 'Escape') {
                selectKey(readyApp, null);
                e.preventDefault();
                return;
            }
            if (moveSelection(readyApp, e.key, { extend: e.shiftKey })) e.preventDefault();
        });

        document.getElementById('verifyBtn')?.addEventListener('click', async () => {
            try {
                const report = await buildVerificationReport(readyApp.settingsStore.toObject(), readyApp.settings);
                let html = '<h3 class="verify-h">Geometry</h3>' + reportHtml(report.geometry.raw);
                html += '<h3 class="verify-h">Legends</h3>' + (report.legends
                    ? legendsReportHtml(report.legends.raw)
                    : '<p>Typeface is still loading — nothing to verify yet.</p>');
                // alert() does not pass the html flag, so go through show().
                const result = await readyApp.dialog?.show({
                    title: 'Verify against reference',
                    text: html,
                    html: true,
                    buttons: [
                        { id: 'ok', text: 'Close', type: 'primary' },
                        { id: 'json', text: 'Download JSON', type: 'secondary' }
                    ]
                });
                if (result?.action === 'json') downloadJSON('keyboarder-verify-report.json', reportForExport(report));
            } catch (e) {
                readyApp.dialog?.alert({ title: 'Verification failed', text: e.message, okText: 'Close' });
            }
        });

        document.getElementById('aboutBtn')?.addEventListener('click', () => {
            readyApp.dialog?.alert({
                title: 'Keyboarder',
                text: 'Geometry is derived from a declarative row description: each row has one '
                    + 'key marked flex that takes the remaining block width, so widths do not '
                    + 'need to be hard-coded. In the UI, sizes are millimetres and type sizes '
                    + 'are pt; internally 1 px = 1 pt = 1/72″, and the reference column pitch '
                    + 'is exactly 19 mm.\n\n'
                    + 'Legends are placed by rules, not by coordinates from the drawing: the '
                    + 'safety guide is a coordinate system, a slot picks an anchor pair, and a '
                    + 'glyph at the guide edge is released outward by optical compensation — '
                    + 'computed from the contour edge shape, not from sidebearings. Verify '
                    + 'shows how close this matches LCAKB23.',
                okText: 'Close'
            });
        });

        // Эталон для подложки грузим заранее, чтобы тумблер срабатывал сразу.
        loadReference().then((r) => {
            REFERENCE = r;
            if (readyApp.settings.showRef) readyApp.render();
        }).catch(() => { /* подложка необязательна */ });

        // Гарнитура: путь с пробелом обязан быть URL-энкоден, папка называется Fonts с большой.
        loadTypeface('Fonts/YS%20Text/YS%20Text-Regular.ttf').then((tf) => {
            TYPEFACE = tf;
            COMP_CACHE = new Map();
            readyApp.render();
        }).catch((e) => {
            readyApp.dialog?.alert({
                title: 'Font failed to load',
                text: `${e.message}\n\nGeometry still works; legends will be missing.`,
                okText: 'Close'
            });
        });
    }
});

function html(v) {
    return String(v ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

function activeKey(keys) {
    const sel = normalizedSelection(keys);
    return sel.active == null ? null : keys[sel.active] || null;
}

function keyLabel(k) {
    const first = (k.elements || []).find((e) => e.kind === 'txt' || e.kind === 'ico');
    const mark = first ? (first.text || first.icon) : (k.tpl || 'blank');
    return `R${k.row + 1} ${k.block} · ${mark}`;
}

function syncLegendSelect(keys) {
    const select = document.getElementById('legendKeySelect');
    if (!select) return;
    const sig = keys.map((k) => `${k.row}:${k.block}:${k.tpl}:${keyLabel(k)}`).join('|');
    if (select.dataset.sig !== sig) {
        select.replaceChildren(...keys.map((k, i) => {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = keyLabel(k);
            return opt;
        }));
        select.dataset.sig = sig;
    }
    const sel = normalizedSelection(keys);
    select.value = sel.active == null ? '' : String(sel.active);
}

function syncCompensationMode(s) {
    document.querySelectorAll('#compModeGroup [data-mode]').forEach((btn) => {
        const active = btn.dataset.mode === (s.compensationMode || 'table');
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function normalizedSelection(keys) {
    const max = keys.length - 1;
    const indices = [...new Set((SELECTION.indices || [])
        .map((i) => Number(i))
        .filter((i) => Number.isInteger(i) && i >= 0 && i <= max))];
    let active = Number.isInteger(SELECTION.active) ? SELECTION.active : null;
    if (active < 0 || active > max) active = indices[0] ?? null;
    if (active == null && indices.length) active = indices[0];
    if (active != null && !indices.includes(active)) indices.push(active);
    indices.sort((a, b) => a - b);
    SELECTION = { active, indices };
    return SELECTION;
}

function selectedKeys(keys) {
    const sel = normalizedSelection(keys);
    return sel.indices.map((i) => keys[i]).filter(Boolean);
}

function selectKey(app, index, { toggle = false } = {}) {
    const keys = layoutFor(app.settings).keys;
    if (index == null || index < 0 || index >= keys.length) {
        SELECTION = { active: null, indices: [] };
        app.renderNow();
        return;
    }
    const current = new Set(normalizedSelection(keys).indices);
    if (toggle) {
        if (current.has(index)) current.delete(index);
        else current.add(index);
        if (!current.size) current.add(index);
    } else {
        current.clear();
        current.add(index);
    }
    SELECTION = { active: index, indices: [...current].sort((a, b) => a - b) };
    app.renderNow();
}

function installCleanExports(app) {
    if (app.__keyboarderCleanExports) return;
    for (const method of ['exportSVG', 'exportPNG']) {
        if (typeof app[method] !== 'function') continue;
        const original = app[method].bind(app);
        app[method] = async (...args) => {
            const previous = {
                active: SELECTION.active,
                indices: [...(SELECTION.indices || [])]
            };
            const hasSelection = previous.active != null || previous.indices.length > 0;
            if (!hasSelection) return original(...args);
            SELECTION = { active: null, indices: [] };
            app.renderNow();
            try {
                return await original(...args);
            } finally {
                SELECTION = previous;
                app.renderNow();
            }
        };
    }
    app.__keyboarderCleanExports = true;
}

function keyAtClientPoint(svg, keys, clientX, clientY) {
    if (!svg || !svg.createSVGPoint) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = point.matrixTransform(ctm.inverse());
    for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i];
        if (p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h) return k;
    }
    return null;
}

function renderSelection(create, keys, grid) {
    const chosen = selectedKeys(keys);
    if (!chosen.length) return null;
    const g = create('g', { id: 'selection', 'pointer-events': 'none', 'data-interactive': 'true' });
    for (const k of chosen) {
        const active = k.i === SELECTION.active;
        g.appendChild(create('rect', {
            x: k.x - 1.2, y: k.y - 1.2, width: k.w + 2.4, height: k.h + 2.4,
            rx: grid.cornerRadius + 1.2, ry: grid.cornerRadius + 1.2,
            fill: 'none',
            stroke: active ? '#ffffff' : '#b7c7ff',
            'stroke-width': active ? 1.2 : 0.75,
            'stroke-dasharray': active ? null : '3 1.6',
            'vector-effect': 'non-scaling-stroke'
        }));
    }
    return g;
}

function orderedKeys(keys) {
    return [...keys].sort((a, b) => (a.row - b.row) || (a.x - b.x));
}

function nearestInRow(rows, row, x) {
    const list = rows.get(row) || [];
    let best = null;
    for (const k of list) {
        const d = Math.abs(k.x + k.w / 2 - x);
        if (!best || d < best.d) best = { k, d };
    }
    return best && best.k;
}

function moveSelection(app, key, { extend = false } = {}) {
    const keys = layoutFor(app.settings).keys;
    const sel = normalizedSelection(keys);
    if (!keys.length || sel.active == null) return false;
    const active = keys[sel.active];
    const ordered = orderedKeys(keys);
    const pos = ordered.findIndex((k) => k.i === active.i);
    const rows = new Map();
    for (const k of ordered) {
        if (!rows.has(k.row)) rows.set(k.row, []);
        rows.get(k.row).push(k);
    }
    let next = null;
    if (key === 'ArrowLeft') next = ordered[Math.max(0, pos - 1)];
    if (key === 'ArrowRight') next = ordered[Math.min(ordered.length - 1, pos + 1)];
    if (key === 'ArrowUp') next = nearestInRow(rows, active.row - 1, active.x + active.w / 2) || active;
    if (key === 'ArrowDown') next = nearestInRow(rows, active.row + 1, active.x + active.w / 2) || active;
    if (!next || next.i === active.i) return false;
    selectKey(app, next.i, { toggle: extend });
    return true;
}

function isTypingTarget(target) {
    return !!target?.closest?.('input, textarea, select, button, [contenteditable="true"], dialog');
}

function rectCenter(r) {
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function diffStroke(worst) {
    if (worst <= GEOMETRY_TOLERANCE) return '#6fbf73';
    if (worst <= 0.05) return '#d1b65b';
    return '#d9736f';
}

function renderGeometryDiff(create, keys, grid, ref) {
    const report = compare(keys, ref);
    const g = create('g', { id: 'diff', 'pointer-events': 'none' });
    const used = new Set(report.rows.map((row) => row.mine));

    for (const row of report.rows) {
        const color = diffStroke(row.worst);
        g.appendChild(create('rect', {
            x: row.ref.x, y: row.ref.y, width: row.ref.w, height: row.ref.h,
            rx: grid.cornerRadius, ry: grid.cornerRadius,
            fill: 'none', stroke: '#ffa500', 'stroke-width': 0.28,
            'stroke-dasharray': '2 1.5', 'vector-effect': 'non-scaling-stroke'
        }));
        g.appendChild(create('rect', {
            x: row.mine.x, y: row.mine.y, width: row.mine.w, height: row.mine.h,
            rx: grid.cornerRadius, ry: grid.cornerRadius,
            fill: 'none', stroke: color,
            'stroke-width': row.worst <= GEOMETRY_TOLERANCE ? 0.35 : 0.85,
            'vector-effect': 'non-scaling-stroke'
        }));
        if (row.worst > GEOMETRY_TOLERANCE) {
            const a = rectCenter(row.ref);
            const b = rectCenter(row.mine);
            g.appendChild(create('line', {
                x1: a.x, y1: a.y, x2: b.x, y2: b.y,
                stroke: color, 'stroke-width': 0.35,
                'vector-effect': 'non-scaling-stroke'
            }));
        }
    }

    for (const extra of keys.filter((k) => !used.has(k))) {
        g.appendChild(create('rect', {
            x: extra.x, y: extra.y, width: extra.w, height: extra.h,
            rx: grid.cornerRadius, ry: grid.cornerRadius,
            fill: 'none', stroke: '#b36fff', 'stroke-width': 0.9,
            'stroke-dasharray': '3 1', 'vector-effect': 'non-scaling-stroke'
        }));
    }

    return g;
}

function compactGeometryReport(r) {
    const rowOf = (row) => ({
        row: row.ref.row,
        block: row.ref.block,
        label: row.ref.legend || row.ref.tpl || '',
        reference: { x: row.ref.x, y: row.ref.y, w: row.ref.w, h: row.ref.h },
        generated: { x: row.mine.x, y: row.mine.y, w: row.mine.w, h: row.mine.h },
        delta: row.d,
        worst: row.worst
    });
    return {
        pass: r.pass,
        count: r.count,
        refCount: r.refCount,
        tolerance: GEOMETRY_TOLERANCE,
        missing: r.missing,
        extra: r.extra,
        max: r.max,
        worstOverall: r.worstOverall,
        worst: r.worst.map(rowOf),
        rows: r.rows.map(rowOf)
    };
}

function compactLegendReport(r) {
    return {
        pass: r.pass,
        total: r.total,
        unmatched: r.unmatched,
        byClass: r.byClass,
        worst: r.worst,
        excused: r.excused
    };
}

async function buildVerificationReport(settingsSnapshot, settings) {
    const { keys, legends } = layoutFor(settings);
    const geometryRaw = compare(keys, await loadReference());
    const legendsRaw = TYPEFACE
        ? compareLegends(legends, (await loadLegendReference()).keys)
        : null;
    return {
        generatedAt: new Date().toISOString(),
        layout: LCAKB23.meta.name,
        settings: settingsSnapshot,
        typeface: TYPEFACE ? CONTENT.font : null,
        geometry: { raw: geometryRaw, export: compactGeometryReport(geometryRaw) },
        legends: legendsRaw ? { raw: legendsRaw, export: compactLegendReport(legendsRaw) } : null
    };
}

function reportForExport(report) {
    return {
        generatedAt: report.generatedAt,
        layout: report.layout,
        settings: report.settings,
        typeface: report.typeface,
        geometry: report.geometry.export,
        legends: report.legends ? report.legends.export : null
    };
}

function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function updateReadout(s, keys, grid, legends) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const { bounds } = layoutFor(s);
    set('statKeys', String(keys.length));
    set('statBoard', `${toMm(bounds.w).toFixed(1)} × ${toMm(bounds.h).toFixed(1)} mm`);
    set('statGap', `${toMm(gapOf(grid)).toFixed(2)} mm`);
    const txt = legends.filter((e) => e.kind === 'txt').length;
    set('statLegends', TYPEFACE
        ? `${txt} strings, ${legends.length - txt} icons`
        : 'loading font');
}

function compensationInfo(s, el) {
    const side = el.slot[1];
    if (!TYPEFACE || (side !== 'L' && side !== 'R')) return null;
    const chars = [...el.text].filter((c) => c !== ' ');
    if (!chars.length) return null;
    const ch = side === 'L' ? chars[0] : chars[chars.length - 1];
    const comp = compFor(s);
    if (!comp) return { ch, source: 'off', px: 0 };
    const ex = comp.explain(ch, side);
    return { ...ex, px: (ex.em * el.size) / 1000 };
}

function updateLegendInspector(s, keys, grid, legends) {
    syncLegendSelect(keys);
    const box = document.getElementById('legendInspector');
    if (!box) return;
    const sel = normalizedSelection(keys);
    const k = activeKey(keys);
    if (!k) {
        box.innerHTML = '<p class="inspector-empty">No key selected.</p>';
        return;
    }
    const items = legends.filter((el) => el.key === k);
    let out = '<dl class="legend-meta">'
        + `<div><dt>Selected</dt><dd>${sel.indices.length}</dd></div>`
        + `<div><dt>Template</dt><dd>${html(k.tpl || 'blank')}</dd></div>`
        + `<div><dt>Position</dt><dd>row ${k.row + 1}, ${html(k.block)}, ${widthInU(k.w, grid).toFixed(2)}U</dd></div>`
        + '</dl>';
    if (!TYPEFACE) {
        box.innerHTML = out + '<p class="inspector-empty">Font loading.</p>';
        return;
    }
    if (!items.length) {
        box.innerHTML = out + '<p class="inspector-empty">No legend elements.</p>';
        return;
    }
    out += '<table class="legend-elements"><tr><th>Slot</th><th>Element</th><th>Type</th><th>Comp</th></tr>';
    for (const el of items) {
        if (el.kind === 'txt') {
            const comp = compensationInfo(s, el);
            const compText = comp
                ? `${comp.source} ${comp.px.toFixed(3)}`
                : '—';
            out += '<tr>'
                + `<td>${html(el.slot)}</td>`
                + `<td>${html(el.text)}</td>`
                + `<td>${el.size.toFixed(3)} pt, ${(el.tracking || 0).toFixed(3)} em</td>`
                + `<td>${html(compText)}</td>`
                + '</tr>';
        } else {
            out += '<tr>'
                + `<td>${html(el.slot)}</td>`
                + `<td>${html(el.icon)}</td>`
                + `<td>${el.w.toFixed(2)} × ${el.h.toFixed(2)}</td>`
                + '<td>—</td>'
                + '</tr>';
        }
    }
    out += '</table>';
    box.innerHTML = out;
}

export default app;
