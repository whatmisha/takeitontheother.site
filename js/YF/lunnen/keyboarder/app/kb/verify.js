/**
 * Сверка сгенерированной геометрии с эталоном layout-specific `.layout.json`.
 *
 * Смысл — не «примерно похоже», а численный отчёт с порогами приёмки из docs/project/PIPELINE.md.
 * Эталон берётся как есть, включая ручную работу: любое расхождение считается ошибкой
 * генератора, а не улучшением (решение 4 в docs/project/TOOL_PLAN.md).
 */

/** Порог приёмки геометрии, px. Эталон записан с 4 знаками, так что 0.001 — предел разрешения. */
export const GEOMETRY_TOLERANCE = 0.001;

const cache = new Map();

async function loadOnce(url) {
    if (!cache.has(url)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load reference ${url}: ${res.status} ${res.statusText}`);
        cache.set(url, await res.json());
    }
    return cache.get(url);
}

/** Эталон геометрии: сводная таблица по клавишам. */
export const loadReference = (url = 'reference/lcakb23/LCAKB23.layout.json') => loadOnce(url);

/** Эталон легенд: позиция пера каждой строки и габарит каждой иконки. */
export const loadLegendReference = (url = 'reference/lcakb23/LCAKB23.legends.json') => loadOnce(url);

/** Ключ сопоставления: ряд плюс округлённый x. Устойчив к невязке до 0.05 px. */
const keyOf = (k) => `${k.row}|${Math.round(k.x * 10)}`;
const rowBlockOf = (k) => `${k.row}|${k.block || ''}`;

function groupedByRowBlock(items) {
    const groups = new Map();
    for (const item of items) {
        const key = rowBlockOf(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    }
    for (const group of groups.values()) group.sort((a, b) => a.x - b.x);
    return groups;
}

function ordinalsByRowBlock(items) {
    const out = new Map();
    for (const group of groupedByRowBlock(items).values()) {
        group.forEach((item, i) => out.set(item, i));
    }
    return out;
}

/**
 * @param {Array} keys — результат buildLayout
 * @param {Array} ref — эталон
 * @returns {{count, refCount, missing, extra, max, worst, pass}}
 */
export function compare(keys, ref) {
    const mine = new Map();
    for (const k of keys) {
        const id = keyOf(k);
        if (!mine.has(id)) mine.set(id, []);
        mine.get(id).push(k);
    }
    const mineByRowBlock = groupedByRowBlock(keys);
    const refOrdinals = ordinalsByRowBlock(ref);
    const seen = new Set();
    const max = { x: 0, y: 0, w: 0, h: 0 };
    const rows = [];
    const missing = [];

    for (const r of ref) {
        const k = keyOf(r);
        const exact = mine.get(k) || [];
        let m = exact.find((item) => !seen.has(item)) || null;
        if (!m) {
            const group = mineByRowBlock.get(rowBlockOf(r));
            const fallback = group && group[refOrdinals.get(r)];
            if (fallback && !seen.has(fallback)) m = fallback;
        }
        if (!m) {
            missing.push(`row ${r.row}, x=${r.x} (${r.legend || r.tpl})`);
            continue;
        }
        seen.add(m);
        const d = { x: m.x - r.x, y: m.y - r.y, w: m.w - r.w, h: m.h - r.h };
        for (const p of ['x', 'y', 'w', 'h']) max[p] = Math.max(max[p], Math.abs(d[p]));
        rows.push({ ref: r, mine: m, d, worst: Math.max(...Object.values(d).map(Math.abs)) });
    }

    rows.sort((a, b) => b.worst - a.worst);
    const extra = keys.filter((k) => !seen.has(k))
        .map((k) => `row ${k.row}, x=${k.x.toFixed(4)}`);

    const worstOverall = Math.max(...Object.values(max));
    return {
        count: keys.length,
        refCount: ref.length,
        missing,
        extra,
        max,
        rows,
        worst: rows.slice(0, 8),
        worstOverall,
        pass: missing.length === 0 && extra.length === 0 && worstOverall <= GEOMETRY_TOLERANCE
    };
}

/**
 * Допуски приёмки легенд по классам правил, px.
 *
 * Единого порога здесь быть не может: правила имеют разную заявленную точность, и требовать
 * от оптической компенсации того же, что от привязки к кромке, значит либо завалить хорошую
 * модель, либо пропустить плохую. Каждое число взято из измерений в docs/project/PIPELINE.md, а не назначено.
 */
export const LEGEND_CLASSES = {
    'v-edge': { tol: 0.15, label: 'vertical: guide edge, letters, digits, icons',
        why: '§ 9.1: median error 0.0002 px, σ 0.076 — tolerance set to 2σ of hand jitter' },
    'v-edge-hand': { tol: 0.40, label: 'vertical: guide edge, symbols',
        why: '§ 9.1 ¶ 4: symbols have no cap box; alignment by ink and eye' },
    'v-mid': { tol: 0.60, label: 'vertical: centering',
        why: '§ 9.1: loosest anchor, median 0.21 px, σ 0.23' },
    'v-zone': { tol: 0.05, label: 'vertical: free zone above caption',
        why: '§ 9.3: median 0.003 px, plus icon optical nudge' },
    'h-pen': { tol: 0.06, label: 'horizontal: pen center and icon anchors',
        why: '§ 9.2: median 0.005 px, max 0.042 across 47 points' },
    'h-formula': { tol: 0.30, rmse: 0.12, label: 'horizontal: edge + formula compensation',
        why: '§ 10.3: model RMSE 0.098 px, max 0.286 px on glyph Т' },
    'h-table': { tol: 0.25, label: 'horizontal: edge + table compensation',
        why: '§ 10.4: table stores the median; the designer placed `;` twice '
            + 'differently with 0.38 px spread — the model cannot beat the median' },
    explicit: { tol: 0.001, label: 'soft slot: explicit offset',
        why: 'no rule; the coordinate is stored as-is and must reproduce exactly' }
};

/**
 * Расхождения с названной причиной. Не «списанные», а объяснённые: каждое разобрано
 * и представляет собой известную границу модели, а не незамеченную ошибку. Смысл списка
 * в том, чтобы новая ошибка сразу бросалась в глаза, а не тонула в старых.
 */
export const KNOWN_EXCEPTIONS = [
    { label: 'num lock', axis: 'x', limit: 0.35,
        why: '`num lock clear` is one of two typing exceptions (§ 11.2): '
            + 'a two-part caption not aligned by the general rule' },
    { label: ',', slot: 'FR', axis: 'y', limit: 0.30,
        why: 'only punctuation mark in a free-zone slot in the layout: '
            + 'comma has no cap box, and the designer picked the zone center by eye' },
    { label: '2.4G', axis: 'x', limit: 0.15,
        why: 'only string built from three tspans with different tracking '
            + '(−0.0200, −0.0300, +0.0200 em); the model stores one tracking per string' }
];

const exceptionFor = (pt) => KNOWN_EXCEPTIONS.find((e) => e.label === pt.label
    && e.axis === pt.axis && (!e.slot || e.slot === pt.slot)
    && Math.abs(pt.d) <= e.limit);

const isAlnumText = (s) => [...(s || '')].every((c) => /[\p{L}\p{N}]/u.test(c) || c === ' ');
const isLoose = (code) => code === code.toLowerCase() && code !== code.toUpperCase();

/** Класс правила, по которому поставлена координата элемента. */
function classOf(el, axis) {
    const code = axis === 'y' ? el.slot[0] : el.slot[1];
    if (isLoose(code)) return 'explicit';
    if (axis === 'y') {
        if (code === 'M') return 'v-mid';
        if (code === 'F') return 'v-zone';
        return el.kind === 'ico' || isAlnumText(el.text) ? 'v-edge' : 'v-edge-hand';
    }
    if (code === 'C' || el.kind === 'ico') return 'h-pen';
    return isAlnumText(el.text) ? 'h-formula' : 'h-table';
}

/**
 * Сверка размещения легенд с эталоном.
 *
 * Элементы делятся на два класса. **Жёсткие** сидят в слотах с привязкой к кромке поля —
 * их позицию инструмент обязан вывести из правил, и расхождение здесь означает ошибку
 * модели. **Явные** стоят в нежёстких слотах, где правила нет вовсе, и несут измеренное
 * смещение; они совпадают по построению, поэтому в статистику точности не идут.
 */
export function compareLegends(placed, refKeys) {
    // в эталоне легенд габарит клавиши лежит в cap[], а не в x — ключ строим из него
    const refKeyOf = (k) => `${k.row}|${Math.round(k.cap[0] * 10)}`;
    const ref = new Map();
    for (const k of refKeys) {
        for (const e of k.elements) {
            ref.set(`${refKeyOf(k)}|${e.slot}|${e.kind}|${e.text || e.name || ''}`, { e, k });
        }
    }
    const points = [];
    const unmatched = [];
    for (const p of placed) {
        const want = p.kind === 'txt'
            ? (ref.get(`${keyOf(p.key)}|${p.slot}|txt|${p.text}`) || {}).e
            : findIcon(ref, p);
        if (!want) { unmatched.push(`${p.slot} ${p.text || p.icon}`); continue; }
        const got = p.kind === 'txt' ? [p.bx, p.by] : [p.x, p.y];
        const exp = p.kind === 'txt' ? [want.bx, want.by] : [want.bb[0], want.bb[1]];
        const label = p.text || p.icon;
        points.push({ axis: 'x', cls: classOf(p, 'x'), d: got[0] - exp[0], row: p.key.row, slot: p.slot, label });
        points.push({ axis: 'y', cls: classOf(p, 'y'), d: got[1] - exp[1], row: p.key.row, slot: p.slot, label });
    }

    for (const pt of points) pt.excused = !!exceptionFor(pt);

    const byClass = [];
    for (const [id, spec] of Object.entries(LEGEND_CLASSES)) {
        const list = points.filter((pt) => pt.cls === id && !pt.excused);
        if (!list.length) continue;
        const abs = list.map((pt) => Math.abs(pt.d)).sort((a, b) => a - b);
        const rmse = Math.sqrt(list.reduce((s, pt) => s + pt.d * pt.d, 0) / list.length);
        const max = abs[abs.length - 1];
        byClass.push({
            id, ...spec, n: list.length, med: abs[abs.length >> 1], max, rmse,
            excused: points.filter((pt) => pt.cls === id && pt.excused).length,
            pass: max <= spec.tol && (!spec.rmse || rmse <= spec.rmse)
        });
    }

    const worst = points.filter((pt) => !pt.excused
        && Math.abs(pt.d) > LEGEND_CLASSES[pt.cls].tol)
        .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const excused = points.filter((pt) => pt.excused)
        .map((pt) => ({ ...pt, why: exceptionFor(pt).why }));
    return {
        total: points.length / 2, unmatched, byClass, worst, excused,
        pass: unmatched.length === 0 && byClass.every((c) => c.pass)
    };
}

/** Иконку опознаём по клавише и слоту: имена в эталоне синтетические. */
function findIcon(ref, p) {
    for (const [k, v] of ref) {
        if (v.e.kind === 'ico' && k.startsWith(`${keyOf(p.key)}|${p.slot}|ico|`)) return v.e;
    }
    return null;
}

/** Отчёт по легендам в HTML. */
export function legendsReportHtml(r) {
    const f = (v) => v.toFixed(4);
    let html = `<p>Placed <b>${r.total}</b> elements, checked <b>${r.total * 2}</b> coordinates `
        + `— one per axis per element.</p>`;
    if (r.unmatched.length) {
        html += `<p class="verify-bad">Missing from reference (${r.unmatched.length}): `
            + `${r.unmatched.slice(0, 10).join('; ')}</p>`;
    }
    html += '<table class="verify-table"><tr><th>Rule</th><th>n</th><th>median</th>'
        + '<th>max</th><th>tolerance</th><th>tolerance source</th></tr>';
    for (const c of r.byClass) {
        html += `<tr><td>${c.label}</td><td>${c.n}</td><td>${f(c.med)}</td>`
            + `<td class="${c.pass ? 'verify-ok' : 'verify-bad'}">${f(c.max)}</td>`
            + `<td>${c.tol}${c.rmse ? `, RMSE ${c.rmse}` : ''}</td>`
            + `<td class="verify-why">${c.why}</td></tr>`;
    }
    html += '</table>';
    html += '<p>' + (r.pass
        ? '<span class="verify-ok">Passed: every rule reproduced within its stated tolerance.</span>'
        : '<span class="verify-bad">Failed.</span>')
        + (r.excused.length
            ? ` ${r.excused.length} discrepancies called out with a named reason.`
            : '') + '</p>';
    if (r.excused.length) {
        html += '<table class="verify-table"><tr><th>element</th><th>axis</th><th>Δ, px</th>'
            + '<th>why</th></tr>';
        for (const e of r.excused) {
            html += `<tr><td>${e.label}</td><td>${e.axis}</td><td>${f(e.d)}</td>`
                + `<td class="verify-why">${e.why}</td></tr>`;
        }
        html += '</table>';
    }
    if (r.worst.length) {
        html += '<table class="verify-table"><tr><th>row</th><th>slot</th><th>element</th>'
            + '<th>axis</th><th>Δ, px</th><th>rule</th></tr>';
        for (const w of r.worst.slice(0, 15)) {
            html += `<tr><td>${w.row}</td><td>${w.slot}</td><td>${w.label}</td>`
                + `<td>${w.axis}</td><td class="verify-bad">${f(w.d)}</td>`
                + `<td>${LEGEND_CLASSES[w.cls].label}</td></tr>`;
        }
        html += '</table>';
    }
    return html;
}

/** Отчёт в HTML для диалога. */
export function reportHtml(r) {
    const cls = (v) => (v <= GEOMETRY_TOLERANCE ? 'verify-ok' : 'verify-bad');
    const px = (v) => v.toFixed(6);

    let html = `<p>Generated <b>${r.count}</b> keys, reference has <b>${r.refCount}</b>.</p>`;

    if (r.missing.length) {
        html += `<p class="verify-bad">Missing from generator (${r.missing.length}): ${r.missing.join('; ')}</p>`;
    }
    if (r.extra.length) {
        html += `<p class="verify-bad">Extra (${r.extra.length}): ${r.extra.join('; ')}</p>`;
    }

    html += '<table class="verify-table"><tr><th>Parameter</th><th>max |Δ|, px</th></tr>';
    for (const [p, label] of [['x', 'x'], ['y', 'y'], ['w', 'width'], ['h', 'height']]) {
        html += `<tr><td>${label}</td><td class="${cls(r.max[p])}">${px(r.max[p])}</td></tr>`;
    }
    html += '</table>';

    html += `<p>Acceptance threshold — ${GEOMETRY_TOLERANCE} px (reference stored to four decimals). `
        + (r.pass
            ? '<span class="verify-ok">Passed.</span>'
            : '<span class="verify-bad">Failed.</span>')
        + '</p>';

    if (r.worst.length) {
        html += '<table class="verify-table"><tr><th>row</th><th>legend</th><th>Δx</th><th>Δy</th><th>Δw</th><th>Δh</th></tr>';
        for (const w of r.worst) {
            html += `<tr><td>${w.ref.row}</td><td>${w.ref.legend || w.ref.tpl}</td>`
                + `<td>${w.d.x.toFixed(5)}</td><td>${w.d.y.toFixed(5)}</td>`
                + `<td>${w.d.w.toFixed(5)}</td><td>${w.d.h.toFixed(5)}</td></tr>`;
        }
        html += '</table>';
    }
    return html;
}
