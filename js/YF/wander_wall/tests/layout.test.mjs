import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaults, cleanText, lettersOf, normalize, makeDocument, readDocument } from '../document.js';
import { ASSETS } from '../assets.js';
import { Silhouettes, generate, changeFormat } from '../layout.js';

const metrics = JSON.parse(await readFile(new URL('../asset-metrics.json', import.meta.url), 'utf8'));
const geometry = new Silhouettes(metrics);
function assertInside(scene) {
    for (const item of scene.items) {
        const box = geometry.box(item, scene), x = item.x * scene.width, y = item.y * scene.height;
        assert.ok(x - box.width / 2 >= -1e-7 && x + box.width / 2 <= scene.width + 1e-7, item.id + ' crosses a horizontal edge');
        assert.ok(y - box.height / 2 >= -1e-7 && y + box.height / 2 <= scene.height + 1e-7, item.id + ' crosses a vertical edge');
    }
}

test('the asset catalog covers every letter variant and form', () => {
    assert.equal(Object.keys(ASSETS).length, 238);
    assert.deepEqual(Object.keys(metrics).sort(), Object.keys(ASSETS).sort());
    for (const metric of Object.values(metrics)) { assert.equal(metric.rows.length, 32); assert.ok(metric.bounds[2] > 0 && metric.bounds[3] > 0); }
});

test('text is Latin, uppercase, and limited to 32 letters independently of spaces', () => {
    assert.equal(cleanText('  hello  world! 123 '), 'HELLO WORLD');
    assert.equal(lettersOf('a '.repeat(40)).length, 32);
    assert.equal(cleanText('\u043f\u0440\u0438\u0432\u0435\u0442'), '');
});

test('layout is repeatable, order is preserved, and every silhouette stays within both formats', () => {
    for (const format of ['desktop', 'phone']) for (const text of ['A', 'HI', 'WANDER', 'WANDER WALL', 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF']) for (const seed of [1, 47, 20261009]) {
        const source = normalize({ ...defaults, format, text, seed });
        const scene = generate(source, geometry);
        assertInside(scene);
        assert.deepEqual(scene, generate(source, geometry));
        const letters = scene.items.filter(item => item.kind === 'letter');
        assert.equal(letters.length, lettersOf(text).length);
        assert.equal(letters.map(item => item.letter).join(''), lettersOf(text));
        for (let index = 1; index < letters.length; index++) {
            const a = letters[index - 1], b = letters[index];
            assert.ok(b.y > a.y + .02 || b.x > a.x, 'letter reading order changed');
        }
    }
});

test('regeneration preserves exact pinned objects and manual layer order', () => {
    const scene = generate(defaults, geometry);
    scene.items[2].pinned = true; scene.items[6].pinned = true;
    scene.items = scene.items.reverse();
    const pinned = scene.items.filter(item => item.pinned);
    const generated = generate(scene, geometry, { seed: 147 });
    for (const item of pinned) assert.deepEqual(generated.items.find(next => next.id === item.id), item);
    assert.deepEqual(generated.items.map(item => item.id), scene.items.map(item => item.id));
    const reformatted = changeFormat(scene, 'phone', geometry);
    assertInside(reformatted);
    assert.equal(reformatted.items.filter(item => item.pinned).length, pinned.length);
});

test('forms can be disabled, counted, and generated without text; all 32 letters survive shuffle', () => {
    assert.equal(generate({ ...defaults, formsEnabled: false }, geometry).items.length, 6);
    const shapes = generate({ ...defaults, text: '', formCount: 16 }, geometry);
    assert.equal(shapes.items.length, 16); assertInside(shapes);
    const full = generate({ ...defaults, text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF', shuffle: true, formCount: 16 }, geometry);
    assert.equal(full.items.length, 48); assertInside(full);
    assert.equal(full.items.filter(item => item.kind === 'letter').sort((a, b) => a.index - b.index).map(item => item.letter).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF');
});

test('JSON round trip keeps the exact scene and rejects unknown assets', () => {
    const scene = generate(defaults, geometry);
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(scene)))), scene);
    const bad = makeDocument(scene); bad.settings.items[0].asset = '../../elsewhere.png';
    assert.throws(() => readDocument(bad), /unknown or invalid/);
    assert.throws(() => readDocument({ version: 2, type: 'wander-wall' }), /version 1/);
});
