/**
 * Сверка размещения легенд с эталоном reference/lcakb23/LCAKB23.legends.json, вне браузера.
 * Запуск: node analysis/verify-legends.mjs [--all]
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LCAKB23 } from '../app/kb/layouts.js';
import { buildLayout } from '../app/kb/grid.js';
import { attachGuides } from '../app/kb/guides.js';
import { parseFont } from '../app/kb/typography.js';
import { Compensator } from '../app/kb/compensate.js';
import { attachContent, buildLegends } from '../app/kb/legends.js';
import { compareLegends, LEGEND_CLASSES } from '../app/kb/verify.js';
import CONTENT from '../app/kb/content/lcakb23.js';
import ICON_OPTICS from '../app/kb/icons/lcakb23-optics.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = JSON.parse(readFileSync(join(ROOT, 'reference', 'lcakb23', 'LCAKB23.legends.json'), 'utf8'));
const buf = readFileSync(join(ROOT, 'Fonts', 'YS Text', 'YS Text-Regular.ttf'));
const tf = parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const layout = buildLayout(LCAKB23);
attachGuides(layout.keys, layout.grid.guideInset);
const link = attachContent(layout.keys, CONTENT);
const placed = buildLegends(layout.keys, {
    tf, comp: new Compensator(tf), interline: CONTENT.interline, iconOptics: ICON_OPTICS
});
assert.equal(placed.filter((e) => e.kind === 'txt' && e.pathD).length, placed.filter((e) => e.kind === 'txt').length);
const r = compareLegends(placed, ref.keys);

console.log(`клавиш ${link.matched}/${link.total} получили содержимое`
    + (link.orphans ? `, без пары в геометрии: ${link.orphans}` : ''));
console.log(`элементов ${r.total}, проверено координат ${r.total * 2}`);
if (r.unmatched.length) console.log(`не нашлись в эталоне: ${r.unmatched.join('; ')}`);

console.log('\nпо правилам:');
console.log('  n    медиана      макс    допуск  правило');
for (const c of r.byClass) {
    console.log(`  ${String(c.n).padStart(3)} ${c.med.toFixed(4).padStart(9)} `
        + `${c.max.toFixed(4).padStart(9)} ${String(c.tol).padStart(9)}  `
        + `${c.pass ? '  ' : '!!'} ${c.label}`
        + (c.excused ? `  (+${c.excused} с причиной)` : ''));
}
const formula = r.byClass.find((c) => c.id === 'h-formula');
if (formula) {
    console.log(`\nоптическая компенсация формулой: RMSE ${formula.rmse.toFixed(4)} px `
        + `при заявленных ${LEGEND_CLASSES['h-formula'].rmse}`);
}

if (r.excused.length) {
    console.log('\nрасхождения с названной причиной:');
    for (const e of r.excused) {
        console.log(`  ${e.label} ${e.axis} = ${e.d.toFixed(4)} px — ${e.why}`);
    }
}
if (r.worst.length) {
    const n = process.argv.includes('--all') ? r.worst.length : 12;
    console.log(`\nвне допуска ${r.worst.length} координат:`);
    console.log('  ряд слот элемент       ось        Δ  правило');
    for (const w of r.worst.slice(0, n)) {
        console.log(`  ${String(w.row).padStart(3)} ${w.slot.padEnd(4)} `
            + `${String(w.label).padEnd(12)} ${w.axis}  ${w.d.toFixed(4).padStart(8)}  ${w.cls}`);
    }
}
console.log('\n' + (r.pass ? 'ПРОЙДЕНО' : 'НЕ ПРОЙДЕНО'));
process.exit(r.pass ? 0 : 1);
