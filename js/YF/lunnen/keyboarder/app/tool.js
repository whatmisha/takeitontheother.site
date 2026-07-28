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
const MIN_KEY_WIDTH_MM = 4;
const MAX_KEY_WIDTH_MM = 80;

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

const PRESET_KEYS = [
    'colPitch', 'rowPitch', 'keyWidth1U', 'keyHeight', 'cornerRadius', 'guideInset',
    'glyphSize', 'numpadSize', 'secondarySize', 'wordSize', 'leading', 'trackingOffset',
    'compensationMode',
    'showCaps', 'showGuides', 'showGlyphs', 'showIcons', 'showColumns', 'showIndex',
    'showInk', 'showSlots', 'showRef', 'showDiff', 'showBlocks',
    'capColor', 'guideColor', 'inkColor', 'bgColor',
    'contentEdits', 'layoutEdits'
];

const TEMPLATE_VARIANTS = buildTemplateVariants(CONTENT);
const TEMPLATE_BY_ID = new Map(TEMPLATE_VARIANTS.map((v) => [v.id, v]));
const ICON_OPTIONS = Object.keys(ICONS).sort((a, b) => a.localeCompare(b));

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
let LAST_DELETED_EDIT_ID = null;

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
    compensationMode: s.compensationMode,
    contentEdits: s.contentEdits || {}
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
    const layoutEdits = sanitizeLayoutEdits(s.layoutEdits || {});
    const sig = JSON.stringify(g) + JSON.stringify(layoutEdits) + typeSigFrom(s) + (TYPEFACE ? '·tf' : '');
    if (cached.sig !== sig) {
        const editedLayout = layoutWithEdits(LCAKB23, layoutEdits, g);
        let renderLayout = editedLayout;
        let data;
        try {
            data = buildLayout(renderLayout, g);
        } catch (e) {
            console.warn('Keyboarder: layout edits were ignored because the row no longer fits.', e);
            renderLayout = LCAKB23;
            data = buildLayout(renderLayout, g);
        }
        assignEditIds(data.keys);
        annotateGeometry(data.keys, LCAKB23, renderLayout, g, layoutEdits);
        attachGuides(data.keys, g.guideInset);
        attachContent(data.keys, CONTENT);
        captureBaseContent(data.keys);
        applyContentEdits(data.keys, s.contentEdits || {});
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
        bgColor: '#808080',

        contentEdits: {},
        layoutEdits: {}
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
    collectPreset(app) {
        return normalizedPresetBlob(app.settingsStore.toObject(), app.settingsStore.getDefaults());
    },
    applyPreset(app, blob) {
        app.settingsStore.fromJSON(normalizedPresetBlob(blob, app.settingsStore.getDefaults()), true);
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
        updateKeyGeometryEditor(s, keys);
        updateLegendEditor(s, keys);
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
            const values = {
                ...REF_MM,
                layoutEdits: {},
                contentEdits: contentEditsWithoutAddedKeys(readyApp.settings.contentEdits || {})
            };
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
        document.getElementById('legendTemplateSelect')?.addEventListener('change', () => {
            refreshLegendTemplateDraft(readyApp);
        });
        document.getElementById('applyLegendEditBtn')?.addEventListener('click', () => {
            applyLegendEditor(readyApp);
        });
        document.getElementById('resetLegendEditBtn')?.addEventListener('click', () => {
            resetSelectedLegendEdits(readyApp);
        });
        document.getElementById('addLegendTextBtn')?.addEventListener('click', () => {
            addLegendElementDraft(readyApp, 'txt');
        });
        document.getElementById('addLegendIconBtn')?.addEventListener('click', () => {
            addLegendElementDraft(readyApp, 'ico');
        });
        document.getElementById('legendElementEditor')?.addEventListener('click', (e) => {
            const button = e.target.closest('.legend-remove-element-btn');
            if (!button) return;
            removeLegendElementDraft(readyApp, button);
            e.preventDefault();
        });
        document.getElementById('applyKeyWidthBtn')?.addEventListener('click', () => {
            applyKeyWidthEdit(readyApp);
        });
        document.getElementById('resetKeyWidthBtn')?.addEventListener('click', () => {
            resetKeyWidthEdit(readyApp);
        });
        document.getElementById('moveKeyLeftBtn')?.addEventListener('click', () => {
            moveActiveKeyInRow(readyApp, -1);
        });
        document.getElementById('moveKeyRightBtn')?.addEventListener('click', () => {
            moveActiveKeyInRow(readyApp, 1);
        });
        document.getElementById('addKeyBeforeBtn')?.addEventListener('click', () => {
            addKeyNearActive(readyApp, 'before');
        });
        document.getElementById('addKeyBtn')?.addEventListener('click', () => {
            addKeyNearActive(readyApp, 'after');
        });
        document.getElementById('deleteKeyBtn')?.addEventListener('click', () => {
            deleteActiveKey(readyApp);
        });
        document.getElementById('restoreKeyBtn')?.addEventListener('click', () => {
            restoreDeletedKey(readyApp);
        });
        document.getElementById('legendKeyWidthInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                applyKeyWidthEdit(readyApp);
                e.preventDefault();
            }
        });
        document.getElementById('legendEditor')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                applyLegendEditor(readyApp);
                e.preventDefault();
            }
        });

        document.querySelectorAll('#compModeGroup [data-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                readyApp.settingsStore.set('compensationMode', btn.dataset.mode);
            });
        });

        readyApp.dom?.surface?.addEventListener('click', (e) => {
            const key = keyAtClientPoint(readyApp.dom.surface, layoutFor(readyApp.settings).keys, e.clientX, e.clientY);
            if (key) {
                expandLegendPanel();
                selectKey(readyApp, key.i, { toggle: e.shiftKey || e.metaKey || e.ctrlKey });
            }
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

function clonePlain(v) {
    if (v === undefined) return undefined;
    return JSON.parse(JSON.stringify(v));
}

function normalizedPresetBlob(blob = {}, defaults = {}) {
    const source = blob || {};
    const clean = clonePlain(defaults);
    for (const key of PRESET_KEYS) {
        if (source[key] !== undefined) clean[key] = clonePlain(source[key]);
    }
    clean.contentEdits = sanitizeContentEdits(clean.contentEdits || {});
    clean.layoutEdits = sanitizeLayoutEdits(clean.layoutEdits || {});
    return clean;
}

function sanitizeLayoutEdits(edits = {}) {
    const out = {};
    if (!edits || typeof edits !== 'object') return out;
    for (const [id, edit] of Object.entries(edits)) {
        if (!edit || typeof edit !== 'object') continue;
        const clean = {};
        const order = Array.isArray(edit.order)
            ? [...new Set(edit.order.map((v) => String(v || '').trim()).filter(Boolean))]
            : [];
        if (order.length) clean.order = order;
        if (edit.added === true) {
            const after = String(edit.after || '').trim();
            const before = String(edit.before || '').trim();
            if (!after && !before) continue;
            clean.added = true;
            if (before) clean.before = before;
            else clean.after = after;
        }
        if (edit.deleted === true) clean.deleted = true;
        const widthMm = clamp(Number(edit.widthMm), MIN_KEY_WIDTH_MM, MAX_KEY_WIDTH_MM);
        if (Number.isFinite(widthMm)) clean.widthMm = roundMm(widthMm);
        if (Object.keys(clean).length) out[id] = clean;
    }
    return out;
}

function roundMm(value) {
    return Math.round(value * 1000) / 1000;
}

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return NaN;
    return Math.min(max, Math.max(min, value));
}

function expandedLayoutItems(items) {
    const out = [];
    for (const it of items || []) {
        const n = it.repeat || 1;
        for (let i = 0; i < n; i++) {
            const copy = { ...it };
            delete copy.repeat;
            if (n > 1) delete copy.id;
            out.push(copy);
        }
    }
    return out;
}

function rowSpecEntries(rowIndex, blockId, items) {
    const list = expandedLayoutItems(items);
    const rowHasFlex = list.some((it) => !it.skip && it.flex);
    let ordinal = 0;
    return list.map((it, index) => {
        if (it.skip) return { item: it, index, editId: null, rowHasFlex };
        const editId = it.editId || `${rowIndex}:${blockId}:${ordinal}`;
        ordinal++;
        return {
            item: it,
            index,
            editId,
            rowHasFlex
        };
    });
}

function rowBlockFromEditId(editId) {
    const parts = String(editId || '').split(':');
    if (parts.length >= 3 && parts[0] === 'add') {
        return { row: Number(parts[1]), block: parts[2] || '' };
    }
    return { row: Number(parts[0]), block: parts[1] || '' };
}

function rowOrderEditId(rowIndex, blockId) {
    return `order:${rowIndex}:${blockId || ''}`;
}

function rowOrderFromEdits(edits, rowIndex, blockId) {
    return edits[rowOrderEditId(rowIndex, blockId)]?.order || [];
}

function addedOrdinal(editId) {
    const parts = String(editId || '').split(':');
    const n = parts[0] === 'add' ? Number(parts[3]) : NaN;
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function insertionMapForRow(edits, rowIndex, blockId) {
    const before = new Map();
    const after = new Map();
    for (const [id, edit] of Object.entries(edits)) {
        if (!edit?.added || edit.deleted) continue;
        const at = rowBlockFromEditId(id);
        if (at.row !== rowIndex || at.block !== blockId) continue;
        const target = edit.before ? before : after;
        const anchor = edit.before || edit.after;
        if (!anchor) continue;
        if (!target.has(anchor)) target.set(anchor, []);
        target.get(anchor).push({ id, edit });
    }
    for (const list of [...before.values(), ...after.values()]) {
        list.sort((a, b) => addedOrdinal(a.id) - addedOrdinal(b.id) || a.id.localeCompare(b.id));
    }
    return { before, after };
}

function insertedKeyItem(id, edit) {
    const next = { editId: id };
    if (Number.isFinite(edit.widthMm)) next.w = toPx(edit.widthMm);
    else next.u = 1;
    return next;
}

function applyRowOrder(items, order) {
    if (!order.length) return { items, changed: false };
    const rank = new Map(order.map((id, i) => [id, i]));
    const out = [];
    let changed = false;
    let segment = [];

    const flush = () => {
        if (!segment.length) return;
        const byId = new Map(segment.map((it) => [it.editId, it]));
        const seen = new Set();
        const ordered = [];
        for (const id of order) {
            const item = byId.get(id);
            if (!item) continue;
            ordered.push(item);
            seen.add(id);
        }
        for (const item of segment) {
            if (!seen.has(item.editId)) ordered.push(item);
        }
        if (ordered.some((it, i) => it !== segment[i])) changed = true;
        out.push(...ordered);
        segment = [];
    };

    for (const item of items) {
        if (item.skip) {
            flush();
            out.push(item);
        } else {
            segment.push(item);
        }
    }
    flush();
    return { items: out, changed };
}

function chooseFlexTarget(entries, sourceIndex, edits) {
    const candidates = entries.filter((entry) =>
        entry.editId && entry.index !== sourceIndex && !entry.item.skip && !edits[entry.editId]?.deleted);
    const unedited = candidates.filter((entry) => !edits[entry.editId]?.widthMm);
    const pool = unedited.length ? unedited : candidates;
    const right = pool
        .filter((entry) => entry.index > sourceIndex)
        .sort((a, b) => a.index - b.index)[0];
    if (right) return right;
    return pool
        .filter((entry) => entry.index < sourceIndex)
        .sort((a, b) => b.index - a.index)[0] || null;
}

function layoutWithEdits(layout, edits, grid) {
    const clean = sanitizeLayoutEdits(edits);
    if (!Object.keys(clean).length) return layout;

    let applied = false;
    const rows = layout.rows.map((row, rowIndex) => {
        const nextRow = {};
        for (const [blockId, items] of Object.entries(row)) {
            const entries = rowSpecEntries(rowIndex, blockId, items);
            const insertions = insertionMapForRow(clean, rowIndex, blockId);
            const sourceFlex = entries.find((entry) => entry.editId && entry.item.flex);
            const sourceFlexEdit = sourceFlex ? clean[sourceFlex.editId] : null;
            const flexTarget = sourceFlexEdit
                ? chooseFlexTarget(entries, sourceFlex.index, clean)
                : null;
            let blockChanged = false;
            const expandedItems = entries.flatMap(({ item: it, editId, index }) => {
                const insertedBefore = (insertions.before.get(editId) || [])
                    .map(({ id, edit }) => insertedKeyItem(id, edit));
                const insertedAfter = (insertions.after.get(editId) || [])
                    .map(({ id, edit }) => insertedKeyItem(id, edit));
                if (insertedBefore.length || insertedAfter.length) {
                    blockChanged = true;
                    applied = true;
                }
                if (it.skip) return { ...it };
                const edit = clean[editId];
                if (edit?.deleted) {
                    blockChanged = true;
                    applied = true;
                    return [...insertedBefore, ...insertedAfter];
                }
                let item;
                if (flexTarget && index === flexTarget.index) {
                    blockChanged = true;
                    applied = true;
                    item = { ...it, editId, flex: true };
                    delete item.u;
                    delete item.w;
                } else if (!edit || edit.added) {
                    item = { ...it, editId };
                } else if (it.flex && !flexTarget) {
                    item = { ...it, editId };
                } else {
                    blockChanged = true;
                    applied = true;
                    item = { ...it, editId, w: toPx(edit.widthMm) };
                    delete item.u;
                    delete item.flex;
                }
                return [...insertedBefore, item, ...insertedAfter];
            }).filter(Boolean);
            const ordered = applyRowOrder(expandedItems, rowOrderFromEdits(clean, rowIndex, blockId));
            if (ordered.changed) {
                blockChanged = true;
                applied = true;
            }
            const nextItems = ordered.items;
            nextRow[blockId] = blockChanged ? nextItems : items;
        }
        return nextRow;
    });

    return applied ? { ...layout, rows } : layout;
}

function geometrySpecMap(layout) {
    const byId = new Map();
    layout.rows.forEach((row, rowIndex) => {
        for (const [blockId, items] of Object.entries(row)) {
            for (const entry of rowSpecEntries(rowIndex, blockId, items)) {
                if (!entry.editId) continue;
                byId.set(entry.editId, {
                    flex: !!entry.item.flex,
                    rowHasFlex: entry.rowHasFlex,
                    itemIndex: entry.index
                });
            }
        }
    });
    return byId;
}

function sourceGeometryMap(layout, grid) {
    const base = buildLayout(layout, grid);
    assignEditIds(base.keys);
    const byId = new Map(base.keys.map((k) => [k.editId, {
        baseWidthMm: toMm(k.w),
        sourceFlex: false,
        rowHasFlex: false
    }]));

    for (const [editId, spec] of geometrySpecMap(layout)) {
        const info = byId.get(editId) || {};
        info.sourceFlex = !!spec.flex;
        info.rowHasFlex = !!spec.rowHasFlex;
        byId.set(editId, info);
    }

    return byId;
}

function annotateGeometry(keys, sourceLayout, currentLayout, grid, edits) {
    const source = sourceGeometryMap(sourceLayout, grid);
    const current = geometrySpecMap(currentLayout);
    const clean = sanitizeLayoutEdits(edits);
    const flexByRowBlock = new Map();

    for (const k of keys) {
        if (current.get(k.editId)?.flex) flexByRowBlock.set(rowBlockKey(k), k);
    }

    for (const k of keys) {
        const info = source.get(k.editId) || {};
        const currentInfo = current.get(k.editId) || {};
        const range = { min: MIN_KEY_WIDTH_MM, max: MAX_KEY_WIDTH_MM };
        const flex = flexByRowBlock.get(rowBlockKey(k));
        if (currentInfo.rowHasFlex && flex && flex.editId !== k.editId) {
            const max = toMm(k.w + flex.w - toPx(MIN_KEY_WIDTH_MM));
            range.max = Math.min(MAX_KEY_WIDTH_MM, Math.max(MIN_KEY_WIDTH_MM, max));
        }
        k.geometry = {
            baseWidthMm: Number.isFinite(info.baseWidthMm) ? info.baseWidthMm : toMm(k.w),
            sourceFlex: !!info.sourceFlex,
            currentFlex: !!currentInfo.flex,
            rowHasFlex: !!currentInfo.rowHasFlex,
            widthEditable: !currentInfo.flex || !!info.sourceFlex,
            widthEdited: !!clean[k.editId]?.widthMm,
            widthRange: range
        };
    }
}

function cleanOffset(offset) {
    if (!offset || typeof offset !== 'object') return null;
    const out = {};
    for (const key of ['x', 'y', 'bx', 'by']) {
        const value = Number(offset[key]);
        if (Number.isFinite(value) && value !== 0) out[key] = value;
    }
    return Object.keys(out).length ? out : null;
}

function cleanCompOverride(compOverride) {
    if (!compOverride || typeof compOverride !== 'object') return null;
    const px = Number(compOverride.px);
    return Number.isFinite(px) ? { px } : null;
}

function cleanElement(el = {}) {
    const slot = String(el.slot || 'BC').trim() || 'BC';
    const kind = el.kind === 'ico' ? 'ico' : 'txt';
    const out = { slot, kind };
    if (kind === 'ico') {
        out.icon = String(el.icon || ICON_OPTIONS[0] || '').trim();
        out.w = finiteOr(el.w, 8);
        out.h = finiteOr(el.h, 8);
    } else {
        out.text = String(el.text ?? '');
        out.size = finiteOr(el.size, TYPE_DEFAULTS.wordSize);
        const tracking = finiteOr(el.tracking, 0);
        if (tracking !== 0) out.tracking = tracking;
        const compOverride = cleanCompOverride(el.compOverride);
        if (compOverride) out.compOverride = compOverride;
    }
    const offset = cleanOffset(el.offset);
    if (offset) out.offset = offset;
    return out;
}

function cleanElements(elements = []) {
    return (Array.isArray(elements) ? elements : []).map(cleanElement);
}

function sanitizeContentEdits(edits = {}) {
    const out = {};
    if (!edits || typeof edits !== 'object') return out;
    for (const [id, edit] of Object.entries(edits)) {
        if (!edit || typeof edit !== 'object') continue;
        out[id] = {
            tpl: String(edit.tpl || 'blank'),
            elements: cleanElements(edit.elements)
        };
    }
    return out;
}

function contentEditsWithoutAddedKeys(edits = {}) {
    const clean = sanitizeContentEdits(edits);
    for (const id of Object.keys(clean)) {
        if (isAddedEditId(id)) delete clean[id];
    }
    return clean;
}

function finiteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function rowBlockKey(k) {
    return `${k.row}:${k.block || ''}`;
}

function assignEditIds(keys) {
    const groups = new Map();
    for (const k of keys) {
        if (k.editId) continue;
        const id = rowBlockKey(k);
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(k);
    }
    for (const group of groups.values()) {
        group.sort((a, b) => a.x - b.x);
        group.forEach((k, ordinal) => {
            k.editId = `${k.row}:${k.block || ''}:${ordinal}`;
        });
    }
}

function captureBaseContent(keys) {
    for (const k of keys) {
        k.baseContent = {
            tpl: k.tpl || 'blank',
            elements: cleanElements(k.elements || [])
        };
    }
}

function applyContentEdits(keys, edits) {
    const clean = sanitizeContentEdits(edits);
    for (const k of keys) {
        const edit = clean[k.editId];
        if (!edit) continue;
        k.tpl = edit.tpl || 'blank';
        k.elements = cleanElements(edit.elements);
        k.content = {
            ...(k.content || {}),
            row: k.row,
            x: k.x,
            block: k.block,
            tpl: k.tpl,
            elements: cleanElements(k.elements)
        };
        k.edited = true;
    }
}

function sourceElements(k) {
    return cleanElements(k?.content?.elements || k?.elements || []);
}

function contentEquals(a, b) {
    return JSON.stringify({
        tpl: a?.tpl || 'blank',
        elements: cleanElements(a?.elements || [])
    }) === JSON.stringify({
        tpl: b?.tpl || 'blank',
        elements: cleanElements(b?.elements || [])
    });
}

function writeContentEdit(edits, k, tpl, elements) {
    const payload = { tpl: tpl || 'blank', elements: cleanElements(elements) };
    if (contentEquals(payload, k.baseContent)) delete edits[k.editId];
    else edits[k.editId] = payload;
}

function elementSignature(elements = []) {
    const parts = cleanElements(elements).map((el) => `${el.slot}:${el.kind}`);
    return parts.length ? parts.join('|') : 'blank';
}

function templateVariantId(tpl, elements = []) {
    return `${tpl || 'blank'}::${elementSignature(elements)}`;
}

function templateVariantLabel(v) {
    const slots = v.elements.map((el) => el.slot).join(' / ');
    return slots ? `${v.tpl} · ${slots}` : v.tpl;
}

function buildTemplateVariants(content) {
    const byId = new Map();
    for (const key of content.keys || []) {
        const tpl = key.tpl || 'blank';
        const elements = cleanElements(key.elements || []);
        const id = templateVariantId(tpl, elements);
        if (!byId.has(id)) {
            byId.set(id, { id, tpl, elements, count: 0 });
        }
        byId.get(id).count++;
    }
    return [...byId.values()].sort((a, b) =>
        a.tpl.localeCompare(b.tpl) || elementSignature(a.elements).localeCompare(elementSignature(b.elements)));
}

function variantForKey(k) {
    return templateVariantId(k.tpl || 'blank', sourceElements(k));
}

function retargetElements(source, pattern) {
    const from = cleanElements(source);
    const pools = {
        txt: from.filter((el) => el.kind === 'txt'),
        ico: from.filter((el) => el.kind === 'ico')
    };
    const fallbackByKind = { txt: 0, ico: 0 };
    return cleanElements(pattern).map((sample, index) => {
        const match = pools[sample.kind].shift() || from[index] || {};
        const next = { ...sample };
        if (sample.kind === 'ico') {
            next.icon = match.icon || sample.icon || ICON_OPTIONS[0] || '';
            next.w = finiteOr(match.w, sample.w || 8);
            next.h = finiteOr(match.h, sample.h || 8);
        } else {
            next.text = match.text ?? sample.text ?? '';
            next.size = finiteOr(match.size, sample.size || TYPE_DEFAULTS.wordSize);
            const tracking = finiteOr(match.tracking, finiteOr(sample.tracking, 0));
            delete next.tracking;
            if (tracking !== 0) next.tracking = tracking;
        }
        if (!next.text && sample.kind === 'txt' && fallbackByKind.txt++ > 0) next.text = '';
        if (!next.icon && sample.kind === 'ico' && fallbackByKind.ico++ > 0) next.icon = ICON_OPTIONS[0] || '';
        return cleanElement(next);
    });
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

function syncTemplateSelect(keys) {
    const select = document.getElementById('legendTemplateSelect');
    if (!select) return;
    const chosen = selectedKeys(keys);
    const active = activeKey(keys);
    const ids = chosen.map(variantForKey);
    const common = ids.length && ids.every((id) => id === ids[0]) ? ids[0] : '';
    const current = active ? variantForKey(active) : '';
    const custom = current && !TEMPLATE_BY_ID.has(current)
        ? { id: current, tpl: active.tpl || 'custom', elements: sourceElements(active), custom: true }
        : null;
    const sig = `${common}|${current}|${custom ? elementSignature(custom.elements) : ''}`;
    if (select.dataset.sig !== sig) {
        const opts = [];
        if (!chosen.length) opts.push(optionEl('', 'No key selected'));
        else if (!common) opts.push(optionEl('', 'Mixed'));
        for (const v of TEMPLATE_VARIANTS) opts.push(optionEl(v.id, templateVariantLabel(v)));
        if (custom) opts.push(optionEl(custom.id, `${custom.tpl} · custom`));
        select.replaceChildren(...opts);
        select.dataset.sig = sig;
    }
    select.disabled = !chosen.length;
    select.value = common || '';
}

function optionEl(value, label) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    return opt;
}

function updateKeyGeometryEditor(s, keys) {
    const editor = document.getElementById('legendGeometryEditor');
    const input = document.getElementById('legendKeyWidthInput');
    const apply = document.getElementById('applyKeyWidthBtn');
    const reset = document.getElementById('resetKeyWidthBtn');
    const moveLeftButton = document.getElementById('moveKeyLeftBtn');
    const moveRightButton = document.getElementById('moveKeyRightBtn');
    const deleteButton = document.getElementById('deleteKeyBtn');
    const restoreButton = document.getElementById('restoreKeyBtn');
    if (!editor || !input) return;

    const active = activeKey(keys);
    const edits = sanitizeLayoutEdits(s.layoutEdits || {});
    const restoreId = restoreTargetEditId(edits);
    const editable = !!active?.geometry?.widthEditable;
    const range = active?.geometry?.widthRange || { min: MIN_KEY_WIDTH_MM, max: MAX_KEY_WIDTH_MM };
    const value = active ? toMm(active.w).toFixed(3) : '';
    const editId = active?.editId || '';

    editor.classList.toggle('is-locked', !!active && !editable);
    input.disabled = !editable;
    input.min = String(roundMm(range.min));
    input.max = String(roundMm(range.max));
    input.dataset.editId = editId;
    input.title = active && !editable ? 'Flex key: width is derived from the remaining row space.' : '';
    if (document.activeElement !== input || input.dataset.valueEditId !== editId) {
        input.value = value;
        input.dataset.valueEditId = editId;
    }
    if (apply) apply.disabled = !editable;
    if (reset) reset.disabled = !active || !Number.isFinite(edits[editId]?.widthMm);
    const addBeforeButton = document.getElementById('addKeyBeforeBtn');
    const addAfterButton = document.getElementById('addKeyBtn');
    if (deleteButton) {
        deleteButton.disabled = !active;
        deleteButton.title = active ? `Delete ${keyLabel(active)}` : '';
    }
    if (moveLeftButton) {
        const canMoveLeft = canMoveKeyInRow(s, keys, active, -1);
        moveLeftButton.disabled = !canMoveLeft;
        moveLeftButton.title = canMoveLeft ? `Move ${keyLabel(active)} left` : '';
    }
    if (moveRightButton) {
        const canMoveRight = canMoveKeyInRow(s, keys, active, 1);
        moveRightButton.disabled = !canMoveRight;
        moveRightButton.title = canMoveRight ? `Move ${keyLabel(active)} right` : '';
    }
    if (addBeforeButton || addAfterButton) {
        const canAddBefore = canAddKeyNear(s, active, 'before');
        const canAddAfter = canAddKeyNear(s, active, 'after');
        if (addBeforeButton) {
            addBeforeButton.disabled = !canAddBefore;
            addBeforeButton.title = canAddBefore ? `Add key before ${keyLabel(active)}` : '';
        }
        if (addAfterButton) {
            addAfterButton.disabled = !canAddAfter;
            addAfterButton.title = canAddAfter ? `Add key after ${keyLabel(active)}` : '';
        }
    }
    if (restoreButton) {
        restoreButton.disabled = !restoreId;
        restoreButton.title = restoreId ? `Restore ${editIdLabel(restoreId)}` : '';
    }
}

function writeKeyWidthEdit(edits, k, widthMm) {
    const edit = { ...(edits[k.editId] || {}) };
    const base = k.geometry?.baseWidthMm;
    if (Number.isFinite(base) && Math.abs(widthMm - base) < 0.0005) delete edit.widthMm;
    else edit.widthMm = roundMm(widthMm);
    if (Object.keys(edit).length) edits[k.editId] = edit;
    else delete edits[k.editId];
}

function applyKeyWidthEdit(app) {
    const input = document.getElementById('legendKeyWidthInput');
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    if (!input || !active?.geometry?.widthEditable) return;
    const range = active.geometry.widthRange || { min: MIN_KEY_WIDTH_MM, max: MAX_KEY_WIDTH_MM };
    const widthMm = clamp(Number(input.value), range.min, range.max);
    if (!Number.isFinite(widthMm)) return;
    input.value = widthMm.toFixed(3);
    const next = sanitizeLayoutEdits(app.settings.layoutEdits || {});
    writeKeyWidthEdit(next, active, widthMm);
    app.settingsStore.set('layoutEdits', next);
}

function resetKeyWidthEdit(app) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    if (!active) return;
    const next = sanitizeLayoutEdits(app.settings.layoutEdits || {});
    if (!next[active.editId]) return;
    delete next[active.editId].widthMm;
    if (!Object.keys(next[active.editId]).length) delete next[active.editId];
    app.settingsStore.set('layoutEdits', next);
}

function isAddedEditId(editId) {
    return String(editId || '').startsWith('add:');
}

function nextAddedKeyId(edits, k) {
    const prefix = `add:${k.row}:${k.block || ''}:`;
    let n = 1;
    while (edits[`${prefix}${n}`]) n++;
    return `${prefix}${n}`;
}

function selectKeyByEditId(app, editId) {
    const keys = layoutFor(app.settings).keys;
    const index = keys.findIndex((k) => k.editId === editId);
    if (index >= 0) selectKey(app, index);
}

function proposedAddKeyEdits(edits, k, side = 'after') {
    const next = sanitizeLayoutEdits(edits);
    const id = nextAddedKeyId(next, k);
    next[id] = side === 'before'
        ? { added: true, before: k.editId }
        : { added: true, after: k.editId };
    return { id, edits: next };
}

function layoutEditsFit(settings, edits) {
    try {
        const layout = layoutWithEdits(LCAKB23, edits, gridFrom(settings));
        const { keys } = buildLayout(layout, gridFrom(settings));
        return keys.every((k) => toMm(k.w) >= MIN_KEY_WIDTH_MM - 0.0005);
    } catch (_) {
        return false;
    }
}

function canAddKeyNear(settings, active, side = 'after') {
    if (!active?.geometry?.rowHasFlex || isAddedEditId(active.editId)) return false;
    const { edits } = proposedAddKeyEdits(settings.layoutEdits || {}, active, side);
    return layoutEditsFit(settings, edits);
}

function rowBlockKeys(keys, active) {
    if (!active) return [];
    return keys
        .filter((k) => k.row === active.row && (k.block || '') === (active.block || ''))
        .sort((a, b) => (a.x - b.x) || (a.i - b.i));
}

function proposedMoveKeyEdits(edits, keys, active, direction) {
    if (!active || !active.editId || ![-1, 1].includes(direction)) return null;
    const group = rowBlockKeys(keys, active);
    const pos = group.findIndex((k) => k.editId === active.editId);
    const nextPos = pos + direction;
    if (pos < 0 || nextPos < 0 || nextPos >= group.length) return null;
    const order = group.map((k) => k.editId);
    [order[pos], order[nextPos]] = [order[nextPos], order[pos]];
    const next = sanitizeLayoutEdits(edits);
    next[rowOrderEditId(active.row, active.block || '')] = { order };
    return { edits: next, editId: active.editId };
}

function canMoveKeyInRow(settings, keys, active, direction) {
    const proposed = proposedMoveKeyEdits(settings.layoutEdits || {}, keys, active, direction);
    return !!proposed && layoutEditsFit(settings, proposed.edits);
}

function moveActiveKeyInRow(app, direction) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    const proposed = proposedMoveKeyEdits(app.settings.layoutEdits || {}, keys, active, direction);
    if (!proposed || !layoutEditsFit(app.settings, proposed.edits)) return;
    app.settingsStore.set('layoutEdits', proposed.edits);
    setTimeout(() => selectKeyByEditId(app, proposed.editId), 0);
}

