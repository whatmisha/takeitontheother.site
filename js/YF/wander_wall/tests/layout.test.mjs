import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaults as initialDefaults, shareDefaults, cleanText, lettersOf, normalize, makeDocument, readDocument } from '../document.js';
import { ShareCodec, PresetStore, ApplicationShell } from '../../infra/framework/src/index.js';
import { ASSETS, GROUNDS, alternatives, installCatalog } from '../assets.js';
import { Silhouettes, generate, changeFormat, resizeScene, updateGround, ensureSurface, preparePreset } from '../layout.js';
import { FORMATS, resolutionError, stepResolution } from '../resolutions.js';
import { Editor } from '../editor.js';
import { anchorGround } from '../ground.js';

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

test('the tool always restores a missing Surface without changing other layers or an existing Surface', () => {
    const legacy = generate(defaults, geometry), upgraded = ensureSurface(legacy);
    assert.equal(upgraded.groundEnabled, true); assert.equal(upgraded.items[0].kind, 'ground');
    assert.deepEqual(upgraded.items.slice(1), legacy.items);
    const transformed = { ...upgraded.items[0], rotation: 47, scale: .7, pinned: true, x: -2 };
    const edited = { ...upgraded, items: [...upgraded.items.slice(1), transformed] };
    assert.deepEqual(ensureSurface(edited), edited);
});

test('send to back and bring to front preserve all other layer order and transforms', () => {
    let scene = generate(initialDefaults, geometry);
    const editor = Object.create(Editor.prototype);
    editor.app = { get settings() { return scene; }, getSnapshot: () => structuredClone(scene) };
    editor.isBusy = () => false; editor.change = next => { scene = next; };
    editor.selected = scene.items[3].id;
    const selected = { ...scene.items[3], pinned: true }, others = scene.items.filter(item => item.id !== editor.selected);
    editor.reorder(Infinity);
    assert.deepEqual(scene.items, [...others, selected]);
    editor.reorder(-Infinity);
    assert.deepEqual(scene.items, [selected, ...others]);
    editor.reorder(1);
    assert.deepEqual(scene.items, [others[0], selected, ...others.slice(1)]);
});

test('text preserves Latin letter case and is limited to 32 letters independently of spaces', () => {
    assert.equal(initialDefaults.text, 'Wander');
    assert.equal(cleanText('  Hello  woRld! 123 '), 'Hello woRld');
    assert.equal(lettersOf('Hello woRld'), 'HELLOWORLD');
    assert.equal(cleanText('aB '.repeat(20)).replace(/ /g, ''), 'aB'.repeat(16));
    assert.equal(lettersOf('a '.repeat(40)).length, 32);
    assert.equal(cleanText('\u043f\u0440\u0438\u0432\u0435\u0442'), '');
});

test('mixed-case text keeps the same letter assets and survives documents and links', async () => {
    const scene = generate({ ...defaults, text: 'WaNdEr' }, geometry);
    const upper = generate({ ...defaults, text: 'WANDER' }, geometry);
    assert.equal(scene.text, 'WaNdEr');
    assert.deepEqual(scene.items, upper.items);
    assert.deepEqual(readDocument(makeDocument(scene)), scene);
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    assert.deepEqual(normalize((await codec.decode(await codec.encode(scene))).full), scene);
});

test('selected frames accept transparent drag areas, rotated and outside the canvas, before other layers', () => {
    const selected = { id: 'selected', x: .5, y: .5, rotation: 0, visible: true };
    const front = { ...selected, id: 'front' };
    const scene = { width: 1000, height: 800, items: [selected, front] };
    const editor = Object.create(Editor.prototype);
    editor.app = { settings: scene }; editor.selected = selected.id;
    editor.geometry = { dimensions: () => ({ width: 200, height: 100 }), contains: item => item.id === 'front' && item.visible !== false };
    assert.equal(editor.hit({ x: 580, y: 430 }), selected);
    assert.equal(editor.hit({ x: 601, y: 400 }), front);
    selected.rotation = 90;
    assert.equal(editor.hit({ x: 530, y: 480 }), selected);
    assert.equal(editor.hit({ x: 580, y: 430 }), front);
    selected.x = -1;
    assert.equal(editor.hit({ x: -970, y: 480 }), selected);
    assert.equal(editor.hit({ x: -920, y: 430 }), undefined);
    selected.visible = false;
    assert.equal(editor.hit({ x: -970, y: 480 }), undefined);
    selected.visible = true; selected.x = .5; editor.selected = null;
    assert.equal(editor.hit({ x: 530, y: 480 }), front);
    front.visible = false;
    assert.equal(editor.hit({ x: 530, y: 480 }), undefined);
});

