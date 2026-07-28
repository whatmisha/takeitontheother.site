/**
 * Движок геометрии: декларативное описание ряда → абсолютные прямоугольники клавиш.
 *
 * Порт этапа 4 пайплайна (PIPELINE.md § 5). Чистые функции, никакого DOM.
 */

/** Ширина в юнитах: n колонок минус один зазор. */
export const uWidth = (n, grid) => n * grid.colPitch - gapOf(grid);

/** Зазор выводится из шага и ширины 1U, отдельной константой не хранится. */
export const gapOf = (grid) => grid.colPitch - grid.keyWidth1U;

/** Высота клавиши, занимающей n рядов. */
export const spanHeight = (n, grid) => grid.keyHeight + (n - 1) * grid.rowPitch;

/**
 * Разворачивает `repeat` в отдельные элементы, чтобы дальше работать с плоским списком.
 * @returns {Array<Object>}
 */
function expand(items) {
    const out = [];
    for (const it of items) {
        const n = it.repeat || 1;
        const ids = Array.isArray(it.ids) ? it.ids : null;
        for (let i = 0; i < n; i++) {
            const copy = { ...it };
            delete copy.repeat;
            delete copy.ids;
            // При repeat > 1 явный id размножать нельзя — он должен быть уникальным.
            // `ids` хранит имена отдельных повторённых клавиш в компактных импортированных рядах.
            if (n > 1) {
                if (ids && ids[i]) copy.id = ids[i];
                else delete copy.id;
            }
            out.push(copy);
        }
    }
    return out;
}

/**
 * Раскладывает один ряд одного блока в прямоугольники.
 *
 * @param {Array} items — элементы ряда
 * @param {Object} block — { id, x, width }
 * @param {Object} grid
 * @param {number} y
 * @returns {Array<{x,y,w,h,block,col,span}>}
 */
export function layoutRow(items, block, grid, y) {
    const list = expand(items);
    const gap = gapOf(grid);

    // Ширины всего, кроме flex. skip занимает колонку, но клавишей не становится.
    const widths = list.map((it) => {
        if (it.skip) return uWidth(it.skip, grid);
        if (it.flex) return null;
        if (it.w != null) return it.w;
        return uWidth(it.u ?? 1, grid);
    });

    const flexCount = widths.filter((w) => w === null).length;
    if (flexCount > 1) {
        throw new Error(`layoutRow: в ряду блока "${block.id}" ${flexCount} flex-клавиш, допустима одна`);
    }
    if (flexCount === 1) {
        if (block.width == null) {
            throw new Error(`layoutRow: flex требует width у блока "${block.id}"`);
        }
        const fixed = widths.reduce((s, w) => s + (w || 0), 0);
        const gaps = (list.length - 1) * gap;
        const rest = block.width - fixed - gaps;
        if (rest <= 0) {
            throw new Error(`layoutRow: ряд блока "${block.id}" не вмещается, flex получил ${rest.toFixed(3)}`);
        }
        widths[widths.indexOf(null)] = rest;
    }

    const keys = [];
    let x = block.x;
    list.forEach((it, i) => {
        const w = widths[i];
        if (!it.skip) {
            if (Array.isArray(it.stack) && it.stack.length) {
                it.stack.forEach((child, stackIndex) => {
                    keys.push({
                        x,
                        y: y + (Number(child.yOffset) || 0),
                        w: child.w ?? w,
                        h: child.h ?? spanHeight(child.rowSpan || 1, grid),
                        block: block.id,
                        span: child.rowSpan || 1,
                        id: child.id || null,
                        editId: child.editId || (it.editId ? `${it.editId}:stack${stackIndex}` : null),
                        stackParentEditId: it.editId || null,
                        stackIndex,
                        stackCount: it.stack.length
                    });
                });
            } else {
                keys.push({
                    x, y, w,
                    h: spanHeight(it.rowSpan || 1, grid),
                    block: block.id,
                    span: it.rowSpan || 1,
                    id: it.id || null,
                    editId: it.editId || null
                });
            }
        }
        x += w + gap;
    });
    return keys;
}

/**
 * Разворачивает всю раскладку в плоский список клавиш.
 *
 * `rowSpan` обрабатывается естественно: клавиша просто выше, а в следующем ряду её колонка
 * не описана — так задано в layouts.js. Никакой резервации колонок не требуется.
 *
 * @param {Object} layout — см. layouts.js
 * @param {Object} [gridOverride] — переопределение сетки из слайдеров
 * @returns {{keys: Array, grid: Object, bounds: {w:number,h:number}}}
 */
export function buildLayout(layout, gridOverride) {
    const grid = { ...layout.grid, ...gridOverride };
    const blocks = new Map(layout.blocks.map((b) => [b.id, b]));
    const keys = [];

    layout.rows.forEach((row, r) => {
        const sourceRow = Number.isInteger(row.__sourceRow) ? row.__sourceRow : r;
        const y = grid.origin.y + r * grid.rowPitch;
        for (const [blockId, items] of Object.entries(row)) {
            const block = blocks.get(blockId);
            if (!block) throw new Error(`buildLayout: неизвестный блок "${blockId}" в ряду ${r}`);
            for (const k of layoutRow(items, block, grid, y)) {
                keys.push({ ...k, row: r, sourceRow, i: keys.length });
            }
        }
    });

    // Артборд: если раскладка несёт измеренный размер — берём его, иначе симметричное поле
    // по отступу первой клавиши. `fit` всегда расчётный, для кнопки «обрезать по содержимому».
    const right = Math.max(...keys.map((k) => k.x + k.w));
    const bottom = Math.max(...keys.map((k) => k.y + k.h));
    const fit = { w: right + grid.origin.x, h: bottom + grid.origin.y };
    return {
        keys,
        grid,
        bounds: { ...(layout.artboard || fit), fit }
    };
}

/** Ширина клавиши в юнитах — для инспектора. Дробное значение здесь норма, см. § 11.1. */
export const widthInU = (w, grid) => (w + gapOf(grid)) / grid.colPitch;
