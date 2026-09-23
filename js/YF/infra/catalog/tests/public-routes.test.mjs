import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import vm from 'node:vm';
import { publishedTools, toolHref, validateDirectoryCoverage, runtimeTools } from '../registry.js';
const root = new URL('../../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const catalog = JSON.parse(await read('infra/TOOL_CATALOG.json'));

test('every published catalogue link opens its canonical tool directly', async () => {
    const hub = await read('index.html');
    const tools = publishedTools(catalog);
    const links = [...hub.matchAll(/<li><a href="([^"]+)">/gu)].map(match => match[1]);
    assert.equal(tools.length, 16);
    assert.equal(new Set(links).size, tools.length);
    assert.deepEqual([...links].sort(), tools.map(toolHref).sort());
    for (const tool of tools) {
        assert.equal(toolHref(tool), `${tool.id}/`);
        assert.doesNotMatch(await read(tool.entry), /data-yf-target|http-equiv=["']refresh|navigation\/redirect\.js/iu, tool.id);
    }
});

test('retired URL trees and redirect generation cannot return as compatibility exceptions', async () => {
    for (const retired of ['upgrade', 'lunnen', 'muted', 'tools']) {
        await assert.rejects(lstat(new URL(`${retired}/`, root)), { code: 'ENOENT' });
        assert.throws(() => validateDirectoryCoverage(catalog, [...runtimeTools(catalog).map(tool => tool.id), retired]), /unregistered tool/u);
    }
    for (const retired of ['infra/navigation/redirect.js', 'infra/navigation/routes.mjs', 'infra/scripts/sync-legacy-routes.mjs']) {
        await assert.rejects(lstat(new URL(retired, root)), { code: 'ENOENT' });
    }
    assert.equal(JSON.parse(await read('package.json')).scripts['routes:sync'], undefined);
});

test('all canonical tool navigation and titles are free of experimental branding', async () => {
    for (const tool of catalog.tools) {
        const html = await read(tool.entry);
        assert.doesNotMatch(html, /Upgrade Tools|Migration preview|integration preview/u, tool.id);
    }
    assert.doesNotMatch(await read('infra/framework/src/ui/GeneratorHost.js'), /Upgrade Tools/u);
    assert.match(await read('index.html'), /<title>YF Tools<\/title>/u);
});

const storageScript = await read('infra/navigation/legacy-storage.js');
function boot(tool, initial) {
    const values = new Map(Object.entries(initial));
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const run = () => vm.runInNewContext(storageScript, { document: { currentScript: { dataset: { tool } } }, window: { localStorage: storage }, console: { warn() {} } });
    return { values, storage, run };
}
test('old custom presets are imported additively; collisions and source data survive; repeats are idempotent', () => {
    const legacy = JSON.stringify({ Basic: { seeded: true }, Custom: { rays: 5 }, Older: { rays: 7 } });
    const app = boot('sparky', { lunnenSparkyGeneratorV2: legacy, 'upgrade:sparky:presets:v1': JSON.stringify({ Custom: { rays: 9 } }) });
    app.run();
    assert.deepEqual(JSON.parse(app.values.get('upgrade:sparky:presets:v1')), { Custom: { rays: 9 }, 'Custom (previous)': { rays: 5 }, Older: { rays: 7 } });
    assert.equal(app.values.get('lunnenSparkyGeneratorV2'), legacy);
    const once = [...app.values]; app.run(); assert.deepEqual([...app.values], once);
});
test('legacy preferences fill only absent new settings', () => {
    const app = boot('keyboarder', { 'keyboarder.uiMode': 'advanced', 'keyboarder.svgExportTextMode': 'outlines', 'upgrade:keyboarder:ui-mode:v1': 'simple' });
    app.run();
    assert.equal(app.values.get('upgrade:keyboarder:ui-mode:v1'), 'simple');
    assert.equal(app.values.get('upgrade:keyboarder:svg-export-mode:v1'), 'outlines');
    assert.equal(app.values.get('keyboarder.svgExportTextMode'), 'outlines');
});
test('malformed and denied storage do not prevent tool startup or mark import complete', () => {
    const app = boot('wordplayer', { wordplayerPresetsV18: '{broken' });
    assert.doesNotThrow(app.run);
    assert.equal(app.values.has('yf:legacy-storage:v1:wordplayer'), false);
    app.storage.getItem = () => { throw new Error('storage denied'); };
    assert.doesNotThrow(app.run);
});
test('preset names cannot mutate the imported library prototype', () => {
    const app = boot('sparky', { lunnenSparkyGeneratorV2: '{"__proto__":{"bad":true},"constructor":{"bad":true},"Good":{"rays":3}}' });
    app.run(); assert.deepEqual(JSON.parse(app.values.get('upgrade:sparky:presets:v1')), { Good: { rays: 3 } });
});
