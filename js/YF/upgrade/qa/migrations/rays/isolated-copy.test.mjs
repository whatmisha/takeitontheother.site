import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createLegacy, source, svgLines, roundedGeometry } from './harness.mjs';

const root = new URL('../../../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const [html, script, css] = await Promise.all(['index.html','script.js','styles.css'].map(name => read(`tools/rays_pattern_generator/${name}`)));
const fixtures = JSON.parse(await readFile(new URL('./geometry-fixtures.json', import.meta.url), 'utf8'));
const storageKey = 'upgrade:rays-pattern:settings:v1';
const migrated = options => createLegacy({ html, script, storageKey, ...options });

test('T.2 changes only the script namespace, never geometry/export/source IO', () => {
    assert.equal(script, source['script.js'].replaceAll("'rayPatternSettings'", `'${storageKey}'`).trimEnd() + '\n');
    assert.equal((script.match(/upgrade:rays-pattern:settings:v1/gu) || []).length,3);
    assert.doesNotMatch(html + css, /https:\/\/takeitontheother\.site|@font-face|Arial|CoFo Sans/u);
    assert.match(css, /-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif/u);
    assert.match(html, /isolated copy, legacy UI/u);
});

for (const fixture of fixtures.cases) {
    test(`frozen and isolated implementations match golden geometry: ${fixture.id}`, () => {
        for (const app of [createLegacy(), migrated()]) {
            for (const [id, value] of fixture.changes) app.change(id, value);
            const { svg, name } = app.export();
            const lines = roundedGeometry(svgLines(svg));
            assert.equal(createHash('sha256').update(JSON.stringify(lines)).digest('hex'), fixture.expected.geometrySha256);
            assert.deepEqual(lines, roundedGeometry(app.context.lines));
            assert.equal(name, fixture.expected.filename);
            assert.equal(svg.children.filter(node => node.tagName === 'G').length, fixture.expected.modules);
            assert.equal(svg.children.filter(node => node.tagName === 'LINE').length, fixture.expected.dividers);
            assert.equal(lines.length, fixture.expected.lines);
            assert.deepEqual(lines[0], fixture.expected.first); assert.deepEqual(lines.at(-1), fixture.expected.last);
        }
    });
}

test('isolated save/load/reset cannot read, overwrite or remove the original namespace', () => {
    const app = migrated(); app.change('rayCountSlider',8);
    assert.equal(JSON.parse(app.storage.get(storageKey)).rayCount,8);
    assert.equal(app.storage.get('rayPatternSettings'),'original sentinel');
    const reloaded = migrated({ saved: JSON.parse(app.storage.get(storageKey)) });
    assert.equal(+reloaded.nodes.get('rayCountSlider').value,8);
    reloaded.nodes.get('resetBtn').click();
    assert.equal(reloaded.storage.has(storageKey),false);
    assert.equal(reloaded.storage.get('rayPatternSettings'),'original sentinel');
});

test('Rays enters runtime/audit while staying unpublished on the hub', async () => {
    const catalog = JSON.parse(await read('TOOL_CATALOG.json'));
    assert.equal(catalog.tools.find(tool => tool.id === 'rays_pattern_generator').state,'migrating');
    assert.match(await read('qa/ui-audit/index.html'), /value="rays_pattern_generator" data-tool-state="migrating">Rays Pattern — перенос/u);
    assert.doesNotMatch(await read('index.html'), /href="(?:tools\/)?rays_pattern_generator\//u);
});
