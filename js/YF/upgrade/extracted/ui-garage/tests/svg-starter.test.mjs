import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const starter = path.join(root, 'starters/svg-full');

test('full SVG starter consumes only the public UI Garage contract', async () => {
    const html = await readFile(path.join(starter, 'index.html'), 'utf8');
    const source = await readFile(path.join(starter, 'tool.js'), 'utf8');
    assert.match(source, /from '\.\.\/\.\.\/src\/index\.js'/u);
    assert.doesNotMatch(source, /src\/(?:core|ui|export|history|preset|render)\//u);
    assert.doesNotMatch(`${html}\n${source}`.replaceAll('http://www.w3.org/2000/svg', ''), /https?:\/\//u);
    assert.match(source, /storageKey: 'ui-garage:svg-full:presets:v1'/u);
    for (const marker of [
        'data-action-dock-primary-export', 'data-action-dock-json-export',
        'data-action-dock-json-import', 'data-history-undo', 'data-history-redo',
        'data-shortcut-open-file', 'id="dialog"', 'id="zoomIndicator"'
    ]) assert.ok(html.includes(marker), `Missing starter contract marker: ${marker}`);
    for (const capability of [
        'ActionDockController', 'FileIntakeController', 'PresetMenuKeyboardController',
        'UnifiedUiController', 'defineTool', 'exportToPDF', 'exportJSON', 'importJSON'
    ]) assert.ok(source.includes(capability), `Missing SVG starter capability: ${capability}`);
});

test('full SVG starter bundled presets share one complete document schema', async () => {
    const manifest = JSON.parse(await readFile(path.join(starter, 'presets/manifest.json'), 'utf8'));
    assert.equal(manifest.presets.length, 3);
    const expectedKeys = Object.keys(JSON.parse(await readFile(path.join(starter, 'presets/starter.json'), 'utf8'))).sort();
    for (const entry of manifest.presets) {
        const preset = JSON.parse(await readFile(path.join(starter, 'presets', entry.file), 'utf8'));
        assert.deepEqual(Object.keys(preset).sort(), expectedKeys, `${entry.file} schema differs`);
        assert.match(preset.color, /^#[0-9a-f]{6}$/iu);
        assert.match(preset.background, /^#[0-9a-f]{6}$/iu);
    }
});

test('full SVG starter validates versioned JSON without accepting partial or foreign documents', async () => {
    const { DOCUMENT_VERSION, TOOL_ID, defaults, normalizeDocument } = await import('../starters/svg-full/document.js');
    assert.deepEqual(normalizeDocument({ schemaVersion: DOCUMENT_VERSION, toolId: TOOL_ID, settings: defaults }), defaults);
    assert.throws(() => normalizeDocument({ schemaVersion: 99, toolId: TOOL_ID, settings: defaults }), /Unsupported document version/u);
    assert.throws(() => normalizeDocument({ schemaVersion: DOCUMENT_VERSION, toolId: 'foreign-tool', settings: defaults }), /different tool/u);
    assert.throws(() => normalizeDocument({ ...defaults, columns: 500 }), /between 2 and 24/u);
    assert.throws(() => normalizeDocument({ ...defaults, color: 'orange' }), /six-digit hex/u);
    assert.throws(() => normalizeDocument({ columns: 8 }), /must be a finite number/u);
});
