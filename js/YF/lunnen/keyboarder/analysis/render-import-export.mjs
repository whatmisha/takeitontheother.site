#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { analyzeSvgBlueprint } from '../app/kb/svg-blueprint.js';
import { buildLayout } from '../app/kb/grid.js';
import { attachGuides } from '../app/kb/guides.js';
import { parseFont } from '../app/kb/typography.js';
import { Compensator, YS_TEXT_REGULAR } from '../app/kb/compensate.js';
import { attachContent, buildLegends, textPath } from '../app/kb/legends.js';
import { generatedContentForLayout, generatedContentStatsForLayout } from '../app/kb/content/generated-layouts.js';
import { LAYOUTS, LCAKB23 } from '../app/kb/layouts.js';
import CONTENT from '../app/kb/content/lcakb23.js';
import ICONS from '../app/kb/icons/lcakb23.js';
import ICON_OPTICS from '../app/kb/icons/lcakb23-optics.js';

const TYPE_DEFAULTS = {
    glyphSize: 15.1999,
    numpadSize: 13.1732,
    secondarySize: 12.0745,
    wordSize: 9.1199,
    leading: CONTENT.interline,
    trackingOffset: 0
};

const args = parseArgs(process.argv.slice(2));

if ((!args.input && !args.layout) || !args.output) {
    console.error('Usage: node analysis/render-import-export.mjs --input drawing.svg --output layout.svg');
    console.error('   or: node analysis/render-import-export.mjs --layout LCAKB21 --output layout.svg');
    process.exit(2);
}

const result = args.layout
    ? renderBuiltInLayoutSvg(args.layout, args.output)
    : renderImportedSvg(args.input, args.output);
console.log(`${args.output}: ${result.caps} caps, ${result.glyphPaths} glyph paths, ${result.icons} icons, ${result.fIcons} f-icons, ${result.profile}`);

export function renderImportedSvg(inputFile, outputFile) {
    const svgText = readFileSync(inputFile, 'utf8');
    const analysis = analyzeSvgBlueprint(svgText);
    const draft = analysis.layoutDraft;
    if (!draft?.layout) throw new Error(`No usable keyboard layout draft detected in ${inputFile}`);
    if (analysis.diagnostics?.warnings?.length) {
        throw new Error(`SVG import has warnings: ${analysis.diagnostics.warnings.map((row) => row.message || row.code).join('; ')}`);
    }

    const rendered = renderLayoutSvg(draft.layout);
    mkdirSync(dirname(resolve(outputFile)), { recursive: true });
    writeFileSync(outputFile, rendered.svg, 'utf8');
    return {
        ...rendered.counts,
        profile: draft.stats?.layoutProfile || generatedContentStatsForLayout(draft.layout).profile || 'custom'
    };
}

export function renderBuiltInLayoutSvg(layoutName, outputFile) {
    const layout = LAYOUTS[layoutName];
    if (!layout) throw new Error(`Unknown layout "${layoutName}". Known layouts: ${Object.keys(LAYOUTS).join(', ')}`);
    const rendered = renderLayoutSvg(layout);
    mkdirSync(dirname(resolve(outputFile)), { recursive: true });
    writeFileSync(outputFile, rendered.svg, 'utf8');
    return {
        ...rendered.counts,
        profile: layout.meta?.name || layoutName
    };
}

function renderLayoutSvg(sourceLayout) {
    const font = readFileSync('Fonts/YS Text/YS Text-Regular.ttf');
    const tf = parseFont(font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength));
    const layout = buildLayout(sourceLayout);
    attachGuides(layout.keys, layout.grid.guideInset);
    const content = sourceLayout?.meta?.name === LCAKB23.meta.name
        ? CONTENT
        : generatedContentForLayout(sourceLayout, TYPE_DEFAULTS, CONTENT);
    attachContent(layout.keys, content);
    const legends = buildLegends(layout.keys, {
        tf,
        comp: new Compensator(tf, YS_TEXT_REGULAR),
        interline: TYPE_DEFAULTS.leading,
        iconOptics: ICON_OPTICS
    });

    const parts = [];
    const push = (s) => parts.push(s);
    const { bounds, grid } = layout;

    push(`<svg xmlns="http://www.w3.org/2000/svg" width="${f(bounds.w)}" height="${f(bounds.h)}" viewBox="0 0 ${f(bounds.w)} ${f(bounds.h)}">`);
    push(`<rect width="100%" height="100%" fill="#808080"/>`);
    push('<g id="caps">');
    for (const key of layout.keys) {
        push(`<rect x="${f(key.x)}" y="${f(key.y)}" width="${f(key.w)}" height="${f(key.h)}" rx="${f(grid.cornerRadius)}" ry="${f(grid.cornerRadius)}" fill="#1e1e1e"/>`);
    }
    push('</g>');

    push('<g id="glyphs" fill="#aaaaaa">');
    let glyphPaths = 0;
    for (const el of legends) {
        if (el.kind !== 'txt') continue;
        const d = el.pathD || textPath(tf, el);
        if (!d) continue;
        glyphPaths += 1;
        push(`<path d="${attr(d)}"/>`);
    }
    push('</g>');

    const iconGroups = { icons: [], 'f-icons': [] };
    for (const el of legends) {
        if (el.kind !== 'ico') continue;
        const icon = ICONS[el.icon];
        if (!icon) continue;
        const layer = el.group === 'f-icons' ? 'f-icons' : 'icons';
        iconGroups[layer].push(`<g transform="translate(${f(el.x - icon.ox)} ${f(el.y - icon.oy)})"><path d="${attr(icon.d)}"/></g>`);
    }
    for (const id of ['icons', 'f-icons']) {
        if (!iconGroups[id].length) continue;
        push(`<g id="${id}" fill="#aaaaaa">`);
        for (const row of iconGroups[id]) push(row);
        push('</g>');
    }

    push('</svg>');
    return {
        svg: `${parts.join('\n')}\n`,
        counts: {
            caps: layout.keys.length,
            glyphPaths,
            icons: iconGroups.icons.length,
            fIcons: iconGroups['f-icons'].length
        }
    };
}

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--input') out.input = argv[++i];
        else if (arg === '--layout') out.layout = argv[++i];
        else if (arg === '--output') out.output = argv[++i];
        else if (!arg.startsWith('--') && !out.input) out.input = arg;
        else if (!arg.startsWith('--') && !out.output) out.output = arg;
    }
    if (out.input) out.input = resolve(out.input);
    if (out.output) out.output = resolve(out.output);
    return out;
}

function f(value) {
    return Number(value).toFixed(4).replace(/\.?0+$/, '');
}

function attr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
