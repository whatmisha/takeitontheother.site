import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateDirectoryCoverage, runtimeTools, validateCatalog } from '../registry.js';
import { resolveToolPath } from '../../scripts/lib/upgrade-paths.mjs';
import { compatibilityRoots } from '../../navigation/routes.mjs';

const root = new URL('../../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('infra/TOOL_CATALOG.json', root), 'utf8'));

test('root contains sixteen tool directories, infrastructure and redirect-only compatibility roots', async () => {
    const entries = await readdir(root, { withFileTypes: true });
    assert.deepEqual(entries.filter(item => item.isDirectory()).map(item => item.name).sort(), [...runtimeTools(catalog).map(tool => tool.id), 'infra', ...compatibilityRoots].sort());
    assert.deepEqual(entries.filter(item => !item.isDirectory() && item.name !== '.DS_Store').map(item => item.name).sort(), ['.gitignore', 'index.html', 'package.json']);
    validateDirectoryCoverage(catalog, entries.filter(item => item.isDirectory() && item.name !== 'infra').map(item => item.name));
    for (const tool of catalog.tools) {
        assert.equal(tool.entry, tool.id + '/index.html');
        assert.ok(!(await lstat(new URL(tool.id + '/', root))).isSymbolicLink());
    }
    await assert.rejects(lstat(new URL('tools/', root)), { code: 'ENOENT' });
});

test('historical paths resolve without rewriting historical evidence', () => {
    assert.equal(resolveToolPath('sparky/tests/staticSvgExporter.test.js'), 'sparky/tests/staticSvgExporter.test.js');
    assert.equal(resolveToolPath('tools/sparky/index.html'), 'sparky/index.html');
    assert.equal(resolveToolPath('framework/src/index.js'), 'infra/framework/src/index.js');
    assert.equal(resolveToolPath('qa/migrations/SOURCE_BASELINE.json'), 'infra/qa/migrations/SOURCE_BASELINE.json');
    assert.equal(resolveToolPath('infra/qa/migrations/SOURCE_BASELINE.json'), 'infra/qa/migrations/SOURCE_BASELINE.json');
    assert.equal(resolveToolPath('lunnen/sparky/index.html'), 'lunnen/sparky/index.html');
});

test('unregistered folders and former tools/ addresses cannot bypass coverage', () => {
    assert.throws(() => validateDirectoryCoverage(catalog, [...runtimeTools(catalog).map(tool => tool.id), 'unregistered']), /unregistered tool/u);
    const invalid = structuredClone(catalog);
    invalid.tools[0].entry = 'tools/sparky/index.html';
    assert.throws(() => validateCatalog(invalid), /entry/u);
});

test('all app navigation goes directly to the hub, without aliases or base tags', async () => {
    for (const tool of runtimeTools(catalog)) {
        const file = tool.id === 'grid_generator' ? 'grid_generator/src/ui/fragments/workspace.html' : tool.entry;
        const html = await readFile(new URL(file, root), 'utf8');
        assert.match(html, /href="\.\.\/"[^>]*>\s*←\s*YF Tools/u, tool.id);
        assert.doesNotMatch(html, /<base\b|http-equiv=["']refresh/i, tool.id);
        assert.equal(new URL('../', new URL(tool.entry, root)).href, root.href, tool.id);
    }
});

test('snapshots and historical acceptance reports survived byte-for-byte', async () => {
    const record = JSON.parse(await readFile(new URL('infra/qa/ROOT_LAYOUT_RELOCATION.json', root), 'utf8'));
    const evidence = record.files.filter(file => /^(?:baselines\/|releases\/|framework\/upstream-v3\/|(?:SOURCE_MANIFEST|EXPORT_ACCEPTANCE|FINAL_LIVE_ACCEPTANCE|KEYBOARD_ACCEPTANCE|PERSISTENCE_ACCEPTANCE|ROUND_TRIP_ACCEPTANCE|RUNTIME_RESILIENCE)\.json$|qa\/migrations\/(?:SOURCE_BASELINE\.json|BATCH7_COPY_MANIFEST\.json|rays\/(?:legacy-source|geometry-fixtures)\.json))/.test(file.from));
    assert.ok(evidence.length > 50);
    for (const file of evidence) assert.equal(createHash('sha256').update(await readFile(new URL(file.to, root))).digest('hex'), file.sha256, file.to);
});
