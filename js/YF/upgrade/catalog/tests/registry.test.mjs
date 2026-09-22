import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog, runtimeTools, publishedTools, renderHub, renderAuditOptions, replaceGeneratedRegion, validateDirectoryCoverage } from '../registry.js';

const catalog = JSON.parse(await readFile(new URL('../../TOOL_CATALOG.json', import.meta.url), 'utf8'));
const fixture = () => structuredClone(catalog);
const ray = data => data.tools.find(tool => tool.id === 'rays_pattern_generator');

test('all eight original tools use tools/ alongside eight approved placeholders', () => {
    assert.equal(validateCatalog(catalog), catalog);
    assert.equal(catalog.tools.length, 16);
    assert.deepEqual(catalog.tools.filter(tool => tool.cohort === 'original').map(tool => tool.entry), [
        'tools/sparky/index.html', 'tools/grid_generator/index.html', 'tools/label_generator/index.html', 'tools/keyboarder/index.html',
        'tools/wordplayer/index.html', 'tools/dither/index.html', 'tools/wander_bender/index.html', 'tools/pulsar_coder/index.html'
    ]);
});

test('planned tools have no hub link and no selectable audit option or runtime scan', () => {
    const data = fixture(); ray(data).state = 'planned';
    assert.ok(!runtimeTools(data).some(tool => tool.id === ray(data).id));
    assert.doesNotMatch(renderHub(data), /href="tools\/rays_pattern_generator\//u);
    assert.match(renderAuditOptions(data), /value="rays_pattern_generator" data-tool-state="planned" disabled/u);
});

test('migrating tools enter runtime checks and audit immediately, without a public link', () => {
    const data = fixture(); ray(data).state = 'migrating';
    assert.ok(runtimeTools(data).some(tool => tool.id === ray(data).id));
    assert.ok(!publishedTools(data).some(tool => tool.id === ray(data).id));
    assert.doesNotMatch(renderHub(data), /href="tools\/rays_pattern_generator\//u);
    assert.match(renderAuditOptions(data), /value="rays_pattern_generator" data-tool-state="migrating">Rays Pattern — перенос/u);
});

test('accepted tools appear once under their own group; priority order remains unchanged', () => {
    const data = fixture(); ray(data).state = 'accepted';
    data.tools.find(tool => tool.id === 'calendar-randomizer').state = 'accepted';
    const html = renderHub(data);
    assert.equal(html.match(/href="tools\/rays_pattern_generator\/"/gu).length, 1);
    assert.equal(html.match(/href="tools\/calendar-randomizer\/"/gu).length, 1);
    assert.ok(html.indexOf('href="tools/calendar-randomizer/"') > html.indexOf('id="muted-heading"'));
    assert.ok(html.indexOf('href="tools/sparky/"') < html.indexOf('href="tools/grid_generator/"'));
});

test('unsafe paths, malformed states, duplicates and original unpublishing are rejected', () => {
    for (const entry of ['../lunnen/rays_pattern_generator/index.html', '/rays/index.html', 'https://example.com/', 'tools/rays_pattern_generator/%2e%2e/index.html']) {
        const data = fixture(); ray(data).entry = entry;
        assert.throws(() => validateCatalog(data), /entry/u);
    }
    const badState = fixture(); ray(badState).state = 'done';
    assert.throws(() => validateCatalog(badState), /state/u);
    const duplicate = fixture(); duplicate.tools.push(duplicate.tools[0]);
    assert.throws(() => validateCatalog(duplicate), /duplicate/u);
    const missingOriginal = fixture(); missingOriginal.tools[0].state = 'planned';
    assert.throws(() => validateCatalog(missingOriginal), /cannot be unpublished/u);
});

test('contract paths are local and generated labels cannot inject HTML', () => {
    const data = fixture(); ray(data).name = '<script> & "Rays"';
    assert.match(renderHub(data), /&lt;script&gt; &amp; &quot;Rays&quot;/u);
    ray(data).capabilityContract = '../outside.json#rays';
    assert.throws(() => validateCatalog(data), /contract/u);
});

test('generation changes only the marked region and is idempotent', () => {
    const html = '<main><!-- catalog:hub:start -->old<!-- catalog:hub:end --></main>';
    const generated = replaceGeneratedRegion(html, 'hub', renderHub(catalog));
    assert.equal(replaceGeneratedRegion(generated, 'hub', renderHub(catalog)), generated);
    assert.ok(generated.startsWith('<main><!-- catalog:hub:start -->'));
    assert.ok(generated.endsWith('<!-- catalog:hub:end --></main>'));
    assert.throws(() => replaceGeneratedRegion('<main></main>', 'hub', ''), /region/u);
    assert.throws(() => replaceGeneratedRegion(html + '<!-- catalog:hub:start -->', 'hub', ''), /region/u);
});

test('checked-in hub and audit options are generated from the same catalog', async () => {
    for (const [file, region, render] of [['index.html', 'hub', renderHub], ['qa/ui-audit/index.html', 'audit', renderAuditOptions]]) {
        const html = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
        assert.equal(html, replaceGeneratedRegion(html, region, render(catalog)), `${file} is stale`);
    }
});

test('a copied directory cannot hide from runtime checks behind planned state', () => {
    const data = fixture(); ray(data).state = 'planned';
    const directories = runtimeTools(data).map(tool => tool.id);
    validateDirectoryCoverage(data, directories);
    assert.throws(() => validateDirectoryCoverage(data, [...directories, ray(data).id]), /must be marked migrating/u);
    ray(data).state = 'migrating';
    assert.throws(() => validateDirectoryCoverage(data, directories), /missing runtime directory/u);
    validateDirectoryCoverage(data, [...directories, ray(data).id]);
});

test('removing an original directory fails independently of the generated hub', () => {
    const directories = runtimeTools(catalog).map(tool => tool.id).filter(id => id !== 'sparky');
    assert.throws(() => validateDirectoryCoverage(catalog, directories), /sparky: missing runtime directory/u);
});
