import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { legacyRoutes, redirectDocument } from '../../navigation/routes.mjs';
const root = new URL('../../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const catalog = JSON.parse(await read('infra/TOOL_CATALOG.json'));

test('every previously published catalogue link and upgrade link has one checked-in redirect', async () => {
    const routes = legacyRoutes(catalog);
    assert.equal(routes.length, 60);
    assert.equal(new Set(routes.map(route => route.path)).size, 60);
    for (const route of routes) {
        assert.equal(await read(route.path + 'index.html'), redirectDocument(route));
        await read(route.target + 'index.html');
    }
    for (const id of ['pattern_generator_02', 'random_lines_generator', 'rays_pattern_generator']) {
        assert.ok(routes.some(route => route.path === `lunnen/${id}/01/` && route.target === `${id}/`));
    }
});

test('legacy redirects preserve shared-preset query and hash for both directory and index.html URLs', async () => {
    const script = await read('infra/navigation/redirect.js');
    for (const route of legacyRoutes(catalog)) for (const index of ['', 'index.html']) {
        const href = `https://takeitontheother.site/js/yf/${route.path}${index}?preset=Basic&s=a%2Bb%3D#scene`;
        const url = new URL(href), link = { getAttribute: () => '../'.repeat(route.path.split('/').filter(Boolean).length) + route.target };
        let replaced;
        vm.runInNewContext(script, { URL, document: { querySelector: () => link }, location: { href, origin: url.origin, search: url.search, hash: url.hash, replace: value => { replaced = value; } } });
        assert.equal(replaced, `https://takeitontheother.site/js/yf/${route.target}?preset=Basic&s=a%2Bb%3D#scene`, route.path);
        assert.equal(link.href, replaced);
    }
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
