// Acceptance validates frozen provenance locally. Comparing today's donor trees
// is an explicit diagnostic, not a runtime/build dependency on another folder.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const bytes = await readFile(new URL('infra/SOURCE_MANIFEST.json', root));
const relocation = JSON.parse(await readFile(new URL('infra/qa/ROOT_LAYOUT_RELOCATION.json', root), 'utf8'));
const record = relocation.files.find(file => file.to === 'infra/SOURCE_MANIFEST.json');
assert.ok(record, 'Frozen manifest hash is required');
assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, 'Historical manifest must not be regenerated');
const manifest = JSON.parse(bytes);
assert.equal(manifest.schemaVersion, 1);
assert.ok(manifest.entries.length > 0);
const targets = new Set();
for (const entry of manifest.entries) {
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.ok(['copy', 'donor-only'].includes(entry.decision));
    if (entry.decision === 'copy') {
        assert.ok(entry.target && !entry.target.startsWith('/') && !entry.target.split('/').includes('..'));
        assert.ok(!targets.has(entry.target)); targets.add(entry.target);
    } else assert.equal(entry.target, null);
}
console.log(`Frozen source provenance verified locally: ${manifest.entries.length} entries. Use manifest:check-originals for an optional donor comparison.`);
