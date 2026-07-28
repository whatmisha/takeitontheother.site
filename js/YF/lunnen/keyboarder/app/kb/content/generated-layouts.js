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
    'fn-left': 'fn',
    'fn-right': 'fn',
    lshift: 'shift',
    rshift: 'shift',
    left: 'left',
    right: 'right',
    up: 'up',
    down: 'down'
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
            ? typeDefaults.glyphSize
            : isLong ? typeDefaults.wordSize : typeDefaults.secondarySize
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
                    tpl: 'generated-label',
                    elements: [labelElement(label, typeDefaults)]
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
    return (layout?.rows || []).flatMap((row, rowIndex) =>
        Object.entries(row || {}).flatMap(([block, items]) => {
            let ordinal = 0;
            return expandedItems(items).flatMap((item) => {
                if (item.skip) return [];
                let entries;
                if (Array.isArray(item.stack) && item.stack.length) {
                    entries = item.stack.map((child, stackIndex) => {
                        const label = userFacingId(child.id) || `${block} ${ordinal + 1}.${stackIndex + 1}`;
                        return {
                            row: rowIndex,
                            x: ordinal + stackIndex / 10,
                            block,
                            editId: child.editId,
                            tpl: 'generated-label',
                            elements: [labelElement(label, typeDefaults)]
                        };
                    });
                } else {
                    const label = userFacingId(item.id) || `${block} ${ordinal + 1}`;
                    entries = [{
                        row: rowIndex,
                        x: ordinal,
                        block,
                        editId: item.editId,
                        tpl: 'generated-label',
                        elements: [labelElement(label, typeDefaults)]
                    }];
                }
                ordinal += 1;
                return entries;
            });
        }));
}

function userFacingId(id) {
    const value = String(id || '').trim();
    if (!value || /^r\d+$/i.test(value) || value === 'arrow-stack') return '';
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
