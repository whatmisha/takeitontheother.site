import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SeededRandom } from '../../infra/framework/src/index.js';
import { ASSETS, alternatives, installCatalog } from '../assets.js';
import { assignLetterTextures, letterTextureUsage, nextLetterVariant } from '../letter-textures.js';
import { LETTER_TEXTURES } from '../letter-texture-map.js';
import { generate, Silhouettes } from '../layout.js';
import { defaults, makeDocument, readDocument } from '../document.js';

const catalog = JSON.parse(await readFile(new URL('../asset-catalog.json', import.meta.url), 'utf8'));
const geometry = new Silhouettes(installCatalog(catalog));
const letters = text => [...text].map((letter, index) => ({ id: 'letter-' + index, kind: 'letter', letter, index, visible: true, pinned: false }));
const assign = (items, seed = 42, options) => assignLetterTextures(items, new SeededRandom(seed), options);
const applied = (items, assigned) => items.map(item => ({ ...item, asset: assigned.get(item.id) ?? item.asset }));

test('all existing letters have material metadata; object and Surface catalogs remain outside tracking', () => {
    const artwork = catalog.assets.filter(asset => asset.kind === 'letter');
    assert.equal(artwork.length, 450);
    assert.equal(new Set(artwork.map(asset => asset.textureId)).size, 24);
    assert.ok(catalog.assets.every(asset => asset.textureId !== 'glitch' && !/_glitch_/.test(asset.src)));
    assert.ok(artwork.some(asset => asset.textureId === 'glitchy'));
    for (const asset of artwork) {
        assert.ok(asset.textureId, asset.id);
        assert.equal(asset.textureId, LETTER_TEXTURES[asset.id]);
    }
    assert.equal(ASSETS['B-1-1'].textureId, 'deep_blue');
    assert.equal(ASSETS['K-1-3'].textureId, 'deep_blue');
    assert.equal(ASSETS['A-2-1'].textureId, 'blue');
    assert.equal(ASSETS['Y-2-1'].textureId, 'deep_blue');
    assert.equal(ASSETS['A-3-1'].textureId, 'blue');
    assert.equal(ASSETS['X-3-1'].textureId, 'iridescent');
    assert.ok(catalog.assets.filter(asset => asset.kind !== 'letter').every(asset => !asset.textureId));
});

test('allocation is seeded, varies across seeds, and avoids duplicates when feasible', () => {
    const items = letters('WANDER');
    assert.deepEqual(assign(items), assign(items));
    assert.notDeepEqual(assign(items, 42), assign(items, 43));
    for (let seed = 0; seed < 50; seed++) {
        const result = assign(items, seed);
        assert.equal(new Set([...result.values()].map(id => ASSETS[id].textureId)).size, items.length);
        for (const item of items) assert.ok(alternatives(item.letter).includes(result.get(item.id)));
    }
});

test('matching avoids greedy dead ends with restricted letter choices', () => {
    const assets = { ax: { textureId: 'x' }, ay: { textureId: 'y' }, bx: { textureId: 'x' }, cy: { textureId: 'y' }, cz: { textureId: 'z' } };
    const choicesFor = letter => ({ A: ['ax', 'ay'], B: ['bx'], C: ['cy', 'cz'] })[letter];
    for (let seed = 0; seed < 30; seed++) {
        const result = assign(letters('ABC'), seed, { assets, choicesFor });
        assert.equal(result.get('letter-0'), 'ay');
        assert.equal(result.get('letter-1'), 'bx');
        assert.equal(result.get('letter-2'), 'cz');
    }
});

test('long text uses every reachable material before balancing unavoidable repeats', () => {
    for (const text of ['ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF', 'W'.repeat(32)]) {
        const items = letters(text), reachable = new Set(items.flatMap(item => alternatives(item.letter).map(id => ASSETS[id].textureId)));
        for (let seed = 0; seed < 10; seed++) {
            const usage = letterTextureUsage(applied(items, assign(items, seed)));
            assert.equal(usage.size, reachable.size);
            const counts = [...usage.values()].map(users => users.length);
            assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
        }
    }
});