test('dragging a transparent part of the selected frame moves only that object', () => {
    const item = { id: 'selected', x: .5, y: .5, rotation: 0, scale: 1, visible: true };
    let scene = { width: 1000, height: 800, items: [item] };
    const editor = Object.create(Editor.prototype);
    editor.app = { get settings() { return scene; }, getSnapshot: () => structuredClone(scene), render() {} };
    editor.selected = item.id;
    editor.geometry = { dimensions: () => ({ width: 200, height: 100 }), contains: () => false };
    editor.surface = { style: {}, setPointerCapture() {}, hasPointerCapture: () => false };
    editor.container = { focus() {} }; editor.sync = () => {}; editor.isBusy = () => false;
    editor.coordinates = event => ({ x: event.clientX, y: event.clientY });
    editor.controlAt = () => null; editor.updateCursor = () => {};
    editor.change = next => { scene = next; };
    const event = { button: 0, pointerId: 1, clientX: 580, clientY: 430, preventDefault() {} };
    editor.down(event);
    assert.equal(editor.gesture.mode, 'move');
    editor.move({ ...event, clientX: 630, clientY: 510 });
    editor.up(event);
    assert.deepEqual(scene.items[0], { ...item, x: .55, y: .6, pinned: true });
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

test('regeneration preserves pinned slots and letter order while interleaving objects', () => {
    const scene = generate(defaults, geometry);
    scene.items[2].pinned = true; scene.items[6].pinned = true;
    scene.items = scene.items.reverse();
    const pinned = scene.items.filter(item => item.pinned);
    const generated = generate(scene, geometry, { seed: 147 });
    for (const item of pinned) assert.deepEqual(generated.items.find(next => next.id === item.id), item);
    for (const item of pinned) assert.equal(generated.items.findIndex(next => next.id === item.id), scene.items.indexOf(item));
    assert.deepEqual(generated.items.filter(item => item.kind === 'letter' && !item.pinned).map(item => item.id), scene.items.filter(item => item.kind === 'letter' && !item.pinned).map(item => item.id));
    assert.deepEqual(generate(scene, geometry, { reroll: false }).items.map(item => item.id), scene.items.map(item => item.id));
    const reformatted = changeFormat(scene, 'phone', geometry);
    assertInside({ ...reformatted, items: reformatted.items.filter(item => !item.pinned) });
    for (const item of pinned) assert.deepEqual(reformatted.items.find(next => next.id === item.id), item);
    assert.equal(reformatted.items.filter(item => item.pinned).length, pinned.length);
});

test('fresh objects are interleaved between letters deterministically', () => {
    const scene = generate(defaults, geometry);
    assert.equal(scene.items[0].kind, 'letter');
    assert.equal(scene.items.at(-1).kind, 'letter');
    assert.equal(scene.items.filter(item => item.kind === 'form').length, 7);
    assert.deepEqual(scene, generate(defaults, geometry));
    const other = generate(defaults, geometry, { seed: 147 });
    assert.notDeepEqual(scene.items.map(item => item.id), other.items.map(item => item.id));
});

test('only Sticks use twice the original object scale range before frame constraints', () => {
    const sizes = [], probe = Object.create(geometry);
    probe.constrain = (item, scene) => {
        if (item.kind === 'form') sizes.push({ scale: item.scale, category: ASSETS[item.asset].category });
        return geometry.constrain(item, scene);
    };
    const scene = generate(defaults, probe);
    const letters = scene.items.filter(item => item.kind === 'letter');
    const mean = letters.reduce((sum, item) => sum + item.scale, 0) / letters.length;
    assert.equal(sizes.length, 7 * 320);
    assert.ok(sizes.some(item => item.category === 'sticks'));
    assert.ok(sizes.some(item => item.category !== 'sticks'));
    for (const { scale, category } of sizes) {
        const multiplier = category === 'sticks' ? 2 : 1;
        assert.ok(scale >= mean * .35 * multiplier && scale <= mean * 1.02 * multiplier);
    }
});

test('forms can be disabled, counted, and generated without text; all 32 letters survive shuffle', () => {
    assert.equal(generate({ ...defaults, formsEnabled: false }, geometry).items.length, 6);
    const shapes = generate({ ...defaults, text: '', formCount: 16 }, geometry);
    assert.equal(shapes.items.length, 16); assertInside(shapes);
    const full = generate({ ...defaults, text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF', shuffle: true, formCount: 16 }, geometry);
    assert.equal(full.items.length, 48); assertInside(full);
    assert.equal(full.items.filter(item => item.kind === 'letter').sort((a, b) => a.index - b.index).map(item => item.letter).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF');
});

test('Size range adds up to 50% variation to base sizes without changing variants or stacking', () => {
    assert.equal(normalize({}).sizeRange, 0);
    assert.equal(normalize({ sizeRange: -10 }).sizeRange, 0);
    assert.equal(normalize({ sizeRange: 150 }).sizeRange, 100);
    const source = { ...initialDefaults, sizeRange: 0 };
    const base = generate(source, geometry);
    const byId = new Map(base.items.map(item => [item.id, item]));
    let previousFactors;
    for (const sizeRange of [0, 50, 100]) {
        const candidates = new Map(), probe = Object.create(geometry);
        probe.constrain = (item, scene) => {
            candidates.set(item.id, item);
            return geometry.constrain(item, scene);
        };
        const scene = generate({ ...source, sizeRange }, probe);
        assert.deepEqual(scene.items.map(item => [item.id, item.asset, item.rotation]), base.items.map(item => [item.id, item.asset, item.rotation]));
        if (!sizeRange) assert.deepEqual(scene, base);
        else {
            const factors = scene.items.filter(item => item.kind !== 'ground').map(item => {
                const factor = candidates.get(item.id).scale / byId.get(item.id).scale;
                assert.ok(Math.abs(factor - 1) <= sizeRange / 200 + 1e-10);
                return factor;
            });
            assert.ok(factors.some(factor => factor < 1));
            assert.ok(factors.some(factor => factor > 1));
            if (previousFactors) factors.forEach((factor, index) => assert.ok(Math.abs((factor - 1) - 2 * (previousFactors[index] - 1)) < 1e-10));
            previousFactors = factors;
        }
        assertInside({ ...scene, items: scene.items.filter(item => item.kind !== 'ground') });
        assert.deepEqual(scene.items.find(item => item.kind === 'ground'), base.items.find(item => item.kind === 'ground'));
        assert.deepEqual(scene, generate({ ...source, sizeRange }, geometry));
        assert.deepEqual(readDocument(makeDocument(scene)), scene);
        const pinned = scene.items.find(item => item.kind === 'form'); pinned.pinned = true;
        const hidden = scene.items.find(item => item.kind === 'form' && item !== pinned); hidden.visible = false;
        const next = generate({ ...scene, sizeRange: 100 - sizeRange }, geometry, { reroll: false });
        assert.deepEqual(next.items.find(item => item.id === pinned.id), pinned);
        assert.deepEqual(next.items.find(item => item.id === hidden.id), hidden);
    }
});

test('changing Size range is not cumulative and survives share links', async () => {
    const base = generate(defaults, geometry);
    const varied = generate({ ...base, sizeRange: 100 }, geometry, { reroll: false });
    assert.deepEqual(generate(varied, geometry, { reroll: false }), varied);
    const reset = generate({ ...varied, sizeRange: 0 }, geometry, { reroll: false });
    assert.deepEqual(reset, generate({ ...base, sizeRange: 0 }, geometry, { reroll: false }));
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    assert.deepEqual(normalize((await codec.decode(await codec.encode(varied))).full), varied);
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
    editor.surface = { style: {}, hasPointerCapture: () => false };
    editor.transform({ x: -25, y: 30, scale: 2.9 });
    assert.equal(editor.item().x, -25); assert.equal(editor.item().scale, 2.9);
    editor.nudge(-scene.width, scene.height); assert.equal(editor.item().x, -26); assert.equal(editor.item().y, 31);
    const positioned = structuredClone(editor.item());
    editor.visibility(); editor.showAll(); assert.deepEqual(editor.item(), positioned);
    editor.gesture = { id: 1, mode: 'move', start: { x: 0, y: 0 }, item: positioned, snapshot: scene, items: scene.items, clientX: 0, clientY: 0 };
    editor.coordinates = event => ({ x: event.clientX, y: event.clientY });
    editor.move({ pointerId: 1, clientX: -scene.width * 10, clientY: scene.height * 10 });
    editor.up({ pointerId: 1, clientX: -scene.width * 10, clientY: scene.height * 10 });
    assert.equal(editor.item().x, -36); assert.equal(editor.item().y, 41);
    assert.equal(editor.item().asset, positioned.asset);
    const item = editor.item(), size = geometry.dimensions(item, scene), angle = item.rotation * Math.PI / 180;
    let hit;
    for (let y = 0; y < 32 && !hit; y++) for (let x = 0; x < 32 && !hit; x++) {
        const dx = ((x + .5) / 32 - .5) * size.width, dy = ((y + .5) / 32 - .5) * size.height;
        hit = editor.hit({ x: item.x * scene.width + dx * Math.cos(angle) - dy * Math.sin(angle), y: item.y * scene.height + dx * Math.sin(angle) + dy * Math.cos(angle) });
    }
    assert.equal(hit?.id, item.id, 'offboard artwork must remain selectable');
    editor.selected = null;
    assert.equal(editor.hit({ x: item.x * scene.width, y: item.y * scene.height }), undefined, 'invisible unselected overflow must not intercept clicks');
});

test('generated surfaces cover the width and anchor their horizon, while manual transforms remain intact', () => {
    assert.ok(GROUNDS.length > 0);
    for (const format of ['desktop', 'phone']) for (const groundHeight of [10, 35, 60]) {
        const base = generate({ ...initialDefaults, format, groundHeight, overflow: 50, rotationRange: 180 }, geometry);
        for (const asset of GROUNDS) {
            const ground = anchorGround({ ...base.items.find(item => item.kind === 'ground'), asset: asset.id }, base), size = geometry.dimensions(ground, base);
            const scene = normalize({ ...base, items: [ground, ...base.items.filter(item => item.kind !== 'ground')] });
            assert.equal(ground.kind, 'ground'); assert.equal(ground.x, .5); assert.equal(ground.rotation, 0);
            assert.ok(size.width >= scene.width - 1e-7);
            assert.ok(Math.abs(ground.y * scene.height - size.height / 2 - scene.height * (1 - groundHeight / 100)) < 1e-7);
            assert.ok(ground.y * scene.height + size.height / 2 >= scene.height - 1e-7);
            assert.deepEqual(geometry.constrain({ ...ground, rotation: 77, x: -.2, y: .3 }, scene), ground);
            const moved = { ...ground, x: -4, y: 3, rotation: 77, scale: .7 };
            const edited = normalize({ ...scene, items: [...scene.items.slice(1), moved] });
            assert.deepEqual(edited.items.at(-1), moved);
            assert.deepEqual(readDocument(makeDocument(edited)), edited);
            assert.ok(Math.abs(geometry.dimensions(moved, scene).width / size.width - moved.scale / ground.scale) < 1e-9);
        }
        assert.deepEqual(base, generate({ ...initialDefaults, format, groundHeight, overflow: 50, rotationRange: 180 }, geometry));
    }
});

test('Surface supports the same editor transforms, layer ordering, pinning and variants as other objects', async () => {
    let scene = generate(initialDefaults, geometry);
    const editor = Object.create(Editor.prototype);
    editor.app = { get settings() { return scene; }, getSnapshot: () => structuredClone(scene), render() {}, target: { zoom: 1 } };
    editor.geometry = geometry; editor.selected = 'ground-0'; editor.isBusy = () => false;
    editor.change = next => { scene = normalize(next); };
    editor.transform({ x: -7, y: 4, rotation: 73, scale: 1.2 });
    const surface = { ...editor.item() };
    assert.equal(surface.rotation, 73); assert.equal(surface.scale, 1.2); assert.equal(surface.x, -7);
    editor.reorder(-Infinity); editor.reorder(1); assert.equal(scene.items[1].id, surface.id);
    const pinned = { ...editor.item() }; assert.equal(pinned.pinned, true);
    assert.deepEqual(generate({ ...scene, seed: 7 }, geometry).items[1], pinned);
    assert.deepEqual(updateGround(scene).items[1], pinned);
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    assert.deepEqual(normalize((await codec.decode(await codec.encode(scene))).full), scene);
    assert.deepEqual(readDocument(makeDocument(scene)), scene);
});

test('Desktop and Mobile have the requested composition defaults and update untouched cached scenes', async () => {
    const manifest = JSON.parse(await readFile(new URL('../presets/manifest.json', import.meta.url), 'utf8'));
    assert.deepEqual(manifest.presets.map(preset => preset.name), ['Desktop', 'Mobile']);
    for (const [i, preset] of manifest.presets.entries()) {
        const data = JSON.parse(await readFile(new URL('../presets/' + preset.file, import.meta.url), 'utf8'));
        const scene = generate({ ...initialDefaults, ...data }, geometry);
        assert.deepEqual([scene.width, scene.height], i ? [1320, 2868] : [2560, 1440]);
        assert.equal(scene.items.filter(item => item.kind === 'form').length, 10);
        assert.deepEqual([scene.fill, scene.rotationRange, scene.sizeRange, scene.overflow, scene.formCount, scene.shadowEnabled], [100, 30, 50, 0, 10, true]);
        assert.deepEqual(scene, generate({ ...initialDefaults, ...data }, geometry));
        const old = generate({ ...initialDefaults, format: data.format, seed: data.seed }, geometry);
        const cached = { ...old, seeded: true, createdAt: 1, updatedAt: 1 };
        assert.deepEqual(preparePreset(cached, geometry), scene);
        assert.deepEqual(preparePreset({ ...cached, updatedAt: 2 }, geometry), old);
        assert.deepEqual(preparePreset({ ...cached, seeded: false }, geometry), old);
        assert.deepEqual(preparePreset(data, geometry), scene);
    }
});

test('shipped presets merge without overwriting user presets and Restore really restores both defaults', async t => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), storage = new Map();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
    } });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage; });
    const store = new PresetStore({ storageKey: 'test-wall' });
    store._fetchJSON = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
    const transform = data => generate({ ...initialDefaults, ...data }, geometry);
    store.create('Personal', { text: 'KEEP' });
    assert.equal(await store.loadSeed({ basePath: 'presets', transform }), 2);
    assert.equal(store.load('Personal').text, 'KEEP');
    assert.equal(await store.loadSeed({ basePath: 'presets', transform }), 0);
    store.delete('Mobile');
    let applied;
    await ApplicationShell.prototype.restoreDefaultPresets.call({
        config: { presets: { basePath: 'presets', defaultName: 'Desktop', transform } }, presetStore: store,
        presets: { histories: new Map(), switchTo: name => { applied = normalize(store.load(name)); } }, _refreshChrome() {}
    });
    assert.deepEqual(store.getNames(), ['Desktop', 'Mobile']);
    assert.deepEqual([applied.width, applied.height], [2560, 1440]);
    assert.deepEqual([store.load('Mobile').width, store.load('Mobile').height], [1320, 2868]);
});

