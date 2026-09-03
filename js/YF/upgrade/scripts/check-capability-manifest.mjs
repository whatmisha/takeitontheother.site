import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('APPLICATION_CAPABILITIES.json', root), 'utf8'));
const stableBarrel = await readFile(new URL('framework/src/index.js', root), 'utf8');
const optionalBarrel = await readFile(new URL('framework/src/experimental.js', root), 'utf8');

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.scope, 'upgrade-only');
assert.equal(manifest.applications.length, 8);
assert.deepEqual(
    manifest.applications.map(app => app.id).sort(),
    ['dither', 'grid_generator', 'keyboarder', 'label_generator', 'pulsar_coder', 'sparky', 'wander_bender', 'wordplayer']
);
assert.equal(manifest.applications.filter(app => app.priority === 'primary').length, 5);
assert.equal(manifest.applications.filter(app => app.mobileRequired).length, 1);
assert.equal(manifest.applications.filter(app => app.shared.actionDock).length, 8);
assert.equal(manifest.applications.reduce((sum, app) => sum + app.shared.fileIntake, 0), 14);
assert.equal(manifest.applications.filter(app => app.shared.presetKeyboard).length, 6);
assert.equal(manifest.applications.filter(app => app.shared.zoomIndicatorButton).length, 5);

for (const app of manifest.applications) {
    assert.ok(['defineTool', 'adapter'].includes(app.frameworkMode));
    assert.ok(['svg', 'canvas'].includes(app.renderer));
    assert.ok(app.private.length > 0, `${app.id} must declare its private boundary`);
    await readFile(new URL(app.entry, root), 'utf8');
}

assert.deepEqual(manifest.optionalFrameworkSurface.productionConsumers, []);
assert.deepEqual(manifest.optionalFrameworkSurface.referenceConsumers, ['framework/demo']);
for (const component of manifest.optionalFrameworkSurface.components) {
    assert.doesNotMatch(stableBarrel, new RegExp(`export \\{ ${component} \\}`, 'u'));
    assert.match(optionalBarrel, new RegExp(`export \\{ ${component} \\}`, 'u'));
}

console.log('Capability manifest passed: 8 isolated apps; priority/mobile boundaries; 14 file surfaces; 6 preset keyboards; 2 optional components.');
