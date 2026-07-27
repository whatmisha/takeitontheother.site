/**
 * Сборка легенд: содержимое клавиш + геометрия + гарнитура → размещённые элементы.
 *
 * Здесь сходятся все части: grid.js даёт прямоугольники, guides.js — охранные поля,
 * content/*.js — что на клавише написано, slots.js — куда это ставится, compensate.js —
 * насколько выпустить знак за кромку.
 */
import { placeKey } from './slots.js';

/** Ключ сопоставления клавиши и её содержимого — тот же, что в verify.js. */
export const keyOf = (row, x) => `${row}|${Math.round(x * 10)}`;

/** Приписать каждой клавише её содержимое из модели. */
export function attachContent(keys, content) {
    const byKey = new Map(content.keys.map((k) => [keyOf(k.row, k.x), k]));
    let matched = 0;
    for (const k of keys) {
        const c = byKey.get(keyOf(k.row, k.x));
        k.elements = c ? c.elements : [];
        k.tpl = c ? c.tpl : null;
        if (c) matched++;
    }
    return { matched, total: keys.length, orphans: content.keys.length - matched };
}

/**
 * Разместить легенды на всех клавишах.
 * @param {object} ctx { tf, comp, interline }
 * @returns {Array} плоский список размещённых элементов со ссылкой на клавишу
 */
export function buildLegends(keys, ctx) {
    const out = [];
    for (const k of keys) {
        if (!k.elements || !k.elements.length) continue;
        const placed = placeKey(k, ctx);
        k.placed = placed;
        for (const p of placed) out.push({ ...p, key: k });
    }
    return out;
}

/** Контур строки как SVG-путь; используется и в превью, и в экспорте кривыми. */
export const textPath = (tf, el) =>
    tf.pathData(el.text, el.size, el.tracking || 0, [el.bx, el.by]);
