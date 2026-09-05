import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const manifest = JSON.parse(await readFile(
    path.join(upgradeRoot, 'KEYBOARD_ACCEPTANCE.json'),
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
assert.deepEqual(
    manifest.apps.map(app => app.id).sort(),
    expectedApps,
    'Keyboard acceptance must cover all eight tools'
);
assert.deepEqual(manifest.shortcuts, {
    primaryExport: 'mod+e',
    jsonExport: 'mod+j',
    jsonImport: 'mod+shift+j',
    toggleJsonActions: 'j',
    dismiss: 'escape'
});

const count = (source, expression) => [...source.matchAll(expression)].length;
let collapseTotal = 0;
let focusableTotal = 0;

for (const app of manifest.apps) {
    const source = (await Promise.all(app.sources.map(async relativePath => (
        readFile(path.join(upgradeRoot, relativePath), 'utf8')
    )))).join('\n');

    assert.match(source, /<a\b[^>]*aria-label="Back to Upgrade Tools"/u,
        `${app.id} needs an accessible back link`);
    assert.match(source, /class="[^"]*\baction-dock\b[^"]*"[^>]*role="toolbar"/u,
        `${app.id} needs a labelled ActionDock toolbar`);
    assert.match(source, /actionDockAutoInit\.js\?v=g7-resilience-4/u,
        `${app.id} needs the current ActionDock keyboard controller`);

    assert.equal(
        count(source, /\bdata-action-dock-primary-export\b/gu),
        app.primaryExports,
        `${app.id} primary export count changed`
    );
    assert.equal(
        count(source, /\bdata-action-dock-json-export\b/gu),
        app.jsonExports,
        `${app.id} JSON export count changed`
    );
    assert.equal(
        count(source, /\bdata-action-dock-json-import\b/gu),
        app.jsonImports,
        `${app.id} JSON import count changed`
    );

    const collapseControls = count(
        source,
        /<(?:button|span)\b[^>]*class="[^"]*\b(?:collapse-icon|collapse-toggle)\b[^"]*"/gu
    );
    assert.equal(collapseControls, app.collapseControls, `${app.id} collapse count changed`);

    const hasPresetMenu = /aria-haspopup="listbox"[^>]*aria-controls=/u.test(source);
    assert.equal(hasPresetMenu, app.presetMenu, `${app.id} preset-menu contract changed`);
    if (app.presetMenu) {
        assert.match(source, /presetMenuKeyboardAutoInit\.js\?v=g7-resilience-4/u,
            `${app.id} needs shared preset keyboard navigation`);
    }

    assert.ok(app.liveFocusable > 0, `${app.id} live focusable count is missing`);
    collapseTotal += collapseControls;
    focusableTotal += app.liveFocusable;
}

const actionDock = await readFile(
    path.join(upgradeRoot, 'framework/src/ui/ActionDockController.js'),
    'utf8'
);
assert.match(actionDock, /forceCollapsed/u, 'Escape collapse path is missing');
assert.match(actionDock, /focusedExtra[\s\S]*?\.focus\?\.\(\)/u,
    'hiding JSON actions must restore focus');
assert.match(actionDock, /if \(element\.hidden\) return true/u,
    'hidden JSON actions must remain shortcut-addressable');

for (const assertion of [
    'back-link-is-first-focusable',
    'top-before-panels-before-action-dock',
    'no-duplicate-ids',
    'boolean-aria-state-valid',
    'collapse-controls-keyboard-reachable',
    'rendered-output-present',
    'no-horizontal-overflow'
]) {
    assert.ok(manifest.liveAssertions.includes(assertion), `Missing live assertion: ${assertion}`);
}

console.log(
    `Keyboard acceptance passed: ${manifest.apps.length} tools, ${collapseTotal} collapse controls, ` +
    `${focusableTotal} live focus stops and canonical export/JSON/Escape paths.`
);
