import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, deserialize, toJSON, fromJSON, PROJECT_VERSION } from '../weave/ProjectSerializer.js';
import { Family } from '../weave/PatternSpec.js';

test('serialize embeds normalised spec and version', () => {
    const p = serialize({ spec: { family: Family.TWILL, over: 2, under: 2 }, render: { tileX: 3 } });
    assert.equal(p.version, PROJECT_VERSION);
    assert.equal(p.spec.family, Family.TWILL);
    assert.equal(p.render.tileX, 3);
    assert.equal(p.matrix, undefined);
});

test('serialize includes a hand-edited matrix when present', () => {
    const p = serialize({ spec: { family: Family.PLAIN }, matrix: [[1, 0], [0, 1]] });
    assert.deepEqual(p.matrix, [[1, 0], [0, 1]]);
});

test('round-trip through JSON preserves the project', () => {
    const state = { spec: { family: Family.SATIN, n: 5, satinStep: 2 }, render: { bg: '#000', tileX: 2 }, matrix: [[1, 0], [0, 1]] };
    const back = fromJSON(toJSON(state));
    assert.equal(back.spec.family, Family.SATIN);
    assert.equal(back.render.bg, '#000');
    assert.deepEqual(back.matrix, [[1, 0], [0, 1]]);
});

test('deserialize is tolerant of partial input', () => {
    const back = deserialize({ spec: { family: Family.BASKET } });
    assert.equal(back.spec.family, Family.BASKET);
    assert.deepEqual(back.render, {});
    assert.equal(back.matrix, null);
});

test('deserialize coerces matrix cells to 0/1', () => {
    const back = deserialize({ spec: { family: Family.PLAIN }, matrix: [[true, 0], ['x', null]] });
    assert.deepEqual(back.matrix, [[1, 0], [1, 0]]);
});

test('deserialize throws on garbage', () => {
    assert.throws(() => deserialize(null));
    assert.throws(() => fromJSON('{ not json'));
});
