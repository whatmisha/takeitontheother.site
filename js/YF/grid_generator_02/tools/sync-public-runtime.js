import {
    cp,
    mkdir,
    readdir,
    rm,
    writeFile
} from 'node:fs/promises';
import path from 'node:path';

import {
    buildDirectory,
    getPublicSourceFingerprint,
    projectDirectory,
    readBuildEntry,
    renderApplicationDocument,
    runtimeDirectory
} from './public-runtime-utils.js';

async function copyRuntimeAssets(sourceDirectory, destinationDirectory) {
    await mkdir(destinationDirectory, { recursive: true });
    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    await Promise.all(entries.map(async entry => {
        if (entry.name.endsWith('.map')) return;
        const sourcePath = path.join(sourceDirectory, entry.name);
        const destinationPath = path.join(destinationDirectory, entry.name);
        if (entry.isDirectory()) {
            await copyRuntimeAssets(sourcePath, destinationPath);
        } else {
            await cp(sourcePath, destinationPath);
        }
    }));
}

const entry = await readBuildEntry();
const runtimeAssetsDirectory = path.join(runtimeDirectory, 'assets');
await rm(runtimeDirectory, { recursive: true, force: true });
await copyRuntimeAssets(path.join(buildDirectory, 'assets'), runtimeAssetsDirectory);

const publicEntry = {
    script: `runtime/${entry.script}`,
    style: `runtime/${entry.style}`
};
const indexHtml = await renderApplicationDocument({
    scriptHref: `./${publicEntry.script}`,
    styleHref: `./${publicEntry.style}`
});
await writeFile(path.join(projectDirectory, 'index.html'), indexHtml, 'utf8');
await writeFile(path.join(runtimeDirectory, 'README.md'), `# Public runtime

Generated, content-hashed browser assets used by the root \`index.html\`.
Do not edit this directory by hand. After changing application source, run:

\`\`\`bash
npm --prefix tools run release
\`\`\`

\`release.json\` binds these files to the exact source fingerprint checked by
\`npm --prefix tools run public:check\`.
`, 'utf8');

const files = (await readdir(runtimeAssetsDirectory, { recursive: true }))
    .filter(file => !file.endsWith('.map'))
    .sort();
await writeFile(path.join(runtimeDirectory, 'release.json'), `${JSON.stringify({
    version: 1,
    fingerprint: await getPublicSourceFingerprint(),
    entry: publicEntry,
    files
}, null, 2)}\n`, 'utf8');

console.log(`Public runtime synchronized (${files.length} hashed assets).`);