function addKeyNearActive(app, side = 'after') {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    if (!canAddKeyNear(app.settings, active, side)) return;
    const { id, edits } = proposedAddKeyEdits(app.settings.layoutEdits || {}, active, side);
    app.settingsStore.set('layoutEdits', edits);
    setTimeout(() => selectKeyByEditId(app, id), 0);
}

function deletedEditIds(edits) {
    const clean = sanitizeLayoutEdits(edits);
    return Object.keys(clean).filter((id) => clean[id]?.deleted);
}

function restoreTargetEditId(edits) {
    const ids = deletedEditIds(edits);
    if (LAST_DELETED_EDIT_ID && ids.includes(LAST_DELETED_EDIT_ID)) return LAST_DELETED_EDIT_ID;
    return ids[ids.length - 1] || null;
}

function editIdLabel(editId) {
    const parts = String(editId || '').split(':');
    if (parts[0] === 'add') {
        const row = Number(parts[1]);
        const ordinal = Number(parts[3]);
        const rowLabel = Number.isFinite(row) ? `R${row + 1}` : 'R?';
        const ordinalLabel = Number.isFinite(ordinal) ? `#${ordinal}` : '#?';
        return `${rowLabel} ${parts[2] || '?'} added ${ordinalLabel}`;
    }
    const [row, block, ordinal] = parts;
    const rowLabel = Number.isFinite(Number(row)) ? `R${Number(row) + 1}` : 'R?';
    const ordinalLabel = Number.isFinite(Number(ordinal)) ? `#${Number(ordinal) + 1}` : '#?';
    return `${rowLabel} ${block || '?'} ${ordinalLabel}`;
}

