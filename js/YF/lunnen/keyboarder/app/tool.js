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
import { installKeyboarderPerf, perfEnabled, perfMarkStartup, perfNow, perfRecord, perfSince } from './perf.js';
import { buildLayout, gapOf, widthInU } from './kb/grid.js';
import { attachGuides } from './kb/guides.js';
import { LAYOUT_OPTIONS, LAYOUTS, LCAKB23 } from './kb/layouts.js';
import { toMm, toPx } from './kb/units.js';
import { loadTypeface, parseFont } from './kb/typography.js?v=20260818-pdf-editable-text-v1';
import { SVGExporter } from '../vendor/framework/src/export/SVGExporter.js?v=20260818-pdf-variable-font-v2';
import { Compensator, YS_TEXT_REGULAR } from './kb/compensate.js';
import { attachContent, buildLegends, textPath } from './kb/legends.js';
import {
    loadReference, loadLegendReference, compare, reportHtml,
    compareLegends, legendsReportHtml, GEOMETRY_TOLERANCE
} from './kb/verify.js';
import { referenceAssetsForLayout, hasReferenceAssets } from './kb/reference-assets.js';
import CONTENT from './kb/content/lcakb23.js';
import { generatedContentForLayout, generatedContentStatsForLayout } from './kb/content/generated-layouts.js';
import ICONS from './kb/icons/lcakb23.js';
import ICON_OPTICS from './kb/icons/lcakb23-optics.js';
import {
    buildKeyboardModel as buildKeyboardModelData,
    cleanElement as cleanElementData,
    cleanElements as cleanElementsData,
    cleanHexColor,
    cleanIconGroup,
    cleanOffset as cleanOffsetData,
    clonePlain,
    clamp,
    finiteOr,
    normalizedPresetBlob as normalizedPresetBlobData,
    presetBlobFromKeyboardModel as presetBlobFromKeyboardModelData,
    roundMm,
    sanitizeCustomIcons as sanitizeCustomIconsData,
    sanitizeContentEdits as sanitizeContentEditsData,
    sanitizeCompensationTableEdits as sanitizeCompensationTableEditsData,
    sanitizeLayoutEdits as sanitizeLayoutEditsData
} from './kb/model-io.js';
import { analyzeSvgBlueprint, blueprintSummaryLines, selectSvgRecognitionPass } from './kb/svg-blueprint.js';

const SIZE_EPS = 0.0001;
const MIN_KEY_WIDTH_MM = 4;
const MAX_KEY_WIDTH_MM = 80;

const TYPE_DEFAULTS = {
    glyphSize: 15.1999,
    fontWeight: 400,
    numpadSize: 13.1732,
    secondarySize: 12.0745,
    wordSize: 9.1199,
    leading: CONTENT.interline,
    trackingOffset: 0
};

const TEXT_STYLE_IDS = ['main', 'symbols01', 'symbols02', 'label', 'function'];
const TEXT_STYLE_NAMES = {
    main: 'Main',
    symbols01: 'Symbols 01',
    symbols02: 'Symbols 02',
    label: 'Label',
    function: 'Function'
};
const STYLE_BY_LEGACY_SIZE = {
    glyphSize: 'main',
    secondarySize: 'symbols01',
    numpadSize: 'symbols02',
    wordSize: 'label'
};
const LEGACY_SIZE_BY_STYLE = {
    main: 'glyphSize',
    symbols01: 'secondarySize',
    symbols02: 'numpadSize',
    label: 'wordSize',
    function: 'wordSize'
};
const STYLE_SCRIPT_KEYS = ['latin', 'cyrillic'];
const TEXT_STYLE_NUMERIC = {
    size: { min: 5, max: 36, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' pt' },
    weight: { min: 100, max: 900, decimals: 0, baseStep: 1, shiftStep: 10, suffix: '' },
    tracking: { min: -0.2, max: 0.2, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' em' },
    leading: { min: 4, max: 36, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' pt' }
};

