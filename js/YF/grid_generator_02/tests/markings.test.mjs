import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MARKING_CATALOG_V1 } from '../src/markings/MarkingCatalogV1.js';
import { markingRecipe, buildMarkingGroup, assertMarkingRecipe } from '../src/markings/MarkingGroup.js';
import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';
import { PresetShareCodec } from '../src/preset/PresetShareCodec.js';
import { BuiltInGraphicsController } from '../src/elements/BuiltInGraphicsController.js';

const source = (id = 'group') => {
    const settings = new Settings(); new SurfaceManager(settings).initialize();
    const markings = markingRecipe('keyboard');
    return { settings: settings.getAll(), textBlocks: [], graphicsBlocks: [{ id, name: 'Markings', isBuiltIn: id === 'icons', markings, ...buildMarkingGroup(markings), heightInModules: 1.25 }] };
};
const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-6, `${a} != ${b}`);

test('catalog entries retain traceable original contours and standalone vectors', async () => {
    assert.equal(MARKING_CATALOG_V1.length, 7);
    for (const entry of MARKING_CATALOG_V1) {
        const original = await readFile(new URL(`../${entry.source}`, import.meta.url));
        assert.equal(createHash('sha256').update(original).digest('hex'), entry.sourceSha256);
        const standalone = await readFile(new URL(`../graphics/markings/${entry.id}.svg`, import.meta.url), 'utf8');
        assert.ok(standalone.includes(entry.svgContent));
        assert.ok(entry.width > 0 && entry.height > 0);
        assert.doesNotMatch(entry.svgContent, /<(image|text|clipPath|mask|script)\b/i);
        assert.ok(Object.isFrozen(entry));
    }
});

test('horizontal marking layout preserves order, equal icon heights, gaps and disabled membership', () => {
    const recipe = markingRecipe('handling'); recipe.items.unshift({ id: 'pap20-v1', enabled: false }); recipe.gap = 0.5;
    const artwork = buildMarkingGroup(recipe);
    const [glass, umbrella] = ['fragile-v1','keep-dry-v1'].map(id => MARKING_CATALOG_V1.find(item => item.id === id));
    close(artwork.originalWidth, 100*glass.width/glass.height + 50 + 100*umbrella.width/umbrella.height);
    assert.equal(artwork.originalHeight, 100);
    assert.ok(artwork.svgContent.indexOf('fragile-v1') < artwork.svgContent.indexOf('keep-dry-v1'));
    assert.ok(!artwork.svgContent.includes('pap20-v1'));
    assert.equal(recipe.items.length, 3);
});

test('vertical marking layout aligns unequal widths without stretching signs', () => {
    const recipe = { ...markingRecipe('handling'), direction: 'column', align: 'end', gap: 0.25 };
    const artwork = buildMarkingGroup(recipe);
    assert.equal(artwork.originalHeight, 225);
    const transforms = [...artwork.svgContent.matchAll(/data-marking-id="([^"]+)" transform="translate\(([^ ]+) ([^)]+)\) scale\(([^)]+)\)/g)];
    assert.equal(transforms.length, 2);
    for (const transform of transforms) {
        const item = MARKING_CATALOG_V1.find(item => item.id === transform[1]);
        close(Number(transform[2]) + item.width * Number(transform[4]), artwork.originalWidth);
        close(item.height * Number(transform[4]), 100);
    }
    assert.equal(Number(transforms[1][3]), 125);
});

test('recipes reject missing, repeated or wholly disabled signs and invalid layout values', () => {
    for (const corrupt of [
        recipe => { recipe.version = 99; }, recipe => { recipe.items[0].id = 'unknown-v1'; },
        recipe => { recipe.items.push({ ...recipe.items[0] }); }, recipe => { recipe.items.forEach(item => item.enabled = false); },
        recipe => { recipe.gap = -1; }, recipe => { recipe.direction = 'wrap'; }, recipe => { recipe.align = 'stretch'; }
    ]) {
        const recipe = markingRecipe(); corrupt(recipe); assert.throws(() => assertMarkingRecipe(recipe));
    }
});

test('custom and legacy-slot marking groups round-trip through JSON and regenerate canonical artwork', () => {
    const format = new PresetFormatAdapter();
    for (const id of ['group','icons']) {
        const input = source(id), doc = format.organize(input);
        const saved = id === 'icons' ? doc.graphics.icons : doc.graphics.blocks[0];
        saved.svg = '<path d="M0 0"/>'; saved.originalWidth = 999;
        const restored = format.normalize(doc).graphicsBlocks[0];
        assert.deepEqual(restored.markings, input.graphicsBlocks[0].markings);
        assert.equal(restored.svgContent, input.graphicsBlocks[0].svgContent);
        assert.equal(restored.originalWidth, input.graphicsBlocks[0].originalWidth);
        assert.equal(restored.heightInModules, 1.25);
        assert.equal(restored.isBuiltIn, id === 'icons');
    }
});

test('shared marking groups contain only recipes and reconstruct without image assets', async () => {
    const input = source(), codec = new PresetShareCodec();
    const prepared = codec.prepare(input);
    assert.equal(prepared.document.graphics.blocks[0].svg, '');
    assert.ok(!prepared.document.graphics.blocks[0].missingAsset);
    assert.equal(Object.keys(prepared.refs).length, 0);
    const decoded = await codec.decode(await codec.encode(input));
    assert.equal(decoded.missing, 0);
    assert.equal(decoded.data.graphicsBlocks[0].svgContent, input.graphicsBlocks[0].svgContent);
    assert.deepEqual(decoded.data.graphicsBlocks[0].markings, input.graphicsBlocks[0].markings);
});

test('preset boundary rejects conflicting image data and unrecognized recipe fields', () => {
    const format = new PresetFormatAdapter();
    for (const corrupt of [
        group => { group.missingAsset = true; },
        group => { group.raster = { dataUrl: '', width: 100, height: 100 }; },
        group => { group.markings.items[0].id = 'external.svg'; },
        group => { group.markings.svg = '<svg/>'; }
    ]) {
        const doc = format.organize(source()); corrupt(doc.graphics.blocks[0]);
        assert.throws(() => format.normalize(doc));
    }
});

test('initial built-in loading cannot overwrite an edited marking group', async () => {
    const block = source('icons').graphicsBlocks[0]; let loads = 0;
    const controller = new BuiltInGraphicsController({ objectDocument: { getGraphicsBlock: () => block }, assetController: { load: async () => { loads++; } } });
    assert.deepEqual(await controller.loadAndApply({ id: 'icons', path: 'graphics/icons.svg' }), { id: 'icons', loaded: false, skipped: true });
    assert.equal(loads, 0);
});