test('pinned repeats stay fixed, hidden letters and nonletters do not reserve materials', () => {
    const items = letters('WANDER');
    items[0] = { ...items[0], asset: 'W-1-1', pinned: true };
    items[1] = { ...items[1], asset: 'A-6-3', pinned: true };
    assert.equal(ASSETS[items[0].asset].textureId, ASSETS[items[1].asset].textureId);
    const original = structuredClone(items), result = assign(items);
    assert.deepEqual(items, original);
    assert.equal(result.has(items[0].id), false); assert.equal(result.has(items[1].id), false);
    assert.ok([...result.values()].every(id => ASSETS[id].textureId !== 'white_fur'));
    assert.equal(new Set(result.values()).size, 4);
    const extra = [
        { ...items[0], id: 'hidden', asset: 'A-1-1', visible: false },
        { ...items[0], id: 'object', kind: 'form', asset: 'A-1-1' },
        { ...items[0], id: 'surface', kind: 'ground', asset: 'A-1-1' }
    ];
    assert.deepEqual(assign([...items, ...extra]), result);
    const usage = letterTextureUsage([...applied(items, result), ...extra], { excludeId: items[0].id });
    assert.deepEqual(usage.get('white_fur').map(item => item.id), [items[1].id]);
    assert.ok([...usage.values()].flat().every(item => !extra.includes(item)));
});

test('balance accounts for unavoidable pinned usage, while maximizing distinct materials first', () => {
    const assets = { a: { textureId: 'a' }, b: { textureId: 'b' }, c: { textureId: 'c' } };
    const items = letters('W'.repeat(8));
    items[0] = { ...items[0], asset: 'a', pinned: true };
    items[1] = { ...items[1], asset: 'a', pinned: true };
    items[2] = { ...items[2], asset: 'a', pinned: true };
    const usage = letterTextureUsage(applied(items, assign(items, 4, { assets, choicesFor: () => ['a', 'b', 'c'] })), { assets });
    assert.equal(usage.get('a').length, 3);
    assert.deepEqual([...usage.values()].map(users => users.length).sort(), [2, 3, 3]);
});

test('unclassified artwork is still selectable but shares a conservative fallback group', () => {
    const assets = { unknown1: {}, unknown2: {}, known: { textureId: 'blue' } };
    const result = assign(letters('AAA'), 4, { assets, choicesFor: () => Object.keys(assets) });
    assert.ok([...result.values()].every(id => assets[id]));
    assert.equal(letterTextureUsage(applied(letters('AAA'), result), { assets }).size, 2);
    const one = assign(letters('A'), 4, { assets, choicesFor: () => Object.keys(assets) });
    assert.equal(one.get('letter-0'), 'known');
});

test('layout changes preserve variants, new letters avoid them, and Generate preserves pinned objects exactly', () => {
    const scene = generate({ ...defaults, text: 'Wander', formCount: 1, groundEnabled: true }, geometry);
    const pinned = scene.items.find(item => item.kind === 'letter'); pinned.pinned = true; pinned.x = -2;
    const rerolled = generate(scene, geometry, { seed: 123 });
    assert.deepEqual(rerolled.items.find(item => item.id === pinned.id), pinned);
    assert.equal(letterTextureUsage(rerolled.items).size, 6);
    const resized = generate({ ...scene, text: 'WanderZ', fill: 99 }, geometry, { reroll: false });
    for (const item of scene.items) assert.equal(resized.items.find(next => next.id === item.id).asset, item.asset);
    assert.equal(letterTextureUsage(resized.items).size, 7);
    assert.deepEqual(readDocument(makeDocument(rerolled)), rerolled);
});

test('next variant prefers unused textures and never changes other letters', () => {
    const items = letters('WA');
    items[0].asset = 'W-1-1'; items[1].asset = 'A-5-1'; items[1].pinned = true;
    const before = structuredClone(items), next = nextLetterVariant(items[0], items);
    assert.notEqual(next, items[0].asset);
    assert.notEqual(ASSETS[next].textureId, ASSETS[items[1].asset].textureId);
    assert.deepEqual(items, before);
});
