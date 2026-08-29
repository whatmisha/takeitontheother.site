import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const canonicalRoot = await realpath(upgradeRoot);

const appDirectories = [
    'dither',
    'grid_generator',
    'keyboarder',
    'label_generator',
    'pulsar_coder',
    'sparky',
    'wander_bender',
    'wordplayer'
];

const entrypoints = [
    'index.html',
    ...appDirectories.map(directory => `${directory}/index.html`)
];

const expectedIndexLinks = [
    'sparky/',
    'grid_generator/',
    'label_generator/',
    'keyboarder/',
    'wordplayer/',
    'dither/',
    'wander_bender/',
    'pulsar_coder/'
];

const ignoredDirectoryNames = new Set([
    '.git',
    'benchmarks',
    'docs',
    'node_modules',
    'plans',
    'test',
    'tests',
    'tools',
    'upstream-v3'
]);
const runtimeExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs']);
const errors = [];
const runtimeFiles = [];
let internalSymlinkCount = 0;

function relative(filePath) {
    return path.relative(upgradeRoot, filePath).split(path.sep).join('/');
}

function isInsideUpgrade(filePath) {
    return filePath === canonicalRoot || filePath.startsWith(`${canonicalRoot}${path.sep}`);
}

function isThirdPartyBundle(relativePath) {
    return relativePath.startsWith('framework/vendor/')
        || relativePath === 'framework/UPSTREAM_V3.json'
        || relativePath.includes('/vendor/lib/')
        || /(?:^|\/)(?:jspdf|svg2pdf)[^/]*\.js$/i.test(relativePath)
        || /\.min\.js$/i.test(relativePath);
}

async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        const relativePath = relative(absolutePath);
        const metadata = await lstat(absolutePath);
        if (metadata.isSymbolicLink()) {
            // Symlinks are audited separately, including ignored dependency trees.
            continue;
        }
        const resolved = await realpath(absolutePath);
        if (!isInsideUpgrade(resolved)) errors.push(`Path escapes upgrade: ${relativePath}`);
        if (entry.isDirectory()) {
            if (!ignoredDirectoryNames.has(entry.name)) await walk(absolutePath);
            continue;
        }
        if (!entry.isFile()) continue;
        const topLevelDirectory = relativePath.split('/')[0];
        if (
            (appDirectories.includes(topLevelDirectory) || topLevelDirectory === 'framework')
            && runtimeExtensions.has(path.extname(entry.name).toLowerCase())
            && !isThirdPartyBundle(relativePath)
        ) {
            runtimeFiles.push(absolutePath);
        }
    }
}

async function auditSymlinks(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        const metadata = await lstat(absolutePath);
        if (metadata.isSymbolicLink()) {
            try {
                const resolved = await realpath(absolutePath);
                if (!isInsideUpgrade(resolved)) errors.push(`Symlink escapes upgrade: ${relative(absolutePath)}`);
                else internalSymlinkCount += 1;
            } catch {
                errors.push(`Broken symlink: ${relative(absolutePath)}`);
            }
            continue;
        }
        if (entry.isDirectory() && entry.name !== '.git') await auditSymlinks(absolutePath);
    }
}

for (const directory of appDirectories) {
    const metadata = await lstat(path.join(upgradeRoot, directory));
    if (!metadata.isDirectory()) errors.push(`Missing app directory: ${directory}`);
}
await auditSymlinks(upgradeRoot);
await walk(upgradeRoot);

const forbiddenLiterals = [
    'https://cdnjs.cloudflare.com',
    'https://cdn.jsdelivr.net',
    'https://mishaivanov.ru/fonts',
    'https://api.github.com',
    'http://cdnjs.cloudflare.com',
    'http://cdn.jsdelivr.net',
    '/js/YF/',
    '../lunnen/',
    'othersite-ui-framework'
];

