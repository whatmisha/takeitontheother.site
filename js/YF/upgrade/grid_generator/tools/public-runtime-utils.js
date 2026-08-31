import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const projectDirectory = path.resolve(toolsDirectory, '..');
export const buildDirectory = path.join(projectDirectory, 'build');
export const runtimeDirectory = path.join(projectDirectory, 'runtime');
export const documentTemplatePath = path.join(
    projectDirectory,
    'src',
    'ui',
    'ApplicationDocument.html'
);

const fingerprintInputs = [
    'script.js',
    'style.css',
    'src',
    'styles',
    'fonts',
    'vendor/opentype.min.js',
    'vendor/jspdf.umd.min.js',
    'vendor/svg2pdf.umd.min.js',
    'tools/vite.config.js',
    'tools/package-lock.json'
];

async function listFiles(targetPath) {
    const entries = await readdir(targetPath, { withFileTypes: true }).catch(() => null);
    if (!entries) return [targetPath];
    const files = await Promise.all(entries.map(entry => {
        const entryPath = path.join(targetPath, entry.name);
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }));
    return files.flat();
}

export async function getPublicSourceFiles() {
    const files = await Promise.all(fingerprintInputs.map(input => (
        listFiles(path.join(projectDirectory, input))
    )));
    return files.flat().sort();
}

export async function getPublicSourceFingerprint() {
    const hash = createHash('sha256');
    for (const filePath of await getPublicSourceFiles()) {
        hash.update(path.relative(projectDirectory, filePath));
        hash.update('\0');
        hash.update(await readFile(filePath));
        hash.update('\0');
    }
    return hash.digest('hex');
}

export async function readBuildEntry() {
    const manifestPath = path.join(buildDirectory, '.vite', 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const entry = Object.values(manifest).find(candidate => candidate.isEntry);
    if (!entry?.file || entry.css?.length !== 1) {
        throw new Error('Production manifest must expose one JavaScript entry and one stylesheet');
    }
    return { script: entry.file, style: entry.css[0] };
}

export async function renderApplicationDocument({ scriptHref, styleHref }) {
    const template = await readFile(documentTemplatePath, 'utf8');
    return template
        .replace(
            /href="\.\.\/\.\.\/framework-base\.css(\?[^"]*)?"/u,
            'href="./framework-base.css$1"'
        )
        .replace('../../style.css', styleHref)
        .replace('../../script.js', scriptHref);
}
