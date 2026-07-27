/**
 * Сверка сгенерированной геометрии с эталоном (LCAKB23.layout.json).
 *
 * Смысл — не «примерно похоже», а численный отчёт с порогами приёмки из PIPELINE.md.
 * Эталон берётся как есть, включая ручную работу: любое расхождение считается ошибкой
 * генератора, а не улучшением (решение 4 в TOOL_PLAN.md).
 */

/** Порог приёмки геометрии, px. Эталон записан с 4 знаками, так что 0.001 — предел разрешения. */
export const GEOMETRY_TOLERANCE = 0.001;

let cache = null;

/** Загружает эталон один раз. */
export async function loadReference(url = 'LCAKB23.layout.json') {
    if (cache) return cache;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Не удалось загрузить эталон: ${res.status} ${res.statusText}`);
    cache = await res.json();
    return cache;
}

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
