import { createHash } from 'node:crypto';
import { chmod, copyFile, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const checkOnly = process.argv.includes('--check');

const assets = [
    ['keyboarder/Fonts/CoFo Sans/CoFoSans-Regular.woff2', 'framework/fonts/CoFoSans-Regular.woff2', 'CoFo Sans Regular', 'UI font'],
    ['keyboarder/Fonts/CoFo Sans/CoFoSans-Regular.woff', 'framework/fonts/CoFoSans-Regular.woff', 'CoFo Sans Regular', 'UI font fallback'],
    ['keyboarder/Fonts/CoFo Sans/CoFoSans-Medium.woff2', 'framework/fonts/CoFoSans-Medium.woff2', 'CoFo Sans Medium', 'UI font'],
    ['keyboarder/Fonts/CoFo Sans/CoFoSans-Medium.woff', 'framework/fonts/CoFoSans-Medium.woff', 'CoFo Sans Medium', 'UI font fallback'],
    ['keyboarder/vendor/lib/jspdf.umd.min.js', 'framework/vendor/jspdf/2.5.1/jspdf.umd.min.js', 'jsPDF 2.5.1', 'Framework v3 and legacy Label export'],
    ['keyboarder/vendor/lib/svg2pdf.umd.min.js', 'framework/vendor/svg2pdf/2.2.3/svg2pdf.umd.min.js', 'svg2pdf.js 2.2.3', 'Framework v3 export'],
    ['keyboarder/vendor/lib/opentype.module.js', 'framework/vendor/opentype/1.3.4/opentype.module.js', 'opentype.js 1.3.4 ESM', 'Framework text-to-path'],
    ['grid_generator/vendor/opentype.min.js', 'framework/vendor/opentype/1.3.4/opentype.min.js', 'opentype.js 1.3.4 UMD', 'Legacy Label text-to-path'],
    ['grid_generator/vendor/licenses/jspdf.txt', 'framework/vendor/licenses/jspdf.txt', 'jsPDF license', 'License'],
    ['grid_generator/vendor/licenses/svg2pdf.js.txt', 'framework/vendor/licenses/svg2pdf.js.txt', 'svg2pdf.js license', 'License'],
    ['grid_generator/vendor/licenses/opentype.js.txt', 'framework/vendor/licenses/opentype.js.txt', 'opentype.js license', 'License']
].map(([source, target, name, purpose]) => ({ source, target, name, purpose }));

const pinnedDownloads = [
    {
        target: 'framework/vendor/paper/0.12.17/paper-full.min.js',
        sourceUrl: 'https://cdn.jsdelivr.net/npm/paper@0.12.17/dist/paper-full.min.js',
        name: 'Paper.js 0.12.17',
        purpose: 'Wander Bender runtime',
        sha256: 'e984608dd2c0c80d2ec3da46513b561f13ace5505527e4b31940421901661134',
        bytes: 234982
    },
    {
        target: 'framework/vendor/paper/0.12.17/LICENSE.txt',
        sourceUrl: 'https://raw.githubusercontent.com/paperjs/paper.js/v0.12.17/LICENSE.txt',
        name: 'Paper.js license',
        purpose: 'License',
        sha256: 'f8833a38807922b4652421eb0cf29065400c55abd6f4832b9c3250dae87e1958',
        bytes: 1173
    },
    {
        target: 'framework/vendor/svg2pdf/2.0.0/svg2pdf.umd.js',
        sourceUrl: 'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.0.0/dist/svg2pdf.umd.js',
        name: 'svg2pdf.js 2.0.0',
        purpose: 'Sticky Fingers legacy export compatibility',
        sha256: 'a70d5a95957b0dafc2e738594d2f3925e050ba371152709127e453945aea6d81',
        bytes: 227835
    }
];

async function sha256(filePath) {
    const data = await readFile(filePath);
    return createHash('sha256').update(data).digest('hex');
}

async function copyVerified(asset) {
    const sourcePath = path.join(upgradeRoot, asset.source);
    const targetPath = path.join(upgradeRoot, asset.target);
    const sourceMetadata = await lstat(sourcePath);
    if (!sourceMetadata.isFile() || sourceMetadata.isSymbolicLink()) throw new Error(`Invalid source asset: ${asset.source}`);
    const sourceHash = await sha256(sourcePath);

    try {
        const targetMetadata = await lstat(targetPath);
        if (!targetMetadata.isFile() || targetMetadata.isSymbolicLink()) throw new Error(`Invalid target asset: ${asset.target}`);
        const targetHash = await sha256(targetPath);
        if (targetHash !== sourceHash) throw new Error(`Shared asset differs from its pinned source: ${asset.target}`);
        return { ...asset, sha256: sourceHash, bytes: sourceMetadata.size, status: 'current' };
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (checkOnly) throw new Error(`Missing shared asset: ${asset.target}`);
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    const temporaryPath = `${targetPath}.upgrade-copy-${process.pid}`;
    try {
        await copyFile(sourcePath, temporaryPath);
        await chmod(temporaryPath, sourceMetadata.mode & 0o777);
        if (await sha256(temporaryPath) !== sourceHash) throw new Error(`Copied asset hash mismatch: ${asset.target}`);
        await rename(temporaryPath, targetPath);
    } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
    }

    return { ...asset, sha256: sourceHash, bytes: sourceMetadata.size, status: 'copied' };
}

async function verifyPinnedDownload(asset) {
    const targetPath = path.join(upgradeRoot, asset.target);
    let metadata;
    try {
        metadata = await lstat(targetPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Missing pinned download: ${asset.target}. Restore it from ${asset.sourceUrl}`);
        }
        throw error;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Invalid pinned download: ${asset.target}`);
    if (metadata.size !== asset.bytes) throw new Error(`Pinned download size mismatch: ${asset.target}`);
    if (await sha256(targetPath) !== asset.sha256) throw new Error(`Pinned download hash mismatch: ${asset.target}`);
    return asset;
}

const results = [];
for (const asset of assets) results.push(await copyVerified(asset));
const downloadedResults = [];
for (const asset of pinnedDownloads) downloadedResults.push(await verifyPinnedDownload(asset));

const versionsPath = path.join(upgradeRoot, 'framework/vendor/VERSIONS.json');
const versions = {
    schemaVersion: 1,
    generatedBy: 'scripts/sync-bootstrap-assets.mjs',
    assets: results.map(({ status: _status, ...asset }) => asset),
    downloadedAssets: downloadedResults
};
const serialized = `${JSON.stringify(versions, null, 2)}\n`;

if (checkOnly) {
    const actual = await readFile(versionsPath, 'utf8');
    if (actual !== serialized) throw new Error('framework/vendor/VERSIONS.json is stale.');
    console.log(`Verified ${results.length} shared assets and ${downloadedResults.length} pinned downloads.`);
} else {
    await writeFile(versionsPath, serialized, 'utf8');
    const copied = results.filter(result => result.status === 'copied').length;
    console.log(`Synchronized ${results.length} shared assets; ${copied} copied, ${results.length - copied} already current.`);
}
