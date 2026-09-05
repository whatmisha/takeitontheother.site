import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const manifest = JSON.parse(await readFile(
    path.join(upgradeRoot, 'PERSISTENCE_ACCEPTANCE.json'),
    'utf8'
));

const expectedApps = [
    'dither',
    'grid_generator',
    'keyboarder',
    'label_generator',
    'pulsar_coder',
    'sparky',
    'wander_bender',
    'wordplayer'
];
const appIds = manifest.apps.map(app => app.id).sort();
assert.deepEqual(appIds, expectedApps, 'Persistence acceptance must cover all eight tools');

const surfaceIds = new Set(manifest.surfaces.map(surface => surface.id));
assert.equal(surfaceIds.size, manifest.surfaces.length, 'Persistence surface ids must be unique');
const storageKeys = new Set(manifest.surfaces.map(surface => surface.key));
assert.equal(storageKeys.size, manifest.surfaces.length, 'Persistence namespaces must be unique');

const appById = new Map(manifest.apps.map(app => [app.id, app]));
for (const surface of manifest.surfaces) {
    const app = appById.get(surface.owner);
    assert.ok(app, `Unknown persistence owner: ${surface.owner}`);
    assert.ok(app.surfaces.includes(surface.id), `${surface.id} is missing from ${surface.owner}`);
    assert.match(surface.key, /^upgrade(?::|-)/u, `${surface.id} is not upgrade-isolated`);
    assert.ok(['localStorage', 'IndexedDB'].includes(surface.medium), `${surface.id} has unknown medium`);
    assert.ok(surface.reloadContract, `${surface.id} has no reload contract`);

    const sourcePath = path.join(upgradeRoot, surface.source);
    const source = await readFile(sourcePath, 'utf8');
    assert.ok(source.includes(surface.key), `${surface.source} does not contain ${surface.key}`);
    await access(path.join(upgradeRoot, surface.test));
}

for (const app of manifest.apps) {
    assert.ok(app.historyLifetime, `${app.id} must declare history lifetime`);
    assert.ok(app.recovery, `${app.id} must declare recovery behavior`);
    for (const surfaceId of app.surfaces) {
        assert.ok(surfaceIds.has(surfaceId), `${app.id} references unknown surface ${surfaceId}`);
    }
}

assert.deepEqual(
    manifest.rollbackProofs.map(proof => proof.owner).sort(),
    ['grid_generator', 'sparky'],
    'Pizza Boxer and Sparky need separate rollback proofs'
);
for (const proof of manifest.rollbackProofs) {
    assert.ok(proof.operation, `${proof.owner} rollback operation is missing`);
    await access(path.join(upgradeRoot, proof.test));
}

console.log(
    `Persistence acceptance passed: ${manifest.apps.length} tools, ` +
    `${manifest.surfaces.length} isolated surfaces and ${manifest.rollbackProofs.length} rollback proofs.`
);
