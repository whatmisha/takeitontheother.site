/**
 * Unit tests for validateTemplate / tryValidateTemplate.
 */

import { test, describe }                          from 'node:test';
import assert                                       from 'node:assert/strict';
import { validateTemplate, tryValidateTemplate }   from './templateSchema.js';
import { LAPTOP_14, LAPTOP_16 }                    from '../data/rowTemplates.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

describe('validateTemplate — happy path', () => {
    test('accepts LAPTOP_14', () => {
        assert.doesNotThrow(() => validateTemplate(clone(LAPTOP_14)));
    });

    test('accepts LAPTOP_16 (with numpad)', () => {
        assert.doesNotThrow(() => validateTemplate(clone(LAPTOP_16)));
    });

    test('returns the same object reference', () => {
        const t = clone(LAPTOP_14);
        assert.strictEqual(validateTemplate(t), t);
    });
});

describe('validateTemplate — structural errors', () => {
    test('rejects non-object', () => {
        assert.throws(() => validateTemplate(null),      /must be an object/);
        assert.throws(() => validateTemplate('hello'),   /must be an object/);
        assert.throws(() => validateTemplate(42),        /must be an object/);
    });

    test('rejects missing rows', () => {
        assert.throws(() => validateTemplate({}), /rows must be an array/);
    });

    test('rejects empty rows', () => {
        assert.throws(() => validateTemplate({ rows: [] }), /at least one row/);
    });

    test('rejects row without id', () => {
        assert.throws(
            () => validateTemplate({ rows: [{ keys: [{ id: 'a' }] }] }),
            /row.id must be a non-empty string/
        );
    });

    test('rejects duplicate row ids', () => {
        const t = {
            rows: [
                { id: 'r', keys: [{ id: 'a' }] },
                { id: 'r', keys: [{ id: 'b' }] }
            ]
        };
        assert.throws(() => validateTemplate(t), /duplicate row id/);
    });

    test('rejects duplicate key ids across rows (strict mode)', () => {
        const t = {
            rows: [
                { id: 'r1', keys: [{ id: 'dup' }] },
                { id: 'r2', keys: [{ id: 'dup' }] }
            ]
        };
        assert.throws(() => validateTemplate(t), /duplicate key id "dup"/);
    });

    test('allows duplicate key ids with strictIdUnique: false', () => {
        const t = {
            rows: [
                { id: 'r1', keys: [{ id: 'dup' }] },
                { id: 'r2', keys: [{ id: 'dup' }] }
            ]
        };
        assert.doesNotThrow(() => validateTemplate(t, { strictIdUnique: false }));
    });

    test('rejects unknown key.kind', () => {
        const t = { rows: [{ id: 'r', keys: [{ id: 'a', kind: 'weird' }] }] };
        assert.throws(() => validateTemplate(t), /kind must be one of/);
    });

    test('rejects wMm that is not a number', () => {
        const t = { rows: [{ id: 'r', keys: [{ id: 'a', wMm: 'wide' }] }] };
        assert.throws(() => validateTemplate(t), /wMm must be a finite number/);
    });

    test('rejects arrowCluster with wrong arity', () => {
        const t = {
            rows: [{ id: 'r', keys: [{ id: 'a' }], arrowCluster: [{ id: 'x' }] }]
        };
        assert.throws(() => validateTemplate(t), /arrowCluster must be an array of exactly 4/);
    });

    test('rejects numpad.keys not being an array', () => {
        const t = {
            rows:   [{ id: 'r', keys: [{ id: 'a' }] }],
            numpad: { cols: 4, keys: 'nope' }
        };
        assert.throws(() => validateTemplate(t), /numpad.keys must be an array/);
    });

    test('rejects numpad key without col/row', () => {
        const t = {
            rows:   [{ id: 'r', keys: [{ id: 'a' }] }],
            numpad: { cols: 4, keys: [{ id: 'n1' }] }
        };
        assert.throws(() => validateTemplate(t), /numpad key.col must be >= 0/);
    });
});

describe('validateTemplate — prototype pollution guard', () => {
    test('rejects __proto__ as a key property', () => {
        // Hand-build the object so __proto__ is an OWN property.
        const evilKey = Object.create(null);
        evilKey.id = 'a';
        Object.defineProperty(evilKey, '__proto__', {
            value: { polluted: true },
            enumerable: true,
            configurable: true,
            writable: true
        });
        const t = { rows: [{ id: 'r', keys: [evilKey] }] };
        assert.throws(() => validateTemplate(t), /forbidden field "__proto__"/);
    });
});

describe('tryValidateTemplate', () => {
    test('returns {valid: true} for good templates', () => {
        const r = tryValidateTemplate(clone(LAPTOP_14));
        assert.equal(r.valid, true);
        assert.equal(r.template, r.template); // just checking it's there
    });

    test('returns {valid: false, error, path} on failure', () => {
        const r = tryValidateTemplate({ rows: [{ id: 'r', keys: [{}] }] });
        assert.equal(r.valid, false);
        assert.match(r.error, /key\.id must be/);
        assert.equal(typeof r.path, 'string');
    });
});
