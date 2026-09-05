import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const absolute = relativePath => path.join(upgradeRoot, relativePath);
const read = relativePath => readFile(absolute(relativePath), 'utf8');
const manifest = JSON.parse(await read('RUNTIME_RESILIENCE.json'));

assert.equal(manifest.schemaVersion, 1);
assert.deepEqual(manifest.reloadContract, {
    coldLoads: 1,
    warmReloads: 2,
    browserErrors: 0,
    resource404s: 0
});
assert.equal(manifest.networkPolicy.default, 'same-origin-local-only');
assert.deepEqual(manifest.networkPolicy.externalRuntimeExceptions, [{
    app: 'label_generator',
    service: 'Google Sheets',
    activation: 'explicit-user-action'
}]);

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
assert.deepEqual(manifest.apps.map(app => app.id).sort(), expectedApps);
assert.equal(manifest.apps.filter(app => app.priority).length, 5);

for (const app of manifest.apps) {
    await access(absolute(app.entrypoint));
    await access(absolute(app.doubleOperationEvidence));
    const html = await read(app.entrypoint);
    assert.match(html, /actionDockAutoInit\.js\?v=g7-resilience-4/u,
        `${app.id} is missing the resilient ActionDock auto-init`);
    assert.doesNotMatch(
        html,
        /<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:\/\//iu,
        `${app.id} loads an external startup resource`
    );
    assert.ok(app.viewports.includes('desktop'), `${app.id} needs a desktop reload pass`);
}
assert.deepEqual(
    manifest.apps.find(app => app.id === 'sparky').viewports,
    ['desktop', '390x844', '430x932']
);

for (const evidence of manifest.lifecycleEvidence) {
    await access(absolute(evidence.source));
    await access(absolute(evidence.test));
    assert.ok(evidence.guarantee, `${evidence.source} has no lifecycle guarantee`);
}

const shell = await read('framework/src/core/ApplicationShell.js');
assert.match(shell, /if \(this\._initialized\) return this;/u);
assert.match(shell, /if \(this\._initializationPromise\) return this\._initializationPromise;/u);
const observed = await read('framework/src/ui/ObservedControllerLifecycle.js');
assert.match(observed, /scope\[key\]\?\.destroy\?\.\(\);/u);
assert.match(observed, /const observer = installObserver\(controller\);/u);
assert.match(observed, /const root = ownerDocument\.documentElement;/u);
assert.match(observed, /catch \{[\s\S]*?return false;/u);
assert.match(observed, /observer\.disconnect\?\.\(\);/u);
const intake = await read('framework/src/ui/FileIntakeController.js');
assert.match(intake, /code: 'cancelled'/u);
assert.match(intake, /this\.operationId \+= 1;/u);
const animation = await read('sparky/src/export/animationExporter.js');
assert.match(animation, /removeEventListener\?\.\('click', this\.handleCancel\)/u);
assert.match(animation, /if \(this\.worker\) this\.cancel\(\);/u);

for (const relativePath of manifest.blobUrlOwners) {
    const source = await read(relativePath);
    assert.match(source, /createObjectURL/u, `${relativePath} no longer owns a Blob URL`);
    assert.match(source, /revokeObjectURL/u, `${relativePath} does not revoke its Blob URL`);
}

console.log(
    `Runtime resilience contract passed: ${manifest.apps.length} tools, ` +
    `${manifest.lifecycleEvidence.length} lifecycle proofs and ` +
    `${manifest.blobUrlOwners.length} balanced Blob URL owners.`
);
