import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import {
    getPublicSourceFingerprint,
    projectDirectory,
    runtimeDirectory
} from './public-runtime-utils.js';

const releasePath = path.join(runtimeDirectory, 'release.json');
const release = JSON.parse(await readFile(releasePath, 'utf8'));
const fingerprint = await getPublicSourceFingerprint();
if (release.fingerprint !== fingerprint) {
    throw new Error('Public runtime is stale. Run: npm --prefix tools run release');
}

for (const relativePath of Object.values(release.entry)) {
    await access(path.join(projectDirectory, relativePath));
}

const indexHtml = await readFile(path.join(projectDirectory, 'index.html'), 'utf8');
for (const relativePath of Object.values(release.entry)) {
    if (!indexHtml.includes(`./${relativePath}`)) {
        throw new Error(`Public index does not reference ${relativePath}`);
    }
}
if (/\b(?:src|href)="(?:\.\/)?(?:script\.js|style\.css)"/u.test(indexHtml)) {
    throw new Error('Public index must use the hashed runtime instead of source entry files');
}

const publicScript = await readFile(
    path.join(projectDirectory, release.entry.script),
    'utf8'
);
const sharedFrameworkSpecifier = '../../../framework/src/index.js';
if (
    !publicScript.includes(`"${sharedFrameworkSpecifier}"`) &&
    !publicScript.includes(`'${sharedFrameworkSpecifier}'`)
) {
    throw new Error('Public runtime must import the shared Upgrade framework at runtime');
}

const runtimeFiles = (await readdir(path.join(runtimeDirectory, 'assets'), { recursive: true }))
    .filter(file => !file.endsWith('.map'))
    .sort();
if (JSON.stringify(runtimeFiles) !== JSON.stringify(release.files)) {
    throw new Error('Public runtime asset inventory does not match release.json');
}

console.log(`Public runtime matches source (${runtimeFiles.length} hashed assets).`);
