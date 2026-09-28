import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, toBytes, create, FONT_FILES, createProbeDocument, generateProbe } from '../experiments/pdf/runtime/engine.js';
import { paragraphsOf } from '../experiments/pdf/SemanticPdfProbe.js';

async function loadFonts() {
    return Object.fromEntries(await Promise.all(Object.entries(FONT_FILES).map(async ([id, name]) => {
        const font = create(new Uint8Array(await readFile(new URL(`../fonts/${name}`, import.meta.url))));
        return [id, id === 'display' ? font.getVariation({ wght: 400 }) : font];
    })));
}

test('PDF semantic paragraphs preserve blank lines, NBSP and forced line breaks', () => {
    assert.deepEqual(paragraphsOf('A\r\n\r\n250\u00a0г\u2028B\n'), ['A', '', '250\u00a0г\u2028B', '']);
});

test('PDF probe creates both variants from actual fonts without mutating the semantic document', async () => {
    const model = createProbeDocument();
    const original = structuredClone(model);
    const fonts = await loadFonts();
    for (const tagged of [true, false]) {
        const { bytes, report } = await generateProbe({ PDFDocument, toBytes, fonts, model, tagged });
        assert.ok(bytes.length > 40000);
        const source = new TextDecoder().decode(bytes);
        assert.ok(source.startsWith('%PDF-1.7'));
        assert.equal(source.includes('/StructTreeRoot'), tagged);
        assert.equal(source.includes('/ClassMap'), tagged);
        assert.equal(source.includes('/ToUnicode'), true);
        assert.equal(source.includes('/FontFile3'), true); // Original CFF fonts
        assert.equal(source.includes('/FontFile2'), true); // Instantiated Lunnen
        assert.equal(source.includes('/Illustrator'), false); // No native AI claim
        assert.equal(report.length, 20);
        assert.equal(report.find(frame => frame.id === 'body-frame').emptyParagraphs, 1);
        assert.deepEqual(report.filter(f => f.rotation).map(f => f.rotation), [90, 270, 180]);
    }
    assert.deepEqual(model, original);
});

test('PDF probe refuses an overflowing frame rather than silently clipping text', async () => {
    const model = createProbeDocument();
    model.pages[0].frames.find(frame => frame.id === 'body-frame').height = 1;
    await assert.rejects(generateProbe({ PDFDocument, toBytes, fonts: await loadFonts(), model }), /overflows body-frame/);
});
