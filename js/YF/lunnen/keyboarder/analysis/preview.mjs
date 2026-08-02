/**
 * Превью раскладки в SVG вне браузера — тем же кодом, что и инструмент.
 *
 * Нужно для визуальной сверки: рядом с нашей отрисовкой можно положить эталонный
 * reference/keyboards/Work_2_L.svg и смотреть их наложением в любом векторном редакторе.
 *
 * Запуск: node analysis/preview.mjs [файл.svg] [--guides] [--ink] [--overlay]
 *   --guides   охранные поля
 *   --ink      ink-боксы строк
 *   --overlay  эталонные позиции легенд крестиками
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LCAKB23 } from '../app/kb/layouts.js';
import { buildLayout } from '../app/kb/grid.js';
import { attachGuides } from '../app/kb/guides.js';
import { parseFont } from '../app/kb/typography.js';
import { Compensator } from '../app/kb/compensate.js';
import { attachContent, buildLegends, textPath } from '../app/kb/legends.js';
import CONTENT from '../app/kb/content/lcakb23.js';
import ICONS from '../app/kb/icons/lcakb23.js';
import ICON_OPTICS from '../app/kb/icons/lcakb23-optics.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const out = args.find((a) => !a.startsWith('--')) || join(ROOT, 'docs', 'assets', 'preview.svg');

const buf = readFileSync(join(ROOT, 'Fonts', 'YS Text', 'YS Text-Regular.ttf'));
const tf = parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const layout = buildLayout(LCAKB23);
attachGuides(layout.keys, layout.grid.guideInset);
attachContent(layout.keys, CONTENT);
const placed = buildLegends(layout.keys, {
    tf, comp: new Compensator(tf), interline: CONTENT.interline, iconOptics: ICON_OPTICS
});

const f = (v) => Number(v.toFixed(4));
const parts = [];
const push = (s) => parts.push(s);

const { bounds, grid } = layout;
push(`<svg xmlns="http://www.w3.org/2000/svg" width="${f(bounds.w)}" height="${f(bounds.h)}"`
    + ` viewBox="0 0 ${f(bounds.w)} ${f(bounds.h)}">`);
push(`<rect width="${f(bounds.w)}" height="${f(bounds.h)}" fill="#1c1f22"/>`);

push('<g id="caps" fill="#e6e7e8">');
for (const k of layout.keys) {
    push(`<rect x="${f(k.x)}" y="${f(k.y)}" width="${f(k.w)}" height="${f(k.h)}"`
        + ` rx="${f(grid.cornerRadius)}"/>`);
}
push('</g>');

if (flag('guides')) {
    push('<g id="guides" fill="none" stroke="#d44698" stroke-width="0.25">');
    for (const k of layout.keys) {
        push(`<rect x="${f(k.guide.x0)}" y="${f(k.guide.y0)}"`
            + ` width="${f(k.guide.w)}" height="${f(k.guide.h)}"/>`);
    }
    push('</g>');
}

push('<g id="legends" fill="#1c1f22">');
for (const el of placed) {
    if (el.kind === 'txt') {
        push(`<path d="${el.pathD || textPath(tf, el)}"/>`);
    } else {
        const g = ICONS[el.icon];
        if (!g) continue;
        push(`<g transform="translate(${f(el.x - g.ox)} ${f(el.y - g.oy)})">`
            + `<path d="${g.d}"/></g>`);
    }
}
push('</g>');

if (flag('ink')) {
    push('<g id="ink" fill="none" stroke="#57a0d8" stroke-width="0.15">');
    for (const el of placed) {
        const b = el.kind === 'txt' ? el.ink : [el.x, el.y, el.w, el.h];
        if (!b) continue;
        push(`<rect x="${f(b[0])}" y="${f(b[1])}" width="${f(b[2])}" height="${f(b[3])}"/>`);
    }
    push('</g>');
}

if (flag('overlay')) {
    const ref = JSON.parse(readFileSync(join(ROOT, 'reference', 'keyboards', 'Work_2_L.legends.json'), 'utf8'));
    push('<g id="ref" stroke="#e8c15a" stroke-width="0.2">');
    for (const k of ref.keys) {
        for (const e of k.elements) {
            const [x, y] = e.kind === 'txt' ? [e.pen[0], e.pen[1]] : [e.bbox[0], e.bbox[1]];
            push(`<path d="M${f(x - 1)} ${f(y)}H${f(x + 1)}M${f(x)} ${f(y - 1)}V${f(y + 1)}"/>`);
        }
    }
    push('</g>');
}

push('</svg>');
writeFileSync(out, parts.join('\n') + '\n', 'utf8');
const txt = placed.filter((e) => e.kind === 'txt').length;
console.log(`${out}: клавиш ${layout.keys.length}, строк ${txt}, иконок ${placed.length - txt}`);
