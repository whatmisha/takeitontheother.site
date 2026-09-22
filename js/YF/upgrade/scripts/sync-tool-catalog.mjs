import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { renderHub, renderAuditOptions, replaceGeneratedRegion } from '../catalog/registry.js';
import { readCatalog, readUpgrade, upgradeRoot } from './lib/tool-catalog.mjs';

// Mechanical generation only; no app source, legacy manifest or runtime state changes.
const args = process.argv.slice(2);
assert.ok(args.length === 1 && ['--check', '--write'].includes(args[0]), 'Use --check or explicit --write');
const catalog = await readCatalog();
for (const [file, region, render] of [
    ['index.html', 'hub', renderHub],
    ['qa/ui-audit/index.html', 'audit', renderAuditOptions]
]) {
    const current = await readUpgrade(file);
    const expected = replaceGeneratedRegion(current, region, render(catalog));
    if (args[0] === '--check') assert.equal(current, expected, `${file}: generated catalog is stale; run npm run catalog:sync`);
    else if (current !== expected) await writeFile(new URL(file, upgradeRoot), expected);
}
console.log(`Catalog HTML ${args[0] === '--check' ? 'verified' : 'synchronized'}: ${catalog.tools.length} tools; only accepted tools have hub links.`);
