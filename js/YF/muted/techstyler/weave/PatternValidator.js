/**
 * PatternValidator — structural analysis and sanity checks for weaves.
 *
 * Two responsibilities, both pure:
 *   1. validateSpec(spec) — can this spec be generated? (e.g. satin coprimality)
 *   2. analyze(matrix)    — structural metrics of a generated rapport
 *                           (float lengths, balance, interlacement / loose threads).
 *
 * "Floats" are measured cyclically because the rapport tiles seamlessly: a warp
 * float is a vertical run of 1s in a column; a weft float is a horizontal run of
 * 0s in a row. Long floats snag in real cloth, so the renderer/UI can warn on them.
 */

import { gcd, areCoprime, longestCyclicRun } from './mathUtils.js';
import { Family, Faced, normalizeSpec, LIMITS } from './PatternSpec.js';

/**
 * @param {Object} spec
 * @returns {{ok:boolean, errors:string[], warnings:string[]}}
 */
export function validateSpec(spec) {
    const s = normalizeSpec(spec);
    const errors = [];
    const warnings = [];

    if (s.family === Family.SATIN) {
        if (s.n < 4) errors.push('Satin needs n \u2265 4.');
        if (!areCoprime(s.satinStep, s.n)) {
            errors.push(`Satin step ${s.satinStep} is not coprime with n=${s.n} (gcd=${gcd(s.satinStep, s.n)}).`);
        }
        if (s.satinStep === 1 || s.satinStep === s.n - 1) {
            warnings.push('Satin step of 1 or n\u22121 degenerates into a twill diagonal.');
        }
    }

    if (s.family === Family.TWILL) {
        const len = s.over + s.under;
        if (gcd(s.step, len) !== 1) {
            warnings.push(`Twill step ${s.step} shares a factor with the rapport (${len}); the diagonal will repeat before filling all rows.`);
        }
    }

    if (s.family === Family.BASKET && (s.warpGroup > 6 || s.weftGroup > 6)) {
        warnings.push('Large basket groups produce long floats that snag easily.');
    }

    return { ok: errors.length === 0, errors, warnings };
}

/**
 * Structural metrics of a rapport matrix.
 * @param {number[][]} matrix
 * @returns {{
 *   rows:number, cols:number, cells:number,
 *   warpCells:number, weftCells:number, warpRatio:number,
 *   maxWarpFloat:number, maxWeftFloat:number,
 *   interlaced:boolean, looseWarps:number[], looseWefts:number[]
 * }}
 */
export function analyze(matrix) {
    const rows = matrix.length;
    const cols = rows ? matrix[0].length : 0;
    const cells = rows * cols;

    let warpCells = 0;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (matrix[y][x] === 1) warpCells++;
        }
    }
    const weftCells = cells - warpCells;

    // Warp float = vertical run of 1s in a column (warp on top).
    let maxWarpFloat = 0;
    const looseWarps = [];
    for (let x = 0; x < cols; x++) {
        const col = new Array(rows);
        for (let y = 0; y < rows; y++) col[y] = matrix[y][x];
        const run = longestCyclicRun(col, 1);
        if (run > maxWarpFloat) maxWarpFloat = run;
        // A warp never caught by a weft (no 0 in its column) floats free.
        if (rows > 0 && col.every((v) => v === 1)) looseWarps.push(x);
    }

    // Weft float = horizontal run of 0s in a row (weft on top).
    let maxWeftFloat = 0;
    const looseWefts = [];
    for (let y = 0; y < rows; y++) {
        const run = longestCyclicRun(matrix[y], 0);
        if (run > maxWeftFloat) maxWeftFloat = run;
        if (cols > 0 && matrix[y].every((v) => v === 0)) looseWefts.push(y);
    }

    return {
        rows,
        cols,
        cells,
        warpCells,
        weftCells,
        warpRatio: cells ? warpCells / cells : 0,
        maxWarpFloat,
        maxWeftFloat,
        interlaced: looseWarps.length === 0 && looseWefts.length === 0,
        looseWarps,
        looseWefts
    };
}

/** Convenience boolean: every warp and weft is bound at least once. */
export function isInterlaced(matrix) {
    return analyze(matrix).interlaced;
}
