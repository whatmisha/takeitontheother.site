import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const upgradeRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isolatedRoot = path.join(upgradeRoot, 'extracted/ui-garage');
const applicationRoots = [
    'sparky', 'grid_generator', 'label_generator', 'keyboarder',
    'wordplayer', 'dither', 'pulsar_coder', 'wander_bender'
];
const ignoredDirectories = new Set(['.git', '.cache', 'coverage', 'node_modules']);

async function collect(directory) {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === '.DS_Store' || ignoredDirectories.has(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) result.push({ absolute, symlink: true });
        else if (entry.isDirectory()) result.push(...await collect(absolute));
        else if (entry.isFile()) result.push({ absolute, symlink: false });
    }
    return result;
}

function git(args) {
    const result = spawnSync('git', args, { cwd: upgradeRoot, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || `git ${args.join(' ')} failed`);
    return result.stdout.trim();
}

const scopedStatus = git(['status', '--porcelain=v1', '--untracked-files=all', '--', ...applicationRoots]);
assert.equal(scopedStatus, '', `Extraction changed current application files:\n${scopedStatus}`);

const forbiddenConsumerReference = /(?:upgrade\/)?extracted\/ui-garage|(?:^|["'`/])ui-garage(?:["'`/]|$)/iu;
const applicationHashes = {};
for (const relativeRoot of applicationRoots) {
    const files = (await collect(path.join(upgradeRoot, relativeRoot))).filter(entry => !entry.symlink);
    const aggregate = createHash('sha256');
    for (const { absolute } of files.sort((a, b) => a.absolute.localeCompare(b.absolute))) {
        const data = await readFile(absolute);
        const relative = path.relative(upgradeRoot, absolute).split(path.sep).join('/');
        const text = data.includes(0) ? '' : data.toString('utf8');
        assert.doesNotMatch(text, forbiddenConsumerReference, `${relative} references the isolated UI Garage folder`);
        aggregate.update(relative).update('\0').update(data).update('\0');
    }
    applicationHashes[relativeRoot] = { files: files.length, sha256: aggregate.digest('hex') };
}

const isolatedEntries = await collect(isolatedRoot);
const isolatedSymlinks = isolatedEntries.filter(entry => entry.symlink);
assert.deepEqual(isolatedSymlinks, [], 'UI Garage contains symlinks');

const evidence = {
    status: 'passed',
    sourceHead: git(['rev-parse', 'HEAD']),
    workingTreeChangesInApplications: 0,
    consumerReferencesToIsolatedFolder: 0,
    isolatedSymlinks: 0,
    applicationHashes
};
console.log(JSON.stringify(evidence, null, 2));
