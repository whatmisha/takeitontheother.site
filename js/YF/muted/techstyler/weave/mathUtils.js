/**
 * mathUtils — pure number helpers shared by the weave generators.
 *
 * Framework- and DOM-independent on purpose: this module is imported both by the
 * browser tool and by the Node unit tests. Keep it free of side effects.
 */

/**
 * Always-positive modulo. JavaScript's `%` keeps the sign of the dividend, which
 * breaks cyclic indexing for negative shifts (e.g. twill stepping `x - dir*step*y`).
 * @param {number} n
 * @param {number} m  divisor, must be > 0
 * @returns {number} result in the range [0, m)
 */
export function mod(n, m) {
    if (m <= 0) throw new RangeError(`mod: divisor must be > 0 (got ${m})`);
    return ((n % m) + m) % m;
}

/**
 * Greatest common divisor (Euclid), defined on absolute values.
 * gcd(0, 0) === 0; gcd(a, 0) === |a|.
 */
export function gcd(a, b) {
    a = Math.abs(Math.trunc(a));
    b = Math.abs(Math.trunc(b));
    while (b) {
        [a, b] = [b, a % b];
    }
    return a;
}

/** True when gcd(a, b) === 1 (a and b share no common factor). */
export function areCoprime(a, b) {
    return gcd(a, b) === 1;
}

/** Clamp helper used by spec normalisation. */
export function clampInt(value, min, max) {
    let v = Math.round(Number(value));
    if (!Number.isFinite(v)) v = min;
    return Math.max(min, Math.min(max, v));
}

/**
 * Longest run of `value` in a cyclic array (the rapport repeats seamlessly, so
 * floats can wrap across the tile boundary). Returns the array length when every
 * element equals `value` (a fully floating, unbound thread).
 * @param {Array<number>} arr
 * @param {number} value
 * @returns {number}
 */
export function longestCyclicRun(arr, value) {
    const n = arr.length;
    if (n === 0) return 0;
    if (arr.every((v) => v === value)) return n;

    let best = 0;
    let run = 0;
    // Walk twice round the ring so a run that straddles the seam is measured whole.
    for (let i = 0; i < 2 * n; i++) {
        if (arr[i % n] === value) {
            run++;
            if (run > best) best = run;
        } else {
            run = 0;
        }
    }
    return Math.min(best, n);
}
