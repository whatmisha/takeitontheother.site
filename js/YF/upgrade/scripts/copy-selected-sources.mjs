import { createHash } from 'node:crypto';
import { access, chmod, copyFile, lstat, mkdir, readFile, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const yfRoot = path.dirname(upgradeRoot);
const upgradeRealRoot = await realpath(upgradeRoot);
const manifest = JSON.parse(await readFile(path.join(upgradeRoot, 'SOURCE_MANIFEST.json'), 'utf8'));

const allowedTools = new Set([
    'dither',
    'grid_generator',
    'keyboarder',
    'label_generator',
    'pulsar_coder',
    'sparky',
    'wander_bender',
    'wordplayer'
]);

const sourceMounts = [
    {
        prefix: 'takeitontheother.site/js/YF/lunnen/',
        absolute: path.join(yfRoot, 'lunnen')
    }
];

const checkOnly = process.argv.includes('--check');
const dryRun = process.argv.includes('--dry-run');

function isInside(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sourcePathFor(source) {
    const mount = sourceMounts.find(candidate => source.startsWith(candidate.prefix));
    if (!mount) throw new Error(`No source mount for ${source}`);
    const relative = source.slice(mount.prefix.length);
    const absolute = path.resolve(mount.absolute, relative);
    if (!isInside(mount.absolute, absolute)) throw new Error(`Source escapes its mount: ${source}`);
    return { absolute, mount };
}

async function sha256(filePath) {
    const data = await readFile(filePath);
    return createHash('sha256').update(data).digest('hex');
}

async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function assertNoTargetSymlink(targetPath) {
    const relative = path.relative(upgradeRoot, path.dirname(targetPath));
    let current = upgradeRoot;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        try {
            const metadata = await lstat(current);
            if (metadata.isSymbolicLink()) throw new Error(`Target ancestor is a symlink: ${current}`);
        } catch (error) {
            if (error.code === 'ENOENT') break;
            throw error;
        }
    }
}

const copyEntries = (manifest.entries || []).filter(entry => entry.decision === 'copy');
if (!copyEntries.length) throw new Error('Source manifest has no copy entries.');

let copied = 0;
let unchanged = 0;
let checked = 0;
let bytes = 0;

for (const entry of copyEntries) {
    const normalizedTarget = path.posix.normalize(entry.target || '');
    const topLevel = normalizedTarget.split('/')[0];
    if (!allowedTools.has(topLevel)) throw new Error(`Target is not an allowed tool path: ${entry.target}`);
    if (path.posix.isAbsolute(normalizedTarget) || normalizedTarget === '..' || normalizedTarget.startsWith('../')) {
        throw new Error(`Target escapes upgrade: ${entry.target}`);
    }

    const targetPath = path.resolve(upgradeRoot, ...normalizedTarget.split('/'));
    if (!isInside(upgradeRealRoot, targetPath)) throw new Error(`Resolved target escapes upgrade: ${targetPath}`);
    await assertNoTargetSymlink(targetPath);

    const { absolute: sourcePath, mount } = sourcePathFor(entry.source);
    const sourceRealPath = await realpath(sourcePath);
    const sourceRealMount = await realpath(mount.absolute);
    if (!isInside(sourceRealMount, sourceRealPath)) throw new Error(`Resolved source escapes its mount: ${entry.source}`);

    const sourceHash = await sha256(sourceRealPath);
    if (sourceHash !== entry.sha256) throw new Error(`Source changed after manifest generation: ${entry.source}`);

    if (checkOnly) {
        if (!(await exists(targetPath))) throw new Error(`Missing copied file: ${entry.target}`);
        const targetMetadata = await lstat(targetPath);
        if (!targetMetadata.isFile() || targetMetadata.isSymbolicLink()) throw new Error(`Copied target is not a regular file: ${entry.target}`);
        const targetHash = await sha256(targetPath);
        if (targetHash !== entry.sha256) throw new Error(`Copied target differs from source: ${entry.target}`);
        checked += 1;
        bytes += entry.bytes;
        continue;
    }

    if (await exists(targetPath)) {
        const targetMetadata = await lstat(targetPath);
        if (!targetMetadata.isFile() || targetMetadata.isSymbolicLink()) throw new Error(`Existing target is not a regular file: ${entry.target}`);
        const targetHash = await sha256(targetPath);
        if (targetHash !== entry.sha256) throw new Error(`Refusing to overwrite changed target: ${entry.target}`);
        unchanged += 1;
        bytes += entry.bytes;
        continue;
    }

    if (dryRun) {
        checked += 1;
        bytes += entry.bytes;
        continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    const targetRealDirectory = await realpath(path.dirname(targetPath));
    if (!isInside(upgradeRealRoot, targetRealDirectory)) throw new Error(`Target directory escapes upgrade: ${targetRealDirectory}`);

    const temporaryPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.upgrade-copy-${process.pid}`);
    try {
        await copyFile(sourceRealPath, temporaryPath);
        await chmod(temporaryPath, Number.parseInt(entry.mode, 8));
        const copiedHash = await sha256(temporaryPath);
        if (copiedHash !== entry.sha256) throw new Error(`Copied bytes do not match manifest: ${entry.target}`);
        await rename(temporaryPath, targetPath);
    } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
    }

    copied += 1;
    bytes += entry.bytes;
}

if (checkOnly) {
    console.log(`Verified ${checked} copied files (${bytes} bytes) against SOURCE_MANIFEST.json.`);
} else if (dryRun) {
    console.log(`Dry run passed for ${checked} new and ${unchanged} existing files (${bytes} bytes).`);
} else {
    console.log(`Copied ${copied} files; ${unchanged} already matched (${bytes} bytes total).`);
}

