import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaults as initialDefaults, shareDefaults, cleanText, lettersOf, normalize, makeDocument, readDocument } from '../document.js';
import { ShareCodec } from '../../infra/framework/src/index.js';
import { ASSETS, GROUNDS, alternatives, installCatalog } from '../assets.js';
import { Silhouettes, generate, changeFormat, resizeScene, updateGround } from '../layout.js';
import { FORMATS, resolutionError } from '../resolutions.js';
import { Editor } from '../editor.js';

const metrics = installCatalog(JSON.parse(await readFile(new URL('../asset-catalog.json', import.meta.url), 'utf8')));
const geometry = new Silhouettes(metrics);
const defaults = { ...initialDefaults, groundEnabled: false };
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
    assertInside({ ...reformatted, items: reformatted.items.filter(item => !item.pinned) });
    for (const item of pinned) assert.deepEqual(reformatted.items.find(next => next.id === item.id), item);
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
    for (const item of scene.items.filter(item => item.visible !== false && !item.pinned)) {
        const box = geometry.box(item, scene), x = item.x * scene.width, y = item.y * scene.height;
        assert.ok(box.width / 2 - x <= box.width * fraction + 1e-6);
        assert.ok(x + box.width / 2 - scene.width <= box.width * fraction + 1e-6);
        assert.ok(box.height / 2 - y <= box.height * fraction + 1e-6);
        assert.ok(y + box.height / 2 - scene.height <= box.height * fraction + 1e-6);
    }
}

test('edge allowance bounds generated placements, never overwriting pinned positions', () => {
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
            assertInside({ ...tightened, items: tightened.items.filter(item => !item.pinned) });
            assert.deepEqual(tightened.items.at(-1), { ...item, pinned: true });
            assert.equal(tightened.items.at(-1).pinned, true);
            assert.equal(tightened.items.at(-1).asset, item.asset);
            assert.equal(tightened.items.at(-1).rotation, item.rotation);
        }
        assertOverflow(changeFormat(scene, format === 'desktop' ? 'phone' : 'desktop', geometry));
    }
});

test('resolution presets, explicit Custom, validation and legacy formats round trip', async () => {
    for (const [format, preset] of Object.entries(FORMATS)) {
        const scene = normalize({ ...defaults, format });
        assert.equal(scene.width, preset.width); assert.equal(scene.height, preset.height);
        assert.equal(scene.format, format); assert.equal(resolutionError(scene.width, scene.height), '');
    }
    assert.equal(normalize({ format: 'phone' }).width, 1290);
    assert.equal(normalize({ format: 'desktop' }).height, 2160);
    const custom = normalize({ ...defaults, format: 'custom', width: 1920, height: 1080 });
    assert.equal(custom.format, 'custom');
    assert.deepEqual(readDocument(makeDocument(custom)), custom);
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    assert.deepEqual(normalize((await codec.decode(await codec.encode(custom))).full), custom);
    for (const dimensions of [[0, 1080], ['', 1080], [1920.5, 1080], [NaN, 100], [16385, 100], [8192, 8192]]) assert.ok(resolutionError(...dimensions));
    assert.equal(resolutionError(7680, 4320), '');
    assert.throws(() => readDocument({ type: 'wander-wall', version: 1, settings: { ...custom, width: -5 } }), /whole pixels/);
});

test('same-aspect resize preserves the layout; another aspect repacks only unpinned visible artwork', () => {
    const scene = generate(initialDefaults, geometry);
    scene.items[1] = { ...scene.items[1], x: -12.5, y: 7.5, pinned: true };
    scene.items[2] = { ...scene.items[2], x: 4, y: -3, visible: false };
    for (const dimensions of [{ format: 'fhd' }, { format: 'custom', width: 2560, height: 1440 }]) {
        const next = resizeScene(scene, dimensions, geometry);
        assert.deepEqual(next.items.slice(1), scene.items.slice(1));
        assert.equal(next.items[0].asset, scene.items[0].asset);
    }
    const phone = resizeScene(scene, { format: 'iphone17' }, geometry);
    assert.deepEqual(phone.items[1], scene.items[1]); assert.deepEqual(phone.items[2], scene.items[2]);
    assert.notDeepEqual(phone.items.slice(3), scene.items.slice(3));
    assertInside({ ...phone, items: phone.items.filter(item => item.kind !== 'ground' && !item.pinned && item.visible) });
});

test('far-offboard positions survive JSON, links, pinning and generation', async () => {
    const scene = generate(defaults, geometry);
    scene.items[0] = { ...scene.items[0], x: -250.125, y: 812.875, pinned: true };
    scene.items[1] = { ...scene.items[1], x: 401, y: -500, visible: false };
    assert.deepEqual(readDocument(makeDocument(scene)), scene);
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    assert.deepEqual(normalize((await codec.decode(await codec.encode(scene))).full), scene);
    assert.deepEqual(generate({ ...scene, seed: 8 }, geometry).items.slice(0, 2), scene.items.slice(0, 2));
});

