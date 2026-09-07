import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = path.join(root, 'tests/clean-room-ribbon-field');

test('clean-room Ribbon Field uses only the public portable contract', async () => {
    const html = await readFile(path.join(fixture, 'index.html'), 'utf8');
    const source = await readFile(path.join(fixture, 'tool.js'), 'utf8');
    assert.match(source, /from '\.\.\/\.\.\/src\/index\.js'/u);
    assert.doesNotMatch(source, /src\/(?:core|ui|export|history|preset|render)\//u);
    assert.doesNotMatch(`${html}\n${source}`.replaceAll('http://www.w3.org/2000/svg', ''), /https?:\/\//u);
    assert.match(source, /storageKey: 'ui-garage:ribbon-field:presets:v1'/u);
    for (const capability of [
        'ActionDockController', 'FileIntakeController', 'PresetMenuKeyboardController',
        'UnifiedUiController', 'defineTool', 'exportToPDF', 'exportJSON', 'importJSON'
    ]) assert.ok(source.includes(capability), `Missing clean-room capability: ${capability}`);
    for (const marker of [
        'data-action-dock-primary-export', 'data-action-dock-json-export',
        'data-action-dock-json-import', 'data-history-undo', 'data-history-redo',
        'data-shortcut-open-file', 'id="dialog"', 'id="zoomIndicator"'
    ]) assert.ok(html.includes(marker), `Missing clean-room contract marker: ${marker}`);
});

test('clean-room presets and JSON documents use one strict Ribbon Field schema', async () => {
    const { DOCUMENT_VERSION, TOOL_ID, defaults, normalizeDocument } = await import('./clean-room-ribbon-field/document.js');
    assert.deepEqual(normalizeDocument({ schemaVersion: DOCUMENT_VERSION, toolId: TOOL_ID, settings: defaults }), defaults);
    assert.throws(() => normalizeDocument({ schemaVersion: 2, toolId: TOOL_ID, settings: defaults }), /Unsupported/u);
    assert.throws(() => normalizeDocument({ schemaVersion: DOCUMENT_VERSION, toolId: 'another-tool', settings: defaults }), /different tool/u);
    assert.throws(() => normalizeDocument({ ...defaults, ribbons: 100 }), /between 2 and 40/u);

    const manifest = JSON.parse(await readFile(path.join(fixture, 'presets/manifest.json'), 'utf8'));
    const keys = Object.keys(defaults).sort();
    assert.equal(manifest.presets.length, 3);
    for (const entry of manifest.presets) {
        const preset = JSON.parse(await readFile(path.join(fixture, 'presets', entry.file), 'utf8'));
        assert.deepEqual(Object.keys(preset).sort(), keys);
        assert.deepEqual(normalizeDocument(preset), preset);
    }
});

test('clean-room browser acceptance covers the full product lifecycle', async () => {
    const source = await readFile(path.join(root, 'tests/clean-room-acceptance/smoke.js'), 'utf8');
    for (const proof of [
        'app.undo()', 'app.redo()', 'app.presetStore.create', 'app.share.encode',
        'DraftStore',
        "code: 'Backslash'", 'app.dialog.alert', "app.exportSVG('proof.svg')",
        'app.destroy()', 'await app.init()', "getEntriesByType('resource')"
    ]) assert.ok(source.includes(proof), `Missing browser proof: ${proof}`);
});