for (const filePath of runtimeFiles) {
    const relativePath = relative(filePath);
    const text = await readFile(filePath, 'utf8');
    for (const literal of forbiddenLiterals) {
        if (text.includes(literal)) errors.push(`${relativePath} contains forbidden runtime reference: ${literal}`);
    }

    const actionableRemotePatterns = [
        /<(?:script|link)\b[^>]*(?:src|href)=["']https?:\/\//gi,
        /url\(\s*["']?https?:\/\//gi,
        /(?:fetch|import)\s*\(\s*["'`]https?:\/\//gi,
        /\.src\s*=\s*["'`]https?:\/\//gi
    ];
    for (const pattern of actionableRemotePatterns) {
        if (pattern.test(text)) errors.push(`${relativePath} contains an actionable remote URL`);
    }

    if (path.extname(filePath) === '.js' || path.extname(filePath) === '.mjs') {
        const importPatterns = [
            /^\s*(?:import|export)\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/gm,
            /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
            /new\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g
        ];
        for (const pattern of importPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                if (!match[1].startsWith('.')) continue;
                await validateLocalReference(filePath, match[1], `${relativePath} import`);
            }
        }

        const dynamicAssetPattern = /\.src\s*=\s*["'`]([^"'`]+)["'`]/g;
        let dynamicMatch;
        while ((dynamicMatch = dynamicAssetPattern.exec(text)) !== null) {
            const reference = dynamicMatch[1];
            if (/^(?:data:|https?:|blob:)/i.test(reference)) continue;
            const appDirectory = appDirectories.find(directory => relativePath.startsWith(`${directory}/`));
            if (!appDirectory) continue;
            await validateLocalReference(path.join(upgradeRoot, appDirectory, 'index.html'), reference, `${relativePath} dynamic asset`);
        }
    }

    if (path.extname(filePath) === '.css') {
        const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
        let match;
        while ((match = urlPattern.exec(text)) !== null) {
            const reference = match[1].trim();
            if (/^(?:data:|https?:|blob:|#|var\()/i.test(reference)) continue;
            await validateLocalReference(filePath, reference, `${relativePath} CSS url`);
        }
    }
}

async function validateLocalReference(fromFile, rawReference, context) {
    const cleanReference = rawReference.split('#')[0].split('?')[0];
    if (!cleanReference) return;
    if (cleanReference.startsWith('/')) {
        errors.push(`${context} uses root-absolute path: ${rawReference}`);
        return;
    }
    let decodedReference = cleanReference;
    try {
        decodedReference = decodeURIComponent(cleanReference);
    } catch {
        errors.push(`${context} has invalid URL encoding: ${rawReference}`);
        return;
    }
    const candidate = path.resolve(path.dirname(fromFile), decodedReference);
    if (!candidate.startsWith(`${upgradeRoot}${path.sep}`) && candidate !== upgradeRoot) {
        errors.push(`${context} escapes upgrade: ${rawReference}`);
        return;
    }
    try {
        const resolved = await realpath(candidate);
        if (!isInsideUpgrade(resolved)) errors.push(`${context} resolves outside upgrade: ${rawReference}`);
    } catch {
        const alternatives = [`${candidate}.js`, path.join(candidate, 'index.js')];
        let found = false;
        for (const alternative of alternatives) {
            try {
                const resolved = await realpath(alternative);
                if (isInsideUpgrade(resolved)) found = true;
            } catch {
                // Try the next browser-style resolution candidate.
            }
        }
        if (!found) errors.push(`${context} is missing: ${rawReference}`);
    }
}

for (const entrypoint of entrypoints) {
    const absolutePath = path.join(upgradeRoot, entrypoint);
    const html = await readFile(absolutePath, 'utf8');
    const referencePattern = /\b(?:src|href)=["']([^"']+)["']/g;
    let match;
    while ((match = referencePattern.exec(html)) !== null) {
        const reference = match[1];
        if (/^(?:#|data:|mailto:|tel:|javascript:|https?:)/i.test(reference)) continue;
        await validateLocalReference(absolutePath, reference, `${entrypoint} HTML reference`);
    }
}

const indexHtml = await readFile(path.join(upgradeRoot, 'index.html'), 'utf8');
const actualIndexLinks = [...indexHtml.matchAll(/<a\s+href=["']([^"']+)["']/g)].map(match => match[1]);
if (JSON.stringify(actualIndexLinks) !== JSON.stringify(expectedIndexLinks)) {
    errors.push(`Upgrade index links differ from the required eight-tool order: ${actualIndexLinks.join(', ')}`);
}

if (errors.length) {
    console.error(`Boundary check failed with ${errors.length} issue(s):`);
    for (const error of [...new Set(errors)].sort()) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log(`Boundary check passed: ${runtimeFiles.length} runtime text files, ${entrypoints.length} entrypoints, ${internalSymlinkCount} internal dependency symlinks, no escaping symlinks or forbidden references.`);
}
