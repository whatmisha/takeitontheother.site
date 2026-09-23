import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifestPath = path.join(root, 'framework-manifest.json');
const ignoredNames = new Set(['framework-manifest.json']);

async function collectFiles(directory = root) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === '.DS_Store') throw new Error(`Remove Finder metadata before release: ${path.join(directory, entry.name)}`);
        if (entry.isDirectory() && / \d+$/u.test(entry.name)) {
            throw new Error(`Remove duplicate sync directory before release: ${path.join(directory, entry.name)}`);
        }
        if (ignoredNames.has(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await collectFiles(absolute));
        else if (entry.isFile()) files.push(absolute);
    }
    return files;
}

const version = JSON.parse(await readFile(path.join(root, 'VERSION.json'), 'utf8'));
const files = [];
for (const absolute of (await collectFiles()).sort()) {
    const data = await readFile(absolute);
    files.push({
        path: path.relative(root, absolute).split(path.sep).join('/'),
        bytes: data.byteLength,
        sha256: createHash('sha256').update(data).digest('hex')
    });
}

const manifest = {
    schemaVersion: 1,
    name: version.name,
    version: version.version,
    hashAlgorithm: 'sha256',
    files
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote framework-manifest.json with ${files.length} files.`);
