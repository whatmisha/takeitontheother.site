/**
 * ColorMixer — forward and inverse optical mixing of two woven threads.
 *
 * Pure and UI-independent. The forward model predicts the cloth colour seen from a
 * distance; the inverse model proposes pairs of catalogue yarns whose optical mix
 * lands on a target colour.
 *
 * Model (v1): the cloth colour is the area-weighted linear-light average of warp
 * and weft surfaces, where the warp area fraction is the weave's warp ratio
 * (fraction of crossings with warp on top). Inter-thread gaps are ignored
 * (dense-cloth assumption).
 *
 *   cloth ≈ mixLinear(warp, weft, warpRatio)
 *
 * The inverse problem is under-determined, so suggestions are constrained to a
 * catalogue of real yarn colours: we search ordered pairs (warp, weft) and rank by
 * ΔE2000 to the target, biased by a "separation" preference (how different the two
 * yarns should be — solid vs heather/mélange vs shot).
 */

import { mixLinear, hexToLab, deltaE2000 } from './colorMath.js';

/** Largest pair separation (ΔE2000) the slider maps to. */
const MAX_SEPARATION = 60;
/** Weight of the separation-preference term relative to match error. */
const SEPARATION_BIAS = 0.35;
/** Two candidates are "the same" if both threads are within this ΔE. */
const DEDUP_DELTA = 4;

/**
 * Predict the cloth colour of a warp/weft pair at a given warp ratio.
 * @param {{warpColor:string, weftColor:string, warpRatio:number}} args
 * @returns {{hex:string, lab:{L:number,a:number,b:number}}}
 */
export function predictCloth({ warpColor, weftColor, warpRatio }) {
    const hex = mixLinear(warpColor, weftColor, warpRatio);
    return { hex, lab: hexToLab(hex) };
}

/**
 * Attach cached Lab to palette entries (idempotent).
 * @param {Array<{code?:string, name?:string, hex:string, _lab?:object}>} palette
 * @returns {Array} the same entries, each guaranteed a `_lab`
 */
export function withLab(palette) {
    return palette.map((c) => (c._lab ? c : { ...c, _lab: hexToLab(c.hex) }));
}

/**
 * Suggest catalogue yarn pairs whose optical mix matches a target colour.
 *
 * @param {Object} args
 * @param {string} args.target           target colour '#rrggbb'
 * @param {number} args.ratio            warp area fraction (warpRatio), 0..1
 * @param {Array}  args.palette          [{ code, name, hex }]
 * @param {number} [args.count=4]        how many distinct candidates to return
 * @param {number} [args.separation=0.5] desired yarn contrast, 0 (solid) … 1 (shot)
 * @returns {Array<{
 *   warp:{code,name,hex}, weft:{code,name,hex},
 *   predicted:string, deltaE:number, separation:number
 * }>}
 */
export function suggestPairs({ target, ratio, palette, count = 4, separation = 0.5 } = {}) {
    if (!Array.isArray(palette) || palette.length === 0) return [];
    const pal = withLab(palette);
    const targetLab = hexToLab(target);
    const desiredSep = Math.max(0, Math.min(1, separation)) * MAX_SEPARATION;

    const n = pal.length;

    // Pass 1 — rank every ordered pair by match error only (ΔE to target).
    // Ordered pairs matter: when ratio !== 0.5, (i warp, j weft) differs from the
    // swap, so both orders are genuinely distinct candidates.
    const byMatch = [];
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const predicted = mixLinear(pal[i].hex, pal[j].hex, ratio);
            const dE = deltaE2000(hexToLab(predicted), targetLab);
            byMatch.push({ i, j, predicted, dE });
        }
    }
    byMatch.sort((p, q) => p.dE - q.dE);

    // Pass 2 — among the closest matches, apply the separation preference. This
    // keeps match quality high while letting the slider steer the yarn contrast.
    const shortlist = byMatch.slice(0, Math.max(count * 60, 400));
    const scored = shortlist.map((c) => {
        const sep = deltaE2000(pal[c.i]._lab, pal[c.j]._lab);
        return { ...c, sep, score: c.dE + SEPARATION_BIAS * Math.abs(sep - desiredSep) };
    });
    scored.sort((p, q) => p.score - q.score);

    // Greedily collect diverse candidates (avoid near-duplicate pairs).
    const out = [];
    for (const cand of scored) {
        if (out.length >= count) break;
        const warp = pal[cand.i];
        const weft = pal[cand.j];
        const dup = out.some((o) =>
            deltaE2000(o._warpLab, warp._lab) < DEDUP_DELTA &&
            deltaE2000(o._weftLab, weft._lab) < DEDUP_DELTA
        );
        if (dup) continue;
        out.push({
            warp: { code: warp.code, name: warp.name, hex: warp.hex },
            weft: { code: weft.code, name: weft.name, hex: weft.hex },
            predicted: cand.predicted,
            deltaE: cand.dE,
            separation: cand.sep,
            _warpLab: warp._lab,
            _weftLab: weft._lab
        });
    }

    // Drop internal Lab caches from the public result.
    return out.map(({ _warpLab, _weftLab, ...rest }) => rest);
}
