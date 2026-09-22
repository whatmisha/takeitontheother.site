import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { validateDirectoryCoverage, runtimeTools, validateCatalog } from '../registry.js';
import { resolveToolPath } from '../../scripts/lib/upgrade-paths.mjs';

const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('TOOL_CATALOG.json', root), 'utf8'));

test('all runtime tools live only under tools/; no root copies or aliases', async () => {
    const directories = (await readdir(new URL('tools/', root), { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name);
    assert.deepEqual(directories.sort(), runtimeTools(catalog).map(tool => tool.id).sort());
    validateDirectoryCoverage(catalog, directories);
    for (const tool of catalog.tools) {
        assert.equal(tool.entry, `tools/${tool.id}/index.html`);
        await assert.rejects(lstat(new URL(`${tool.id}/`, root)), { code: 'ENOENT' });
    }
});

test('legacy acceptance paths resolve without changing already canonical/shared paths', () => {
    assert.equal(resolveToolPath('sparky/tests/staticSvgExporter.test.js'), 'tools/sparky/tests/staticSvgExporter.test.js');
    assert.equal(resolveToolPath('tools/sparky/index.html'), 'tools/sparky/index.html');
    assert.equal(resolveToolPath('framework/src/index.js'), 'framework/src/index.js');
    assert.equal(resolveToolPath('qa/migrations/SOURCE_BASELINE.json'), 'qa/migrations/SOURCE_BASELINE.json');
    assert.equal(resolveToolPath('lunnen/sparky/index.html'), 'lunnen/sparky/index.html');
});

test('unregistered folders and legacy-root catalog addresses cannot bypass coverage', () => {
    assert.throws(() => validateDirectoryCoverage(catalog, [...runtimeTools(catalog).map(tool => tool.id), 'unregistered']), /unregistered tool/u);
    const invalid = structuredClone(catalog);
    invalid.tools[0].entry = 'sparky/index.html';
    assert.throws(() => validateCatalog(invalid), /upgrade\/tools/u);
});

test('every app navigation resolves to the same hub after the extra directory level', async () => {
    for (const tool of runtimeTools(catalog)) {
        const entry = tool.id === 'grid_generator' ? 'tools/grid_generator/src/ui/fragments/workspace.html' : tool.entry;
        const html = await readFile(new URL(entry, root), 'utf8');
        assert.match(html, /href="\.\.\/\.\.\/"[^>]*>\s*←\s*Upgrade Tools/u, tool.id);
        const currentPage = new URL(tool.entry, root);
        assert.equal(new URL('../../', currentPage).href, root.href, tool.id);
    }
});

test('active QA pages do not retain old app-root links', async () => {
    const staleLink = new RegExp(`\\.\\./(?:${catalog.tools.map(tool => tool.id).join('|')})/`, 'u');
    async function visit(directory) {
        for (const item of await readdir(directory, { withFileTypes: true })) {
            const url = new URL(item.name + (item.isDirectory() ? '/' : ''), directory);
            if (item.isDirectory() && item.name !== 'migrations') await visit(url);
            else if (item.isFile() && /\.(?:html|js)$/.test(item.name)) {
                assert.doesNotMatch(await readFile(url, 'utf8'), staleLink, url.pathname);
            }
        }
    }
    await visit(new URL('qa/', root));
});
