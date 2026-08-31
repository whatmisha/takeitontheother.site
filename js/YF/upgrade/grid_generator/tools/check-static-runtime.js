import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolsDirectory, '..');
const entryPath = path.join(projectDirectory, 'script.js');
const sharedFrameworkEntryPath = path.resolve(
    projectDirectory,
    '..',
    'framework',
    'src',
    'index.js'
);
const visited = new Set();
const importPattern = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gu;
const dynamicImportPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/gu;

function assertStaticSpecifier(specifier, importerPath) {
    if (specifier.includes('?raw')) throw new Error(`Bundler-only ?raw import in ${importerPath}`);
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
        throw new Error(`Bare module import "${specifier}" in ${importerPath}`);
    }
}

async function visit(modulePath) {
    const normalizedPath = path.normalize(modulePath);
    if (visited.has(normalizedPath)) return;
    visited.add(normalizedPath);

    const source = await readFile(normalizedPath, 'utf8');
    const specifiers = [
        ...source.matchAll(importPattern),
        ...source.matchAll(dynamicImportPattern)
    ].map(match => match[1]);
    for (const specifier of specifiers) {
        assertStaticSpecifier(specifier, path.relative(projectDirectory, normalizedPath));
        if (!specifier.startsWith('.')) continue;
        const importedPath = path.resolve(path.dirname(normalizedPath), specifier);
        if (importedPath === sharedFrameworkEntryPath) continue;
        if (!importedPath.startsWith(`${projectDirectory}${path.sep}`)) {
            throw new Error(`Import escapes the Pizza Boxer boundary: ${importedPath}`);
        }
        await visit(importedPath);
    }
}

await visit(entryPath);

const shellLoader = await readFile(path.join(projectDirectory, 'src/ui/ApplicationShellLoader.js'), 'utf8');
if (!shellLoader.includes('fetchFragment')) {
    throw new Error('Application shell must use static-server-compatible fragment loading');
}

console.log(`Static runtime graph is browser-resolvable (${visited.size} modules).`);
