import { parseAst } from 'rollup/parseAst';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolsDirectory, '..');
const entryPath = path.join(projectDirectory, 'script.js');
const sharedFrameworkEntryPath = path.resolve(
    projectDirectory,
    '..',
    'infra',
    'framework',
    'src',
    'index.js'
);
const visited = new Set();
// Parse real imports, not import examples in dependency documentation comments.
function importSpecifiers(source) {
    const specifiers = [];
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)
            && typeof node.source?.value === 'string') specifiers.push(node.source.value);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        }
    }
    visit(parseAst(source));
    return specifiers;
}

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
    const specifiers = importSpecifiers(source);
    for (const specifier of specifiers) {
        assertStaticSpecifier(specifier, path.relative(projectDirectory, normalizedPath));
        if (!specifier.startsWith('.')) continue;
        const importedPath = path.resolve(path.dirname(normalizedPath), specifier.split(/[?#]/)[0]);
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
