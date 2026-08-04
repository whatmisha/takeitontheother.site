export const MODEL_SCHEMA = 'keyboarder.model.v1';

export const PRESET_KEYS = [
    'layoutName', 'customLayout',
    'colPitch', 'rowPitch', 'keyWidth1U', 'keyHeight', 'cornerRadius', 'guideInset',
    'glyphSize', 'fontWeight', 'numpadSize', 'secondarySize', 'wordSize', 'leading', 'trackingOffset',
    'textStyles',
    'compensationMode', 'legendTextMode', 'compensationTableEdits',
    'showCaps', 'showGuides', 'showGlyphs', 'showIcons', 'showDrawing', 'showColumns', 'showIndex',
    'showInk', 'showSlots', 'showRef', 'showDiff', 'showBlocks', 'languageLayer',
    'capColor', 'guideColor', 'inkColor', 'bgColor',
    'customIcons', 'contentEdits', 'layoutEdits'
];

export const GRID_SETTING_KEYS = ['colPitch', 'rowPitch', 'keyWidth1U', 'keyHeight', 'cornerRadius', 'guideInset'];
export const TYPE_SETTING_KEYS = [
    'glyphSize', 'fontWeight', 'numpadSize', 'secondarySize', 'wordSize', 'leading', 'trackingOffset',
    'textStyles',
    'compensationMode', 'legendTextMode', 'compensationTableEdits'
];
export const LAYER_SETTING_KEYS = [
    'showCaps', 'showGuides', 'showGlyphs', 'showIcons', 'showDrawing', 'showColumns', 'showIndex',
    'showInk', 'showSlots', 'showRef', 'showDiff', 'showBlocks', 'languageLayer'
];
export const COLOR_SETTING_KEYS = ['capColor', 'guideColor', 'inkColor', 'bgColor'];

const DEFAULT_MIN_KEY_WIDTH_MM = 4;
const DEFAULT_MAX_KEY_WIDTH_MM = 80;
const CUSTOM_ICON_PREFIX = 'custom:';
const ICON_PATH_DATA_RE = /^[MmZzLlHhVvCcSsQqTtAaEe0-9+\-.,\s]+$/;

function ioOptions(options = {}) {
    const sourceRowCount = Number.isInteger(options.sourceRowCount)
        ? options.sourceRowCount
        : Number.POSITIVE_INFINITY;
    const minKeyWidthMm = Number.isFinite(options.minKeyWidthMm)
        ? options.minKeyWidthMm
        : DEFAULT_MIN_KEY_WIDTH_MM;
    const maxKeyWidthMm = Number.isFinite(options.maxKeyWidthMm)
        ? options.maxKeyWidthMm
        : DEFAULT_MAX_KEY_WIDTH_MM;
    return {
        layoutMeta: options.layoutMeta || {},
        sourceRowCount,
        minKeyWidthMm,
        maxKeyWidthMm,
        typeDefaults: options.typeDefaults || {},
        iconOptions: Array.isArray(options.iconOptions) ? options.iconOptions : []
    };
}

export function clonePlain(v) {
    if (v === undefined) return undefined;
    return JSON.parse(JSON.stringify(v));
}

export function roundMm(value) {
    return Math.round(value * 1000) / 1000;
}

export function clamp(value, min, max) {
    if (!Number.isFinite(value)) return NaN;
    return Math.min(max, Math.max(min, value));
}

export function finiteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export function cleanOffset(offset) {
    if (!offset || typeof offset !== 'object') return null;
    const out = {};
    for (const key of ['x', 'y', 'bx', 'by']) {
        const value = Number(offset[key]);
        if (Number.isFinite(value) && value !== 0) out[key] = value;
    }
    return Object.keys(out).length ? out : null;
}

export function cleanCompOverride(compOverride) {
    if (!compOverride || typeof compOverride !== 'object') return null;
    const px = Number(compOverride.px);
    return Number.isFinite(px) ? { px } : null;
}

