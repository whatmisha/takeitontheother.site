/**
 * Unit tests for pure template operations.
 */

import { test, describe } from 'node:test';
import assert             from 'node:assert/strict';
import {
    cloneTemplate,
    findKeyInTemplate,
    findRow,
    collectKeyIds,
    collectRowIds,
    uniqueKeyId,
    uniqueRowId,
    isSimpleRowKey
} from './templateOps.js';
import { LAPTOP_14, LAPTOP_16 } from '../data/rowTemplates.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

describe('cloneTemplate', () => {
    test('returns a structurally-equal independent copy', () => {
        const copy = cloneTemplate(LAPTOP_14);
        assert.deepStrictEqual(copy, LAPTOP_14);
        copy.rows[0].keys[0].id = 'mutated';
        assert.notEqual(LAPTOP_14.rows[0].keys[0].id, 'mutated');
    });
    test('passes through null/undefined', () => {
        assert.equal(cloneTemplate(null), null);
        assert.equal(cloneTemplate(undefined), undefined);
    });
});

describe('findKeyInTemplate', () => {
    const t = clone(LAPTOP_14);
    test('finds a key in row.keys with correct list/index', () => {
        const anyRow = t.rows.find(r => Array.isArray(r.keys) && r.keys.length);
        const anyKey = anyRow.keys[0];
        const r = findKeyInTemplate(t, anyKey.id);
        assert.ok(r);
        assert.equal(r.key.id, anyKey.id);
        assert.equal(r.list, anyRow.keys);
        assert.equal(r.index, 0);
    });
    test('finds a key in arrowCluster', () => {
        const row = t.rows.find(r => Array.isArray(r.arrowCluster));
        if (!row) return;
        const ak  = row.arrowCluster[0];
        const r = findKeyInTemplate(t, ak.id);
        assert.ok(r);
        assert.equal(r.list, row.arrowCluster);
    });
    test('returns null for unknown id', () => {
        assert.equal(findKeyInTemplate(t, '__nope__'), null);
    });
    test('finds numpad keys (LAPTOP_16)', () => {
        const t16 = clone(LAPTOP_16);
        const npKey = t16.numpad.keys[0];
        const r = findKeyInTemplate(t16, npKey.id);
        assert.ok(r);
        assert.equal(r.key.id, npKey.id);
        assert.equal(r.list, t16.numpad.keys);
    });
});

describe('findRow', () => {
    test('returns row when present', () => {
        const t = clone(LAPTOP_14);
        const row = t.rows[0];
        assert.equal(findRow(t, row.id), row);
    });
    test('returns null for unknown row', () => {
        assert.equal(findRow(clone(LAPTOP_14), '__nope__'), null);
    });
});

describe('collectKeyIds', () => {
    test('LAPTOP_14 ids are unique and non-empty', () => {
        const ids = collectKeyIds(clone(LAPTOP_14));
        assert.ok(ids.size > 0);
    });
    test('LAPTOP_16 includes numpad ids', () => {
        const t = clone(LAPTOP_16);
        const ids = collectKeyIds(t);
        for (const k of t.numpad.keys) {
            assert.ok(ids.has(k.id), `numpad id ${k.id} should be present`);
        }
    });
    test('handles empty templates gracefully', () => {
        assert.equal(collectKeyIds(null).size, 0);
        assert.equal(collectKeyIds({}).size, 0);
    });
});

describe('uniqueKeyId / uniqueRowId', () => {
    test('fresh seed returns base_copy', () => {
        assert.equal(uniqueKeyId(new Set(), 'a'), 'a_copy');
    });
    test('collision -> base_copy2, base_copy3', () => {
        const existing = new Set(['a', 'a_copy', 'a_copy2']);
        assert.equal(uniqueKeyId(existing, 'a'), 'a_copy3');
    });
    test('strips existing _copyN suffix before seeding', () => {
        assert.equal(uniqueKeyId(new Set(['a_copy']), 'a_copy5'), 'a_copy2');
    });
    test('accepts an array too (not just Set)', () => {
        assert.equal(uniqueKeyId(['a'], 'a'), 'a_copy');
    });
    test('uniqueRowId numbers from 2', () => {
        assert.equal(uniqueRowId(new Set(['row']), 'row'), 'row2');
        assert.equal(uniqueRowId(new Set(['row', 'row2']), 'row'), 'row3');
    });
});

describe('isSimpleRowKey', () => {
    test('true for ordinary row.keys entry', () => {
        const t = clone(LAPTOP_14);
        const anyRow = t.rows.find(r => Array.isArray(r.keys) && r.keys.length);
        assert.equal(isSimpleRowKey(t, anyRow.keys[0].id), true);
    });
    test('false for arrowCluster key', () => {
        const t = clone(LAPTOP_14);
        const row = t.rows.find(r => Array.isArray(r.arrowCluster));
        if (!row) return;
        assert.equal(isSimpleRowKey(t, row.arrowCluster[0].id), false);
    });
    test('false for unknown key', () => {
        assert.equal(isSimpleRowKey(clone(LAPTOP_14), '__nope__'), false);
    });
});

describe('collectRowIds', () => {
    test('returns all row ids', () => {
        const ids = collectRowIds(clone(LAPTOP_14));
        for (const r of LAPTOP_14.rows) assert.ok(ids.has(r.id));
    });
});
