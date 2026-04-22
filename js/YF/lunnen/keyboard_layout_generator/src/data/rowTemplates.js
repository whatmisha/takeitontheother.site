/**
 * rowTemplates.js
 *
 * Declarative keyboard layout definitions.
 *
 * Each device template is an array of ROW objects:
 *   { id, keys[], gapBefore? }
 *
 * Each KEY object:
 *   {
 *     id        - unique identifier (used for icons, labels, overrides)
 *     w         - width multiplier relative to baseKeyWidth (default 1)
 *     h         - height multiplier relative to baseKeyHeight (default 1, fn-row uses fnRowH)
 *     kind      - 'char' | 'special' | 'function' | 'arrow-half' | 'spacer'
 *     label     - short text label for special keys (rendered in label font size)
 *     icon      - icon id from icons.js (optional)
 *     chars     - { base, shift, lang1, lang2 } character definitions (for 'char' keys)
 *   }
 *
 * Width multipliers are stored as ratios; the layout engine converts them
 * to absolute mm using the current baseKeyWidth slider value.
 *
 * The fn-row uses a shorter height (fnRowH setting). The gap between the
 * fn-row and the number row is gapFnRow (a separate setting).
 *
 * Key width ratios for laptop-14 computed from ground_14.svg (6-decimal precision,
 * required to reproduce the example's exact mm dimensions on export):
 *   base key:   47.6400146 pt -> 16.8063 mm
 *   tab:        67.8134921 pt -> 1.423457
 *   backslash:  68.4380699 pt -> 1.436567
 *   caps:       81.0000000 pt -> 1.700251
 *   enter:     107.3174034 pt -> 2.252674
 *   shift-L:   107.8800049 pt -> 2.264483
 *   shift-R:   132.5178429 pt -> 2.781650
 *   backspace:  88.8894653 pt -> 1.865857
 *   ctrl-L:     68.1331794 pt -> 1.430167
 *   ctrl-R:     67.5944889 pt -> 1.418860
 *   space:     256.5957550 pt -> 5.386139
 *   fn-key:     43.8660533 pt -> 0.920782
 */

// ---------------------------------------------------------------------------
// Shared key definitions reused across templates
// ---------------------------------------------------------------------------

const FN_W = 0.920782;  // 43.8660533 pt / 47.6400146 pt

const ESC   = { id: 'esc',   kind: 'function', w: FN_W, label: 'esc', icon: 'fn_lock' };
const F1    = { id: 'f1',    kind: 'function', w: FN_W, label: 'F1',  icon: 'sound_mute' };
const F2    = { id: 'f2',    kind: 'function', w: FN_W, label: 'F2',  icon: 'sound_down' };
const F3    = { id: 'f3',    kind: 'function', w: FN_W, label: 'F3',  icon: 'sound_up' };
const F4    = { id: 'f4',    kind: 'function', w: FN_W, label: 'F4',  icon: 'mic_mute' };
const F5    = { id: 'f5',    kind: 'function', w: FN_W, label: 'F5',  icon: 'keyboard_light' };
const F6    = { id: 'f6',    kind: 'function', w: FN_W, label: 'F6',  icon: 'screen_brightness_down' };
const F7    = { id: 'f7',    kind: 'function', w: FN_W, label: 'F7',  icon: 'screen_brightness_up' };
const F8    = { id: 'f8',    kind: 'function', w: FN_W, label: 'F8',  icon: 'monitor' };
const F9    = { id: 'f9',    kind: 'function', w: FN_W, label: 'F9',  icon: 'touchpad_on_off' };
const F10   = { id: 'f10',   kind: 'function', w: FN_W, label: 'F10' };
const F11   = { id: 'f11',   kind: 'function', w: FN_W, label: 'F11' };
const F12   = { id: 'f12',   kind: 'function', w: FN_W, label: 'F12' };
// 14th main fn-key on laptop-14 (Touch ID / power button); carries the
// printscreen icon per ground_14.svg.
const TOUCHID = { id: 'touchid', kind: 'function', w: FN_W, label: '', icon: 'printscreen' };

