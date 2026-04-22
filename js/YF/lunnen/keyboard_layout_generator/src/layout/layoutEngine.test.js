/**
 * Unit tests for the pure layout engine.
 * Run with:  npm test  (node --test).
 *
 * Fixtures use deep clones of LAPTOP_14 / LAPTOP_16 so layout computations
 * never mutate the exported templates.
 */

import { test, describe } from 'node:test';
import assert              from 'node:assert/strict';
import { computeLayout, keyWidthMm, keyHeightMm } from './layoutEngine.js';
import { LAPTOP_14, LAPTOP_16 }                   from '../data/rowTemplates.js';

/* ------------------------------------------------------------------ */
/*  Shared defaults (mirror DEFAULTS in KeyboardLayoutApp.js)          */
/* ------------------------------------------------------------------ */

const defaultSettings = {
    keyWidth:  16.8063,
    keyHeight: 16.6764,
    gapX:       1.5769,
    gapY:       2.1220,
    padding:    2.6480,
    fnRowH:    10.9166,
    fnGap:      2.1220
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/* ------------------------------------------------------------------ */
/*  keyWidthMm / keyHeightMm                                          */
/* ------------------------------------------------------------------ */

describe('keyWidthMm', () => {
    test('absolute wMm beats ratio', () => {
        assert.equal(keyWidthMm({ w: 2, wMm: 20 }, 16.8), 20);
    });

    test('defaults to baseW when no ratio or override', () => {
        assert.equal(keyWidthMm({}, 16.8), 16.8);
    });

    test('ratio multiplies baseW when no override', () => {
        assert.ok(Math.abs(keyWidthMm({ w: 1.5 }, 10) - 15) < 1e-9);
    });

    test('ignores non-finite wMm', () => {
        assert.equal(keyWidthMm({ w: 1, wMm: NaN },       16), 16);
        assert.equal(keyWidthMm({ w: 1, wMm: undefined }, 16), 16);
        assert.equal(keyWidthMm({ w: 1, wMm: 0 },         16), 16);
        assert.equal(keyWidthMm({ w: 1, wMm: -4 },        16), 16);
    });
});

describe('keyHeightMm', () => {
    test('hMm overrides row height', () => {
        assert.equal(keyHeightMm({ hMm: 12 }, 16.7), 12);
    });

    test('falls back to row height when no override', () => {
        assert.equal(keyHeightMm({}, 16.7), 16.7);
    });

    test('ignores non-finite hMm', () => {
        assert.equal(keyHeightMm({ hMm: 0 },   16.7), 16.7);
        assert.equal(keyHeightMm({ hMm: NaN }, 16.7), 16.7);
    });
});

/* ------------------------------------------------------------------ */
/*  LAPTOP_14 — main reference fixture                                */
/* ------------------------------------------------------------------ */

describe('computeLayout (LAPTOP_14)', () => {
    const layout = computeLayout(clone(LAPTOP_14), defaultSettings);

    test('returns a non-empty placedKeys array', () => {
        assert.ok(Array.isArray(layout.placedKeys));
        assert.ok(layout.placedKeys.length > 0);
    });

    test('backdrop dimensions are finite and positive', () => {
        assert.ok(isFinite(layout.backdropW) && layout.backdropW > 0);
        assert.ok(isFinite(layout.backdropH) && layout.backdropH > 0);
    });

    test('every placed key has finite x/y/w/h', () => {
        for (const k of layout.placedKeys) {
            assert.ok(isFinite(k.x), `x should be finite for ${k.id}`);
            assert.ok(isFinite(k.y), `y should be finite for ${k.id}`);
            assert.ok(isFinite(k.w) && k.w > 0, `w should be >0 for ${k.id}`);
            assert.ok(isFinite(k.h) && k.h > 0, `h should be >0 for ${k.id}`);
        }
    });

    test('all placed-key ids are unique', () => {
        const ids = layout.placedKeys.map(k => k.id);
        assert.equal(new Set(ids).size, ids.length);
    });

    test('fn row is shorter than main row height', () => {
        const fn = layout.placedKeys.filter(k => k.rowId === 'fn');
        assert.ok(fn.length > 0, 'fn row should exist');
        // Every non-half-arrow fn-key uses the shorter fnRowH.
        const tallestFn = Math.max(...fn.map(k => k.h));
        assert.ok(tallestFn < defaultSettings.keyHeight * 0.9,
            `fn height ${tallestFn} should be <90% of main row (${defaultSettings.keyHeight})`);
    });

    test('backdrop width matches keyboard block + 2×padding (within 0.01 mm)', () => {
        // Find the right-most key edge.
        const rightEdge = Math.max(...layout.placedKeys.map(k => k.x + k.w));
        const leftEdge  = Math.min(...layout.placedKeys.map(k => k.x));
        const keyBlockW = rightEdge - leftEdge;
        const expected  = keyBlockW + defaultSettings.padding * 2;
        assert.ok(Math.abs(layout.backdropW - expected) < 0.01,
            `backdropW ${layout.backdropW} ~= ${expected}`);
    });
});

/* ------------------------------------------------------------------ */
/*  wMm / hMm overrides propagate through the engine                  */
/* ------------------------------------------------------------------ */

describe('per-key mm overrides', () => {
    test('wMm on a row key overrides baseW in placed layout', () => {
        const t = clone(LAPTOP_14);
        const firstMainRow = t.rows.find(r => !r.isFnRow);
        const targetKey    = firstMainRow.keys[0];
        targetKey.wMm = 42.42;

        const layout = computeLayout(t, defaultSettings);
        const placed = layout.placedKeys.find(k => k.id === targetKey.id);
        assert.ok(placed, 'target key should appear in layout');
        assert.ok(Math.abs(placed.w - 42.42) < 1e-9,
            `w should equal override 42.42, got ${placed.w}`);
    });

    test('hMm on a key overrides row height', () => {
        const t = clone(LAPTOP_14);
        const firstMainRow = t.rows.find(r => !r.isFnRow);
        const targetKey    = firstMainRow.keys[0];
        targetKey.hMm = 30;

        const layout = computeLayout(t, defaultSettings);
        const placed = layout.placedKeys.find(k => k.id === targetKey.id);
        assert.ok(Math.abs(placed.h - 30) < 1e-9);
    });
});

/* ------------------------------------------------------------------ */
/*  LAPTOP_16 numpad                                                  */
/* ------------------------------------------------------------------ */

describe('computeLayout (LAPTOP_16 numpad)', () => {
    const layout = computeLayout(clone(LAPTOP_16), defaultSettings);

    test('has at least one numpad key', () => {
        const np = layout.placedKeys.filter(k => k.rowId === 'numpad');
        assert.ok(np.length > 0);
    });

    test('numpad keys sit to the right of the main block', () => {
        const np   = layout.placedKeys.filter(k => k.rowId === 'numpad');
        const main = layout.placedKeys.filter(k => k.rowId !== 'numpad'
                                                && !k.rowId.endsWith('_add'));
        const mainRight = Math.max(...main.map(k => k.x + k.w));
        const npLeft    = Math.min(...np.map(k => k.x));
        assert.ok(npLeft >= mainRight, `numpad left ${npLeft} >= main right ${mainRight}`);
    });

    test('numpad keys have finite geometry (no NaN propagation from ?? + NaN bug)', () => {
        const np = layout.placedKeys.filter(k => k.rowId === 'numpad');
        for (const k of np) {
            assert.ok(isFinite(k.x) && isFinite(k.y),
                `numpad key ${k.id} has NaN coords: x=${k.x}, y=${k.y}`);
        }
    });

    test('numpad unique ids across whole layout', () => {
        const ids = layout.placedKeys.map(k => k.id);
        assert.equal(new Set(ids).size, ids.length);
    });
});

/* ------------------------------------------------------------------ */
/*  Arrow cluster slack absorption                                    */
/* ------------------------------------------------------------------ */

describe('arrow-cluster slack absorption on LAPTOP_14', () => {
    test('bottom row (with arrow cluster) expands to reach full width', () => {
        const layout = computeLayout(clone(LAPTOP_14), defaultSettings);
        const bottom = layout.placedKeys.filter(
            k => k.rowId === layout.placedKeys
                              .find(p => !!p.isHalfArrow)?.rowId
        );
        if (bottom.length === 0) return;
        const rowRight = Math.max(...bottom.map(k => k.x + k.w));

        // Right edge of the bottom row should match the right edge of a
        // reference row (e.g. the numbers row) within 0.01 mm.
        const refRow    = layout.placedKeys.filter(k => k.rowId === 'number');
        if (refRow.length === 0) return;
        const refRight  = Math.max(...refRow.map(k => k.x + k.w));
        assert.ok(Math.abs(rowRight - refRight) < 0.01,
            `bottom-row right edge ${rowRight} ~= numbers row right ${refRight}`);
    });
});
