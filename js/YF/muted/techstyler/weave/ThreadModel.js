/**
 * ThreadModel — the abstraction the renderer draws from.
 *
 * v1 represents a single-layer weave as a binary matrix (1 = warp over weft).
 * The renderer, however, never touches the matrix directly: it asks a *model*
 * `warpOnTop(x, y)`. This indirection is deliberate — a later version can replace
 * the matrix with a generalised graph of threads and crossings by implementing
 * the same tiny interface, without changing PatternRenderer at all.
 *
 * @typedef {Object} ThreadModel
 * @property {number} cols              rapport width
 * @property {number} rows             rapport height
 * @property {(x:number, y:number) => boolean} warpOnTop  face thread at a crossing
 */

import { mod } from './mathUtils.js';

/**
 * Wrap a binary rapport matrix in the ThreadModel interface. Indices wrap, so the
 * model is infinite and seamless — callers can ask for any (x, y).
 * @param {number[][]} matrix
 * @returns {ThreadModel}
 */
export function matrixModel(matrix) {
    const rows = matrix.length;
    const cols = rows ? matrix[0].length : 0;
    return {
        cols,
        rows,
        warpOnTop(x, y) {
            if (rows === 0 || cols === 0) return false;
            return matrix[mod(y, rows)][mod(x, cols)] === 1;
        }
    };
}
