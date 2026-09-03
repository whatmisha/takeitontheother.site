import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('EXPORT_ACCEPTANCE.json', root), 'utf8'));
const capabilities = JSON.parse(await readFile(new URL('APPLICATION_CAPABILITIES.json', root), 'utf8'));
const normalize = value => String(value || '').replace(/<[^>]*>/gu, ' ').replace(/\s+/gu, ' ').trim();
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

assert.equal(manifest.schemaVersion, 1, 'unsupported export acceptance schema');
assert.equal(manifest.scope, 'upgrade-only', 'export acceptance scope changed');
assert.equal(manifest.applications.length, 8, 'all eight applications must be inventoried');

const expectedIds = capabilities.applications.map(app => app.id).sort();
const actualIds = manifest.applications.map(app => app.id).sort();
assert.deepEqual(actualIds, expectedIds, 'export inventory and capability manifest diverged');

let primaryCount = 0;
let artifactCoverage = 0;
let jsonExports = 0;
let jsonImports = 0;

for (const app of manifest.applications) {
    assert.ok(app.primary.length > 0, `${app.id} primary export missing`);
    const html = await readFile(new URL(app.html, root), 'utf8');
    assert.match(html, /\baction-dock\b/u, `${app.id} ActionDock missing`);

    for (const action of app.primary) {
        assert.ok(['svg', 'pdf', 'png'].includes(action.format), `${app.id} primary format unsupported`);
        assert.match(action.label, /^(?:All )?(?:SVG|PDF|PNG) ⌘E$/u, `${app.id} primary label is not canonical`);
        const button = html.match(new RegExp(
            `<button\\b(?=[^>]*\\bid=["']${escapeRegExp(action.id)}["'])[^>]*>[\\s\\S]*?<\\/button>`,
            'u'
        ))?.[0];
        assert.ok(button, `${app.id} primary button ${action.id} missing`);
        assert.match(button, /\bdata-action-dock-primary-export\b/u,
            `${app.id} primary button ${action.id} is not routed`);
        assert.equal(normalize(button), action.label, `${app.id} primary label changed`);
        primaryCount += 1;
    }

    for (const [kind, id] of [['export', app.json.exportId], ['import', app.json.importId]]) {
        if (!id) continue;
        const button = html.match(new RegExp(
            `<button\\b(?=[^>]*\\bid=["']${escapeRegExp(id)}["'])[^>]*>[\\s\\S]*?<\\/button>`,
            'u'
        ))?.[0];
        assert.ok(button, `${app.id} JSON ${kind} ${id} missing`);
        assert.match(button, /\bdata-action-dock-extra\b/u, `${app.id} JSON ${kind} is not optional`);
        assert.match(button, /\bhidden\b/u, `${app.id} JSON ${kind} must be hidden initially`);
        assert.match(button, new RegExp(`\\bdata-action-dock-json-${kind}\\b`, 'u'),
            `${app.id} JSON ${kind} shortcut marker missing`);
        if (kind === 'export') jsonExports += 1;
        else jsonImports += 1;
    }

    assert.ok(app.implementation.length > 0, `${app.id} implementation owner missing`);
    assert.ok(app.testEvidence.length > 0, `${app.id} test evidence missing`);
    await Promise.all([...app.implementation, ...app.testEvidence].map(path => access(new URL(path, root))));
    artifactCoverage += Number(app.artifactCoverage);
}

assert.equal(primaryCount, 9, 'primary export action count changed');
assert.equal(jsonExports, 4, 'JSON export surface count changed');
assert.equal(jsonImports, 3, 'JSON import surface count changed');
assert.equal(artifactCoverage, 8, 'all eight applications require artifact coverage at UPG-073');

console.log(
    `Export acceptance inventory passed: 8 apps; ${primaryCount} primary actions; `
    + `${jsonExports} JSON exports/${jsonImports} JSON imports; `
    + `${artifactCoverage}/8 artifact-covered.`
);
