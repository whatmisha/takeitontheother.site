import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const yfRoot = path.dirname(upgradeRoot);
const siteRoot = path.resolve(yfRoot, '..', '..');
const githubRoot = path.dirname(siteRoot);

const TOOL_NAMES = [
    'dither',
    'grid_generator',
    'keyboarder',
    'label_generator',
    'pulsar_coder',
    'sparky',
    'wander_bender',
    'wordplayer'
];

const roots = [
    ...TOOL_NAMES.map(name => ({
        id: name,
        absolute: path.join(yfRoot, 'lunnen', name),
        sourcePrefix: `takeitontheother.site/js/YF/lunnen/${name}`,
        targetPrefix: name,
        defaultDecision: 'copy'
    })),
    {
        id: 'framework-v3',
        absolute: path.join(siteRoot, 'js', 'othersite-ui-framework', 'v3'),
        sourcePrefix: 'takeitontheother.site/js/othersite-ui-framework/v3',
        targetPrefix: null,
        defaultDecision: 'donor-only'
    },
    {
        id: 'void-active',
        absolute: path.join(githubRoot, 'mishaivanov.ru', 'void'),
        sourcePrefix: 'mishaivanov.ru/void',
        targetPrefix: null,
        defaultDecision: 'donor-only'
    }
];

const excludedDirectoryNames = new Set([
    'node_modules',
    '_backup',
    'coverage',
    '.cache',
    '.vite',
    '.git'
]);

const excludedFileNames = new Set(['.DS_Store']);

function decisionFor(root, relativePath) {
    const segments = relativePath.split('/');
    if (root.id === 'grid_generator' && segments[0] === 'v2') return 'exclude';
    if (root.id === 'sparky' && segments[0] === 'stages') return 'exclude';
    if (root.id === 'wander_bender' && segments[0] === 'pattern') return 'donor-only';
    if (root.id === 'wander_bender' && segments[0] === 'othersite-ui-framework') return 'donor-only';
    if (root.id === 'void-active' && segments[0] === 'wip') return 'exclude';
    return root.defaultDecision;
}

function shouldPruneDirectory(root, relativePath, name) {
    if (excludedDirectoryNames.has(name)) return true;
    return decisionFor(root, relativePath) === 'exclude';
}

function categoryFor(relativePath) {
    const normalized = relativePath.toLowerCase();
    const segments = normalized.split('/');
    const filename = segments.at(-1);
    const extension = path.extname(filename);

    if (segments.includes('tests') || segments.includes('test') || /(^|[.-])test([.-]|$)/.test(filename)) return 'test';
    if (segments.includes('presets')) return 'preset';
    if (segments.includes('vendor')) return 'vendor';
    if (segments.some(segment => ['fonts', 'font', 'assets', 'images', 'img', 'reference', 'graphics'].includes(segment))) return 'asset';
    if (segments.includes('docs') || extension === '.md' || filename.startsWith('readme')) return 'documentation';
    if (['package.json', 'package-lock.json', 'vite.config.js'].includes(filename) || segments.includes('tools') || segments.includes('analysis') || segments.includes('benchmarks')) return 'tooling';
    if (['.html', '.css', '.js', '.mjs', '.json', '.svg'].includes(extension)) return 'runtime-source';
    return 'asset';
}

async function sha256(filePath) {
    const data = await readFile(filePath);
    return createHash('sha256').update(data).digest('hex');
}