function deleteActiveKey(app) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    if (!active) return;
    const next = sanitizeLayoutEdits(app.settings.layoutEdits || {});
    next[active.editId] = { ...(next[active.editId] || {}), deleted: true };
    LAST_DELETED_EDIT_ID = active.editId;
    app.settingsStore.set('layoutEdits', next);
}

function restoreDeletedKey(app) {
    const next = sanitizeLayoutEdits(app.settings.layoutEdits || {});
    const editId = restoreTargetEditId(next);
    if (!editId || !next[editId]) return;
    delete next[editId].deleted;
    if (!Object.keys(next[editId]).length) delete next[editId];
    if (LAST_DELETED_EDIT_ID === editId) LAST_DELETED_EDIT_ID = null;
    app.settingsStore.set('layoutEdits', next);
}

function updateLegendEditor(s, keys) {
    syncTemplateSelect(keys);
    const editor = document.getElementById('legendElementEditor');
    const apply = document.getElementById('applyLegendEditBtn');
    const reset = document.getElementById('resetLegendEditBtn');
    const addText = document.getElementById('addLegendTextBtn');
    const addIcon = document.getElementById('addLegendIconBtn');
    if (!editor) return;
    const active = activeKey(keys);
    const selected = selectedKeys(keys);
    if (apply) apply.disabled = !selected.length;
    if (reset) reset.disabled = !selected.some((k) => !!s.contentEdits?.[k.editId]);
    if (addText) addText.disabled = !active;
    if (addIcon) addIcon.disabled = !active;
    if (!active) {
        renderElementEditor([], { disabled: true, sig: 'none' });
        return;
    }
    const elements = sourceElements(active);
    const sig = `${active.editId}|${active.tpl}|${JSON.stringify(elements)}`;
    renderElementEditor(elements, { disabled: false, sig, templateId: variantForKey(active) });
}