export function cleanHexColor(value) {
    const raw = String(value || '').trim().toLowerCase();
    const short = raw.match(/^#?([a-f0-9]{3})$/i);
    if (short) return '#' + short[1].split('').map((ch) => ch + ch).join('');
    const full = raw.match(/^#?([a-f0-9]{6})$/i);
    return full ? `#${full[1]}` : '';
}

function roundCompensationEm(value) {
    return Math.round(value * 100) / 100;
}

export function sanitizeCompensationTableEdits(edits = {}) {
    const out = {};
    if (!edits || typeof edits !== 'object' || Array.isArray(edits)) return out;
    for (const [rawCh, rawRow] of Object.entries(edits)) {
        if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) continue;
        const ch = [...String(rawCh || '')][0];
        if (!ch) continue;
        const row = {};
        for (const side of ['L', 'R']) {
            if (!Object.prototype.hasOwnProperty.call(rawRow, side)) continue;
            if (rawRow[side] === null) {
                row[side] = null;
                continue;
            }
            const value = Number(rawRow[side]);
            if (Number.isFinite(value)) row[side] = roundCompensationEm(value);
        }
        if (Object.keys(row).length) out[ch] = row;
    }
    return out;
}

export function cleanIconGroup(group) {
    return String(group || '').trim() === 'f-icons' ? 'f-icons' : 'icons';
}

export function cleanCustomIconId(value) {
    const raw = String(value || '').trim();
    const name = raw.startsWith(CUSTOM_ICON_PREFIX) ? raw.slice(CUSTOM_ICON_PREFIX.length) : raw;
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72);
    return slug ? `${CUSTOM_ICON_PREFIX}${slug}` : '';
}

function cleanCustomIconName(value, fallback = '') {
    return String(value || fallback || 'Custom icon')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80) || 'Custom icon';
}

export function cleanCustomIconDefinition(icon = {}, fallbackName = '') {
    if (!icon || typeof icon !== 'object' || Array.isArray(icon)) return null;
    const d = String(icon.d || '').trim();
    if (!d || d.length > 60000 || !ICON_PATH_DATA_RE.test(d)) return null;
    const w = clamp(finiteOr(icon.w, 8), 0.1, 80);
    const h = clamp(finiteOr(icon.h, 8), 0.1, 80);
    const ox = clamp(finiteOr(icon.ox, 0), -10000, 10000);
    const oy = clamp(finiteOr(icon.oy, 0), -10000, 10000);
    return {
        name: cleanCustomIconName(icon.name, fallbackName),
        w: roundMm(w),
        h: roundMm(h),
        ox: roundMm(ox),
        oy: roundMm(oy),
        d
    };
}

export function sanitizeCustomIcons(icons = {}) {
    const out = {};
    if (!icons || typeof icons !== 'object' || Array.isArray(icons)) return out;
    for (const [rawId, icon] of Object.entries(icons)) {
        const id = cleanCustomIconId(rawId);
        const clean = cleanCustomIconDefinition(icon, rawId);
        if (id && clean) out[id] = clean;
    }
    return out;
}

function cleanFontId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.replace(/[^\w:.-]+/g, '-').slice(0, 96);
}

export function cleanElement(el = {}, options = {}) {
    const opts = ioOptions(options);
    const slot = String(el.slot || 'BC').trim() || 'BC';
    const kind = el.kind === 'ico' ? 'ico' : 'txt';
    const out = { slot, kind };
    if (kind === 'ico') {
        out.icon = String(el.icon || opts.iconOptions[0] || '').trim();
        out.group = cleanIconGroup(el.group);
        out.w = finiteOr(el.w, 8);
        out.h = finiteOr(el.h, 8);
    } else {
        out.text = String(el.text ?? '');
        const styleId = String(el.styleId || '').trim().replace(/[^\w.-]+/g, '').slice(0, 48);
        if (styleId) out.styleId = styleId;
        out.size = finiteOr(el.size, opts.typeDefaults.wordSize ?? 9);
        const tracking = finiteOr(el.tracking, 0);
        if (tracking !== 0) out.tracking = tracking;
        const fontId = cleanFontId(el.fontId);
        if (fontId) out.fontId = fontId;
        const compOverride = cleanCompOverride(el.compOverride);
        if (compOverride) out.compOverride = compOverride;
    }
    const offset = cleanOffset(el.offset);
    if (offset) out.offset = offset;
    return out;
}

export function cleanElements(elements = [], options = {}) {
    return (Array.isArray(elements) ? elements : []).map((el) => cleanElement(el, options));
}

export function sanitizeContentEdits(edits = {}, options = {}) {
    const out = {};
    if (!edits || typeof edits !== 'object') return out;
    for (const [id, edit] of Object.entries(edits)) {
        if (!edit || typeof edit !== 'object') continue;
        const clean = {
            tpl: String(edit.tpl || 'blank'),
            elements: cleanElements(edit.elements, options)
        };
        const keyColor = cleanHexColor(edit.keyColor);
        if (keyColor) clean.keyColor = keyColor;
        out[id] = clean;
    }
    return out;
}

