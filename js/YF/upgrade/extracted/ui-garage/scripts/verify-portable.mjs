import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcRoot = path.join(root, 'src');
const manifestPath = path.join(root, 'framework-manifest.json');
const ignoredNames = new Set(['framework-manifest.json']);

async function collectFiles(directory = root) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === '.DS_Store') throw new Error(`Finder metadata is not portable: ${path.join(directory, entry.name)}`);
        if (ignoredNames.has(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Symlinks are not portable: ${absolute}`);
        if (entry.isDirectory()) files.push(...await collectFiles(absolute));
        else if (entry.isFile()) files.push(absolute);
    }
    return files;
}

const portablePath = absolute => path.relative(root, absolute).split(path.sep).join('/');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const actualFiles = (await collectFiles()).sort();
const actualPaths = actualFiles.map(portablePath);
const declaredPaths = manifest.files.map(entry => entry.path);

const forbiddenIdentityFragments = [
    [['lun', 'nen'], false],
    [['other', 'site'], false],
    [['tt', 'commons'], true],
    [['yf', 'tools'], true]
];

for (const file of actualFiles) {
    const data = await readFile(file);
    const searchableContent = data.toString('latin1').toLowerCase();
    const searchablePath = portablePath(file).toLowerCase();

    for (const [fragments, ignoreSeparators] of forbiddenIdentityFragments) {
        const forbiddenIdentity = fragments.join('');
        const normalize = value => ignoreSeparators ? value.replace(/[\s_-]+/gu, '') : value;
        assert.ok(
            !normalize(searchableContent).includes(forbiddenIdentity)
                && !normalize(searchablePath).includes(forbiddenIdentity),
            `${portablePath(file)} contains a forbidden legacy identity`
        );
    }
}

assert.deepEqual(declaredPaths, actualPaths, 'Manifest file list is stale; run npm run manifest');
for (const entry of manifest.files) {
    const data = await readFile(path.join(root, entry.path));
    assert.equal(data.byteLength, entry.bytes, `${entry.path}: byte length changed`);
    assert.equal(sha256(data), entry.sha256, `${entry.path}: SHA-256 changed`);
}

const sourceFiles = actualFiles.filter(file => file.startsWith(`${srcRoot}${path.sep}`) && file.endsWith('.js'));
const starterFiles = actualFiles.filter(file => portablePath(file).startsWith('starters/') && file.endsWith('.js'));

for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /(?:import|export)[^\n]*\?v=/u, `${portablePath(file)} contains a stage query string`);
    assert.doesNotMatch(source, /(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|api\.github\.com)/iu, `${portablePath(file)} contains a remote runtime host`);

    const specifiers = [
        ...source.matchAll(/^\s*(?:import|export)\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/gm),
        ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)
    ].map(match => match[1]).filter(specifier => specifier.startsWith('.'));

    for (const specifier of specifiers) {
        const absolute = await realpath(path.resolve(path.dirname(file), specifier.split(/[?#]/u)[0]));
        assert.ok(absolute.startsWith(`${root}${path.sep}`), `${portablePath(file)} imports outside the portable folder`);
    }
}

const starterStorageKeys = [];

for (const file of starterFiles) {
    const source = await readFile(file, 'utf8');
    const specifiers = [
        ...source.matchAll(/^\s*(?:import|export)\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/gm),
        ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)
    ].map(match => match[1]).filter(specifier => specifier.startsWith('.'));

    for (const specifier of specifiers) {
        const absolute = await realpath(path.resolve(path.dirname(file), specifier.split(/[?#]/u)[0]));
        assert.ok(absolute.startsWith(`${root}${path.sep}`), `${portablePath(file)} imports outside the portable folder`);
        if (absolute.startsWith(`${srcRoot}${path.sep}`)) {
            assert.ok(
                absolute === path.join(srcRoot, 'index.js') || absolute === path.join(srcRoot, 'experimental.js'),
                `${portablePath(file)} bypasses the public framework entry point`
            );
        }
    }

    for (const match of source.matchAll(/\bstorageKey\s*:\s*["']([^"']*)["']/g)) {
        assert.ok(match[1].trim(), `${portablePath(file)} declares an empty storage key`);
        starterStorageKeys.push(match[1]);
    }
}

assert.equal(
    new Set(starterStorageKeys).size,
    starterStorageKeys.length,
    'Starter storage keys must be unique'
);

for (const required of [
    'src/index.js',
    'PUBLIC_API.json',
    'MODULE_OWNERSHIP.json',
    'css/framework.css',
    'css/ui-contract.css',
    'fonts/CoFoSans-Regular.woff2',
    'fonts/CoFoSans-Medium.woff2',
    'vendor/licenses/jspdf.txt',
    'vendor/licenses/opentype.js.txt',
    'vendor/licenses/svg2pdf.js.txt',
    'vendor/paper/0.12.17/LICENSE.txt'
]) await access(path.join(root, required));

assert.deepEqual(
    (await readdir(path.join(root, 'fonts'))).sort(),
    [
        'CoFoSans-Medium.woff',
        'CoFoSans-Medium.woff2',
        'CoFoSans-Regular.woff',
        'CoFoSans-Regular.woff2',
        'README.md'
    ],
    'The portable font inventory changed'
);

const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const versionMetadata = JSON.parse(await readFile(path.join(root, 'VERSION.json'), 'utf8'));
const apiSnapshot = JSON.parse(await readFile(path.join(root, 'PUBLIC_API.json'), 'utf8'));
const moduleOwnership = JSON.parse(await readFile(path.join(root, 'MODULE_OWNERSHIP.json'), 'utf8'));
assert.equal(packageMetadata.name, 'ui-garage');
assert.equal(versionMetadata.name, 'UI Garage');
assert.equal(apiSnapshot.frameworkVersion, versionMetadata.version);
assert.deepEqual(
    moduleOwnership.modules.map(module => module.path),
    sourceFiles.map(portablePath),
    'Module ownership inventory is stale'
);

for (const cssFile of actualFiles.filter(file => file.endsWith('.css'))) {
    const css = await readFile(cssFile, 'utf8');
    assert.doesNotMatch(css, /url\(\s*["']?https?:\/\//iu, `${portablePath(cssFile)} contains a remote CSS asset`);
}

const api = await import(pathToFileURL(path.join(root, 'src/index.js')).href);
const optionalApi = await import(pathToFileURL(path.join(root, 'src/experimental.js')).href);
assert.deepEqual(Object.keys(api).sort(), apiSnapshot.stable.exports, 'Stable public API snapshot changed');
assert.deepEqual(Object.keys(optionalApi).sort(), apiSnapshot.optional.exports, 'Optional public API snapshot changed');

console.log(`Portable verification passed: ${actualFiles.length} files, ${sourceFiles.length} source modules, ${starterFiles.length} starter modules, manifest and boundaries valid.`);
