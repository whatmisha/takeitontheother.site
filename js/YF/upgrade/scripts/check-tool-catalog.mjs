import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import { readCatalog, readUpgrade, upgradeRoot } from './lib/tool-catalog.mjs';
import { runtimeTools, validateDirectoryCoverage } from '../catalog/registry.js';

const catalog = await readCatalog();
const legacy = JSON.parse(await readUpgrade('APPLICATION_CAPABILITIES.json'));
const contracts = JSON.parse(await readUpgrade('qa/migrations/CONTRACTS.json'));
const sources = JSON.parse(await readUpgrade('qa/migrations/SOURCE_BASELINE.json'));
// Independent acceptance invariants. Never derive these expected sets from catalog output.
const originals = ['sparky', 'grid_generator', 'label_generator', 'keyboarder', 'wordplayer', 'dither', 'wander_bender', 'pulsar_coder'];
const approvedSources = {
    hyperspace: 'lunnen/hyperspace',
    pattern_generator: 'lunnen/pattern_generator',
    pattern_generator_02: 'lunnen/pattern_generator_02/01',
    random_lines_generator: 'lunnen/random_lines_generator/01',
    rays_pattern_generator: 'lunnen/rays_pattern_generator/01',
    asterisk_pattern_generator: 'lunnen/asterisk_pattern_generator',
    'calendar-randomizer': 'muted/calendar-randomizer',
    'chladni-sound-pattern': 'muted/chladni-sound-pattern'
};
assert.deepEqual(catalog.tools.filter(tool => tool.cohort === 'original').map(tool => tool.id), originals);
assert.deepEqual(catalog.tools.filter(tool => tool.cohort === 'migration').map(tool => tool.id), Object.keys(approvedSources));
assert.deepEqual(catalog.groups, [{ id: 'lunnen', name: 'Lunnen' }, { id: 'muted', name: 'Muted' }]);
assert.deepEqual(legacy.applications.map(app => app.id).sort(), [...originals].sort());
assert.deepEqual(legacy.applications.filter(app => app.priority === 'primary').map(app => app.id).sort(), originals.slice(0, 5).sort());
assert.deepEqual(legacy.applications.filter(app => app.mobileRequired).map(app => app.id), ['sparky']);
assert.equal(contracts.schemaVersion, 1);
assert.equal(contracts.scope, 'upgrade-only');
assert.equal(sources.schemaVersion, 1);
assert.equal(sources.scope, 'source-reference-only');
assert.deepEqual(contracts.tools.map(tool => tool.id), Object.keys(approvedSources));
assert.deepEqual(sources.tools.map(tool => tool.id), Object.keys(approvedSources));

const diskDirectories = new Set((await readdir(upgradeRoot, { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name));
validateDirectoryCoverage(catalog, diskDirectories);
for (const tool of catalog.tools) {
    assert.equal(tool.entry, `${tool.id}/index.html`);
    assert.equal(tool.group, tool.id === 'calendar-randomizer' || tool.id === 'chladni-sound-pattern' ? 'muted' : 'lunnen');
    if (tool.cohort === 'original') {
        assert.equal(tool.capabilityContract, `APPLICATION_CAPABILITIES.json#${tool.id}`);
        assert.equal(tool.entry, legacy.applications.find(app => app.id === tool.id).entry);
        continue;
    }
    assert.equal(tool.capabilityContract, `qa/migrations/CONTRACTS.json#${tool.id}`);
    const contract = contracts.tools.find(item => item.id === tool.id);
    const source = sources.tools.find(item => item.id === tool.id);
    assert.equal(source.sourceRoot, approvedSources[tool.id]);
    assert.ok(source.files.length >= 3);
    assert.equal(new Set(source.files.map(file => file.path)).size, source.files.length);
    for (const file of source.files) {
        assert.match(file.path, /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/u);
        assert.ok(!file.path.split('/').includes('..'));
        assert.match(file.sha256, /^[a-f0-9]{64}$/u);
        assert.ok(Number.isInteger(file.bytes) && file.bytes > 0);
    }
    assert.ok(contract.modes.length > 0 && contract.exports.length > 0 && contract.requiredScenarios.length > 0);
    assert.ok(['not-started', 'isolated-copy', 'ui-integration', 'accepted'].includes(contract.status));
    if (tool.state === 'planned') {
        assert.equal(contract.status, 'not-started');
    } else if (tool.state === 'migrating') {
        assert.ok(['isolated-copy', 'ui-integration'].includes(contract.status), `${tool.id}: declare migration stage`);
    } else {
        assert.equal(contract.status, 'accepted');
        assert.equal(contract.acceptance.status, 'passed', `${tool.id}: acceptance evidence required before publishing`);
        for (const kind of ['unit', 'artifact', 'browser']) {
            assert.ok(contract.acceptance[kind].length > 0, `${tool.id}: missing ${kind} evidence`);
            for (const file of contract.acceptance[kind]) {
                assert.match(file, /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/u);
                assert.ok(!file.split('/').includes('..'));
                await access(new URL(file, upgradeRoot));
            }
        }
    }
}
for (const tool of runtimeTools(catalog)) await access(new URL(tool.entry, upgradeRoot));
console.log(`Catalog passed: 8 protected original tools + 8 approved migrations; ${runtimeTools(catalog).length} runtime entries. Historical acceptance manifests are unchanged.`);
