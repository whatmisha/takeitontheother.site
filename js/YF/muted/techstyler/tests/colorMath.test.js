import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    hexToRgb, rgbToHex, srgbToLinear, linearToSrgb,
    mixLinear, hexToLab, deltaE2000, deltaE2000Hex
} from '../weave/colorMath.js';

const close = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

test('hex <-> rgb round trip', () => {
    assert.deepEqual(hexToRgb('#82A9D9'), { r: 130, g: 169, b: 217 });
    assert.equal(rgbToHex(130, 169, 217), '#82a9d9');
    assert.equal(rgbToHex(-5, 300, 128), '#00ff80'); // clamped
    assert.equal(hexToRgb('nope'), null);
});

test('sRGB <-> linear are inverses', () => {
    for (const c of [0, 0.02, 0.04045, 0.2, 0.5, 0.8, 1]) {
        assert.ok(close(linearToSrgb(srgbToLinear(c)), c, 1e-6));
    }
});

test('linear mix of black and white at 0.5 is darker than sRGB midpoint', () => {
    // Linear 0.5 → sRGB ~0.7354 → ~188 (a perceptual mid-gray, not 128).
    assert.equal(mixLinear('#000000', '#ffffff', 0.5), '#bcbcbc');
});

test('mix at extreme weights returns the dominant colour', () => {
    assert.equal(mixLinear('#ff0000', '#0000ff', 1), '#ff0000');
    assert.equal(mixLinear('#ff0000', '#0000ff', 0), '#0000ff');
});

test('Lab of reference colours', () => {
    const white = hexToLab('#ffffff');
    assert.ok(close(white.L, 100, 0.05) && close(white.a, 0, 0.05) && close(white.b, 0, 0.05));
    const black = hexToLab('#000000');
    assert.ok(close(black.L, 0, 0.05));
    const red = hexToLab('#ff0000');
    assert.ok(close(red.L, 53.24, 0.05) && close(red.a, 80.09, 0.05) && close(red.b, 67.20, 0.05));
});

test('deltaE2000 is zero for identical colours', () => {
    assert.ok(close(deltaE2000Hex('#3c6e9a', '#3c6e9a'), 0, 1e-9));
});

// Reference pairs from Sharma, Wu & Dalal (2005), Table 1.
test('deltaE2000 matches published reference pairs', () => {
    const cases = [
        [{ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 }, 2.0425],
        [{ L: 50, a: 3.1571, b: -77.2803 }, { L: 50, a: 0, b: -82.7485 }, 2.8615],
        [{ L: 50, a: 2.8361, b: -74.0200 }, { L: 50, a: 0, b: -82.7485 }, 3.4412],
        [{ L: 50, a: -1.3802, b: -84.2814 }, { L: 50, a: 0, b: -82.7485 }, 1.0000],
        [{ L: 50, a: 2.4900, b: -0.0010 }, { L: 50, a: -2.4900, b: 0.0012 }, 7.2195],
        [{ L: 50, a: 2.5, b: 0 }, { L: 73, a: 25, b: -18 }, 27.1492],
        [{ L: 50, a: 2.5, b: 0 }, { L: 50, a: 3.1736, b: 0.5854 }, 1.0000],
        [{ L: 60.2574, a: -34.0099, b: 36.2677 }, { L: 60.4626, a: -34.1751, b: 39.4387 }, 1.2644],
        [{ L: 2.0776, a: 0.0795, b: -1.1350 }, { L: 0.9033, a: -0.0636, b: -0.5514 }, 0.9082]
    ];
    for (const [a, b, expected] of cases) {
        assert.ok(close(deltaE2000(a, b), expected, 1e-3), `ΔE00 ${deltaE2000(a, b)} ≈ ${expected}`);
    }
});
