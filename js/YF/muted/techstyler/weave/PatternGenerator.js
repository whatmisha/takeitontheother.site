/**
 * PatternGenerator — turns a PatternSpec into a binary rapport matrix.
 *
 * Pure functions only: no DOM, no UI, no colours. Each generator returns
 * `matrix[y][x]` where 1 = warp over weft, 0 = weft over warp. All cyclic
 * indexing uses the always-positive `mod` so phases/shifts can be negative.
 *
 * These four families are the only structures in v1 (no multi-layer, pile or
 * leno weaves). New families are added here and nowhere else.
 */

import { mod, areCoprime } from './mathUtils.js';
import { Family, Faced, normalizeSpec, repeatSize } from './PatternSpec.js';

/**
 * Plain weave: matrix[y][x] = (x + y + phase) mod 2.
 * @param {{rows?:number, cols?:number, phase?:number}} opts
 * @returns {number[][]}
 */
export function generatePlain({ rows = 2, cols = 2, phase = 0 } = {}) {
    const m = [];
    for (let y = 0; y < rows; y++) {
        const row = new Array(cols);
        for (let x = 0; x < cols; x++) {
            row[x] = mod(x + y + phase, 2);
        }
        m.push(row);
    }
    return m;
}

/**
 * Basket weave: matrix[y][x] =
 *   (floor(x / warpGroup) + floor(y / weftGroup) + phase) mod 2.
 * @param {{warpGroup?:number, weftGroup?:number, phase?:number, rows?:number, cols?:number}} opts
 * @returns {number[][]}
 */
export function generateBasket({ warpGroup = 2, weftGroup = 2, phase = 0, rows, cols } = {}) {
    const wg = Math.max(1, Math.trunc(warpGroup));
    const fg = Math.max(1, Math.trunc(weftGroup));
    const R = rows ?? 2 * fg;
    const C = cols ?? 2 * wg;
    const m = [];
    for (let y = 0; y < R; y++) {
        const row = new Array(C);
        for (let x = 0; x < C; x++) {
            row[x] = mod(Math.floor(x / wg) + Math.floor(y / fg) + phase, 2);
        }
        m.push(row);
    }
    return m;
}

/**
 * Twill weave. Build a base sequence of `over` ones followed by `under` zeros,
 * then shift each following row cyclically by `direction * step`.
 *
 *   base[i] = i < over ? 1 : 0          (length = over + under)
 *   matrix[y][x] = base[(x - direction*step*y - phase) mod len]
 *
 * @param {{over?:number, under?:number, step?:number, direction?:number, phase?:number}} opts
 * @returns {number[][]}
 */
export function generateTwill({ over = 2, under = 2, step = 1, direction = 1, phase = 0 } = {}) {
    const o = Math.max(1, Math.trunc(over));
    const u = Math.max(1, Math.trunc(under));
    const len = o + u;
    const dir = direction < 0 ? -1 : 1;
    const base = (i) => (mod(i, len) < o ? 1 : 0);

    const m = [];
    for (let y = 0; y < len; y++) {
        const shift = dir * step * y + phase;
        const row = new Array(len);
        for (let x = 0; x < len; x++) {
            row[x] = base(mod(x - shift, len));
        }
        m.push(row);
    }
    return m;
}

/**
 * Satin weave on a square rapport of size n. Place exactly one binding point in
 * every row and every column at x = (phase + y * step) mod n. Requires
 * gcd(step, n) === 1, otherwise the points would not spread across all columns.
 *
 * warp-faced: face is warp (1) with isolated weft binding points (0).
 * weft-faced: face is weft (0) with isolated warp binding points (1).
 *
 * @param {{n?:number, step?:number, phase?:number, faced?:string}} opts
 * @returns {number[][]}
 * @throws {Error} when gcd(step, n) !== 1
 */
export function generateSatin({ n = 5, step = 2, phase = 0, faced = Faced.WARP } = {}) {
    const size = Math.max(2, Math.trunc(n));
    const s = Math.trunc(step);
    if (!areCoprime(s, size)) {
        throw new Error(`generateSatin: step ${s} must be coprime with n ${size} (gcd !== 1)`);
    }
    const warpFaced = faced !== Faced.WEFT;
    const faceVal = warpFaced ? 1 : 0;
    const bindVal = warpFaced ? 0 : 1;

    const m = Array.from({ length: size }, () => new Array(size).fill(faceVal));
    for (let y = 0; y < size; y++) {
        const x = mod(phase + y * s, size);
        m[y][x] = bindVal;
    }
    return m;
}

/**
 * Dispatch: build the rapport matrix for any spec. The single entry point the
 * rest of the app uses, so callers never branch on family themselves.
 * @param {Object} spec
 * @returns {number[][]}
 */
export function generate(spec) {
    const s = normalizeSpec(spec);
    const { rows, cols } = repeatSize(s);
    switch (s.family) {
        case Family.PLAIN:
            return generatePlain({ rows, cols, phase: s.phase });
        case Family.BASKET:
            return generateBasket({ warpGroup: s.warpGroup, weftGroup: s.weftGroup, phase: s.phase });
        case Family.TWILL:
            return generateTwill({ over: s.over, under: s.under, step: s.step, direction: s.direction, phase: s.phase });
        case Family.SATIN:
            return generateSatin({ n: s.n, step: s.satinStep, phase: s.phase, faced: s.faced });
        default:
            return generatePlain({ rows, cols, phase: s.phase });
    }
}
