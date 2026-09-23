import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const version = await readJson('VERSION.json');
const release = await readJson('RELEASE.json');
const packageMetadata = await readJson('package.json');
const publicApi = await readJson('PUBLIC_API.json');
const manifest = await readJson('framework-manifest.json');
const states = await readJson('component-lab/COMPONENT_STATES.json');

assert.equal(version.version, '1.0.2');
assert.equal(version.status, 'released');
assert.equal(release.version, version.version);
assert.equal(packageMetadata.version, version.version);
assert.equal(publicApi.frameworkVersion, version.version);
assert.equal(manifest.version, version.version);
assert.equal(release.manifest, 'framework-manifest.json');
assert.equal(release.archiveName, `ui-garage-${version.version}.tar.gz`);

for (const state of [
    'normal', 'hover', 'focus', 'active', 'selected', 'disabled', 'readonly',
    'loading', 'success', 'warning', 'error', 'open', 'closed', 'collapsed',
    'mobile', 'reduced-motion'
]) assert.ok(states.states.includes(state), `Missing component state: ${state}`);

for (const required of [
    'RELEASE_NOTES.md', 'MIGRATION_GUIDE.md', 'SOURCE_INDEPENDENCE.md',
    'starters/svg-full/index.html', 'starters/canvas-full/index.html',
    'tests/clean-room-ribbon-field/index.html',
    'tests/clean-room-acceptance/index.html',
    'tests/visual-contract/index.html', 'tests/browser-smoke/index.html'
]) await access(path.join(root, required));

await assert.rejects(access(path.join(root, 'demo')), /ENOENT/u, 'Legacy demo must not coexist with canonical starters.');

console.log(`UI Garage ${version.version} release verification passed: ${manifest.files.length} manifested files.`);
