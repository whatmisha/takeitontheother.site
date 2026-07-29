/**
 * Библиотека раскладок.
 *
 * Раскладка описывается декларативно: сетка, блоки и состав рядов. Абсолютные координаты клавиш
 * из этого выводятся (см. grid.js), а не хранятся — так правка ряда не требует пересчёта руками.
 *
 * Числа сверены с reference/lcakb23/LCAKB23.svg в его текущем состоянии. Константы в docs/project/PIPELINE.md § 14 относятся
 * к более раннему сохранению файла и отстают на иллюстраторский сдвиг +0.4993827 по обеим осям
 * (§ 12.2). Источник истины по координатам — этот файл.
 */

export const LCAKB23 = {
    meta: { name: 'LCAKB23', formFactor: '96%' },

    grid: {
        // Четыре независимых числа. По X макет круглый в миллиметрах (шаг 19, клавиша 16.4,
        // зазор 2.6, радиус 1.18), по Y сжат на 0.648 % — воспроизводим как есть, решение 1
        // в docs/project/TOOL_PLAN.md. Связывать оси одним «размером юнита» нельзя.
        colPitch: 53.8609619,
        rowPitch: 53.5120668,
        keyWidth1U: 46.4941101,
        keyHeight: 46.1885376,
        cornerRadius: 3.3448819,
        guideInset: 6.6085,
        origin: { x: 5.6007690, y: 6.4139000 }
    },

    /**
     * Блоки слева направо. Разрыв между блоками — 11.88 px против обычного зазора 7.367,
     * то есть 1.61 зазора; именно по этому признаку блоки и разделяются при распознавании.
     * `width` нужен там, где в ряду есть `flex`.
     */
    blocks: [
        { id: 'main', x: 5.6007690, width: 771.9141236 },
        { id: 'nav', x: 789.3973389, width: 154.2160644 },   // 3U
        { id: 'numpad', x: 955.4957886, width: 208.0770874 } // 4U
    ],

    /**
     * Состав рядов. Семантика — в grid.js:
     *   u        ширина в юнитах: n·colPitch − gap
     *   w        явная ширина в px
     *   flex     забрать всю недостающую ширину, чтобы ряд точно заполнил блок
     *   repeat   повторить элемент n раз
     *   ids      имена отдельных клавиш внутри repeat
     *   rowSpan  высота на n рядов: keyHeight + (n−1)·rowPitch
     *   skip     пропустить n колонок, не рисуя клавишу
     *
     * Все шесть рядов блока main заполняют его ровно — проверено, невязка 0.0002 px. Поэтому
     * в каждом ряду **ровно одна** клавиша помечена `flex` и забирает остаток: она и получается
     * «некруглой». Так при любой правке состава ряда ширины пересчитываются сами. Это прямое
     * следствие § 11.1 docs/project/PIPELINE.md: ширины клавиш не кратны U, их нельзя хардкодить.
     *
     * Больше одной `flex` в ряду недопустимо — остаток тогда пришлось бы делить произвольно.
     */
    rows: [
        {   // F-ряд: esc забирает остаток
            main: [{ flex: true, id: 'esc' }, { u: 1, repeat: 13 }],
            nav: [{ u: 1, repeat: 3 }],
            numpad: [{ u: 1, repeat: 4 }]
        },
        {   // цифровой ряд: backspace забирает остаток
            main: [{ u: 1, repeat: 13 }, { flex: true, id: 'backspace' }],
            nav: [{ u: 1, repeat: 3 }],
            numpad: [{ u: 1, repeat: 4 }]
        },
        {   // QWERTY: tab забирает остаток
            main: [{ flex: true, id: 'tab' }, { u: 1, repeat: 13 }],
            nav: [{ u: 1, repeat: 3 }],
            numpad: [{ u: 1, repeat: 3 }, { u: 1, rowSpan: 2, id: 'numpad-plus' }]
        },
        {   // ASDF: caps задан явно, enter забирает остаток
            main: [{ w: 85.0435640, id: 'caps' }, { u: 1, repeat: 11 }, { flex: true, id: 'enter' }],
            numpad: [{ u: 1, repeat: 3 }]
        },
        {   // ZXCV: левый shift задан явно, правый забирает остаток
            main: [{ w: 104.8870700, id: 'lshift' }, { u: 1, repeat: 10 }, { flex: true, id: 'rshift' }],
            nav: [{ skip: 1 }, { u: 1, id: 'up' }],
            numpad: [{ u: 1, repeat: 3 }, { u: 1, rowSpan: 2, id: 'numpad-enter' }]
        },
        {   // модификаторы: пробел забирает остаток, правый ctrl — ровно 2U
            main: [
                { w: 78.8082730, id: 'lctrl' }, { u: 1, repeat: 3 },
                { flex: true, id: 'space' },
                { u: 1, repeat: 3 }, { u: 2, id: 'rctrl' }
            ],
            nav: [{ u: 1, repeat: 3 }],
            // Четвёртую колонку занимает enter, растянутый из ряда 4, поэтому здесь её нет.
            numpad: [{ u: 2, id: 'numpad-0' }, { u: 1, id: 'numpad-delete' }]
        }
    ],

    /**
     * Артборд эталона. Не выводится из габарита клавиш: у Illustrator поле снизу на 2.11 px
     * больше, чем сверху (5.60 / 6.41 / 5.61 / 8.53 при обходе слева-сверху). Часть этого —
     * учёт обводки при сохранении, § 12.2. Храним как измерено, чтобы экспорт совпадал с
     * эталоном побитово; расчётный габарит доступен как `bounds.fit`.
     */
    artboard: { w: 1169.1846855, h: 328.6893243 }
};

