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
import { LAYOUT_OPTIONS, LAYOUTS, LCAKB23 } from './kb/layouts.js';
import { toMm, toPx } from './kb/units.js';
import { loadTypeface, parseFont } from './kb/typography.js';
import { Compensator, YS_TEXT_REGULAR } from './kb/compensate.js';
import { autoCompensationParams, probeTypeface, runCompensationInvariants } from './kb/fontprobe.js';
import { attachContent, buildLegends, textPath } from './kb/legends.js';
import {
    loadReference, loadLegendReference, compare, reportHtml,
    compareLegends, legendsReportHtml, GEOMETRY_TOLERANCE
} from './kb/verify.js';
import CONTENT from './kb/content/lcakb23.js';
import { generatedContentForLayout, generatedContentStatsForLayout } from './kb/content/generated-layouts.js';
import ICONS from './kb/icons/lcakb23.js';
import ICON_OPTICS from './kb/icons/lcakb23-optics.js';
import {
    buildKeyboardModel as buildKeyboardModelData,
    cleanElement as cleanElementData,
    cleanElements as cleanElementsData,
    cleanIconGroup,
    cleanOffset as cleanOffsetData,
    clonePlain,
    clamp,
    finiteOr,
    normalizedPresetBlob as normalizedPresetBlobData,
    presetBlobFromKeyboardModel as presetBlobFromKeyboardModelData,
    roundMm,
    sanitizeContentEdits as sanitizeContentEditsData,
    sanitizeCompensationTableEdits as sanitizeCompensationTableEditsData,
    sanitizeLayoutEdits as sanitizeLayoutEditsData
} from './kb/model-io.js';
import { analyzeSvgBlueprint, blueprintSummaryLines } from './kb/svg-blueprint.js';

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

const ICON_OPTIONS = Object.keys(ICONS).sort((a, b) => a.localeCompare(b));
const TEMPLATE_VARIANTS = buildTemplateVariants(CONTENT);
const TEMPLATE_BY_ID = new Map(TEMPLATE_VARIANTS.map((v) => [v.id, v]));
const LANGUAGE_LAYERS = new Set(['dual', 'latin', 'cyrillic']);
const LEGEND_TEXT_MODES = new Set(['outlines', 'text']);
const ICON_LAYER_IDS = ['icons', 'f-icons'];
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const SINGLE_LATIN_RE = /^[A-Za-z]$/;
const REFERENCE_FONT_ID = 'reference';
const REFERENCE_FONT_URL = 'Fonts/YS%20Text/YS%20Text-Regular.ttf';
const REFERENCE_FONT_FAMILY = 'YS Text';
const CUSTOM_FONT_FAMILY_PREFIX = 'Keyboarder Session Font';
const FONT_FILE_RE = /\.(otf|ttf|woff|woff2)$/i;
const FONT_CONTROL_SHEET_CHARS = ['H', 'S', 'O', 'A', 'W', 'X', 'Ж', 'О', '@', '~', '№', ',', '.', '?', '!'];

function isLayoutLike(layout) {
    return !!layout
        && typeof layout === 'object'
        && !Array.isArray(layout)
        && layout.meta?.name
        && layout.grid
        && Array.isArray(layout.blocks)
        && Array.isArray(layout.rows);
}

function layoutByName(name, customLayout = null) {
    const key = String(name || '').trim();
    if (isLayoutLike(customLayout) && customLayout.meta.name === key) return customLayout;
    return LAYOUTS[key] || LCAKB23;
}

function layoutOptionsFor(s = {}) {
    const options = [...LAYOUT_OPTIONS];
    const custom = isLayoutLike(s.customLayout) ? s.customLayout : null;
    if (custom && !options.some((option) => option.id === custom.meta.name)) {
        options.push({ id: custom.meta.name, label: `${custom.meta.name} · custom` });
    }
    return options;
}

function normalizeLanguageLayer(value) {
    const key = String(value || 'dual').trim();
    return LANGUAGE_LAYERS.has(key) ? key : 'dual';
}

function normalizeLegendTextMode(value) {
    const key = String(value || 'outlines').trim();
    return LEGEND_TEXT_MODES.has(key) ? key : 'outlines';
}

function sourceLayoutFor(s = {}) {
    return layoutByName(s.layoutName || LCAKB23.meta.name, s.customLayout);
}

function isReferenceLayout(layout) {
    return layout?.meta?.name === LCAKB23.meta.name;
}

function contentForLayout(layout) {
    if (isReferenceLayout(layout)) return CONTENT;
    return generatedContentForLayout(layout, TYPE_DEFAULTS, CONTENT);
}

function gridMmFor(layout) {
    const g = layout?.grid || LCAKB23.grid;
    return {
        colPitch: toMm(g.colPitch),
        rowPitch: toMm(g.rowPitch),
        keyWidth1U: toMm(g.keyWidth1U),
        keyHeight: toMm(g.keyHeight),
        cornerRadius: toMm(g.cornerRadius),
        guideInset: toMm(g.guideInset)
    };
}

/** Эталонная сетка в мм — то, что видит и правит пользователь. */
const REF_MM = gridMmFor(LCAKB23);

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
let REFERENCE_TYPEFACE = null;
let REFERENCE_FONT_PROBE = null;
let REFERENCE_FONT_INVARIANTS = null;
let TYPEFACE_SIG = 'font:loading';
let FONT_REGISTRY = new Map();
let ACTIVE_FONT_ID = REFERENCE_FONT_ID;
let FONT_IMPORT_SEQ = 0;
let COMP_CACHE = new Map();
let SELECTION = { active: 0, indices: [0] };
let LAST_DELETED_EDIT_ID = null;
let LAST_DELETED_ROW_ID = null;
let COMP_TABLE_SELECTED_CH = null;

function cleanRuntimeFontId(value) {
    return String(value || '').trim().replace(/[^\w:.-]+/g, '-').slice(0, 96);
}

function slugId(value) {
    return String(value || 'font')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'font';
}

function fontEntry(id) {
    return FONT_REGISTRY.get(cleanRuntimeFontId(id)) || null;
}

function activeFontEntry() {
    return fontEntry(ACTIVE_FONT_ID) || fontEntry(REFERENCE_FONT_ID) || null;
}

function elementFontId(el = {}) {
    const explicit = cleanRuntimeFontId(el.fontId);
    if (explicit && FONT_REGISTRY.has(explicit)) return explicit;
    return ACTIVE_FONT_ID;
}

function fontEntryForElement(el = {}) {
    return fontEntry(elementFontId(el)) || activeFontEntry();
}

function typefaceForElement(el = {}) {
    return fontEntryForElement(el)?.tf || TYPEFACE;
}

function activeCompensationBase() {
    return activeFontEntry()?.params || YS_TEXT_REGULAR;
}

function compensationBaseForFontId(fontId) {
    return fontEntry(fontId)?.params || activeCompensationBase();
}

function activeCompensationTable() {
    return activeCompensationBase().table || {};
}

function activeLegendFontFamily() {
    return activeFontEntry()?.cssFamily || REFERENCE_FONT_FAMILY;
}

function legendFontFamilyForElement(el = {}) {
    return fontEntryForElement(el)?.cssFamily || activeLegendFontFamily();
}

function fontVariationSettings(entry) {
    const axes = entry?.probe?.variations?.axes || [];
    const coordinates = entry?.coordinates || {};
    const parts = axes
        .filter((axis) => Number.isFinite(coordinates[axis.tag]))
        .map((axis) => `"${axis.tag}" ${Number(coordinates[axis.tag]).toFixed(3).replace(/\.?0+$/, '')}`);
    return parts.length ? parts.join(', ') : '';
}

function fontRegistrySignature() {
    const entries = [...FONT_REGISTRY.values()]
        .map((entry) => `${entry.id}:${entry.signature}:${JSON.stringify(entry.coordinates || {})}`)
        .sort();
    return `${ACTIVE_FONT_ID}::${entries.join('|')}`;
}

function compensationTableWithEdits(baseTable = activeCompensationTable(), edits = {}) {
    const table = clonePlain(baseTable || {});
    for (const [ch, row] of Object.entries(edits)) {
        const next = { ...(table[ch] || {}) };
        for (const side of ['L', 'R']) {
            if (!Object.prototype.hasOwnProperty.call(row, side)) continue;
            if (row[side] === null) delete next[side];
            else if (Number.isFinite(row[side])) next[side] = row[side];
        }
        if (Object.keys(next).length) table[ch] = next;
        else delete table[ch];
    }
    return table;
}

function compForFontId(s, fontId = ACTIVE_FONT_ID) {
    if (!TYPEFACE || s.compensationMode === 'off') return null;
    const id = FONT_REGISTRY.has(fontId) ? fontId : ACTIVE_FONT_ID;
    const entry = fontEntry(id) || activeFontEntry();
    if (!entry?.tf) return null;
    const mode = s.compensationMode || 'table';
    const edits = mode === 'table' ? sanitizeCompensationTableEditsData(s.compensationTableEdits || {}) : {};
    const sig = `${entry.signature}:${JSON.stringify(entry.coordinates || {})}:${mode}:${JSON.stringify(edits)}`;
    if (!COMP_CACHE.has(sig)) {
        const base = compensationBaseForFontId(id);
        const params = mode === 'model'
            ? { ...base, table: {} }
            : { ...base, table: compensationTableWithEdits(base.table || {}, edits) };
        COMP_CACHE.set(sig, new Compensator(entry.tf, params));
    }
    return COMP_CACHE.get(sig);
}

function compFor(s) {
    return compForFontId(s, ACTIVE_FONT_ID);
}

/** Значения сетки из настроек (мм) — в форму, которую ждёт buildLayout (px). */
function gridFrom(s) {
    const sourceLayout = sourceLayoutFor(s);
    return {
        colPitch: toPx(s.colPitch),
        rowPitch: toPx(s.rowPitch),
        keyWidth1U: toPx(s.keyWidth1U),
        keyHeight: toPx(s.keyHeight),
        cornerRadius: toPx(s.cornerRadius),
        guideInset: toPx(s.guideInset),
        origin: sourceLayout.grid.origin
    };
}

