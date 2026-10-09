import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { discoverAssets, prepareCatalog } from '../scripts/catalog.mjs';
import { ASSETS, FORMS, alternatives, installCatalog } from '../assets.js';
import { generate, Silhouettes } from '../layout.js';

const require = createRequire(import.meta.url);
const sharp = require(process.env.WANDER_NODE_MODULES ? resolve(process.env.WANDER_NODE_MODULES, 'sharp') : 'sharp');
async function png(root, name, color = '#F02040') {
    const path = resolve(root, name);
    await mkdir(resolve(path, '..'), { recursive: true });
    await sharp({ create: { width: 12, height: 16, channels: 4, background: color } }).png().toFile(path);
}

test('discovery accepts incomplete sets, gaps, extra variants and nested forms with stable legacy IDs', async t => {
    const root = await mkdtemp(resolve(tmpdir(), 'wall-catalog-')); t.after(() => rm(root, { recursive: true, force: true }));
    await png(root, 'graphics/alphabet/set_01/A_01.png');
    await png(root, 'graphics/alphabet/set_09/A_17.png');
    await png(root, 'graphics/alphabet/set_09/Z_02.png');
    await png(root, 'graphics/blobs/blob_01.png');
    await png(root, 'graphics/blobs/more/my form.png');
    await writeFile(resolve(root, 'graphics/alphabet/set_09/.DS_Store'), 'ignored');
    const catalog = await prepareCatalog(root), metrics = installCatalog(catalog);
    assert.deepEqual(alternatives('A'), ['A-1-1', 'A-9-17']); assert.deepEqual(alternatives('B'), []);
    assert.equal(FORMS.length, 2); assert.ok(ASSETS.pillow); assert.ok(ASSETS['form:more/my form.png']);
    assert.match(ASSETS['form:more/my form.png'].src, /my%20form\.png$/);
    for (const asset of catalog.assets) {
        assert.equal(asset.metrics.rows.length, 32);
        assert.deepEqual(asset.metrics.bounds, [0, 0, 12, 16]);
        assert.ok((await stat(resolve(root, decodeURIComponent(asset.preview)))).size > 0);
    }
    const geometry = new Silhouettes(metrics);
    assert.equal(generate({ text: 'AZ', formCount: 1 }, geometry).items.length, 3);
    assert.throws(() => generate({ text: 'B' }, geometry), /No artwork for: B/);
    const path = resolve(root, 'asset-catalog.json'), modified = (await stat(path)).mtimeMs;
    assert.deepEqual(await prepareCatalog(root), catalog);
    assert.equal((await stat(path)).mtimeMs, modified, 'unchanged catalog should not be rewritten');
    await png(root, 'graphics/alphabet/set_10/A_04.png');
    const added = await prepareCatalog(root);
    assert.equal(added.assets.length, 6); assert.notEqual(added.revision, catalog.revision);
    assert.deepEqual(alternatives('A'), ['A-1-1', 'A-9-17'], 'the open runtime keeps its catalog snapshot');
    installCatalog(added); assert.equal(alternatives('A').length, 3);
    await png(root, 'graphics/alphabet/set_01/A_01.png', '#30A060');
    const replaced = await prepareCatalog(root);
    assert.notEqual(replaced.assets.find(a => a.id === 'A-1-1').hash, catalog.assets.find(a => a.id === 'A-1-1').hash);
    await rm(resolve(root, 'graphics/blobs'), { recursive: true });
    const removed = await prepareCatalog(root); installCatalog(removed);
    assert.equal(FORMS.length, 0); assert.equal(generate({ text: 'A', formCount: 4 }, new Silhouettes(installCatalog(removed))).items.length, 1);
    const before = await readFile(path, 'utf8');
    await writeFile(resolve(root, 'graphics/alphabet/set_10/Z_01.png'), 'not a PNG');
    await assert.rejects(prepareCatalog(root));
    assert.equal(await readFile(path, 'utf8'), before, 'incomplete import cannot replace a working catalog');
});

test('duplicate IDs are rejected instead of silently replacing a variant', async t => {
    const root = await mkdtemp(resolve(tmpdir(), 'wall-duplicate-')); t.after(() => rm(root, { recursive: true, force: true }));
    await png(root, 'graphics/alphabet/set_01/A_01.png'); await png(root, 'graphics/alphabet/set_1/A_1.png');
    await assert.rejects(discoverAssets(root), /Duplicate artwork ID/);
});

test('empty alpha images are rejected before publishing', async t => {
    const root = await mkdtemp(resolve(tmpdir(), 'wall-empty-')); t.after(() => rm(root, { recursive: true, force: true }));
    await png(root, 'graphics/alphabet/set_01/A_01.png', '#00000000');
    await assert.rejects(prepareCatalog(root), /fully transparent/);
});