const BASE_GRID = LCAKB23.grid;
const BASE_GAP = BASE_GRID.colPitch - BASE_GRID.keyWidth1U;
const BLOCK_GAP = LCAKB23.blocks[1].x - (LCAKB23.blocks[0].x + LCAKB23.blocks[0].width);

function cloneGrid() {
    return {
        ...BASE_GRID,
        origin: { ...BASE_GRID.origin }
    };
}

function u(n) {
    return n * BASE_GRID.colPitch - BASE_GAP;
}

function block(id, x, units) {
    return { id, x, width: u(units) };
}

function after(blockSpec) {
    return blockSpec.x + blockSpec.width + BLOCK_GAP;
}

function layout(name, formFactor, blocks, rows) {
    return {
        meta: { name, formFactor },
        grid: cloneGrid(),
        blocks,
        rows
    };
}

const TKL_MAIN = block('main', BASE_GRID.origin.x, 15);
const TKL_NAV = block('nav', after(TKL_MAIN), 3);

const ANSI_TKL_ROWS = [
    {
        main: [{ u: 1, id: 'esc' }, { skip: 1 }, { u: 1, repeat: 4 }, { skip: 0.5 }, { u: 1, repeat: 4 }, { skip: 0.5 }, { u: 1, repeat: 4 }],
        nav: [{ u: 1, repeat: 3 }]
    },
    {
        main: [{ u: 1, repeat: 13 }, { u: 2, id: 'backspace' }],
        nav: [{ u: 1, repeat: 3 }]
    },
    {
        main: [{ u: 1.5, id: 'tab' }, { u: 1, repeat: 12 }, { u: 1.5, id: 'backslash' }],
        nav: [{ u: 1, repeat: 3 }]
    },
    {
        main: [{ u: 1.75, id: 'caps' }, { u: 1, repeat: 11 }, { u: 2.25, id: 'enter' }]
    },
    {
        main: [{ u: 2.25, id: 'lshift' }, { u: 1, repeat: 10 }, { u: 2.75, id: 'rshift' }],
        nav: [{ skip: 1 }, { u: 1, id: 'up' }]
    },
    {
        main: [
            { u: 1.25, id: 'lctrl' }, { u: 1.25, repeat: 2 }, { u: 6.25, id: 'space' },
            { u: 1.25, repeat: 4 }
        ],
        nav: [{ u: 1, repeat: 3 }]
    }
];

