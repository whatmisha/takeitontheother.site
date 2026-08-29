import ICONS from '../icons/lcakb23.js';

const TKL_TOP = ['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
const NUMBER_14 = ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'backspace'];
const QWERTY_14 = ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'];
const ASDF_13 = ['caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '\'', 'enter'];
const ZXCV_12 = ['shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'shift'];
const MODS_TKL = ['ctrl', 'win', 'alt', 'space', 'alt', 'fn', 'menu', 'ctrl'];
const NAV_TOP = ['print', 'scroll', 'pause'];
const NAV_NUM = ['insert', 'home', 'pg up'];
const NAV_Q = ['delete', 'end', 'pg dn'];
const NAV_ARROWS = ['left', 'down', 'right'];
const SEMANTIC_LABELS = {
    grave: '~',
    minus: '-',
    equal: '=',
    'left-bracket': '[',
    'right-bracket': ']',
    backslash: '\\',
    semicolon: ';',
    quote: '\'',
    comma: ',',
    period: '.',
    slash: '/',
    lctrl: 'ctrl',
    rctrl: 'ctrl',
    lmeta: 'win',
    rmeta: 'win',
    lalt: 'alt',
    ralt: 'alt',
    'cmd-left': 'alt/cmd',
    'cmd-right': 'alt/cmd',
    'option-left': 'option',
    'option-right': 'option',
    'opt-left': 'opt',
    'opt-right': 'opt',
    'fn-left': 'fn',
    'fn-right': 'fn',
    lshift: 'shift',
    rshift: 'shift',
    'arrow-stack': 'up/down',
    menu: 'menu',
    'pg-up': 'pg up',
    'pg-down': 'pg dn',
    left: 'left',
    right: 'right',
    up: 'up',
    down: 'down'
};

const BLANK_IDS = new Set(['space', 'blank', 'empty']);

const ARROW_ICON_BY_ID = {
    up: 'arrow-up',
    down: 'arrow-down',
    left: 'arrow-left',
    right: 'arrow-right'
};

const SERVICE_WORD_BY_ID = {
    esc: 'esc',
    tab: 'tab',
    caps: 'caps lock',
    'caps lock': 'caps lock',
    backspace: 'backspace',
    enter: 'enter',
    shift: 'shift',
    lshift: 'shift',
    rshift: 'shift',
    ctrl: 'ctrl',
    lctrl: 'ctrl',
    rctrl: 'ctrl',
    win: 'win',
    lmeta: 'win',
    rmeta: 'win',
    alt: 'alt',
    lalt: 'alt',
    ralt: 'alt',
    'cmd-left': 'alt/cmd',
    'cmd-right': 'alt/cmd',
    'option-left': 'option',
    'option-right': 'option',
    'opt-left': 'opt',
    'opt-right': 'opt',
    fn: 'fn',
    'fn-left': 'fn',
    'fn-right': 'fn',
    menu: 'menu',
    print: 'print',
    'prt-sc': 'prt sc',
    scroll: 'scroll',
    'scr-lock': 'scr lock',
    pause: 'pause',
    insert: 'insert',
    home: 'home',
    delete: 'delete',
    end: 'end',
    'pg up': 'pg up',
    'pg-up': 'pg up',
    'pg dn': 'pg dn',
    'pg-down': 'pg dn'
};

const LEFT_OUTER_WORD_IDS = new Set(['esc', 'tab', 'caps', 'lshift', 'lctrl']);
const RIGHT_OUTER_WORD_IDS = new Set(['backspace', 'enter', 'rshift', 'rctrl']);

const CYRILLIC_BY_LATIN_ID = {
    q: 'Й',
    w: 'Ц',
    e: 'У',
    r: 'К',
    t: 'Е',
    y: 'Н',
    u: 'Г',
    i: 'Ш',
    o: 'Щ',
    p: 'З',
    a: 'Ф',
    s: 'Ы',
    d: 'В',
    f: 'А',
    g: 'П',
    h: 'Р',
    j: 'О',
    k: 'Л',
    l: 'Д',
    z: 'Я',
    x: 'Ч',
    c: 'С',
    v: 'М',
    b: 'И',
    n: 'Т',
    m: 'Ь'
};

const CORNER_TEXT_BY_ID = {
    grave: [['TL', '~'], ['BL', '`'], ['BR', 'Ё']],
    '1': [['TL', '!'], ['BL', '1']],
    '2': [['TL', '@'], ['TR', '"'], ['BL', '2']],
    '3': [['TL', '#'], ['TR', '№'], ['BL', '3']],
    '4': [['TL', '$'], ['TR', ';'], ['BL', '4']],
    '5': [['TL', '%'], ['BL', '5']],
    '6': [['TL', '^'], ['TR', ':'], ['BL', '6']],
    '7': [['TL', '&'], ['TR', '?'], ['BL', '7']],
    '8': [['TL', '*'], ['BL', '8']],
    '9': [['TL', '('], ['BL', '9']],
    '0': [['TL', ')'], ['BL', '0']],
    minus: [['TL', '_'], ['BL', '-']],
    equal: [['TL', '+'], ['BL', '=']],
    'left-bracket': [['TL', '{'], ['BL', '['], ['BR', 'Х']],
    'right-bracket': [['TL', '}'], ['BL', ']'], ['BR', 'Ъ']],
    semicolon: [['TL', ':'], ['BL', ';'], ['BR', 'Ж']],
    quote: [['TL', '"'], ['BL', '\''], ['BR', 'Э']],
    comma: [['TL', '<'], ['BL', ','], ['BR', 'Б']],
    period: [['TL', '>'], ['BL', '.'], ['BR', 'Ю']],
    slash: [['TL', '?'], ['FR', ','], ['BL', '/'], ['BR', '.']],
    backslash: [['TL', '|'], ['TR', '/'], ['BL', '\\']]
};

const CUSTOM_TEXT_BY_ID = {
    '8-layer-1': { tpl: 'legend-corners', items: [['TL', '*'], ['BL', '8'], ['BR', '1']] },
    '9-layer-2': { tpl: 'legend-corners', items: [['TL', '('], ['BL', '9'], ['BR', '2']] },
    'minus-em': { tpl: 'legend-2corners', items: [['TL', '—'], ['BL', '-']] },
    'equal-flipped': { tpl: 'legend-2corners', items: [['TL', '='], ['BL', '+']] },
    'quote-acute': { tpl: 'legend-corners', items: [['TL', '˝'], ['BL', '´'], ['BR', 'Э']] },
    'quote-short': { tpl: 'legend-corners', items: [['TL', '˝'], ['BR', 'Э']] },
    'quote-curly': { tpl: 'legend-corners', items: [['TL', '“'], ['BL', '‘'], ['BR', 'Э']] },
    'semicolon-no-bottom': { tpl: 'legend-corners', items: [['TL', ':'], ['BR', 'Ж']] },
    'slash-acute': { tpl: 'legend-corners', items: [['TC', '´'], ['TL', '?'], ['FR', ','], ['BL', '/'], ['BR', '.']] },
    'slash-dot-comma': { tpl: 'legend-corners', items: [['TL', '?'], ['TR', ','], ['BL', '/'], ['BR', '.']] },
    'mode-2-4g': { tpl: 'legend-corners', items: [['TL', '2', 'numpad'], ['BC', '.', 'numpad'], ['BR', '4G', 'word']] },
    'mode-1': { tpl: 'numpad-single', items: [['BC', '1', 'numpad']] },
    'mode-2': { tpl: 'numpad-single', items: [['BC', '2', 'numpad']] },
    'num-lock-clear': { tpl: 'word-stack', items: [['UC', 'nm lock', 'word'], ['BC', 'clear', 'word']] },
    'num-lock': { tpl: 'word-stack', items: [['UC', 'num', 'word'], ['BC', 'lock', 'word']] },
    'num-plus': { tpl: 'numpad-single', items: [['MC', '+', 'glyph']] },
    'num-minus': { tpl: 'numpad-single', items: [['MC', '–', 'glyph']] },
    'num-slash': { tpl: 'numpad-single', items: [['MC', '/', 'glyph']] },
    'num-star': { tpl: 'numpad-single', items: [['MC', '*', 'glyph']] },
    'num-enter': { tpl: 'word-center', items: [['BC', 'enter', 'word']] },
    'num8': { tpl: 'numpad-single', items: [['BC', '8', 'numpad']] },
    'num2': { tpl: 'numpad-single', items: [['BC', '2', 'numpad']] },
    'num4': { tpl: 'numpad-single', items: [['BC', '4', 'numpad']] },
    'num5': { tpl: 'numpad-single', items: [['BC', '5', 'numpad']] },
    'num6': { tpl: 'numpad-single', items: [['BC', '6', 'numpad']] },
    'num7-home': { tpl: 'numpad-dual', items: [['TL', 'home', 'word'], ['BL', '7', 'numpad']] },
    'num9-pg-up': { tpl: 'numpad-dual', items: [['TL', 'pg up', 'word'], ['BL', '9', 'numpad']] },
    'num1-end': { tpl: 'numpad-dual', items: [['TL', 'end', 'word'], ['BL', '1', 'numpad']] },
    'num3-pg-down': { tpl: 'numpad-dual', items: [['TL', 'pg dn', 'word'], ['BL', '3', 'numpad']] },
    'num0-insert': { tpl: 'numpad-dual', items: [['TL', 'insert', 'word'], ['BL', '0', 'numpad']] },
    'num-decimal-delete': { tpl: 'numpad-dual', items: [['TL', 'delete', 'word'], ['BL', '.', 'numpad']] },
    'scroll-lock': { tpl: 'word-stack', items: [['UC', 'scroll', 'word'], ['BC', 'lock', 'word']] }
};

const PLATFORM_ALPHA_BY_ID = {
    'u-win': { base: 'u', platform: 'WIN' },
    'i-mac': { base: 'i', platform: 'MAC' },
    'o-ios': { base: 'o', platform: 'IOS' },
    'p-and': { base: 'p', platform: 'AND' }
};

const PUNCTUATION_DUAL_IDS = new Set([
    'grave',
    'left-bracket',
    'right-bracket',
    'semicolon',
    'quote',
    'comma',
    'period',
    'slash'
]);

const FKEY_LABEL_TRACKING = 0.0199705;
const FKEY_ICON_BY_ID = {
    f1: { icon: 'volume-mute', label: 'F1' },
    f2: { icon: 'volume-down', label: 'F2' },
    f3: { icon: 'volume-up', label: 'F3' },
    f4: { icon: 'brightness-down', label: 'F4' },
    f5: { icon: 'brightness-up', label: 'F5' },
    f6: { icon: 'backlight', label: 'F6' },
    f7: { icon: 'lock', label: 'F7' },
    f8: { icon: 'calculator', label: 'F8' },
    f9: { icon: 'cut', label: 'F9' },
    f10: { tpl: 'icon+word-stack', icon: 'search', slot: 'Fr', offset: { x: 12.7739 }, label: 'F10' },
    f11: { icon: 'window-split', label: 'F11' },
    f12: { icon: 'display', label: 'F12' },
    f13: { tpl: 'icon-center', icon: 'emoji', slot: 'MC' }
};

const LABELS = {
    ANSI_TKL: [
        { main: TKL_TOP, nav: NAV_TOP },
        { main: NUMBER_14, nav: NAV_NUM },
        { main: QWERTY_14, nav: NAV_Q },
        { main: ASDF_13 },
        { main: ZXCV_12, nav: ['up'] },
        { main: MODS_TKL, nav: NAV_ARROWS }
    ],

    ISO_TKL: [
        { main: TKL_TOP, nav: NAV_TOP },
        { main: NUMBER_14, nav: NAV_NUM },
        { main: ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', 'ISO'], nav: NAV_Q },
        { main: ASDF_13 },
        { main: ['shift', 'ISO', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'shift'], nav: ['up'] },
        { main: MODS_TKL, nav: NAV_ARROWS }
    ],

    ANSI_65: [
        { main: NUMBER_14, nav: ['home'] },
        { main: ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', '\\'], nav: ['pg up'] },
        { main: ['caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', 'enter'], nav: ['pg dn'] },
        { main: ['shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', 'shift'], nav: ['up'] },
        { main: ['ctrl', 'win', 'alt', 'space', 'alt', 'fn', 'menu', 'ctrl'], nav: ['right'] }
    ],

    ANSI_60: [
        { main: NUMBER_14 },
        { main: ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', '\\'] },
        { main: ['caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', 'enter'] },
        { main: ['shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', 'shift'] },
        { main: ['ctrl', 'win', 'alt', 'space', 'alt', 'fn', 'menu', 'ctrl'] }
    ]
};

function labelElement(label, typeDefaults = {}) {
    const text = String(label || '');
    const isSingleLetter = /^[A-Z]$/.test(text);
    const isLong = text.length > 4;
    return {
        slot: 'BC',
        kind: 'txt',
        text,
        size: isSingleLetter
            ? glyphSize(typeDefaults)
            : isLong ? typeDefaults.wordSize : typeDefaults.secondarySize
    };
}

function serviceWordSize(typeDefaults = {}) {
    return typeDefaults.wordSize ?? typeDefaults.secondarySize ?? glyphSize(typeDefaults);
}

function blankContentForId(id) {
    return BLANK_IDS.has(String(id || '').trim().toLowerCase())
        ? { tpl: 'blank', elements: [] }
        : null;
}

function arrowIconContentForId(id) {
    const iconName = ARROW_ICON_BY_ID[String(id || '').trim().toLowerCase()];
    const icon = iconName ? ICONS[iconName] : null;
    if (!icon) return null;
    return {
        tpl: 'icon-center',
        elements: [{
            slot: 'MC',
            kind: 'ico',
            icon: iconName,
            group: 'icons',
            w: icon.w,
            h: icon.h
        }]
    };
}

function arrowStackContentForId(id) {
    if (String(id || '').trim().toLowerCase() !== 'arrow-stack') return null;
    const up = ICONS['arrow-up'];
    const down = ICONS['arrow-down'];
    if (!up || !down) return null;
    return {
        tpl: 'arrow-stack',
        elements: [
            { slot: 'TC', kind: 'ico', icon: 'arrow-up', group: 'icons', w: up.w, h: up.h },
            { slot: 'BC', kind: 'ico', icon: 'arrow-down', group: 'icons', w: down.w, h: down.h }
        ]
    };
}

function serviceWordContentForId(id, typeDefaults = {}) {
    const key = String(id || '').trim().toLowerCase();
    const text = SERVICE_WORD_BY_ID[key];
    if (!text) return null;
    const slot = LEFT_OUTER_WORD_IDS.has(key)
        ? 'BL'
        : RIGHT_OUTER_WORD_IDS.has(key)
            ? 'BR'
            : 'BC';
    return {
        tpl: slot === 'BC' ? 'word-center' : 'word-outer',
        elements: [{
            slot,
            kind: 'txt',
            text,
            size: serviceWordSize(typeDefaults)
        }]
    };
}

function glyphSize(typeDefaults = {}) {
    return typeDefaults.glyphSize ?? typeDefaults.secondarySize ?? typeDefaults.wordSize ?? 12;
}

function typedSize(kind, typeDefaults = {}) {
    if (kind === 'word') return serviceWordSize(typeDefaults);
    if (kind === 'secondary') return typeDefaults.secondarySize ?? glyphSize(typeDefaults);
    if (kind === 'numpad') return typeDefaults.numpadSize ?? glyphSize(typeDefaults);
    return glyphSize(typeDefaults);
}

function customTextContentForId(id, typeDefaults = {}) {
    const spec = CUSTOM_TEXT_BY_ID[String(id || '').trim().toLowerCase()];
    if (!spec) return null;
    return {
        tpl: spec.tpl || 'legend-corners',
        elements: spec.items.map(([slot, text, kind]) => ({
            slot,
            kind: 'txt',
            text,
            size: typedSize(kind, typeDefaults)
        }))
    };
}

function platformAlphaContentForId(id, typeDefaults = {}) {
    const spec = PLATFORM_ALPHA_BY_ID[String(id || '').trim().toLowerCase()];
    const cyrillic = spec ? CYRILLIC_BY_LATIN_ID[spec.base] : null;
    if (!spec || !cyrillic) return null;
    const size = glyphSize(typeDefaults);
    return {
        tpl: 'alpha-platform',
        elements: [
            { slot: 'TC', kind: 'txt', text: spec.platform, size: serviceWordSize(typeDefaults) },
            { slot: 'TL', kind: 'txt', text: spec.base.toUpperCase(), size },
            { slot: 'BR', kind: 'txt', text: cyrillic, size }
        ]
    };
}

function alphaDualContentForId(id, typeDefaults = {}) {
    const key = String(id || '').trim().toLowerCase();
    const cyrillic = CYRILLIC_BY_LATIN_ID[key];
    if (!cyrillic) return null;
    const size = glyphSize(typeDefaults);
    return {
        tpl: 'alpha-dual',
        elements: [
            { slot: 'TL', kind: 'txt', text: key.toUpperCase(), size },
            { slot: 'BR', kind: 'txt', text: cyrillic, size }
        ]
    };
}

function cornerContentForId(id, typeDefaults = {}) {
    const elements = CORNER_TEXT_BY_ID[String(id || '').trim().toLowerCase()];
    if (!elements) return null;
    const size = glyphSize(typeDefaults);
    return {
        tpl: elements.length > 2 ? 'legend-corners' : 'legend-2corners',
        elements: elements.map(([slot, text]) => ({ slot, kind: 'txt', text, size }))
    };
}

function fKeyIconContentForId(id, typeDefaults = {}) {
    const spec = FKEY_ICON_BY_ID[String(id || '').trim().toLowerCase()];
    const icon = spec ? ICONS[spec.icon] : null;
    if (!spec || !icon) return null;
    const iconElement = {
        slot: spec.slot || 'FC',
        kind: 'ico',
        icon: spec.icon,
        group: 'f-icons',
        w: icon.w,
        h: icon.h
    };
    if (spec.offset) iconElement.offset = { ...spec.offset };
    if (!spec.label) {
        return {
            tpl: spec.tpl || 'icon-center',
            elements: [iconElement]
        };
    }
    return {
        tpl: spec.tpl || 'fkey-icon+label',
        elements: [
            iconElement,
            {
                slot: 'BC',
                kind: 'txt',
                text: spec.label,
                size: typeDefaults.wordSize ?? typeDefaults.secondarySize ?? glyphSize(typeDefaults),
                tracking: FKEY_LABEL_TRACKING
            }
        ]
    };
}

function generatedLabelContent(label, typeDefaults = {}) {
    return {
        tpl: 'generated-label',
        elements: [labelElement(label, typeDefaults)]
    };
}

function genericContentForItem(item, fallbackLabel, typeDefaults = {}) {
    return blankContentForId(item?.id)
        || arrowIconContentForId(item?.id)
        || arrowStackContentForId(item?.id)
        || customTextContentForId(item?.id, typeDefaults)
        || platformAlphaContentForId(item?.id, typeDefaults)
        || serviceWordContentForId(item?.id, typeDefaults)
        || alphaDualContentForId(item?.id, typeDefaults)
        || cornerContentForId(item?.id, typeDefaults)
        || fKeyIconContentForId(item?.id, typeDefaults)
        || generatedLabelContent(userFacingId(item?.id) || fallbackLabel, typeDefaults);
}

function generatedContentForPresetLabel(label, typeDefaults = {}) {
    return blankContentForId(label)
        || arrowIconContentForId(label)
        || arrowStackContentForId(label)
        || serviceWordContentForId(label, typeDefaults)
        || fKeyIconContentForId(semanticIdForPresetLabel(label), typeDefaults)
        || generatedLabelContent(label, typeDefaults);
}

function semanticIdForPresetLabel(label) {
    const value = String(label || '').trim().toLowerCase();
    return /^f\d+$/.test(value) ? value : '';
}

export function generatedContentStatsForLayout(layout) {
    const rows = LABELS[layout?.meta?.name];
    if (rows) {
        const stats = emptyGeneratedContentStats();
        for (const row of rows) {
            for (const labels of Object.values(row || {})) {
                for (const label of labels || []) {
                    stats.keys += 1;
                    if (FKEY_ICON_BY_ID[semanticIdForPresetLabel(label)]) stats.fIconKeys += 1;
                    else stats.generatedLabelKeys += 1;
                }
            }
        }
        return stats;
    }

    const stats = emptyGeneratedContentStats();
    for (const { item } of genericContentSlotsForLayout(layout)) {
        stats.keys += 1;
        const id = String(item?.id || '').trim().toLowerCase();
        if (BLANK_IDS.has(id)) {
            stats.generatedLabelKeys += 1;
        } else if (PLATFORM_ALPHA_BY_ID[id]) {
            stats.alphaDualKeys += 1;
        } else if (CUSTOM_TEXT_BY_ID[id]) {
            stats.cornerTemplateKeys += 1;
        } else if (CYRILLIC_BY_LATIN_ID[id]) {
            stats.alphaDualKeys += 1;
        } else if (CORNER_TEXT_BY_ID[id]) {
            stats.cornerTemplateKeys += 1;
        } else if (FKEY_ICON_BY_ID[id]) {
            stats.fIconKeys += 1;
        } else {
            stats.generatedLabelKeys += 1;
            if (!userFacingId(item?.id)) stats.placeholderKeys += 1;
        }
        if (PUNCTUATION_DUAL_IDS.has(id)) stats.punctuationDualKeys += 1;
    }
    return stats;
}

function emptyGeneratedContentStats() {
    return {
        keys: 0,
        alphaDualKeys: 0,
        punctuationDualKeys: 0,
        cornerTemplateKeys: 0,
        fIconKeys: 0,
        generatedLabelKeys: 0,
        placeholderKeys: 0
    };
}

export function generatedContentForLayout(layout, typeDefaults = {}, baseContent = {}) {
    const rows = LABELS[layout?.meta?.name];
    const keys = rows
        ? rows.flatMap((row, rowIndex) =>
            Object.entries(row).flatMap(([block, labels]) =>
                labels.map((label, ordinal) => ({
                    row: rowIndex,
                    x: ordinal,
                    block,
                    ...generatedContentForPresetLabel(label, typeDefaults)
                }))))
        : genericKeysForLayout(layout, typeDefaults);
    return {
        id: layout?.meta?.name || 'generated',
        font: baseContent.font || null,
        interline: baseContent.interline,
        generated: true,
        keys
    };
}

function genericKeysForLayout(layout, typeDefaults = {}) {
    return genericContentSlotsForLayout(layout).map(({ rowIndex, x, block, editId, item, fallbackLabel }) => ({
        row: rowIndex,
        x,
        block,
        editId,
        ...genericContentForItem(item, fallbackLabel, typeDefaults)
    }));
}

function genericContentSlotsForLayout(layout) {
    return (layout?.rows || []).flatMap((row, rowIndex) =>
        Object.entries(row || {}).flatMap(([block, items]) => {
            if (block.startsWith('__') || !Array.isArray(items)) return [];
            let ordinal = 0;
            return expandedItems(items).flatMap((item) => {
                if (item.skip) return [];
                let entries;
                if (Array.isArray(item.stack) && item.stack.length) {
                    entries = item.stack.map((child, stackIndex) => {
                        return {
                            rowIndex,
                            x: ordinal + stackIndex / 10,
                            block,
                            editId: child.editId,
                            item: child,
                            fallbackLabel: `${block} ${ordinal + 1}.${stackIndex + 1}`
                        };
                    });
                } else {
                    entries = [{
                        rowIndex,
                        x: ordinal,
                        block,
                        editId: item.editId,
                        item,
                        fallbackLabel: `${block} ${ordinal + 1}`
                    }];
                }
                ordinal += 1;
                return entries;
            });
        }));
}

function userFacingId(id) {
    const value = String(id || '').trim();
    if (!value || /^r\d+$/i.test(value)) return '';
    if (SEMANTIC_LABELS[value]) return SEMANTIC_LABELS[value];
    if (/^f\d+$/i.test(value)) return value.toUpperCase();
    if (/^[a-z]$/.test(value)) return value.toUpperCase();
    return value;
}

function expandedItems(items = []) {
    const out = [];
    for (const item of items || []) {
        const n = item.repeat || 1;
        const ids = Array.isArray(item.ids) ? item.ids : null;
        for (let i = 0; i < n; i++) {
            const copy = { ...item };
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