function renderElementEditor(elements, { disabled = false, sig = null, templateId = '' } = {}) {
    const editor = document.getElementById('legendElementEditor');
    if (!editor) return;
    const nextSig = sig || JSON.stringify({ disabled, elements });
    if (editor.dataset.sig === nextSig) return;
    editor.dataset.sig = nextSig;
    editor.dataset.templateId = templateId;
    if (disabled) {
        editor.innerHTML = '<p class="inspector-empty">No editable key.</p>';
        return;
    }
    if (!elements.length) {
        editor.innerHTML = '<p class="inspector-empty">No legend elements.</p>';
        return;
    }
    editor.innerHTML = elements.map((el, i) => elementEditorHtml(el, i)).join('');
}

function elementEditorHtml(el, i) {
    const offset = html(JSON.stringify(cleanOffset(el.offset) || {}));
    const remove = '<button type="button" class="btn-inline legend-remove-element-btn">Remove</button>';
    if (el.kind === 'ico') {
        const options = ICON_OPTIONS.map((name) =>
            `<option value="${html(name)}"${name === el.icon ? ' selected' : ''}>${html(name)}</option>`).join('');
        return '<div class="legend-edit-row" data-kind="ico" data-offset="' + offset + '">'
            + `<label><span>Slot</span><input class="legend-slot-input" value="${html(el.slot)}" maxlength="2"></label>`
            + `<label><span>Icon</span><select class="legend-icon-input">${options}</select></label>`
            + `<label><span>W</span><input class="legend-width-input" type="number" step="0.001" value="${html(el.w)}"></label>`
            + `<label><span>H</span><input class="legend-height-input" type="number" step="0.001" value="${html(el.h)}"></label>`
            + remove
            + '</div>';
    }
    const compValue = Number.isFinite(el.compOverride?.px) ? String(el.compOverride.px) : '';
    return '<div class="legend-edit-row" data-kind="txt" data-offset="' + offset + '">'
        + `<label><span>Slot</span><input class="legend-slot-input" value="${html(el.slot)}" maxlength="2"></label>`
        + `<label><span>Text</span><input class="legend-text-input" value="${html(el.text)}"></label>`
        + `<label><span>Size</span><input class="legend-size-input" type="number" step="0.001" value="${html(el.size)}"></label>`
        + `<label><span>Track</span><input class="legend-track-input" type="number" step="0.001" value="${html(el.tracking || 0)}"></label>`
        + `<label><span>Comp</span><input class="legend-comp-input" type="number" step="0.001" value="${html(compValue)}"></label>`
        + remove
        + '</div>';
}