const ANSI_TKL = layout('ANSI_TKL', 'TKL', [TKL_MAIN, TKL_NAV], ANSI_TKL_ROWS);

const ISO_TKL = layout('ISO_TKL', 'ISO TKL', [TKL_MAIN, TKL_NAV], [
    ANSI_TKL_ROWS[0],
    ANSI_TKL_ROWS[1],
    {
        main: [{ u: 1.5, id: 'tab' }, { u: 1, repeat: 12 }, { u: 1, id: 'iso-extra' }],
        nav: [{ u: 1, repeat: 3 }]
    },
    {
        main: [{ u: 1.75, id: 'caps' }, { u: 1, repeat: 11 }, { u: 1.5, id: 'iso-enter' }]
    },
    {
        main: [{ u: 1.25, id: 'lshift' }, { u: 1, id: 'iso-backslash' }, { u: 1, repeat: 10 }, { u: 2.75, id: 'rshift' }],
        nav: [{ skip: 1 }, { u: 1, id: 'up' }]
    },
    ANSI_TKL_ROWS[5]
]);

const COMPACT_MAIN = block('main', BASE_GRID.origin.x, 14);
const COMPACT_NAV = block('nav', after(COMPACT_MAIN), 1);

const ANSI_65 = layout('ANSI_65', '65%', [COMPACT_MAIN, COMPACT_NAV], [
    {
        main: [{ u: 1, repeat: 13 }, { u: 1, id: 'backspace' }],
        nav: [{ u: 1, id: 'home' }]
    },
    {
        main: [{ u: 1.5, id: 'tab' }, { u: 1, repeat: 11 }, { u: 1.5, id: 'backslash' }],
        nav: [{ u: 1, id: 'page-up' }]
    },
    {
        main: [{ u: 1.75, id: 'caps' }, { u: 1, repeat: 10 }, { u: 2.25, id: 'enter' }],
        nav: [{ u: 1, id: 'page-down' }]
    },
    {
        main: [{ u: 2.25, id: 'lshift' }, { u: 1, repeat: 9 }, { u: 2.75, id: 'rshift' }],
        nav: [{ u: 1, id: 'up' }]
    },
    {
        main: [
            { u: 1.25, id: 'lctrl' }, { u: 1.25, repeat: 2 }, { u: 6.25, id: 'space' },
            { u: 1.25, repeat: 3 }, { u: 1, id: 'fn' }
        ],
        nav: [{ u: 1, id: 'right' }]
    }
]);

const ANSI_60 = layout('ANSI_60', '60%', [COMPACT_MAIN], [
    { main: [{ u: 1, repeat: 13 }, { u: 1, id: 'backspace' }] },
    { main: [{ u: 1.5, id: 'tab' }, { u: 1, repeat: 11 }, { u: 1.5, id: 'backslash' }] },
    { main: [{ u: 1.75, id: 'caps' }, { u: 1, repeat: 10 }, { u: 2.25, id: 'enter' }] },
    { main: [{ u: 2.25, id: 'lshift' }, { u: 1, repeat: 9 }, { u: 2.75, id: 'rshift' }] },
    {
        main: [
            { u: 1.25, id: 'lctrl' }, { u: 1.25, repeat: 2 }, { u: 6.25, id: 'space' },
            { u: 1.25, repeat: 3 }, { u: 1, id: 'fn' }
        ]
    }
]);

export const LAYOUTS = {
    [LCAKB23.meta.name]: LCAKB23,
    [ANSI_TKL.meta.name]: ANSI_TKL,
    [ISO_TKL.meta.name]: ISO_TKL,
    [ANSI_65.meta.name]: ANSI_65,
    [ANSI_60.meta.name]: ANSI_60
};

export const LAYOUT_OPTIONS = [
    { id: LCAKB23.meta.name, label: 'LCAKB23 · ANSI 96%' },
    { id: ANSI_TKL.meta.name, label: 'ANSI TKL' },
    { id: ISO_TKL.meta.name, label: 'ISO TKL' },
    { id: ANSI_65.meta.name, label: 'ANSI 65%' },
    { id: ANSI_60.meta.name, label: 'ANSI 60%' }
];
