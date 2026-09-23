// One-time, recoverable move. No recursive deletion and no writes outside the
// explicitly supplied backup and the verified YF directory.
import assert from 'node:assert/strict';
import { lstat, readdir, realpath, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
assert.equal(path.basename(source), 'upgrade', 'Already promoted; never run twice');
const destination = path.dirname(source);
assert.equal(path.basename(destination), 'YF');
const oldNames = ['.DS_Store', 'index.html', 'lunnen', 'muted', 'pragma'];
const expected = [...oldNames, 'upgrade'].sort();
assert.deepEqual((await readdir(destination)).sort(), expected, 'Unexpected files at destination; stop before moving anything');
const entries = await readdir(source);
for (const name of entries) {
    assert.ok(!oldNames.includes(name) || ['index.html', '.DS_Store'].includes(name));
    assert.ok(!(await lstat(path.join(source, name))).isSymbolicLink(), 'Root entries must be real files/directories');
}
if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify({ source, destination, archive: oldNames, promote: entries }, null, 2));
} else {
    const backup = await realpath(process.argv[process.argv.indexOf('--backup') + 1]);
    assert.ok(backup.startsWith('/Users/mishaivanov/.codex/backups/yf-before-promotion-'));
    assert.deepEqual(await readdir(backup), [], 'Backup must be empty');
    for (const name of oldNames) await rename(path.join(destination, name), path.join(backup, name));
    for (const name of entries) await rename(path.join(source, name), path.join(destination, name));
    // Keep the now-empty directory: it will hold compatibility redirect pages.
    console.log(JSON.stringify({ backup, destination, promoted: entries.length }));
}
