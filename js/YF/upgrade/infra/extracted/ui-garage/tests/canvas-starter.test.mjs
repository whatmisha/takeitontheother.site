import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const starter = path.join(root, 'starters/canvas-full');

test('full Canvas starter consumes only the public UI Garage contract', async () => {
    const html = await readFile(path.join(starter, 'index.html'), 'utf8');
    const source = await readFile(path.join(starter, 'tool.js'), 'utf8');
    const renderSource = await readFile(path.join(starter, 'render.js'), 'utf8');
    assert.match(source, /from '\.\.\/\.\.\/src\/index\.js'/u);
    assert.match(renderSource, /from '\.\.\/\.\.\/src\/index\.js'/u);
    assert.doesNotMatch(`${source}\n${renderSource}`, /src\/(?:core|ui|export|history|preset|render)\//u);
    assert.doesNotMatch(`${html}\n${source}\n${renderSource}`.replaceAll('http://www.w3.org/2000/svg', ''), /https?:\/\//u);
    assert.match(source, /storageKey: 'ui-garage:canvas-full:presets:v1'/u);
    for (const marker of [
        'data-action-dock-primary-export', 'data-action-dock-json-export',
        'data-action-dock-json-import', 'data-history-undo', 'data-history-redo',
        'data-shortcut-open-file', 'id="dialog"', 'id="zoomIndicator"', 'id="mainCanvas"'
    ]) assert.ok(html.includes(marker), `Missing starter contract marker: ${marker}`);
    for (const capability of [
        'ActionDockController', 'FileIntakeController', 'PresetMenuKeyboardController',
        'UnifiedUiController', 'defineTool', "renderer: 'canvas'", 'renderTo:', 'renderSVG:',
        "primaryFormat: 'png'", 'primaryScale: 2',
        "exportPNG('raster-texture.png', 1)", "exportPNG('raster-texture@2x.png', 2)",
        'exportJSON', 'importJSON'
    ]) assert.ok(source.includes(capability), `Missing Canvas starter capability: ${capability}`);
});

test('full Canvas starter bundled presets share one complete document schema', async () => {
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

test('full Canvas starter validates versioned JSON without accepting partial or foreign documents', async () => {
    const { DOCUMENT_VERSION, TOOL_ID, defaults, normalizeDocument } = await import('../starters/canvas-full/document.js');
    assert.deepEqual(normalizeDocument({ schemaVersion: DOCUMENT_VERSION, toolId: TOOL_ID, settings: defaults }), defaults);
    assert.throws(() => normalizeDocument({ schemaVersion: 99, toolId: TOOL_ID, settings: defaults }), /Unsupported document version/u);
    assert.throws(() => normalizeDocument({ schemaVersion: DOCUMENT_VERSION, toolId: 'foreign-tool', settings: defaults }), /different tool/u);
    assert.throws(() => normalizeDocument({ ...defaults, density: 900 }), /between 20 and 500/u);
    assert.throws(() => normalizeDocument({ ...defaults, color: 'orange' }), /six-digit hex/u);
    assert.throws(() => normalizeDocument({ density: 180 }), /must be a finite number/u);
});

test('Canvas mark model is deterministic and responds to seed changes', async () => {
    const { defaults } = await import('../starters/canvas-full/document.js');
    const { buildMarks } = await import('../starters/canvas-full/render.js');
    const first = buildMarks(defaults);
    const repeated = buildMarks({ ...defaults });
    const changed = buildMarks({ ...defaults, seed: defaults.seed + 1 });
    assert.equal(first.length, defaults.density);
    assert.deepEqual(repeated, first);
    assert.notDeepEqual(changed, first);
    for (const mark of first) {
        assert.ok(Number.isFinite(mark.x) && Number.isFinite(mark.y) && Number.isFinite(mark.radius));
        assert.ok(mark.radius > 0);
    }
});

test('Canvas raster and optional vector renderers produce deterministic export models', async () => {
    const { defaults } = await import('../starters/canvas-full/document.js');
    const { drawRaster, renderVectorHook } = await import('../starters/canvas-full/render.js');
    const record = () => {
        const commands = [];
        const context = new Proxy({}, {
            get(target, key) {
                if (key in target) return target[key];
                if (['save', 'restore', 'fillRect', 'translate', 'rotate', 'beginPath', 'arc', 'fill', 'drawImage'].includes(key)) {
                    return (...args) => commands.push([key, ...args]);
                }
                return undefined;
            },
            set(target, key, value) {
                commands.push([String(key), value]);
                target[key] = value;
                return true;
            }
        });
        drawRaster({ ctx2d: context, width: defaults.width, height: defaults.height, settings: defaults });
        return commands;
    };
    assert.deepEqual(record(), record());
    const svg = renderVectorHook({ width: defaults.width, height: defaults.height, settings: defaults });
    assert.match(svg, /^<svg[^>]+viewBox="0 0 960 640"/u);
    assert.match(svg, /<circle /u);
    assert.equal(svg, renderVectorHook({ width: defaults.width, height: defaults.height, settings: defaults }));
});
