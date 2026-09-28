// QA only: run the same browser implementation to produce stable review artifacts.
// Browser/Node hashes must agree. This is never a product/server export endpoint.
import { PDFDocument, toBytes, create, FONT_FILES, createProbeDocument, generateProbe } from '../experiments/pdf/runtime/engine.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const output = new URL('output/pdf/', root);
await mkdir(output, { recursive: true });
const fonts = Object.fromEntries(await Promise.all(Object.entries(FONT_FILES).map(async ([key, file]) => {
    let font = create(new Uint8Array(await readFile(new URL(`fonts/${file}`, root))));
    if (key === 'display') font = font.getVariation({ wght: 400 });
    return [key, font];
})));
const model = createProbeDocument();
const hashes = {};
for (const tagged of [true, false]) {
    const { bytes, report } = await generateProbe({ PDFDocument, toBytes, fonts, model, tagged });
    const filename = `pdf-probe-${tagged ? 'tagged' : 'plain'}.pdf`;
    await writeFile(new URL(filename, output), bytes);
    hashes[filename] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    console.log(filename, hashes[filename], `${report.length} frames`);
}
await writeFile(new URL('hashes.json', output), JSON.stringify(hashes, null, 2) + '\n');

await writeFile(new URL('source.json', output), JSON.stringify(model, null, 2) + '\n');
