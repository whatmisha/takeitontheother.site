/**
 * Профили контуров глифов и признаки формы края. Порт analysis/optics.py и feats() из model.py.
 *
 * Смысл: глаз реагирует не на полуапрош (одно число на знак), а на площадь просвета вдоль
 * всей высоты знака. Поэтому контур режется сканлайнами и от профиля считаются два
 * безразмерных признака — доля высоты без контакта с крайней вертикалью и глубина отступления.
 */

const BEZIER_STEPS = 24;   // шагов на кубическую кривую при развёртке
export const N_SCAN = 400; // сканлайнов на полосу измерения

/** Развёртка контура глифа в замкнутые полигоны, em-units, Y вверх. */
function flatten(tf, ch) {
    const g = tf.glyph(ch);
    if (!g) return [];
    const cmds = g.glyph.path.commands;
    const polys = [];
    let cur = [];
    let px = 0, py = 0;

    const cubic = (x1, y1, x2, y2, x3, y3) => {
        for (let i = 1; i <= BEZIER_STEPS; i++) {
            const t = i / BEZIER_STEPS, u = 1 - t;
            const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
            cur.push([a * px + b * x1 + c * x2 + d * x3, a * py + b * y1 + c * y2 + d * y3]);
        }
        px = x3; py = y3;
    };

    for (const c of cmds) {
        if (c.type === 'M') {
            if (cur.length > 2) polys.push(cur);
            cur = [[c.x, c.y]];
            px = c.x; py = c.y;
        } else if (c.type === 'L') {
            cur.push([c.x, c.y]);
            px = c.x; py = c.y;
        } else if (c.type === 'C') {
            cubic(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
        } else if (c.type === 'Q') {
            // квадратичная в кубическую — тем же способом, что DecomposingRecordingPen в Python
            cubic(px + (2 / 3) * (c.x1 - px), py + (2 / 3) * (c.y1 - py),
                  c.x + (2 / 3) * (c.x1 - c.x), c.y + (2 / 3) * (c.y1 - c.y),
                  c.x, c.y);
        } else if (c.type === 'Z') {
            if (cur.length > 2) polys.push(cur);
            cur = [];
        }
    }
    if (cur.length > 2) polys.push(cur);
    return polys;
}

/** Полоса измерения: пересечение ink-бокса с [0, capHeight]. */
export function band(tf, ch) {
    const bb = tf.box(ch);
    if (!bb) return null;
    return [Math.max(bb[1], 0), Math.min(bb[3], tf.capHeight)];
}

/**
 * Левый и правый профили ink по сканлайнам полосы [y0, y1].
 * Значение null там, где на сканлайне контура нет.
 */
export function profile(tf, ch, y0, y1, n = N_SCAN) {
    const polys = flatten(tf, ch);
    const L = new Array(n).fill(null);
    const R = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
        const y = y0 + (y1 - y0) * (i + 0.5) / n;
        let lo = Infinity, hi = -Infinity, hit = false;
        for (const poly of polys) {
            const m = poly.length;
            for (let j = 0; j < m; j++) {
                const [ax, ay] = poly[j];
                const [bx, by] = poly[(j + 1) % m];
                if ((ay <= y && y < by) || (by <= y && y < ay)) {
                    const x = ax + (bx - ax) * (y - ay) / (by - ay);
                    if (x < lo) lo = x;
                    if (x > hi) hi = x;
                    hit = true;
                }
            }
        }
        if (hit) { L[i] = lo; R[i] = hi; }
    }
    return { L, R };
}

/**
 * Признаки формы края знака, безразмерные.
 * @param {'L'|'R'} side прижимаемая сторона
 * @param {number} eps порог «контур касается крайней вертикали», em-units
 * @param {number} w окно насыщения глубины, em-units
 */
export function features(tf, ch, side, eps, w) {
    const b = band(tf, ch);
    if (!b || b[1] - b[0] < 1) return null;
    const { L, R } = profile(tf, ch, b[0], b[1]);
    const prof = (side === 'L' ? L : R).filter((v) => v !== null);
    if (!prof.length) return null;
    const ext = side === 'L' ? Math.min(...prof) : Math.max(...prof);
    const d = prof.map((v) => Math.abs(v - ext));
    const n = d.length;
    const contact = d.filter((x) => x <= eps).length / n;
    const recess = d.reduce((s, x) => s + Math.min(x, w), 0) / (w * n);
    return {
        noncontact: 1 - contact,
        recess,
        depth: Math.min(Math.max(...d) / tf.capHeight, 1),
        h: (b[1] - b[0]) / tf.capHeight
    };
}

/** Кэш признаков по (гарнитура, знак, сторона, eps, w). */
export function makeFeatureCache(tf) {
    const store = new Map();
    return (ch, side, eps, w) => {
        const key = `${ch}\u0000${side}\u0000${eps}\u0000${w}`;
        if (!store.has(key)) store.set(key, features(tf, ch, side, eps, w));
        return store.get(key);
    };
}