async function collectRoot(root) {
    const entries = [];
    const exclusions = [];

    async function walk(absoluteDirectory, relativeDirectory = '') {
        const children = await readdir(absoluteDirectory, { withFileTypes: true });
        children.sort((a, b) => a.name.localeCompare(b.name, 'en'));

        for (const child of children) {
            const relativePath = relativeDirectory ? `${relativeDirectory}/${child.name}` : child.name;
            const absolutePath = path.join(absoluteDirectory, child.name);

            if (child.isDirectory()) {
                if (shouldPruneDirectory(root, relativePath, child.name)) {
                    exclusions.push({ path: `${root.sourcePrefix}/${relativePath}`, reason: 'excluded-directory' });
                    continue;
                }
                await walk(absolutePath, relativePath);
                continue;
            }

            if (!child.isFile()) {
                exclusions.push({ path: `${root.sourcePrefix}/${relativePath}`, reason: 'non-regular-file' });
                continue;
            }

            if (excludedFileNames.has(child.name)) {
                exclusions.push({ path: `${root.sourcePrefix}/${relativePath}`, reason: 'excluded-file' });
                continue;
            }

            const decision = decisionFor(root, relativePath);
            if (decision === 'exclude') {
                exclusions.push({ path: `${root.sourcePrefix}/${relativePath}`, reason: 'excluded-path' });
                continue;
            }

            const metadata = await stat(absolutePath);
            entries.push({
                project: root.id,
                source: `${root.sourcePrefix}/${relativePath}`,
                target: decision === 'copy' ? `${root.targetPrefix}/${relativePath}` : null,
                decision,
                category: categoryFor(relativePath),
                bytes: metadata.size,
                mode: `0${(metadata.mode & 0o777).toString(8)}`,
                sha256: await sha256(absolutePath)
            });
        }
    }

    await walk(root.absolute);
    return { entries, exclusions };
}

function summarize(entries) {
    const result = {};
    for (const entry of entries) {
        result[entry.project] ??= { files: 0, bytes: 0, decisions: {}, categories: {} };
        const project = result[entry.project];
        project.files += 1;
        project.bytes += entry.bytes;
        project.decisions[entry.decision] = (project.decisions[entry.decision] || 0) + 1;
        project.categories[entry.category] = (project.categories[entry.category] || 0) + 1;
    }
    return result;
}

async function buildManifest() {
    const collected = await Promise.all(roots.map(collectRoot));
    const entries = collected.flatMap(result => result.entries).sort((a, b) => a.source.localeCompare(b.source, 'en'));
    const exclusions = collected.flatMap(result => result.exclusions).sort((a, b) => a.path.localeCompare(b.path, 'en'));

    return {
        schemaVersion: 1,
        generatedBy: 'scripts/generate-source-manifest.mjs',
        contract: {
            copyRoot: 'takeitontheother.site/js/YF/upgrade',
            decisions: ['copy', 'exclude', 'donor-only'],
            excludedDirectoryNames: [...excludedDirectoryNames].sort(),
            excludedFileNames: [...excludedFileNames].sort(),
            notes: [
                'Top-level grid_generator is the current Pizza Boxer baseline.',
                'grid_generator/v2 is excluded from the runtime copy and documented as a donor.',
                'sparky/stages is the author-owned history archive and is excluded from the Upgrade runtime copy.',
                'wander_bender/pattern and its embedded framework are donor-only.',
                'Void wip snapshots are excluded; active Void files are donor-only.',
                'No manifest target may resolve outside the upgrade directory.'
            ]
        },
        summary: summarize(entries),
        exclusions,
        entries
    };
}

const outputPath = path.join(upgradeRoot, 'SOURCE_MANIFEST.json');
const expected = `${JSON.stringify(await buildManifest(), null, 2)}\n`;

if (process.argv.includes('--check')) {
    let actual = '';
    try {
        actual = await readFile(outputPath, 'utf8');
    } catch {
        console.error('SOURCE_MANIFEST.json does not exist. Run npm run manifest:generate.');
        process.exitCode = 1;
    }
    if (actual && actual !== expected) {
        console.error('SOURCE_MANIFEST.json is stale. Run npm run manifest:generate.');
        process.exitCode = 1;
    } else if (actual) {
        console.log('SOURCE_MANIFEST.json matches the selected source trees.');
    }
} else {
    await writeFile(outputPath, expected, 'utf8');
    console.log(`Wrote ${outputPath}`);
}