const typeSigFrom = (s) => JSON.stringify({
    glyphSize: s.glyphSize,
    numpadSize: s.numpadSize,
    secondarySize: s.secondarySize,
    wordSize: s.wordSize,
    leading: s.leading,
    trackingOffset: s.trackingOffset,
    compensationMode: s.compensationMode,
    compensationTableEdits: s.compensationTableEdits || {},
    languageLayer: normalizeLanguageLayer(s.languageLayer),
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

function keepElementForLanguage(el, layer) {
    if (el.kind !== 'txt') return true;
    const text = String(el.text || '');
    if (layer === 'latin') return !CYRILLIC_RE.test(text);
    if (layer === 'cyrillic') return !SINGLE_LATIN_RE.test(text);
    return true;
}

function applyLanguageLayer(keys, s) {
    const layer = normalizeLanguageLayer(s.languageLayer);
    if (layer === 'dual') return;
    for (const k of keys) {
        const elements = (k.elements || []).filter((el) => keepElementForLanguage(el, layer));
        if (elements.length === (k.elements || []).length) continue;
        k.elements = elements;
        if (k.content) {
            k.content = { ...k.content, elements };
        }
    }
}

/**
 * Пересчёт раскладки. Кэшируется по подписи сетки: render вызывается и при смене цвета,
 * а геометрия при этом не меняется.
 */
let cached = { sig: null, data: null };
function layoutFor(s) {
    const sourceLayout = sourceLayoutFor(s);
    const g = gridFrom(s);
    const layoutEdits = sanitizeLayoutEditsForLayout(s.layoutEdits || {}, sourceLayout);
    const sig = sourceLayout.meta.name + JSON.stringify(g) + JSON.stringify(layoutEdits) + typeSigFrom(s) + TYPEFACE_SIG;
    if (cached.sig !== sig) {
        const editedLayout = layoutWithEdits(sourceLayout, layoutEdits, g);
        let renderLayout = editedLayout;
        let data;
        try {
            data = buildLayout(renderLayout, g);
        } catch (e) {
            console.warn('Keyboarder: layout edits were ignored because the row no longer fits.', e);
            renderLayout = sourceLayout;
            data = buildLayout(renderLayout, g);
        }
        assignEditIds(data.keys);
        annotateGeometry(data.keys, sourceLayout, renderLayout, g, layoutEdits);
        attachGuides(data.keys, g.guideInset);
        attachContent(data.keys, contentForLayout(sourceLayout));
        applyLanguageLayer(data.keys, s);
        captureBaseContent(data.keys);
        applyContentEdits(data.keys, s.contentEdits || {});
        applyTypeSettings(data.keys, s);
        data.legends = TYPEFACE
            ? buildLegends(data.keys, {
                tf: TYPEFACE, comp: compFor(s),
                typefaceFor: (el) => typefaceForElement(el),
                compForElement: (el) => compForFontId(s, elementFontId(el)),
                interline: s.leading, iconOptics: ICON_OPTICS
            })
            : [];
        data.sourceLayout = sourceLayout;
        data.renderLayout = renderLayout;
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
        layoutName: LCAKB23.meta.name,
        customLayout: null,

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
        legendTextMode: 'outlines',
        compensationTableEdits: {},

        showCaps: true,
        showGuides: false,
        showGlyphs: true,
        showIcons: true,
        showDrawing: false,
        showColumns: false,
        showIndex: false,
        showInk: false,
        showSlots: false,
        showRef: false,
        showDiff: false,
        showBlocks: false,
        languageLayer: 'dual',

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
        suggestSaveName: (app) => suggestedPresetName(app),
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
    syncControls(app) {
        syncLayoutSelect(app.settings);
        syncLanguageLayerSelect(app.settings);
        syncLegendTextMode(app.settings);
        syncFontImportStatus();
        syncCompensationTableEditor(app.settings);
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
        const data = layoutFor(s);
        const { keys, grid } = data;
        const gap = gapOf(grid);
        const hasReference = isReferenceLayout(data.sourceLayout);

        svg.appendChild(create('rect', { x: 0, y: 0, width, height, fill: s.bgColor }));
        appendSessionFontDefs(create, svg, s);

        if (s.showBlocks) {
            const g = create('g', { id: 'blocks' });
            for (const b of data.sourceLayout.blocks) {
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
            for (let r = 0; r <= data.renderLayout.rows.length; r++) {
                const y = grid.origin.y + r * grid.rowPitch;
                g.appendChild(create('line', {
                    x1: 0, y1: y, x2: width, y2: y, stroke: '#4a4f55', 'stroke-width': 0.3
                }));
            }
            svg.appendChild(g);
        }

        // Эталон подложкой: пунктир поверх заливки, чтобы расхождение было видно сразу.
        if (s.showRef && hasReference && REFERENCE) {
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

        if (s.showDiff && hasReference && REFERENCE) {
            svg.appendChild(renderGeometryDiff(create, keys, grid, REFERENCE));
        }

        const selection = renderSelection(create, keys, grid);
        if (selection) svg.appendChild(selection);

        const legends = layoutFor(s).legends;

        if (s.showGlyphs && TYPEFACE) {
            const textMode = normalizeLegendTextMode(s.legendTextMode);
            const g = create('g', { id: 'glyphs', fill: s.inkColor });
            for (const el of legends) {
                if (el.kind !== 'txt') continue;
                if (textMode === 'text') {
                    g.appendChild(renderLegendText(create, el, s.inkColor));
                    continue;
                }
                const tf = typefaceForElement(el);
                const d = tf ? textPath(tf, el) : '';
                if (d) g.appendChild(create('path', { d }));
            }
            svg.appendChild(g);
        }

        if (s.showIcons) {
            const iconGroups = new Map(ICON_LAYER_IDS.map((id) => [id, create('g', { id, fill: s.inkColor })]));
            for (const el of legends) {
                if (el.kind !== 'ico') continue;
                const ico = ICONS[el.icon];
                if (!ico) continue;
                const wrap = create('g', {
                    transform: `translate(${el.x - ico.ox} ${el.y - ico.oy})`
                });
                wrap.appendChild(create('path', { d: ico.d }));
                iconGroups.get(iconLayerId(el)).appendChild(wrap);
            }
            for (const id of ICON_LAYER_IDS) {
                const g = iconGroups.get(id);
                if (g?.childNodes.length) svg.appendChild(g);
            }
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
                    const tf = typefaceForElement(el);
                    const k = el.size / tf.upm;
                    const capTop = el.by - tf.capHeight * k;
                    const xTop = el.by - tf.xHeight * k;
                    g.appendChild(create('rect', {
                        x: el.bx, y: capTop,
                        width: el.advw, height: tf.capHeight * k,
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
        syncLegendTextMode(s);
        syncFontImportStatus();
        syncCompensationTableEditor(s);
        syncLayoutSelect(s);
        syncLanguageLayerSelect(s);
    },

    onInit(readyApp) {
        installPdfExport(readyApp);
        installCleanExports(readyApp);
        installSuggestedPresetSave(readyApp);
        initLayoutSelect(readyApp);
        initLanguageLayerSelect(readyApp);
        initFontImport(readyApp);
        initNewLayoutImport(readyApp);
        initCompensationTableEditor(readyApp);

        document.getElementById('exportSvgBtn')?.addEventListener('click', () => readyApp.exportSVG());
        document.getElementById('exportPngBtn')?.addEventListener('click', () => readyApp.exportPNG());
        document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
            void readyApp.exportPDF();
        });
        document.getElementById('exportJsonBtn')?.addEventListener('click', () => {
            exportModelJSON(readyApp);
        });
        document.getElementById('importJsonBtn')?.addEventListener('click', () => {
            openModelJSONPicker();
        });
        document.getElementById('importJsonInput')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0] || null;
            e.target.value = '';
            void importModelJSONFile(readyApp, file);
        });
        document.getElementById('drawingSvgInput')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0] || null;
            e.target.value = '';
            void createNewLayoutFromSvgFile(readyApp, file);
        });
        document.getElementById('fontFileInput')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0] || null;
            e.target.value = '';
            void importFontFile(readyApp, file);
        });

        document.getElementById('resetGridBtn')?.addEventListener('click', () => {
            const sourceLayout = sourceLayoutFor(readyApp.settings);
            const values = {
                ...gridMmFor(sourceLayout),
                layoutEdits: {},
                contentEdits: contentEditsWithoutAddedKeys(readyApp.settings.contentEdits || {}, sourceLayout.rows.length)
            };
            readyApp.settingsStore.setMultiple(values);
            syncSliderValues(readyApp, values);
        });

        document.getElementById('resetTypeBtn')?.addEventListener('click', () => {
            const values = {
                ...TYPE_DEFAULTS,
                compensationMode: 'table',
                legendTextMode: 'outlines',
                compensationTableEdits: {}
            };
            readyApp.settingsStore.setMultiple(values);
            syncSliderValues(readyApp, values);
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
        document.getElementById('addRowBtn')?.addEventListener('click', () => {
            addRowBelowActive(readyApp);
        });
        document.getElementById('deleteKeyBtn')?.addEventListener('click', () => {
            deleteActiveKey(readyApp);
        });
        document.getElementById('restoreKeyBtn')?.addEventListener('click', () => {
            restoreDeletedKey(readyApp);
        });
        document.getElementById('deleteRowBtn')?.addEventListener('click', () => {
            deleteActiveRow(readyApp);
        });
        document.getElementById('restoreRowBtn')?.addEventListener('click', () => {
            restoreDeletedRow(readyApp);
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
        document.querySelectorAll('#legendTextModeGroup [data-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                readyApp.settingsStore.set('legendTextMode', normalizeLegendTextMode(btn.dataset.mode));
            });
        });
        document.getElementById('compTableCharSelect')?.addEventListener('change', (e) => {
            COMP_TABLE_SELECTED_CH = e.target.value || COMP_TABLE_SELECTED_CH;
            syncCompensationTableEditor(readyApp.settings);
        });
        document.getElementById('applyCompTableBtn')?.addEventListener('click', () => {
            applyCompensationTableEdit(readyApp);
        });
        document.getElementById('resetCompTableCharBtn')?.addEventListener('click', () => {
            resetCompensationTableChar(readyApp);
        });
        document.getElementById('resetCompTableBtn')?.addEventListener('click', () => {
            readyApp.settingsStore.set('compensationTableEdits', {});
        });
        document.getElementById('compTableEditor')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                applyCompensationTableEdit(readyApp);
                e.preventDefault();
            }
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
            if (readyApp.settings.showRef && isReferenceLayout(sourceLayoutFor(readyApp.settings))) readyApp.render();
        }).catch(() => { /* подложка необязательна */ });

        // Гарнитура: путь с пробелом обязан быть URL-энкоден, папка называется Fonts с большой.
        loadTypeface(REFERENCE_FONT_URL).then((tf) => {
            registerReferenceFont(tf);
            COMP_CACHE = new Map();
            syncFontImportStatus();
            syncCompensationTableEditor(readyApp.settings);
            readyApp.render();
        }).catch((e) => {
            TYPEFACE_SIG = 'font:failed';
            syncFontImportStatus();
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

function round(value, decimals = 4) {
    const p = 10 ** decimals;
    return Math.round((Number(value) + Number.EPSILON) * p) / p;
}

function modelIOOptions(layout = LCAKB23) {
    return {
        layoutMeta: layout.meta,
        sourceRowCount: layout.rows.length,
        typeDefaults: TYPE_DEFAULTS,
        iconOptions: ICON_OPTIONS,
        minKeyWidthMm: MIN_KEY_WIDTH_MM,
        maxKeyWidthMm: MAX_KEY_WIDTH_MM
    };
}

function syncSliderValues(app, values) {
    for (const [setting, value] of Object.entries(values || {})) {
        const id = SLIDER_BY_SETTING[setting];
        if (id) app.sliders?.setValue(id, value, false);
    }
}

function layoutFromPresetLike(input = {}, defaults = {}) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const customLayout = source.customLayout
        || source.settings?.customLayout
        || source.keyboard?.customLayout
        || defaults.customLayout
        || null;
    return layoutByName(
        source.layoutName
        || source.settings?.layoutName
        || source.baseLayout
        || source.keyboard?.meta?.name
        || defaults.layoutName
        || LCAKB23.meta.name,
        customLayout
    );
}

function normalizedPresetBlob(blob = {}, defaults = {}) {
    const layout = layoutFromPresetLike(blob, defaults);
    const clean = normalizedPresetBlobData(blob, defaults, modelIOOptions(layout));
    clean.layoutName = layout.meta.name;
    if (!LAYOUTS[layout.meta.name]) clean.customLayout = clonePlain(layout);
    clean.showDrawing = false;
    clean.languageLayer = normalizeLanguageLayer(clean.languageLayer);
    if (!isReferenceLayout(layout)) {
        clean.showRef = false;
        clean.showDiff = false;
    }
    return clean;
}

function buildKeyboardModel(blob = {}, defaults = {}) {
    const layout = layoutFromPresetLike(blob, defaults);
    const clean = normalizedPresetBlob(blob, defaults);
    const model = buildKeyboardModelData(clean, defaults, modelIOOptions(layout));
    if (!LAYOUTS[layout.meta.name]) model.keyboard.customLayout = clonePlain(layout);
    return model;
}

function presetBlobFromKeyboardModel(input = {}, defaults = {}) {
    const layout = layoutFromPresetLike(input, defaults);
    const clean = presetBlobFromKeyboardModelData(input, defaults, modelIOOptions(layout));
    clean.layoutName = layout.meta.name;
    if (!LAYOUTS[layout.meta.name]) clean.customLayout = clonePlain(layout);
    clean.showDrawing = false;
    clean.languageLayer = normalizeLanguageLayer(clean.languageLayer);
    if (!isReferenceLayout(layout)) {
        clean.showRef = false;
        clean.showDiff = false;
    }
    return clean;
}

function parseKeyboardModelJSONText(text = '', defaults = {}) {
    let parsed;
    try {
        parsed = JSON.parse(String(text));
    } catch (_) {
        throw new Error('Could not parse JSON.');
    }
    return presetBlobFromKeyboardModel(parsed, defaults);
}

function sanitizeLayoutEditsForLayout(edits = {}, layout = LCAKB23) {
    return sanitizeLayoutEditsData(edits, modelIOOptions(layout));
}

function sanitizeLayoutEditsForSettings(settings, edits = {}) {
    return sanitizeLayoutEditsForLayout(edits, sourceLayoutFor(settings));
}

function sanitizeLayoutEdits(edits = {}) {
    return sanitizeLayoutEditsForLayout(edits, LCAKB23);
}

function expandedLayoutItems(items) {
    const out = [];
    for (const it of items || []) {
        const n = it.repeat || 1;
        const ids = Array.isArray(it.ids) ? it.ids : null;
        for (let i = 0; i < n; i++) {
            const copy = { ...it };
            delete copy.repeat;
            delete copy.ids;
            if (n > 1) {
                if (ids && ids[i]) copy.id = ids[i];
                else delete copy.id;
            }
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
    const row = parts[0] === 'add' ? Number(parts[1]) : Number(parts[0]);
    const safeRow = Number.isFinite(row) && String(parts[0] === 'add' ? parts[1] : parts[0]).trim() !== ''
        ? row
        : NaN;
    if (parts.length >= 3 && parts[0] === 'add') {
        return { row: safeRow, block: parts[2] || '' };
    }
    return { row: safeRow, block: parts[1] || '' };
}

function rowOrderEditId(rowIndex, blockId) {
    return `order:${rowIndex}:${blockId || ''}`;
}

function rowOrderFromEdits(edits, rowIndex, blockId) {
    return edits[rowOrderEditId(rowIndex, blockId)]?.order || [];
}

function rowEditId(rowIndex) {
    return `row:${rowIndex}`;
}

function isRowEditId(editId) {
    return String(editId || '').startsWith('row:');
}

function isAddedRowEditId(editId) {
    return String(editId || '').startsWith('rowadd:');
}

function addedRowOrdinal(editId) {
    const n = Number(String(editId || '').split(':')[1]);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function addedRowSourceRow(editId, sourceRowCount = LCAKB23.rows.length) {
    const n = addedRowOrdinal(editId);
    return n == null ? null : sourceRowCount + n - 1;
}

function nextAddedRowId(edits) {
    let n = 1;
    while (edits[`rowadd:${n}`]) n++;
    return `rowadd:${n}`;
}

function addedRowsAfter(edits, sourceRow, sourceRowCount = LCAKB23.rows.length) {
    return Object.entries(edits)
        .filter(([id, edit]) => isAddedRowEditId(id) && edit?.rowAdded && !edit.deleted && edit.afterRow === sourceRow)
        .map(([id, edit]) => ({ id, edit, sourceRow: addedRowSourceRow(id, sourceRowCount) }))
        .filter((entry) => Number.isInteger(entry.sourceRow) && !edits[rowEditId(entry.sourceRow)]?.deleted)
        .sort((a, b) => (addedRowOrdinal(a.id) || 0) - (addedRowOrdinal(b.id) || 0));
}

function cloneAddedRowFromTemplate(row) {
    const next = {};
    for (const [blockId, items] of Object.entries(row || {})) {
        next[blockId] = (items || []).map((it) => {
            const item = { ...it };
            delete item.id;
            delete item.ids;
            delete item.editId;
            return item;
        });
    }
    return next;
}

function sourceRowIndex(row, fallback) {
    return Number.isInteger(row?.__sourceRow) ? row.__sourceRow : fallback;
}

function cloneRowWithSource(row, sourceRow) {
    const next = { ...row };
    Object.defineProperty(next, '__sourceRow', {
        value: sourceRow,
        enumerable: false,
        configurable: true
    });
    return next;
}

function sourceRowOfKey(k) {
    const fromEditId = rowBlockFromEditId(k?.editId).row;
    if (Number.isFinite(fromEditId)) return fromEditId;
    if (Number.isInteger(k?.sourceRow)) return k.sourceRow;
    return Number.isInteger(k?.row) ? k.row : null;
}

function sourceBlockOfKey(k) {
    return rowBlockFromEditId(k?.editId).block || k?.block || '';
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
    const clean = sanitizeLayoutEditsForLayout(edits, layout);
    if (!Object.keys(clean).length) return layout;

    const sourceRowCount = layout.rows.length;
    let applied = false;
    const rows = [];

    const processRow = (row, srcRow) => {
        if (clean[rowEditId(srcRow)]?.deleted) {
            applied = true;
            return;
        }
        const nextRow = {};
        for (const [blockId, items] of Object.entries(row)) {
            const entries = rowSpecEntries(srcRow, blockId, items);
            const insertions = insertionMapForRow(clean, srcRow, blockId);
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
            const ordered = applyRowOrder(expandedItems, rowOrderFromEdits(clean, srcRow, blockId));
            if (ordered.changed) {
                blockChanged = true;
                applied = true;
            }
            const nextItems = ordered.items;
            const stableItems = entries.map(({ item: it, editId }) =>
                it.skip ? { ...it } : { ...it, editId });
            nextRow[blockId] = blockChanged ? nextItems : stableItems;
        }
        rows.push(cloneRowWithSource(nextRow, srcRow));
    };

    const pushAddedRowsAfter = (sourceRow) => {
        for (const { edit, sourceRow: addedSourceRow } of addedRowsAfter(clean, sourceRow, sourceRowCount)) {
            const template = layout.rows[edit.templateRow];
            if (!template) continue;
            processRow(cloneAddedRowFromTemplate(template), addedSourceRow);
            applied = true;
        }
    };

    layout.rows.forEach((row, rowIndex) => {
        const srcRow = sourceRowIndex(row, rowIndex);
        processRow(row, srcRow);
        pushAddedRowsAfter(srcRow);
    });

    return applied ? { ...layout, rows, artboard: rows.length === layout.rows.length ? layout.artboard : null } : layout;
}

function geometrySpecMap(layout) {
    const byId = new Map();
    layout.rows.forEach((row, rowIndex) => {
        const srcRow = sourceRowIndex(row, rowIndex);
        for (const [blockId, items] of Object.entries(row)) {
            for (const entry of rowSpecEntries(srcRow, blockId, items)) {
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
    const clean = sanitizeLayoutEditsForLayout(edits, sourceLayout);
    const flexByRowBlock = new Map();

    for (const k of keys) {
        if (current.get(k.editId)?.flex) flexByRowBlock.set(rowBlockKey(k), k);
    }

    for (const k of keys) {
        const info = source.get(k.editId) || {};
        const currentInfo = current.get(k.editId) || {};
        const layoutLocked = !!k.stackParentEditId;
        const range = { min: MIN_KEY_WIDTH_MM, max: MAX_KEY_WIDTH_MM };
        const flex = flexByRowBlock.get(rowBlockKey(k));
        if (!layoutLocked && currentInfo.rowHasFlex && flex && flex.editId !== k.editId) {
            const max = toMm(k.w + flex.w - toPx(MIN_KEY_WIDTH_MM));
            range.max = Math.min(MAX_KEY_WIDTH_MM, Math.max(MIN_KEY_WIDTH_MM, max));
        }
        k.geometry = {
            baseWidthMm: Number.isFinite(info.baseWidthMm) ? info.baseWidthMm : toMm(k.w),
            sourceFlex: !!info.sourceFlex,
            currentFlex: !!currentInfo.flex,
            rowHasFlex: !!currentInfo.rowHasFlex,
            layoutLocked,
            widthEditable: !layoutLocked && (!currentInfo.flex || !!info.sourceFlex),
            widthEdited: !!clean[k.editId]?.widthMm,
            widthRange: range
        };
    }
}

function cleanOffset(offset) {
    return cleanOffsetData(offset);
}

function cleanElement(element = {}) {
    return cleanElementData(element, modelIOOptions());
}

function cleanElements(elements = []) {
    return cleanElementsData(elements, modelIOOptions());
}

function iconLayerId(element = {}) {
    return cleanIconGroup(element.group);
}

function sanitizeContentEdits(edits = {}) {
    return sanitizeContentEditsData(edits, modelIOOptions());
}

function contentEditsWithoutAddedKeys(edits = {}, sourceRowCount = LCAKB23.rows.length) {
    const clean = sanitizeContentEdits(edits);
    for (const id of Object.keys(clean)) {
        const row = rowBlockFromEditId(id).row;
        if (isAddedEditId(id) || (Number.isInteger(row) && row >= sourceRowCount)) delete clean[id];
    }
    return clean;
}

function rowBlockKey(k) {
    return `${k.row}:${k.block || ''}`;
}

function assignEditIds(keys) {
    const groups = new Map();
    for (const k of keys) {
        const id = rowBlockKey(k);
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(k);
    }
    for (const group of groups.values()) {
        group.sort((a, b) => (a.x - b.x) || (a.y - b.y) || (a.i - b.i));
        group.forEach((k, ordinal) => {
            if (!k.editId) k.editId = `${k.row}:${k.block || ''}:${ordinal}`;
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
            if (match.fontId || sample.fontId) next.fontId = match.fontId || sample.fontId;
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

function syncLegendTextMode(s) {
    const mode = normalizeLegendTextMode(s.legendTextMode);
    document.querySelectorAll('#legendTextModeGroup [data-mode]').forEach((btn) => {
        const active = btn.dataset.mode === mode;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function initCompensationTableEditor(app) {
    syncCompensationTableEditor(app.settings);
}

function compensationTableCharacters(s) {
    const chars = new Set(Object.keys(activeCompensationTable()));
    const edits = sanitizeCompensationTableEditsData(s.compensationTableEdits || {});
    for (const ch of Object.keys(edits)) chars.add(ch);
    return [...chars].sort((a, b) => a.localeCompare(b));
}

function baseCompensationRow(ch) {
    return activeCompensationTable()[ch] || {};
}

function effectiveCompensationRow(s, ch) {
    return compensationTableWithEdits(
        activeCompensationTable(),
        sanitizeCompensationTableEditsData(s.compensationTableEdits || {})
    )[ch] || {};
}

function compSideText(value) {
    return Number.isFinite(value) ? value.toFixed(2).replace(/\.?0+$/, '') : '';
}

function syncCompensationTableEditor(s) {
    const select = document.getElementById('compTableCharSelect');
    const left = document.getElementById('compTableLeftInput');
    const right = document.getElementById('compTableRightInput');
    const status = document.getElementById('compTableStatus');
    const resetChar = document.getElementById('resetCompTableCharBtn');
    const resetTable = document.getElementById('resetCompTableBtn');
    if (!select || !left || !right) return;

    const chars = compensationTableCharacters(s);
    if (!chars.length) return;
    const sig = chars.join('\u0000');
    if (select.dataset.sig !== sig) {
        select.replaceChildren(...chars.map((ch) => {
            const opt = document.createElement('option');
            opt.value = ch;
            opt.textContent = ch;
            return opt;
        }));
        select.dataset.sig = sig;
    }
    if (!COMP_TABLE_SELECTED_CH || !chars.includes(COMP_TABLE_SELECTED_CH)) {
        COMP_TABLE_SELECTED_CH = select.value && chars.includes(select.value) ? select.value : chars[0];
    }
    select.value = COMP_TABLE_SELECTED_CH;

    const edits = sanitizeCompensationTableEditsData(s.compensationTableEdits || {});
    const base = baseCompensationRow(COMP_TABLE_SELECTED_CH);
    const row = effectiveCompensationRow(s, COMP_TABLE_SELECTED_CH);
    left.value = compSideText(row.L);
    right.value = compSideText(row.R);
    left.placeholder = compSideText(base.L);
    right.placeholder = compSideText(base.R);
    if (resetChar) resetChar.disabled = !edits[COMP_TABLE_SELECTED_CH];
    if (resetTable) resetTable.disabled = !Object.keys(edits).length;
    if (status) {
        const changed = edits[COMP_TABLE_SELECTED_CH] ? 'edited' : 'reference';
        status.textContent = `${changed} · L ${compSideText(row.L) || '-'} · R ${compSideText(row.R) || '-'}`;
    }
}

function parseCompTableInput(input) {
    const raw = String(input?.value || '').trim();
    if (!raw) return { ok: true, value: null };
    const value = Number(raw);
    if (!Number.isFinite(value)) return { ok: false, value: null };
    return { ok: true, value: Math.round(value * 100) / 100 };
}

function applyCompensationTableEdit(app) {
    const ch = document.getElementById('compTableCharSelect')?.value || COMP_TABLE_SELECTED_CH;
    if (!ch) return;
    COMP_TABLE_SELECTED_CH = ch;
    const left = parseCompTableInput(document.getElementById('compTableLeftInput'));
    const right = parseCompTableInput(document.getElementById('compTableRightInput'));
    const status = document.getElementById('compTableStatus');
    if (!left.ok || !right.ok) {
        if (status) status.textContent = 'Use numeric L/R values.';
        return;
    }

    const base = baseCompensationRow(ch);
    const row = {};
    if (left.value === null) {
        if (base.L !== undefined) row.L = null;
    } else if (left.value !== base.L) {
        row.L = left.value;
    }
    if (right.value === null) {
        if (base.R !== undefined) row.R = null;
    } else if (right.value !== base.R) {
        row.R = right.value;
    }

    const edits = sanitizeCompensationTableEditsData(app.settings.compensationTableEdits || {});
    if (Object.keys(row).length) edits[ch] = row;
    else delete edits[ch];
    COMP_CACHE.clear();
    app.settingsStore.set('compensationTableEdits', edits);
}

function resetCompensationTableChar(app) {
    const ch = document.getElementById('compTableCharSelect')?.value || COMP_TABLE_SELECTED_CH;
    if (!ch) return;
    const edits = sanitizeCompensationTableEditsData(app.settings.compensationTableEdits || {});
    delete edits[ch];
    COMP_CACHE.clear();
    app.settingsStore.set('compensationTableEdits', edits);
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

function syncLayoutSelect(s) {
    const select = document.getElementById('layoutSelect');
    if (!select) return;
    const options = layoutOptionsFor(s);
    const sig = options.map((v) => `${v.id}:${v.label}`).join('|');
    if (select.dataset.sig !== sig) {
        select.replaceChildren(...options.map((v) => optionEl(v.id, v.label)));
        select.dataset.sig = sig;
    }
    select.value = sourceLayoutFor(s).meta.name;
    syncReferenceToggles(s);
}

function syncReferenceToggles(s) {
    const enabled = isReferenceLayout(sourceLayoutFor(s));
    for (const id of ['showRef', 'showDiff']) {
        const checkbox = document.getElementById(id);
        const label = checkbox?.closest?.('label');
        if (!checkbox) continue;
        checkbox.disabled = !enabled;
        if (label) label.classList.toggle('is-disabled', !enabled);
    }
}

function initLayoutSelect(app) {
    const select = document.getElementById('layoutSelect');
    if (!select) return;
    syncLayoutSelect(app.settings);
    select.addEventListener('change', () => {
        const nextLayout = layoutByName(select.value, app.settings.customLayout);
        if (nextLayout.meta.name === sourceLayoutFor(app.settings).meta.name) return;
        SELECTION = { active: 0, indices: [0] };
        LAST_DELETED_EDIT_ID = null;
        LAST_DELETED_ROW_ID = null;
        const values = {
            layoutName: nextLayout.meta.name,
            layoutEdits: {},
            contentEdits: {}
        };
        if (!isReferenceLayout(nextLayout)) {
            values.showRef = false;
            values.showDiff = false;
        }
        app.settingsStore.setMultiple(values);
        syncLayoutSelect(app.settings);
        app.renderNow();
    });
}

function syncLanguageLayerSelect(s) {
    const select = document.getElementById('languageLayerSelect');
    if (!select) return;
    select.value = normalizeLanguageLayer(s.languageLayer);
}

function initLanguageLayerSelect(app) {
    const select = document.getElementById('languageLayerSelect');
    if (!select) return;
    syncLanguageLayerSelect(app.settings);
    select.addEventListener('change', () => {
        app.settingsStore.set('languageLayer', normalizeLanguageLayer(select.value));
        syncLanguageLayerSelect(app.settings);
        app.renderNow();
    });
}

function initFontImport(app) {
    const dropzone = document.getElementById('fontDropzone');
    const browse = document.getElementById('fontBrowseBtn');
    const reference = document.getElementById('fontReferenceBtn');
    const applySelected = document.getElementById('fontApplySelectedBtn');
    const controlSheet = document.getElementById('fontControlSheetBtn');
    const select = document.getElementById('fontSelect');
    const axes = document.getElementById('fontAxisControls');
    const instances = document.getElementById('fontInstanceControls');
    browse?.addEventListener('click', () => openFontPicker());
    reference?.addEventListener('click', () => resetReferenceFont(app));
    applySelected?.addEventListener('click', () => applyActiveFontToSelection(app));
    controlSheet?.addEventListener('click', () => exportFontControlSheet(app));
    select?.addEventListener('change', () => setActiveFontId(app, select.value));
    axes?.addEventListener('input', (e) => {
        const row = e.target.closest?.('.font-axis-row');
        if (!row) return;
        updateFontAxis(app, row.dataset.axis, e.target.value);
    });
    axes?.addEventListener('change', (e) => {
        const row = e.target.closest?.('.font-axis-row');
        if (!row) return;
        updateFontAxis(app, row.dataset.axis, e.target.value);
    });
    instances?.addEventListener('change', (e) => {
        if (e.target.id === 'fontInstanceSelect') applyFontInstance(app, e.target.value);
    });
    if (dropzone) {
        for (const eventName of ['dragenter', 'dragover']) {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropzone.classList.add('is-dragover');
            });
        }
        for (const eventName of ['dragleave', 'drop']) {
            dropzone.addEventListener(eventName, () => {
                dropzone.classList.remove('is-dragover');
            });
        }
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = [...(e.dataTransfer?.files || [])];
            const file = files.find(isFontFile) || files[0] || null;
            void importFontFile(app, file);
        });
    }
    syncFontImportStatus();
}

function openFontPicker() {
    document.getElementById('fontFileInput')?.click();
}

function isFontFile(file) {
    return !!file && (FONT_FILE_RE.test(file.name || '') || /^font\//i.test(file.type || ''));
}

function fontFormatFor(name) {
    const ext = String(name || '').split('.').pop().toLowerCase();
    if (ext === 'ttf') return 'truetype';
    if (ext === 'otf') return 'opentype';
    if (ext === 'woff2') return 'woff2';
    if (ext === 'woff') return 'woff';
    return 'truetype';
}

function fontMimeType(file) {
    if (/woff2$/i.test(file?.name || '')) return 'font/woff2';
    if (/woff$/i.test(file?.name || '')) return 'font/woff';
    if (/otf$/i.test(file?.name || '')) return 'font/otf';
    return file?.type || 'font/ttf';
}

function fontDataUrl(buf, file) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${fontMimeType(file)};base64,${btoa(binary)}`;
}

function registerReferenceFont(tf) {
    const probe = probeTypeface(tf);
    const entry = {
        id: REFERENCE_FONT_ID,
        kind: 'reference',
        name: 'YS Text Regular',
        fileName: 'YS Text-Regular.ttf',
        size: 0,
        tf,
        probe,
        params: YS_TEXT_REGULAR,
        invariants: runCompensationInvariants(tf, YS_TEXT_REGULAR),
        coordinates: defaultVariationCoordinates(probe),
        cssFamily: REFERENCE_FONT_FAMILY,
        signature: 'font:reference:ys-text-regular'
    };
    FONT_REGISTRY.set(entry.id, entry);
    REFERENCE_TYPEFACE = tf;
    REFERENCE_FONT_PROBE = probe;
    REFERENCE_FONT_INVARIANTS = entry.invariants;
    setActiveFontId(null, ACTIVE_FONT_ID || REFERENCE_FONT_ID, { render: false });
}

function defaultVariationCoordinates(probe) {
    const coordinates = {};
    for (const axis of probe?.variations?.axes || []) {
        if (Number.isFinite(axis.default)) coordinates[axis.tag] = axis.default;
    }
    return coordinates;
}

function releaseFontEntry(entry) {
    if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    entry?.styleElement?.remove?.();
}

function installSessionFontFace(entry, file) {
    const objectUrl = URL.createObjectURL(file);
    const style = document.createElement('style');
    style.id = `keyboarder-font-face-${entry.id.replace(/[^\w-]+/g, '-')}`;
    style.textContent = `@font-face{font-family:"${entry.cssFamily}";src:url("${objectUrl}") format("${fontFormatFor(file.name)}");font-weight:1 1000;font-stretch:50% 200%;font-style:normal;font-display:block;}`;
    document.head.appendChild(style);
    if (document.fonts?.load) void document.fonts.load(`12px "${entry.cssFamily}"`);
    entry.objectUrl = objectUrl;
    entry.styleElement = style;
}

function fontImportId(file, probe) {
    return `session:${slugId(probe?.id || file?.name)}:${file?.size || 0}:${file?.lastModified || 0}`;
}

function buildSessionFontEntry(file, tf, dataUrl) {
    const probe = probeTypeface(tf);
    const params = autoCompensationParams(tf, probe);
    const id = fontImportId(file, probe);
    return {
        id,
        kind: 'session',
        name: fontDisplayName(probe, file.name || 'Session font'),
        fileName: file.name || 'session-font',
        size: file.size || 0,
        type: file.type || '',
        tf,
        probe,
        params,
        invariants: runCompensationInvariants(tf, params),
        coordinates: defaultVariationCoordinates(probe),
        cssFamily: `${CUSTOM_FONT_FAMILY_PREFIX} ${++FONT_IMPORT_SEQ}`,
        dataUrl,
        signature: `font:session:${id}`
    };
}

function setActiveFontId(app, id, options = {}) {
    const nextId = FONT_REGISTRY.has(cleanRuntimeFontId(id)) ? cleanRuntimeFontId(id) : REFERENCE_FONT_ID;
    ACTIVE_FONT_ID = nextId;
    TYPEFACE = activeFontEntry()?.tf || REFERENCE_TYPEFACE;
    TYPEFACE_SIG = fontRegistrySignature();
    COMP_CACHE.clear();
    cached.sig = null;
    syncFontImportStatus();
    syncCompensationTableEditor(app?.settings || app?.settingsStore?.toObject?.() || {});
    if (options.render !== false) app?.renderNow?.();
}

async function importFontFile(app, file) {
    if (!file) return;
    if (!isFontFile(file)) {
        await app.dialog?.alert({
            title: 'Font import failed',
            text: 'Choose an OpenType font file: TTF, OTF, WOFF, or WOFF2.',
            okText: 'Close'
        });
        return;
    }
    try {
        const buf = await file.arrayBuffer();
        const tf = parseFont(buf);
        const entry = buildSessionFontEntry(file, tf, fontDataUrl(buf, file));
        releaseFontEntry(FONT_REGISTRY.get(entry.id));
        installSessionFontFace(entry, file);
        FONT_REGISTRY.set(entry.id, entry);
        setActiveFontId(app, entry.id);
        app._showToast?.('Font loaded');
    } catch (e) {
        await app.dialog?.alert({
            title: 'Font import failed',
            text: e?.message || 'Could not parse this font file.',
            okText: 'Close'
        });
    }
}

function resetReferenceFont(app) {
    setActiveFontId(app, REFERENCE_FONT_ID);
}

function activeFontProbe() {
    return activeFontEntry()?.probe || REFERENCE_FONT_PROBE;
}

function activeFontInvariants() {
    return activeFontEntry()?.invariants || REFERENCE_FONT_INVARIANTS;
}

function fontDisplayName(probe, fallback = 'Unknown Typeface') {
    const names = probe?.names || {};
    return names.fullName || names.postScriptName || names.family || probe?.id || fallback;
}

function compactNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return '-';
    const text = Number(value).toFixed(digits);
    return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

function fontBytes(value) {
    if (!Number.isFinite(value) || value <= 0) return '-';
    if (value >= 1024 * 1024) return `${compactNumber(value / (1024 * 1024), 2)} MB`;
    if (value >= 1024) return `${compactNumber(value / 1024, 1)} KB`;
    return `${value} B`;
}

function fontAxisText(probe) {
    const axes = probe?.variations?.axes || [];
    if (!axes.length) return 'none';
    return axes.map((axis) => {
        const tag = axis.tag || '?';
        return `${tag} ${compactNumber(axis.min, 0)}-${compactNumber(axis.max, 0)} def ${compactNumber(axis.default, 0)}`;
    }).join(', ');
}

function activeFontCoordinatesText(entry = activeFontEntry()) {
    const axes = entry?.probe?.variations?.axes || [];
    if (!axes.length) return 'default';
    const coordinates = entry.coordinates || {};
    return axes.map((axis) => `${axis.tag} ${compactNumber(coordinates[axis.tag] ?? axis.default, 3)}`).join(', ');
}

function fontMetricText(probe) {
    if (!probe) return 'waiting';
    const m = probe.metrics || {};
    const stem = probe.stems?.vertical?.value;
    return `UPM ${compactNumber(m.unitsPerEm?.value, 0)} · cap ${compactNumber(m.capHeight?.value, 0)} · x ${compactNumber(m.xHeight?.value, 0)} · stem ${compactNumber(stem, 1)}`;
}

function fontCompText() {
    const params = activeCompensationBase();
    const calibration = params.calibration || {};
    const tableCount = Object.keys(params.table || {}).length;
    return `eps ${compactNumber(params.eps, 2)} · w ${compactNumber(params.w, 2)} · table ${tableCount} · sb ${compactNumber(calibration.sidebearingScale, 2)}`;
}

function fontInvariantText(invariants) {
    if (!invariants) return 'pending';
    const flat = invariants.flatStem?.sigmaPx;
    const symmetry = invariants.symmetry?.maxDelta;
    return `${invariants.pass ? 'pass' : 'check'} · flat σ ${compactNumber(flat, 4)} px · sym ${compactNumber(symmetry, 2)} em`;
}

function fontOptionLabel(entry) {
    const suffix = entry.kind === 'reference' ? 'reference' : entry.fileName || 'session';
    const axes = entry.probe?.variations?.axes?.length ? ` · ${activeFontCoordinatesText(entry)}` : '';
    return `${fontDisplayName(entry.probe, entry.name)} · ${suffix}${axes}`;
}

function syncFontSelect() {
    const select = document.getElementById('fontSelect');
    if (!select) return;
    const entries = [...FONT_REGISTRY.values()];
    const sig = entries.map((entry) => `${entry.id}:${entry.name}:${entry.fileName}:${JSON.stringify(entry.coordinates || {})}`).join('|');
    if (select.dataset.sig !== sig) {
        select.replaceChildren(...entries.map((entry) => {
            const opt = document.createElement('option');
            opt.value = entry.id;
            opt.textContent = fontOptionLabel(entry);
            return opt;
        }));
        select.dataset.sig = sig;
    }
    select.value = FONT_REGISTRY.has(ACTIVE_FONT_ID) ? ACTIVE_FONT_ID : REFERENCE_FONT_ID;
}

function syncFontInstanceControls() {
    const box = document.getElementById('fontInstanceControls');
    const entry = activeFontEntry();
    const instances = entry?.probe?.variations?.instances || [];
    if (!box) return;
    if (!instances.length) {
        box.innerHTML = '';
        box.dataset.sig = 'none';
        return;
    }
    const current = matchingFontInstance(entry);
    const sig = `${entry.id}:${instances.map((instance) => instance.name).join('|')}:${current}`;
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    const options = ['<option value="">Custom axes</option>']
        .concat(instances.map((instance, index) =>
            `<option value="${index}"${String(index) === current ? ' selected' : ''}>${html(instance.name || `Instance ${index + 1}`)}</option>`));
    box.innerHTML = '<label class="font-select-row" for="fontInstanceSelect">'
        + '<span>Instance</span>'
        + `<select id="fontInstanceSelect" class="select-control" aria-label="Variable font instance">${options.join('')}</select>`
        + '</label>';
}

function axisStep(axis) {
    const span = Math.abs((axis.max ?? 0) - (axis.min ?? 0));
    if (span <= 2) return 0.001;
    if (span <= 20) return 0.01;
    return 1;
}

function syncFontAxisControls() {
    const box = document.getElementById('fontAxisControls');
    const entry = activeFontEntry();
    const axes = entry?.probe?.variations?.axes || [];
    if (!box) return;
    if (!axes.length) {
        box.innerHTML = '';
        box.dataset.sig = 'none';
        return;
    }
    const coordinates = entry.coordinates || {};
    const sig = `${entry.id}:${JSON.stringify(coordinates)}:${axes.map((axis) => axis.tag).join('|')}`;
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = axes.map((axis) => {
        const value = coordinates[axis.tag] ?? axis.default ?? axis.min ?? 0;
        const step = axisStep(axis);
        return `<div class="font-axis-row" data-axis="${html(axis.tag)}">`
            + `<label><span>${html(axis.tag)}</span><input class="font-axis-value" type="number" step="${step}" min="${html(axis.min)}" max="${html(axis.max)}" value="${html(compactNumber(value, 3))}" aria-label="${html(axis.name || axis.tag)} axis value"></label>`
            + `<input class="font-axis-slider" type="range" step="${step}" min="${html(axis.min)}" max="${html(axis.max)}" value="${html(value)}" aria-label="${html(axis.name || axis.tag)} axis">`
            + '</div>';
    }).join('');
}

function matchingFontInstance(entry) {
    const instances = entry?.probe?.variations?.instances || [];
    const coordinates = entry?.coordinates || {};
    const axes = entry?.probe?.variations?.axes || [];
    for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        const same = axes.every((axis) =>
            Math.abs((coordinates[axis.tag] ?? axis.default ?? 0) - (instance.coordinates?.[axis.tag] ?? axis.default ?? 0)) < 0.001);
        if (same) return String(i);
    }
    return '';
}

function applyFontInstance(app, index) {
    const entry = activeFontEntry();
    const instance = entry?.probe?.variations?.instances?.[Number(index)];
    if (!entry || !instance) return;
    entry.coordinates = {
        ...defaultVariationCoordinates(entry.probe),
        ...(instance.coordinates || {})
    };
    entry.instanceName = instance.name || '';
    TYPEFACE_SIG = fontRegistrySignature();
    COMP_CACHE.clear();
    cached.sig = null;
    syncFontImportStatus();
    app.renderNow();
}

function updateFontAxis(app, axisTag, rawValue) {
    const entry = activeFontEntry();
    const axis = entry?.probe?.variations?.axes?.find((item) => item.tag === axisTag);
    if (!entry || !axis) return;
    const value = clamp(Number(rawValue), axis.min, axis.max);
    if (!Number.isFinite(value)) return;
    entry.coordinates = { ...(entry.coordinates || {}), [axis.tag]: value };
    entry.instanceName = matchingFontInstance(entry)
        ? entry.probe.variations.instances[Number(matchingFontInstance(entry))]?.name || ''
        : '';
    TYPEFACE_SIG = fontRegistrySignature();
    COMP_CACHE.clear();
    cached.sig = null;
    syncFontImportStatus();
    app.renderNow();
}

function applyActiveFontToSelection(app) {
    const keys = layoutFor(app.settings).keys;
    const selected = selectedKeys(keys);
    if (!selected.length || !FONT_REGISTRY.has(ACTIVE_FONT_ID)) return;
    const next = sanitizeContentEdits(app.settings.contentEdits || {});
    for (const k of selected) {
        const elements = sourceElements(k).map((el) =>
            el.kind === 'txt' ? cleanElement({ ...el, fontId: ACTIVE_FONT_ID }) : el);
        writeContentEdit(next, k, k.tpl || 'blank', elements);
    }
    app.settingsStore.set('contentEdits', next);
    app._showToast?.('Font applied');
}

function fontOptionsHtml(selectedId = '') {
    const opts = ['<option value="">Default</option>'];
    for (const entry of FONT_REGISTRY.values()) {
        opts.push(`<option value="${html(entry.id)}"${entry.id === selectedId ? ' selected' : ''}>${html(fontOptionLabel(entry))}</option>`);
    }
    return opts.join('');
}

function syncFontImportStatus() {
    const status = document.getElementById('fontProbeStatus');
    const reference = document.getElementById('fontReferenceBtn');
    const applySelected = document.getElementById('fontApplySelectedBtn');
    const controlSheet = document.getElementById('fontControlSheetBtn');
    syncFontSelect();
    syncFontInstanceControls();
    syncFontAxisControls();
    if (reference) reference.disabled = ACTIVE_FONT_ID === REFERENCE_FONT_ID || !REFERENCE_TYPEFACE;
    if (applySelected) applySelected.disabled = !TYPEFACE || !SELECTION.indices?.length;
    if (controlSheet) controlSheet.disabled = !TYPEFACE;
    if (!status) return;
    if (!TYPEFACE) {
        status.innerHTML = '<p class="font-empty">Loading reference font...</p>';
        return;
    }
    const probe = activeFontProbe();
    const entry = activeFontEntry();
    const isReference = entry?.kind === 'reference';
    const rows = [
        ['Font', fontDisplayName(probe, entry?.name || 'YS Text Regular')],
        ['File', isReference ? 'YS Text Regular · reference' : `${entry.fileName} · ${fontBytes(entry.size)}`],
        ['Data', fontMetricText(probe)],
        ['Axes', fontAxisText(probe)],
        ['Coords', activeFontCoordinatesText(entry)],
        ['Comp', isReference ? 'measured YS Text model + table' : fontCompText()],
        ['Check', fontInvariantText(activeFontInvariants())],
        ['Loaded', `${FONT_REGISTRY.size} font${FONT_REGISTRY.size === 1 ? '' : 's'}`]
    ];
    if ((probe?.variations?.axes || []).length) {
        rows.push(['Note', 'SVG text receives CSS variation settings; outline contours use the loaded default instance.']);
    }
    status.innerHTML = `<dl class="font-summary">
        ${rows.map(([term, value]) => `<div><dt>${html(term)}</dt><dd>${html(value)}</dd></div>`).join('')}
    </dl>`;
}

function controlSheetGlyph(entry, comp, ch, x, baseline, side, size) {
    const tf = entry.tf;
    const laid = tf.layout(ch, size, 0, [0, baseline]);
    if (!laid.ink) return '';
    const outdent = comp ? comp.outdentPx(ch, side, size) : 0;
    const bx = side === 'L'
        ? x - outdent - laid.ink[0]
        : x + outdent - (laid.ink[0] + laid.ink[2]);
    return tf.pathData(ch, size, 0, [bx, baseline]);
}

function exportFontControlSheet(app) {
    const entries = [...FONT_REGISTRY.values()].filter((entry) => entry.tf);
    if (!entries.length) return;
    const size = 24;
    const colW = 72;
    const rowH = 112;
    const labelW = 245;
    const width = labelW + FONT_CONTROL_SHEET_CHARS.length * colW + 40;
    const height = 58 + entries.length * rowH;
    const now = new Date().toISOString();
    const rows = [];
    rows.push(`<text x="24" y="28" font-family="Arial, sans-serif" font-size="13" fill="#333">Keyboarder font control sheet · ${html(now)}</text>`);
    rows.push(`<text x="${labelW}" y="28" font-family="Arial, sans-serif" font-size="10" fill="#666">Each sample is edge-aligned against the blue line with its active compensation model.</text>`);
    FONT_CONTROL_SHEET_CHARS.forEach((ch, i) => {
        const x = labelW + i * colW + colW / 2;
        rows.push(`<text x="${x}" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#555">${html(ch)}</text>`);
    });
    entries.forEach((entry, row) => {
        const y = 72 + row * rowH;
        const comp = new Compensator(entry.tf, entry.params || YS_TEXT_REGULAR);
        const title = fontDisplayName(entry.probe, entry.name);
        const meta = `${entry.kind === 'reference' ? 'reference' : entry.fileName} · ${fontMetricText(entry.probe)} · ${fontInvariantText(entry.invariants)}`;
        rows.push(`<text x="24" y="${y}" font-family="Arial, sans-serif" font-size="12" fill="#222">${html(title)}</text>`);
        rows.push(`<text x="24" y="${y + 16}" font-family="Arial, sans-serif" font-size="8.5" fill="#666">${html(meta)}</text>`);
        rows.push(`<text x="24" y="${y + 30}" font-family="Arial, sans-serif" font-size="8.5" fill="#666">${html(activeFontCoordinatesText(entry))}</text>`);
        FONT_CONTROL_SHEET_CHARS.forEach((ch, i) => {
            const x = labelW + i * colW + colW / 2;
            const baseline = y + 62;
            const dL = controlSheetGlyph(entry, comp, ch, x - 8, baseline, 'L', size);
            const dR = controlSheetGlyph(entry, comp, ch, x + 8, baseline + 34, 'R', size);
            rows.push(`<line x1="${x - 8}" y1="${baseline - 28}" x2="${x - 8}" y2="${baseline + 6}" stroke="#2353db" stroke-width="0.45"/>`);
            rows.push(`<line x1="${x + 8}" y1="${baseline + 6}" x2="${x + 8}" y2="${baseline + 40}" stroke="#2353db" stroke-width="0.45"/>`);
            if (dL) rows.push(`<path d="${html(dL)}" fill="#1c1f22"/>`);
            if (dR) rows.push(`<path d="${html(dR)}" fill="#1c1f22"/>`);
        });
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#f6f6f4"/>
${rows.join('\n')}
</svg>
`;
    downloadText(`keyboarder-font-control-${layoutSlug(sourceLayoutFor(app.settings).meta.name)}.svg`, svg, 'image/svg+xml');
    app._showToast?.('Control sheet exported');
}

function initNewLayoutImport(app) {
    document.getElementById('newLayoutBtn')?.addEventListener('click', () => {
        openNewLayoutSvgPicker();
    });
}

function openNewLayoutSvgPicker() {
    document.getElementById('drawingSvgInput')?.click();
}

async function createNewLayoutFromSvgFile(app, file) {
    if (!file) return;
    if (!/\.svg$/i.test(file.name || '') && !/svg/i.test(file.type || '')) {
        await app.dialog?.alert({
            title: 'Layout import failed',
            text: 'Choose an SVG drawing.',
            okText: 'Close'
        });
        return;
    }
    try {
        const analysis = analyzeSvgBlueprint(await file.text());
        if (!analysis.elements.lines) throw new Error('No SVG lines were found in the blueprint group.');
        const draft = analysis.layoutDraft;
        if (!draft?.layout) throw new Error('No usable keyboard layout draft was detected.');
        addSvgImportContentStats(analysis);
        const warnings = analysis.diagnostics?.warnings || [];
        if (warnings.length) {
            const result = await app.dialog?.show({
                title: 'Layout not created',
                text: svgImportReportHtml(file.name || 'drawing.svg', analysis, {
                    intro: 'Keyboarder found warning-level issues in this drawing. Fix the SVG or inspect the draft before creating a preset.'
                }),
                html: true,
                buttons: [
                    { id: 'ok', text: 'Close', type: 'primary' },
                    { id: 'report', text: 'Report JSON', type: 'secondary' }
                ]
            });
            if (result?.action === 'report') exportSvgImportReport(file.name || 'drawing.svg', analysis);
            return;
        }
        if (!(await guardUnsavedBeforeNewLayout(app))) return;
        const customLayout = namedCustomLayout(draft.layout, file.name, app);
        openImportedCustomLayout(app, customLayout);
        app._showToast?.(svgImportToastText(customLayout.meta.name, draft.stats));
    } catch (e) {
        await app.dialog?.alert({
            title: 'Layout import failed',
            text: e?.message || 'Could not read this SVG drawing.',
            okText: 'Close'
        });
    }
}

function addSvgImportContentStats(analysis) {
    const draft = analysis?.layoutDraft;
    if (!draft?.layout) return null;
    const content = generatedContentStatsForLayout(draft.layout);
    draft.stats = {
        ...(draft.stats || {}),
        content
    };
    return content;
}

function svgImportToastText(layoutName, stats = {}) {
    const content = stats?.content || {};
    const parts = [
        `New layout ${layoutName}`,
        `${stats.keys || 0} keys`
    ];
    if (stats.layoutProfile) parts.push(stats.layoutProfile);
    if (Number.isFinite(content.alphaDualKeys)) parts.push(`${content.alphaDualKeys} alpha-dual`);
    if (Number.isFinite(content.placeholderKeys)) parts.push(`${content.placeholderKeys} placeholders`);
    return parts.join(' · ');
}

async function guardUnsavedBeforeNewLayout(app) {
    if (typeof app._guardUnsaved === 'function') return await app._guardUnsaved();
    return true;
}

function installSuggestedPresetSave(app) {
    if (app.__keyboarderSuggestedPresetSave || typeof app.savePreset !== 'function') return;
    const originalSavePreset = app.savePreset.bind(app);
    app.savePreset = async () => {
        if (!app.presets?.isEphemeral || !app.dialog) return await originalSavePreset();
        const wasShared = app.presets.isShared;
        const name = await app.dialog.prompt({
            title: 'Save preset',
            value: suggestedPresetName(app),
            placeholder: 'Preset name',
            confirmText: 'Save'
        });
        if (!name) return false;
        let res = wasShared
            ? app.presets.saveSharedToLibrary(name, { overwrite: false })
            : app.presets.saveAs(name);
        if (!res.ok && res.reason === 'exists') {
            const replace = await app.dialog.confirm({
                title: 'Replace preset?',
                text: `"${name}" already exists.`,
                confirmText: 'Replace',
                danger: true
            });
            if (!replace) return false;
            res = wasShared
                ? app.presets.saveSharedToLibrary(name, { overwrite: true })
                : app.presets.saveAs(name, { overwrite: true });
        }
        app._refreshChrome?.();
        return !!res.ok;
    };
    app.__keyboarderSuggestedPresetSave = true;
}

function namedCustomLayout(layout, fileName, app) {
    const customLayout = clonePlain(layout);
    const proposed = layoutNameFromSvgFile(fileName);
    customLayout.meta = {
        ...(customLayout.meta || {}),
        name: uniqueCustomLayoutName(proposed, app),
        formFactor: customLayout.meta?.formFactor || 'custom',
        source: 'svg-blueprint'
    };
    return customLayout;
}

function layoutNameFromSvgFile(fileName = '') {
    const base = String(fileName || '')
        .replace(/\.[^.]+$/i, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
    return base || 'IMPORTED_SVG';
}

function uniqueCustomLayoutName(name, app) {
    const base = LAYOUTS[name] ? `${name}_CUSTOM` : name;
    return uniqueName(base, (candidate) => !!LAYOUTS[candidate] || !!app?.presetStore?.has?.(candidate));
}

function suggestedPresetName(app) {
    const layout = sourceLayoutFor(app?.settings || {});
    if (!layout || isReferenceLayout(layout) || LAYOUTS[layout.meta?.name]) return '';
    return uniqueName(layout.meta.name, (candidate) => !!app?.presetStore?.has?.(candidate));
}

function uniqueName(name, isTaken) {
    const base = String(name || 'IMPORTED_SVG').trim() || 'IMPORTED_SVG';
    if (typeof isTaken !== 'function' || !isTaken(base)) return base;
    let i = 2;
    while (isTaken(`${base}_${i}`)) i += 1;
    return `${base}_${i}`;
}

function openImportedCustomLayout(app, customLayout) {
    if (!isLayoutLike(customLayout)) return;
    SELECTION = { active: 0, indices: [0] };
    LAST_DELETED_EDIT_ID = null;
    LAST_DELETED_ROW_ID = null;
    if (app.presets) app.presets.openNew(app.settingsStore.getDefaults());
    const values = {
        customLayout,
        layoutName: customLayout.meta.name,
        ...gridMmFor(customLayout),
        layoutEdits: {},
        contentEdits: {},
        languageLayer: 'dual',
        showDrawing: false,
        showRef: false,
        showDiff: false
    };
    app.settingsStore.setMultiple(values);
    syncSliderValues(app, values);
    syncLayoutSelect(app.settings);
    syncLanguageLayerSelect(app.settings);
    app.renderNow();
    app.presets?.commit('new-layout-from-svg');
}

function svgImportReportHtml(fileName, analysis, options = {}) {
    const warnings = analysis?.diagnostics?.warnings || [];
    const notices = analysis?.diagnostics?.notices || [];
    const rows = [
        ['File', fileName || 'drawing.svg'],
        ...blueprintSummaryLines(analysis).map((line, i) => [i === 0 ? 'Data' : '', line])
    ];
    return `<div class="svg-import-report">
        ${options.intro ? `<p>${html(options.intro)}</p>` : ''}
        <dl>${rows.map(([label, value]) => `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`).join('')}</dl>
        ${svgImportPreviewHtml(analysis)}
        ${svgImportIssueListHtml('Warnings', warnings, analysis)}
        ${svgImportIssueListHtml('Notes', notices, analysis, { limit: 8 })}
    </div>`;
}

function svgImportPreviewHtml(analysis) {
    const keys = (analysis?.recognized?.keys || []).filter((key) =>
        [key.x, key.y, key.w, key.h].every(Number.isFinite));
    if (!keys.length) return '';
    const bounds = rectBounds(keys);
    if (!bounds) return '';
    const issueLevels = svgImportIssueLevels(analysis);
    const pad = Math.max(6, Math.max(bounds.w, bounds.h) * 0.04);
    const viewBox = [
        round(bounds.x - pad, 3),
        round(bounds.y - pad, 3),
        round(bounds.w + pad * 2, 3),
        round(bounds.h + pad * 2, 3)
    ].join(' ');
    const fontSize = round(Math.max(8, Math.min(14, bounds.h / 18)), 3);
    const rects = keys.map((key) => {
        const level = issueLevels.get(key.i) || 'ok';
        const label = level === 'ok' ? '' : String(key.i + 1);
        const text = label
            ? `<text class="svg-import-preview-label" x="${round(key.x + key.w / 2, 3)}" y="${round(key.y + key.h / 2, 3)}" font-size="${fontSize}">${html(label)}</text>`
            : '';
        return `<g class="svg-import-preview-key is-${html(level)}">
            <rect x="${round(key.x, 3)}" y="${round(key.y, 3)}" width="${round(key.w, 3)}" height="${round(key.h, 3)}" rx="2" ry="2"/>
            ${text}
        </g>`;
    }).join('');
    return `<section class="svg-import-preview">
        <h3 class="verify-h">Key Review</h3>
        <svg viewBox="${viewBox}" role="img" aria-label="Detected keyboard keys">${rects}</svg>
        <div class="svg-import-preview-legend">
            <span><i class="is-warning"></i>Warning</span>
            <span><i class="is-notice"></i>Note</span>
            <span><i class="is-ok"></i>Detected</span>
        </div>
    </section>`;
}

function svgImportIssueLevels(analysis) {
    const levels = new Map();
    for (const index of analysis?.diagnostics?.suspiciousKeyIndices || []) levels.set(index, 'warning');
    for (const issue of analysis?.diagnostics?.warnings || []) {
        if (issue.keyIndex != null) levels.set(issue.keyIndex, 'warning');
    }
    for (const issue of analysis?.diagnostics?.notices || []) {
        if (issue.keyIndex != null && !levels.has(issue.keyIndex)) levels.set(issue.keyIndex, 'notice');
    }
    return levels;
}

function rectBounds(rects = []) {
    const xs = rects.map((r) => r.x);
    const ys = rects.map((r) => r.y);
    const rights = rects.map((r) => r.x + r.w);
    const bottoms = rects.map((r) => r.y + r.h);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const right = Math.max(...rights);
    const bottom = Math.max(...bottoms);
    if (![x, y, right, bottom].every(Number.isFinite) || right <= x || bottom <= y) return null;
    return { x, y, w: right - x, h: bottom - y };
}

function svgImportIssueListHtml(title, issues = [], analysis, { limit = 12 } = {}) {
    if (!issues.length) return '';
    const visible = issues.slice(0, limit);
    const more = issues.length > visible.length ? [`${issues.length - visible.length} more`] : [];
    const items = [...visible.map((issue) => svgImportIssueText(issue, analysis)), ...more];
    return `<section><h3 class="verify-h">${html(title)}</h3><ul>${items.map((item) => `<li>${html(item)}</li>`).join('')}</ul></section>`;
}

function svgImportIssueText(issue = {}, analysis) {
    const key = svgImportIssueKey(issue, analysis);
    const suffix = key ? ` (${key})` : '';
    return `${issue.message || issue.code || 'Issue'}${suffix}`;
}

function svgImportIssueKey(issue = {}, analysis) {
    if (issue.keyIndex == null) return '';
    const key = (analysis?.recognized?.keys || []).find((candidate) => candidate.i === issue.keyIndex);
    if (!key) return `key ${issue.keyIndex + 1}`;
    return `key ${issue.keyIndex + 1}: x ${round(key.x, 2)}, y ${round(key.y, 2)}, w ${round(key.w, 2)}, h ${round(key.h, 2)}`;
}

function exportSvgImportReport(fileName, analysis) {
    const base = layoutSlug(String(fileName || 'drawing').replace(/\.svg$/i, ''));
    downloadJSON(`keyboarder-${base}-import-report.json`, svgImportReportData(fileName, analysis));
}

function svgImportReportData(fileName, analysis) {
    const diagnostics = analysis?.diagnostics || {};
    return {
        file: fileName || 'drawing.svg',
        summary: blueprintSummaryLines(analysis),
        groups: clonePlain(analysis?.groups || {}),
        elements: clonePlain(analysis?.elements || {}),
        calibration: clonePlain(analysis?.calibration || null),
        recognized: {
            keys: analysis?.recognized?.keys?.length || 0,
            raw: analysis?.recognized?.raw?.length || 0,
            cornerOffset: analysis?.recognized?.cornerOffset ?? null,
            estimatedGrid: clonePlain(analysis?.recognized?.estimatedGrid || null),
            stacks: analysis?.recognized?.stackCells?.length || 0
        },
        diagnostics: {
            ok: !!diagnostics.ok,
            warnings: (diagnostics.warnings || []).map((issue) => svgImportReportIssue(issue, analysis)),
            notices: (diagnostics.notices || []).map((issue) => svgImportReportIssue(issue, analysis)),
            suspiciousKeyIndices: [...(diagnostics.suspiciousKeyIndices || [])],
            suspiciousKeys: diagnostics.suspiciousKeys || 0
        },
        draft: clonePlain(analysis?.layoutDraft?.stats || null)
    };
}

function svgImportReportIssue(issue = {}, analysis) {
    return {
        code: issue.code || '',
        message: issue.message || '',
        keyIndex: issue.keyIndex ?? null,
        key: issue.keyIndex == null ? null : svgImportReportKey(issue.keyIndex, analysis)
    };
}

function svgImportReportKey(index, analysis) {
    const key = (analysis?.recognized?.keys || []).find((candidate) => candidate.i === index);
    if (!key) return null;
    return {
        x: round(key.x, 4),
        y: round(key.y, 4),
        w: round(key.w, 4),
        h: round(key.h, 4),
        rowSpan: key.rowSpan || 1,
        stackIndex: key.stackIndex ?? null,
        stackCount: key.stackCount ?? null
    };
}

function appendSessionFontDefs(create, svg, s) {
    if (normalizeLegendTextMode(s.legendTextMode) !== 'text') return;
    const fonts = [...FONT_REGISTRY.values()].filter((entry) => entry.kind === 'session' && entry.dataUrl);
    if (!fonts.length) return;
    const defs = create('defs', { id: 'font-faces' });
    const style = create('style', { type: 'text/css' });
    style.textContent = fonts.map((entry) =>
        `@font-face{font-family:"${entry.cssFamily}";src:url("${entry.dataUrl}") format("${fontFormatFor(entry.fileName)}");font-weight:1 1000;font-stretch:50% 200%;font-style:normal;}`).join('\n');
    defs.appendChild(style);
    svg.appendChild(defs);
}

function renderLegendText(create, el, fill) {
    const entry = fontEntryForElement(el);
    const variation = fontVariationSettings(entry);
    const text = create('text', {
        x: el.bx,
        y: el.by,
        fill,
        'font-family': legendFontFamilyForElement(el),
        'font-size': el.size,
        'font-weight': 400,
        'letter-spacing': `${el.tracking || 0}em`,
        'font-kerning': 'normal',
        'text-rendering': 'geometricPrecision',
        'data-font-id': entry?.id || '',
        'xml:space': 'preserve'
    });
    if (variation) text.setAttribute('style', `font-variation-settings:${variation}`);
    text.textContent = el.text || '';
    return text;
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
    const addRowButton = document.getElementById('addRowBtn');
    const deleteRowButton = document.getElementById('deleteRowBtn');
    const restoreRowButton = document.getElementById('restoreRowBtn');
    if (!editor || !input) return;

    const sourceLayout = sourceLayoutFor(s);
    const active = activeKey(keys);
    const edits = sanitizeLayoutEditsForLayout(s.layoutEdits || {}, sourceLayout);
    const restoreId = restoreTargetEditId(edits, sourceLayout);
    const restoreRowId = restoreTargetRowId(edits, sourceLayout);
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
        deleteButton.disabled = !active || !!active.geometry?.layoutLocked;
        deleteButton.title = active?.geometry?.layoutLocked ? 'Stacked imported key geometry is locked.' : active ? `Delete ${keyLabel(active)}` : '';
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
    if (addRowButton) {
        const canAddRow = canAddRowBelow(s, active);
        addRowButton.disabled = !canAddRow;
        addRowButton.title = canAddRow ? `Add row below ${rowEditLabel(rowEditId(sourceRowOfKey(active)), sourceLayout.rows.length)}` : '';
    }
    if (deleteRowButton) {
        const canDelete = canDeleteActiveRow(s, active);
        deleteRowButton.disabled = !canDelete;
        deleteRowButton.title = canDelete ? `Delete ${rowEditLabel(rowEditId(sourceRowOfKey(active)), sourceLayout.rows.length)}` : '';
    }
    if (restoreRowButton) {
        restoreRowButton.disabled = !restoreRowId;
        restoreRowButton.title = restoreRowId ? `Restore ${rowEditLabel(restoreRowId, sourceLayout.rows.length)}` : '';
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
    const next = sanitizeLayoutEditsForSettings(app.settings, app.settings.layoutEdits || {});
    writeKeyWidthEdit(next, active, widthMm);
    app.settingsStore.set('layoutEdits', next);
}

function resetKeyWidthEdit(app) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    if (!active) return;
    const next = sanitizeLayoutEditsForSettings(app.settings, app.settings.layoutEdits || {});
    if (!next[active.editId]) return;
    delete next[active.editId].widthMm;
    if (!Object.keys(next[active.editId]).length) delete next[active.editId];
    app.settingsStore.set('layoutEdits', next);
}

function isAddedEditId(editId) {
    return String(editId || '').startsWith('add:');
}

function nextAddedKeyId(edits, k) {
    const prefix = `add:${sourceRowOfKey(k)}:${sourceBlockOfKey(k)}:`;
    let n = 1;
    while (edits[`${prefix}${n}`]) n++;
    return `${prefix}${n}`;
}

function selectKeyByEditId(app, editId) {
    const keys = layoutFor(app.settings).keys;
    const index = keys.findIndex((k) => k.editId === editId);
    if (index >= 0) selectKey(app, index);
}

function proposedAddKeyEdits(edits, k, side = 'after', layout = LCAKB23) {
    const next = sanitizeLayoutEditsForLayout(edits, layout);
    const id = nextAddedKeyId(next, k);
    next[id] = side === 'before'
        ? { added: true, before: k.editId }
        : { added: true, after: k.editId };
    return { id, edits: next };
}

function rectsOverlap(a, b) {
    const eps = 0.0005;
    return a.x < b.x + b.w - eps
        && a.x + a.w > b.x + eps
        && a.y < b.y + b.h - eps
        && a.y + a.h > b.y + eps;
}

function layoutKeysFit(keys) {
    if (!keys.every((k) => toMm(k.w) >= MIN_KEY_WIDTH_MM - 0.0005)) return false;
    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            if (rectsOverlap(keys[i], keys[j])) return false;
        }
    }
    return true;
}

function layoutEditsFit(settings, edits) {
    try {
        const sourceLayout = sourceLayoutFor(settings);
        const layout = layoutWithEdits(sourceLayout, edits, gridFrom(settings));
        const { keys } = buildLayout(layout, gridFrom(settings));
        return layoutKeysFit(keys);
    } catch (_) {
        return false;
    }
}

function canAddKeyNear(settings, active, side = 'after') {
    if (active?.geometry?.layoutLocked || !active?.geometry?.rowHasFlex || isAddedEditId(active.editId)) return false;
    const { edits } = proposedAddKeyEdits(settings.layoutEdits || {}, active, side, sourceLayoutFor(settings));
    return layoutEditsFit(settings, edits);
}

function rowBlockKeys(keys, active) {
    if (!active) return [];
    return keys
        .filter((k) => k.row === active.row && (k.block || '') === (active.block || ''))
        .sort((a, b) => (a.x - b.x) || (a.i - b.i));
}

function proposedMoveKeyEdits(edits, keys, active, direction, layout = LCAKB23) {
    if (!active || active.geometry?.layoutLocked || !active.editId || ![-1, 1].includes(direction)) return null;
    const group = rowBlockKeys(keys, active);
    const pos = group.findIndex((k) => k.editId === active.editId);
    const nextPos = pos + direction;
    if (pos < 0 || nextPos < 0 || nextPos >= group.length) return null;
    const order = group.map((k) => k.editId);
    [order[pos], order[nextPos]] = [order[nextPos], order[pos]];
    const next = sanitizeLayoutEditsForLayout(edits, layout);
    next[rowOrderEditId(sourceRowOfKey(active), sourceBlockOfKey(active))] = { order };
    return { edits: next, editId: active.editId };
}

function canMoveKeyInRow(settings, keys, active, direction) {
    const proposed = proposedMoveKeyEdits(settings.layoutEdits || {}, keys, active, direction, sourceLayoutFor(settings));
    return !!proposed && layoutEditsFit(settings, proposed.edits);
}

function moveActiveKeyInRow(app, direction) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    const proposed = proposedMoveKeyEdits(app.settings.layoutEdits || {}, keys, active, direction, sourceLayoutFor(app.settings));
    if (!proposed || !layoutEditsFit(app.settings, proposed.edits)) return;
    app.settingsStore.set('layoutEdits', proposed.edits);
    setTimeout(() => selectKeyByEditId(app, proposed.editId), 0);
}

function addKeyNearActive(app, side = 'after') {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    if (!canAddKeyNear(app.settings, active, side)) return;
    const { id, edits } = proposedAddKeyEdits(app.settings.layoutEdits || {}, active, side, sourceLayoutFor(app.settings));
    app.settingsStore.set('layoutEdits', edits);
    setTimeout(() => selectKeyByEditId(app, id), 0);
}

function deletedEditIds(edits, layout = LCAKB23) {
    const clean = sanitizeLayoutEditsForLayout(edits, layout);
    return Object.keys(clean).filter((id) => clean[id]?.deleted && !isRowEditId(id));
}

function restoreTargetEditId(edits, layout = LCAKB23) {
    const ids = deletedEditIds(edits, layout);
    if (LAST_DELETED_EDIT_ID && ids.includes(LAST_DELETED_EDIT_ID)) return LAST_DELETED_EDIT_ID;
    return ids[ids.length - 1] || null;
}

function deletedRowIds(edits, layout = LCAKB23) {
    const clean = sanitizeLayoutEditsForLayout(edits, layout);
    return Object.keys(clean).filter((id) => clean[id]?.deleted && isRowEditId(id));
}

function restoreTargetRowId(edits, layout = LCAKB23) {
    const ids = deletedRowIds(edits, layout);
    if (LAST_DELETED_ROW_ID && ids.includes(LAST_DELETED_ROW_ID)) return LAST_DELETED_ROW_ID;
    return ids[ids.length - 1] || null;
}

function rowEditLabel(editId, sourceRowCount = LCAKB23.rows.length) {
    const row = Number(String(editId || '').split(':')[1]);
    if (!Number.isFinite(row)) return 'R?';
    if (row >= sourceRowCount) return `added row #${row - sourceRowCount + 1}`;
    return `R${row + 1}`;
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
    if (!active || active.geometry?.layoutLocked) return;
    const next = sanitizeLayoutEditsForSettings(app.settings, app.settings.layoutEdits || {});
    next[active.editId] = { ...(next[active.editId] || {}), deleted: true };
    LAST_DELETED_EDIT_ID = active.editId;
    app.settingsStore.set('layoutEdits', next);
}

function restoreDeletedKey(app) {
    const sourceLayout = sourceLayoutFor(app.settings);
    const next = sanitizeLayoutEditsForLayout(app.settings.layoutEdits || {}, sourceLayout);
    const editId = restoreTargetEditId(next, sourceLayout);
    if (!editId || !next[editId]) return;
    delete next[editId].deleted;
    if (!Object.keys(next[editId]).length) delete next[editId];
    if (LAST_DELETED_EDIT_ID === editId) LAST_DELETED_EDIT_ID = null;
    app.settingsStore.set('layoutEdits', next);
}

function proposedDeleteRowEdits(edits, sourceRow, layout = LCAKB23) {
    if (!Number.isInteger(sourceRow)) return null;
    const next = sanitizeLayoutEditsForLayout(edits, layout);
    const id = rowEditId(sourceRow);
    next[id] = { ...(next[id] || {}), deleted: true };
    return { id, edits: next };
}

function visibleRowCountAfter(edits, layout = LCAKB23) {
    const clean = sanitizeLayoutEditsForLayout(edits, layout);
    let count = 0;
    layout.rows.forEach((_, rowIndex) => {
        if (!clean[rowEditId(rowIndex)]?.deleted) count++;
    });
    return count;
}

function canDeleteActiveRow(settings, active) {
    const sourceLayout = sourceLayoutFor(settings);
    const sourceRow = sourceRowOfKey(active);
    const proposed = proposedDeleteRowEdits(settings.layoutEdits || {}, sourceRow, sourceLayout);
    if (!proposed || visibleRowCountAfter(proposed.edits, sourceLayout) < 1) return false;
    return layoutEditsFit(settings, proposed.edits);
}

function proposedAddRowEdits(edits, active, layout = LCAKB23) {
    const sourceRow = sourceRowOfKey(active);
    if (!Number.isInteger(sourceRow) || sourceRow < 0 || sourceRow >= layout.rows.length) return null;
    const next = sanitizeLayoutEditsForLayout(edits, layout);
    const id = nextAddedRowId(next);
    next[id] = { rowAdded: true, afterRow: sourceRow, templateRow: sourceRow };
    return { id, sourceRow: addedRowSourceRow(id, layout.rows.length), edits: next };
}

function canAddRowBelow(settings, active) {
    const proposed = proposedAddRowEdits(settings.layoutEdits || {}, active, sourceLayoutFor(settings));
    return !!proposed && layoutEditsFit(settings, proposed.edits);
}

function selectFirstKeyInSourceRow(app, sourceRow) {
    const keys = layoutFor(app.settings).keys;
    const index = keys.findIndex((k) => sourceRowOfKey(k) === sourceRow);
    if (index >= 0) selectKey(app, index);
}

function deleteActiveRow(app) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    const sourceRow = sourceRowOfKey(active);
    if (!canDeleteActiveRow(app.settings, active)) return;
    const { id, edits } = proposedDeleteRowEdits(app.settings.layoutEdits || {}, sourceRow, sourceLayoutFor(app.settings));
    LAST_DELETED_ROW_ID = id;
    app.settingsStore.set('layoutEdits', edits);
    setTimeout(() => {
        const nextKeys = layoutFor(app.settings).keys;
        selectKey(app, Math.min(active?.i || 0, nextKeys.length - 1));
    }, 0);
}

function addRowBelowActive(app) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    const proposed = proposedAddRowEdits(app.settings.layoutEdits || {}, active, sourceLayoutFor(app.settings));
    if (!proposed || !layoutEditsFit(app.settings, proposed.edits)) return;
    app.settingsStore.set('layoutEdits', proposed.edits);
    setTimeout(() => selectFirstKeyInSourceRow(app, proposed.sourceRow), 0);
}

function restoreDeletedRow(app) {
    const sourceLayout = sourceLayoutFor(app.settings);
    const next = sanitizeLayoutEditsForLayout(app.settings.layoutEdits || {}, sourceLayout);
    const editId = restoreTargetRowId(next, sourceLayout);
    if (!editId || !next[editId]) return;
    const sourceRow = Number(editId.split(':')[1]);
    delete next[editId].deleted;
    if (!Object.keys(next[editId]).length) delete next[editId];
    if (!layoutEditsFit(app.settings, next)) return;
    if (LAST_DELETED_ROW_ID === editId) LAST_DELETED_ROW_ID = null;
    app.settingsStore.set('layoutEdits', next);
    setTimeout(() => selectFirstKeyInSourceRow(app, sourceRow), 0);
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
    const sig = `${active.editId}|${active.tpl}|${JSON.stringify(elements)}|${fontRegistrySignature()}`;
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
        return '<div class="legend-edit-row" data-kind="ico" data-group="' + html(iconLayerId(el)) + '" data-offset="' + offset + '">'
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
        + `<label><span>Font</span><select class="legend-font-input">${fontOptionsHtml(el.fontId || '')}</select></label>`
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
            group: 'icons',
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
                group: row.dataset.group || 'icons',
                icon: row.querySelector('.legend-icon-input')?.value || ICON_OPTIONS[0] || '',
                w: row.querySelector('.legend-width-input')?.value,
                h: row.querySelector('.legend-height-input')?.value
            });
        }
        return cleanElement({
            ...base,
            text: row.querySelector('.legend-text-input')?.value || '',
            fontId: row.querySelector('.legend-font-input')?.value || '',
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

function installPdfExport(app) {
    if (app.__keyboarderPdfExport) return;
    app.exportPDF = async (filename) => {
        if (!app.exporter || app.target?.type !== 'svg') return;
        const svg = app.target.element;
        const size = typeof app.config?.size === 'function' ? app.config.size(app.settings) : {};
        const width = Number(svg?.getAttribute('width')) || Number(size.width) || 500;
        const height = Number(svg?.getAttribute('height')) || Number(size.height) || 500;
        const format = { width: toMm(width), height: toMm(height) };
        const name = filename || `keyboarder-${layoutSlug(sourceLayoutFor(app.settings).meta.name)}.pdf`;
        try {
            await app.exporter.exportToPDF(svg, name, {
                removeInteractive: true,
                unit: 'mm',
                format
            });
        } catch (e) {
            app.dialog?.alert({
                title: 'PDF export failed',
                text: e?.message || 'Could not export PDF.',
                okText: 'Close'
            });
        }
    };
    app.__keyboarderPdfExport = true;
}

function installCleanExports(app) {
    if (app.__keyboarderCleanExports) return;
    for (const method of ['exportSVG', 'exportPNG', 'exportPDF']) {
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
                SELECTION = { active: previous.active, indices: previous.indices };
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

function activeTypefaceReportMeta() {
    if (!TYPEFACE) return null;
    const entry = activeFontEntry();
    if (!entry || entry.kind === 'reference') return CONTENT.font;
    return {
        family: fontDisplayName(entry.probe, entry.name),
        file: entry.fileName,
        coordinates: clonePlain(entry.coordinates || {}),
        source: 'session-import',
        persisted: false
    };
}

async function buildVerificationReport(settingsSnapshot, settings) {
    const { keys, legends, sourceLayout } = layoutFor(settings);
    if (!isReferenceLayout(sourceLayout)) {
        throw new Error('Verification is available only for the LCAKB23 reference layout.');
    }
    const geometryRaw = compare(keys, await loadReference());
    const legendsRaw = TYPEFACE
        ? compareLegends(legends, (await loadLegendReference()).keys)
        : null;
    return {
        generatedAt: new Date().toISOString(),
        layout: sourceLayout.meta.name,
        settings: settingsSnapshot,
        typeface: activeTypefaceReportMeta(),
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

function exportModelJSON(app) {
    const layoutName = layoutSlug(sourceLayoutFor(app.settings).meta.name);
    downloadJSON(
        `keyboarder-${layoutName}-model.json`,
        buildKeyboardModel(app.settingsStore.toObject(), app.settingsStore.getDefaults())
    );
}

function layoutSlug(name) {
    return String(name || 'layout')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'layout';
}

function openModelJSONPicker() {
    document.getElementById('importJsonInput')?.click();
}

async function importModelJSONFile(app, file) {
    if (!file) return;
    try {
        const preset = parseKeyboardModelJSONText(await file.text(), app.settingsStore.getDefaults());
        if (app.presets?.openShared) app.presets.openShared(preset);
        else app.applyPresetBlob(preset);
        app._showToast?.('JSON imported');
    } catch (e) {
        await app.dialog?.alert({
            title: 'Import failed',
            text: e?.message || 'Could not read this JSON file.',
            okText: 'Close'
        });
    }
}

function downloadJSON(filename, data) {
    downloadText(filename, JSON.stringify(data, null, 2), 'application/json');
}

function downloadText(filename, text, type = 'text/plain') {
    const blob = new Blob([text], { type });
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
    set('statWarnings', layoutWarningText(keys, grid));
}

function layoutWarningText(keys, grid) {
    const oddWidths = keys.filter((k) => {
        const u = widthInU(k.w, grid);
        const nearestQuarter = Math.round(u * 4) / 4;
        return Math.abs(u - nearestQuarter) > 0.01;
    }).length;
    const blankLegends = keys.filter((k) => !k.content && !(k.elements || []).length).length;
    const warnings = [];
    if (oddWidths) warnings.push(`${oddWidths} non-standard widths`);
    if (blankLegends) warnings.push(`${blankLegends} blank legends`);
    return warnings.length ? warnings.join('; ') : 'none';
}

function compensationInfo(s, el) {
    const side = el.slot[1];
    if (!TYPEFACE || (side !== 'L' && side !== 'R')) return null;
    const chars = [...el.text].filter((c) => c !== ' ');
    if (!chars.length) return null;
    const ch = side === 'L' ? chars[0] : chars[chars.length - 1];
    if (Number.isFinite(el.compOverride?.px)) return { ch, source: 'manual', px: el.compOverride.px };
    const comp = compForFontId(s, elementFontId(el));
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
    out += '<table class="legend-elements"><tr><th>Slot</th><th>Element</th><th>Type</th><th>Font</th><th>Comp</th></tr>';
    for (const el of items) {
        if (el.kind === 'txt') {
            const comp = compensationInfo(s, el);
            const compText = comp
                ? `${comp.source} ${comp.px.toFixed(3)}`
                : '—';
            const entry = fontEntryForElement(el);
            const fontText = entry ? fontOptionLabel(entry) : 'default';
            out += '<tr>'
                + `<td>${html(el.slot)}</td>`
                + `<td>${html(el.text)}</td>`
                + `<td>${el.size.toFixed(3)} pt, ${(el.tracking || 0).toFixed(3)} em</td>`
                + `<td>${html(fontText || 'default')}</td>`
                + `<td>${html(compText)}</td>`
                + '</tr>';
        } else {
            out += '<tr>'
                + `<td>${html(el.slot)}</td>`
                + `<td>${html(el.icon)}</td>`
                + `<td>${el.w.toFixed(2)} × ${el.h.toFixed(2)}</td>`
                + '<td>—</td>'
                + '<td>—</td>'
                + '</tr>';
        }
    }
    out += '</table>';
    box.innerHTML = out;
}

export default app;
