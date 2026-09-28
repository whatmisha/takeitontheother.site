import test from 'node:test';
import assert from 'node:assert/strict';
import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { PresetShareCodec } from '../src/preset/PresetShareCodec.js';
import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';
import { previewSize } from '../src/elements/RasterAsset.js';

const source = () => {
    const settings = new Settings({ constructionType: 'telescopic-tube', frontWidth: Math.PI * 100, frontHeight: 180 });
    new SurfaceManager(settings).initialize();
    return { settings: settings.getAll(), textBlocks: [{ id: 'text-1', content: 'Фото\nВторая строка', width: 2.75 }], graphicsBlocks: [
        { id: 'photo', name: 'Photo.png', originalWidth: 800, originalHeight: 600, raster: { dataUrl: 'data:image/png;base64,AABB', width: 1024, height: 768, fit: 'cover' } },
        { id: 'vector', svgContent: '<path d="M0 0L5 5"/>', originalWidth: 20, originalHeight: 10 },
        { id: 'library', svgContent: '<rect width="10" height="10"/>', originalWidth: 10, originalHeight: 10 }
    ] };
};

test('share round-trip preserves layout, typography and frames while excluding binary assets', async () => {
    const input = source();
    const codec = new PresetShareCodec({ catalog: new Map([['logo-v1', input.graphicsBlocks[2].svgContent]]) });
    const payload = codec.prepare(input, { outlineFonts: true });
    assert.equal(payload.document.graphics.blocks[0].raster.dataUrl, '');
    assert.ok(payload.document.graphics.blocks.every(block => block.svg === ''));
    assert.equal(input.graphicsBlocks[0].raster.dataUrl, 'data:image/png;base64,AABB');
    const restored = await codec.decode(await codec.encode(input, { outlineFonts: true }));
    assert.equal(restored.data.textBlocks[0].content, input.textBlocks[0].content);
    assert.equal(restored.data.settings.frontWidth, Math.PI * 100);
    assert.equal(restored.missing, 2);
    assert.equal(restored.outlineFonts, true);
    assert.equal(restored.data.graphicsBlocks[0].raster.fit, 'cover');
    assert.equal(restored.data.graphicsBlocks[2].svgContent, input.graphicsBlocks[2].svgContent);
});

test('full JSON retains raster preview and frame independently of source aspect ratio', () => {
    const format = new PresetFormatAdapter();
    const input = source(); input.graphicsBlocks[0].originalWidth = 600;
    const data = format.normalize(JSON.parse(JSON.stringify(format.organize(input))));
    assert.equal(data.graphicsBlocks[0].raster.dataUrl, input.graphicsBlocks[0].raster.dataUrl);
    assert.equal(data.graphicsBlocks[0].originalWidth, data.graphicsBlocks[0].originalHeight);
    assert.equal(data.graphicsBlocks[0].raster.width, 1024);
});

test('invalid or mismatched links do not produce a document', async () => {
    const codec = new PresetShareCodec();
    await assert.rejects(codec.decode('not-a-link'), /not a supported/);
    const prepared = codec.prepare(source()); prepared.shareVersion = 99;
    await assert.rejects(codec.decode(await codec.codec.encode(prepared)), /not a supported/);
    prepared.shareVersion = 1; prepared.refs = { 0: 'missing-catalog-entry' };
    await assert.rejects(codec.decode(await codec.codec.encode(prepared)), /unavailable/);
});

test('raster schema accepts only local preview image data, never remote URLs or SVG payloads', () => {
    const format = new PresetFormatAdapter(), doc = format.organize(source());
    for (const dataUrl of ['https://example.org/tracker.png', 'data:image/svg+xml;base64,AABB', 'javascript:alert(1)']) {
        doc.graphics.blocks[0].raster.dataUrl = dataUrl;
        assert.throws(() => format.normalize(doc));
    }
});

test('preview sizing bounds memory and preserves the aspect ratio without upscaling', () => {
    assert.deepEqual(previewSize(4000, 2000), { width: 1024, height: 512 });
    assert.deepEqual(previewSize(200, 300), { width: 200, height: 300 });
    assert.throws(() => previewSize(0, 100));
    assert.throws(() => previewSize(10000, 10000));
});
