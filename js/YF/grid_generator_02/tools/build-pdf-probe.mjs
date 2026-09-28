import { createHash } from 'node:crypto';
import { build } from 'vite';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const tools = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(tools, '../experiments/pdf');
const outDir = path.join(root, 'runtime');
const inputs = [
    ...['ProbeDocument.js', 'ProbeEntry.js', 'ProbeRuntime.js', 'SemanticPdfProbe.js', 'index.html'].map(file => path.join(root, file)),
    fileURLToPath(import.meta.url), path.join(tools, 'package-lock.json')
];
const fingerprint = createHash('sha256');
for (const file of inputs) fingerprint.update(path.relative(root, file)).update(await readFile(file));
const sourceHash = fingerprint.digest('hex');
if (process.argv.includes('--check')) {
    const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'));
    if (manifest.sourceHash !== sourceHash) throw new Error('PDF probe build is stale; run npm run pdf:probe');
    for (const [file, expected] of Object.entries(manifest.outputs)) {
        if (createHash('sha256').update(await readFile(path.join(outDir, file))).digest('hex') !== expected)
            throw new Error(`PDF probe asset changed: ${file}`);
    }
    console.log('PDF probe source and runtime agree.');
    process.exit(0);
}
await build({ configFile: false, root, publicDir: false, logLevel: 'warn',
    plugins: [{ name: 'fontkit-2.0.4-variable-subset-fix', transform(source, id) {
        if (!id.endsWith('/fontkit/dist/browser-module.mjs')) return null;
        // fontkit 2.0.4 passes a byte count to restructure 3's buffer constructor.
        // Allocate the Uint8Array explicitly. Keep compatibility patches
        // confined to the research bundle; never edit installed dependencies.
        const pattern = /new ([\w$]*EncodeStream)\(size \+ tail\)/gu;
        if ([...source.matchAll(pattern)].length !== 1) throw new Error('Review fontkit subset compatibility patch');
        source = source.replace(pattern, 'new $1(new Uint8Array(size + tail))');
        // Composite variable glyphs also need instantiated paths; copying their
        // original components loses the selected weight/positions.
        const compound = 'if (glyf && glyf.numberOfContours < 0) {';
        if (source.split(compound).length !== 2) throw new Error('Review fontkit composite subset patch');
        source = source.replace(compound, 'if (glyf && glyf.numberOfContours < 0 && !this.font._variationProcessor) {');
        // A component may enter the glyph cache without Unicode before it is
        // used as text (Latin e in Lunnen). Restore that first actual mapping.
        const getter = 'getGlyph(glyph, characters = []) {';
        if (source.split(getter).length !== 2) throw new Error('Review fontkit Unicode cache patch');
        source = source.replace(getter, getter + '\nif (characters.length && this._glyphs[glyph] && !this._glyphs[glyph].codePoints.length) this._glyphs[glyph].codePoints.push(...characters);');
        // Flush the final repeated-point flag run (otherwise e.g. u.ss01 and
        // zero.tnum produce malformed glyf bytes). Instantiated paths have new
        // point indices, so original TrueType hint instructions cannot survive.
        const bbox = 'let bbox = path.bbox;';
        if (source.split(bbox).length !== 2) throw new Error('Review fontkit final flag patch');
        source = source.replace(bbox, 'if (same > 0) flags.push(same); ' + bbox);
        source = source.replace('this.glyphEncoder.encodeSimple(glyph.path, glyf.instructions)', 'this.glyphEncoder.encodeSimple(glyph.path, [])');
        source = source.replace('let tail = 4 - size % 4;', 'let tail = (4 - size % 4) % 4;');
        return { code: source, map: null };
    } }],
    resolve: { alias: {
        'pdfkit/output': path.join(tools, 'node_modules/pdfkit/js/output.mjs'),
        pdfkit: path.join(tools, 'node_modules/pdfkit/js/pdfkit.browser.mjs'),
        fontkit: path.join(tools, 'node_modules/fontkit/dist/browser-module.mjs')
    } },
    build: { outDir, emptyOutDir: true, target: ['chrome120', 'safari17'],
        rollupOptions: { input: { probe: path.join(root, 'ProbeEntry.js'), engine: path.join(root, 'ProbeRuntime.js') },
            preserveEntrySignatures: 'strict', output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' } },
        minify: true }
});
// Keep the complete license notices of every bundled package alongside the probe.
const notices = new Map();
async function collect(name, parent = tools) {
    if (notices.has(name)) return;
    const packagePath = path.join(parent, 'node_modules', name, 'package.json');
    const resolved = await readFile(packagePath, 'utf8').catch(() => null);
    const dir = resolved ? path.dirname(packagePath) : path.join(tools, 'node_modules', name);
    const pkg = JSON.parse(resolved || await readFile(path.join(dir, 'package.json'), 'utf8'));
    let license = '';
    for (const filename of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT.txt', 'LICENSE-MIT', 'license', 'LICENSE-MIT.md']) {
        license = await readFile(path.join(dir, filename), 'utf8').catch(() => '');
        if (license) break;
    }
    if (!license) {
        const author = typeof pkg.author === 'object' ? pkg.author.name : pkg.author || 'See upstream repository';
        license = `Declared license: ${pkg.license}. Author: ${author}.\nThis npm package does not include a separate license file.\nUpstream: ${typeof pkg.repository === 'object' ? pkg.repository.url : pkg.repository}\n`;
    }
    notices.set(name, `${name} ${pkg.version}\n${license}`);
    for (const dependency of Object.keys(pkg.dependencies || {})) await collect(dependency, dir);
}
await collect('pdfkit');
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'LICENSES.txt'), [...notices.values()].join('\n\n---\n\n'));
console.log(`PDF probe built separately from the editor (${notices.size} license notices).`);

const outputs = {};
for (const file of (await readdir(outDir)).sort()) outputs[file] = createHash('sha256').update(await readFile(path.join(outDir, file))).digest('hex');
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify({ sourceHash, outputs }, null, 2) + '\n');
