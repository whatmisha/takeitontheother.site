import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readUpgrade, upgradeRoot } from './lib/tool-catalog.mjs';

// Deliberately separate from runtime/offline checks: explicit, read-only access to originals.
assert.deepEqual(process.argv.slice(2), ['--verify-originals'], 'This provenance check requires explicit --verify-originals');
const baseline = JSON.parse(await readUpgrade('infra/qa/migrations/SOURCE_BASELINE.json'));
const yfRoot = await realpath(fileURLToPath(new URL('../', upgradeRoot)));
let checked = 0, bytes = 0;
const changes = [];
for (const tool of baseline.tools) {
    assert.match(tool.sourceRoot, /^(?:lunnen|muted)\/[a-z0-9_-]+(?:\/01)?$/u);
    for (const file of tool.files) {
        assert.match(file.path, /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/u);
        assert.ok(!file.path.split('/').includes('..'));
        const candidate = path.join(yfRoot, tool.sourceRoot, file.path);
        const resolved = await realpath(candidate);
        assert.ok(resolved.startsWith(`${yfRoot}${path.sep}`), 'Source symlink escapes YF');
        const data = await readFile(resolved);
        const hash = createHash('sha256').update(data).digest('hex');
        if (data.length !== file.bytes || hash !== file.sha256) changes.push(`${tool.id}/${file.path}`);
        checked++; bytes += data.length;
    }
}
assert.deepEqual(changes, [], 'Original sources changed since baseline; review the changes before copying, do not blindly regenerate the baseline');
console.log(`Migration source baseline verified: ${baseline.tools.length} tools, ${checked} files, ${bytes} bytes; originals only read, never written.`);
