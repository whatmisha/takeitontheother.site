/**
 * Сверка JS-порта с Python. Вход — analysis/harness.json, выгруженный harness.py.
 *
 * Запуск: node analysis/harness.mjs
 * Падает с ненулевым кодом, если хоть одно число расходится больше допуска.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseFont } from '../app/kb/typography.js';
import { features, band } from '../app/kb/optics.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TOL = { metric: 1e-9, geometry: 1e-9, feature: 1e-9 };

const ref = JSON.parse(readFileSync(join(HERE, 'harness.json'), 'utf8'));
const buf = readFileSync(join(ROOT, 'Fonts', 'YS Text', 'YS Text-Regular.ttf'));
const tf = parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const fails = [];
let checks = 0;
const cmp = (name, got, want, tol) => {
    checks++;
    if (want === null || want === undefined) {
        if (got !== null && got !== undefined) fails.push(`${name}: ожидалось null, получено ${got}`);
        return;
    }
    const d = Math.abs(got - want);
    if (!(d <= tol)) fails.push(`${name}: ${got} vs ${want}, Δ=${d.toExponential(2)}`);
};

// --- метрики гарнитуры
cmp('metrics.upm', tf.upm, ref.metrics.upm, TOL.metric);
cmp('metrics.capHeight', tf.capHeight, ref.metrics.cap_height, TOL.metric);
cmp('metrics.xHeight', tf.xHeight, ref.metrics.x_height, TOL.metric);
cmp('metrics.ascender', tf.ascender, ref.metrics.asc, TOL.metric);
cmp('metrics.descender', tf.descender, ref.metrics.desc, TOL.metric);
cmp('metrics.xHeightEm', tf.xHeight / tf.upm, ref.metrics.x_height_em, TOL.metric);
cmp('metrics.capEm', tf.capHeight / tf.upm, ref.metrics.cap_em, TOL.metric);

// --- ink-бокс и advance каждой строки макета
let worstString = 0;
for (const s of ref.strings) {
    const r = tf.layout(s.text, s.size, s.tracking, [0, 0]);
    const tag = `строка ${JSON.stringify(s.text)}@${s.size.toFixed(2)}`;
    cmp(`${tag}.advw`, r.advw, s.advw, TOL.geometry);
    if (s.ink === null) { cmp(`${tag}.ink`, r.ink, null, 0); continue; }
    if (!r.ink) { fails.push(`${tag}.ink: получено null`); continue; }
    for (let i = 0; i < 4; i++) {
        cmp(`${tag}.ink[${i}]`, r.ink[i], s.ink[i], TOL.geometry);
        worstString = Math.max(worstString, Math.abs(r.ink[i] - s.ink[i]));
    }
}

// --- ink-бокс глифа, полоса измерения, признаки формы, предсказанный вылет
let worstFeature = 0;
const coefEntries = Object.entries(ref.coef);
for (const g of ref.glyphs) {
    const tag = `глиф ${JSON.stringify(g.ch)}`;
    cmp(`${tag}.adv`, tf.advance(g.ch), g.adv, TOL.metric);
    const bb = tf.box(g.ch);
    if (g.bbox) for (let i = 0; i < 4; i++) cmp(`${tag}.bbox[${i}]`, bb[i], g.bbox[i], TOL.metric);
    else cmp(`${tag}.bbox`, bb, null, 0);
    const b = band(tf, g.ch);
    if (g.band) { cmp(`${tag}.band[0]`, b[0], g.band[0], TOL.metric); cmp(`${tag}.band[1]`, b[1], g.band[1], TOL.metric); }
    for (const side of ['L', 'R']) {
        const want = g[side];
        const f = features(tf, g.ch, side, ref.eps, ref.w);
        if (!want) { if (f) fails.push(`${tag}.${side}: ожидалось null`); continue; }
        if (!f) { fails.push(`${tag}.${side}: получено null`); continue; }
        for (const key of ['noncontact', 'recess', 'depth', 'h']) {
            cmp(`${tag}.${side}.${key}`, f[key], want[key], TOL.feature);
            worstFeature = Math.max(worstFeature, Math.abs(f[key] - want[key]));
        }
        const em = coefEntries.reduce((s, [k, v]) => s + v * f[k], 0);
        cmp(`${tag}.${side}.outdent_em`, em, want.outdent_em, 1e-7);
    }
}

console.log(`сверено чисел: ${checks}`);
console.log(`худшее расхождение: ink-бокс строк ${worstString.toExponential(2)} px, ` +
            `признаки ${worstFeature.toExponential(2)}`);
if (fails.length) {
    console.log(`\nРАСХОЖДЕНИЙ: ${fails.length}`);
    for (const f of fails.slice(0, 25)) console.log('  ' + f);
    if (fails.length > 25) console.log(`  ... и ещё ${fails.length - 25}`);
    process.exit(1);
}
console.log('порт совпадает с Python на всех проверенных числах');
