import test from 'node:test';
import assert from 'node:assert/strict';
import { Settings } from '../src/core/Settings.js';
import { SurfaceManager } from '../src/surfaces/SurfaceManager.js';
import { TextStyleResolver } from '../src/elements/TextStyleResolver.js';
import { PresetFormatAdapter } from '../src/preset/PresetFormatAdapter.js';
import { PresetShareCodec } from '../src/preset/PresetShareCodec.js';
import { TextBlockRenderModel } from '../src/elements/TextBlockRenderModel.js';
import { TextLayout } from '../src/elements/TextLayout.js';
import { uniqueStyleName } from '../src/elements/CustomTextStyles.js';

const style = { id: 'custom-test', name: 'Инструкция', fontFamily: 'TT Commons Classic', fontWeight: 400, size: 0.875, lineHeight: 1.375, tracking: 0.012, useXHeight: true };
const document = () => {
    const settings = new Settings({ gridModule: 5, customTextStyles: [{ ...style }] });
    new SurfaceManager(settings).initialize();
    return { settings: settings.getAll(), textBlocks: [{ id: 'instructions', content: 'Текст\nАбзац', styleRef: style.id, width: 3 }], graphicsBlocks: [] };
};
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-9, `${a} != ${b}`);

test('custom style metrics follow its font and surface module without changing the definition', () => {
    const settings = new Settings(document().settings), resolver = new TextStyleResolver(settings);
    close(resolver.calculateFontSize(style.id), 5 * style.size * 1000 / 447);
    close(resolver.calculateFontSize(style.id, null, 2), 2 * style.size * 1000 / 447);
    close(resolver.fontSizeMmToModules(resolver.calculateFontSize(style.id), style.id), style.size);
    assert.equal(resolver.getStyleSettings(style.id).fontWeight, 400);
    resolver.getDefinition(style.id).size = 50;
    assert.equal(settings.get('customTextStyles')[0].size, style.size);
    const geometry = new TextBlockRenderModel({ settings, getFontMetrics: id => resolver.getFontMetrics(id) });
    close(geometry.calculateGlyphMetrics(style.id, true, 2, 3).xHeight, style.size * 6);
});

test('custom style names, definitions and paragraph references survive JSON and share round trips', async () => {
    const format = new PresetFormatAdapter(), input = document();
    const normalized = format.normalize(JSON.parse(JSON.stringify(format.organize(input))));
    assert.deepEqual(normalized.settings.customTextStyles, input.settings.customTextStyles);
    assert.equal(normalized.textBlocks[0].styleRef, style.id);
    const codec = new PresetShareCodec();
    const shared = await codec.decode(await codec.encode(input));
    assert.deepEqual(shared.data.settings.customTextStyles, input.settings.customTextStyles);
    assert.equal(shared.data.textBlocks[0].content, 'Текст\nАбзац');
    assert.equal(shared.data.textBlocks[0].styleRef, style.id);
});

test('import rejects dangling styles, duplicate identities/names, invalid font parameters and excessive definitions', () => {
    const format = new PresetFormatAdapter();
    for (const corrupt of [
        doc => { doc.texts[0].style = 'custom-missing'; },
        doc => { doc.typography.customStyles.push({ ...style }); },
        doc => { doc.typography.customStyles[0].name = '  '; },
        doc => { doc.typography.customStyles[0].name = ' Text '; },
        doc => { doc.typography.customStyles[0].fontFamily = 'Missing font'; },
        doc => { doc.typography.customStyles[0].fontWeight = 300; },
        doc => { Object.assign(doc.typography.customStyles[0], { fontFamily: 'Lunnen Display', fontWeight: 500 }); },
        doc => { doc.typography.customStyles[0].size = 0; },
        doc => { doc.typography.customStyles = Array(65).fill(style); }
    ]) {
        const doc = format.organize(document()); corrupt(doc);
        assert.throws(() => format.normalize(doc));
    }
});

test('documents without custom styles normalize to an empty list and unique names stay short', () => {
    const format = new PresetFormatAdapter(), doc = format.organize(document());
    doc.texts[0].style = 'text'; delete doc.typography.customStyles;
    assert.deepEqual(format.normalize(doc).settings.customTextStyles, []);
    assert.equal(uniqueStyleName('Text copy', [{ name: 'text COPY' }, { name: 'Text copy 2' }]), 'Text copy 3');
    assert.ok(uniqueStyleName('A'.repeat(80), []).length <= 80);
});

test('line wrapping measures the chosen family and weight', () => {
    const context = { font: '', measureText: text => ({ width: text.length * (context.font.startsWith('400') ? 3 : 6) }) };
    const layout = new TextLayout({ createMeasurementContext: () => context });
    assert.deepEqual(layout.wrapText('one two', 23, 10, 1, 0, { fontFamily: 'Lunnen Display', fontWeight: 400 }), ['one two']);
    assert.match(context.font, /^400 10px 'Lunnen Display'/);
    assert.deepEqual(layout.wrapText('one two', 23, 10, 1, 0, { fontFamily: 'TT Commons Classic', fontWeight: 500 }), ['one', 'two']);
});
