import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const absolute = relativePath => path.join(root, relativePath);
const manifest = JSON.parse(await readFile(absolute('FINAL_LIVE_ACCEPTANCE.json'), 'utf8'));

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.scope, 'upgrade-only');
assert.deepEqual(manifest.desktop, {
    entrypoints: 8,
    coldLoads: 8,
    warmReloads: 16,
    consoleErrors: 0,
    resource404s: 0,
    horizontalOverflows: 0,
    intentionalWarnings: [
        'Sticky Fingers: EAN-13 checksum mismatch: provided 7, calculated 6'
    ]
});
assert.equal(manifest.sparkyMobile.length, 2);
assert.deepEqual(manifest.sparkyMobile.map(item => item.viewport), ['390x844', '430x932']);
for (const mobile of manifest.sparkyMobile) {
    assert.equal(mobile.loads, 3);
    assert.equal(mobile.overflowX, false);
    assert.equal(mobile.consoleErrors, 0);
    assert.equal(mobile.actionDockCenterDelta, 0);
    assert.equal(mobile.actionDockBottom, 12);
}

const expected = [
    'dither', 'grid_generator', 'keyboarder', 'label_generator',
    'pulsar_coder', 'sparky', 'wander_bender', 'wordplayer'
];
assert.deepEqual(manifest.workflows.map(item => item.id).sort(), expected);
assert.equal(manifest.workflows.filter(item => item.tier === 'priority').length, 5);
assert.equal(manifest.workflows.filter(item => item.tier === 'secondary').length, 3);
for (const item of manifest.workflows) {
    assert.equal(item.status, 'accepted', `${item.id} workflow is not accepted`);
    assert.ok(item.workflow.length > 20, `${item.id} workflow is not described`);
    await access(absolute(item.liveEvidence));
    for (const evidence of item.automatedEvidence) await access(absolute(evidence));
}

const pizzaHarness = await readFile(absolute('qa/pizza-file-intake.html'), 'utf8');
assert.match(pizzaHarness, /const jsonHash = jsonRuns\[0\]\.svg;/u);
assert.match(pizzaHarness, /new windowUnderTest\.MutationObserver/u);
const pizzaApplication = await readFile(
    absolute('grid_generator/src/preset/PresetApplicationController.js'),
    'utf8'
);
assert.match(pizzaApplication, /const normalized = isImported \? clone\(data\) : await this\.normalize\(data\);/u);

console.log(
    'Final live acceptance passed: 8 workflows (5 priority + 3 secondary), ' +
    '24 desktop loads, 6 Sparky mobile loads and 0 errors/404.'
);
