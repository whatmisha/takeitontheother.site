#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLayout, widthInU } from '../app/kb/grid.js';
import { attachContent } from '../app/kb/legends.js';
import { LAYOUTS, LCAKB23 } from '../app/kb/layouts.js';
import CONTENT from '../app/kb/content/lcakb23.js';
import { generatedContentForLayout } from '../app/kb/content/generated-layouts.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TYPE_DEFAULTS = {
    glyphSize: 15.1999,
    numpadSize: 13.1732,
    secondarySize: 12.0745,
    wordSize: 9.1199,
    leading: CONTENT.interline,
    trackingOffset: 0
};

const SPECS = [
    {
        layoutName: 'LCAKB23',
        output: 'reference/keyboards/Work_2_L.layout.json',
        legendsFrom: 'reference/lcakb23/LCAKB23.legends.json',
        legendsOutput: 'reference/keyboards/Work_2_L.legends.json'
    },
    { layoutName: 'Perform_L', output: 'reference/keyboards/Perform_L.layout.json' },
    { layoutName: 'Perform_S', output: 'reference/keyboards/Perform_S.layout.json' },
    { layoutName: 'Work_1_L_Pad', output: 'reference/keyboards/Work_1_L_Pad.layout.json' },
    { layoutName: 'Airis_14', output: 'reference/laptops/Airis_14.layout.json' },
    { layoutName: 'Ground_14', output: 'reference/laptops/Ground_14.layout.json' },
    { layoutName: 'Ground_15', output: 'reference/laptops/Ground_15.layout.json' }
];

const write = process.argv.includes('--write');

for (const spec of SPECS) {
    const layout = LAYOUTS[spec.layoutName];
    if (!layout) throw new Error(`Unknown layout ${spec.layoutName}`);
    const rows = layoutReferenceRows(layout);
    if (write) {
        writeJSON(join(ROOT, spec.output), rows);
        if (spec.legendsFrom && spec.legendsOutput) {
            writeFileSync(
                join(ROOT, spec.legendsOutput),
                readFileSync(join(ROOT, spec.legendsFrom), 'utf8')
            );
        }
    }
    console.log(`${spec.output}: ${rows.length} keys`);
}

function layoutReferenceRows(layout) {
    const { keys, grid } = buildLayout(layout);
    attachContent(keys, contentForLayout(layout));
    return keys.map((key) => ({
        row: key.row,
        x: rounded(key.x),
        y: rounded(key.y),
        w: rounded(key.w),
        h: rounded(key.h),
        u: rounded(widthInU(key.w, grid)),
        block: key.block,
        legend: key.id || labelFromElements(key.elements) || '',
        icons: (key.elements || []).filter((element) => element.kind === 'ico').length,
        slots: (key.elements || []).map((element) => element.slot).filter(Boolean),
        tpl: key.tpl || null
    }));
}

function contentForLayout(layout) {
    return layout.meta?.name === LCAKB23.meta.name
        ? CONTENT
        : generatedContentForLayout(layout, TYPE_DEFAULTS, CONTENT);
}

function labelFromElements(elements = []) {
    const text = elements.find((element) => element.kind === 'txt' && element.text)?.text;
    if (text) return text;
    const icon = elements.find((element) => element.kind === 'ico' && element.icon)?.icon;
    return icon || '';
}

function writeJSON(file, value) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`, 'utf8');
}

function rounded(value) {
    return Number(value.toFixed(4));
}
