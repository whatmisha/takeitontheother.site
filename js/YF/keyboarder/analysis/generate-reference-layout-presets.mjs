#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { analyzeSvgBlueprint } from '../app/kb/svg-blueprint.js';

const FILES = [
    {
        file: 'reference/keyboards/Perform_L.svg',
        exportName: 'PERFORM_L',
        name: 'Perform_L',
        formFactor: 'keyboard 104',
        ids: [
            { main: ['esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'], nav: ['print', 'scroll', 'pause'] },
            { main: ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal', 'backspace'], nav: ['insert', 'home', 'pg-up'], numpad: ['num-lock-clear', 'num-slash', 'num-star', 'num-minus'] },
            { main: ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash'], nav: ['delete', 'end', 'pg-down'], numpad: ['num7-home', 'num8', 'num9-pg-up', 'num-plus'] },
            { main: ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote-acute', 'enter'], numpad: ['num4', 'num5', 'num6'] },
            { main: ['lshift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash', 'rshift'], nav: ['up'], numpad: ['num1-end', 'num2', 'num3-pg-down', 'num-enter'] },
            { main: ['lctrl', 'option-left', 'cmd-left', 'space', 'cmd-right', 'fn-right', 'option-right', 'rctrl'], nav: ['left', 'down', 'right'], numpad: ['num0-insert', 'num-decimal-delete'] }
        ]
    },
    {
        file: 'reference/keyboards/Perform_S.svg',
        exportName: 'PERFORM_S',
        name: 'Perform_S',
        formFactor: 'keyboard 84',
        ids: [
            { main: ['esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'blank', 'delete', 'pg-up'] },
            { main: ['grave', '1', '2', '3', '4', '5', '6', '7', '8-layer-1', '9-layer-2', '0', 'minus', 'equal', 'backspace', 'pg-down'] },
            { main: ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash', 'home'] },
            { main: ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote-acute', 'enter', 'end'] },
            { main: ['lshift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash', 'rshift', 'blank', 'scroll-lock'] },
            { main: ['lctrl', 'opt-left', 'cmd-left', 'space'] },
            { main: ['cmd-right', 'fn-right', 'rctrl', 'blank', 'blank', 'blank'] }
        ]
    },
    {
        file: 'reference/keyboards/Work_1_L_Pad.svg',
        exportName: 'WORK_1_L_PAD',
        name: 'Work_1_L_Pad',
        formFactor: 'keyboard 110',
        ids: [
            { main: ['esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'blank'], nav: ['prt-sc', 'scr-lock', 'pause'], numpad: ['mode-2-4g', 'mode-1', 'mode-2', 'blank'] },
            { main: ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal', 'backspace'], nav: ['insert', 'home', 'pg-up'], numpad: ['num-lock-clear', 'num-slash', 'num-star', 'num-minus'] },
            { main: ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u-win', 'i-mac', 'o-ios', 'p-and', 'left-bracket', 'right-bracket', 'backslash'], nav: ['delete', 'end', 'pg-down'], numpad: ['num7-home', 'num8', 'num9-pg-up', 'num-plus'] },
            { main: ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote-acute', 'enter'], numpad: ['num4', 'num5', 'num6'] },
            { main: ['lshift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash', 'rshift'], nav: ['up'], numpad: ['num1-end', 'num2', 'num3-pg-down', 'num-enter'] },
            { main: ['lctrl', 'option-left', 'fn-left', 'cmd-left', 'space', 'cmd-right', 'fn-right', 'option-right', 'rctrl'], nav: ['left', 'down', 'right'], numpad: ['num0-insert', 'num-decimal-delete'] }
        ]
    },
    {
        file: 'reference/laptops/Airis_14.svg',
        exportName: 'AIRIS_14',
        name: 'Airis_14',
        formFactor: 'laptop 14',
        ids: [
            { main: ['esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'blank', 'pause', 'insert', 'delete'] },
            { main: ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus-em', 'equal', 'backspace'] },
            { main: ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash'] },
            { main: ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon-no-bottom', 'quote-short', 'enter'] },
            { main: ['lshift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash-acute', 'rshift'] },
            { main: ['lctrl', 'fn-left', 'blank', 'lalt', 'space', 'ralt', 'blank', 'rctrl', 'left', 'arrow-stack', 'right'] }
        ]
    },
    {
        file: 'reference/laptops/Ground_14.svg',
        exportName: 'GROUND_14',
        name: 'Ground_14',
        formFactor: 'laptop 14',
        ids: [
            { main: ['esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'blank', 'pause', 'insert', 'delete'] },
            { main: ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus-em', 'equal', 'backspace', 'home'] },
            { main: ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash', 'end'] },
            { main: ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon-no-bottom', 'quote-short', 'enter', 'pg-up'] },
            { main: ['lshift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash-acute', 'rshift', 'pg-down'] },
            { main: ['lctrl', 'fn-left', 'blank', 'lalt', 'space', 'ralt', 'blank', 'rctrl', 'left', 'arrow-stack', 'right'] }
        ]
    },
    {
        file: 'reference/laptops/Ground_15.svg',
        exportName: 'GROUND_15',
        name: 'Ground_15',
        formFactor: 'laptop 15',
        ids: [
            { main: ['esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'blank', 'insert', 'delete', 'num-slash', 'num-star', 'blank'] },
            { main: ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus-em', 'equal-flipped', 'backspace', 'blank', 'num-plus', 'num-lock'] },
            { main: ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash', 'num7-home', 'num8', 'num9-pg-up'] },
            { main: ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote-curly', 'enter', 'num4', 'num5', 'num6'] },
            { main: ['lshift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash-dot-comma', 'rshift', 'num1-end', 'num2', 'num3-pg-down'] },
            { main: ['lctrl', 'fn-left', 'blank', 'lalt', 'space', 'ralt', 'rctrl', 'left', 'arrow-stack', 'right', 'num0-insert', 'num-decimal-delete', 'num-enter'] }
        ]
    }
];

for (const spec of FILES) {
    spec.analysis = analyzeSvgBlueprint(readFileSync(spec.file, 'utf8'));
    spec.layout = spec.analysis.layoutDraft.layout;
}

const layouts = FILES.map((spec) => {
    const layout = clone(spec.layout);
    layout.meta = {
        name: spec.name,
        formFactor: spec.formFactor,
        source: 'svg-caps',
        reference: spec.file
    };
    layout.artboard = {
        w: spec.analysis.viewBox.w,
        h: spec.analysis.viewBox.h
    };
    applyIds(layout, spec.ids, spec.name);
    return { ...spec, layout };
});

const out = [];
out.push('// Generated by analysis/generate-reference-layout-presets.mjs from reference SVG caps.');
out.push('');
for (const { exportName, layout } of layouts) {
    out.push(`export const ${exportName} = ${format(layout)};`);
    out.push('');
}
const output = `${out.join('\n')}\n`;
const writeArgIndex = process.argv.indexOf('--write');
const outputFile = writeArgIndex >= 0 ? process.argv[writeArgIndex + 1] : '';
if (outputFile) {
    const target = resolve(outputFile);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, output, 'utf8');
} else {
    process.stdout.write(output);
}

function applyIds(layout, rows, name) {
    layout.rows.forEach((row, rowIndex) => {
        const specRow = rows[rowIndex] || {};
        for (const [blockId, items] of Object.entries(row)) {
            if (blockId.startsWith('__') || !Array.isArray(items)) continue;
            const ids = specRow[blockId] || [];
            if (ids.length !== items.length) {
                throw new Error(`${name} row ${rowIndex} block ${blockId}: expected ${items.length} ids, got ${ids.length}`);
            }
            items.forEach((item, index) => {
                const id = ids[index];
                if (id) item.id = id;
                if (item.stack?.length && id === 'arrow-stack') {
                    item.stack.forEach((child, childIndex) => {
                        child.id = childIndex === 0 ? 'up' : 'down';
                    });
                }
            });
        }
    });
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function format(value) {
    return JSON.stringify(value, null, 4)
        .replace(/"([^"]+)":/g, '$1:')
        .replace(/"/g, '\'');
}