function defaultLegendElement(kind) {
    if (kind === 'ico') {
        return cleanElement({
            slot: 'FC',
            kind: 'ico',
            icon: ICON_OPTIONS[0] || '',
            w: 8,
            h: 8
        });
    }
    return cleanElement({
        slot: 'BC',
        kind: 'txt',
        text: '',
        size: TYPE_DEFAULTS.wordSize,
        tracking: 0
    });
}

function renderLegendDraft(app, elements) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    if (!active) return;
    const editor = document.getElementById('legendElementEditor');
    const templateId = editor?.dataset.templateId || variantForKey(active);
    renderElementEditor(elements, {
        disabled: false,
        sig: `draft:manual:${active.editId}:${JSON.stringify(elements)}`,
        templateId
    });
}

function addLegendElementDraft(app, kind) {
    const keys = layoutFor(app.settings).keys;
    if (!activeKey(keys)) return;
    const elements = readElementEditorElements();
    elements.push(defaultLegendElement(kind));
    renderLegendDraft(app, elements);
}

function removeLegendElementDraft(app, button) {
    const row = button.closest('.legend-edit-row');
    if (!row) return;
    row.remove();
    renderLegendDraft(app, readElementEditorElements());
}

function refreshLegendTemplateDraft(app) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    if (!active) return;
    const select = document.getElementById('legendTemplateSelect');
    const variant = TEMPLATE_BY_ID.get(select?.value || '');
    const elements = variant ? retargetElements(sourceElements(active), variant.elements) : sourceElements(active);
    renderElementEditor(elements, {
        disabled: false,
        sig: `draft:${active.editId}:${select?.value || ''}:${JSON.stringify(elements)}`,
        templateId: select?.value || variantForKey(active)
    });
}

