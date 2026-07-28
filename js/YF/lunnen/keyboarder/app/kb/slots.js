/**
 * Слоты охранного поля: код слота → позиция пера. Порт § 9 PIPELINE.
 *
 * Охранное поле здесь не «безопасная зона», а система координат: 7 вертикальных якорей
 * и 5 горизонтальных, любой элемент сидит в пересечении одной пары. Заглавная буква кода
 * означает жёсткую привязку к кромке поля, строчная — что привязки нет и позиция задаётся
 * явным смещением (таких элементов в макете 24 из 204, все — единичные исключения).
 */

/** Интерлиньяж двухстрочной композиции, px. Измеренные константы, § 9.1 п. 2. */
export const INTERLINE = { mixed: 13.5279, same: 10.2168 };

const isAlnum = (ch) => /[\p{L}\p{N}]/u.test(ch);
/** Вертикаль букв и цифр считается по типографскому cap-боксу, символов — по ink. */
export const usesCapBox = (text) => [...text].every((c) => isAlnum(c) || c === ' ');
/**
 * Центрирование по x-высоте осмысленно только там, где есть строчные: у `insert` середина
 * x-высоты и есть визуальный центр, а у `2.4G` или `*` никакой x-высоты нет, и центрируется
 * чернильный габарит. Проверено на всех 16 элементах слотов M и F.
 */
const hasLowercase = (text) => [...text].some((c) => c.toLowerCase() === c && c.toUpperCase() !== c);

/** Опорный бокс элемента по вертикали: [верх, низ]. Порт refbox() из analysis/final.py. */
function refBoxY(ctx, by) {
    const { tf, text, size, tracking = 0 } = ctx;
    if (usesCapBox(text)) return [by - tf.capHeight * (size / tf.upm), by];
    const ink = tf.layout(text, size, tracking, [0, by]).ink;
    return ink ? [ink[1], ink[1] + ink[3]] : [by, by];
}

/**
 * Базовая линия строки для вертикального якоря.
 * @param {'T'|'B'|'M'|'U'} code
 * @param {object} ctx { tf, text, size, tracking, guide, interline }
 * @returns {number|null} null, если якорь нежёсткий — позицию задаёт смещение
 */
export function baselineFor(code, ctx) {
    const { tf, text, size, tracking = 0, interline = INTERLINE.mixed } = ctx;
    const g = ctx.guide;
    const cap = usesCapBox(text);
    const k = size / tf.upm;
    if (code === 'B') {
        if (cap) return g.y1;
        const ink = tf.layout(text, size, tracking, [0, 0]).ink;
        return ink ? g.y1 - (ink[1] + ink[3]) : g.y1;
    }
    if (code === 'T') {
        if (cap) return g.y0 + tf.capHeight * k;
        const ink = tf.layout(text, size, tracking, [0, 0]).ink;
        return ink ? g.y0 - ink[1] : g.y0;
    }
    if (code === 'M') {
        if (hasLowercase(text)) return g.cy + (tf.xHeight * k) / 2;
        return centerRefBox(ctx, g.cy);
    }
    if (code === 'U') return g.y1 - interline;
    // F — середина свободной зоны между верхом поля и capline подписи, стоящей на низу
    if (code === 'F' && ctx.freeZoneBottom != null) {
        return centerRefBox(ctx, (g.y0 + ctx.freeZoneBottom) / 2);
    }
    return null;
}

/** Базовая линия, при которой опорный бокс центрируется на заданной высоте. */
function centerRefBox(ctx, targetCenter) {
    const [top, bot] = refBoxY(ctx, 0);
    return targetCenter - (top + bot) / 2;
}

/**
 * Позиция пера по горизонтали.
 * @param {'C'|'L'|'R'} code
 * @param {object} ctx { tf, comp, text, size, tracking, guide }
 * @returns {number|null}
 */
export function penXFor(code, ctx) {
    const { tf, comp, compOverride, text, size, tracking = 0 } = ctx;
    const g = ctx.guide;
    const r = tf.layout(text, size, tracking, [0, 0]);
    const manual = Number.isFinite(compOverride?.px) ? compOverride.px : null;
    // центр — механически по перу: полуапроши симметричны и гасят друг друга (§ 9.2)
    if (code === 'C') return g.cx - r.advw / 2;
    if (!r.ink) return g.x0;
    if (code === 'L') {
        const c = manual ?? (comp ? comp.outdentPx(text, 'L', size) : 0);
        return g.x0 - c - r.ink[0];
    }
    if (code === 'R') {
        const c = manual ?? (comp ? comp.outdentPx(text, 'R', size) : 0);
        return g.x1 + c - (r.ink[0] + r.ink[2]);
    }
    return null;
}