// Number row
const GRAVE = { id: 'grave', kind: 'char', chars: { base: '`', shift: '~', ru: '\u0401' } };  // Yo
const K1    = { id: 'k1',    kind: 'char', chars: { base: '1', shift: '!', ruShift: '\u2116' } }; // No sign
const K2    = { id: 'k2',    kind: 'char', chars: { base: '2', shift: '@', ruShift: '"' } };
const K3    = { id: 'k3',    kind: 'char', chars: { base: '3', shift: '#', ruShift: '\u2116' } };
const K4    = { id: 'k4',    kind: 'char', chars: { base: '4', shift: '$', ruShift: ';' } };
const K5    = { id: 'k5',    kind: 'char', chars: { base: '5', shift: '%' } };
const K6    = { id: 'k6',    kind: 'char', chars: { base: '6', shift: '^', ruShift: ':' } };
const K7    = { id: 'k7',    kind: 'char', chars: { base: '7', shift: '&', ruShift: '?' } };
const K8    = { id: 'k8',    kind: 'char', chars: { base: '8', shift: '*' } };
const K9    = { id: 'k9',    kind: 'char', chars: { base: '9', shift: '(' } };
const K0    = { id: 'k0',    kind: 'char', chars: { base: '0', shift: ')' } };
const MINUS = { id: 'minus', kind: 'char', chars: { base: '-', shift: '\u2014' } }; // em-dash
const EQUAL = { id: 'equal', kind: 'char', chars: { base: '=', shift: '+' } };
const BACKSPACE = { id: 'backspace', kind: 'special', w: 1.865857, label: 'backspace', icon: 'backspace_arrow' };

// QWERTY row
const TAB   = { id: 'tab',   kind: 'special', w: 1.423457, label: 'tab', icon: 'tab_arrow' };
const Q     = { id: 'q',     kind: 'char', chars: { base: 'Q', ru: '\u0419' } }; // J
const W     = { id: 'w',     kind: 'char', chars: { base: 'W', ru: '\u0426' } }; // C
const E     = { id: 'e',     kind: 'char', chars: { base: 'E', ru: '\u0423' } }; // U
const R     = { id: 'r',     kind: 'char', chars: { base: 'R', ru: '\u041a' } }; // K
const T     = { id: 't',     kind: 'char', chars: { base: 'T', ru: '\u0415' } }; // Ye
const Y     = { id: 'y',     kind: 'char', chars: { base: 'Y', ru: '\u041d' } }; // N
const U     = { id: 'u',     kind: 'char', chars: { base: 'U', ru: '\u0413' } }; // G
const I     = { id: 'i',     kind: 'char', chars: { base: 'I', ru: '\u0428' } }; // Sh
const O     = { id: 'o',     kind: 'char', chars: { base: 'O', ru: '\u0429' } }; // Sch
const P     = { id: 'p',     kind: 'char', chars: { base: 'P', ru: '\u0417' } }; // Z
const LBRACKET = { id: 'lbracket', kind: 'char', chars: { base: '[', shift: '{', ru: '\u0425' } }; // H
const RBRACKET = { id: 'rbracket', kind: 'char', chars: { base: ']', shift: '}', ru: '\u042a' } }; // Hard sign
const BACKSLASH = { id: 'backslash', kind: 'char', w: 1.436567, chars: { base: '\\', shift: '|', ru: '/' } };

// ASD row
const CAPS  = { id: 'caps',  kind: 'special', w: 1.700251, label: 'caps lock', icon: 'capslock_indicator' };
const A     = { id: 'a',     kind: 'char', chars: { base: 'A', ru: '\u0424' } }; // F
const S     = { id: 's',     kind: 'char', chars: { base: 'S', ru: '\u042b' } }; // Y
const D     = { id: 'd',     kind: 'char', chars: { base: 'D', ru: '\u0412' } }; // V
const F     = { id: 'f',     kind: 'char', chars: { base: 'F', ru: '\u0410' } }; // A
const G     = { id: 'g',     kind: 'char', chars: { base: 'G', ru: '\u041f' } }; // P
const H     = { id: 'h',     kind: 'char', chars: { base: 'H', ru: '\u0420' } }; // R
const J     = { id: 'j',     kind: 'char', chars: { base: 'J', ru: '\u041e' } }; // O
const K     = { id: 'k',     kind: 'char', chars: { base: 'K', ru: '\u041b' } }; // L
const L     = { id: 'l',     kind: 'char', chars: { base: 'L', ru: '\u0414' } }; // D
const SEMI  = { id: 'semi',  kind: 'char', chars: { base: ';', shift: ':', ru: '\u0416' } }; // Zh
const QUOTE = { id: 'quote', kind: 'char', chars: { base: "'", shift: '"', ru: '\u042d' } }; // E
const ENTER = { id: 'enter', kind: 'special', w: 2.252674, label: 'enter' };

// ZX row
const SHIFT_L = { id: 'shift_l', kind: 'special', w: 2.264483, label: 'shift' };
const Z     = { id: 'z',     kind: 'char', chars: { base: 'Z', ru: '\u042f' } }; // Ya
const X     = { id: 'x',     kind: 'char', chars: { base: 'X', ru: '\u0427' } }; // Ch
const C     = { id: 'c',     kind: 'char', chars: { base: 'C', ru: '\u0421' } }; // S
const V     = { id: 'v',     kind: 'char', chars: { base: 'V', ru: '\u041c' } }; // M
const B     = { id: 'b',     kind: 'char', chars: { base: 'B', ru: '\u0418' } }; // I
const N     = { id: 'n',     kind: 'char', chars: { base: 'N', ru: '\u0422' } }; // T
const M     = { id: 'm',     kind: 'char', chars: { base: 'M', ru: '\u042c' } }; // Soft sign
const COMMA = { id: 'comma', kind: 'char', chars: { base: ',', shift: '<', ru: '\u0411' } }; // B
const DOT   = { id: 'dot',   kind: 'char', chars: { base: '.', shift: '>', ru: '\u042e' } }; // Yu
const SLASH = { id: 'slash', kind: 'char', chars: { base: '/', shift: '?' } };
const SHIFT_R = { id: 'shift_r', kind: 'special', w: 2.781650, label: 'shift' };