function readElementEditorElements() {
    const rows = [...document.querySelectorAll('#legendElementEditor .legend-edit-row')];
    return rows.map((row) => {
        let offset = {};
        try { offset = JSON.parse(row.dataset.offset || '{}'); } catch (_) { offset = {}; }
        const base = {
            slot: row.querySelector('.legend-slot-input')?.value || 'BC',
            kind: row.dataset.kind === 'ico' ? 'ico' : 'txt',
            offset
        };
        if (base.kind === 'ico') {
            return cleanElement({
                ...base,
                icon: row.querySelector('.legend-icon-input')?.value || ICON_OPTIONS[0] || '',
                w: row.querySelector('.legend-width-input')?.value,
                h: row.querySelector('.legend-height-input')?.value
            });
        }
        return cleanElement({
            ...base,
            text: row.querySelector('.legend-text-input')?.value || '',
            size: row.querySelector('.legend-size-input')?.value,
            tracking: row.querySelector('.legend-track-input')?.value,
            compOverride: (() => {
                const raw = row.querySelector('.legend-comp-input')?.value;
                return raw === '' || raw == null ? null : { px: raw };
            })()
        });
    });
}

function applyLegendEditor(app) {
    const keys = layoutFor(app.settings).keys;
    const selected = selectedKeys(keys);
    const active = activeKey(keys);
    if (!selected.length) return;
    const select = document.getElementById('legendTemplateSelect');
    const variant = TEMPLATE_BY_ID.get(select?.value || '');
    const editedElements = active ? readElementEditorElements() : null;
    const editorTemplateId = document.getElementById('legendElementEditor')?.dataset.templateId || '';
    const next = sanitizeContentEdits(app.settings.contentEdits || {});

    for (const k of selected) {
        let tpl = k.tpl || 'blank';
        let elements = sourceElements(k);
        if (variant) {
            tpl = variant.tpl;
            elements = retargetElements(elements, variant.elements);
        }
        if (active && k.editId === active.editId && editedElements && (!variant || editorTemplateId === variant.id)) {
            elements = editedElements;
            if (variant) tpl = variant.tpl;
        }
        writeContentEdit(next, k, tpl, elements);
    }

    app.settingsStore.set('contentEdits', next);
}

