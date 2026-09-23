import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolsDirectory, '..');
const checkOnly = process.argv.includes('--check');
const runtimeFiles = [
    ['opentype.js/dist/opentype.min.js', 'opentype.min.js'],
    ['jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js'],
    ['svg2pdf.js/dist/svg2pdf.umd.min.js', 'svg2pdf.umd.min.js']
];
const licenseFiles = [
    ['opentype.js/LICENSE', 'opentype.js.txt'],
    ['jspdf/LICENSE', 'jspdf.txt'],
    ['svg2pdf.js/LICENSE', 'svg2pdf.js.txt']
];

function stripSourceMapReference(source) {
    return source.replace(/\n?\/\/[#@] sourceMappingURL=.*?\s*$/u, '\n');
}

async function expectedFile(sourceRelativePath, { runtime = false } = {}) {
    const sourcePath = path.join(toolsDirectory, 'node_modules', sourceRelativePath);
    const source = await readFile(sourcePath, 'utf8');
    return runtime ? stripSourceMapReference(source) : source;
}

async function syncFile(sourceRelativePath, destinationRelativePath, options = {}) {
    const destinationPath = path.join(projectDirectory, 'vendor', destinationRelativePath);
    const expected = await expectedFile(sourceRelativePath, options);
    if (checkOnly) {
        const actual = await readFile(destinationPath, 'utf8').catch(() => null);
        if (actual !== expected) throw new Error(`Outdated runtime vendor file: ${destinationRelativePath}`);
        return;
    }
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, expected, 'utf8');
}

await Promise.all([
    ...runtimeFiles.map(([source, destination]) => syncFile(source, destination, { runtime: true })),
    ...licenseFiles.map(([source, destination]) => syncFile(source, path.join('licenses', destination)))
]);

console.log(checkOnly ? 'Runtime vendor files are current.' : 'Runtime vendor files updated.');
