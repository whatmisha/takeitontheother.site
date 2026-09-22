import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('framework snapshot verification succeeds with filesystem access restricted to upgrade', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const result = spawnSync(process.execPath, [
        '--permission', `--allow-fs-read=${root}`,
        `${root}scripts/bootstrap-framework-v3.mjs`, '--check'
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.error || ''}\n${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /50 immutable files/u);
    assert.match(result.stdout, /no donor access/u);
});