function resetSelectedLegendEdits(app) {
    const keys = layoutFor(app.settings).keys;
    const selected = selectedKeys(keys);
    if (!selected.length) return;
    const next = sanitizeContentEdits(app.settings.contentEdits || {});
    for (const k of selected) delete next[k.editId];
    app.settingsStore.set('contentEdits', next);
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

function expandLegendPanel() {
    const panel = document.getElementById('legendPanel');
    if (!panel || !panel.classList.contains('panel-collapsed')) return;
    panel.classList.remove('panel-collapsed');
    panel.querySelector('.collapse-icon')?.classList.remove('collapsed');
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
    if (Number.isFinite(el.compOverride?.px)) return { ch, source: 'manual', px: el.compOverride.px };
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
    const widthText = `${widthInU(k.w, grid).toFixed(2)}U · ${toMm(k.w).toFixed(3)} mm`
        + (k.geometry?.widthEdited ? ' *' : '');
    let out = '<dl class="legend-meta">'
        + `<div><dt>Selected</dt><dd>${sel.indices.length}</dd></div>`
        + `<div><dt>Template</dt><dd>${html(k.tpl || 'blank')}</dd></div>`
        + `<div><dt>Position</dt><dd>row ${k.row + 1}, ${html(k.block)}, ${widthText}</dd></div>`
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
