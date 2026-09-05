import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const roundTrip = JSON.parse(await readFile(new URL('ROUND_TRIP_ACCEPTANCE.json', root), 'utf8'));
const exportsManifest = JSON.parse(await readFile(new URL('EXPORT_ACCEPTANCE.json', root), 'utf8'));
const capabilities = JSON.parse(await readFile(new URL('APPLICATION_CAPABILITIES.json', root), 'utf8'));

assert.equal(roundTrip.schemaVersion, 1);
assert.equal(roundTrip.scope, 'upgrade-only');
assert.equal(roundTrip.jsonApplications.length, 4, 'JSON surface count changed');

const exportApps = new Map(exportsManifest.applications.map(app => [app.id, app]));
for (const app of roundTrip.jsonApplications) {
    const contract = exportApps.get(app.id);
    assert.ok(contract, `${app.id} export contract missing`);
    assert.equal(contract.json.exportId, app.exportId, `${app.id} JSON export id diverged`);
    assert.equal(contract.json.importId, app.importId, `${app.id} JSON import id diverged`);
    assert.ok(['export-only', 'round-trip'].includes(app.mode), `${app.id} JSON mode invalid`);
    if (app.mode === 'round-trip') assert.ok(app.importId, `${app.id} round-trip requires import`);
    else assert.equal(app.importId, null, `${app.id} export-only mode gained an implicit import`);
    assert.ok(app.evidence.length > 0, `${app.id} round-trip evidence missing`);
    await Promise.all(app.evidence.map(path => access(new URL(path, root))));
}

const capabilityApps = new Map(capabilities.applications.map(app => [app.id, app]));
assert.deepEqual(
    roundTrip.fileIntakeApplications.map(app => app.id).sort(),
    ['dither', 'wordplayer'],
    'G7 file-intake round-trip scope changed'
);
for (const app of roundTrip.fileIntakeApplications) {
    assert.equal(capabilityApps.get(app.id)?.shared.fileIntake, app.surfaces,
        `${app.id} file-intake surface count diverged`);
    await Promise.all(app.evidence.map(path => access(new URL(path, root))));
}

console.log('Round-trip acceptance passed: 3 bidirectional JSON tools, 1 explicit export-only tool, 4 asset intake surfaces.');
