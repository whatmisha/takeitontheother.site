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

function generatedOrdinals(keys) {
    const ord = new Map();
    for (const group of groupedByRowBlock(keys).values()) {
        group.forEach((k, i) => ord.set(k, i));
    }
    return ord;
}

function editIdOf(k, ordinal) {
    return `${k.row}:${k.block || ''}:${ordinal}`;
}

function contentByEditId(content) {
    const byId = new Map();
    for (const group of groupedByRowBlock(content.keys).values()) {
        group.forEach((k, ordinal) => byId.set(editIdOf(k, ordinal), k));
    }
    return byId;
}

/** Приписать каждой клавише её содержимое из модели. */
export function attachContent(keys, content) {
    const byEditId = contentByEditId(content);
    const byKey = new Map(content.keys.map((k) => [keyOf(k.row, k.x), k]));
    const byRowBlock = groupedByRowBlock(content.keys);
    const ordinals = generatedOrdinals(keys);
    const used = new Set();
    let matched = 0;

    for (const k of keys) {
        if (k.editId) {
            const c = byEditId.get(k.editId);
            if (!c) {
                k.elements = [];
                k.tpl = null;
                k.content = null;
                continue;
            }
            k.elements = c.elements;
            k.tpl = c.tpl;
            k.content = c;
            used.add(c);
            matched++;
            continue;
        }
        const c = byKey.get(keyOf(k.row, k.x));
        if (!c) {
            k.elements = [];
            k.tpl = null;
            k.content = null;
            continue;
        }
        k.elements = c.elements;
        k.tpl = c.tpl;
        k.content = c;
        used.add(c);
        matched++;
    }

    // When Grid sliders move the generated x positions, the exact reference key no longer
    // matches. Fall back to stable visual order inside each row/block so legends stay attached.
    for (const k of keys) {
        if (k.content) continue;
        const group = byRowBlock.get(rowBlockOf(k));
        const c = group && group[ordinals.get(k)];
        if (!c || used.has(c)) continue;
        k.elements = c.elements;
        k.tpl = c.tpl;
        k.content = c;
        used.add(c);
        matched++;
    }
    return { matched, total: keys.length, orphans: content.keys.length - used.size };
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