// Bottom row
const CTRL_L  = { id: 'ctrl_l',  kind: 'special', w: 1.430167, label: 'ctrl' };
const FN_L    = { id: 'fn_l',    kind: 'special', w: 1.0,      label: 'fn' };
const WIN     = { id: 'win',     kind: 'special', w: 1.0,      label: '',   icon: 'win' };
const ALT_L   = { id: 'alt_l',   kind: 'special', w: 1.0,      label: 'alt' };
const SPACE   = { id: 'space',   kind: 'special', w: 5.386139, label: '' };
const ALT_R   = { id: 'alt_r',   kind: 'special', w: 1.0,      label: 'alt' };
const FN_R    = { id: 'fn_r',    kind: 'special', w: 1.0,      label: 'fn' };
const CTRL_R  = { id: 'ctrl_r',  kind: 'special', w: 1.418860, label: 'ctrl' };

// Arrow cluster (split vertically: up/down are half height)
const ARROW_L  = { id: 'arrow_l',  kind: 'special',    w: 1.0, label: '', icon: 'arrow_left'  };
const ARROW_UP = { id: 'arrow_up', kind: 'arrow-half', w: 1.0,            icon: 'arrow_up'    };
const ARROW_DN = { id: 'arrow_dn', kind: 'arrow-half', w: 1.0,            icon: 'arrow_down'  };
const ARROW_R  = { id: 'arrow_r',  kind: 'special',    w: 1.0, label: '', icon: 'arrow_right' };

// Additional block (right side of laptop-14)
const HOME   = { id: 'home',   kind: 'special', w: 1.0, label: 'home' };
const END    = { id: 'end',    kind: 'special', w: 1.0, label: 'end' };
const PG_UP  = { id: 'pg_up', kind: 'special', w: 1.0, label: 'pg up' };
const PG_DN  = { id: 'pg_dn', kind: 'special', w: 1.0, label: 'pg dn' };
const INSERT = { id: 'insert', kind: 'function', w: 0.921, label: 'insert' };
const DELETE = { id: 'delete', kind: 'function', w: 0.921, label: 'delete' };
const PAUSE  = { id: 'pause',  kind: 'function', w: 0.921, label: 'pause' };

// ---------------------------------------------------------------------------
// Device templates
// ---------------------------------------------------------------------------

/**
 * LAPTOP-14
 * Matches ground_14.svg structure exactly.
 *
 * Row structure (17 keys in fn-row spanning the full keyboard width):
 *   fn-row   : esc F1..F12 touchid pause insert delete     (short height)
 *   numbers  : ` 1..0 - = backspace                 | home
 *   qwerty   : tab Q..P [ ] \                       | end
 *   asd      : caps A..L ; ' enter                  | pg_up
 *   zx       : shift_l Z../ shift_r                 | pg_dn
 *   bottom   : ctrl fn win alt space alt fn ctrl | arrow_l [up/dn] arrow_r
 *
 * The fn-row is placed as a single contiguous row; its 17 narrower keys
 * (0.921 * baseW) naturally fill the full keyboard width (main + additional).
 */
export const LAPTOP_14 = {
    id: 'laptop-14',
    label: 'Laptop 14"',
    hasNumpad:     false,
    hasFnRow:      true,
    hasAdditional: true,
    rows: [
        {
            id: 'fn',
            isFnRow: true,
            keys: [ ESC, F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12,
                    TOUCHID, PAUSE, INSERT, DELETE ]
        },
        {
            id: 'numbers',
            additionalKey: HOME,
            keys: [ GRAVE, K1, K2, K3, K4, K5, K6, K7, K8, K9, K0, MINUS, EQUAL, BACKSPACE ]
        },
        {
            id: 'qwerty',
            additionalKey: END,
            keys: [ TAB, Q, W, E, R, T, Y, U, I, O, P, LBRACKET, RBRACKET, BACKSLASH ]
        },
        {
            id: 'asd',
            additionalKey: PG_UP,
            keys: [ CAPS, A, S, D, F, G, H, J, K, L, SEMI, QUOTE, ENTER ]
        },
        {
            id: 'zx',
            additionalKey: PG_DN,
            keys: [ SHIFT_L, Z, X, C, V, B, N, M, COMMA, DOT, SLASH, SHIFT_R ]
        },
        {
            id: 'bottom',
            arrowCluster: [ ARROW_L, ARROW_UP, ARROW_DN, ARROW_R ],
            keys: [ CTRL_L, FN_L, WIN, ALT_L, SPACE, ALT_R, FN_R, CTRL_R ]
        }
    ]
};