/**
 * Полное размещение строки в слоте.
 * @param {object} el { slot, text, size, tracking, offset }
 * @returns {{bx, by, ink, advw, anchored: {v: boolean, h: boolean}}}
 */
export function placeText(el, ctx) {
    const g = ctx.guide;
    const [vCode, hCode] = el.slot;
    const c = { ...ctx, text: el.text, size: el.size, tracking: el.tracking || 0, compOverride: el.compOverride };
    let by = baselineFor(vCode, c);
    let bx = penXFor(hCode, c);
    const anchored = { v: by !== null, h: bx !== null };
    const off = el.offset || {};
    if (by === null) by = g.y1 + (off.by || 0);
    if (bx === null) bx = g.x0 + (off.bx || 0);
    const r = ctx.tf.layout(el.text, el.size, el.tracking || 0, [bx, by]);
    return { bx, by, ink: r.ink, advw: r.advw, per: r.per, anchored };
}

/**
 * Размещение иконки: габарит прижимается к кромке или центрируется.
 * Компенсации иконки не требуют — это самый простой случай в макете (§ 9.3).
 * @param {object} el { slot, w, h, offset }
 * @param {object} ctx { guide, freeZoneBottom } freeZoneBottom — capline подписи для слота F
 */
export function placeIcon(el, ctx) {
    const g = ctx.guide;
    const [vCode, hCode] = el.slot;
    const off = el.offset || {};
    const nudge = (ctx.iconOptics && ctx.iconOptics[el.icon]) || { dx: 0, dy: 0 };
    let y = null;
    if (vCode === 'T') y = g.y0;
    else if (vCode === 'B') y = g.y1 - el.h;
    else if (vCode === 'M') y = g.cy - el.h / 2;
    else if (vCode === 'F' && ctx.freeZoneBottom != null) {
        y = (g.y0 + ctx.freeZoneBottom) / 2 - el.h / 2;
    }
    let x = null;
    if (hCode === 'L') x = g.x0;
    else if (hCode === 'R') x = g.x1 - el.w;
    else if (hCode === 'C') x = g.cx - el.w / 2;
    const anchored = { v: y !== null, h: x !== null };
    if (y === null) y = g.y0 + (off.y || 0);
    else y += nudge.dy;
    if (x === null) x = g.x0 + (off.x || 0);
    else x += nudge.dx;
    return { x, y, w: el.w, h: el.h, anchored, nudged: !!(nudge.dx || nudge.dy) };
}

/** Допуск «базовая линия стоит на низу поля», px. Тот же TOL, что в analysis/final.py. */
const BOTTOM_TOL = 0.75;

/**
 * Нижняя граница свободной зоны для слота F — capline самой верхней из подписей,
 * фактически стоящих на низу поля.
 *
 * Считается по уже размещённым элементам, а не по коду слота: подпись может сидеть
 * в нежёстком слоте (знак `-` в слоте `bL`) и всё равно стоять на низу поля. Ровно так
 * это делает key_slots() в analysis/final.py, и от этого зависит позиция иконок F-ряда.
 */
export function freeZoneBottom(placed, ctx) {
    const g = ctx.guide;
    let best = null;
    for (const p of placed) {
        if (p.kind !== 'txt' || Math.abs(p.by - g.y1) >= BOTTOM_TOL) continue;
        const top = p.by - ctx.tf.capHeight * (p.size / ctx.tf.upm);
        if (best === null || top < best) best = top;
    }
    return best;
}

/**
 * Разместить всё содержимое клавиши.
 *
 * В два прохода: сначала то, что не зависит от соседей, затем слот F, которому нужна
 * capline уже поставленной подписи.
 */
export function placeKey(key, ctx) {
    const c = { ...ctx, guide: key.guide };
    const one = (el, extra) => (el.kind === 'txt'
        ? { ...el, ...placeText(el, { ...c, ...extra }) }
        : { ...el, ...placeIcon(el, { ...c, ...extra }) });

    const out = new Array(key.elements.length);
    const later = [];
    key.elements.forEach((el, i) => {
        if (el.slot[0] === 'F') later.push(i);
        else out[i] = one(el);
    });
    const fz = freeZoneBottom(out.filter(Boolean), c);
    for (const i of later) out[i] = one(key.elements[i], { freeZoneBottom: fz });
    return out;
}
