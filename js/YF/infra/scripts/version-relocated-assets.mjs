// One-time cache transition for restored clean URLs. Dry run unless --apply.
// Propagates only changed module/style dependencies to their existing parents;
// never changes algorithms, vendor files, historical snapshots or donor files.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
const catalog = JSON.parse(await readFile(new URL('../TOOL_CATALOG.json', import.meta.url), 'utf8'));
const evidence = JSON.parse(await readFile(new URL('../qa/ROOT_LAYOUT_RELOCATION.json', import.meta.url), 'utf8'));
const oldHashes = new Map(evidence.files.map(file => [file.to, file.sha256]));
const files = new Map(), changed = new Set();
const version = 'root-infra-1';
const ignored = new Set(['node_modules', 'build', 'runtime', 'vendor', 'docs', 'plans', 'tests', 'test', 'analysis', 'benchmarks', 'tools']);
async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory() && !ignored.has(entry.name)) await visit(file);
        else if (entry.isFile() && /\.(?:js|mjs|css|html)$/.test(entry.name)) {
            const source = await readFile(file, 'utf8'), name = path.relative(root, file);
            files.set(file, { original: source, next: source });
            if (oldHashes.has(name) && createHash('sha256').update(source).digest('hex') !== oldHashes.get(name)) changed.add(file);
        }
    }
}
for (const tool of catalog.tools) await visit(path.join(root, tool.id));
function update(file, source) {
    const reference = (all, prefix, quote, value) => {
        if (/^(?:[a-z]+:|\/\/|#)/i.test(value) || value.includes('${')) return all;
        const target = path.resolve(path.dirname(file), value.split(/[?#]/)[0]);
        if (!changed.has(target) || !files.has(target) || !/\.(?:m?js|css)$/.test(target)) return all;
        const url = new URL(value, 'http://local.invalid/');
        if (url.searchParams.get('layout') === version) return all;
        const [beforeHash, hash] = value.split('#');
        return prefix + quote + beforeHash + (beforeHash.includes('?') ? '&' : '?') + `layout=${version}` + (hash === undefined ? '' : '#' + hash) + quote;
    };
    let next = source.replace(/((?:\bfrom\s*|\bimport\s*(?:\(\s*)?|new URL\(\s*))(['"])([^'"\n]+)\2/g, reference);
    if (file.endsWith('.html')) next = next.replace(/((?:src|href)=)(['"])([^'"]+)\2/g, reference);
    if (file.endsWith('.css')) next = next.replace(/(@import\s+(?:url\(\s*)?)(['"])([^'"]+)\2/g, reference);
    return next;
}
let progress;
do {
    progress = false;
    for (const [file, state] of files) {
        const next = update(file, state.next);
        if (next !== state.next) { state.next = next; changed.add(file); progress = true; }
    }
} while (progress);
const edits = [...files].filter(([, state]) => state.original !== state.next);
console.log(edits.map(([file]) => path.relative(root, file)).join('\n'));
if (process.argv.includes('--apply')) {
    for (const [file, state] of edits) if (await readFile(file, 'utf8') !== state.original) throw Error(`Concurrent edit: ${file}`);
    for (const [file, state] of edits) await writeFile(file, state.next);
    console.log(`Versioned dependency edges in ${edits.length} files.`);
}
