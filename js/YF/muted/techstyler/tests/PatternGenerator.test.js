import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    generatePlain, generateBasket, generateTwill, generateSatin, generate
} from '../weave/PatternGenerator.js';
import { Family, Faced } from '../weave/PatternSpec.js';

/** Sum of every cell — handy for balance checks. */
const sum = (m) => m.reduce((a, row) => a + row.reduce((b, v) => b + v, 0), 0);
/** One binding point per row and per column? (used for satin) */
function onePerRowAndColumn(m, bindVal) {
    const n = m.length;
    const colCount = new Array(n).fill(0);
    for (let y = 0; y < n; y++) {
        let rowCount = 0;
        for (let x = 0; x < n; x++) {
            if (m[y][x] === bindVal) { rowCount++; colCount[x]++; }
        }
        if (rowCount !== 1) return false;
    }
    return colCount.every((c) => c === 1);
}

test('plain weave is the checkerboard', () => {
    const m = generatePlain({ rows: 2, cols: 2, phase: 0 });
    assert.deepEqual(m, [[0, 1], [1, 0]]);
});

test('plain phase flips parity', () => {
    const m = generatePlain({ rows: 2, cols: 2, phase: 1 });
    assert.deepEqual(m, [[1, 0], [0, 1]]);
});

test('plain uses positive modulo formula (x+y+phase)%2', () => {
    const rows = 4, cols = 4, phase = 3;
    const m = generatePlain({ rows, cols, phase });
    for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
            assert.equal(m[y][x], (x + y + phase) % 2);
});

test('basket 2x2 forms 2x2 blocks', () => {
    const m = generateBasket({ warpGroup: 2, weftGroup: 2, phase: 0 });
    assert.equal(m.length, 4);
    assert.equal(m[0].length, 4);
    assert.deepEqual(m[0], [0, 0, 1, 1]);
    assert.deepEqual(m[1], [0, 0, 1, 1]);
    assert.deepEqual(m[2], [1, 1, 0, 0]);
    assert.deepEqual(m[3], [1, 1, 0, 0]);
});

test('basket matches floor-group formula', () => {
    const wg = 3, fg = 2, phase = 1;
    const m = generateBasket({ warpGroup: wg, weftGroup: fg, phase });
    for (let y = 0; y < m.length; y++)
        for (let x = 0; x < m[0].length; x++)
            assert.equal(m[y][x], (Math.floor(x / wg) + Math.floor(y / fg) + phase) % 2);
});

test('twill 2/2 base row and diagonal shift', () => {
    const m = generateTwill({ over: 2, under: 2, step: 1, direction: 1 });
    assert.equal(m.length, 4);
    assert.deepEqual(m[0], [1, 1, 0, 0]);
    // each row shifted right by 1
    assert.deepEqual(m[1], [0, 1, 1, 0]);
    assert.deepEqual(m[2], [0, 0, 1, 1]);
    assert.deepEqual(m[3], [1, 0, 0, 1]);
});

test('twill warp count equals over per row (balance preserved by shifting)', () => {
    const over = 3, under = 1;
    const m = generateTwill({ over, under, step: 1, direction: 1 });
    for (const row of m) assert.equal(row.reduce((a, b) => a + b, 0), over);
});

test('twill S vs Z are horizontal mirrors of the diagonal', () => {
    const z = generateTwill({ over: 2, under: 1, step: 1, direction: 1 });
    const s = generateTwill({ over: 2, under: 1, step: 1, direction: -1 });
    // row 1 of Z shifted +1, of S shifted -1 from row 0
    assert.deepEqual(z[0], s[0]);
    assert.notDeepEqual(z[1], s[1]);
});

test('satin places one binding point per row and column', () => {
    const m = generateSatin({ n: 5, step: 2, faced: Faced.WARP });
    assert.equal(m.length, 5);
    assert.ok(onePerRowAndColumn(m, 0)); // warp-faced → binding points are weft (0)
});

test('satin warp-faced is mostly warp, weft-faced is its inverse', () => {
    const warp = generateSatin({ n: 5, step: 2, faced: Faced.WARP });
    const weft = generateSatin({ n: 5, step: 2, faced: Faced.WEFT });
    assert.equal(sum(warp), 5 * 5 - 5); // 20 warp cells, 5 binding points
    assert.equal(sum(weft), 5);         // inverse
    for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++)
            assert.equal(warp[y][x], weft[y][x] ^ 1);
});

test('satin throws when step not coprime with n', () => {
    assert.throws(() => generateSatin({ n: 6, step: 2 }));
    assert.throws(() => generateSatin({ n: 6, step: 3 }));
    assert.doesNotThrow(() => generateSatin({ n: 6, step: 5 }));
});

test('generate dispatches by family', () => {
    assert.deepEqual(generate({ family: Family.PLAIN }), generatePlain({ rows: 2, cols: 2, phase: 0 }));
    const t = generate({ family: Family.TWILL, over: 2, under: 2, step: 1, direction: 1, phase: 0 });
    assert.deepEqual(t[0], [1, 1, 0, 0]);
});
