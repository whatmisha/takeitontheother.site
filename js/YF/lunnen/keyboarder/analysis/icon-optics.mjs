/**
 * Оптическая поправка иконок: насколько дизайнер сдвинул пиктограмму относительно
 * геометрического центра. Пишет app/kb/icons/lcakb23-optics.js.
 *
 * PIPELINE § 9.3 утверждал, что иконки компенсации не требуют. Это верно для большинства,
 * но не для тех, у которых зрительная масса несимметрична: у лупы вниз-вправо уходит ручка,
 * у замка вверх — дужка. Такие рисунки подправлены на глаз, и поправка — свойство самого
 * рисунка, а не клавиши: она переносится вместе с иконкой в любую другую раскладку. Ровно
 * та же логика, что у таблицы компенсации знаков препинания (§ 10.4).
 *
 * Запуск: node analysis/icon-optics.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LCAKB23 } from '../app/kb/layouts.js';
import { buildLayout } from '../app/kb/grid.js';
import { attachGuides } from '../app/kb/guides.js';
import { parseFont } from '../app/kb/typography.js';
import { Compensator } from '../app/kb/compensate.js';
import { attachContent, buildLegends } from '../app/kb/legends.js';
import CONTENT from '../app/kb/content/lcakb23.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = JSON.parse(readFileSync(join(ROOT, 'reference', 'lcakb23', 'LCAKB23.legends.json'), 'utf8'));
const buf = readFileSync(join(ROOT, 'Fonts', 'YS Text', 'YS Text-Regular.ttf'));
const tf = parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const refIcons = new Map();
for (const k of ref.keys) {
    for (const e of k.elements) {
        if (e.kind === 'ico') refIcons.set(`${k.row}|${Math.round(k.cap[0] * 10)}|${e.slot}`, e);
    }
}

const layout = buildLayout(LCAKB23);
attachGuides(layout.keys, layout.grid.guideInset);
attachContent(layout.keys, CONTENT);
const placed = buildLegends(layout.keys, {
    tf, comp: new Compensator(tf), interline: CONTENT.interline
});

const acc = new Map();
for (const p of placed) {
    if (p.kind !== 'ico') continue;
    const want = refIcons.get(`${p.key.row}|${Math.round(p.key.x * 10)}|${p.slot}`);
    if (!want) continue;
    if (!acc.has(p.icon)) acc.set(p.icon, []);
    acc.get(p.icon).push({
        dx: p.anchored.h ? want.bb[0] - p.x : 0,
        dy: p.anchored.v ? want.bb[1] - p.y : 0
    });
}

const med = (v) => v.sort((a, b) => a - b)[v.length >> 1];
const out = {};
for (const [id, list] of [...acc].sort()) {
    const dx = med(list.map((r) => r.dx));
    const dy = med(list.map((r) => r.dy));
    if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4) {
        out[id] = { dx: Number(dx.toFixed(4)), dy: Number(dy.toFixed(4)) };
    }
}

const head = `/**
 * Оптические поправки пиктограмм LCAKB23, px. Сгенерировано analysis/icon-optics.mjs.
 *
 * Сдвиг от геометрического размещения к тому, что дизайнер поставил глазом.
 * Свойство рисунка, а не клавиши: переносится вместе с иконкой.
 */
`;
writeFileSync(join(ROOT, 'app', 'kb', 'icons', 'lcakb23-optics.js'),
    head + 'export default ' + JSON.stringify(out, null, 1) + ';\n');

const big = Object.entries(out).filter(([, v]) => Math.abs(v.dx) > 0.1 || Math.abs(v.dy) > 0.1);
console.log(`иконок с поправкой ${Object.keys(out).length} из ${acc.size}, `
    + `из них заметных (>0.1 px): ${big.length}`);
for (const [id, v] of big) console.log(`  ${id.padEnd(16)} dx=${v.dx.toFixed(4)} dy=${v.dy.toFixed(4)}`);
console.log('записано: app/kb/icons/lcakb23-optics.js');