test('manual drag, numeric transforms, nudging, hiding and showing never constrain artwork', () => {
    let scene = generate(defaults, geometry);
    const editor = Object.create(Editor.prototype);
    editor.app = { get settings() { return scene; }, getSnapshot: () => structuredClone(scene), render() {}, target: { zoom: 1 } };
    editor.geometry = geometry; editor.selected = scene.items.at(-1).id;
    editor.isBusy = () => false; editor.change = next => { scene = normalize(next); };
    editor.surface = { hasPointerCapture: () => false };
    editor.transform({ x: -25, y: 30, scale: 2.9 });
    assert.equal(editor.item().x, -25); assert.equal(editor.item().scale, 2.9);
    editor.nudge(-3840, 2160); assert.equal(editor.item().x, -26); assert.equal(editor.item().y, 31);
    const positioned = structuredClone(editor.item());
    editor.visibility(); editor.showAll(); assert.deepEqual(editor.item(), positioned);
    editor.gesture = { id: 1, mode: 'move', start: { x: 0, y: 0 }, item: positioned, snapshot: scene, items: scene.items, clientX: 0, clientY: 0 };
    editor.coordinates = event => ({ x: event.clientX, y: event.clientY });
    editor.move({ pointerId: 1, clientX: -38400, clientY: 21600 });
    editor.up({ pointerId: 1 });
    assert.equal(editor.item().x, -36); assert.equal(editor.item().y, 41);
    assert.equal(editor.item().asset, positioned.asset);
    const item = editor.item(), size = geometry.dimensions(item, scene), angle = item.rotation * Math.PI / 180;
    let hit;
    for (let y = 0; y < 32 && !hit; y++) for (let x = 0; x < 32 && !hit; x++) {
        const dx = ((x + .5) / 32 - .5) * size.width, dy = ((y + .5) / 32 - .5) * size.height;
        hit = editor.hit({ x: item.x * scene.width + dx * Math.cos(angle) - dy * Math.sin(angle), y: item.y * scene.height + dx * Math.sin(angle) + dy * Math.cos(angle) });
    }
    assert.equal(hit?.id, item.id, 'offboard artwork must remain selectable');
});

test('ground stays behind all objects, covers the width, and anchors its horizon in both formats', () => {
    assert.ok(GROUNDS.length > 0);
    for (const format of ['desktop', 'phone']) for (const groundHeight of [10, 35, 60]) {
        const base = generate({ ...initialDefaults, format, groundHeight, overflow: 50, rotationRange: 180 }, geometry);
        for (const asset of GROUNDS) {
            const scene = normalize({ ...base, items: [...base.items.slice(1), { ...base.items[0], asset: asset.id, x: .1, y: .1, rotation: 90 }] });
            const ground = scene.items[0], size = geometry.dimensions(ground, scene);
            assert.equal(ground.kind, 'ground'); assert.equal(ground.x, .5); assert.equal(ground.rotation, 0);
            assert.ok(size.width >= scene.width - 1e-7);
            assert.ok(Math.abs(ground.y * scene.height - size.height / 2 - scene.height * (1 - groundHeight / 100)) < 1e-7);
            assert.ok(ground.y * scene.height + size.height / 2 >= scene.height - 1e-7);
            assert.deepEqual(geometry.constrain({ ...ground, rotation: 77, x: -.2, y: .3 }, scene), ground);
        }
        assert.deepEqual(base, generate({ ...initialDefaults, format, groundHeight, overflow: 50, rotationRange: 180 }, geometry));
    }
});

test('ground controls leave artwork unchanged; pins, hiding, variants and formats survive regeneration', () => {
    const scene = generate(initialDefaults, geometry);
    const resized = updateGround({ ...scene, groundHeight: 60 });
    assert.deepEqual(resized.items.slice(1), scene.items.slice(1));
    assert.equal(resized.items[0].asset, scene.items[0].asset);
    assert.deepEqual(updateGround({ ...scene, groundEnabled: false }).items, scene.items.slice(1));
    const seeds = [1, 7, 87].map(seed => generate({ ...scene, seed }, geometry).items[0].asset);
    assert.ok(new Set(seeds).size > 1);
    for (const patch of [{ pinned: true }, { visible: false }]) {
        const pinned = normalize({ ...scene, items: [{ ...scene.items[0], ...patch }, ...scene.items.slice(1)] });
        const next = generate({ ...pinned, seed: 753 }, geometry);
        assert.deepEqual(next.items[0], pinned.items[0]);
        const phone = changeFormat(pinned, 'phone', geometry);
        assert.equal(phone.items[0].asset, pinned.items[0].asset);
        assert.equal(phone.items[0].rotation, 0);
    }
});

test('ground documents round trip at maximum capacity while old documents remain ground-free', async () => {
    const scene = generate({ ...initialDefaults, text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF', formCount: 16 }, geometry);
    assert.equal(scene.items.length, 49);
    assert.deepEqual(readDocument(JSON.parse(JSON.stringify(makeDocument(scene)))), scene);
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    assert.deepEqual(normalize((await codec.decode(await codec.encode(scene))).full), scene);
    const legacy = makeDocument(generate(defaults, geometry));
    delete legacy.settings.groundEnabled; delete legacy.settings.groundHeight;
    assert.equal(readDocument(legacy).groundEnabled, false);
    assert.ok(generate(readDocument(legacy), geometry).items.every(item => item.kind !== 'ground'));
    const duplicate = makeDocument(scene); duplicate.settings.items[1] = { ...duplicate.settings.items[0], id: 'second-ground' };
    assert.throws(() => readDocument(duplicate), /unknown or invalid/);
    const wrongKind = makeDocument(scene); wrongKind.settings.items[0].kind = 'form';
    assert.throws(() => readDocument(wrongKind), /unknown or invalid/);
});