/**
 * LAPTOP-16
 * Like laptop-14 but:
 *   - smaller corner radius (already handled via settings slider)
 *   - has a numpad block on the right (4 cols x 5 rows with double-height + and Enter,
 *     double-width 0)
 *   - no separate additional (home/end/pg_up/pg_dn) column in the main block
 *   - fn-row adds prtsc / scrlk on the right (aligned over the numpad area)
 */

// Numpad cells -- standard 17-key layout:
//   row 0: num-lock  /          *          -
//   row 1:  7        8          9          +   (rowSpan 2)
//   row 2:  4        5          6          (+ continues)
//   row 3:  1        2          3          enter (rowSpan 2)
//   row 4:  0 (colSpan 2)       .          (enter continues)
const NUMPAD_LAPTOP_16 = {
    cols: 4,
    keys: [
        { id: 'num_lock', kind: 'special', col: 0, row: 0, label: 'num' },
        { id: 'np_div',   kind: 'char',    col: 1, row: 0, chars: { base: '/' } },
        { id: 'np_mul',   kind: 'char',    col: 2, row: 0, chars: { base: '*' } },
        { id: 'np_sub',   kind: 'char',    col: 3, row: 0, chars: { base: '-' } },

        { id: 'np7',      kind: 'char',    col: 0, row: 1, chars: { base: '7' } },
        { id: 'np8',      kind: 'char',    col: 1, row: 1, chars: { base: '8' } },
        { id: 'np9',      kind: 'char',    col: 2, row: 1, chars: { base: '9' } },
        { id: 'np_add',   kind: 'char',    col: 3, row: 1, rowSpan: 2, chars: { base: '+' } },

        { id: 'np4',      kind: 'char',    col: 0, row: 2, chars: { base: '4' } },
        { id: 'np5',      kind: 'char',    col: 1, row: 2, chars: { base: '5' } },
        { id: 'np6',      kind: 'char',    col: 2, row: 2, chars: { base: '6' } },

        { id: 'np1',      kind: 'char',    col: 0, row: 3, chars: { base: '1' } },
        { id: 'np2',      kind: 'char',    col: 1, row: 3, chars: { base: '2' } },
        { id: 'np3',      kind: 'char',    col: 2, row: 3, chars: { base: '3' } },
        { id: 'np_enter', kind: 'special', col: 3, row: 3, rowSpan: 2, label: 'enter' },

        { id: 'np0',      kind: 'char',    col: 0, row: 4, colSpan: 2, chars: { base: '0' } },
        { id: 'np_dot',   kind: 'char',    col: 2, row: 4, chars: { base: '.' } }
    ]
};

export const LAPTOP_16 = {
    id: 'laptop-16',
    label: 'Laptop 16"',
    hasNumpad:     true,
    hasFnRow:      true,
    hasAdditional: false,
    rows: [
        {
            id: 'fn',
            isFnRow: true,
            gapAfter: 'fnGap',
            keys: [ ESC, F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12,
                    { id: 'prtsc',  kind: 'function', w: 0.921, label: 'prtsc' },
                    { id: 'scrlk',  kind: 'function', w: 0.921, label: 'scrlk' } ]
        },
        {
            id: 'numbers',
            keys: [ GRAVE, K1, K2, K3, K4, K5, K6, K7, K8, K9, K0, MINUS, EQUAL, BACKSPACE ]
        },
        {
            id: 'qwerty',
            keys: [ TAB, Q, W, E, R, T, Y, U, I, O, P, LBRACKET, RBRACKET, BACKSLASH ]
        },
        {
            id: 'asd',
            keys: [ CAPS, A, S, D, F, G, H, J, K, L, SEMI, QUOTE, ENTER ]
        },
        {
            id: 'zx',
            keys: [ SHIFT_L, Z, X, C, V, B, N, M, COMMA, DOT, SLASH, SHIFT_R ]
        },
        {
            id: 'bottom',
            arrowCluster: [ ARROW_L, ARROW_UP, ARROW_DN, ARROW_R ],
            keys: [ CTRL_L, FN_L, WIN, ALT_L, SPACE, ALT_R, FN_R, CTRL_R ]
        }
    ],
    numpad: NUMPAD_LAPTOP_16
};

export const TEMPLATES = {
    'laptop-14': LAPTOP_14,
    'laptop-16': LAPTOP_16
};

export const DEFAULT_TEMPLATE_ID = 'laptop-14';
