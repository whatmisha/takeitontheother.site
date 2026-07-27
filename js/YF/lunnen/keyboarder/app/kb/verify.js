/**
 * Сверка сгенерированной геометрии с эталоном (LCAKB23.layout.json).
 *
 * Смысл — не «примерно похоже», а численный отчёт с порогами приёмки из PIPELINE.md.
 * Эталон берётся как есть, включая ручную работу: любое расхождение считается ошибкой
 * генератора, а не улучшением (решение 4 в TOOL_PLAN.md).
 */

/** Порог приёмки геометрии, px. Эталон записан с 4 знаками, так что 0.001 — предел разрешения. */
export const GEOMETRY_TOLERANCE = 0.001;

const cache = new Map();

async function loadOnce(url) {
    if (!cache.has(url)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Не удалось загрузить эталон ${url}: ${res.status} ${res.statusText}`);
        cache.set(url, await res.json());
    }
    return cache.get(url);
}

/** Эталон геометрии: сводная таблица по клавишам. */
export const loadReference = (url = 'LCAKB23.layout.json') => loadOnce(url);

/** Эталон легенд: позиция пера каждой строки и габарит каждой иконки. */
export const loadLegendReference = (url = 'LCAKB23.legends.json') => loadOnce(url);

/** Ключ сопоставления: ряд плюс округлённый x. Устойчив к невязке до 0.05 px. */
const keyOf = (k) => `${k.row}|${Math.round(k.x * 10)}`;

/**
 * @param {Array} keys — результат buildLayout
 * @param {Array} ref — эталон
 * @returns {{count, refCount, missing, extra, max, worst, pass}}
 */
export function compare(keys, ref) {
    const mine = new Map(keys.map((k) => [keyOf(k), k]));
    const seen = new Set();
    const max = { x: 0, y: 0, w: 0, h: 0 };
    const rows = [];
    const missing = [];

    for (const r of ref) {
        const k = keyOf(r);
        const m = mine.get(k);
        if (!m) {
            missing.push(`ряд ${r.row}, x=${r.x} (${r.legend || r.tpl})`);
            continue;
        }
        seen.add(k);
        const d = { x: m.x - r.x, y: m.y - r.y, w: m.w - r.w, h: m.h - r.h };
        for (const p of ['x', 'y', 'w', 'h']) max[p] = Math.max(max[p], Math.abs(d[p]));
        rows.push({ ref: r, mine: m, d, worst: Math.max(...Object.values(d).map(Math.abs)) });
    }

    rows.sort((a, b) => b.worst - a.worst);
    const extra = keys.filter((k) => !seen.has(keyOf(k)))
        .map((k) => `ряд ${k.row}, x=${k.x.toFixed(4)}`);

    const worstOverall = Math.max(...Object.values(max));
    return {
        count: keys.length,
        refCount: ref.length,
        missing,
        extra,
        max,
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
 * модель, либо пропустить плохую. Каждое число взято из измерений в PIPELINE.md, а не назначено.
 */
export const LEGEND_CLASSES = {
    'v-edge': { tol: 0.15, label: 'вертикаль: кромка поля, буквы, цифры, иконки',
        why: '§ 9.1: медиана невязки 0.0002 px, σ 0.076 — допуск взят как 2σ дрожания руки' },
    'v-edge-hand': { tol: 0.40, label: 'вертикаль: кромка поля, знаки',
        why: '§ 9.1 п. 4: у знаков нет cap-бокса, выключка по ink и подгонка на глаз' },
    'v-mid': { tol: 0.60, label: 'вертикаль: центрирование',
        why: '§ 9.1: самый рыхлый якорь, медиана 0.21 px, σ 0.23' },
    'v-zone': { tol: 0.05, label: 'вертикаль: свободная зона над подписью',
        why: '§ 9.3: медиана 0.003 px, плюс оптическая поправка иконки' },
    'h-pen': { tol: 0.06, label: 'горизонталь: центр по перу и привязка иконок',
        why: '§ 9.2: медиана 0.005 px, максимум 0.042 по 47 точкам' },
    'h-formula': { tol: 0.30, rmse: 0.12, label: 'горизонталь: кромка + компенсация формулой',
        why: '§ 10.3: RMSE модели 0.098 px, максимум 0.286 px на знаке Т' },
    'h-table': { tol: 0.25, label: 'горизонталь: кромка + компенсация по таблице',
        why: '§ 10.4: таблица хранит медиану, а сам дизайнер знак `;` поставил дважды '
            + 'по-разному с разбросом 0.38 px — точнее медианы модель быть не может' },
    explicit: { tol: 0.001, label: 'нежёсткий слот: явное смещение',
        why: 'правила нет, координата хранится как есть и обязана воспроизводиться точно' }
};

/**
 * Расхождения с названной причиной. Не «списанные», а объяснённые: каждое разобрано
 * и представляет собой известную границу модели, а не незамеченную ошибку. Смысл списка
 * в том, чтобы новая ошибка сразу бросалась в глаза, а не тонула в старых.
 */
export const KNOWN_EXCEPTIONS = [
    { label: 'num lock', axis: 'x', limit: 0.35,
        why: 'клавиша `num lock clear` — одно из двух исключений типизации (§ 11.2): '
            + 'двухсоставная подпись, выключенная не по общему правилу' },
    { label: ',', slot: 'FR', axis: 'y', limit: 0.30,
        why: 'единственный в макете знак препинания в слоте свободной зоны: '
            + 'у запятой нет cap-бокса, и центр зоны дизайнер выбрал на глаз' },
    { label: '2.4G', axis: 'x', limit: 0.15,
        why: 'единственная строка, собранная из трёх tspan с разным трекингом '
            + '(−0.0200, −0.0300, +0.0200 em); модель хранит один трекинг на строку' }
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
    let html = `<p>Размещено элементов <b>${r.total}</b>, проверено координат `
        + `<b>${r.total * 2}</b> — по одной на каждую ось каждого элемента.</p>`;
    if (r.unmatched.length) {
        html += `<p class="verify-bad">Не нашлись в эталоне (${r.unmatched.length}): `
            + `${r.unmatched.slice(0, 10).join('; ')}</p>`;
    }
    html += '<table class="verify-table"><tr><th>Правило</th><th>n</th><th>медиана</th>'
        + '<th>макс.</th><th>допуск</th><th>откуда допуск</th></tr>';
    for (const c of r.byClass) {
        html += `<tr><td>${c.label}</td><td>${c.n}</td><td>${f(c.med)}</td>`
            + `<td class="${c.pass ? 'verify-ok' : 'verify-bad'}">${f(c.max)}</td>`
            + `<td>${c.tol}${c.rmse ? `, RMSE ${c.rmse}` : ''}</td>`
            + `<td class="verify-why">${c.why}</td></tr>`;
    }
    html += '</table>';
    html += '<p>' + (r.pass
        ? '<span class="verify-ok">Пройдено: каждое правило воспроизведено с заявленной точностью.</span>'
        : '<span class="verify-bad">Не пройдено.</span>')
        + (r.excused.length
            ? ` Отдельно вынесено ${r.excused.length} расхождений с названной причиной.`
            : '') + '</p>';
    if (r.excused.length) {
        html += '<table class="verify-table"><tr><th>элемент</th><th>ось</th><th>Δ, px</th>'
            + '<th>почему так</th></tr>';
        for (const e of r.excused) {
            html += `<tr><td>${e.label}</td><td>${e.axis}</td><td>${f(e.d)}</td>`
                + `<td class="verify-why">${e.why}</td></tr>`;
        }
        html += '</table>';
    }
    if (r.worst.length) {
        html += '<table class="verify-table"><tr><th>ряд</th><th>слот</th><th>элемент</th>'
            + '<th>ось</th><th>Δ, px</th><th>правило</th></tr>';
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

    let html = `<p>Клавиш сгенерировано <b>${r.count}</b>, в эталоне <b>${r.refCount}</b>.</p>`;

    if (r.missing.length) {
        html += `<p class="verify-bad">Нет в генераторе (${r.missing.length}): ${r.missing.join('; ')}</p>`;
    }
    if (r.extra.length) {
        html += `<p class="verify-bad">Лишние (${r.extra.length}): ${r.extra.join('; ')}</p>`;
    }

    html += '<table class="verify-table"><tr><th>Параметр</th><th>макс. |Δ|, px</th></tr>';
    for (const [p, label] of [['x', 'x'], ['y', 'y'], ['w', 'ширина'], ['h', 'высота']]) {
        html += `<tr><td>${label}</td><td class="${cls(r.max[p])}">${px(r.max[p])}</td></tr>`;
    }
    html += '</table>';

    html += `<p>Порог приёмки — ${GEOMETRY_TOLERANCE} px (эталон записан с четырьмя знаками). `
        + (r.pass
            ? '<span class="verify-ok">Пройдено.</span>'
            : '<span class="verify-bad">Не пройдено.</span>')
        + '</p>';

    if (r.worst.length) {
        html += '<table class="verify-table"><tr><th>ряд</th><th>легенда</th><th>Δx</th><th>Δy</th><th>Δw</th><th>Δh</th></tr>';
        for (const w of r.worst) {
            html += `<tr><td>${w.ref.row}</td><td>${w.ref.legend || w.ref.tpl}</td>`
                + `<td>${w.d.x.toFixed(5)}</td><td>${w.d.y.toFixed(5)}</td>`
                + `<td>${w.d.w.toFixed(5)}</td><td>${w.d.h.toFixed(5)}</td></tr>`;
        }
        html += '</table>';
    }
    return html;
}
