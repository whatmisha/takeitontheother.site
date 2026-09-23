import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { legacyRoutes, redirectDocument, compatibilityRoots } from '../navigation/routes.mjs';
const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('infra/TOOL_CATALOG.json', root), 'utf8'));
const routes = legacyRoutes(catalog);
const expected = new Set(routes.map(route => route.path + 'index.html'));
async function walk(relative) {
    for (const entry of await readdir(new URL(relative, root), { withFileTypes: true })) {
        const next = relative + entry.name;
        assert.ok(!entry.isSymbolicLink(), `Unexpected compatibility symlink: ${next}`);
        if (entry.isDirectory()) await walk(next + '/');
        else assert.ok(expected.has(next), `Obsolete file in compatibility directory: ${next}`);
    }
}
if (process.argv.includes('--write')) {
    for (const route of routes) {
        await mkdir(new URL(route.path, root), { recursive: true });
        await writeFile(new URL(route.path + 'index.html', root), redirectDocument(route));
    }
}
for (const route of routes) {
    assert.equal(await readFile(new URL(route.path + 'index.html', root), 'utf8'), redirectDocument(route), route.path);
    await readFile(new URL(route.target + 'index.html', root));
}
for (const directory of compatibilityRoots) await walk(directory + '/');
console.log(`Legacy routes verified: ${routes.length} redirects, no old application code.`);
