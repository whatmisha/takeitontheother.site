import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaults, shareDefaults, cleanText, lettersOf, normalize, makeDocument, readDocument } from '../document.js';
import { ShareCodec } from '../../infra/framework/src/index.js';
import { ASSETS, alternatives, installCatalog } from '../assets.js';
import { Silhouettes, generate, changeFormat } from '../layout.js';

const metrics = installCatalog(JSON.parse(await readFile(new URL('../asset-catalog.json', import.meta.url), 'utf8')));
const geometry = new Silhouettes(metrics);
function assertInside(scene) {
    for (const item of scene.items) {
        const box = geometry.box(item, scene), x = item.x * scene.width, y = item.y * scene.height;
        assert.ok(x - box.width / 2 >= -1e-7 && x + box.width / 2 <= scene.width + 1e-7, item.id + ' crosses a horizontal edge');
        assert.ok(y - box.height / 2 >= -1e-7 && y + box.height / 2 <= scene.height + 1e-7, item.id + ' crosses a vertical edge');
    }
}

test('the asset catalog covers every letter variant and form', () => {
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') assert.ok(alternatives(letter).length > 0);
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

test('share links always carry exact initial layers, independently of catalog growth', async () => {
    const scene = generate(defaults, geometry);
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    const encoded = await codec.encode(scene);
    const decoded = await codec.decode(encoded);
    assert.deepEqual(normalize(decoded.full), scene);
    assert.deepEqual(decoded.full.items, scene.items);
    const empty = normalize({ text: 'A', items: [] });
    assert.deepEqual((await codec.decode(await codec.encode(empty))).full.items, []);
});

test('visibility and layout controls round trip, with defaults for older documents', () => {
    const scene = generate({ ...defaults, rotationRange: 72, overflow: 18 }, geometry);
    scene.items[0].visible = false;
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(scene)))), scene);
    const legacy = structuredClone(scene);
    delete legacy.rotationRange; delete legacy.overflow;
    for (const item of legacy.items) delete item.visible;
    const restored = readDocument({ type: 'wander-wall', version: 1, settings: legacy });
    assert.equal(restored.rotationRange, 24); assert.equal(restored.overflow, 0);
    assert.ok(restored.items.every(item => item.visible));
    assert.equal(normalize({ rotationRange: 999, overflow: 999 }).rotationRange, 180);
    assert.equal(normalize({ rotationRange: 999, overflow: 999 }).overflow, 50);
});

test('hidden letters and forms persist through generation but never participate in packing or hit testing', () => {
    const scene = generate(defaults, geometry);
    for (const item of scene.items) item.visible = false;
    const guarded = new Silhouettes(metrics), originalBox = guarded.box.bind(guarded);
    guarded.box = (item, settings) => {
        assert.notEqual(item.visible, false, 'hidden layer was included in packing');
        return originalBox(item, settings);
    };
    for (const reroll of [true, false]) {
        const next = generate({ ...scene, seed: 456, fill: 120, rotationRange: 0 }, guarded, { reroll });
        assert.deepEqual(next.items, scene.items);
    }
    for (const item of scene.items) assert.equal(geometry.contains(item, scene, item.x * scene.width, item.y * scene.height), false);
    scene.items[0].visible = true;
    const next = generate(scene, guarded);
    assert.equal(next.items.filter(item => item.visible).length, 1);
    assert.deepEqual(next.items.slice(1), scene.items.slice(1));
    const textChanged = generate({ ...scene, text: 'ZANDER' }, geometry);
    assert.equal(textChanged.items.find(item => item.id === 'letter-0').visible, true);
});

test('rotation randomness is bounded, zero means upright, and pins keep their angle', () => {
    for (const format of ['desktop', 'phone']) for (const rotationRange of [0, 5, 90, 180]) {
        const scene = generate({ ...defaults, format, rotationRange, seed: 417 }, geometry);
        assert.ok(scene.items.every(item => Math.abs(item.rotation) <= rotationRange));
        if (rotationRange === 0) assert.ok(scene.items.every(item => item.rotation === 0));
        assertInside(scene);
        scene.items[0].pinned = true;
        const pinned = { ...scene.items[0] };
        const next = generate({ ...scene, rotationRange: 0 }, geometry, { reroll: false });
        assert.deepEqual(next.items[0], pinned);
        assert.ok(next.items.slice(1).every(item => item.rotation === 0));
    }
});

function assertOverflow(scene) {
    const fraction = scene.overflow / 100;
    for (const item of scene.items.filter(item => item.visible !== false)) {
        const box = geometry.box(item, scene), x = item.x * scene.width, y = item.y * scene.height;
        assert.ok(box.width / 2 - x <= box.width * fraction + 1e-6);
        assert.ok(x + box.width / 2 - scene.width <= box.width * fraction + 1e-6);
        assert.ok(box.height / 2 - y <= box.height * fraction + 1e-6);
        assert.ok(y + box.height / 2 - scene.height <= box.height * fraction + 1e-6);
    }
}

test('edge allowance bounds generated and manual placements, including oversized rotated layers', () => {
    for (const format of ['desktop', 'phone']) for (const overflow of [0, 10, 30, 50]) {
        const scene = generate({ ...defaults, format, overflow, rotationRange: 90 }, geometry);
        assertOverflow(scene);
        for (const scale of [.2, 1.5, 3]) for (const rotation of [0, 45, 135]) for (const xy of [-1, 0, .5, 1, 2]) {
            const item = geometry.constrain({ ...scene.items.at(-1), scale, rotation, x: xy, y: xy }, scene);
            assertOverflow({ ...scene, items: [item] });
        }
        if (overflow === 0) assertInside(scene);
        else {
            const item = geometry.constrain({ ...scene.items.at(-1), scale: .5, x: 0 }, scene);
            assert.ok(item.x * scene.width - geometry.box(item, scene).width / 2 < 0);
            scene.items[scene.items.length - 1] = { ...item, pinned: true };
            const tightened = generate({ ...scene, overflow: 0 }, geometry, { reroll: false });
            assertInside(tightened);
            assert.equal(tightened.items.at(-1).pinned, true);
            assert.equal(tightened.items.at(-1).asset, item.asset);
            assert.equal(tightened.items.at(-1).rotation, item.rotation);
        }
        assertOverflow(changeFormat(scene, format === 'desktop' ? 'phone' : 'desktop', geometry));
    }
});