const NUMERIC_CONTROLS = [
    { inputId: 'colPitchValue', setting: 'colPitch', min: 10, max: 28, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
    { inputId: 'rowPitchValue', setting: 'rowPitch', min: 10, max: 28, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
    { inputId: 'keyWidthValue', setting: 'keyWidth1U', min: 7, max: 26, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
    { inputId: 'keyHeightValue', setting: 'keyHeight', min: 7, max: 26, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
    { inputId: 'radiusValue', setting: 'cornerRadius', min: 0, max: 7, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' },
    { inputId: 'insetValue', setting: 'guideInset', min: 0, max: 6.5, decimals: 3, baseStep: 0.001, shiftStep: 0.01, suffix: ' mm' }
];
const NUMERIC_CONTROL_BY_SETTING = Object.fromEntries(NUMERIC_CONTROLS.map((def) => [def.setting, def]));

const BASE_ICON_OPTIONS = Object.keys(ICONS).sort((a, b) => a.localeCompare(b));
const CUSTOM_ICON_PREFIX = 'custom:';
const SVG_ICON_MAX_BYTES = 200000;
const SVG_ICON_PATH_DATA_RE = /^[MmZzLlHhVvCcSsQqTtAaEe0-9+\-.,\s]+$/;
const TEMPLATE_LABELS = {
    blank: 'Blank',
    'alpha-dual': 'Letters',
    'corner-icon+word': 'Corner icon + label',
    'fkey-icon+label': 'F-row icon + label',
    'icon+word-stack': 'Icon + stacked text',
    'icon-center': 'Centered icon',
    'legend-2corners': 'Two corner labels',
    'legend-corners': 'Corner labels',
    'numpad-tier': 'Numpad tier',
    'other:top-center': 'Top-center text',
    'other:top-left+bot-center': 'Top-left + bottom-center text',
    'status-pair': 'Status pair',
    'word-2line': 'Two-line text',
    'word-bottom': 'Bottom text',
    'word-center': 'Centered text',
    'word-outer': 'Outer text',
    'word-stack': 'Stacked text'
};
const TEMPLATE_ORDER = [
    'blank',
    'alpha-dual',
    'legend-corners',
    'legend-2corners',
    'word-center',
    'word-bottom',
    'word-outer',
    'word-2line',
    'word-stack',
    'icon-center',
    'fkey-icon+label',
    'corner-icon+word',
    'icon+word-stack',
    'numpad-tier',
    'status-pair'
];
const TEMPLATE_VARIANTS = buildTemplateVariants(CONTENT);
const TEMPLATE_BY_ID = new Map(TEMPLATE_VARIANTS.map((v) => [v.id, v]));
const SLOT_GRID_OPTIONS = [
    ['TL', 'TC', 'TR'],
    ['ML', 'MC', 'MR'],
    ['BL', 'BC', 'BR']
];
const SLOT_SPECIAL_OPTIONS = ['FC', 'UC', 'FL', 'FR', 'tC', 'bC', 'tL', 'bL', 'Ml', 'Mr', 'Tr', 'Tl', 'Fr'];
const LEGEND_STARTER_RECIPES = [
    {
        id: 'single-text', label: 'Text', tpl: 'word-bottom',
        elements: [{ slot: 'BC', kind: 'txt', text: '', styleId: 'label', size: TYPE_DEFAULTS.wordSize }],
        preview: [{ slot: 'BC', kind: 'txt', text: 'text' }]
    },
    {
        id: 'letter-pair', label: 'Letters', tpl: 'alpha-dual',
        elements: [
            { slot: 'TL', kind: 'txt', text: '', styleId: 'main', size: TYPE_DEFAULTS.glyphSize },
            { slot: 'BR', kind: 'txt', text: '', styleId: 'main', size: TYPE_DEFAULTS.glyphSize }
        ],
        preview: [{ slot: 'TL', kind: 'txt', text: 'A' }, { slot: 'BR', kind: 'txt', text: 'Я' }]
    },
    {
        id: 'two-lines', label: 'Two lines', tpl: 'word-2line',
        elements: [
            { slot: 'UC', kind: 'txt', text: '', styleId: 'main', size: TYPE_DEFAULTS.glyphSize },
            { slot: 'BC', kind: 'txt', text: '', styleId: 'label', size: TYPE_DEFAULTS.wordSize }
        ],
        preview: [{ slot: 'UC', kind: 'txt', text: 'A' }, { slot: 'BC', kind: 'txt', text: 'label' }]
    },
    {
        id: 'corners', label: 'Corners', tpl: 'legend-corners',
        elements: [
            { slot: 'TL', kind: 'txt', text: '', styleId: 'symbols01', size: TYPE_DEFAULTS.secondarySize },
            { slot: 'BL', kind: 'txt', text: '', styleId: 'symbols01', size: TYPE_DEFAULTS.secondarySize },
            { slot: 'BR', kind: 'txt', text: '', styleId: 'main', size: TYPE_DEFAULTS.glyphSize }
        ],
        preview: [
            { slot: 'TL', kind: 'txt', text: '@' },
            { slot: 'BL', kind: 'txt', text: '2' },
            { slot: 'BR', kind: 'txt', text: 'Б' }
        ]
    },
    {
        id: 'single-icon', label: 'Icon', tpl: 'icon-center',
        elements: [{ slot: 'MC', kind: 'ico', icon: 'emoji', group: 'icons', w: 9.2285, h: 9.2285 }],
        preview: [{ slot: 'MC', kind: 'ico', icon: 'emoji' }]
    },
    {
        id: 'icon-label', label: 'Icon + label', tpl: 'fkey-icon+label',
        elements: [
            { slot: 'FC', kind: 'ico', icon: 'volume-mute', group: 'f-icons', w: 10.108, h: 8.053 },
            { slot: 'BC', kind: 'txt', text: '', styleId: 'function', size: TYPE_DEFAULTS.wordSize }
        ],
        preview: [{ slot: 'FC', kind: 'ico', icon: 'volume-mute' }, { slot: 'BC', kind: 'txt', text: 'F1' }]
    }
];
const LANGUAGE_LAYERS = new Set(['dual', 'latin', 'cyrillic']);
const LEGEND_TEXT_MODES = new Set(['outlines', 'text']);
const SVG_EXPORT_TEXT_MODE_STORAGE_KEY = 'keyboarder.svgExportTextMode';
const ICON_LAYER_IDS = ['icons', 'f-icons'];
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const SINGLE_LATIN_RE = /^[A-Za-z]$/;
const PRESET_NAME_MIGRATIONS = {
    LCAKB23: 'Work 2.0 L',
    LCAKB22: 'Work 2.0 M',
    LCAKB21: 'Work 2.0 S',
    Work_1_L_Pad: 'Work 1.0 L Pad',
    'Work 1 L Pad': 'Work 1.0 L Pad'
};
const REFERENCE_FONT_ID = 'reference';
const REFERENCE_FONT_URL = 'Fonts/YS%20Text%20Variable/YSText-Upright-weight-VF.ttf';
const UI_MODE_STORAGE_KEY = 'keyboarder.uiMode';
let UI_ADVANCED = false;
const REFERENCE_FONT_FAMILY = 'YS Text';
const CUSTOM_FONT_FAMILY_PREFIX = 'Keyboarder Session Font';
const FONT_FILE_RE = /\.(otf|ttf|woff|woff2)$/i;
const FONT_CONTROL_SHEET_CHARS = ['H', 'S', 'O', 'A', 'W', 'X', 'Ж', 'О', '@', '~', '№', ',', '.', '?', '!'];
let FONT_PROBE_HELPERS = null;
let STARTUP_FIRST_RENDER_RECORDED = false;
let CONTENT_DRAG = null;
let SUPPRESS_NEXT_SURFACE_CLICK = false;
const CONTENT_DRAG_START_PX = 6;

function loadFontProbeHelpers() {
    if (!FONT_PROBE_HELPERS) FONT_PROBE_HELPERS = import('./kb/fontprobe.js?v=20260818-svg-outline-toggle-v1');
    return FONT_PROBE_HELPERS;
}

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
    const current = sourceLayoutFor(s);
    if (current && !options.some((option) => option.id === current.meta.name)) {
        options.push({ id: current.meta.name, label: `${current.meta.name} · current preset` });
    }
    return options;
}

function normalizeLanguageLayer(value) {
    const key = String(value || 'dual').trim();
    return LANGUAGE_LAYERS.has(key) ? key : 'dual';
}

function normalizeLegendTextMode(value) {
    const key = String(value || 'text').trim();
    return LEGEND_TEXT_MODES.has(key) ? key : 'text';
}

function initialSvgExportTextMode() {
    if (typeof localStorage === 'undefined') return 'text';
    try {
        return normalizeLegendTextMode(localStorage.getItem(SVG_EXPORT_TEXT_MODE_STORAGE_KEY) || 'text');
    } catch (_) {
        return 'text';
    }
}

function svgExportTextMode() {
    return normalizeLegendTextMode(SVG_EXPORT_TEXT_MODE);
}

function setSvgExportTextMode(app, value) {
    const next = normalizeLegendTextMode(value);
    if (next === SVG_EXPORT_TEXT_MODE) return;
    SVG_EXPORT_TEXT_MODE = next;
    try {
        localStorage.setItem(SVG_EXPORT_TEXT_MODE_STORAGE_KEY, next);
    } catch (_) {
        // Export still works when storage is unavailable.
    }
    app?.renderNow?.();
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

function referenceLayoutFor(layout) {
    const url = referenceAssetsForLayout(layout)?.layout;
    return url ? REFERENCE_LAYOUTS.get(url) || null : null;
}

function referenceVisualFor(layout) {
    const visual = referenceAssetsForLayout(layout)?.visual;
    return visual?.url ? REFERENCE_VISUALS.get(visual.url) || null : null;
}

function ensureReferenceAssetsLoaded(assets, app = null) {
    if (!assets) return;
    if (assets.layout) ensureReferenceJSONLoaded(assets.layout, app);
    if (assets.visual?.url) ensureReferenceVisualLoaded(assets.visual.url, app);
}

function ensureReferenceJSONLoaded(url, app = null) {
    if (REFERENCE_LAYOUTS.has(url) || REFERENCE_PENDING.has(url)) return;
    const pending = loadReference(url)
        .then((data) => {
            REFERENCE_LAYOUTS.set(url, data);
            if (app?.settings && referenceAssetsForLayout(sourceLayoutFor(app.settings))?.layout === url) {
                app.render();
            }
        })
        .catch(() => { /* reference data is optional for rendering */ })
        .finally(() => REFERENCE_PENDING.delete(url));
    REFERENCE_PENDING.set(url, pending);
}

function ensureReferenceVisualLoaded(url, app = null) {
    if (REFERENCE_VISUALS.has(url) || REFERENCE_PENDING.has(url)) return;
    const pending = fetch(url)
        .then((res) => {
            if (!res.ok) throw new Error(`Failed to load reference ${url}: ${res.status} ${res.statusText}`);
            return res.text();
        })
        .then((svgText) => {
            REFERENCE_VISUALS.set(url, svgText);
            if (app?.settings && referenceAssetsForLayout(sourceLayoutFor(app.settings))?.visual?.url === url) {
                app.render();
            }
        })
        .catch(() => { /* visual overlay is optional */ })
        .finally(() => REFERENCE_PENDING.delete(url));
    REFERENCE_PENDING.set(url, pending);
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

const REFERENCE_LAYOUTS = new Map();
const REFERENCE_VISUALS = new Map();
const REFERENCE_PENDING = new Map();

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
let LAST_SVG_IMPORT_REPORT = null;
let TEXT_STYLE_OPEN = new Set(['main']);
let LEGEND_DRAFT = null;
let LEGEND_POPOVER_DRAG = null;
let SVG_EXPORT_TEXT_MODE = initialSvgExportTextMode();

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
    const entry = fontEntryForElement(el);
    applyElementFontCoordinates(entry, el);
    return entry?.tf || TYPEFACE;
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

function exportFontFamily(entry = activeFontEntry()) {
    return String(entry?.probe?.names?.family || entry?.name || REFERENCE_FONT_FAMILY).trim() || REFERENCE_FONT_FAMILY;
}

function legendFontFamilyForElement(el = {}) {
    return exportFontFamily(fontEntryForElement(el));
}

function fontVariationSettings(entry) {
    const axes = entry?.probe?.variations?.axes || [];
    const coordinates = entry?.coordinates || {};
    const parts = axes
        .filter((axis) => Number.isFinite(coordinates[axis.tag]))
        .map((axis) => `"${axis.tag}" ${Number(coordinates[axis.tag]).toFixed(3).replace(/\.?0+$/, '')}`);
    return parts.length ? parts.join(', ') : '';
}

function defaultTextStyle(id) {
    const sizeKey = LEGACY_SIZE_BY_STYLE[id] || 'wordSize';
    return {
        name: TEXT_STYLE_NAMES[id] || id,
        fontId: '',
        size: TYPE_DEFAULTS[sizeKey] ?? TYPE_DEFAULTS.wordSize,
        weight: TYPE_DEFAULTS.fontWeight,
        tracking: TYPE_DEFAULTS.trackingOffset,
        leading: TYPE_DEFAULTS.leading,
        splitScripts: false,
        latin: null,
        cyrillic: null
    };
}

function defaultTextStyles() {
    return Object.fromEntries(TEXT_STYLE_IDS.map((id) => [id, defaultTextStyle(id)]));
}

function normalizeStyleBranch(branch = {}, fallback = {}) {
    const source = branch && typeof branch === 'object' && !Array.isArray(branch) ? branch : {};
    const fontId = cleanRuntimeFontId(source.fontId ?? fallback.fontId ?? '');
    return {
        fontId,
        size: clamp(finiteOr(source.size, fallback.size), TEXT_STYLE_NUMERIC.size.min, TEXT_STYLE_NUMERIC.size.max),
        weight: clamp(finiteOr(source.weight ?? source.fontWeight, fallback.weight), TEXT_STYLE_NUMERIC.weight.min, TEXT_STYLE_NUMERIC.weight.max),
        tracking: clamp(finiteOr(source.tracking, fallback.tracking), TEXT_STYLE_NUMERIC.tracking.min, TEXT_STYLE_NUMERIC.tracking.max),
        leading: clamp(finiteOr(source.leading, fallback.leading), TEXT_STYLE_NUMERIC.leading.min, TEXT_STYLE_NUMERIC.leading.max)
    };
}

function legacyTextStyleFallback(id, legacy = {}) {
    const base = defaultTextStyle(id);
    const sizeKey = LEGACY_SIZE_BY_STYLE[id] || '';
    if (Number.isFinite(Number(legacy[sizeKey]))) base.size = Number(legacy[sizeKey]);
    if (Number.isFinite(Number(legacy.fontWeight))) base.weight = Number(legacy.fontWeight);
    if (Number.isFinite(Number(legacy.trackingOffset))) base.tracking = Number(legacy.trackingOffset);
    if (Number.isFinite(Number(legacy.leading))) base.leading = Number(legacy.leading);
    return base;
}

function normalizeTextStyles(input = {}, legacy = {}) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const out = {};
    for (const id of TEXT_STYLE_IDS) {
        const fallback = legacyTextStyleFallback(id, legacy);
        const raw = source[id] && typeof source[id] === 'object' && !Array.isArray(source[id]) ? source[id] : {};
        const base = normalizeStyleBranch(raw, fallback);
        out[id] = {
            ...base,
            name: String(raw.name || fallback.name || TEXT_STYLE_NAMES[id]).trim().slice(0, 48) || TEXT_STYLE_NAMES[id],
            splitScripts: raw.splitScripts === true,
            latin: null,
            cyrillic: null
        };
        if (out[id].splitScripts) {
            out[id].latin = normalizeStyleBranch(raw.latin, base);
            out[id].cyrillic = normalizeStyleBranch(raw.cyrillic, base);
        }
    }
    return out;
}

function legacyTypeSettingsFromTextStyles(styles = {}) {
    const normalized = normalizeTextStyles(styles, TYPE_DEFAULTS);
    const legacy = {
        glyphSize: normalized.main.size,
        secondarySize: normalized.symbols01.size,
        numpadSize: normalized.symbols02.size,
        wordSize: normalized.label.size,
        fontWeight: normalized.main.weight,
        leading: normalized.label.leading,
        trackingOffset: 0
    };
    return legacy;
}

function textStylesForSettings(s = {}) {
    return normalizeTextStyles(s.textStyles || {}, s);
}

function validTextStyleId(value) {
    const id = String(value || '').trim();
    return TEXT_STYLE_IDS.includes(id) ? id : '';
}

function scriptForText(text = '') {
    return CYRILLIC_RE.test(String(text || '')) ? 'cyrillic' : 'latin';
}

function inferTextStyleId(el = {}, key = null) {
    const explicit = validTextStyleId(el.styleId);
    if (explicit) return explicit;
    if (isFunctionTextElement(el, key)) return 'function';
    const legacy = sizeRole(finiteOr(el.size, NaN));
    return STYLE_BY_LEGACY_SIZE[legacy] || 'label';
}

function isFunctionTextElement(el = {}, key = null) {
    const text = String(el.text || '').trim();
    if (/^F\d{1,2}$/i.test(text)) return true;
    return !!key && key.row === 0 && String(key.block || '') === 'main' && /^F\d{1,2}$/i.test(text);
}

function textStyleForElement(s = {}, el = {}, key = null) {
    const styles = textStylesForSettings(s);
    const id = inferTextStyleId(el, key);
    const base = styles[id] || defaultTextStyle(id);
    const script = scriptForText(el.text || '');
    const branch = base.splitScripts ? base[script] : null;
    return {
        ...base,
        ...(branch || {}),
        id,
        script,
        name: base.name || TEXT_STYLE_NAMES[id]
    };
}

function fontCoordinatesForElement(entry, el = {}) {
    const coordinates = { ...(entry?.coordinates || {}) };
    const axis = weightAxisFor(entry);
    const weight = finiteOr(el.fontWeight, NaN);
    if (axis && Number.isFinite(weight)) {
        coordinates[axis.tag] = clamp(weight, axis.min, axis.max);
    }
    return coordinates;
}

function applyElementFontCoordinates(entry, el = {}) {
    if (!entry?.tf?.setVariations) return;
    entry.tf.setVariations(fontCoordinatesForElement(entry, el));
}

function fontVariationSettingsForElement(entry, el = {}) {
    const axes = entry?.probe?.variations?.axes || [];
    const coordinates = fontCoordinatesForElement(entry, el);
    const parts = axes
        .filter((axis) => Number.isFinite(coordinates[axis.tag]))
        .map((axis) => `"${axis.tag}" ${Number(coordinates[axis.tag]).toFixed(3).replace(/\.?0+$/, '')}`);
    return parts.length ? parts.join(', ') : '';
}

function fontWeightFromSettings(s = {}) {
    const styles = textStylesForSettings(s);
    return clamp(finiteOr(styles.main?.weight, finiteOr(s.fontWeight, TYPE_DEFAULTS.fontWeight)), 100, 900);
}

function weightAxisFor(entry) {
    return entry?.probe?.variations?.axes?.find((axis) => axis.tag === 'wght') || null;
}

function widthAxisFor(entry) {
    return entry?.probe?.variations?.axes?.find((axis) => axis.tag === 'wdth') || null;
}

function fontWeightForElement(entry, el = {}, s = {}) {
    const axis = weightAxisFor(entry);
    if (axis) {
        return clamp(finiteOr(el.fontWeight, fontWeightFromSettings(s)), Math.max(1, axis.min), Math.min(1000, axis.max));
    }
    return clamp(finiteOr(entry?.probe?.metrics?.weightClass?.value, 400), 1, 1000);
}

function fontStretchForElement(entry, el = {}) {
    const axis = widthAxisFor(entry);
    if (axis) {
        const coordinates = fontCoordinatesForElement(entry, el);
        return `${compactNumber(clamp(finiteOr(coordinates[axis.tag], axis.default), 50, 200), 3)}%`;
    }
    const widthClass = Math.round(finiteOr(entry?.probe?.metrics?.widthClass?.value, 5));
    const widths = { 1: 50, 2: 62.5, 3: 75, 4: 87.5, 5: 100, 6: 112.5, 7: 125, 8: 150, 9: 200 };
    return `${widths[widthClass] || 100}%`;
}

function fontStyleForElement(entry, el = {}) {
    const coordinates = fontCoordinatesForElement(entry, el);
    if (Number(coordinates.ital) >= 0.5) return 'italic';
    if (Number.isFinite(coordinates.slnt) && coordinates.slnt !== 0) return 'oblique';
    const subfamily = String(entry?.probe?.names?.subfamily || '').toLowerCase();
    const italicAngle = finiteOr(entry?.probe?.metrics?.italicAngle?.value, 0);
    return /italic/.test(subfamily) ? 'italic' : (/oblique/.test(subfamily) || italicAngle !== 0 ? 'oblique' : 'normal');
}

function syncFontWeightSetting(s = {}) {
    let changed = false;
    for (const entry of FONT_REGISTRY.values()) {
        const axis = weightAxisFor(entry);
        if (!axis) continue;
        const value = clamp(fontWeightFromSettings(s), axis.min, axis.max);
        if (!Number.isFinite(value)) continue;
        if (Math.abs((entry.coordinates?.[axis.tag] ?? axis.default ?? 0) - value) < 0.001) continue;
        entry.coordinates = { ...(entry.coordinates || {}), [axis.tag]: value };
        entry.tf?.setVariations?.(entry.coordinates);
        entry.instanceName = matchingFontInstance(entry)
            ? entry.probe.variations.instances[Number(matchingFontInstance(entry))]?.name || ''
            : '';
        changed = true;
    }
    if (!changed) return;
    TYPEFACE_SIG = fontRegistrySignature();
    COMP_CACHE.clear();
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

function compForFontId(s, fontId = ACTIVE_FONT_ID, el = null) {
    if (!TYPEFACE || s.compensationMode === 'off') return null;
    const id = FONT_REGISTRY.has(fontId) ? fontId : ACTIVE_FONT_ID;
    const entry = fontEntry(id) || activeFontEntry();
    if (!entry?.tf) return null;
    const mode = s.compensationMode || 'table';
    const edits = mode === 'table' ? sanitizeCompensationTableEditsData(s.compensationTableEdits || {}) : {};
    const coordinates = el ? fontCoordinatesForElement(entry, el) : (entry.coordinates || {});
    const sig = `${entry.signature}:${JSON.stringify(coordinates)}:${mode}:${JSON.stringify(edits)}`;
    if (!COMP_CACHE.has(sig)) {
        entry.tf.setVariations?.(coordinates);
        const base = compensationBaseForFontId(id);
        const params = mode === 'model'
            ? { ...base, table: {} }
            : { ...base, table: compensationTableWithEdits(base.table || {}, edits) };
        COMP_CACHE.set(sig, new Compensator(entry.tf, params));
    }
    entry.tf.setVariations?.(coordinates);
    return COMP_CACHE.get(sig);
}

function compFor(s) {
    return compForFontId(s, ACTIVE_FONT_ID);
}

function compForElement(s, el = {}) {
    return compForFontId(s, elementFontId(el), el);
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
    fontWeight: s.fontWeight,
    numpadSize: s.numpadSize,
    secondarySize: s.secondarySize,
    wordSize: s.wordSize,
    leading: s.leading,
    trackingOffset: s.trackingOffset,
    textStyles: textStylesForSettings(s),
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
            const style = textStyleForElement(s, el, k);
            const role = STYLE_BY_LEGACY_SIZE[sizeRole(el.size)] || style.id || 'custom';
            const fontId = cleanRuntimeFontId(style.fontId) || cleanRuntimeFontId(el.fontId);
            return {
                ...el,
                styleId: style.id,
                styleName: style.name,
                script: style.script,
                fontId,
                fontWeight: style.weight,
                size: style.size,
                tracking: (el.tracking || 0) + (style.tracking || 0),
                leading: style.leading,
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
 * Пересчёт раскладки разбит на три кеша: geometry -> content -> legend placement.
 * Внешний `layoutFor()` остаётся единой точкой входа для UI.
 */
let geometryCached = { sig: null, data: null };
let contentCached = { sig: null, data: null };
let legendCached = { sig: null, data: null };
let layoutCached = { sig: null, data: null };
const LAYOUT_SHAPE_SIG_CACHE = new WeakMap();

function invalidateLayoutCaches() {
    geometryCached.sig = null;
    contentCached.sig = null;
    legendCached.sig = null;
    layoutCached.sig = null;
}

function layoutShapeSig(layout) {
    if (layout && typeof layout === 'object' && LAYOUT_SHAPE_SIG_CACHE.has(layout)) {
        return LAYOUT_SHAPE_SIG_CACHE.get(layout);
    }
    const sig = JSON.stringify({
        name: layout?.meta?.name || '',
        gridOrigin: layout?.grid?.origin || null,
        blocks: layout?.blocks || [],
        rows: layout?.rows || [],
        artboard: layout?.artboard || null
    });
    if (layout && typeof layout === 'object') LAYOUT_SHAPE_SIG_CACHE.set(layout, sig);
    return sig;
}

function geometrySigFrom(sourceLayout, grid, layoutEdits) {
    return layoutShapeSig(sourceLayout) + JSON.stringify(grid) + JSON.stringify(layoutEdits || {});
}

function contentSigFrom(s, geometrySig) {
    return geometrySig + JSON.stringify({
        glyphSize: s.glyphSize,
        fontWeight: s.fontWeight,
        numpadSize: s.numpadSize,
        secondarySize: s.secondarySize,
        wordSize: s.wordSize,
        trackingOffset: s.trackingOffset,
        textStyles: textStylesForSettings(s),
        languageLayer: normalizeLanguageLayer(s.languageLayer),
        contentEdits: s.contentEdits || {}
    });
}

function legendSigFrom(s, contentSig) {
    return contentSig + TYPEFACE_SIG + JSON.stringify({
        fontWeight: s.fontWeight,
        leading: s.leading,
        compensationMode: s.compensationMode,
        compensationTableEdits: s.compensationTableEdits || {}
    });
}

function geometryFor(sourceLayout, grid, layoutEdits, sig) {
    if (geometryCached.sig !== sig) {
        const editedLayout = layoutWithEdits(sourceLayout, layoutEdits, grid);
        let renderLayout = editedLayout;
        let data;
        try {
            data = buildLayout(renderLayout, grid);
        } catch (e) {
            console.warn('Keyboarder: layout edits were ignored because the row no longer fits.', e);
            renderLayout = sourceLayout;
            data = buildLayout(renderLayout, grid);
        }
        assignEditIds(data.keys);
        annotateGeometry(data.keys, sourceLayout, renderLayout, grid, layoutEdits);
        attachGuides(data.keys, grid.guideInset);
        data.sourceLayout = sourceLayout;
        data.renderLayout = renderLayout;
        geometryCached = { sig, data };
    }
    return geometryCached.data;
}

function contentForGeometry(s, geometryData, sourceLayout, sig) {
    if (contentCached.sig !== sig) {
        const data = {
            ...geometryData,
            grid: clonePlain(geometryData.grid),
            bounds: clonePlain(geometryData.bounds),
            keys: geometryData.keys.map(cloneGeometryKey)
        };
        attachContent(data.keys, contentForLayout(sourceLayout));
        applyLanguageLayer(data.keys, s);
        captureBaseContent(data.keys);
        applyContentEdits(data.keys, s.contentEdits || {});
        applyTypeSettings(data.keys, s);
        contentCached = { sig, data };
    }
    return contentCached.data;
}

function legendsForContent(s, contentData, sig) {
    if (legendCached.sig !== sig) {
        legendCached = {
            sig,
            data: TYPEFACE
                ? buildLegends(contentData.keys, {
                    tf: TYPEFACE, comp: compFor(s),
                    typefaceFor: (el) => typefaceForElement(el),
                    compForElement: (el) => compForElement(s, el),
                    interline: s.leading, iconOptics: ICON_OPTICS
                })
                : []
        };
    }
    return legendCached.data;
}

function cloneGeometryKey(k) {
    return {
        ...k,
        guide: k.guide ? { ...k.guide } : k.guide,
        geometry: k.geometry ? clonePlain(k.geometry) : k.geometry
    };
}

function layoutFor(s) {
    syncFontWeightSetting(s);
    const prof = perfEnabled();
    const started = prof ? perfNow() : 0;
    const sourceLayout = sourceLayoutFor(s);
    const grid = gridFrom(s);
    const layoutEdits = sanitizeLayoutEditsForLayout(s.layoutEdits || {}, sourceLayout);
    const sigStarted = prof ? perfNow() : 0;
    const geometrySig = geometrySigFrom(sourceLayout, grid, layoutEdits);
    const contentSig = contentSigFrom(s, geometrySig);
    const legendSig = legendSigFrom(s, contentSig);
    const signatureMs = prof ? perfSince(sigStarted) : 0;
    const geometryHit = geometryCached.sig === geometrySig;
    const contentHit = contentCached.sig === contentSig;
    const legendsHit = legendCached.sig === legendSig;
    const hit = layoutCached.sig === legendSig;

    let geometryMs = 0;
    let contentMs = 0;
    let legendsMs = 0;

    const geometryStarted = prof && !geometryHit ? perfNow() : 0;
    const geometryData = geometryFor(sourceLayout, grid, layoutEdits, geometrySig);
    if (prof && !geometryHit) geometryMs = perfSince(geometryStarted);

    const contentStarted = prof && !contentHit ? perfNow() : 0;
    const contentData = contentForGeometry(s, geometryData, sourceLayout, contentSig);
    if (prof && !contentHit) contentMs = perfSince(contentStarted);

    const legendsStarted = prof && !legendsHit ? perfNow() : 0;
    const legends = legendsForContent(s, contentData, legendSig);
    if (prof && !legendsHit) legendsMs = perfSince(legendsStarted);

    if (layoutCached.sig !== legendSig) {
        layoutCached = {
            sig: legendSig,
            data: { ...contentData, legends }
        };
    }

    if (prof) {
        const data = layoutCached.data;
        perfRecord('layout', {
            ms: perfSince(started),
            hit,
            geometryHit,
            contentHit,
            legendsHit,
            layout: sourceLayout.meta.name,
            keys: data?.keys?.length || 0,
            legends: data?.legends?.length || 0,
            signatureMs,
            geometryMs,
            contentMs,
            legendsMs
        });
    }
    return layoutCached.data;
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
        fontWeight: TYPE_DEFAULTS.fontWeight,
        numpadSize: TYPE_DEFAULTS.numpadSize,
        secondarySize: TYPE_DEFAULTS.secondarySize,
        wordSize: TYPE_DEFAULTS.wordSize,
        leading: TYPE_DEFAULTS.leading,
        trackingOffset: TYPE_DEFAULTS.trackingOffset,
        textStyles: defaultTextStyles(),
        compensationMode: 'table',
        legendTextMode: 'text',
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

        customIcons: {},
        contentEdits: {},
        layoutEdits: {}
    },

    controls: {
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
        defaultName: 'Work 2.0 L',
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
        syncNumericControlValues(app);
        syncTextStyleList(app);
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
        const prof = perfEnabled();
        const started = prof ? perfNow() : 0;
        const { svg, create, width, height, settings: s } = ctx;
        const data = layoutFor(s);
        const { keys, grid } = data;
        const legends = data.legends;
        const gap = gapOf(grid);
        const referenceAssets = referenceAssetsForLayout(data.sourceLayout);
        const advanced = isAdvancedUiMode();
        if ((s.showRef || (advanced && s.showDiff)) && referenceAssets) ensureReferenceAssetsLoaded(referenceAssets, ctx.app);
        const referenceLayout = referenceLayoutFor(data.sourceLayout);
        const referenceVisualText = referenceVisualFor(data.sourceLayout);

        svg.appendChild(create('rect', { x: 0, y: 0, width, height, fill: s.bgColor }));
        if (advanced && s.showBlocks) {
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

        if (advanced && s.showColumns) {
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

        // Fallback for layouts that do not yet have a flattened visual reference.
        if (s.showRef && referenceLayout && !referenceVisualText) {
            const g = create('g', { id: 'reference' });
            for (const r of referenceLayout) {
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
                    rx: grid.cornerRadius, ry: grid.cornerRadius, fill: k.keyColor || s.capColor
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

        if (advanced && s.showDiff && referenceLayout) {
            svg.appendChild(renderGeometryDiff(create, keys, grid, referenceLayout));
        }

        const selection = renderSelection(create, keys, grid);
        if (selection) svg.appendChild(selection);

        const dragOverlay = renderFunctionDragOverlay(create, keys, grid);
        if (dragOverlay) svg.appendChild(dragOverlay);

        if (s.showGlyphs && TYPEFACE) {
            const textMode = svgExportTextMode();
            const g = create('g', { id: 'glyphs', fill: s.inkColor });
            for (const el of legends) {
                if (el.kind !== 'txt') continue;
                if (textMode === 'text') {
                    g.appendChild(renderLegendText(create, el, s.inkColor, s));
                    continue;
                }
                const tf = el.pathD ? null : typefaceForElement(el);
                const d = el.pathD || (tf ? textPath(tf, el) : '');
                if (d) g.appendChild(create('path', { d }));
            }
            svg.appendChild(g);
        }

        if (s.showIcons) {
            const iconGroups = new Map(ICON_LAYER_IDS.map((id) => [id, create('g', { id, fill: s.inkColor })]));
            const iconLibrary = iconLibraryForSettings(s);
            for (const el of legends) {
                if (el.kind !== 'ico') continue;
                const ico = iconLibrary[el.icon];
                if (!ico) continue;
                const wrap = create('g', {
                    transform: iconTransform(el, ico)
                });
                wrap.appendChild(create('path', { d: ico.d }));
                iconGroups.get(iconLayerId(el)).appendChild(wrap);
            }
            for (const id of ICON_LAYER_IDS) {
                const g = iconGroups.get(id);
                if (g?.childNodes.length) svg.appendChild(g);
            }
        }

        if (s.showRef && referenceAssets?.visual && referenceVisualText) {
            const referenceVisual = renderReferenceVisual(create, referenceVisualText, referenceAssets.visual);
            if (referenceVisual) svg.appendChild(referenceVisual);
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

        if (advanced && s.showSlots) {
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

        if (advanced && s.showIndex) {
            const g = create('g', { id: 'labels', 'font-size': 4, fill: '#1c1f22', 'font-family': 'monospace' });
            for (const k of keys) {
                const t = create('text', { x: k.guide.x0, y: k.guide.y0 + 4 });
                t.textContent = `${k.row}·${widthInU(k.w, grid).toFixed(2)}`;
                g.appendChild(t);
            }
            svg.appendChild(g);
        }

        updateReadout(s, keys, grid, legends, data.bounds);
        updateLegendInspector(s, keys, grid, legends);
        updateKeyGeometryEditor(s, keys);
        updateLegendEditor(s, keys);
        syncCompensationMode(s);
        syncLegendTextMode(s);
        syncSvgExportModeStatus(legends);
        syncFontImportStatus();
        syncCompensationTableEditor(s);
        syncLayoutSelect(s);
        syncLanguageLayerSelect(s);
        syncTextStyleList(ctx.app);

        if (!STARTUP_FIRST_RENDER_RECORDED) {
            STARTUP_FIRST_RENDER_RECORDED = true;
            perfMarkStartup('first-render', {
                layout: data.sourceLayout?.meta?.name || '',
                keys: keys.length,
                legends: legends.length,
                textMode: svgExportTextMode(),
                fontReady: !!TYPEFACE
            });
        }

        if (prof) {
            let textCount = 0;
            let iconCount = 0;
            for (const el of legends) {
                if (el.kind === 'txt') textCount++;
                else if (el.kind === 'ico') iconCount++;
            }
            perfRecord('render', {
                ms: perfSince(started),
                layout: data.sourceLayout?.meta?.name || '',
                keys: keys.length,
                legends: legends.length,
                text: textCount,
                icons: iconCount,
                textMode: svgExportTextMode(),
                showGlyphs: !!s.showGlyphs,
                showIcons: !!s.showIcons
            });
        }
    },

    onInit(readyApp) {
        readyApp.exporter = new SVGExporter(readyApp.config.export?.exporter || {});
        initUiMode(readyApp);
        migrateShippedPresetNames(readyApp);
        installKeyboarderPerf(readyApp);
        installPdfExport(readyApp);
        installCleanExports(readyApp);
        installSuggestedPresetSave(readyApp);
        installImportDebugAPI(readyApp);
        initNumericInputs(readyApp);
        initTextStyleList(readyApp);
        installFunctionDrag(readyApp);
        installFunctionDragDebugAPI(readyApp);
        installLegendPopoverDrag(readyApp);
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
        document.getElementById('newLayoutInput')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0] || null;
            e.target.value = '';
            void createNewLayoutFromFile(readyApp, file);
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
            const textStyles = defaultTextStyles();
            const values = {
                ...TYPE_DEFAULTS,
                textStyles,
                compensationMode: 'table',
                legendTextMode: 'text',
                compensationTableEdits: {}
            };
            Object.assign(values, legacyTypeSettingsFromTextStyles(textStyles));
            readyApp.settingsStore.setMultiple(values);
            syncSliderValues(readyApp, values);
        });

        document.getElementById('legendPrevKeyBtn')?.addEventListener('click', () => {
            selectAdjacentKey(readyApp, -1);
        });
        document.getElementById('legendNextKeyBtn')?.addEventListener('click', () => {
            selectAdjacentKey(readyApp, 1);
        });
        document.getElementById('legendStarterGrid')?.addEventListener('click', (e) => {
            const button = e.target.closest('[data-legend-recipe]');
            if (!button) return;
            applyLegendStarter(readyApp, button.dataset.legendRecipe);
            e.preventDefault();
        });
        document.getElementById('addLegendTextBtn')?.addEventListener('click', () => {
            addLegendElement(readyApp, 'txt');
        });
        document.getElementById('addLegendIconBtn')?.addEventListener('click', () => {
            addLegendElement(readyApp, 'ico');
        });
        document.getElementById('uploadLegendIconBtn')?.addEventListener('click', () => {
            document.getElementById('legendIconFileInput')?.click();
        });
        document.getElementById('legendIconFileInput')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0] || null;
            e.target.value = '';
            void importLegendIconFile(readyApp, file);
        });
        document.getElementById('resetKeyColorBtn')?.addEventListener('click', () => {
            const input = document.getElementById('legendKeyColorInput');
            if (input) input.value = '';
            commitLegendKeyColor(readyApp);
        });
        document.getElementById('legendKeyColorInput')?.addEventListener('input', () => {
            commitLegendKeyColor(readyApp);
        });
        document.getElementById('legendEditor')?.addEventListener('input', (e) => {
            const row = e.target.closest('.legend-edit-row');
            if (!row) return;
            if (e.target.matches('.legend-offset-x-input, .legend-offset-y-input')) {
                commitLegendEditorChange(readyApp, { intent: 'position', row });
            } else if (e.target.matches('.legend-style-input, .legend-comp-input, .legend-width-input, .legend-height-input')) {
                commitLegendEditorChange(readyApp, { intent: 'style', row });
            } else if (e.target.matches('.legend-text-input')) {
                commitLegendEditorChange(readyApp, { intent: 'content', row });
            }
            if (e.target.matches('.legend-offset-x-input, .legend-offset-y-input, .legend-comp-input')) {
                updateLegendFineTuningIndicator(row.querySelector('.legend-slot-field'));
            }
        });
        document.getElementById('legendEditor')?.addEventListener('change', (e) => {
            if (handleSlotSpecialChange(readyApp, e)) return;
        });
        document.getElementById('legendElementEditor')?.addEventListener('click', (e) => {
            const fineSummary = e.target.closest('.legend-fine-tuning > summary');
            if (fineSummary) {
                toggleLegendFineTuning(fineSummary.parentElement);
                e.preventDefault();
                return;
            }
            if (handleSlotPickerClick(readyApp, e)) return;
            const style = e.target.closest('[data-style-value]');
            if (style) {
                chooseLegendTextStyle(readyApp, style);
                e.preventDefault();
                return;
            }
            const icon = e.target.closest('[data-icon-value]');
            if (icon) {
                chooseLegendIcon(readyApp, icon);
                e.preventDefault();
                return;
            }
            const button = e.target.closest('.legend-remove-element-btn');
            if (!button) return;
            removeLegendElement(readyApp, button);
            e.preventDefault();
        });
        document.addEventListener('pointerdown', (e) => {
            document.querySelectorAll('.legend-fine-tuning[open]').forEach((details) => {
                if (!details.contains(e.target)) details.removeAttribute('open');
            });
        });
        document.querySelector('#legendPanel .panel-content')?.addEventListener('scroll', () => {
            closeLegendFineTuningPopovers();
        }, { passive: true });
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
        document.getElementById('legendPanelHeader')?.addEventListener('click', (e) => {
            if (isAdvancedUiMode()) return;
            e.preventDefault();
            e.stopPropagation();
            void closeLegendPopoverIfAllowed(readyApp);
        }, true);

        document.querySelectorAll('#compModeGroup [data-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                readyApp.settingsStore.set('compensationMode', btn.dataset.mode);
            });
        });
        document.getElementById('convertToOutlinesCheckbox')?.addEventListener('change', (e) => {
            setSvgExportTextMode(readyApp, e.target.checked ? 'outlines' : 'text');
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

        readyApp.dom?.surface?.addEventListener('click', async (e) => {
            if (SUPPRESS_NEXT_SURFACE_CLICK) {
                SUPPRESS_NEXT_SURFACE_CLICK = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const key = keyAtClientPoint(readyApp.dom.surface, layoutFor(readyApp.settings).keys, e.clientX, e.clientY);
            if (key) {
                const toggle = e.shiftKey || e.metaKey || e.ctrlKey;
                if (isAdvancedUiMode()) {
                    expandLegendPanel();
                    selectKey(readyApp, key.i, { toggle });
                    return;
                }
                if (legendSelectionWouldChange(key.i, { toggle }) && !(await confirmDiscardLegendDraft(readyApp))) return;
                selectKey(readyApp, key.i, { toggle });
                openLegendPopoverAt(e.clientX, e.clientY);
            }
            else if (!e.shiftKey) {
                if (isAdvancedUiMode()) selectKey(readyApp, null);
                else await closeLegendPopoverIfAllowed(readyApp);
            }
        });

        document.addEventListener('keydown', async (e) => {
            if (isTypingTarget(e.target)) return;
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) return;
            if (e.key === 'Escape') {
                if (isAdvancedUiMode()) selectKey(readyApp, null);
                else await closeLegendPopoverIfAllowed(readyApp);
                e.preventDefault();
                return;
            }
            if (!isAdvancedUiMode() && legendEditorDirty(readyApp) && !(await confirmDiscardLegendDraft(readyApp))) {
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
                    : `<p>${escapeHtml(report.legendStatus || 'No legend reference is available for this layout yet.')}</p>`);
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
                    + 'shows how close this matches the active reference.',
                okText: 'Close'
            });
        });

        // Reference assets are optional and layout-specific; preload the startup layout only.
        ensureReferenceAssetsLoaded(referenceAssetsForLayout(sourceLayoutFor(readyApp.settings)), readyApp);

        // Гарнитура: путь с пробелом обязан быть URL-энкоден, папка называется Fonts с большой.
        perfMarkStartup('font-load-start', { font: 'YS Text Variable' });
        loadTypeface(REFERENCE_FONT_URL).then(async (tf) => {
            await registerReferenceFont(tf);
            COMP_CACHE = new Map();
            syncFontImportStatus();
            syncCompensationTableEditor(readyApp.settings);
            readyApp.render();
            perfMarkStartup('font-ready', {
                font: 'YS Text Variable',
                registryFonts: FONT_REGISTRY.size
            });
        }).catch((e) => {
            TYPEFACE_SIG = 'font:failed';
            syncFontImportStatus();
            perfMarkStartup('font-failed', {
                font: 'YS Text Variable',
                error: e?.message || String(e)
            });
            readyApp.dialog?.alert({
                title: 'Font failed to load',
                text: `${e.message}\n\nGeometry still works; legends will be missing.`,
                okText: 'Close'
            });
        });
    },

    onReady(readyApp) {
        void ensureShippedPresetLibrary(readyApp);
        const data = layoutFor(readyApp.settings);
        perfMarkStartup('app-ready', {
            layout: data.sourceLayout?.meta?.name || '',
            keys: data.keys?.length || 0,
            legends: data.legends?.length || 0
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

function isAdvancedUiMode() {
    return !!UI_ADVANCED;
}

function initUiMode(app) {
    UI_ADVANCED = readUiModePreference();
    applyUiModeClass();
    installUiModeDebugAPI(app);
}

function readUiModePreference() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search || '');
    const requested = params.get('advanced') ?? params.get('ui');
    if (requested != null) {
        const advanced = /^(1|true|yes|advanced)$/i.test(requested);
        try { window.localStorage?.setItem(UI_MODE_STORAGE_KEY, advanced ? 'advanced' : 'simple'); } catch (_) {}
        return advanced;
    }
    try {
        return window.localStorage?.getItem(UI_MODE_STORAGE_KEY) === 'advanced';
    } catch (_) {
        return false;
    }
}

function setUiMode(advanced, app = null) {
    UI_ADVANCED = !!advanced;
    try { window.localStorage?.setItem(UI_MODE_STORAGE_KEY, UI_ADVANCED ? 'advanced' : 'simple'); } catch (_) {}
    applyUiModeClass();
    app?.render?.();
    return UI_ADVANCED ? 'advanced' : 'simple';
}

function applyUiModeClass() {
    if (typeof document === 'undefined') return;
    document.body?.classList.toggle('ui-advanced', UI_ADVANCED);
    document.body?.classList.toggle('ui-simple', !UI_ADVANCED);
}

function installUiModeDebugAPI(app) {
    if (typeof window === 'undefined') return;
    window.KeyboarderUI = {
        mode: () => isAdvancedUiMode() ? 'advanced' : 'simple',
        setAdvanced: (value = true) => setUiMode(!!value, app)
    };
}

function setTextIfChanged(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const text = String(value ?? '');
    if (el.textContent !== text) el.textContent = text;
}

function setHtmlIfChanged(el, markup, sig) {
    if (!el) return;
    const nextSig = String(sig ?? markup ?? '');
    if (el.dataset.sig === nextSig) return false;
    el.dataset.sig = nextSig;
    el.innerHTML = markup;
    return true;
}

function setDisabledIfChanged(el, disabled) {
    if (el && el.disabled !== !!disabled) el.disabled = !!disabled;
}

function setTitleIfChanged(el, title = '') {
    if (el && el.title !== title) el.title = title;
}

function setClassIfChanged(el, className, active) {
    if (el && el.classList.contains(className) !== !!active) el.classList.toggle(className, !!active);
}

function setAttrIfChanged(el, name, value) {
    if (!el) return;
    const next = String(value ?? '');
    if (el.getAttribute(name) !== next) el.setAttribute(name, next);
}

function setSelectValueIfChanged(select, value) {
    if (select && select.value !== String(value ?? '')) select.value = String(value ?? '');
}

function setInputValueForSig(input, value, sig) {
    if (!input) return;
    const nextSig = String(sig ?? '');
    if (input.dataset.valueSig === nextSig) return;
    input.value = String(value ?? '');
    input.dataset.valueSig = nextSig;
}

function decimalsFromStep(step) {
    const value = Number(step);
    if (!Number.isFinite(value) || value >= 1) return 0;
    const text = String(value);
    if (text.includes('e-')) return Number(text.split('e-')[1]) || 0;
    const dot = text.indexOf('.');
    return dot >= 0 ? text.length - dot - 1 : 0;
}

function formatNumericValue(value, config = {}) {
    const n = Number(value);
    const decimals = Number.isInteger(config.decimals) ? config.decimals : 3;
    const suffix = config.suffix || '';
    if (!Number.isFinite(n)) return '';
    return `${n.toFixed(decimals)}${suffix}`;
}

function parseNumericInputValue(input) {
    return Number.parseFloat(String(input?.value || '').replace(',', '.'));
}

function clampNumericValue(value, config = {}) {
    return clamp(value, config.min ?? Number.NEGATIVE_INFINITY, config.max ?? Number.POSITIVE_INFINITY);
}

function roundedStepValue(currentValue, key, shiftKey, config = {}) {
    const baseStep = config.baseStep || 0;
    const shiftStep = config.shiftStep || 0;
    const step = shiftKey && shiftStep > 0 ? shiftStep : baseStep;
    const stepDecimals = step > 0 ? decimalsFromStep(step) : (config.decimals || 0);
    const roundedCurrent = stepDecimals > 0
        ? Number(currentValue.toFixed(stepDecimals))
        : Math.round(currentValue);
    if (key === 'ArrowUp') {
        if (shiftKey && shiftStep > 0) {
            const k = roundedCurrent / shiftStep;
            return Math.abs(k - Math.round(k)) < 1e-6
                ? roundedCurrent + shiftStep
                : Math.ceil(k) * shiftStep;
        }
        return roundedCurrent + baseStep;
    }
    if (key === 'ArrowDown') {
        if (shiftKey && shiftStep > 0) {
            const k = roundedCurrent / shiftStep;
            return Math.abs(k - Math.round(k)) < 1e-6
                ? roundedCurrent - shiftStep
                : Math.floor(k) * shiftStep;
        }
        return roundedCurrent - baseStep;
    }
    return currentValue;
}

function finalizeNumericValue(value, config = {}) {
    const step = config.baseStep || 0;
    const decimals = step > 0 ? decimalsFromStep(step) : (config.decimals || 0);
    const rounded = decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
    return clampNumericValue(rounded, config);
}

function initNumericInputs(app) {
    if (app.__keyboarderNumericInputs) return;
    app.__keyboarderNumericInputs = true;
    for (const config of NUMERIC_CONTROLS) {
        const input = document.getElementById(config.inputId);
        if (!input) continue;
        input.dataset.numericSetting = config.setting;
        input.addEventListener('keydown', (e) => handleBoundNumericKeydown(app, input, config, e));
        input.addEventListener('focus', () => input.select());
        input.addEventListener('blur', () => commitBoundNumericInput(app, input, config));
    }
    syncNumericControlValues(app);
}

function handleBoundNumericKeydown(app, input, config, event) {
    if (event.key === 'Enter') {
        commitBoundNumericInput(app, input, config);
        input.blur();
        event.preventDefault();
        return;
    }
    if (event.key === 'Escape') {
        syncNumericInput(input, app.settingsStore.get(config.setting), config, true);
        input.blur();
        event.preventDefault();
        return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const current = parseNumericInputValue(input);
    if (!Number.isFinite(current)) return;
    const next = finalizeNumericValue(roundedStepValue(current, event.key, event.shiftKey, config), config);
    syncNumericInput(input, next, config, true);
    app.settingsStore.set(config.setting, next);
    event.preventDefault();
}

function commitBoundNumericInput(app, input, config) {
    const current = parseNumericInputValue(input);
    const fallback = app.settingsStore.get(config.setting);
    const next = finalizeNumericValue(Number.isFinite(current) ? current : Number(fallback), config);
    syncNumericInput(input, next, config, true);
    app.settingsStore.set(config.setting, next);
}

function syncNumericInput(input, value, config = {}, force = false) {
    if (!input) return;
    const next = formatNumericValue(clampNumericValue(Number(value), config), config);
    const sig = `${config.setting || input.id}:${next}`;
    if (!force && document.activeElement === input) return;
    if (!force && input.dataset.valueSig === sig) return;
    input.value = next;
    input.dataset.valueSig = sig;
}

function syncNumericControlValues(app, values = null) {
    const source = values || app?.settings || app?.settingsStore?.toObject?.() || {};
    for (const config of NUMERIC_CONTROLS) {
        syncNumericInput(document.getElementById(config.inputId), source[config.setting], config);
    }
}

function initTextStyleList(app) {
    const list = document.getElementById('textStyleList');
    if (!list || app.__keyboarderTextStyles) return;
    app.__keyboarderTextStyles = true;
    list.addEventListener('click', (e) => {
        const summary = e.target.closest('.text-style-summary');
        const split = e.target.closest('[data-style-action="split"]');
        const merge = e.target.closest('[data-style-action="merge"]');
        const reset = e.target.closest('[data-style-action="reset"]');
        if (split || merge || reset) {
            const id = validTextStyleId((split || merge || reset).dataset.styleId);
            if (!id) return;
            if (split) splitTextStyle(app, id);
            else if (merge) void mergeTextStyle(app, id);
            else resetTextStyle(app, id);
            e.preventDefault();
            return;
        }
        if (!summary) return;
        const id = validTextStyleId(summary.dataset.styleId);
        if (!id) return;
        if (TEXT_STYLE_OPEN.has(id)) TEXT_STYLE_OPEN.delete(id);
        else TEXT_STYLE_OPEN.add(id);
        syncTextStyleList(app, { force: true });
    });
    list.addEventListener('change', (e) => {
        const select = e.target.closest('[data-style-prop="fontId"]');
        if (!select) return;
        updateTextStyleFromControl(app, select);
    });
    list.addEventListener('blur', (e) => {
        const control = e.target.closest('[data-style-prop]');
        if (control) updateTextStyleFromControl(app, control);
    }, true);
    list.addEventListener('keydown', (e) => {
        const control = e.target.closest('[data-style-prop]');
        if (!control) return;
        if (control.dataset.styleProp === 'name') {
            if (e.key === 'Enter') {
                updateTextStyleFromControl(app, control);
                control.blur();
                e.preventDefault();
            } else if (e.key === 'Escape') {
                syncTextStyleList(app, { force: true });
                e.preventDefault();
            }
            return;
        }
        handleTextStyleNumericKeydown(app, control, e);
    });
    syncTextStyleList(app, { force: true });
}

function syncTextStyleList(app, { force = false } = {}) {
    const list = document.getElementById('textStyleList');
    if (!list || !app?.settings) return;
    const styles = textStylesForSettings(app.settings);
    const sig = JSON.stringify({
        styles,
        open: [...TEXT_STYLE_OPEN].sort(),
        fonts: [...FONT_REGISTRY.keys()]
    });
    if (!force && list.dataset.sig === sig) return;
    if (!force && list.contains(document.activeElement)) return;
    list.dataset.sig = sig;
    list.innerHTML = TEXT_STYLE_IDS.map((id) => textStyleRowHtml(id, styles[id])).join('');
}

function textStyleRowHtml(id, style) {
    const open = TEXT_STYLE_OPEN.has(id);
    const common = style.splitScripts
        ? textStyleNameFieldHtml(id, style)
        : textStyleBranchHtml(id, '', style);
    const scripts = style.splitScripts
        ? STYLE_SCRIPT_KEYS.map((script) => (
            `<div class="text-style-script-block">`
            + `<p class="text-style-script-title">${script === 'latin' ? 'Latin' : 'Cyrillic'}</p>`
            + textStyleBranchHtml(id, script, style[script] || style, { includeName: false })
            + '</div>'
        )).join('')
        : '';
    const action = style.splitScripts
        ? `<button type="button" class="btn-inline" data-style-action="merge" data-style-id="${html(id)}">Merge</button>`
        : `<button type="button" class="btn-inline" data-style-action="split" data-style-id="${html(id)}">Split</button>`;
    return `<div class="text-style-row${open ? ' is-open' : ''}" data-style-id="${html(id)}">`
        + `<button type="button" class="text-style-summary" data-style-id="${html(id)}" aria-expanded="${open ? 'true' : 'false'}">`
        + `<span class="text-style-name">${html(style.name)}</span>`
        + `<span class="text-style-metrics">${formatStyleMetric(style.size)} pt / ${formatStyleWeight(style.weight)}</span>`
        + '<span class="text-style-chevron">›</span>'
        + '</button>'
        + '<div class="text-style-body">'
        + common
        + scripts
        + `<div class="text-style-actions">${action}<button type="button" class="btn-inline" data-style-action="reset" data-style-id="${html(id)}">Reset</button></div>`
        + '</div>'
        + '</div>';
}

function textStyleNameFieldHtml(id, style) {
    return '<div class="text-style-fields">'
        + `<label><span>Name</span><input data-style-id="${html(id)}" data-style-prop="name" value="${html(style.name)}" autocomplete="off" spellcheck="false"></label>`
        + '</div>';
}

function textStyleBranchHtml(id, script, style, options = {}) {
    const includeName = options.includeName !== false;
    const prefix = script ? `${id}:${script}` : id;
    const cls = script ? 'text-style-script-fields' : 'text-style-fields';
    return `<div class="${cls}">`
        + (includeName ? `<label><span>Name</span><input data-style-id="${html(id)}" data-style-prop="name" value="${html(style.name)}" autocomplete="off" spellcheck="false"></label>` : '')
        + `<label><span>Font</span><select data-style-id="${html(id)}" data-style-script="${html(script)}" data-style-prop="fontId">${fontOptionsHtml(style.fontId || '')}</select></label>`
        + styleNumericFieldHtml(prefix, id, script, 'size', style.size, 'Size')
        + styleNumericFieldHtml(prefix, id, script, 'weight', style.weight, 'Weight')
        + styleNumericFieldHtml(prefix, id, script, 'tracking', style.tracking, 'Tracking')
        + styleNumericFieldHtml(prefix, id, script, 'leading', style.leading, 'Leading')
        + '</div>';
}

function styleNumericFieldHtml(prefix, id, script, prop, value, label) {
    const config = TEXT_STYLE_NUMERIC[prop];
    return `<label><span>${html(label)}</span><input data-style-id="${html(id)}" data-style-script="${html(script)}" data-style-prop="${html(prop)}" inputmode="decimal" value="${html(formatNumericValue(value, config))}" aria-label="${html(`${TEXT_STYLE_NAMES[id] || id} ${label}`)}"></label>`;
}

function formatStyleMetric(value) {
    return Number(value).toFixed(1);
}

function formatStyleWeight(value) {
    return String(Math.round(Number(value)));
}

function handleTextStyleNumericKeydown(app, control, event) {
    const prop = control.dataset.styleProp;
    const config = TEXT_STYLE_NUMERIC[prop];
    if (!config) return;
    if (event.key === 'Enter') {
        updateTextStyleFromControl(app, control);
        control.blur();
        event.preventDefault();
        return;
    }
    if (event.key === 'Escape') {
        syncTextStyleList(app, { force: true });
        event.preventDefault();
        return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const current = parseNumericInputValue(control);
    if (!Number.isFinite(current)) return;
    const next = finalizeNumericValue(roundedStepValue(current, event.key, event.shiftKey, config), config);
    control.value = formatNumericValue(next, config);
    writeTextStyleValue(app, control, next);
    event.preventDefault();
}

function updateTextStyleFromControl(app, control) {
    const prop = control.dataset.styleProp;
    if (!prop) return;
    let value;
    if (prop === 'name') {
        value = String(control.value || '').trim().replace(/\s+/g, ' ').slice(0, 48);
    } else if (prop === 'fontId') {
        value = cleanRuntimeFontId(control.value || '');
    } else {
        const config = TEXT_STYLE_NUMERIC[prop];
        if (!config) return;
        const current = parseNumericInputValue(control);
        value = finalizeNumericValue(Number.isFinite(current) ? current : 0, config);
        control.value = formatNumericValue(value, config);
    }
    writeTextStyleValue(app, control, value);
}

function writeTextStyleValue(app, control, value) {
    const id = validTextStyleId(control.dataset.styleId);
    const prop = control.dataset.styleProp;
    const script = STYLE_SCRIPT_KEYS.includes(control.dataset.styleScript) ? control.dataset.styleScript : '';
    if (!id || !prop) return;
    const styles = textStylesForSettings(app.settings);
    const current = styles[id] || defaultTextStyle(id);
    const next = clonePlain(styles);
    if (script) {
        const branch = normalizeStyleBranch(current[script], current);
        next[id] = {
            ...current,
            splitScripts: true,
            [script]: { ...branch, [prop]: value }
        };
    } else {
        next[id] = { ...current, [prop]: value };
        if (prop !== 'name' && current.splitScripts) {
            next[id].latin = normalizeStyleBranch(current.latin, next[id]);
            next[id].cyrillic = normalizeStyleBranch(current.cyrillic, next[id]);
        }
    }
    commitTextStyles(app, next);
}

function commitTextStyles(app, styles) {
    const normalized = normalizeTextStyles(styles, app.settings);
    const legacy = legacyTypeSettingsFromTextStyles(normalized);
    app.settingsStore.setMultiple({ textStyles: normalized, ...legacy });
    syncNumericControlValues(app);
    syncTextStyleList(app);
}

function splitTextStyle(app, id) {
    const styles = textStylesForSettings(app.settings);
    const current = styles[id] || defaultTextStyle(id);
    if (current.splitScripts) return;
    const next = clonePlain(styles);
    next[id] = {
        ...current,
        splitScripts: true,
        latin: normalizeStyleBranch(current, current),
        cyrillic: normalizeStyleBranch(current, current)
    };
    TEXT_STYLE_OPEN.add(id);
    commitTextStyles(app, next);
}

async function mergeTextStyle(app, id) {
    const styles = textStylesForSettings(app.settings);
    const current = styles[id] || defaultTextStyle(id);
    if (!current.splitScripts) return;
    const result = await app.dialog?.show({
        title: 'Merge text style',
        text: `Which ${current.name || TEXT_STYLE_NAMES[id]} branch should become the shared style?`,
        buttons: [
            { id: 'latin', text: 'Latin', type: 'primary' },
            { id: 'cyrillic', text: 'Cyrillic', type: 'secondary' },
            { id: 'cancel', text: 'Cancel', type: 'ghost' }
        ]
    });
    if (result?.action !== 'latin' && result?.action !== 'cyrillic') return;
    const winner = normalizeStyleBranch(current[result.action], current);
    const next = clonePlain(styles);
    next[id] = {
        ...current,
        ...winner,
        splitScripts: false,
        latin: null,
        cyrillic: null
    };
    commitTextStyles(app, next);
}

function resetTextStyle(app, id) {
    const styles = textStylesForSettings(app.settings);
    const next = clonePlain(styles);
    next[id] = defaultTextStyle(id);
    TEXT_STYLE_OPEN.add(id);
    commitTextStyles(app, next);
}

function setMainTextStyleWeight(app, weight) {
    const value = clamp(finiteOr(weight, TYPE_DEFAULTS.fontWeight), 100, 900);
    const styles = textStylesForSettings(app.settings);
    const next = clonePlain(styles);
    next.main = { ...(next.main || defaultTextStyle('main')), weight: value };
    commitTextStyles(app, next);
}

function customIconsForSettings(settings = {}) {
    return sanitizeCustomIconsData(settings.customIcons || {});
}

function iconLibraryForSettings(settings = {}) {
    return { ...ICONS, ...customIconsForSettings(settings) };
}

function iconOptionsForSettings(settings = {}) {
    const custom = Object.keys(customIconsForSettings(settings)).sort((a, b) => a.localeCompare(b));
    return [...BASE_ICON_OPTIONS, ...custom];
}

function firstIconOption(settings = {}) {
    return iconOptionsForSettings(settings)[0] || BASE_ICON_OPTIONS[0] || '';
}

function iconOptionLabel(name, library = ICONS) {
    const icon = library[name];
    return name.startsWith(CUSTOM_ICON_PREFIX) ? (icon?.name || name.slice(CUSTOM_ICON_PREFIX.length) || name) : name;
}

function customIconLibrarySignature(settings = {}) {
    return JSON.stringify(customIconsForSettings(settings));
}

function iconTransform(el, icon) {
    const naturalW = finiteOr(icon.w, 0);
    const naturalH = finiteOr(icon.h, 0);
    const sx = naturalW > 0 ? finiteOr(el.w, naturalW) / naturalW : 1;
    const sy = naturalH > 0 ? finiteOr(el.h, naturalH) / naturalH : 1;
    if (Math.abs(sx - 1) < 0.000001 && Math.abs(sy - 1) < 0.000001) {
        return `translate(${el.x - icon.ox} ${el.y - icon.oy})`;
    }
    const tx = el.x - icon.ox * sx;
    const ty = el.y - icon.oy * sy;
    return `matrix(${sx} 0 0 ${sy} ${tx} ${ty})`;
}

function modelIOOptions(layout = LCAKB23, settings = null) {
    return {
        layoutMeta: layout.meta,
        sourceRowCount: layout.rows.length,
        typeDefaults: TYPE_DEFAULTS,
        iconOptions: settings ? iconOptionsForSettings(settings) : BASE_ICON_OPTIONS,
        minKeyWidthMm: MIN_KEY_WIDTH_MM,
        maxKeyWidthMm: MAX_KEY_WIDTH_MM
    };
}

function syncSliderValues(app, values) {
    for (const [setting, value] of Object.entries(values || {})) {
        const config = NUMERIC_CONTROL_BY_SETTING[setting];
        if (config) syncNumericInput(document.getElementById(config.inputId), value, config, true);
    }
    syncTextStyleList(app);
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
    clean.textStyles = normalizeTextStyles(clean.textStyles || {}, clean);
    Object.assign(clean, legacyTypeSettingsFromTextStyles(clean.textStyles));
    if (!hasReferenceAssets(layout)) clean.showRef = false;
    if (!hasReferenceAssets(layout, 'layout')) clean.showDiff = false;
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
    if (!hasReferenceAssets(layout)) clean.showRef = false;
    if (!hasReferenceAssets(layout, 'layout')) clean.showDiff = false;
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

function migrateShippedPresetNames(app) {
    const store = app?.presetStore;
    if (!store) return '';
    let targetAfterRename = '';
    const current = app?.presets?.currentName || '';
    const all = store.loadAll();
    let changed = false;

    for (const [oldName, newName] of Object.entries(PRESET_NAME_MIGRATIONS)) {
        const oldPreset = all[oldName];
        if (!oldPreset) continue;
        if (!all[newName]) {
            all[newName] = { ...oldPreset, updatedAt: Date.now() };
            delete all[oldName];
            changed = true;
            if (current === oldName) targetAfterRename = newName;
        } else if (oldPreset.seeded === true) {
            delete all[oldName];
            changed = true;
            if (current === oldName) targetAfterRename = newName;
        }
    }

    if (changed) store.saveAll(all);
    return targetAfterRename;
}

async function ensureShippedPresetLibrary(app) {
    const store = app?.presetStore;
    if (!store || !app?.presets) return;
    const targetAfterRename = migrateShippedPresetNames(app);

    await store.loadSeed({
        basePath: app.config?.presets?.basePath || 'presets',
        force: true,
        transform: app.config?.presets?.transform
    });

    const migratedCurrent = PRESET_NAME_MIGRATIONS[app.presets.currentName || ''] || targetAfterRename;
    if (migratedCurrent && store.has(migratedCurrent)) {
        app.presets.switchTo(migratedCurrent);
        app.renderNow();
    }
    app._refreshChrome?.();
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
        if (blockId.startsWith('__') || !Array.isArray(items)) {
            next[blockId] = items;
            continue;
        }
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
            if (blockId.startsWith('__') || !Array.isArray(items)) {
                nextRow[blockId] = items;
                continue;
            }
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
            if (blockId.startsWith('__') || !Array.isArray(items)) continue;
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
            elements: cleanElements(k.elements || []),
            keyColor: cleanHexColor(k.keyColor)
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
        k.keyColor = edit.keyColor || '';
        k.content = {
            ...(k.content || {}),
            row: k.row,
            x: k.x,
            block: k.block,
            tpl: k.tpl,
            elements: cleanElements(k.elements),
            keyColor: k.keyColor
        };
        k.edited = true;
    }
}

function legendDraftSignature() {
    return LEGEND_DRAFT ? JSON.stringify(LEGEND_DRAFT) : '';
}

function applyLegendDraft(keys) {
    if (!LEGEND_DRAFT?.editId) return;
    const draft = {
        tpl: LEGEND_DRAFT.tpl || 'blank',
        elements: cleanElements(LEGEND_DRAFT.elements || []),
        keyColor: cleanHexColor(LEGEND_DRAFT.keyColor)
    };
    for (const k of keys) {
        if (k.editId !== LEGEND_DRAFT.editId) continue;
        k.savedContent = {
            tpl: k.tpl || 'blank',
            elements: cleanElements(k.elements || []),
            keyColor: cleanHexColor(k.keyColor)
        };
        k.tpl = draft.tpl;
        k.elements = draft.elements;
        k.keyColor = draft.keyColor;
        k.content = {
            ...(k.content || {}),
            row: k.row,
            x: k.x,
            block: k.block,
            tpl: k.tpl,
            elements: cleanElements(k.elements),
            keyColor: k.keyColor
        };
        k.edited = true;
        return;
    }
}

function sourceElements(k) {
    return cleanElements(k?.content?.elements || k?.elements || []);
}

function contentEquals(a, b) {
    return JSON.stringify({
        tpl: a?.tpl || 'blank',
        elements: cleanElements(a?.elements || []),
        keyColor: cleanHexColor(a?.keyColor)
    }) === JSON.stringify({
        tpl: b?.tpl || 'blank',
        elements: cleanElements(b?.elements || []),
        keyColor: cleanHexColor(b?.keyColor)
    });
}

function writeContentEdit(edits, k, tpl, elements, keyColor = '') {
    const payload = { tpl: tpl || 'blank', elements: cleanElements(elements) };
    const cleanColor = cleanHexColor(keyColor);
    if (cleanColor) payload.keyColor = cleanColor;
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
    const base = TEMPLATE_LABELS[v.tpl] || humanizeTemplateId(v.tpl);
    const detail = templateVariantDetail(v);
    return detail ? `${base} · ${detail}` : base;
}

function humanizeTemplateId(id = '') {
    return String(id || 'Custom')
        .replace(/^other:/, '')
        .replace(/[+_-]+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function templateVariantDetail(v) {
    const elements = cleanElements(v.elements || []);
    if (!elements.length) return '';
    const slots = elements.map((el) => el.slot).filter(Boolean);
    const signature = elementSignature(elements);
    if (v.tpl === 'alpha-dual' && signature === 'TL:txt|BR:txt') return 'Latin TL + Cyrillic BR';
    if (v.tpl === 'fkey-icon+label') return 'icon FC + label BC';
    if (v.tpl === 'icon-center') return slots.join(' / ');
    if (v.tpl === 'word-center') return slots.join(' / ');
    if (v.tpl === 'word-bottom') return slots.join(' / ');
    if (v.tpl === 'word-outer') return slots.join(' / ');
    if (v.tpl === 'word-stack' || v.tpl === 'word-2line') return slots.join(' / ');
    if (v.tpl === 'legend-corners') return slots.length === 4 ? `4 slots ${slots.join(' / ')}` : slots.join(' / ');
    if (v.tpl === 'legend-2corners') return slots.join(' / ');
    if (v.tpl === 'numpad-tier') return 'text UC + icon BC';
    if (v.tpl === 'icon+word-stack') return slots.join(' / ');
    if (v.tpl === 'corner-icon+word') return slots.join(' / ');
    if (v.tpl === 'status-pair') return 'icon Ml + number Mr';
    return slots.join(' / ');
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
    return [...byId.values()].sort(compareTemplateVariants);
}

function compareTemplateVariants(a, b) {
    const orderA = TEMPLATE_ORDER.indexOf(a.tpl);
    const orderB = TEMPLATE_ORDER.indexOf(b.tpl);
    const rankA = orderA >= 0 ? orderA : TEMPLATE_ORDER.length;
    const rankB = orderB >= 0 ? orderB : TEMPLATE_ORDER.length;
    return rankA - rankB
        || a.tpl.localeCompare(b.tpl)
        || elementSignature(a.elements).localeCompare(elementSignature(b.elements));
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
            next.icon = match.icon || sample.icon || firstIconOption();
            next.w = finiteOr(match.w, sample.w || 8);
            next.h = finiteOr(match.h, sample.h || 8);
        } else {
            next.text = match.text ?? sample.text ?? '';
            next.size = finiteOr(match.size, sample.size || TYPE_DEFAULTS.wordSize);
            const tracking = finiteOr(match.tracking, finiteOr(sample.tracking, 0));
            delete next.tracking;
            if (tracking !== 0) next.tracking = tracking;
            if (match.fontId || sample.fontId) next.fontId = match.fontId || sample.fontId;
            if (match.styleId || sample.styleId) next.styleId = match.styleId || sample.styleId;
        }
        if (!next.text && sample.kind === 'txt' && fallbackByKind.txt++ > 0) next.text = '';
        if (!next.icon && sample.kind === 'ico' && fallbackByKind.ico++ > 0) next.icon = firstIconOption();
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
    setSelectValueIfChanged(select, sel.active == null ? '' : String(sel.active));
}

function syncCompensationMode(s) {
    syncSegmentedButtons('compModeGroup', s.compensationMode || 'table');
}

function syncLegendTextMode() {
    const input = document.getElementById('convertToOutlinesCheckbox');
    if (input && input.checked !== (svgExportTextMode() === 'outlines')) {
        input.checked = svgExportTextMode() === 'outlines';
    }
}

function fontFamiliesForLegends(legends = []) {
    return [...new Set(legends
        .filter((el) => el.kind === 'txt')
        .map((el) => legendFontFamilyForElement(el))
        .filter(Boolean))];
}

function syncSvgExportModeStatus(legends = []) {
    const control = document.querySelector('.svg-outline-toggle');
    if (!control) return;
    const families = fontFamiliesForLegends(legends);
    const label = svgExportTextMode() === 'text'
        ? `Editable SVG text · Illustrator must have installed: ${families.join(', ') || 'the selected font'}`
        : 'SVG outlines · no installed fonts required';
    setAttrIfChanged(control, 'data-tooltip', label);
    setAttrIfChanged(control, 'aria-label', label);
}

function syncSegmentedButtons(groupId, mode) {
    const group = document.getElementById(groupId);
    if (!group || group.dataset.mode === String(mode)) return;
    group.dataset.mode = String(mode);
    group.querySelectorAll('[data-mode]').forEach((btn) => {
        const active = btn.dataset.mode === String(mode);
        setClassIfChanged(btn, 'is-active', active);
        setAttrIfChanged(btn, 'aria-pressed', active ? 'true' : 'false');
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
    const selectedSig = `${COMP_TABLE_SELECTED_CH}:${JSON.stringify(row)}:${JSON.stringify(base)}`;
    setSelectValueIfChanged(select, COMP_TABLE_SELECTED_CH);
    setInputValueForSig(left, compSideText(row.L), `${selectedSig}:L`);
    setInputValueForSig(right, compSideText(row.R), `${selectedSig}:R`);
    setAttrIfChanged(left, 'placeholder', compSideText(base.L));
    setAttrIfChanged(right, 'placeholder', compSideText(base.R));
    setDisabledIfChanged(resetChar, !edits[COMP_TABLE_SELECTED_CH]);
    setDisabledIfChanged(resetTable, !Object.keys(edits).length);
    if (status) {
        const changed = edits[COMP_TABLE_SELECTED_CH] ? 'edited' : 'reference';
        const statusText = `${changed} · L ${compSideText(row.L) || '-'} · R ${compSideText(row.R) || '-'}`;
        if (status.textContent !== statusText) status.textContent = statusText;
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
    setDisabledIfChanged(select, !chosen.length);
    setSelectValueIfChanged(select, common || '');
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
    setSelectValueIfChanged(select, sourceLayoutFor(s).meta.name);
    syncReferenceToggles(s);
}

function syncReferenceToggles(s) {
    const layout = sourceLayoutFor(s);
    const enabledById = {
        showRef: hasReferenceAssets(layout),
        showDiff: hasReferenceAssets(layout, 'layout')
    };
    for (const id of ['showRef', 'showDiff']) {
        const enabled = enabledById[id];
        const checkbox = document.getElementById(id);
        const label = checkbox?.closest?.('label');
        if (!checkbox) continue;
        setDisabledIfChanged(checkbox, !enabled);
        setClassIfChanged(label, 'is-disabled', !enabled);
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
        if (!hasReferenceAssets(nextLayout)) values.showRef = false;
        if (!hasReferenceAssets(nextLayout, 'layout')) values.showDiff = false;
        app.settingsStore.setMultiple(values);
        syncLayoutSelect(app.settings);
        app.renderNow();
    });
}

function syncLanguageLayerSelect(s) {
    const select = document.getElementById('languageLayerSelect');
    if (!select) return;
    setSelectValueIfChanged(select, normalizeLanguageLayer(s.languageLayer));
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

function cssQuoted(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
}

async function registerReferenceFont(tf) {
    const { probeTypeface, runCompensationInvariants } = await loadFontProbeHelpers();
    const probe = probeTypeface(tf);
    const entry = {
        id: REFERENCE_FONT_ID,
        kind: 'reference',
        name: 'YS Text Variable',
        fileName: 'YSText-Upright-weight-VF.ttf',
        size: 0,
        tf,
        probe,
        params: YS_TEXT_REGULAR,
        invariants: runCompensationInvariants(tf, YS_TEXT_REGULAR),
        coordinates: defaultVariationCoordinates(probe),
        cssFamily: REFERENCE_FONT_FAMILY,
        signature: 'font:reference:ys-text-variable'
    };
    entry.tf?.setVariations?.(entry.coordinates);
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
    const previewFamily = cssQuoted(entry.cssFamily);
    style.textContent = `@font-face{font-family:"${previewFamily}";src:url("${objectUrl}") format("${fontFormatFor(file.name)}");font-weight:1 1000;font-stretch:50% 200%;font-style:normal;font-display:block;}`
        + `\n#mainSvg #glyphs text[data-font-id="${entry.id}"]{font-family:"${previewFamily}" !important;}`;
    document.head.appendChild(style);
    if (document.fonts?.load) void document.fonts.load(`12px "${entry.cssFamily}"`);
    entry.objectUrl = objectUrl;
    entry.styleElement = style;
}

function fontImportId(file, probe) {
    return `session:${slugId(probe?.id || file?.name)}:${file?.size || 0}:${file?.lastModified || 0}`;
}

async function buildSessionFontEntry(file, tf) {
    const { autoCompensationParams, probeTypeface, runCompensationInvariants } = await loadFontProbeHelpers();
    const probe = probeTypeface(tf);
    const params = autoCompensationParams(tf, probe);
    const id = fontImportId(file, probe);
    const entry = {
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
        signature: `font:session:${id}`
    };
    entry.tf?.setVariations?.(entry.coordinates);
    return entry;
}

function setActiveFontId(app, id, options = {}) {
    const nextId = FONT_REGISTRY.has(cleanRuntimeFontId(id)) ? cleanRuntimeFontId(id) : REFERENCE_FONT_ID;
    ACTIVE_FONT_ID = nextId;
    TYPEFACE = activeFontEntry()?.tf || REFERENCE_TYPEFACE;
    TYPEFACE_SIG = fontRegistrySignature();
    COMP_CACHE.clear();
    invalidateLayoutCaches();
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
        const entry = await buildSessionFontEntry(file, tf);
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

function fontEntryDisplayName(entry) {
    if (entry?.kind === 'reference' && entry.name) return entry.name;
    return fontDisplayName(entry?.probe, entry?.name || 'Unknown Typeface');
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
    return `${fontEntryDisplayName(entry)} · ${suffix}${axes}`;
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
    setSelectValueIfChanged(select, FONT_REGISTRY.has(ACTIVE_FONT_ID) ? ACTIVE_FONT_ID : REFERENCE_FONT_ID);
}

function syncFontInstanceControls() {
    const box = document.getElementById('fontInstanceControls');
    const entry = activeFontEntry();
    const instances = entry?.probe?.variations?.instances || [];
    if (!box) return;
    if (!instances.length) {
        setHtmlIfChanged(box, '', 'none');
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
        setHtmlIfChanged(box, '', 'none');
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
    entry.tf?.setVariations?.(entry.coordinates);
    if (Number.isFinite(entry.coordinates.wght)) {
        setMainTextStyleWeight(app, entry.coordinates.wght);
        syncSliderValues(app, { fontWeight: entry.coordinates.wght });
    }
    entry.instanceName = instance.name || '';
    TYPEFACE_SIG = fontRegistrySignature();
    COMP_CACHE.clear();
    invalidateLayoutCaches();
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
    entry.tf?.setVariations?.(entry.coordinates);
    if (axis.tag === 'wght') {
        setMainTextStyleWeight(app, value);
        syncSliderValues(app, { fontWeight: value });
    }
    entry.instanceName = matchingFontInstance(entry)
        ? entry.probe.variations.instances[Number(matchingFontInstance(entry))]?.name || ''
        : '';
    TYPEFACE_SIG = fontRegistrySignature();
    COMP_CACHE.clear();
    invalidateLayoutCaches();
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
        writeContentEdit(next, k, k.tpl || 'blank', elements, cleanHexColor(k.keyColor));
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
    setDisabledIfChanged(reference, ACTIVE_FONT_ID === REFERENCE_FONT_ID || !REFERENCE_TYPEFACE);
    setDisabledIfChanged(applySelected, !TYPEFACE || !SELECTION.indices?.length);
    setDisabledIfChanged(controlSheet, !TYPEFACE);
    if (!status) return;
    if (!TYPEFACE) {
        setHtmlIfChanged(status, '<p class="font-empty">Loading reference font...</p>', 'loading');
        return;
    }
    const probe = activeFontProbe();
    const entry = activeFontEntry();
    const isReference = entry?.kind === 'reference';
    const rows = [
        ['Font', fontEntryDisplayName(entry)],
        ['File', isReference ? 'YSText-Upright-weight-VF.ttf · reference' : `${entry.fileName} · ${fontBytes(entry.size)}`],
        ['Data', fontMetricText(probe)],
        ['Axes', fontAxisText(probe)],
        ['Coords', activeFontCoordinatesText(entry)],
        ['Comp', isReference ? 'measured YS Text model + table' : fontCompText()],
        ['Check', fontInvariantText(activeFontInvariants())],
        ['Loaded', `${FONT_REGISTRY.size} font${FONT_REGISTRY.size === 1 ? '' : 's'}`]
    ];
    if ((probe?.variations?.axes || []).length) {
        rows.push(['Note', 'SVG text and outline contours use the active variation coordinates.']);
    }
    const sig = `${ACTIVE_FONT_ID}|${fontRegistrySignature()}|${JSON.stringify(rows)}`;
    setHtmlIfChanged(status, `<dl class="font-summary">
        ${rows.map(([term, value]) => `<div><dt>${html(term)}</dt><dd>${html(value)}</dd></div>`).join('')}
    </dl>`, sig);
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
        const title = fontEntryDisplayName(entry);
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
    document.getElementById('newLayoutBtn')?.addEventListener('click', async () => {
        await showNewLayoutIntro(app);
    });
}

async function showNewLayoutIntro(app) {
    const result = await app.dialog?.show({
        title: 'New layout',
        text: newLayoutIntroHtml(),
        html: true,
        buttons: [
            { id: 'choose', text: 'Choose file', type: 'primary' },
            { id: 'cancel', text: 'Cancel', type: 'ghost' }
        ]
    });
    if (result?.action === 'choose') openNewLayoutFilePicker();
    return result;
}

function newLayoutIntroHtml() {
    return `<div class="new-layout-intro">
        <p>Upload an SVG factory drawing or a Keyboarder JSON model. SVG recognition is reviewed before the layout is created.</p>
        ${newLayoutRequirementsHtml()}
        <p><a class="new-layout-sample-link" href="app/assets/new-layout-sample.svg" download>Download sample SVG</a></p>
    </div>`;
}

function newLayoutRequirementsHtml() {
    return `<ul class="new-layout-requirements">
        <li>Required layer: <code>caps</code> with readable key contours.</li>
        <li>Optional layer: <code>blueprint</code> with the factory drawing.</li>
        <li>Optional layer: <code>guides</code> for future guide-inset detection.</li>
        <li>Layer names are case-insensitive: <code>Caps</code> works like <code>caps</code>.</li>
        <li>If <code>caps</code> exists, missing <code>blueprint</code> is valid.</li>
    </ul>`;
}

function openNewLayoutFilePicker() {
    document.getElementById('newLayoutInput')?.click();
}

function openNewLayoutSvgPicker() {
    openNewLayoutFilePicker();
}

async function createNewLayoutFromFile(app, file) {
    if (!file) return;
    if (isKeyboardModelJSONFile(file)) return importModelJSONFile(app, file);
    if (isSvgImportFile(file)) {
        return createNewLayoutFromSvgSource(app, svgImportSourceFromFile(file), {
            guardUnsaved: true,
            showDialogs: true
        });
    }
    await showNewLayoutProblemDialog(app, file, null, {
        status: 'error',
        error: 'Choose an SVG drawing or a Keyboarder JSON model.'
    }, ['Unsupported file type. Upload an SVG drawing or JSON model exported by Keyboarder.']);
    return svgImportResult(false, 'error', LAST_SVG_IMPORT_REPORT, 'Unsupported file type.');
}

async function createNewLayoutFromSvgFile(app, file) {
    if (!file) return;
    if (!isSvgImportFile(file)) {
        await showNewLayoutProblemDialog(app, file, null, {
            status: 'error',
            error: 'Choose an SVG drawing.'
        }, ['Unsupported file type. Upload an SVG drawing.']);
        return svgImportResult(false, 'error', LAST_SVG_IMPORT_REPORT, 'Unsupported file type.');
    }
    return createNewLayoutFromSvgSource(app, svgImportSourceFromFile(file), {
        guardUnsaved: true,
        showDialogs: true
    });
}

function isSvgImportFile(file) {
    return !!file && (/\.svg$/i.test(file.name || '') || /svg/i.test(file.type || ''));
}

function isKeyboardModelJSONFile(file) {
    return !!file && (/\.json$/i.test(file.name || '') || /json/i.test(file.type || ''));
}

function svgImportSourceFromFile(file) {
    return {
        name: file?.name || 'drawing.svg',
        size: file?.size || 0,
        type: file?.type || '',
        readText: () => file.text()
    };
}

function svgImportSourceFromText(fileName, svgText, options = {}) {
    const text = String(svgText ?? '');
    return {
        name: String(fileName || options.name || 'drawing.svg'),
        size: Number.isFinite(options.bytes) ? options.bytes : byteLength(text),
        type: options.type || 'image/svg+xml',
        readText: async () => text
    };
}

async function createNewLayoutFromSvgText(app, fileName, svgText, options = {}) {
    return createNewLayoutFromSvgSource(app, svgImportSourceFromText(fileName, svgText, options), {
        guardUnsaved: options.guardUnsaved === true,
        showDialogs: options.showDialogs === true,
        review: options.review !== false
    });
}

async function createNewLayoutFromSvgSource(app, source, options = {}) {
    const file = source || svgImportSourceFromText('drawing.svg', '');
    const guardEnabled = options.guardUnsaved !== false;
    const showDialogs = options.showDialogs !== false;
    const reviewEnabled = showDialogs && options.review !== false;
    const prof = perfEnabled();
    const started = prof ? perfNow() : 0;
    let analysis = null;
    let readMs = 0;
    let analyzeMs = 0;
    let contentStatsMs = 0;
    let reviewMs = 0;
    let pipelineMs = 0;
    let guardMs = 0;
    let commitMs = 0;
    try {
        const readStarted = prof ? perfNow() : 0;
        const svgText = await file.readText();
        readMs = prof ? perfSince(readStarted) : 0;

        const analyzeStarted = prof ? perfNow() : 0;
        analysis = analyzeSvgBlueprint(svgText);
        analyzeMs = prof ? perfSince(analyzeStarted) : 0;
        const blockers = svgImportBlockers(analysis);
        if (blockers.length) {
            pipelineMs = prof ? perfSince(started) : 0;
            const details = {
                status: 'blocked',
                error: blockers.join(' '),
                ms: pipelineMs,
                totalMs: prof ? perfSince(started) : 0,
                readMs,
                analyzeMs,
                contentStatsMs,
                reviewMs
            };
            const report = rememberSvgImportReport(app, file, analysis, details, {
                intro: 'Layout was not created because the SVG is missing required drawing data.'
            });
            recordSvgImportPerf(file, analysis, details);
            if (showDialogs) await showNewLayoutProblemDialog(app, file, analysis, details, blockers);
            return svgImportResult(false, details.status, report, details.error);
        }
        const contentStarted = prof ? perfNow() : 0;
        addSvgImportContentStats(analysis);
        contentStatsMs = prof ? perfSince(contentStarted) : 0;
        if (reviewEnabled) {
            const reviewStarted = prof ? perfNow() : 0;
            const review = await showSvgImportReviewDialog(app, file, analysis);
            reviewMs = prof ? perfSince(reviewStarted) : 0;
            if (review?.action !== 'create') {
                pipelineMs = prof ? perfSince(started) : 0;
                const details = {
                    status: review?.action === 'choose' ? 'choose-another' : 'cancelled',
                    ms: pipelineMs,
                    totalMs: prof ? perfSince(started) : 0,
                    readMs,
                    analyzeMs,
                    contentStatsMs,
                    reviewMs
                };
                const report = rememberSvgImportReport(app, file, analysis, details, {
                    intro: review?.action === 'choose'
                        ? 'Choose another SVG. The current layout was not changed.'
                        : 'SVG import was cancelled. The current layout was not changed.'
                });
                recordSvgImportPerf(file, analysis, details);
                if (review?.action === 'choose') openNewLayoutFilePicker();
                return svgImportResult(false, details.status, report);
            }
        }
        pipelineMs = prof ? perfSince(started) : 0;
        const draft = analysis.layoutDraft;
        const warnings = analysis.diagnostics?.warnings || [];
        const guardStarted = prof ? perfNow() : 0;
        const canReplaceLayout = guardEnabled ? await guardUnsavedBeforeNewLayout(app) : true;
        guardMs = prof ? perfSince(guardStarted) : 0;
        if (!canReplaceLayout) {
            const details = {
                status: 'cancelled',
                ms: pipelineMs,
                totalMs: prof ? perfSince(started) : 0,
                readMs,
                analyzeMs,
                contentStatsMs,
                reviewMs,
                guardMs
            };
            rememberSvgImportReport(app, file, analysis, details, {
                intro: 'Layout creation was cancelled. The detected draft remains available in this session report.'
            });
            recordSvgImportPerf(file, analysis, details);
            return svgImportResult(false, details.status, LAST_SVG_IMPORT_REPORT);
        }
        const customLayout = namedCustomLayout(draft.layout, file.name, app);
        const commitStarted = prof ? perfNow() : 0;
        openImportedCustomLayout(app, customLayout);
        commitMs = prof ? perfSince(commitStarted) : 0;
        app._showToast?.(svgImportToastText(customLayout.meta.name, {
            ...(draft.stats || {}),
            warnings: warnings.length
        }));
        const details = {
            status: warnings.length ? 'created-with-warnings' : 'created',
            layout: customLayout.meta.name,
            ms: pipelineMs,
            totalMs: prof ? perfSince(started) : 0,
            readMs,
            analyzeMs,
            contentStatsMs,
            reviewMs,
            guardMs,
            commitMs,
            warnings: warnings.length
        };
        rememberSvgImportReport(app, file, analysis, details, {
            intro: `Layout ${customLayout.meta.name} was created from this SVG drawing.`
        });
        recordSvgImportPerf(file, analysis, details);
        return svgImportResult(true, details.status, LAST_SVG_IMPORT_REPORT);
    } catch (e) {
        if (!pipelineMs) pipelineMs = prof ? perfSince(started) : 0;
        const details = {
            status: 'error',
            error: e?.message || 'Could not read this SVG drawing.',
            ms: pipelineMs,
            totalMs: prof ? perfSince(started) : 0,
            readMs,
            analyzeMs,
            contentStatsMs,
            reviewMs,
            guardMs,
            commitMs
        };
        rememberSvgImportReport(app, file, analysis, details, {
            intro: details.error
        });
        recordSvgImportPerf(file, analysis, details);
        if (showDialogs) {
            await showNewLayoutProblemDialog(app, file, analysis, details, [details.error]);
        }
        return svgImportResult(false, details.status, LAST_SVG_IMPORT_REPORT, details.error);
    }
}

function svgImportBlockers(analysis) {
    const blockers = [];
    if (!analysis?.groups?.caps) {
        blockers.push('No `caps` layer found. Add a group or layer named `caps` with readable key contours.');
    } else if (!(analysis?.caps || []).length) {
        blockers.push('The `caps` layer was found, but it does not contain readable key contours.');
    }
    if (!analysis?.layoutDraft?.layout) {
        blockers.push('Keyboarder could not build a layout from the detected contours.');
    }
    return blockers;
}

async function showSvgImportReviewDialog(app, file, analysis) {
    if (!app?.dialog) return { action: 'create' };
    const modal = app.dialog.modal || document.getElementById('dialog');
    modal?.classList.add('modal--import-review');
    try {
        while (true) {
            const resultPromise = app.dialog.show({
                title: 'Review SVG import',
                text: svgImportReviewHtml(file?.name || 'drawing.svg', analysis),
                html: true,
                buttons: [
                    { id: 'create', text: 'Create layout', type: 'primary' },
                    { id: 'report', text: 'Report JSON', type: 'secondary' },
                    { id: 'choose', text: 'Choose another file', type: 'ghost' },
                    { id: 'cancel', text: 'Cancel', type: 'ghost' }
                ]
            });
            const dialogText = app.dialog.textEl || document.getElementById('dialogText');
            if (dialogText) dialogText.scrollTop = 0;
            const root = document.querySelector('.svg-import-review');
            const onChange = (event) => {
                const input = event.target?.closest?.('input[data-svg-recognition-pass]');
                if (!input || input.disabled || !input.value) return;
                selectSvgRecognitionPass(analysis, input.value);
                addSvgImportContentStats(analysis);
                syncSvgImportReview(root, analysis);
            };
            root?.addEventListener('change', onChange);
            const result = await resultPromise;
            root?.removeEventListener('change', onChange);
            if (result?.action !== 'report') return result || { action: 'cancel' };
            rememberSvgImportReport(app, file, analysis, {
                status: 'review',
                warnings: analysis.diagnostics?.warnings?.length || 0
            }, {
                intro: 'SVG recognition is waiting for confirmation. The current layout has not changed.'
            });
            exportLastSvgImportReport();
        }
    } finally {
        modal?.classList.remove('modal--import-review');
    }
}

function svgImportReviewHtml(fileName, analysis) {
    return `<div class="svg-import-review" data-selected-pass="${html(analysis?.recognition?.selectedPass || '')}">
        <div class="svg-import-review-intro">
            <p><strong>${html(fileName)}</strong></p>
            <p>Check the detected keyboard before replacing the current layout. Choose a recognition source if the alternatives differ.</p>
        </div>
        <section>
            <h3 class="verify-h">Recognition source</h3>
            <div class="svg-import-pass-list" role="radiogroup" aria-label="Recognition source">
                ${svgImportReviewPassesHtml(analysis)}
            </div>
        </section>
        <div class="svg-import-review-live" aria-live="polite">
            ${svgImportReviewSelectionHtml(analysis)}
        </div>
    </div>`;
}

function svgImportReviewPassesHtml(analysis) {
    const selectedPass = analysis?.recognition?.selectedPass || '';
    return (analysis?.recognition?.passes || []).map((pass) => {
        const selected = pass.id === selectedPass;
        const usable = pass.usable !== false && pass.keys > 0;
        const confidence = pass.confidence || {};
        const level = ['high', 'medium', 'low'].includes(confidence.level) ? confidence.level : 'low';
        const meta = [
            `${pass.keys || 0} keys`,
            `${Math.round((confidence.score || 0) * 100)}% confidence`,
            `${pass.segments || 0} ${pass.source === 'caps' ? 'shapes' : 'segments'}`
        ].join(' · ');
        return `<label class="svg-import-pass is-${level}${selected ? ' is-selected' : ''}${usable ? '' : ' is-disabled'}" data-pass-id="${html(pass.id)}">
            <input type="radio" name="svgRecognitionPass" value="${html(pass.id)}" data-svg-recognition-pass
                ${selected ? 'checked' : ''} ${usable ? '' : 'disabled'}>
            <span class="svg-import-pass-copy">
                <strong>${html(pass.label)}</strong>
                <small>${html(meta)}</small>
            </span>
            <span class="svg-import-confidence is-${level}">${html(level)}</span>
        </label>`;
    }).join('');
}

function svgImportReviewSelectionHtml(analysis) {
    const recognition = analysis?.recognition || {};
    const draft = analysis?.layoutDraft;
    const stats = draft?.stats || {};
    const grid = draft?.layout?.grid || {};
    const confidence = recognition.confidence || {};
    const level = ['high', 'medium', 'low'].includes(confidence.level) ? confidence.level : 'low';
    const warnings = analysis?.diagnostics?.warnings || [];
    const notices = analysis?.diagnostics?.notices || [];
    const standardKey = Number.isFinite(grid.keyWidth1U) && Number.isFinite(grid.keyHeight)
        ? `${toMm(grid.keyWidth1U).toFixed(2)} × ${toMm(grid.keyHeight).toFixed(2)} mm`
        : '—';
    return `<section class="svg-import-review-summary">
        <h3 class="verify-h">Selected result</h3>
        <div class="svg-import-review-metrics">
            <div><span>Keys</span><strong>${html(stats.keys ?? 0)}</strong></div>
            <div><span>Standard key</span><strong>${html(standardKey)}</strong></div>
            <div><span>Profile</span><strong>${html(stats.layoutProfile || 'Custom')}</strong></div>
            <div><span>Confidence</span><strong>${html(`${Math.round((confidence.score || 0) * 100)}% ${level}`)}</strong></div>
            <div><span>Warnings</span><strong>${html(warnings.length)}</strong></div>
        </div>
        <p class="svg-import-review-status is-${level}">${html(recognition.selectedLabel || recognition.selectedPass || 'No result')} · ${html(recognition.selection === 'user' ? 'selected manually' : 'selected automatically')}</p>
    </section>
    ${svgImportPreviewHtml(analysis)}
    ${svgImportIssueListHtml('Warnings', warnings, analysis, { limit: 5 })}
    ${svgImportIssueListHtml('Notes', notices, analysis, { limit: 4 })}`;
}

function syncSvgImportReview(root, analysis) {
    if (!root) return;
    const selectedPass = analysis?.recognition?.selectedPass || '';
    root.dataset.selectedPass = selectedPass;
    for (const card of root.querySelectorAll('.svg-import-pass')) {
        const selected = card.dataset.passId === selectedPass;
        card.classList.toggle('is-selected', selected);
        const input = card.querySelector('input[data-svg-recognition-pass]');
        if (input) input.checked = selected;
    }
    const live = root.querySelector('.svg-import-review-live');
    if (live) live.innerHTML = svgImportReviewSelectionHtml(analysis);
}

async function showNewLayoutProblemDialog(app, file, analysis, details = {}, blockers = []) {
    const report = analysis
        ? rememberSvgImportReport(app, file, analysis, details, {
            intro: details.error || 'Layout was not created.'
        })
        : null;
    const buttons = [
        { id: 'choose', text: 'Choose another file', type: 'primary' },
        { id: 'close', text: 'Close', type: 'ghost' }
    ];
    if (isAdvancedUiMode() && report) buttons.splice(1, 0, { id: 'report', text: 'Report JSON', type: 'secondary' });
    const result = await app.dialog?.show({
        title: 'Layout not created',
        text: newLayoutProblemHtml(file?.name || 'drawing.svg', analysis, blockers, details.error),
        html: true,
        buttons
    });
    if (result?.action === 'choose') openNewLayoutFilePicker();
    if (result?.action === 'report') exportLastSvgImportReport();
    return result;
}

function newLayoutProblemHtml(fileName, analysis, blockers = [], fallback = '') {
    const issues = blockers.length ? blockers : [fallback || 'The file could not be imported.'];
    const summary = analysis ? `<section>${svgImportPreviewHtml(analysis)}</section>` : '';
    return `<div class="new-layout-problem">
        <p><strong>${html(fileName)}</strong> is not ready for import.</p>
        <ul class="new-layout-blockers">${issues.map((issue) => `<li>${html(issue)}</li>`).join('')}</ul>
        <section>
            <h3 class="verify-h">Required SVG structure</h3>
            ${newLayoutRequirementsHtml()}
        </section>
        ${summary}
    </div>`;
}

function svgImportResult(ok, status, report, error = '') {
    const data = clonePlain(report?.data || null);
    return {
        ok: !!ok,
        status,
        error,
        layout: data?.layout || '',
        report: data
    };
}

function recordSvgImportPerf(file, analysis, details = {}) {
    if (!perfEnabled()) return;
    const draft = analysis?.layoutDraft?.stats || {};
    const diagnostics = analysis?.diagnostics || {};
    const timings = analysis?.timings || {};
    perfRecord('import', {
        file: file?.name || 'drawing.svg',
        bytes: file?.size || 0,
        keys: draft.keys || 0,
        blocks: draft.blocks || 0,
        rows: draft.rows || 0,
        stacks: draft.stacks || 0,
        profile: draft.layoutProfile || '',
        recognitionPass: analysis?.recognition?.selectedPass || '',
        recognitionConfidence: analysis?.recognition?.confidence?.score || 0,
        warnings: diagnostics.warnings?.length || 0,
        notices: diagnostics.notices?.length || 0,
        stripMs: timings.stripMs || 0,
        groupsMs: timings.groupsMs || 0,
        parseLinesMs: timings.parseLinesMs || 0,
        normalizeGeometryMs: timings.normalizeGeometryMs || 0,
        classifyLinesMs: timings.classifyLinesMs || 0,
        classifyNormalizedMs: timings.classifyNormalizedMs || 0,
        pathArcsMs: timings.pathArcsMs || 0,
        capsMs: timings.capsMs || 0,
        detectLinesMs: timings.detectLinesMs || 0,
        detectNormalizedMs: timings.detectNormalizedMs || 0,
        detectMs: timings.detectMs || 0,
        diagnosticsMs: timings.diagnosticsMs || 0,
        draftMs: timings.draftMs || 0,
        ...details
    });
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
    if (Number.isFinite(content.fIconKeys) && content.fIconKeys) parts.push(`${content.fIconKeys} f-icons`);
    if (Number.isFinite(content.placeholderKeys)) parts.push(`${content.placeholderKeys} placeholders`);
    if (Number.isFinite(stats.recognitionConfidence)) parts.push(`${Math.round(stats.recognitionConfidence * 100)}% confidence`);
    if (Number.isFinite(stats.warnings) && stats.warnings) parts.push(`${stats.warnings} warnings`);
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
        source: customLayout.meta?.source || 'svg-blueprint'
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
        ${svgRecognitionPassesHtml(analysis)}
        ${svgImportTimingsHtml(analysis)}
        ${svgImportPreviewHtml(analysis)}
        ${svgImportIssueListHtml('Warnings', warnings, analysis)}
        ${svgImportIssueListHtml('Notes', notices, analysis, { limit: 8 })}
    </div>`;
}

function svgRecognitionPassesHtml(analysis) {
    const recognition = analysis?.recognition;
    if (!recognition?.passes?.length) return '';
    const selected = recognition.passes.find((pass) => pass.selected);
    const selectedText = selected
        ? `${selected.label} · ${Math.round((selected.confidence?.score || 0) * 100)}% ${selected.confidence?.level || ''}`
        : 'No usable pass';
    const rows = recognition.passes.map((pass) => {
        const confidence = pass.confidence || {};
        const label = `${pass.label}${pass.selected ? ' · selected' : ''}`;
        const value = `${pass.keys} keys · ${Math.round((confidence.score || 0) * 100)}% ${confidence.level || ''}`;
        return `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`;
    }).join('');
    return `<section class="svg-import-recognition">
        <h3 class="verify-h">Recognition</h3>
        <p>${html(selectedText)}</p>
        <dl>${rows}</dl>
    </section>`;
}

function svgImportTimingsHtml(analysis) {
    const t = analysis?.timings || null;
    if (!t) return '';
    const rows = [
        ['Total', t.totalMs],
        ['Strip private data', t.stripMs],
        ['Find groups', t.groupsMs],
        ['Count tags', t.tagCountsMs],
        ['Parse lines', t.parseLinesMs],
        ['Normalize SVG geometry', t.normalizeGeometryMs],
        ['Classify explicit lines', t.classifyLinesMs],
        ['Classify normalized geometry', t.classifyNormalizedMs],
        ['Parse path arcs', t.pathArcsMs],
        ['Parse caps', t.capsMs],
        ['Detect explicit pass', t.detectLinesMs],
        ['Detect normalized pass', t.detectNormalizedMs],
        ['Detect keys total', t.detectMs],
        ['Apply review selection', t.reviewSelectionMs],
        ['Diagnostics', t.diagnosticsMs],
        ['Draft layout', t.draftMs]
    ].filter(([, value]) => Number.isFinite(value));
    if (!rows.length) return '';
    return `<section><h3 class="verify-h">Timings</h3><dl>${rows
        .map(([label, value]) => `<div><dt>${html(label)}</dt><dd>${html(Number(value).toFixed(2))} ms</dd></div>`)
        .join('')}</dl></section>`;
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

function rememberSvgImportReport(app, file, analysis, details = {}, htmlOptions = {}) {
    const fileName = file?.name || 'drawing.svg';
    const data = svgImportReportData(fileName, analysis, {
        ...details,
        bytes: file?.size || 0,
        type: file?.type || ''
    });
    const report = {
        generatedAt: data.generatedAt,
        file: data.file,
        status: data.status,
        layout: data.layout,
        html: svgImportReportHtml(fileName, analysis, htmlOptions),
        data
    };
    LAST_SVG_IMPORT_REPORT = report;
    if (app) app.lastSvgImportReport = report;
    if (typeof window !== 'undefined') window.KeyboarderLastImportReport = report;
    syncSvgImportReportDocumentState(report);
    return report;
}

function syncSvgImportReportDocumentState(report = LAST_SVG_IMPORT_REPORT) {
    try {
        let node = document.getElementById('keyboarderImportReportState');
        if (!node) {
            node = document.createElement('script');
            node.id = 'keyboarderImportReportState';
            node.type = 'application/json';
            (document.head || document.documentElement).appendChild(node);
        }
        node.textContent = JSON.stringify(report?.data || null);
    } catch {
        // Non-DOM contexts can still run import analysis and report serialization.
    }
}

async function showLastSvgImportReport(app) {
    const report = LAST_SVG_IMPORT_REPORT;
    if (!report) {
        await app?.dialog?.alert({
            title: 'Import report',
            text: 'No SVG import report in this session.',
            okText: 'Close'
        });
        return null;
    }
    const result = await app?.dialog?.show({
        title: `Import report · ${report.status || 'unknown'}`,
        text: report.html,
        html: true,
        buttons: [
            { id: 'ok', text: 'Close', type: 'primary' },
            { id: 'report', text: 'Report JSON', type: 'secondary' }
        ]
    });
    if (result?.action === 'report') exportLastSvgImportReport();
    return clonePlain(report.data);
}

function exportLastSvgImportReport() {
    const report = LAST_SVG_IMPORT_REPORT;
    if (!report) return false;
    const base = layoutSlug(String(report.file || 'drawing').replace(/\.svg$/i, ''));
    downloadJSON(`keyboarder-${base}-import-report.json`, report.data);
    return true;
}

function installImportDebugAPI(app) {
    if (typeof window === 'undefined') return;
    const api = {
        lastReport: () => clonePlain(LAST_SVG_IMPORT_REPORT?.data || null),
        lastReportHtml: () => LAST_SVG_IMPORT_REPORT?.html || '',
        lastReportJson: () => JSON.stringify(LAST_SVG_IMPORT_REPORT?.data || null, null, 2),
        showLastReport: () => showLastSvgImportReport(app),
        exportLastReport: exportLastSvgImportReport,
        createFromSvgText: (fileName, svgText, options = {}) =>
            createNewLayoutFromSvgText(app, fileName, svgText, options),
        createFromSvgString: (fileName, svgText, options = {}) =>
            createNewLayoutFromSvgText(app, fileName, svgText, options)
    };
    window.KeyboarderImport = api;
    app.KeyboarderImport = api;
}

function svgImportReportData(fileName, analysis, details = {}) {
    const diagnostics = analysis?.diagnostics || {};
    return {
        generatedAt: new Date().toISOString(),
        file: fileName || 'drawing.svg',
        bytes: details.bytes || 0,
        type: details.type || '',
        status: details.status || '',
        error: details.error || '',
        layout: details.layout || analysis?.layoutDraft?.layout?.meta?.name || '',
        summary: blueprintSummaryLines(analysis),
        groups: clonePlain(analysis?.groups || {}),
        elements: clonePlain(analysis?.elements || {}),
        geometry: clonePlain(analysis?.geometry || null),
        calibration: clonePlain(analysis?.calibration || null),
        recognition: clonePlain(analysis?.recognition || null),
        recognized: {
            source: analysis?.recognized?.source || '',
            pass: analysis?.recognized?.passId || '',
            confidence: clonePlain(analysis?.recognized?.confidence || null),
            provenance: clonePlain(analysis?.recognized?.provenance || null),
            keys: analysis?.recognized?.keys?.length || 0,
            raw: analysis?.recognized?.raw?.length || 0,
            cornerOffset: analysis?.recognized?.cornerOffset ?? null,
            estimatedGrid: clonePlain(analysis?.recognized?.estimatedGrid || null),
            stacks: analysis?.recognized?.stackCells?.length || 0,
            keyConfidence: svgImportKeyConfidenceStats(analysis?.recognized?.keys || [])
        },
        diagnostics: {
            ok: !!diagnostics.ok,
            warnings: (diagnostics.warnings || []).map((issue) => svgImportReportIssue(issue, analysis)),
            notices: (diagnostics.notices || []).map((issue) => svgImportReportIssue(issue, analysis)),
            suspiciousKeyIndices: [...(diagnostics.suspiciousKeyIndices || [])],
            suspiciousKeys: diagnostics.suspiciousKeys || 0
        },
        draft: clonePlain(analysis?.layoutDraft?.stats || null),
        pipeline: {
            ms: details.ms || 0,
            totalMs: details.totalMs || 0,
            readMs: details.readMs || 0,
            analyzeMs: details.analyzeMs || 0,
            contentStatsMs: details.contentStatsMs || 0,
            reviewMs: details.reviewMs || 0,
            guardMs: details.guardMs || 0,
            commitMs: details.commitMs || 0
        },
        timings: clonePlain(analysis?.timings || null)
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

function svgImportKeyConfidenceStats(keys = []) {
    const scores = keys.map((key) => key.confidence?.score).filter(Number.isFinite);
    if (!scores.length) return null;
    return {
        min: round(Math.min(...scores), 4),
        average: round(scores.reduce((sum, value) => sum + value, 0) / scores.length, 4),
        max: round(Math.max(...scores), 4),
        low: scores.filter((score) => score < 0.72).length
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
        stackCount: key.stackCount ?? null,
        confidence: clonePlain(key.confidence || null),
        provenance: clonePlain(key.provenance || null)
    };
}

function renderLegendText(create, el, fill, s = {}) {
    const entry = fontEntryForElement(el);
    const variation = fontVariationSettingsForElement(entry, el);
    const family = legendFontFamilyForElement(el);
    const horizontalAnchor = String(el.slot || '').slice(-1);
    const textAnchor = horizontalAnchor === 'R' ? 'end' : (horizontalAnchor === 'C' ? 'middle' : 'start');
    const advance = finiteOr(el.advw, 0);
    const anchorX = textAnchor === 'end'
        ? el.bx + advance
        : (textAnchor === 'middle' ? el.bx + advance / 2 : el.bx);
    const text = create('text', {
        x: anchorX,
        y: el.by,
        fill,
        'text-anchor': textAnchor,
        'font-family': family,
        'font-size': el.size,
        'font-weight': compactNumber(fontWeightForElement(entry, el, s), 3),
        'font-stretch': fontStretchForElement(entry, el),
        'font-style': fontStyleForElement(entry, el),
        'letter-spacing': `${el.tracking || 0}em`,
        'font-kerning': 'normal',
        'text-rendering': 'geometricPrecision',
        'data-font-id': entry?.id || '',
        'data-font-family': family,
        'data-font-subfamily': entry?.probe?.names?.subfamily || '',
        'data-font-postscript-name': entry?.probe?.names?.postScriptName || '',
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

    setClassIfChanged(editor, 'is-locked', !!active && !editable);
    setDisabledIfChanged(input, !editable);
    setAttrIfChanged(input, 'min', roundMm(range.min));
    setAttrIfChanged(input, 'max', roundMm(range.max));
    if (input.dataset.editId !== editId) input.dataset.editId = editId;
    setTitleIfChanged(input, active && !editable ? 'Flex key: width is derived from the remaining row space.' : '');
    setInputValueForSig(input, value, `${editId}:${value}:${editable}`);
    if (apply) setDisabledIfChanged(apply, !editable);
    if (reset) setDisabledIfChanged(reset, !active || !Number.isFinite(edits[editId]?.widthMm));
    const addBeforeButton = document.getElementById('addKeyBeforeBtn');
    const addAfterButton = document.getElementById('addKeyBtn');
    if (deleteButton) {
        setDisabledIfChanged(deleteButton, !active || !!active.geometry?.layoutLocked);
        setTitleIfChanged(deleteButton, active?.geometry?.layoutLocked ? 'Stacked imported key geometry is locked.' : active ? `Delete ${keyLabel(active)}` : '');
    }
    if (moveLeftButton) {
        const canMoveLeft = canMoveKeyInRow(s, keys, active, -1);
        setDisabledIfChanged(moveLeftButton, !canMoveLeft);
        setTitleIfChanged(moveLeftButton, canMoveLeft ? `Move ${keyLabel(active)} left` : '');
    }
    if (moveRightButton) {
        const canMoveRight = canMoveKeyInRow(s, keys, active, 1);
        setDisabledIfChanged(moveRightButton, !canMoveRight);
        setTitleIfChanged(moveRightButton, canMoveRight ? `Move ${keyLabel(active)} right` : '');
    }
    if (addBeforeButton || addAfterButton) {
        const canAddBefore = canAddKeyNear(s, active, 'before');
        const canAddAfter = canAddKeyNear(s, active, 'after');
        if (addBeforeButton) {
            setDisabledIfChanged(addBeforeButton, !canAddBefore);
            setTitleIfChanged(addBeforeButton, canAddBefore ? `Add key before ${keyLabel(active)}` : '');
        }
        if (addAfterButton) {
            setDisabledIfChanged(addAfterButton, !canAddAfter);
            setTitleIfChanged(addAfterButton, canAddAfter ? `Add key after ${keyLabel(active)}` : '');
        }
    }
    if (restoreButton) {
        setDisabledIfChanged(restoreButton, !restoreId);
        setTitleIfChanged(restoreButton, restoreId ? `Restore ${editIdLabel(restoreId)}` : '');
    }
    if (addRowButton) {
        const canAddRow = canAddRowBelow(s, active);
        setDisabledIfChanged(addRowButton, !canAddRow);
        setTitleIfChanged(addRowButton, canAddRow ? `Add row below ${rowEditLabel(rowEditId(sourceRowOfKey(active)), sourceLayout.rows.length)}` : '');
    }
    if (deleteRowButton) {
        const canDelete = canDeleteActiveRow(s, active);
        setDisabledIfChanged(deleteRowButton, !canDelete);
        setTitleIfChanged(deleteRowButton, canDelete ? `Delete ${rowEditLabel(rowEditId(sourceRowOfKey(active)), sourceLayout.rows.length)}` : '');
    }
    if (restoreRowButton) {
        setDisabledIfChanged(restoreRowButton, !restoreRowId);
        setTitleIfChanged(restoreRowButton, restoreRowId ? `Restore ${rowEditLabel(restoreRowId, sourceLayout.rows.length)}` : '');
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

async function importLegendIconFile(app, file) {
    if (!file) return;
    try {
        const existing = customIconsForSettings(app.settingsStore.toObject());
        const parsed = parseUploadedSvgIcon(await file.text(), file.name || 'icon.svg', existing);
        const customIcons = sanitizeCustomIconsData({ ...existing, [parsed.id]: parsed.icon });
        const savedIcon = customIcons[parsed.id];
        if (!savedIcon) throw new Error('Could not sanitize this SVG path.');
        const hasActiveKey = !!activeKey(layoutFor(app.settings).keys);
        const nextElements = hasActiveKey
            ? [...readElementEditorElements(), cleanElement({
                slot: 'FC',
                kind: 'ico',
                group: 'icons',
                icon: parsed.id,
                w: savedIcon.w,
                h: savedIcon.h
            })]
            : null;
        app.settingsStore.set('customIcons', customIcons);
        if (nextElements) {
            requestAnimationFrame(() => commitActiveLegendElements(app, nextElements, { forceRender: true }));
        }
        app._showToast?.(`${savedIcon.name} uploaded`);
    } catch (e) {
        await app.dialog?.alert({
            title: 'SVG icon import failed',
            text: e?.message || 'Could not import this SVG icon.',
            okText: 'Close'
        });
    }
}

function parseUploadedSvgIcon(svgText = '', fileName = 'icon.svg', existing = {}) {
    const text = String(svgText || '');
    if (!text.trim()) throw new Error('The SVG file is empty.');
    if (text.length > SVG_ICON_MAX_BYTES) throw new Error('The SVG file is too large for an icon.');
    if (typeof DOMParser !== 'function') throw new Error('This browser cannot parse SVG files.');

    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('The SVG file is not valid XML.');
    const svg = doc.documentElement;
    if (!svg || svg.localName.toLowerCase() !== 'svg') throw new Error('The file root must be an <svg> element.');
    if (svg.querySelector('script, foreignObject, image, use, iframe, object, embed, audio, video, canvas')) {
        throw new Error('Only self-contained path SVG icons are supported.');
    }
    if (svg.querySelector('[transform]')) {
        throw new Error('SVG transforms are not imported yet. Expand/flatten the icon to paths first.');
    }
    if (svg.querySelector('rect, circle, ellipse, line, polyline, polygon, text')) {
        throw new Error('Only <path> geometry is supported. Convert shapes/text to paths first.');
    }

    const paths = [...svg.querySelectorAll('path')]
        .map((path) => String(path.getAttribute('d') || '').trim())
        .filter(Boolean);
    if (!paths.length) throw new Error('No <path d="..."> geometry was found.');
    const d = paths.join(' ');
    if (d.length > 60000 || !SVG_ICON_PATH_DATA_RE.test(d)) {
        throw new Error('The SVG path data contains unsupported commands.');
    }

    const viewBox = parseSvgViewBox(svg) || fallbackSvgViewBox(svg);
    if (!viewBox) throw new Error('The SVG needs a valid viewBox or numeric width/height.');
    const id = uniqueCustomIconId(fileName, existing);
    return {
        id,
        icon: {
            name: customIconDisplayName(fileName),
            w: roundMm(clamp(viewBox.w, 0.1, 80)),
            h: roundMm(clamp(viewBox.h, 0.1, 80)),
            ox: roundMm(clamp(viewBox.x, -10000, 10000)),
            oy: roundMm(clamp(viewBox.y, -10000, 10000)),
            d
        }
    };
}

function parseSvgViewBox(svg) {
    const raw = String(svg.getAttribute('viewBox') || '').trim();
    if (!raw) return null;
    const parts = raw.split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || !parts.every(Number.isFinite) || parts[2] <= 0 || parts[3] <= 0) return null;
    return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
}

function fallbackSvgViewBox(svg) {
    const w = parseSvgLength(svg.getAttribute('width'));
    const h = parseSvgLength(svg.getAttribute('height'));
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { x: 0, y: 0, w, h } : null;
}

function parseSvgLength(value) {
    const match = String(value || '').trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(?:px|pt|mm|cm|in)?$/i);
    return match ? Number(match[1]) : NaN;
}

function uniqueCustomIconId(fileName, existing = {}) {
    const used = new Set([...Object.keys(ICONS), ...Object.keys(existing || {})]);
    const base = customIconSlug(fileName);
    let id = `${CUSTOM_ICON_PREFIX}${base}`;
    for (let index = 2; used.has(id); index++) id = `${CUSTOM_ICON_PREFIX}${base}-${index}`;
    return id;
}

function customIconSlug(fileName) {
    return String(fileName || 'icon')
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'icon';
}

function customIconDisplayName(fileName) {
    return String(fileName || 'Custom icon')
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'Custom icon';
}

function updateLegendEditor(s, keys) {
    const editor = document.getElementById('legendElementEditor');
    const addText = document.getElementById('addLegendTextBtn');
    const addIcon = document.getElementById('addLegendIconBtn');
    const uploadIcon = document.getElementById('uploadLegendIconBtn');
    const keyColorInput = document.getElementById('legendKeyColorInput');
    const resetKeyColor = document.getElementById('resetKeyColorBtn');
    if (!editor) return;
    const active = activeKey(keys);
    const selected = selectedKeys(keys);
    updateLegendSelectionContext(s, keys, active, selected);
    setDisabledIfChanged(addText, !active);
    setDisabledIfChanged(addIcon, !active);
    setDisabledIfChanged(uploadIcon, !active);
    setDisabledIfChanged(keyColorInput, !active);
    setDisabledIfChanged(resetKeyColor, !selected.some((k) => cleanHexColor(k.keyColor)));
    setAttrIfChanged(keyColorInput, 'placeholder', active ? (s.capColor || 'Global') : 'Select a key');
    if (!active) {
        setInputValueForSig(keyColorInput, '', 'none');
        delete editor.dataset.activeEditId;
        updateLegendStarter(null, s);
        renderElementEditor([], { disabled: true, sig: 'none' });
        return;
    }
    setInputValueForSig(keyColorInput, cleanHexColor(active.keyColor), `${active.editId}:${cleanHexColor(active.keyColor)}`);
    const elements = sourceElements(active);
    updateLegendStarter(elements.length ? null : active, s);
    const sig = `${active.editId}|${active.tpl}|${JSON.stringify(elements)}|${fontRegistrySignature()}|${customIconLibrarySignature(s)}`;
    const controlSig = `${JSON.stringify(textStylesForSettings(s))}|${fontRegistrySignature()}|${customIconLibrarySignature(s)}`;
    if (editor.dataset.forceRender !== 'true'
        && editor.dataset.activeEditId === active.editId
        && editor.dataset.controlSig === controlSig
        && JSON.stringify(readElementEditorElements()) === JSON.stringify(elements)) {
        editor.dataset.sig = sig;
        return;
    }
    delete editor.dataset.forceRender;
    editor.dataset.activeEditId = active.editId;
    editor.dataset.controlSig = controlSig;
    renderElementEditor(elements, { disabled: false, sig, templateId: variantForKey(active), settings: s });
}

function updateLegendSelectionContext(s, keys, active, selected) {
    const title = document.getElementById('legendSelectionTitle');
    const meta = document.getElementById('legendSelectionMeta');
    const prev = document.getElementById('legendPrevKeyBtn');
    const next = document.getElementById('legendNextKeyBtn');
    if (!active) {
        if (title) title.textContent = 'No key selected';
        if (meta) meta.textContent = 'Select a key on the canvas';
        setDisabledIfChanged(prev, true);
        setDisabledIfChanged(next, true);
        return;
    }
    const elements = sourceElements(active);
    const firstText = elements.find((el) => el.kind === 'txt' && String(el.text || '').trim());
    const firstIcon = elements.find((el) => el.kind === 'ico');
    const iconLibrary = iconLibraryForSettings(s);
    const display = firstText?.text || (firstIcon ? iconOptionLabel(firstIcon.icon, iconLibrary) : 'Empty key');
    if (title) title.textContent = display;
    if (meta) {
        const location = `R${active.row + 1} · ${active.block || 'main'}`;
        meta.textContent = selected.length > 1 ? `${selected.length} keys selected · ${location}` : location;
    }
    const index = normalizedSelection(keys).active;
    setDisabledIfChanged(prev, index == null || index <= 0);
    setDisabledIfChanged(next, index == null || index >= keys.length - 1);
}

function updateLegendStarter(active, settings = {}) {
    const starter = document.getElementById('legendStarter');
    const grid = document.getElementById('legendStarterGrid');
    if (!starter || !grid) return;
    starter.hidden = !active;
    if (!active) return;
    const sig = customIconLibrarySignature(settings);
    if (grid.dataset.sig === sig) return;
    grid.dataset.sig = sig;
    grid.innerHTML = LEGEND_STARTER_RECIPES.map((recipe) => (
        `<button type="button" class="legend-starter-card" data-legend-recipe="${html(recipe.id)}">`
        + `<span class="legend-starter-preview">${legendPreviewElementsHtml(recipe.preview, settings)}</span>`
        + `<span>${html(recipe.label)}</span>`
        + '</button>'
    )).join('');
}

function legendPreviewElementsHtml(elements = [], settings = {}) {
    const library = iconLibraryForSettings(settings);
    return cleanElements(elements).map((el) => {
        const pos = legendPreviewPosition(el.slot);
        const style = `left:${pos.x}%;top:${pos.y}%;transform:translate(${pos.tx}%,${pos.ty}%);`;
        if (el.kind === 'ico') {
            return `<span class="legend-preview-element legend-preview-icon" style="${style}">${iconSvgHtml(el.icon, library)}</span>`;
        }
        return `<span class="legend-preview-element legend-preview-text" style="${style}">${html(el.text)}</span>`;
    }).join('');
}

function legendPreviewPosition(slot = 'MC') {
    const [vertical = 'M', horizontal = 'C'] = String(slot || 'MC');
    const x = /[Ll]/.test(horizontal) ? 10 : /[Rr]/.test(horizontal) ? 90 : 50;
    const y = /[Tt]/.test(vertical) ? 10
        : /[Bb]/.test(vertical) ? 90
        : vertical === 'U' ? 68
        : vertical === 'F' ? 34
        : 50;
    const tx = /[Ll]/.test(horizontal) ? 0 : /[Rr]/.test(horizontal) ? -100 : -50;
    const ty = /[Tt]/.test(vertical) ? 0 : /[Bb]/.test(vertical) ? -100 : -50;
    return { x, y, tx, ty };
}

function iconSvgHtml(name, library = ICONS) {
    const icon = library[name];
    if (!icon?.d) return '<span aria-hidden="true">◆</span>';
    const ox = finiteOr(icon.ox, 0);
    const oy = finiteOr(icon.oy, 0);
    const w = Math.max(0.001, finiteOr(icon.w, 1));
    const h = Math.max(0.001, finiteOr(icon.h, 1));
    return `<svg viewBox="${ox} ${oy} ${w} ${h}" aria-hidden="true" focusable="false"><path d="${html(icon.d)}"></path></svg>`;
}

function renderElementEditor(elements, { disabled = false, sig = null, templateId = '', settings = null } = {}) {
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
        editor.innerHTML = '';
        return;
    }
    editor.innerHTML = elements.map((el, i) => elementEditorHtml(el, i, settings || {})).join('');
}

function elementEditorHtml(el, i, settings = {}) {
    const offset = html(JSON.stringify(cleanOffset(el.offset) || {}));
    const remove = '<button type="button" class="btn-inline legend-remove-element-btn" aria-label="Remove element" title="Remove">'
        + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">'
        + '<defs><style>.preset-del-st0{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.2px}</style></defs>'
        + '<polyline class="preset-del-st0" points="5.001144 2.7699421 5.001144 1.7891858 6.998856 1.7891858 6.998856 2.7699421"></polyline>'
        + '<polyline class="preset-del-st0" points="8.6261951 2.7699421 8.3008282 10 3.6993139 10 3.37286 2.7699421"></polyline>'
        + '<line class="preset-del-st0" x1="2.4330709" y1="2.7699421" x2="9.5669291" y2="2.7699421"></line>'
        + '</svg></button>';
    const common = ` data-index="${i}" data-source-slot="${html(el.slot)}" data-offset="${offset}"`;
    const position = positionPickerHtml(el);
    if (el.kind === 'ico') {
        const library = iconLibraryForSettings(settings);
        const iconOptions = iconOptionsForSettings(settings);
        if (el.icon && !iconOptions.includes(el.icon)) iconOptions.push(el.icon);
        const icons = iconOptions.map((name) => {
            const label = iconOptionLabel(name, library);
            return `<button type="button" class="legend-icon-option${name === el.icon ? ' is-active' : ''}" data-icon-value="${html(name)}" title="${html(label)}" aria-label="${html(label)}">`
                + iconSvgHtml(name, library)
                + '</button>';
        }).join('');
        return '<div class="legend-edit-row" data-kind="ico" data-group="' + html(iconLayerId(el)) + '"' + common + '>'
            + '<div class="legend-element-main">'
            + `<div class="legend-element-header"><strong>Icon ${i + 1}</strong></div>`
            + `<input class="legend-icon-input" type="hidden" value="${html(el.icon)}">`
            + `<div class="legend-icon-grid">${icons}</div>`
            + `<div class="legend-element-footer">${remove}${position.fine}</div>`
            + '</div>'
            + position.pad
            + '</div>';
    }
    return '<div class="legend-edit-row" data-kind="txt"' + common + ' data-size="' + html(el.size) + '" data-tracking="' + html(el.tracking || 0) + '">'
        + '<div class="legend-element-main">'
        + `<div class="legend-text-entry"><input class="legend-text-input" aria-label="Text ${i + 1}" value="${html(el.text)}"></div>`
        + textStylePickerHtml(el, settings)
        + `<div class="legend-element-footer">${remove}${position.fine}</div>`
        + '</div>'
        + position.pad
        + '</div>';
}

function textStylePickerHtml(el, settings = {}) {
    const selected = validTextStyleId(el.styleId || inferTextStyleId(el)) || 'label';
    const styles = textStylesForSettings(settings || {});
    const buttons = TEXT_STYLE_IDS.map((id) => {
        const style = styles[id] || defaultTextStyle(id);
        const label = style.name || TEXT_STYLE_NAMES[id];
        const summary = `${label} · ${round(finiteOr(style.size, 9), 2)} pt · ${round(finiteOr(style.weight, 400), 0)}`;
        return `<button type="button" class="legend-style-option${id === selected ? ' is-active' : ''}" data-style-value="${html(id)}" title="${html(summary)}">${html(label)}</button>`;
    }).join('');
    return '<div class="legend-style-field">'
        + `<input class="legend-style-input" type="hidden" value="${html(selected)}">`
        + `<div class="legend-style-grid">${buttons}</div></div>`;
}

function positionPickerHtml(el) {
    const current = String(el.slot || 'BC').trim() || 'BC';
    const gridSlots = SLOT_GRID_OPTIONS.flat();
    const isSpecial = !gridSlots.includes(current);
    const grid = gridSlots.map((value) =>
        `<button type="button" class="legend-slot-option${value === current ? ' is-active' : ''}" data-slot-value="${html(value)}" aria-label="${html(slotLabel(value))}" title="${html(slotLabel(value))}">${html(slotSymbol(value))}</button>`).join('');
    const specialValues = [...new Set([...SLOT_SPECIAL_OPTIONS, ...(isSpecial ? [current] : [])])];
    const specialOptions = ['<option value="">Choose special…</option>']
        .concat(specialValues.map((value) =>
            `<option value="${html(value)}"${value === current ? ' selected' : ''}>${html(`${value} · ${slotLabel(value)}`)}</option>`))
        .join('');
    const offset = cleanOffset(el.offset) || {};
    const xValue = el.kind === 'ico' ? offset.x : offset.bx;
    const yValue = el.kind === 'ico' ? offset.y : offset.by;
    const extra = el.kind === 'ico'
        ? `<label><span>Width</span><input class="legend-width-input" type="number" step="0.001" value="${html(el.w)}"></label>`
            + `<label><span>Height</span><input class="legend-height-input" type="number" step="0.001" value="${html(el.h)}"></label>`
        : `<label><span>Compensation</span><input class="legend-comp-input" type="number" step="0.001" value="${html(Number.isFinite(el.compOverride?.px) ? el.compOverride.px : '')}" placeholder="Auto"></label>`;
    const hasFineTuning = isSpecial || Object.keys(offset).length || Number.isFinite(el.compOverride?.px);
    const pad = `<div class="legend-slot-field" title="${html(slotLabel(current))}">`
        + `<input class="legend-slot-input" type="hidden" value="${html(current)}">`
        + `<div class="legend-slot-grid">${grid}</div>`
        + '</div>';
    const fine = `<details class="legend-fine-tuning${hasFineTuning ? ' has-custom' : ''}">`
        + '<summary aria-label="Fine tuning" title="Fine tuning"><span aria-hidden="true">...</span></summary>'
        + '<div class="legend-fine-tuning-fields">'
        + `<label class="legend-fine-position"><span>Exact position</span><select class="legend-slot-special-select" aria-label="Exact position">${specialOptions}</select></label>`
        + `<label><span>Offset X</span><input class="legend-offset-x-input" type="number" step="0.001" value="${html(Number.isFinite(xValue) ? xValue : '')}" placeholder="0"></label>`
        + `<label><span>Offset Y</span><input class="legend-offset-y-input" type="number" step="0.001" value="${html(Number.isFinite(yValue) ? yValue : '')}" placeholder="0"></label>`
        + extra
        + '</div>'
        + '</details>';
    return { pad, fine };
}

function slotSymbol(slot = '') {
    const map = {
        TL: '↖', TC: '↑', TR: '↗',
        ML: '←', MC: '•', MR: '→',
        BL: '↙', BC: '↓', BR: '↘'
    };
    return map[slot] || slot;
}

function slotLabel(slot = '') {
    const map = {
        TL: 'Top left', TC: 'Top', TR: 'Top right',
        ML: 'Left', MC: 'Center', MR: 'Right',
        BL: 'Bottom left', BC: 'Bottom', BR: 'Bottom right',
        FC: 'Function', UC: 'Upper',
        FL: 'Func left', FR: 'Func right',
        tC: 'Free top', bC: 'Free bottom',
        tL: 'Free top L', bL: 'Free bottom L',
        Ml: 'Mid free L', Mr: 'Mid free R',
        Tr: 'Top free R', Tl: 'Top free L', Fr: 'Func free R'
    };
    return map[slot] || slot || 'Slot';
}

function toggleLegendFineTuning(details) {
    if (!details) return;
    const shouldOpen = !details.open;
    closeLegendFineTuningPopovers(details);
    details.open = shouldOpen;
    if (shouldOpen) requestAnimationFrame(() => positionLegendFineTuningPopover(details));
}

function closeLegendFineTuningPopovers(except = null) {
    document.querySelectorAll('.legend-fine-tuning[open]').forEach((details) => {
        if (details !== except) details.removeAttribute('open');
    });
}

function positionLegendFineTuningPopover(details) {
    if (!details?.open) return;
    const summary = details.querySelector('summary');
    const popover = details.querySelector('.legend-fine-tuning-fields');
    if (!summary || !popover) return;
    const anchor = summary.getBoundingClientRect();
    const width = Math.min(286, Math.max(220, window.innerWidth - 16));
    popover.style.width = `${width}px`;
    const height = popover.getBoundingClientRect().height;
    const left = clamp(anchor.right - width, 8, Math.max(8, window.innerWidth - width - 8));
    const below = anchor.bottom + 5;
    const top = below + height <= window.innerHeight - 8
        ? below
        : Math.max(8, anchor.top - height - 5);
    popover.style.left = `${round(left, 1)}px`;
    popover.style.top = `${round(top, 1)}px`;
}

function updateLegendFineTuningIndicator(field) {
    if (!field) return;
    const row = field.closest('.legend-edit-row');
    const slot = String(field.querySelector('.legend-slot-input')?.value || '');
    const hasSpecialSlot = !SLOT_GRID_OPTIONS.flat().includes(slot);
    const hasOverride = [
        '.legend-offset-x-input',
        '.legend-offset-y-input',
        '.legend-comp-input'
    ].some((selector) => String(field.querySelector(selector)?.value || '').trim() !== '');
    row?.querySelector('.legend-fine-tuning')?.classList.toggle('has-custom', hasSpecialSlot || hasOverride);
}

function handleSlotPickerClick(app, event) {
    const option = event.target.closest('[data-slot-value]');
    if (!option) return false;
    const field = option.closest('.legend-slot-field');
    const row = option.closest('.legend-edit-row');
    const value = option.dataset.slotValue || 'BC';
    const input = field?.querySelector('.legend-slot-input');
    if (input) input.value = value;
    const specialSelect = field?.querySelector('.legend-slot-special-select');
    if (specialSelect) specialSelect.value = '';
    field?.querySelectorAll('[data-slot-value]').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.slotValue === value);
    });
    if (field) field.title = slotLabel(value);
    updateLegendFineTuningIndicator(field);
    commitLegendEditorChange(app, { intent: 'position', row });
    event.preventDefault();
    return true;
}

function handleSlotSpecialChange(app, event) {
    const select = event.target.closest?.('.legend-slot-special-select');
    if (!select) return false;
    const value = String(select.value || '').trim();
    if (!value) return true;
    const row = select.closest('.legend-edit-row');
    const field = row?.querySelector('.legend-slot-field');
    const input = field?.querySelector('.legend-slot-input');
    if (input) input.value = value;
    field?.querySelectorAll('[data-slot-value]').forEach((el) => el.classList.remove('is-active'));
    if (field) field.title = slotLabel(value);
    updateLegendFineTuningIndicator(field);
    commitLegendEditorChange(app, { intent: 'position', row });
    event.preventDefault();
    return true;
}

function defaultLegendElement(kind, settings = {}) {
    if (kind === 'ico') {
        return cleanElement({
            slot: 'FC',
            kind: 'ico',
            group: 'icons',
            icon: firstIconOption(settings),
            w: 8,
            h: 8
        });
    }
    return cleanElement({
        slot: 'BC',
        kind: 'txt',
        text: '',
        styleId: 'label',
        size: TYPE_DEFAULTS.wordSize,
        tracking: 0
    });
}

function forceLegendEditorRender() {
    const editor = document.getElementById('legendElementEditor');
    if (editor) editor.dataset.forceRender = 'true';
}

function setContentEditsIfChanged(app, next) {
    const clean = sanitizeContentEdits(next || {});
    const current = sanitizeContentEdits(app.settings.contentEdits || {});
    if (JSON.stringify(clean) === JSON.stringify(current)) return false;
    app.settingsStore.set('contentEdits', clean);
    return true;
}

function commitActiveLegendElements(app, elements, { tpl = null, forceRender = false } = {}) {
    const keys = layoutFor(app.settings).keys;
    const active = activeKey(keys);
    if (!active) return false;
    const next = sanitizeContentEdits(app.settings.contentEdits || {});
    writeContentEdit(
        next,
        active,
        tpl || active.tpl || 'blank',
        cleanElements(elements),
        cleanHexColor(active.keyColor)
    );
    if (forceRender) forceLegendEditorRender();
    return setContentEditsIfChanged(app, next);
}

function applyLegendStarter(app, recipeId) {
    const recipe = LEGEND_STARTER_RECIPES.find((item) => item.id === recipeId);
    const active = activeKey(layoutFor(app.settings).keys);
    if (!recipe || !active || sourceElements(active).length) return;
    commitActiveLegendElements(app, recipe.elements, { tpl: recipe.tpl, forceRender: true });
}

function addLegendElement(app, kind) {
    if (!activeKey(layoutFor(app.settings).keys)) return;
    const elements = readElementEditorElements();
    elements.push(defaultLegendElement(kind, app.settings));
    commitActiveLegendElements(app, elements, { forceRender: true });
}

function removeLegendElement(app, button) {
    const row = button.closest('.legend-edit-row');
    if (!row) return;
    row.remove();
    commitActiveLegendElements(app, readElementEditorElements(), { forceRender: true });
}

function chooseLegendTextStyle(app, button) {
    const row = button.closest('.legend-edit-row');
    const input = row?.querySelector('.legend-style-input');
    const value = validTextStyleId(button.dataset.styleValue);
    if (!row || !input || !value) return;
    input.value = value;
    row.querySelectorAll('[data-style-value]').forEach((item) => {
        item.classList.toggle('is-active', item === button);
    });
    commitLegendEditorChange(app, { intent: 'style', row });
}

function chooseLegendIcon(app, button) {
    const row = button.closest('.legend-edit-row');
    const input = row?.querySelector('.legend-icon-input');
    const value = String(button.dataset.iconValue || '').trim();
    if (!row || !input || !value) return;
    input.value = value;
    row.querySelectorAll('[data-icon-value]').forEach((item) => {
        item.classList.toggle('is-active', item === button);
    });
    commitLegendEditorChange(app, { intent: 'content', row });
}

function readElementEditorElements() {
    const rows = [...document.querySelectorAll('#legendElementEditor .legend-edit-row')];
    return rows.map((row) => {
        const kind = row.dataset.kind === 'ico' ? 'ico' : 'txt';
        const xRaw = row.querySelector('.legend-offset-x-input')?.value;
        const yRaw = row.querySelector('.legend-offset-y-input')?.value;
        const offset = cleanOffset(kind === 'ico'
            ? { x: xRaw, y: yRaw }
            : { bx: xRaw, by: yRaw }) || {};
        const base = {
            slot: row.querySelector('.legend-slot-input')?.value || 'BC',
            kind,
            offset
        };
        if (base.kind === 'ico') {
            return cleanElement({
                ...base,
                group: row.dataset.group || 'icons',
                icon: row.querySelector('.legend-icon-input')?.value || firstIconOption(app?.settings || {}),
                w: row.querySelector('.legend-width-input')?.value,
                h: row.querySelector('.legend-height-input')?.value
            });
        }
        const text = row.querySelector('.legend-text-input')?.value || '';
        const size = row.querySelector('.legend-size-input')?.value || row.dataset.size || TYPE_DEFAULTS.wordSize;
        const selectedStyle = validTextStyleId(row.querySelector('.legend-style-input')?.value || '');
        const inferredStyle = inferTextStyleId({ ...base, text, size });
        return cleanElement({
            ...base,
            text,
            styleId: selectedStyle && selectedStyle !== inferredStyle ? selectedStyle : '',
            size,
            tracking: row.querySelector('.legend-track-input')?.value || row.dataset.tracking || 0,
            compOverride: (() => {
                const raw = row.querySelector('.legend-comp-input')?.value;
                return raw === '' || raw == null ? null : { px: raw };
            })()
        });
    });
}

function commitLegendEditorChange(app, { intent = 'content', row = null } = {}) {
    const keys = layoutFor(app.settings).keys;
    const selected = selectedKeys(keys);
    const active = activeKey(keys);
    if (!active || !selected.length) return false;
    const editedElements = readElementEditorElements();
    const editedIndex = Number(row?.dataset.index);
    const editedElement = Number.isInteger(editedIndex) ? editedElements[editedIndex] : null;
    const sourceSlot = String(row?.dataset.sourceSlot || editedElement?.slot || '');
    const next = sanitizeContentEdits(app.settings.contentEdits || {});
    writeContentEdit(next, active, active.tpl || 'blank', editedElements, cleanHexColor(active.keyColor));

    if ((intent === 'style' || intent === 'position') && editedElement && sourceSlot) {
        for (const key of selected) {
            if (key.editId === active.editId) continue;
            let changed = false;
            const elements = sourceElements(key).map((element) => {
                if (element.kind !== editedElement.kind || element.slot !== sourceSlot) return element;
                changed = true;
                return patchLegendElement(element, editedElement, intent);
            });
            if (changed) {
                writeContentEdit(next, key, key.tpl || 'blank', elements, cleanHexColor(key.keyColor));
            }
        }
    }
    if (intent === 'position' && row && editedElement) row.dataset.sourceSlot = editedElement.slot;
    return setContentEditsIfChanged(app, next);
}

function patchLegendElement(target, edited, intent) {
    const next = { ...target };
    if (intent === 'position') {
        next.slot = edited.slot;
        delete next.offset;
        if (edited.offset) next.offset = clonePlain(edited.offset);
        return cleanElement(next);
    }
    if (target.kind === 'ico') {
        next.w = edited.w;
        next.h = edited.h;
        return cleanElement(next);
    }
    for (const key of ['styleId', 'fontId', 'tracking', 'compOverride']) delete next[key];
    for (const key of ['styleId', 'fontId', 'tracking', 'compOverride']) {
        if (edited[key] != null && edited[key] !== '') next[key] = clonePlain(edited[key]);
    }
    next.size = edited.size;
    return cleanElement(next);
}

function commitLegendKeyColor(app) {
    const raw = String(document.getElementById('legendKeyColorInput')?.value || '').trim();
    const color = cleanHexColor(raw);
    if (raw && !color) return false;
    const keys = layoutFor(app.settings).keys;
    const selected = selectedKeys(keys);
    if (!selected.length) return false;
    const next = sanitizeContentEdits(app.settings.contentEdits || {});
    for (const key of selected) {
        writeContentEdit(next, key, key.tpl || 'blank', sourceElements(key), color);
    }
    return setContentEditsIfChanged(app, next);
}

function selectAdjacentKey(app, delta) {
    const keys = layoutFor(app.settings).keys;
    if (!keys.length) return;
    const current = normalizedSelection(keys).active;
    const index = clamp((current == null ? 0 : current) + delta, 0, keys.length - 1);
    selectKey(app, index);
}

function installFunctionDrag(app) {
    const surface = app.dom?.surface;
    if (!surface || app.__keyboarderFunctionDrag) return;
    app.__keyboarderFunctionDrag = true;

    surface.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
        if (legendEditorDirty(app)) return;
        const keys = layoutFor(app.settings).keys;
        const key = keyAtClientPoint(surface, keys, e.clientX, e.clientY);
        const profile = dragProfileForKey(key, keys);
        if (!profile) return;
        CONTENT_DRAG = {
            pointerId: e.pointerId,
            sourceEditId: key.editId,
            mode: profile.mode,
            region: profile.region,
            startClientX: e.clientX,
            startClientY: e.clientY,
            overEditId: null,
            dragging: false
        };
        try { surface.setPointerCapture(e.pointerId); } catch (_) {}
    });

    surface.addEventListener('pointermove', (e) => {
        if (!CONTENT_DRAG || CONTENT_DRAG.pointerId !== e.pointerId) return;
        const dx = e.clientX - CONTENT_DRAG.startClientX;
        const dy = e.clientY - CONTENT_DRAG.startClientY;
        if (!CONTENT_DRAG.dragging && Math.hypot(dx, dy) < CONTENT_DRAG_START_PX) return;
        if (!CONTENT_DRAG.dragging) {
            CONTENT_DRAG.dragging = true;
            SUPPRESS_NEXT_SURFACE_CLICK = true;
        }
        const keys = layoutFor(app.settings).keys;
        const over = keyAtClientPoint(surface, keys, e.clientX, e.clientY);
        const compatible = compatibleDragTarget(CONTENT_DRAG, over, keys);
        const nextOver = compatible?.editId || null;
        if (CONTENT_DRAG.overEditId !== nextOver) {
            CONTENT_DRAG.overEditId = nextOver;
            app.renderNow();
        }
        e.preventDefault();
    });

    surface.addEventListener('pointerup', (e) => {
        if (!CONTENT_DRAG || CONTENT_DRAG.pointerId !== e.pointerId) return;
        const drag = CONTENT_DRAG;
        const keys = layoutFor(app.settings).keys;
        const over = keyAtClientPoint(surface, keys, e.clientX, e.clientY);
        const target = compatibleDragTarget(drag, over, keys);
        CONTENT_DRAG = null;
        try { surface.releasePointerCapture(e.pointerId); } catch (_) {}
        if (drag.dragging) {
            SUPPRESS_NEXT_SURFACE_CLICK = true;
            if (target) performFunctionDrag(app, drag.sourceEditId, target.editId, drag.mode);
            else app.renderNow();
            e.preventDefault();
        }
    });

    surface.addEventListener('pointercancel', (e) => {
        if (!CONTENT_DRAG || CONTENT_DRAG.pointerId !== e.pointerId) return;
        CONTENT_DRAG = null;
        try { surface.releasePointerCapture(e.pointerId); } catch (_) {}
        app.renderNow();
    });
}

function installFunctionDragDebugAPI(app) {
    if (typeof window === 'undefined') return;
    window.KeyboarderFunctionDrag = {
        keys: () => layoutFor(app.settings).keys.map((k) => ({
            editId: k.editId,
            row: k.row,
            block: k.block || '',
            x: k.x,
            y: k.y,
            w: k.w,
            h: k.h,
            tpl: k.tpl || 'blank',
            text: sourceElements(k).filter((el) => el.kind === 'txt').map((el) => el.text),
            icons: sourceElements(k).filter((el) => el.kind === 'ico').map((el) => el.icon)
        })),
        centerOf: (editId) => {
            const key = keyByEditId(layoutFor(app.settings).keys, editId);
            if (!key || !app.dom?.surface?.createSVGPoint) return null;
            const point = app.dom.surface.createSVGPoint();
            point.x = key.x + key.w / 2;
            point.y = key.y + key.h / 2;
            const ctm = app.dom.surface.getScreenCTM();
            if (!ctm) return null;
            const screen = point.matrixTransform(ctm);
            return { x: screen.x, y: screen.y };
        }
    };
}

function dragProfileForKey(key, keys) {
    if (!key) return null;
    if (isFRowKey(key) && firstIconElementIndex(sourceElements(key)) >= 0) {
        return { mode: 'f-row-icon', region: 'f-row' };
    }
    const region = functionDragRegion(key, keys);
    return region ? { mode: 'function', region } : null;
}

function compatibleDragTarget(drag, key, keys) {
    if (!drag || !key || key.editId === drag.sourceEditId) return null;
    if (drag.mode === 'f-row-icon') return isFRowKey(key) ? key : null;
    if (drag.mode === 'function') return functionDragRegion(key, keys) === drag.region ? key : null;
    return null;
}

function isFRowKey(key) {
    return !!key && key.row === 0 && String(key.block || '') === 'main';
}

function functionDragRegion(key, keys) {
    if (!key) return null;
    if (String(key.block || '') === 'numpad') return 'numpad';
    const maxMainRow = Math.max(-1, ...keys
        .filter((k) => String(k.block || '') === 'main')
        .map((k) => k.row));
    return String(key.block || '') === 'main' && key.row === maxMainRow ? 'bottom-main' : null;
}

function performFunctionDrag(app, sourceEditId, targetEditId, mode) {
    const keys = layoutFor(app.settings).keys;
    const source = keyByEditId(keys, sourceEditId);
    const target = keyByEditId(keys, targetEditId);
    if (!source || !target || source.editId === target.editId) {
        app.renderNow();
        return false;
    }
    const next = sanitizeContentEdits(app.settings.contentEdits || {});
    const changed = mode === 'f-row-icon'
        ? writeFRowIconSwap(next, source, target)
        : writeFunctionContentSwap(next, source, target);
    if (!changed) {
        app.renderNow();
        return false;
    }
    clearLegendDraftState();
    app.settingsStore.set('contentEdits', next);
    selectKey(app, target.i);
    app._showToast?.(mode === 'f-row-icon' ? 'Icon moved' : 'Function moved');
    return true;
}

function keyByEditId(keys, editId) {
    return keys.find((k) => k.editId === editId) || null;
}

function contentPayloadForKey(k) {
    return {
        tpl: k.tpl || 'blank',
        elements: sourceElements(k),
        keyColor: cleanHexColor(k.keyColor)
    };
}

function writeFunctionContentSwap(edits, source, target) {
    const sourcePayload = contentPayloadForKey(source);
    const targetPayload = contentPayloadForKey(target);
    if (JSON.stringify(sourcePayload) === JSON.stringify(targetPayload)) return false;
    writeContentEdit(edits, source, targetPayload.tpl, targetPayload.elements, targetPayload.keyColor);
    writeContentEdit(edits, target, sourcePayload.tpl, sourcePayload.elements, sourcePayload.keyColor);
    return true;
}

function writeFRowIconSwap(edits, source, target) {
    const sourcePayload = contentPayloadForKey(source);
    const targetPayload = contentPayloadForKey(target);
    const sourceElementsNext = cleanElements(sourcePayload.elements);
    const targetElementsNext = cleanElements(targetPayload.elements);
    const sourceIconIndex = firstIconElementIndex(sourceElementsNext);
    const targetIconIndex = firstIconElementIndex(targetElementsNext);
    if (sourceIconIndex < 0) return false;

    const sourceIcon = sourceElementsNext[sourceIconIndex];
    const targetIcon = targetIconIndex >= 0 ? targetElementsNext[targetIconIndex] : null;
    if (targetIcon && sourceIcon.icon === targetIcon.icon) return false;

    if (targetIcon) {
        sourceElementsNext[sourceIconIndex] = iconForDestination(targetIcon, sourceIcon);
        targetElementsNext[targetIconIndex] = iconForDestination(sourceIcon, targetIcon);
    } else {
        sourceElementsNext.splice(sourceIconIndex, 1);
        targetElementsNext.push(cleanElement({ ...sourceIcon }));
    }

    writeContentEdit(edits, source, sourcePayload.tpl, sourceElementsNext, sourcePayload.keyColor);
    writeContentEdit(edits, target, targetPayload.tpl, targetElementsNext, targetPayload.keyColor);
    return true;
}

function firstIconElementIndex(elements = []) {
    return cleanElements(elements).findIndex((el) => el.kind === 'ico');
}

function iconForDestination(incoming, destination) {
    return cleanElement({
        ...destination,
        icon: incoming.icon
    });
}

function clearLegendDraftState() {
    const editor = document.getElementById('legendElementEditor');
    if (editor) {
        delete editor.dataset.activeEditId;
        delete editor.dataset.sig;
    }
    LEGEND_DRAFT = null;
    invalidateLayoutCaches();
}

function readLegendKeyColor() {
    return cleanHexColor(document.getElementById('legendKeyColorInput')?.value || '');
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

function legendSelectionWouldChange(index, { toggle = false } = {}) {
    if (!Number.isInteger(index)) return !!SELECTION.indices?.length;
    if (toggle) return true;
    return SELECTION.active !== index || (SELECTION.indices || []).length !== 1 || SELECTION.indices[0] !== index;
}

function legendEditorDirty(app) {
    return false;
}

function legendDraftDiffersFromActive(active) {
    if (!active) return false;
    const editor = document.getElementById('legendElementEditor');
    if (!editor || editor.dataset.activeEditId !== active.editId) return false;
    const currentTemplate = editor?.dataset.templateId || variantForKey(active);
    const saved = active.savedContent || {
        tpl: active.tpl || 'blank',
        elements: sourceElements(active),
        keyColor: cleanHexColor(active.keyColor)
    };
    const baseTemplate = templateVariantId(saved.tpl || 'blank', saved.elements || []);
    return currentTemplate !== baseTemplate
        || readLegendKeyColor() !== cleanHexColor(saved.keyColor)
        || JSON.stringify(readElementEditorElements()) !== JSON.stringify(cleanElements(saved.elements || []));
}

async function confirmDiscardLegendDraft(app) {
    return true;
}

async function closeLegendPopoverIfAllowed(app) {
    if (!(await confirmDiscardLegendDraft(app))) return false;
    closeLegendPopover(app);
    selectKey(app, null);
    return true;
}

function closeLegendPopover(app = null) {
    const panel = document.getElementById('legendPanel');
    if (!panel) return;
    clearLegendDraftState();
    panel.classList.add('panel-collapsed');
    panel.querySelector('.collapse-icon')?.classList.add('collapsed');
    panel.style.left = '';
    panel.style.top = '';
    if (app && legendEditorDirty(app)) updateLegendEditor(app.settings, layoutFor(app.settings).keys);
}

function installLegendPopoverDrag(app) {
    const panel = document.getElementById('legendPanel');
    const header = document.getElementById('legendPanelHeader');
    if (!panel || !header || app.__keyboarderLegendPopoverDrag) return;
    app.__keyboarderLegendPopoverDrag = true;

    header.addEventListener('pointerdown', (e) => {
        if (isAdvancedUiMode() || e.button !== 0) return;
        if (panel.classList.contains('panel-collapsed')) return;
        const rect = panel.getBoundingClientRect();
        LEGEND_POPOVER_DRAG = {
            pointerId: e.pointerId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            left: rect.left,
            top: rect.top,
            moved: false
        };
        try { header.setPointerCapture(e.pointerId); } catch (_) {}
    });

    header.addEventListener('pointermove', (e) => {
        if (!LEGEND_POPOVER_DRAG || LEGEND_POPOVER_DRAG.pointerId !== e.pointerId) return;
        const dx = e.clientX - LEGEND_POPOVER_DRAG.startClientX;
        const dy = e.clientY - LEGEND_POPOVER_DRAG.startClientY;
        if (!LEGEND_POPOVER_DRAG.moved && Math.hypot(dx, dy) < CONTENT_DRAG_START_PX) return;
        LEGEND_POPOVER_DRAG.moved = true;
        const margin = 14;
        const bottomMargin = 74;
        const width = panel.offsetWidth || 390;
        const height = panel.offsetHeight || 420;
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 800;
        const left = clamp(LEGEND_POPOVER_DRAG.left + dx, margin, Math.max(margin, vw - width - margin));
        const top = clamp(LEGEND_POPOVER_DRAG.top + dy, margin, Math.max(margin, vh - height - bottomMargin));
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        SUPPRESS_NEXT_SURFACE_CLICK = true;
        e.preventDefault();
    });

    header.addEventListener('pointerup', (e) => {
        if (!LEGEND_POPOVER_DRAG || LEGEND_POPOVER_DRAG.pointerId !== e.pointerId) return;
        if (LEGEND_POPOVER_DRAG.moved) SUPPRESS_NEXT_SURFACE_CLICK = true;
        LEGEND_POPOVER_DRAG = null;
        try { header.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    header.addEventListener('pointercancel', (e) => {
        if (!LEGEND_POPOVER_DRAG || LEGEND_POPOVER_DRAG.pointerId !== e.pointerId) return;
        LEGEND_POPOVER_DRAG = null;
        try { header.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    header.addEventListener('click', (e) => {
        if (!SUPPRESS_NEXT_SURFACE_CLICK) return;
        SUPPRESS_NEXT_SURFACE_CLICK = false;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
}

function openLegendPopoverAt(clientX, clientY) {
    const panel = document.getElementById('legendPanel');
    if (!panel) return;
    const wasCollapsed = panel.classList.contains('panel-collapsed');
    panel.classList.remove('panel-collapsed');
    panel.querySelector('.collapse-icon')?.classList.remove('collapsed');
    if (wasCollapsed) requestAnimationFrame(() => positionLegendPopover(panel, clientX, clientY));
}

function positionLegendPopover(panel, clientX, clientY) {
    const margin = 14;
    const bottomMargin = 74;
    const gap = 12;
    const width = panel.offsetWidth || 390;
    const height = panel.offsetHeight || 420;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    let left = clientX + gap;
    let top = clientY + gap;
    if (left + width + margin > vw) left = clientX - width - gap;
    if (top + height + bottomMargin > vh) top = vh - height - bottomMargin;
    left = clamp(left, margin, Math.max(margin, vw - width - margin));
    top = clamp(top, margin, Math.max(margin, vh - height - bottomMargin));
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
}

function expandLegendPanel() {
    const panel = document.getElementById('legendPanel');
    if (!panel || !panel.classList.contains('panel-collapsed')) return;
    panel.classList.remove('panel-collapsed');
    panel.querySelector('.collapse-icon')?.classList.remove('collapsed');
}

function pdfEditableSvgForExport(app) {
    if (!app?.target?.element || app.target.type !== 'svg') return null;
    const previousMode = SVG_EXPORT_TEXT_MODE;
    try {
        if (previousMode !== 'text') {
            SVG_EXPORT_TEXT_MODE = 'text';
            app.renderNow();
        }
        return app.target.element.cloneNode(true);
    } finally {
        if (SVG_EXPORT_TEXT_MODE !== previousMode) {
            SVG_EXPORT_TEXT_MODE = previousMode;
            app.renderNow();
        }
    }
}

function pdfFontsForSvg(svg) {
    const fonts = new Map();
    for (const text of svg?.querySelectorAll?.('#glyphs text') || []) {
        const id = cleanRuntimeFontId(text.getAttribute('data-font-id')) || REFERENCE_FONT_ID;
        const entry = fontEntry(id);
        const svgFamily = String(text.getAttribute('font-family') || exportFontFamily(entry)).trim();
        const style = String(text.getAttribute('font-style') || 'normal').trim() || 'normal';
        const weight = Math.round(finiteOr(text.getAttribute('font-weight'), 400));
        const data = entry?.tf?.buffer;
        if (!entry || !data) {
            throw new Error(`Editable PDF font data is unavailable for ${svgFamily || id}.`);
        }
        if (!/\.ttf$/i.test(entry.fileName || '')) {
            throw new Error(`Editable PDF currently requires a TTF font file: ${entry.fileName || svgFamily}.`);
        }
        const postScriptName = String(entry.probe?.names?.postScriptName || '').trim();
        const preserveVariations = (entry.probe?.variations?.axes || []).length > 0;
        const family = preserveVariations && postScriptName ? postScriptName : svgFamily;
        if (preserveVariations) text.setAttribute('font-family', family);
        const key = `${entry.id}:${family}:${style}:${weight}:${preserveVariations ? 'vf' : 'static'}`;
        if (fonts.has(key)) continue;
        fonts.set(key, {
            family,
            style,
            weight,
            fileName: `${slugId(postScriptName || entry.fileName || family)}-${weight}.ttf`,
            data,
            preserveVariations
        });
    }
    return [...fonts.values()];
}

function installPdfExport(app) {
    if (app.__keyboarderPdfExport) return;
    app.exportPDF = async (filename) => {
        if (!app.exporter || app.target?.type !== 'svg') return;
        const name = filename || `keyboarder-${layoutSlug(sourceLayoutFor(app.settings).meta.name)}.pdf`;
        try {
            const svg = pdfEditableSvgForExport(app);
            if (!svg) return;
            const remainingLegendPaths = svg.querySelectorAll('#glyphs path').length;
            if (remainingLegendPaths) {
                throw new Error(`Editable PDF preparation left ${remainingLegendPaths} outlined legend elements.`);
            }
            const fonts = pdfFontsForSvg(svg);
            const size = typeof app.config?.size === 'function' ? app.config.size(app.settings) : {};
            const width = Number(svg.getAttribute('width')) || Number(size.width) || 500;
            const height = Number(svg.getAttribute('height')) || Number(size.height) || 500;
            const format = { width: toMm(width), height: toMm(height) };
            await app.exporter.exportToPDF(svg, name, {
                removeInteractive: true,
                convertTextToOutlines: false,
                fonts,
                unit: 'mm',
                format
            });
            return { ok: true, filename: name };
        } catch (e) {
            app.dialog?.alert({
                title: 'PDF export failed',
                text: e?.message || 'Could not export PDF.',
                okText: 'Close'
            });
            return { ok: false, error: e?.message || 'Could not export PDF.' };
        }
    };
    app.__keyboarderPdfExport = true;
}

function installCleanExports(app) {
    if (app.__keyboarderCleanExports) return;
    installExportDebugAPI(app);
    for (const method of ['exportSVG', 'exportPNG', 'exportPDF']) {
        if (typeof app[method] !== 'function') continue;
        const original = app[method].bind(app);
        app[method] = async (...args) => {
            const prof = perfEnabled();
            const started = prof ? perfNow() : 0;
            let status = 'ok';
            let error = '';
            let cleanSnapshot = null;
            const filename = exportFilename(app, method, args);
            const previous = {
                active: SELECTION.active,
                indices: [...(SELECTION.indices || [])]
            };
            const hasSelection = previous.active != null || previous.indices.length > 0;
            if (hasSelection) {
                SELECTION = { active: null, indices: [] };
                app.renderNow();
            }
            try {
                const result = await original(...args);
                if (result?.ok === false) {
                    status = 'error';
                    error = result.error || 'Export failed';
                }
                cleanSnapshot = cleanSvgSnapshot(app);
                return result;
            } catch (e) {
                status = 'error';
                error = e?.message || String(e);
                cleanSnapshot = cleanSvgSnapshot(app);
                throw e;
            } finally {
                if (hasSelection) {
                    SELECTION = { active: previous.active, indices: previous.indices };
                    app.renderNow();
                }
                const report = exportSummary(app, method, filename, {
                    status,
                    error,
                    hadSelection: hasSelection,
                    cleanSnapshot
                });
                if (prof) {
                    perfRecord('export', {
                        ms: perfSince(started),
                        ...report
                    });
                }
                if (status === 'ok') app._showToast?.(exportToastText(report));
            }
        };
    }
    app.__keyboarderCleanExports = true;
}

function installExportDebugAPI(app) {
    if (typeof window === 'undefined') return;
    const api = {
        cleanSvgSnapshot: () => cleanSvgSnapshot(app),
        cleanSvgString: () => cleanSvgSnapshot(app).svg,
        pdfEditableSvgSnapshot: () => cleanSvgSnapshot(app, pdfEditableSvgForExport(app))
    };
    window.KeyboarderExport = api;
    app.KeyboarderExport = api;
}

function exportFilename(app, method, args = []) {
    if (args[0]) return String(args[0]);
    const base = app.config?.export?.filename || 'keyboarder.svg';
    if (method === 'exportPNG') return base.replace(/\.svg$/i, '') + '.png';
    if (method === 'exportPDF') return `keyboarder-${layoutSlug(sourceLayoutFor(app.settings).meta.name)}.pdf`;
    return base;
}

function exportSummary(app, method, filename, options = {}) {
    const data = layoutFor(app.settings);
    const legends = data.legends || [];
    const text = legends.filter((el) => el.kind === 'txt').length;
    const icons = legends.filter((el) => el.kind === 'ico').length;
    const fontFamilies = fontFamiliesForLegends(legends);
    const widthPx = Number(data.bounds?.w) || 0;
    const heightPx = Number(data.bounds?.h) || 0;
    const clean = options.cleanSnapshot || cleanSvgSnapshot(app);
    return {
        method,
        format: method.replace(/^export/, '').toLowerCase(),
        filename,
        status: options.status || 'ok',
        error: options.error || '',
        cleanedSelection: !!options.hadSelection,
        interactiveRemoved: true,
        layout: data.sourceLayout?.meta?.name || '',
        keys: data.keys?.length || 0,
        legends: legends.length,
        text,
        icons,
        textMode: svgExportTextMode(),
        fontFamilies,
        artboardPx: {
            width: round(widthPx, 3),
            height: round(heightPx, 3)
        },
        artboardMm: {
            width: round(toMm(widthPx), 3),
            height: round(toMm(heightPx), 3)
        },
        cleanSvgBytes: clean.bytes,
        cleanHasInteractive: clean.hasInteractive,
        cleanLayerCounts: clean.layerCounts
    };
}

function cleanSvgSnapshot(app, sourceSvg = app?.target?.element) {
    if (!app?.exporter || app.target?.type !== 'svg' || !sourceSvg) {
        return {
            svg: '',
            bytes: 0,
            hasInteractive: false,
            layerCounts: {}
        };
    }
    try {
        const cleanSvg = app.exporter.getCleanSVG(sourceSvg);
        const svg = new XMLSerializer().serializeToString(cleanSvg);
        return {
            svg,
            bytes: byteLength(svg),
            hasInteractive: !!cleanSvg.querySelector('[data-interactive="true"], #selection, .resize-handle, .hover-overlay'),
            layerCounts: cleanSvgLayerCounts(cleanSvg)
        };
    } catch (e) {
        console.warn('Keyboarder: clean SVG snapshot failed.', e);
        return {
            svg: '',
            bytes: 0,
            hasInteractive: false,
            layerCounts: {},
            error: e?.message || String(e)
        };
    }
}

function cleanSvgLayerCounts(svg) {
    const count = (selector) => svg.querySelectorAll(selector).length;
    return {
        caps: count('#caps rect'),
        guides: count('#guides rect'),
        glyphPaths: count('#glyphs path'),
        glyphTexts: count('#glyphs text'),
        icons: count('#icons path'),
        fIcons: count('#f-icons path'),
        selection: count('#selection'),
        interactive: count('[data-interactive="true"]')
    };
}

function byteLength(text) {
    if (typeof Blob !== 'undefined') return new Blob([text]).size;
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return String(text || '').length;
}

function exportToastText(report) {
    const format = String(report.format || 'export').toUpperCase();
    const mm = `${round(report.artboardMm?.width || 0, 1)} × ${round(report.artboardMm?.height || 0, 1)} mm`;
    const textMode = report.format === 'pdf' ? 'text' : report.textMode;
    const textLabel = textMode === 'text' ? 'editable text' : 'outlines';
    const fonts = textMode === 'text' && report.fontFamilies?.length ? ` · ${report.fontFamilies.join(', ')}` : '';
    return `${format} exported · ${report.layout} · ${mm} · ${textLabel}${fonts} · ${report.keys} keys`;
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

function renderFunctionDragOverlay(create, keys, grid) {
    if (!CONTENT_DRAG?.dragging) return null;
    const source = keyByEditId(keys, CONTENT_DRAG.sourceEditId);
    const target = keyByEditId(keys, CONTENT_DRAG.overEditId);
    if (!source && !target) return null;
    const g = create('g', { id: 'function-drag', 'pointer-events': 'none', 'data-interactive': 'true' });
    if (source) {
        g.appendChild(create('rect', {
            x: source.x - 1.4, y: source.y - 1.4, width: source.w + 2.8, height: source.h + 2.8,
            rx: grid.cornerRadius + 1.4, ry: grid.cornerRadius + 1.4,
            fill: 'none',
            stroke: '#8fb7ff',
            'stroke-width': 0.9,
            'stroke-dasharray': '2.5 1.8',
            'vector-effect': 'non-scaling-stroke'
        }));
    }
    if (target) {
        g.appendChild(create('rect', {
            x: target.x - 2, y: target.y - 2, width: target.w + 4, height: target.h + 4,
            rx: grid.cornerRadius + 2, ry: grid.cornerRadius + 2,
            fill: 'rgb(120 166 255 / 0.18)',
            stroke: '#ffffff',
            'stroke-width': 1.2,
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

function parseViewBoxValue(value = '') {
    const parts = String(value).trim().split(/[\s,]+/).map(Number);
    return parts.length === 4 && parts.every(Number.isFinite)
        ? { x: parts[0], y: parts[1], w: parts[2], h: parts[3] }
        : null;
}

function renderReferenceVisual(create, svgText, visual = {}) {
    if (typeof DOMParser !== 'function' || typeof document === 'undefined') return null;
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const source = doc.documentElement;
    if (!source || source.nodeName.toLowerCase() !== 'svg' || source.querySelector('parsererror')) return null;

    const node = document.importNode(source, true);
    const viewBox = visual.viewBox || parseViewBoxValue(node.getAttribute('viewBox')) || { x: 0, y: 0, w: 0, h: 0 };
    const box = visual.box || { x: 0, y: 0 };
    node.removeAttribute('id');
    node.setAttribute('x', 0);
    node.setAttribute('y', 0);
    node.setAttribute('width', viewBox.w);
    node.setAttribute('height', viewBox.h);
    node.setAttribute('overflow', 'visible');
    node.setAttribute('preserveAspectRatio', 'xMinYMin meet');

    const dx = box.x - viewBox.x;
    const dy = box.y - viewBox.y;
    const g = create('g', {
        id: 'reference-curves',
        opacity: 0.68,
        'pointer-events': 'none',
        transform: `translate(${dx.toFixed(4)} ${dy.toFixed(4)})`
    });
    g.appendChild(node);
    return g;
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

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function activeTypefaceReportMeta() {
    if (!TYPEFACE) return null;
    const entry = activeFontEntry();
    if (!entry) return CONTENT.font;
    if (entry.kind === 'reference') {
        return {
            family: REFERENCE_FONT_FAMILY,
            style: 'Variable',
            file: 'Fonts/YS Text Variable/YSText-Upright-weight-VF.ttf',
            coordinates: clonePlain(entry.coordinates || {})
        };
    }
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
    const assets = referenceAssetsForLayout(sourceLayout);
    if (!assets?.layout) {
        throw new Error(`No geometry reference is available for ${sourceLayout.meta.name}.`);
    }
    const geometryRaw = compare(keys, await loadReference(assets.layout));
    let legendsRaw = null;
    let legendStatus = '';
    if (!assets.legends) {
        legendStatus = 'No legend reference is available for this layout yet.';
    } else if (!TYPEFACE) {
        legendStatus = 'Typeface is still loading — nothing to verify yet.';
    } else {
        legendsRaw = compareLegends(legends, (await loadLegendReference(assets.legends)).keys);
    }
    return {
        generatedAt: new Date().toISOString(),
        layout: sourceLayout.meta.name,
        reference: {
            label: assets.label || sourceLayout.meta.name,
            layout: assets.layout,
            legends: assets.legends || null,
            visual: assets.visual?.url || null
        },
        settings: settingsSnapshot,
        typeface: activeTypefaceReportMeta(),
        geometry: { raw: geometryRaw, export: compactGeometryReport(geometryRaw) },
        legends: legendsRaw ? { raw: legendsRaw, export: compactLegendReport(legendsRaw) } : null,
        legendStatus
    };
}

function reportForExport(report) {
    return {
        generatedAt: report.generatedAt,
        layout: report.layout,
        reference: report.reference || null,
        settings: report.settings,
        typeface: report.typeface,
        geometry: report.geometry.export,
        legends: report.legends ? report.legends.export : null,
        legendStatus: report.legendStatus || ''
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

function updateReadout(s, keys, grid, legends, bounds = null) {
    const box = bounds || { w: 0, h: 0 };
    const fit = bounds?.fit || rectBounds(keys) || { w: 0, h: 0 };
    setTextIfChanged('statKeys', String(keys.length));
    setTextIfChanged('statKeySize', `${toMm(grid.keyWidth1U).toFixed(2)} × ${toMm(grid.keyHeight).toFixed(2)} mm`);
    setTextIfChanged('statBoard', `${toMm(box.w).toFixed(1)} × ${toMm(box.h).toFixed(1)} mm`);
    setTextIfChanged('statKeyBounds', `${toMm(fit.w).toFixed(1)} × ${toMm(fit.h).toFixed(1)} mm`);
    setTextIfChanged('statGap', `${toMm(gapOf(grid)).toFixed(2)} mm`);
    const txt = legends.filter((e) => e.kind === 'txt').length;
    setTextIfChanged('statLegends', TYPEFACE
        ? `${txt} strings, ${legends.length - txt} icons`
        : 'loading font');
    setTextIfChanged('statWarnings', layoutWarningText(keys, grid));
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
        setHtmlIfChanged(box, '<p class="inspector-empty">No key selected.</p>', 'none');
        return;
    }
    const items = legends.filter((el) => el.key === k);
    const sig = [
        k.editId,
        k.tpl || '',
        k.row,
        k.block || '',
        round(k.x, 3),
        round(k.y, 3),
        round(k.w, 3),
        round(k.h, 3),
        k.geometry?.widthEdited ? 'edited-width' : '',
        sel.active ?? '',
        sel.indices.join(','),
        TYPEFACE_SIG,
        fontRegistrySignature(),
        s.compensationMode || '',
        JSON.stringify(s.compensationTableEdits || {}),
        legendInspectorItemSig(items)
    ].join('|');
    const widthText = `${widthInU(k.w, grid).toFixed(2)}U · ${toMm(k.w).toFixed(3)} mm`
        + (k.geometry?.widthEdited ? ' *' : '');
    let out = '<dl class="legend-meta">'
        + `<div><dt>Selected</dt><dd>${sel.indices.length}</dd></div>`
        + `<div><dt>Template</dt><dd>${html(k.tpl || 'blank')}</dd></div>`
        + `<div><dt>Position</dt><dd>row ${k.row + 1}, ${html(k.block)}, ${widthText}</dd></div>`
        + '</dl>';
    if (!TYPEFACE) {
        setHtmlIfChanged(box, out + '<p class="inspector-empty">Font loading.</p>', sig);
        return;
    }
    if (!items.length) {
        setHtmlIfChanged(box, out + '<p class="inspector-empty">No legend elements.</p>', sig);
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
    setHtmlIfChanged(box, out, sig);
}

function legendInspectorItemSig(items) {
    return items.map((el) => {
        if (el.kind === 'txt') {
            return [
                el.kind,
                el.slot,
                el.text,
                el.size,
                el.tracking || 0,
                elementFontId(el),
                JSON.stringify(el.compOverride || null)
            ].join(':');
        }
        return [el.kind, el.slot, el.icon, el.w, el.h].join(':');
    }).join('|');
}

export default app;
