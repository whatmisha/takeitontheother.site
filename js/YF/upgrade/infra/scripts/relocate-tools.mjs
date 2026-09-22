// One-time, mechanical layout migration. Defaults to a read-only preview.
// Does not touch donor folders, historical manifests, generated bundles or artwork.
import { readdir, readFile, writeFile, lstat, readlink, realpath, mkdir, rename, unlink, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(await readFile(path.join(root, 'TOOL_CATALOG.json'), 'utf8'));
const ids = catalog.tools.map(tool => tool.id);
const active = catalog.tools.filter(tool => tool.state !== 'planned').map(tool => tool.id);
if (new Set(ids).size !== ids.length || ids.some(id => !/^[a-z][a-z0-9_-]*$/.test(id))) throw new Error('Invalid tool ids');
const apply = process.argv.includes('--apply');
const ignored = new Set(['node_modules', 'build', 'runtime', '.git', 'vendor', 'docs', 'plans', 'benchmarks', 'fonts']);
const edits = [], links = [];
const inside = candidate => candidate === root.slice(0, -1) || candidate.startsWith(root);
const relocated = absolute => {
    const relative = path.relative(root, absolute);
    return active.some(id => relative === id || relative.startsWith(`${id}/`)) ? path.join(root, 'tools', relative) : absolute;
};
const pathLiteral = new RegExp(`(['"\x60])((?:\\.\\.?/)*)(?:(${ids.join('|')}))/`, 'g');

try {
    const destination = await lstat(path.join(root, 'tools'));
    if (!destination.isDirectory() || destination.isSymbolicLink()) throw new Error('tools/ must be a real internal directory');
} catch (error) { if (error.code !== 'ENOENT') throw error; }

for (const id of active) {
    if (!((await lstat(path.join(root, id))).isDirectory())) throw new Error(`Not a directory: ${id}`);
    try { await lstat(path.join(root, 'tools', id)); throw new Error(`Destination already exists: tools/${id}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function visit(directory, app = null, scanText = true) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) {
            const original = await readlink(file);
            const target = path.resolve(path.dirname(file), original);
            if (!inside(await realpath(file)) || !inside(target)) throw new Error(`External dependency: ${file}`);
            const next = path.relative(path.dirname(relocated(file)), relocated(target));
            if (original !== next) links.push({ file: relocated(file), original, next });
        } else if (entry.isDirectory() && entry.name !== '.git') {
            await visit(file, app, scanText && !ignored.has(entry.name));
        } else if (scanText && /\.(?:m?js|css|html|json)$/.test(entry.name) && !['package-lock.json', 'generate-source-manifest.mjs'].includes(entry.name) && file !== fileURLToPath(import.meta.url)) {
            const original = await readFile(file, 'utf8');
            let next = original;
            if (app) {
                // FrameworkAdapter.js is app-private; only shared framework subtrees move further away.
                next = next.replace(/((?:\.\.\/)+)framework\/(src|css|fonts|vendor)\//g, '../$1framework/$2/');
                next = next.replace(/href=(["'])\.\.\/\1/g, 'href=$1../../$1');
            } else {
                next = next.replace(pathLiteral, '$1$2tools/$3/');
            }
            if (next !== original) edits.push({ file, original, next });
        }
    }
}

for (const id of active) await visit(path.join(root, id), id);
for (const directory of ['scripts', 'catalog', 'qa/ui-audit', 'qa/ui-host', 'framework/tests']) await visit(path.join(root, directory));
// Also resolve links owned by framework/development tooling, not only links inside apps.
await visit(root, null, false);
for (const name of ['TOOL_CATALOG.json', 'APPLICATION_CAPABILITIES.json', 'package.json']) {
    const file = path.join(root, name), original = await readFile(file, 'utf8');
    let next;
    if (name === 'package.json') {
        const data = JSON.parse(original);
        for (const key of Object.keys(data.scripts)) {
            data.scripts[key] = data.scripts[key].replace(new RegExp(`(^|[ /])(${ids.join('|')})(?=/|(?=\\s|$))`, 'g'), '$1tools/$2');
        }
        next = JSON.stringify(data, null, 2) + '\n';
    } else next = original.replace(pathLiteral, '$1$2tools/$3/');
    if (next !== original) edits.push({ file, original, next });
}

console.log(JSON.stringify({ directories: active.map(id => `${id} -> tools/${id}`), changedFiles: edits.map(edit => path.relative(root, edit.file)), links }, null, 2));
if (apply) {
    // Validate again before any write; never overwrite concurrent edits.
    for (const edit of edits) if (await readFile(edit.file, 'utf8') !== edit.original) throw new Error(`Concurrent edit: ${edit.file}`);
    for (const edit of edits) await writeFile(edit.file, edit.next);
    await mkdir(path.join(root, 'tools'), { recursive: true });
    for (const id of active) await rename(path.join(root, id), path.join(root, 'tools', id));
    for (const link of links) {
        if (!((await lstat(link.file)).isSymbolicLink()) || await readlink(link.file) !== link.original) throw new Error(`Changed symlink: ${link.file}`);
        await unlink(link.file);
        await symlink(link.next, link.file);
    }
    console.log('Moved tools; rebuild Pizza Boxer and run layout/runtime checks before finishing.');
}
