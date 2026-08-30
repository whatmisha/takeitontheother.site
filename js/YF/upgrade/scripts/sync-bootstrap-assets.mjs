import { createHash } from 'node:crypto';
import { chmod, copyFile, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const checkOnly = process.argv.includes('--check');

const assets = [
    ['keyboarder/vendor/lib/opentype.module.js', 'framework/vendor/opentype/1.3.4/opentype.module.js', 'opentype.js 1.3.4 ESM', 'Framework text-to-path'],
    ['grid_generator/vendor/opentype.min.js', 'framework/vendor/opentype/1.3.4/opentype.min.js', 'opentype.js 1.3.4 UMD', 'Legacy Label text-to-path'],
    ['grid_generator/vendor/licenses/jspdf.txt', 'framework/vendor/licenses/jspdf.txt', 'jsPDF license', 'License'],
    ['grid_generator/vendor/licenses/svg2pdf.js.txt', 'framework/vendor/licenses/svg2pdf.js.txt', 'svg2pdf.js license', 'License'],
    ['grid_generator/vendor/licenses/opentype.js.txt', 'framework/vendor/licenses/opentype.js.txt', 'opentype.js license', 'License']
].map(([source, target, name, purpose]) => ({ source, target, name, purpose }));

// These files were promoted from Keyboarder during G1 and became framework-owned
// at G3. Keep their original hashes instead of retaining duplicate source files.
const canonicalAssets = [
    {
        target: 'framework/fonts/CoFoSans-Regular.woff2',
        promotedFrom: 'keyboarder/Fonts/CoFo Sans/CoFoSans-Regular.woff2',
        name: 'CoFo Sans Regular', purpose: 'UI font',
        sha256: '54d749f8c8f836f4131e40deecf693964543c4cfb0c11252097ebe164ee0800a', bytes: 44052
    },
    {
        target: 'framework/fonts/CoFoSans-Regular.woff',
        promotedFrom: 'keyboarder/Fonts/CoFo Sans/CoFoSans-Regular.woff',
        name: 'CoFo Sans Regular', purpose: 'UI font fallback',
        sha256: '8088a648ae9746bb622236cc1cfefee4371e82187ec491bdecc031d047ea1868', bytes: 58344
    },
    {
        target: 'framework/fonts/CoFoSans-Medium.woff2',
        promotedFrom: 'keyboarder/Fonts/CoFo Sans/CoFoSans-Medium.woff2',
        name: 'CoFo Sans Medium', purpose: 'UI font',
        sha256: '1f3b5c06e57fc906c6970dc5d1a08ae407507bb78673339a1e130c686abb0d45', bytes: 45248
    },
    {
        target: 'framework/fonts/CoFoSans-Medium.woff',
        promotedFrom: 'keyboarder/Fonts/CoFo Sans/CoFoSans-Medium.woff',
        name: 'CoFo Sans Medium', purpose: 'UI font fallback',
        sha256: '61b4a304ae6bcb47f3a18e9a3e27fd47ea649fe4ead128eda4b649f7b1fa7eef', bytes: 59612
    },
    {
        target: 'framework/vendor/jspdf/2.5.1/jspdf.umd.min.js',
        promotedFrom: 'keyboarder/vendor/lib/jspdf.umd.min.js',
        name: 'jsPDF 2.5.1', purpose: 'Framework v3 and legacy Label export',
        sha256: '98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875', bytes: 364463
    },
    {
        target: 'framework/vendor/svg2pdf/2.2.3/svg2pdf.umd.min.js',
        promotedFrom: 'keyboarder/vendor/lib/svg2pdf.umd.min.js',
        name: 'svg2pdf.js 2.2.3', purpose: 'Framework v3 export',
        sha256: 'fdfbbf24d434fe653f7a553bd52093177702ddb285a57508f28cba3f303a33f6', bytes: 84587
    }
];

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

async function verifyPinnedAsset(asset, kind) {
    const targetPath = path.join(upgradeRoot, asset.target);
    let metadata;
    try {
        metadata = await lstat(targetPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            const origin = asset.sourceUrl || `the G0 source manifest entry ${asset.promotedFrom}`;
            throw new Error(`Missing ${kind}: ${asset.target}. Restore it from ${origin}`);
        }
        throw error;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Invalid ${kind}: ${asset.target}`);
    if (metadata.size !== asset.bytes) throw new Error(`${kind} size mismatch: ${asset.target}`);
    if (await sha256(targetPath) !== asset.sha256) throw new Error(`${kind} hash mismatch: ${asset.target}`);
    return asset;
}

const results = [];
for (const asset of assets) results.push(await copyVerified(asset));
const canonicalResults = [];
for (const asset of canonicalAssets) canonicalResults.push(await verifyPinnedAsset(asset, 'canonical asset'));
const downloadedResults = [];
for (const asset of pinnedDownloads) downloadedResults.push(await verifyPinnedAsset(asset, 'pinned download'));

const versionsPath = path.join(upgradeRoot, 'framework/vendor/VERSIONS.json');
const versions = {
    schemaVersion: 2,
    generatedBy: 'scripts/sync-bootstrap-assets.mjs',
    assets: results.map(({ status: _status, ...asset }) => asset),
    canonicalAssets: canonicalResults,
    downloadedAssets: downloadedResults
};
const serialized = `${JSON.stringify(versions, null, 2)}\n`;

if (checkOnly) {
    const actual = await readFile(versionsPath, 'utf8');
    if (actual !== serialized) throw new Error('framework/vendor/VERSIONS.json is stale.');
    console.log(`Verified ${results.length + canonicalResults.length} shared assets and ${downloadedResults.length} pinned downloads.`);
} else {
    await writeFile(versionsPath, serialized, 'utf8');
    const copied = results.filter(result => result.status === 'copied').length;
    console.log(`Synchronized ${results.length + canonicalResults.length} shared assets; ${copied} copied, ${results.length - copied} source-backed and ${canonicalResults.length} canonical.`);
}
