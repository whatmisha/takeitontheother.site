// One-time mechanical relocation; dry run unless --apply is explicitly supplied.
// Targets only upgrade. Existing files and unpublished edits move together.
import { readdir, readFile, writeFile, lstat, readlink, realpath, mkdir, rename, unlink, symlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalog = JSON.parse(await readFile(path.join(root, 'TOOL_CATALOG.json'), 'utf8'));
const ids = catalog.tools.map(tool => tool.id);
const infraDirs = ['baselines', 'catalog', 'docs', 'extracted', 'framework', 'qa', 'releases', 'scripts'];
const infraFiles = (await readdir(root)).filter(name => /^[A-Z_]+\.json$/.test(name));
const moves = [...ids.map(id => [`tools/${id}`, id]), ...[...infraDirs, ...infraFiles].map(name => [name, `infra/${name}`])];
const ownFile = fileURLToPath(import.meta.url);
const edits = [], links = [], inventory = [];
const inside = value => value === root || value.startsWith(root + path.sep);
const hash = value => createHash('sha256').update(value).digest('hex');
function relocated(relative) {
    for (const [from, to] of moves) if (relative === from || relative.startsWith(from + '/')) return to + relative.slice(from.length);
    return relative;
}
const absoluteAfter = file => path.join(root, relocated(path.relative(root, file)));
await assertMissing(path.join(root, 'infra'));
for (const [from, to] of moves) {
    const stat = await lstat(path.join(root, from));
    if (stat.isSymbolicLink()) throw Error(`Cannot relocate symlink root: ${from}`);
    await assertMissing(path.join(root, to));
}
for (const entry of await readdir(path.join(root, 'tools'))) {
    if (!ids.includes(entry) && entry !== '.DS_Store') throw Error(`Unexpected tools entry: ${entry}`);
}
async function assertMissing(file) {
    try { await lstat(file); throw Error(`Destination exists: ${file}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
}

// Apply this only to file-relative URLs, not to donor evidence or runtime data.
function relativeURL(file, value) {
    if (!value.startsWith('.') || value.includes('${')) return value;
    const [pathname, suffix = ''] = value.split(/(?=[?#])/s, 2);
    const target = path.resolve(path.dirname(file), pathname);
    if (!inside(target)) return value;
    let next = path.relative(path.dirname(absoluteAfter(file)), absoluteAfter(target)) || '.';
    if (!next.startsWith('.')) next = './' + next;
    if (pathname.endsWith('/') && !next.endsWith('/')) next += '/';
    return next + suffix;
}

function transform(file, original) {
    const name = path.relative(root, file);
    const app = name.startsWith('tools/');
    let next = original;
    // Static imports, file-relative URL anchors, and HTML/CSS paths.
    next = next.replace(/((?:from\s*|import\s*|import\(\s*)(['"]))([^'"\n]+)\2/g,
        (all, prefix, quote, value) => prefix + relativeURL(file, value) + quote);
    next = next.replace(/(new URL\(\s*(['"]))([^'"\n]+)\2(?=\s*,\s*import\.meta\.url)/g,
        (all, prefix, quote, value) => prefix + relativeURL(file, value) + quote);
    if (/\.(?:css|html)$/.test(name)) {
        next = next.replace(/((?:href|src)=(["']))([^"']+)\2/g, (all, prefix, quote, value) => {
            if (app && value === '../../') return prefix + '../' + quote;
            return prefix + relativeURL(file, value) + quote;
        });
        next = next.replace(/(url\(\s*["']?)([^"')\s]+)(["']?\s*\))/g, (all, prefix, value, end) => prefix + relativeURL(file, value) + end);
    }
    // Page-relative dynamic assets in app scripts and template strings. Static
    // imports already have infra/ and therefore cannot be transformed twice.
    if (app) next = next.replace(/((?:\.\.\/)+)framework\/(src|css|fonts|vendor|styles)\//g,
        (all, prefix, subtree) => prefix.slice(3) + 'infra/framework/' + subtree + '/');
    if (!app) {
        next = next.replace(/(['"`])((?:\.\.\/)+)tools\/([^'"`\n]*)/g,
            (all, quote, prefix, rest) => quote + '../' + prefix + rest);
        next = next.replace(/(['"`])tools\//g, '$1');
        const infrastructure = [...infraDirs, ...infraFiles].join('|');
        next = next.replace(new RegExp(`(['"\x60])(${infrastructure})(?=/|#|['"\x60])`, 'g'), '$1infra/$2');
        // Top-level script roots expressed with dirname rather than URL.
        next = next.replace(/(const (?:upgradeRoot|root) = )path\.dirname\(scriptDir\)/g, '$1path.dirname(path.dirname(scriptDir))');
        next = next.replace(/(const (?:upgradeRoot|root) = )path\.dirname\(path\.dirname\(fileURLToPath\(import\.meta\.url\)\)\)/g,
            '$1path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))');
    }
    if (name === 'package.json') {
        const data = JSON.parse(original);
        for (const key of Object.keys(data.scripts)) {
            data.scripts[key] = data.scripts[key]
                .replace(/\btools\/(?=(?:sparky|grid_generator|label_generator|keyboarder|wordplayer|dither|wander_bender|pulsar_coder)\b)/g, '')
                .replace(/(^|[ /])(?=(?:scripts|catalog|qa|framework)(?:\/|\s|$))/g, '$1infra/');
        }
        next = JSON.stringify(data, null, 2) + '\n';
    }
    return next;
}
const activeInfra = name => /^(?:scripts|catalog)\//.test(name)
    || /^framework\/(?:tests|component-lab)\//.test(name)
    || /^qa\/.*\.(?:html|css|m?js)$/.test(name)
    || name === 'qa/migrations/batch7/ui-text-patches.json'
    || ['index.html', 'package.json', 'TOOL_CATALOG.json', 'APPLICATION_CAPABILITIES.json'].includes(name);
const ignoredText = /(?:^|\/)(?:node_modules|build|runtime|vendor|upstream-v3|docs|plans|benchmarks|fonts)\//;
async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name), name = path.relative(root, file);
        if (entry.isSymbolicLink()) {
            const original = await readlink(file), target = path.resolve(path.dirname(file), original);
            if (!inside(target) || !inside(await realpath(file))) throw Error(`External link: ${name}`);
            const next = path.relative(path.dirname(absoluteAfter(file)), absoluteAfter(target));
            if (original !== next) links.push({ file: absoluteAfter(file), original, next });
        } else if (entry.isDirectory()) await visit(file);
        else if (entry.isFile() && !name.includes('/node_modules/') && !name.includes('/build/')) {
            const data = await readFile(file);
            inventory.push({ from: name, to: relocated(name), sha256: hash(data) });
            if (file === ownFile || name === 'scripts/relocate-tools.mjs' || ignoredText.test(name)) continue;
            if (!/\.(?:m?js|css|html|json)$/.test(name) || name.endsWith('package-lock.json')) continue;
            if (!name.startsWith('tools/') && !activeInfra(name)) continue;
            const original = data.toString('utf8'), next = transform(file, original);
            if (next !== original) edits.push({ file, original, next });
        }
    }
}
await visit(root);
// The only third-party change is the documented page-relative locale URL.
const p5File = path.join(root, 'framework/vendor/p5/1.4.0/lib/p5.js');
const p5Original = await readFile(p5File, 'utf8');
const p5Next = p5Original.replace('../../framework/vendor/p5/1.4.0/translations/', '../infra/framework/vendor/p5/1.4.0/translations/');
if (p5Next === p5Original) throw Error('Missing pinned p5 locale path');
edits.push({ file: p5File, original: p5Original, next: p5Next });
const manifestFile = path.join(root, 'framework/vendor/p5/MANIFEST.json');
const manifestOriginal = await readFile(manifestFile, 'utf8'), manifest = JSON.parse(manifestOriginal);
const core = manifest.packages.find(pkg => pkg.version === '1.4.0').files.find(file => file.path === 'lib/p5.js');
if (hash(p5Original) !== core.sha256) throw Error('p5 hash changed concurrently');
core.sha256 = hash(p5Next); core.bytes = Buffer.byteLength(p5Next);
edits.push({ file: manifestFile, original: manifestOriginal, next: JSON.stringify(manifest, null, 2) + '\n' });
console.log(JSON.stringify({ moves, edits: edits.map(edit => path.relative(root, edit.file)), symlinks: links.length, preservedFiles: inventory.length }, null, 2));
if (!process.argv.includes('--apply')) process.exit(0);
for (const edit of edits) if (await readFile(edit.file, 'utf8') !== edit.original) throw Error(`Concurrent edit: ${edit.file}`);
await mkdir(path.join(root, 'infra'));
for (const edit of edits) await writeFile(edit.file, edit.next);
for (const [from, to] of moves) await rename(path.join(root, from), path.join(root, to));
for (const link of links) {
    if (!(await lstat(link.file)).isSymbolicLink() || await readlink(link.file) !== link.original) throw Error('Concurrent symlink change');
    await unlink(link.file); await symlink(link.next, link.file);
}
// Preserve Finder metadata too; remove only the now-empty container.
if ((await readdir(path.join(root, 'tools'))).includes('.DS_Store')) await rename(path.join(root, 'tools/.DS_Store'), path.join(root, 'infra/.tools.DS_Store'));
await rmdir(path.join(root, 'tools'));
const changed = new Map(edits.map(edit => [relocated(path.relative(root, edit.file)), hash(edit.next)]));
for (const item of inventory) {
    if (item.from === 'tools/.DS_Store') item.to = 'infra/.tools.DS_Store';
    const expected = changed.get(item.to) || item.sha256;
    if (hash(await readFile(path.join(root, item.to))) !== expected) throw Error(`Relocation mismatch: ${item.to}`);
}
await writeFile(path.join(root, 'infra/qa/ROOT_LAYOUT_RELOCATION.json'), JSON.stringify({
    schemaVersion: 1, date: '2026-09-22', note: 'Pre-move working-tree hashes, including uncommitted changes. Mechanical moves verified immediately; subsequent build/path corrections are checked by tests.', files: inventory
}, null, 2) + '\n', { flag: 'wx' });
console.log('All inventoried files preserved. Update layout policy, rebuild Pizza Boxer and verify gates.');
