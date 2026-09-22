import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('restored URLs invalidate changed module/style chains without requiring another rewrite', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const result = spawnSync(process.execPath, [
        '--permission', `--allow-fs-read=${root}`,
        `${root}infra/scripts/version-relocated-assets.mjs`
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.error || ''}\n${result.stderr}`);
    assert.equal(result.stdout.trim(), '', 'Unversioned dependency edges: ' + result.stdout);
});
