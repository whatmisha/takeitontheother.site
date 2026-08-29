import { createHash } from 'node:crypto';
import { chmod, copyFile, lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const yfRoot = path.dirname(upgradeRoot);
const siteRoot = path.resolve(yfRoot, '..', '..');
const sourceRoot = path.join(siteRoot, 'js', 'othersite-ui-framework', 'v3');
const upstreamRoot = path.join(upgradeRoot, 'framework', 'upstream-v3');
const workingRoot = path.join(upgradeRoot, 'framework');
const sourcePrefix = 'takeitontheother.site/js/othersite-ui-framework/v3/';
const checkOnly = process.argv.includes('--check');

const manifest = JSON.parse(await readFile(path.join(upgradeRoot, 'SOURCE_MANIFEST.json'), 'utf8'));
const entries = (manifest.entries || [])
    .filter(entry => entry.project === 'framework-v3' && entry.decision === 'donor-only')
    .sort((a, b) => a.source.localeCompare(b.source, 'en'));
if (entries.length !== 50) throw new Error(`Expected 50 framework-v3 manifest entries, found ${entries.length}`);

function isInside(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function sha256(filePath) {
    const data = await readFile(filePath);
    return createHash('sha256').update(data).digest('hex');
}

async function metadataOrNull(filePath) {
    try {
        return await lstat(filePath);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

async function copyExact(sourcePath, targetPath, entry) {
    await mkdir(path.dirname(targetPath), { recursive: true });
    const temporaryPath = `${targetPath}.framework-bootstrap-${process.pid}`;
    try {
        await copyFile(sourcePath, temporaryPath);
        await chmod(temporaryPath, Number.parseInt(entry.mode, 8));
        if (await sha256(temporaryPath) !== entry.sha256) throw new Error(`Copied hash mismatch: ${entry.source}`);
        await rename(temporaryPath, targetPath);
    } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
    }
}

let upstreamCopied = 0;
let workingCopied = 0;
let workingModified = 0;
const records = [];
const realSourceRoot = await realpath(sourceRoot);

for (const entry of entries) {
    if (!entry.source.startsWith(sourcePrefix)) throw new Error(`Unexpected framework source path: ${entry.source}`);
    const relativePath = entry.source.slice(sourcePrefix.length);
    const sourcePath = path.resolve(sourceRoot, ...relativePath.split('/'));
    const upstreamPath = path.resolve(upstreamRoot, ...relativePath.split('/'));
    const workingPath = path.resolve(workingRoot, ...relativePath.split('/'));
    if (!isInside(realSourceRoot, await realpath(sourcePath))) throw new Error(`Source escapes framework v3: ${entry.source}`);
    if (!isInside(upstreamRoot, upstreamPath) || !isInside(workingRoot, workingPath)) {
        throw new Error(`Framework target escapes upgrade: ${relativePath}`);
    }
    if (await sha256(sourcePath) !== entry.sha256) throw new Error(`Framework v3 source changed: ${entry.source}`);

    const upstreamMetadata = await metadataOrNull(upstreamPath);
    if (upstreamMetadata) {
        if (!upstreamMetadata.isFile() || upstreamMetadata.isSymbolicLink()) throw new Error(`Invalid upstream snapshot file: ${relativePath}`);
        if (await sha256(upstreamPath) !== entry.sha256) throw new Error(`Immutable upstream snapshot changed: ${relativePath}`);
    } else if (checkOnly) {
        throw new Error(`Missing immutable upstream snapshot file: ${relativePath}`);
    } else {
        await copyExact(sourcePath, upstreamPath, entry);
        upstreamCopied += 1;
    }

    const workingMetadata = await metadataOrNull(workingPath);
    let workingStatus = 'upstream-exact';
    if (workingMetadata) {
        if (!workingMetadata.isFile() || workingMetadata.isSymbolicLink()) throw new Error(`Invalid working framework file: ${relativePath}`);
        if (await sha256(workingPath) !== entry.sha256) {
            workingStatus = 'upgrade-modified';
            workingModified += 1;
        }
    } else if (checkOnly) {
        throw new Error(`Missing working framework file: ${relativePath}`);
    } else {
        await copyExact(sourcePath, workingPath, entry);
        workingCopied += 1;
    }

    records.push({
        path: relativePath,
        sha256: entry.sha256,
        bytes: entry.bytes,
        workingStatus
    });
}

const provenance = {
    schemaVersion: 1,
    source: 'othersite-ui-framework/v3',
    immutableSnapshot: 'framework/upstream-v3',
    workingTree: 'framework',
    files: records
};
const provenancePath = path.join(upgradeRoot, 'framework', 'UPSTREAM_V3.json');
const serialized = `${JSON.stringify(provenance, null, 2)}\n`;

if (checkOnly) {
    if (await readFile(provenancePath, 'utf8') !== serialized) throw new Error('framework/UPSTREAM_V3.json is stale');
    console.log(`Framework v3 provenance passed: ${records.length} immutable files, ${workingModified} working modifications.`);
} else {
    await writeFile(provenancePath, serialized, 'utf8');
    console.log(`Framework v3 bootstrapped: ${upstreamCopied} upstream files copied, ${workingCopied} working files copied, ${workingModified} working files preserved.`);
}
