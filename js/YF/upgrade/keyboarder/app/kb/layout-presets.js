export const LCAKB21 = {
    meta: {
        name: 'LCAKB21',
        formFactor: 'compact 78',
        source: 'svg-blueprint',
        layoutProfile: 'ANSI_COMPACT_78'
    },
    grid: {
        colPitch: 53.855,
        rowPitch: 53.5147,
        keyWidth1U: 46.4901,
        keyHeight: 46.1932,
        cornerRadius: 3.3461,
        guideInset: 6.6093,
        origin: { x: 5.1003, y: 5.9137 }
    },
    blocks: [
        { id: 'main', x: 5.1003, width: 771.8564 }
    ],
    rows: [
        {
            main: [
                { w: 71.717, id: 'esc' },
                { u: 1, repeat: 13, ids: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'f13'] }
            ]
        },
        {
            main: [
                { u: 1, repeat: 13, ids: ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal'] },
                { w: 71.7167, id: 'backspace' }
            ]
        },
        {
            main: [
                { w: 71.717, id: 'tab' },
                { u: 1, repeat: 13, ids: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash'] }
            ]
        },
        {
            main: [
                { w: 85.0409, id: 'caps' },
                { u: 1, repeat: 11, ids: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote'] },
                { w: 87.0246, id: 'enter' }
            ]
        },
        {
            main: [
                { w: 104.8826, id: 'lshift' },
                { u: 1, repeat: 10, ids: ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash'] },
                { w: 121.0376, id: 'rshift' }
            ]
        },
        {
            main: [
                { w: 78.8046, id: 'lctrl' },
                { u: 1, repeat: 3, ids: ['lmeta', 'lalt', 'fn-left'] },
                { w: 254.8332, id: 'space' },
                { u: 1, repeat: 3, ids: ['ralt', 'fn-right', 'left'] },
                {
                    u: 1,
                    id: 'arrow-stack',
                    stack: [
                        { yOffset: 0, h: 22.5339, id: 'up', editId: '5:main:8:stack0' },
                        { yOffset: 23.659, h: 22.5342, id: 'down', editId: '5:main:8:stack1' }
                    ],
                    editId: '5:main:8'
                },
                { u: 1, id: 'right' }
            ]
        }
    ]
};

export const WORK_2_S_UPDATE = {
    meta: {
        name: 'WORK_2_S_UPDATE',
        label: 'Work 2.0 S Update',
        formFactor: 'compact 78',
        source: 'svg-blueprint-paths',
        layoutProfile: 'ANSI_COMPACT_78'
    },
    grid: {
        colPitch: 53.86,
        rowPitch: 53.86,
        keyWidth1U: 46.4882,
        keyHeight: 46.4882,
        cornerRadius: 3.4016,
        guideInset: 6.6515,
        origin: { x: 1.4659, y: 1.47 }
    },
    blocks: [
        { id: 'main', x: 1.4659, width: 771.8882 }
    ],
    rows: [
        {
            main: [
                { w: 71.71, id: 'esc' },
                { u: 1, repeat: 13, ids: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'f13'] }
            ]
        },
        {
            main: [
                { u: 1, repeat: 13, ids: ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal'] },
                { w: 71.7264, id: 'backspace' }
            ]
        },
        {
            main: [
                { w: 71.7282, id: 'tab' },
                { u: 1, repeat: 13, ids: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash'] }
            ]
        },
        {
            main: [
                { w: 85.0382, id: 'caps' },
                { u: 1, repeat: 11, ids: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote'] },
                { w: 87.0282, id: 'enter' }
            ]
        },
        {
            main: [
                { w: 104.8782, id: 'lshift' },
                { u: 1, repeat: 10, ids: ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash'] },
                { w: 121.0482, id: 'rshift' }
            ]
        },
        {
            main: [
                { w: 78.7983, id: 'lctrl' },
                { u: 1, repeat: 3, ids: ['lmeta', 'lalt', 'fn-left'] },
                { w: 254.8282, id: 'space' },
                { u: 1, repeat: 3, ids: ['ralt', 'fn-right', 'left'] },
                {
                    u: 1,
                    id: 'arrow-stack',
                    stack: [
                        { yOffset: 0, h: 22.48, id: 'up', editId: '5:main:8:stack0' },
                        { yOffset: 23.8099, h: 22.6801, id: 'down', editId: '5:main:8:stack1' }
                    ],
                    editId: '5:main:8'
                },
                { u: 1, id: 'right' }
            ]
        }
    ]
};

export const LCAKB22 = {
    meta: {
        name: 'LCAKB22',
        formFactor: 'nav 89',
        source: 'svg-blueprint',
        layoutProfile: 'ANSI_NAV_89'
    },
    grid: {
        colPitch: 53.8565,
        rowPitch: 53.5092,
        keyWidth1U: 46.4888,
        keyHeight: 46.1886,
        cornerRadius: 3.3598,
        guideInset: 6.6087,
        origin: { x: 5.1074, y: 5.9193 }
    },
    blocks: [
        { id: 'main', x: 5.1074, width: 771.8805 },
        { id: 'nav', x: 788.8925, width: 154.2072 }
    ],
    rows: [
        {
            main: [
                { w: 71.7188, id: 'esc' },
                { u: 1, repeat: 13, ids: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'f13'] }
            ],
            nav: [{ u: 1, repeat: 3, ids: ['print', 'scroll', 'pause'] }]
        },
        {
            main: [
                { u: 1, repeat: 13, ids: ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal'] },
                { w: 71.719, id: 'backspace' }
            ],
            nav: [{ u: 1, repeat: 3, ids: ['insert', 'home', 'pg-up'] }]
        },
        {
            main: [
                { w: 71.7188, id: 'tab' },
                { u: 1, repeat: 13, ids: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash'] }
            ],
            nav: [{ u: 1, repeat: 3, ids: ['delete', 'end', 'pg-down'] }]
        },
        {
            main: [
                { w: 85.0392, id: 'caps' },
                { u: 1, repeat: 11, ids: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote'] },
                { w: 87.0252, id: 'enter' }
            ]
        },
        {
            main: [
                { w: 104.8823, id: 'lshift' },
                { u: 1, repeat: 10, ids: ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash'] },
                { w: 121.0436, id: 'rshift' }
            ],
            nav: [{ skip: 1 }, { u: 1, id: 'up' }]
        },
        {
            main: [
                { w: 78.8018, id: 'lctrl' },
                { u: 1, repeat: 3, ids: ['lmeta', 'lalt', 'fn-left'] },
                { w: 254.8378, id: 'space' },
                { u: 1, repeat: 3, ids: ['ralt', 'fn-right', 'menu'] },
                { u: 2, id: 'rctrl' }
            ],
            nav: [{ u: 1, repeat: 3, ids: ['left', 'down', 'right'] }]
        }
    ]
};