export function sanitizeLayoutEdits(edits = {}, options = {}) {
    const opts = ioOptions(options);
    const out = {};
    if (!edits || typeof edits !== 'object') return out;
    for (const [id, edit] of Object.entries(edits)) {
        if (!edit || typeof edit !== 'object') continue;
        const clean = {};
        const order = Array.isArray(edit.order)
            ? [...new Set(edit.order.map((v) => String(v || '').trim()).filter(Boolean))]
            : [];
        if (order.length) clean.order = order;
        if (edit.rowAdded === true) {
            const afterRow = Number(edit.afterRow);
            const templateRow = Number(edit.templateRow);
            if (!Number.isInteger(afterRow) || afterRow < 0 || afterRow >= opts.sourceRowCount) continue;
            if (!Number.isInteger(templateRow) || templateRow < 0 || templateRow >= opts.sourceRowCount) continue;
            clean.rowAdded = true;
            clean.afterRow = afterRow;
            clean.templateRow = templateRow;
        }
        if (edit.added === true) {
            const after = String(edit.after || '').trim();
            const before = String(edit.before || '').trim();
            if (!after && !before) continue;
            clean.added = true;
            if (before) clean.before = before;
            else clean.after = after;
        }
        if (edit.deleted === true) clean.deleted = true;
        const widthMm = clamp(Number(edit.widthMm), opts.minKeyWidthMm, opts.maxKeyWidthMm);
        if (Number.isFinite(widthMm)) clean.widthMm = roundMm(widthMm);
        if (Object.keys(clean).length) out[id] = clean;
    }
    return out;
}

export function normalizedPresetBlob(blob = {}, defaults = {}, options = {}) {
    const source = blob || {};
    const clean = clonePlain(defaults);
    for (const key of PRESET_KEYS) {
        if (source[key] !== undefined) clean[key] = clonePlain(source[key]);
    }
    clean.contentEdits = sanitizeContentEdits(clean.contentEdits || {}, options);
    clean.layoutEdits = sanitizeLayoutEdits(clean.layoutEdits || {}, options);
    clean.compensationTableEdits = sanitizeCompensationTableEdits(clean.compensationTableEdits || {});
    clean.customIcons = sanitizeCustomIcons(clean.customIcons || {});
    return clean;
}

export function pickSettings(source, keys) {
    const out = {};
    for (const key of keys) {
        if (source[key] !== undefined) out[key] = clonePlain(source[key]);
    }
    return out;
}

export function buildKeyboardModel(blob = {}, defaults = {}, options = {}) {
    const opts = ioOptions(options);
    const settings = normalizedPresetBlob(blob, defaults, opts);
    return {
        schema: MODEL_SCHEMA,
        app: 'Keyboarder',
        exportedAt: new Date().toISOString(),
        baseLayout: opts.layoutMeta.name || '',
        units: {
            grid: 'mm',
            type: 'pt',
            fontWeight: 'wght',
            trackingOffset: 'em',
            compensationTable: 'em/1000',
            compensationOverride: 'px'
        },
        settings,
        keyboard: {
            meta: clonePlain(opts.layoutMeta),
            grid: pickSettings(settings, GRID_SETTING_KEYS),
            type: pickSettings(settings, TYPE_SETTING_KEYS),
            appearance: pickSettings(settings, [...LAYER_SETTING_KEYS, ...COLOR_SETTING_KEYS]),
            assets: {
                icons: settings.customIcons
            },
            edits: {
                layout: settings.layoutEdits,
                content: settings.contentEdits
            }
        }
    };
}

export function presetBlobFromKeyboardModel(input = {}, defaults = {}, options = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('JSON root must be an object.');
    }
    const schema = String(input.schema || input.format || '').trim();
    if (schema && schema !== MODEL_SCHEMA) {
        throw new Error(`Unsupported model schema: ${schema}`);
    }
    if (!schema) return normalizedPresetBlob(input, defaults, options);

    if (input.settings && typeof input.settings === 'object' && !Array.isArray(input.settings)) {
        return normalizedPresetBlob(input.settings, defaults, options);
    }

    const keyboard = input.keyboard || {};
    const edits = keyboard.edits || {};
    return normalizedPresetBlob({
        layoutName: input.baseLayout || keyboard.meta?.name,
        ...(keyboard.grid || {}),
        ...(keyboard.type || {}),
        ...(keyboard.appearance || {}),
        customIcons: keyboard.assets?.icons || keyboard.icons || {},
        layoutEdits: edits.layout || {},
        contentEdits: edits.content || {}
    }, defaults, options);
}

export function parseKeyboardModelJSONText(text = '', defaults = {}, options = {}) {
    let parsed;
    try {
        parsed = JSON.parse(String(text));
    } catch (_) {
        throw new Error('Could not parse JSON.');
    }
    return presetBlobFromKeyboardModel(parsed, defaults, options);
}
