/**
 * PatternSpec — the declarative description of a single-layer weave structure.
 *
 * A spec is a plain, JSON-serialisable object. It carries *only* the structural
 * parameters; it knows nothing about colours, thread thickness, rendering or UI.
 * The generators (PatternGenerator) turn a spec into a binary rapport matrix.
 *
 * Binary convention (shared across the whole tool):
 *   1 → warp passes OVER weft (warp on the face)
 *   0 → weft passes OVER warp (weft on the face)
 */

import { clampInt, areCoprime } from './mathUtils.js';

export const Family = Object.freeze({
    PLAIN: 'plain',
    BASKET: 'basket',
    TWILL: 'twill',
    SATIN: 'satin'
});

export const FAMILIES = [Family.PLAIN, Family.BASKET, Family.TWILL, Family.SATIN];

export const Faced = Object.freeze({ WARP: 'warp', WEFT: 'weft' });

/** Inclusive parameter bounds (also used to drive UI sliders). */
export const LIMITS = Object.freeze({
    phase: [0, 64],
    warpGroup: [1, 12],
    weftGroup: [1, 12],
    over: [1, 16],
    under: [1, 16],
    twillStep: [1, 16],
    satinN: [4, 24],
    satinStep: [1, 23]
});

/**
 * A fresh spec with sane defaults for the given family.
 * @param {string} family
 * @returns {Object}
 */
export function defaultSpec(family = Family.PLAIN) {
    const base = {
        family,
        phase: 0,
        // basket
        warpGroup: 2,
        weftGroup: 2,
        // twill
        over: 2,
        under: 2,
        step: 1,
        direction: 1, // +1 → Z twill (rising right), -1 → S twill
        // satin
        n: 5,
        satinStep: 2,
        faced: Faced.WARP
    };
    return base;
}

/**
 * Clamp/repair an arbitrary spec-like object into a valid spec. Never throws —
 * invalid satin steps are nudged to the nearest coprime value so the UI stays live.
 * @param {Object} spec
 * @returns {Object} a new normalised spec
 */
export function normalizeSpec(spec = {}) {
    const family = FAMILIES.includes(spec.family) ? spec.family : Family.PLAIN;
    const out = {
        family,
        phase: clampInt(spec.phase ?? 0, ...LIMITS.phase),
        warpGroup: clampInt(spec.warpGroup ?? 2, ...LIMITS.warpGroup),
        weftGroup: clampInt(spec.weftGroup ?? 2, ...LIMITS.weftGroup),
        over: clampInt(spec.over ?? 2, ...LIMITS.over),
        under: clampInt(spec.under ?? 2, ...LIMITS.under),
        step: clampInt(spec.step ?? 1, ...LIMITS.twillStep),
        direction: Number(spec.direction) < 0 ? -1 : 1,
        n: clampInt(spec.n ?? 5, ...LIMITS.satinN),
        satinStep: clampInt(spec.satinStep ?? 2, ...LIMITS.satinStep),
        faced: spec.faced === Faced.WEFT ? Faced.WEFT : Faced.WARP
    };

    // Satin needs gcd(step, n) === 1. Keep step within [1, n-1] and snap to the
    // nearest coprime so a square satin is always constructible.
    out.satinStep = repairSatinStep(out.satinStep, out.n);
    return out;
}

/**
 * Snap a satin step into [1, n-1] and to the nearest value coprime with n.
 * @param {number} step
 * @param {number} n
 * @returns {number}
 */
export function repairSatinStep(step, n) {
    if (n < 2) return 1;
    let s = ((Math.round(step) - 1) % (n - 1) + (n - 1)) % (n - 1) + 1; // wrap into [1, n-1]
    for (let d = 0; d < n; d++) {
        const up = ((s - 1 + d) % (n - 1)) + 1;
        if (areCoprime(up, n)) return up;
        const down = ((s - 1 - d + (n - 1) * 4) % (n - 1)) + 1;
        if (areCoprime(down, n)) return down;
    }
    return 1;
}

/**
 * The dimensions of the minimal repeating unit (rapport) for a spec. The renderer
 * tiles this seamlessly; the matrix editor shows exactly one of these.
 * @param {Object} spec
 * @returns {{cols:number, rows:number}}
 */
export function repeatSize(spec) {
    const s = normalizeSpec(spec);
    switch (s.family) {
        case Family.PLAIN:
            return { cols: 2, rows: 2 };
        case Family.BASKET:
            return { cols: 2 * s.warpGroup, rows: 2 * s.weftGroup };
        case Family.TWILL: {
            const len = s.over + s.under;
            return { cols: len, rows: len };
        }
        case Family.SATIN:
            return { cols: s.n, rows: s.n };
        default:
            return { cols: 2, rows: 2 };
    }
}

/**
 * Human-readable label for the structure, e.g. "TWILL 2/2 Z" or "SATIN 5/2 warp".
 * Used for the graphic caption (rendered in the display font) and dropdowns.
 * @param {Object} spec
 * @returns {string}
 */
export function describeSpec(spec) {
    const s = normalizeSpec(spec);
    switch (s.family) {
        case Family.PLAIN:
            return 'PLAIN';
        case Family.BASKET:
            return `BASKET ${s.warpGroup}\u00d7${s.weftGroup}`;
        case Family.TWILL:
            return `TWILL ${s.over}/${s.under} ${s.direction < 0 ? 'S' : 'Z'}`;
        case Family.SATIN:
            return `SATIN ${s.n}/${s.satinStep} ${s.faced}`;
        default:
            return 'WEAVE';
    }
}
