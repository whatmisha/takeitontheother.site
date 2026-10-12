import test from 'node:test';
import assert from 'node:assert/strict';
import { assetsPackPlan, createAssetsPack } from '../assets-export.js';
import { ASSETS } from '../assets.js';
import { normalize, normalizePreset, makeDocument, readDocument, shareDefaults } from '../document.js';
import { ShareCodec } from '../../infra/framework/src/index.js';

const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' });
const catalog = {
    letter: { src: './graphics/alphabet/set_01/A_01.png', hash: 'first' },
    alternate: { src: './graphics/alphabet/set_02/A_01.png', hash: 'second' },
    object: { src: './graphics/blobs/blob_glass_01.png', hash: 'third' },
    surface: { src: './graphics/surface/surface_glass_01.png', hash: 'fourth' },
    alias: { src: './graphics/blobs/blob_glass_01.png', hash: 'third' }
};
const scene = { seed: 42, items: ['letter', 'alternate', 'object', 'surface', 'letter', 'alias'].map(asset => ({ asset })) };

async function unpack(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer), entries = new Map();
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
        assert.equal(view.getUint16(offset + 8, true), 0, 'PNG entries use ZIP store mode');
        const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
        const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
        const start = offset + 30 + nameLength + extraLength;
        entries.set(name, bytes.slice(start, start + size)); offset = start + size;
    }
    assert.equal(view.getUint32(offset, true), 0x02014b50, 'ZIP has a central directory');
    assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50, 'ZIP has an end record');
    assert.equal(view.getUint16(bytes.length - 12, true), entries.size, 'Directory counts all files');
    return entries;
}

test('pack includes visible letters, objects and Surface once, with safe unique names and hashed source URLs', () => {
    const { artworkName, entries } = assetsPackPlan({ ...scene, items: [...scene.items, { asset: 'missing', visible: false }] }, catalog);
    assert.equal(artworkName, 'wander-wall-42.png');
    assert.deepEqual(entries.map(entry => entry.name), ['A_01.png', 'A_01_2.png', 'blob_glass_01.png', 'surface_glass_01.png']);
    assert.equal(new URL(entries[0].url).searchParams.get('v'), 'first');
    assert.ok(entries[1].url.includes('/set_02/A_01.png'));
    assert.throws(() => assetsPackPlan({ ...scene, items: [{ asset: 'missing' }] }, catalog), /Unknown artwork/);
    const collision = { a: { src: './graphics/wander-wall-42.png', hash: 'a' }, b: { src: './graphics/other/WANDER-WALL-42.png', hash: 'b' } };
    const names = assetsPackPlan({ ...scene, items: [{ asset: 'a' }, { asset: 'b' }] }, collision).entries.map(entry => entry.name);
    assert.deepEqual(names, ['wander-wall-42_2.png', 'WANDER-WALL-42_3.png']);
});

test('ZIP preserves composition and original PNG bytes without duplicates or scene mutations', async t => {
    Object.assign(ASSETS, catalog); t.after(() => Object.keys(catalog).forEach(id => delete ASSETS[id]));
    const requested = [], progress = [], before = structuredClone(scene);
    t.mock.method(globalThis, 'fetch', async url => { requested.push(url); return new Response(png); });
    const zip = await createAssetsPack(scene, png, { onProgress: value => progress.push(value) });
    assert.equal(zip.type, 'application/zip');
    const entries = await unpack(zip), expected = new Uint8Array(await png.arrayBuffer());
    assert.equal(entries.size, 5); assert.equal(requested.length, 4);
    for (const bytes of entries.values()) assert.deepEqual(bytes, expected);
    assert.deepEqual(progress.map(value => value.current), [1, 2, 3, 4]);
    assert.ok(progress.every(value => value.total === 4));
    assert.deepEqual(scene, before);
});

test('a background-only composition still produces a valid ZIP without fetching assets', async t => {
    t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch'); });
    const entries = await unpack(await createAssetsPack({ seed: 42, items: [] }, png));
    assert.deepEqual([...entries.keys()], ['wander-wall-42.png']);
});

test('missing or invalid PNGs and cancellation reject the pack instead of returning an incomplete archive', async t => {
    Object.assign(ASSETS, catalog); t.after(() => Object.keys(catalog).forEach(id => delete ASSETS[id]));
    const request = t.mock.method(globalThis, 'fetch', async () => new Response('missing', { status: 404 }));
    await assert.rejects(createAssetsPack(scene, png), /Could not load A_01.png/);
    request.mock.mockImplementation(async () => new Response('<html>Not a PNG</html>'));
    await assert.rejects(createAssetsPack(scene, png), /Invalid PNG artwork/);
    const controller = new AbortController();
    request.mock.mockImplementation(async (_url, { signal }) => { assert.equal(signal, controller.signal); controller.abort(); return new Response(png); });
    await assert.rejects(createAssetsPack(scene, png, { signal: controller.signal }), { name: 'AbortError' });
    await assert.rejects(createAssetsPack(scene, png, { signal: AbortSignal.abort() }), { name: 'AbortError' });
});

test('Assets pack defaults off and round-trips through documents, presets and links', async () => {
    assert.equal(normalize({}).exportAssetsPack, false);
    assert.equal(normalize({ exportAssetsPack: 'true' }).exportAssetsPack, false);
    const settings = normalize({ exportAssetsPack: true });
    assert.equal(readDocument(makeDocument(settings)).exportAssetsPack, true);
    assert.equal(normalizePreset({ ...settings, seeded: false }).exportAssetsPack, true);
    const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
    assert.deepEqual(normalize((await codec.decode(await codec.encode(settings))).full), settings);
});
