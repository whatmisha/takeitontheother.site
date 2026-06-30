/**
 * colorMath — pure colour-space conversions and metrics for optical thread mixing.
 *
 * Framework- and DOM-independent (imported by the browser tool and by Node tests).
 * Optical mixing of woven threads is an *additive-area* effect: from a distance the
 * eye averages the visible surfaces. That average is physically meaningful only in
 * LINEAR light, so mixing happens in linear-RGB, while colour *difference* is
 * measured perceptually with CIEDE2000 in CIELAB (D65).
 */

/* ------------------------------- hex <-> rgb ------------------------------- */

/** Parse '#rrggbb' (or 'rrggbb') to { r, g, b } in 0..255, or null. */
export function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

/** Format r,g,b (0..255) as '#rrggbb'. Values are clamped and rounded. */
export function rgbToHex(r, g, b) {
    const h = (x) => {
        const v = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return v.length === 1 ? '0' + v : v;
    };
    return '#' + h(r) + h(g) + h(b);
}

/* --------------------------- sRGB <-> linear RGB --------------------------- */

/** sRGB component (0..1) → linear light (0..1). */
export function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linear light (0..1) → sRGB component (0..1). */
export function linearToSrgb(c) {
    const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(1, v));
}

/** '#rrggbb' → linear-RGB triplet [r, g, b] in 0..1. */
export function hexToLinear(hex) {
    const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
    return [srgbToLinear(rgb.r / 255), srgbToLinear(rgb.g / 255), srgbToLinear(rgb.b / 255)];
}

/** Linear-RGB triplet (0..1) → '#rrggbb'. */
export function linearToHex([r, g, b]) {
    return rgbToHex(linearToSrgb(r) * 255, linearToSrgb(g) * 255, linearToSrgb(b) * 255);
}

/**
 * Optical mix of two colours in linear light.
 * @param {string} hexA  first colour (warp)
 * @param {string} hexB  second colour (weft)
 * @param {number} wA    area fraction of A (warp ratio), 0..1
 * @returns {string} resulting '#rrggbb'
 */
export function mixLinear(hexA, hexB, wA) {
    const w = Math.max(0, Math.min(1, wA));
    const a = hexToLinear(hexA);
    const b = hexToLinear(hexB);
    return linearToHex([
        w * a[0] + (1 - w) * b[0],
        w * a[1] + (1 - w) * b[1],
        w * a[2] + (1 - w) * b[2]
    ]);
}

/* ------------------------------ RGB -> XYZ -> Lab -------------------------- */
/* sRGB / CIE XYZ (D65) / CIELAB, reference white D65. */

const D65 = { X: 95.047, Y: 100.0, Z: 108.883 };

/** '#rrggbb' → CIE XYZ (D65), scaled so Y of white = 100. */
export function hexToXyz(hex) {
    const [r, g, b] = hexToLinear(hex);
    return {
        x: (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100,
        y: (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100,
        z: (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100
    };
}

const labF = (t) => (t > 0.008856451679 ? Math.cbrt(t) : (7.787037037 * t + 16 / 116));

/** '#rrggbb' → CIELAB { L, a, b } (D65). */
export function hexToLab(hex) {
    const { x, y, z } = hexToXyz(hex);
    const fx = labF(x / D65.X);
    const fy = labF(y / D65.Y);
    const fz = labF(z / D65.Z);
    return {
        L: 116 * fy - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz)
    };
}

/* -------------------------------- CIEDE2000 -------------------------------- */

const deg2rad = (d) => (d * Math.PI) / 180;
const rad2deg = (r) => (r * 180) / Math.PI;

/**
 * CIEDE2000 colour difference between two CIELAB colours.
 * Implementation follows Sharma, Wu & Dalal (2005).
 * @param {{L:number,a:number,b:number}} lab1
 * @param {{L:number,a:number,b:number}} lab2
 * @returns {number} ΔE00 (0 = identical)
 */
export function deltaE2000(lab1, lab2) {
    const { L: L1, a: a1, b: b1 } = lab1;
    const { L: L2, a: a2, b: b2 } = lab2;

    const kL = 1, kC = 1, kH = 1;

    const C1 = Math.hypot(a1, b1);
    const C2 = Math.hypot(a2, b2);
    const Cbar = (C1 + C2) / 2;

    const Cbar7 = Math.pow(Cbar, 7);
    const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

    const a1p = (1 + G) * a1;
    const a2p = (1 + G) * a2;

    const C1p = Math.hypot(a1p, b1);
    const C2p = Math.hypot(a2p, b2);

    const hp = (ap, bp) => {
        if (ap === 0 && bp === 0) return 0;
        let h = rad2deg(Math.atan2(bp, ap));
        return h < 0 ? h + 360 : h;
    };
    const h1p = hp(a1p, b1);
    const h2p = hp(a2p, b2);

    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp;
    if (C1p * C2p === 0) {
        dhp = 0;
    } else if (Math.abs(h2p - h1p) <= 180) {
        dhp = h2p - h1p;
    } else if (h2p - h1p > 180) {
        dhp = h2p - h1p - 360;
    } else {
        dhp = h2p - h1p + 360;
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp) / 2);

    const Lbarp = (L1 + L2) / 2;
    const Cbarp = (C1p + C2p) / 2;

    let hbarp;
    if (C1p * C2p === 0) {
        hbarp = h1p + h2p;
    } else if (Math.abs(h1p - h2p) <= 180) {
        hbarp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
        hbarp = (h1p + h2p + 360) / 2;
    } else {
        hbarp = (h1p + h2p - 360) / 2;
    }

    const T = 1
        - 0.17 * Math.cos(deg2rad(hbarp - 30))
        + 0.24 * Math.cos(deg2rad(2 * hbarp))
        + 0.32 * Math.cos(deg2rad(3 * hbarp + 6))
        - 0.20 * Math.cos(deg2rad(4 * hbarp - 63));

    const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
    const Cbarp7 = Math.pow(Cbarp, 7);
    const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
    const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
    const SC = 1 + 0.045 * Cbarp;
    const SH = 1 + 0.015 * Cbarp * T;
    const RT = -Math.sin(deg2rad(2 * dTheta)) * RC;

    return Math.sqrt(
        Math.pow(dLp / (kL * SL), 2) +
        Math.pow(dCp / (kC * SC), 2) +
        Math.pow(dHp / (kH * SH), 2) +
        RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
    );
}

/** Convenience: CIEDE2000 between two hex colours. */
export function deltaE2000Hex(hexA, hexB) {
    return deltaE2000(hexToLab(hexA), hexToLab(hexB));
}