test('ground controls leave artwork unchanged; pins, hiding, variants and formats survive regeneration', () => {
    const scene = generate(initialDefaults, geometry);
    assert.equal(generate({ ...scene, formCount: 10 }, geometry).items.filter(item => item.kind === 'ground').length, 1);
    const index = scene.items.findIndex(item => item.kind === 'ground'), others = scene.items.filter(item => item.kind !== 'ground');
    const resized = updateGround({ ...scene, groundHeight: 60 });
    assert.deepEqual(resized.items, scene.items);
    assert.deepEqual(updateGround({ ...scene, groundEnabled: false }).items, others);
    const seeds = [1, 7, 87].map(seed => generate({ ...scene, seed }, geometry).items.find(item => item.kind === 'ground').asset);
    assert.ok(new Set(seeds).size > 1);
    for (const patch of [{ pinned: true }, { visible: false }]) {
        const pinned = normalize({ ...scene, items: scene.items.map(item => item.kind === 'ground' ? { ...item, ...patch } : item) });
        const next = generate({ ...pinned, seed: 753 }, geometry);
        assert.deepEqual(next.items[index], pinned.items[index]);
        const phone = changeFormat(pinned, 'phone', geometry);
        assert.equal(phone.items[index].asset, pinned.items[index].asset);
        assert.equal(phone.items[index].rotation, 0);
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
    const duplicate = makeDocument(scene), groundIndex = scene.items.findIndex(item => item.kind === 'ground');
    duplicate.settings.items[groundIndex === 0 ? 1 : 0] = { ...scene.items[groundIndex], id: 'second-ground' };
    assert.throws(() => readDocument(duplicate), /unknown or invalid/);
    const wrongKind = makeDocument(scene); wrongKind.settings.items[groundIndex].kind = 'form';
    assert.throws(() => readDocument(wrongKind), /unknown or invalid/);
});

test('Surface reaches every free layer slot while pinned and hidden slots remain fixed', () => {
    const scene = generate(initialDefaults, geometry);
    const letter = scene.items.find(item => item.kind === 'letter'); letter.pinned = true;
    const form = scene.items.find(item => item.kind === 'form'); form.visible = false;
    const positions = new Set();
    for (let seed = 0; seed < 256; seed++) {
        const next = updateGround({ ...scene, seed }, { reroll: true });
        const index = next.items.findIndex(item => item.kind === 'ground'); positions.add(index);
        assert.ok(index >= 0 && index < next.items.length);
        for (const fixed of [letter, form]) assert.deepEqual(next.items[scene.items.indexOf(fixed)], fixed);
        assert.deepEqual(next, updateGround({ ...scene, seed }, { reroll: true }));
        assert.deepEqual(updateGround(next).items, next.items);
    }
    const available = scene.items.flatMap((item, index) => !item.pinned && item.visible !== false ? [index] : []);
    assert.deepEqual([...positions].sort((a, b) => a - b), available);
    assert.ok([...positions].some(index => index > Math.floor((scene.items.length - 1) / 2)));
    for (const patch of [{ pinned: true }, { visible: false }]) {
        const fixed = { ...scene, items: scene.items.map(item => item.kind === 'ground' ? { ...item, ...patch } : item) };
        assert.deepEqual(updateGround({ ...fixed, seed: 13 }, { reroll: true }).items, fixed.items);
    }
    const lone = generate({ ...initialDefaults, text: '', formCount: 0 }, geometry);
    assert.equal(lone.items.length, 1); assert.equal(lone.items[0].kind, 'ground');
});

test('Generate allows Surface at the very front as well as the very back', () => {
    const positions = new Set();
    for (let seed = 0; seed < 32; seed++) {
        const scene = generate({ ...initialDefaults, text: 'A', formCount: 0, seed }, geometry);
        positions.add(scene.items.findIndex(item => item.kind === 'ground'));
    }
    assert.deepEqual([...positions].sort(), [0, 1]);
});

test('resolution arrow keys step by one or snap to tens and respect pixel limits', () => {
    assert.equal(stepResolution('1920', 1), 1921);
    assert.equal(stepResolution('1080', -1), 1079);
    assert.equal(stepResolution('1921', 1, true), 1930);
    assert.equal(stepResolution('1921', -1, true), 1920);
    assert.equal(stepResolution('1920', 1, true), 1930);
    assert.equal(stepResolution('1920', -1, true), 1910);
    assert.equal(stepResolution('1', -1), 1);
    assert.equal(stepResolution('16384', 1, true), 16384);
    assert.equal(stepResolution('', 1), null);
    assert.equal(stepResolution('not a number', -1), null);
});
