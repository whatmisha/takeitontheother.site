import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const failures = [];

const requiredFiles = [
    'docs/PLAN.md',
    'docs/README.md',
    'docs/ARCHITECTURE.md',
    'docs/MIGRATION_STATUS.md',
    'SOURCE_MANIFEST.json',
    'baselines/TEST_BASELINES.md',
    'baselines/VISUAL_BASELINES.md',
    'baselines/RUNTIME_BASELINES.md',
    'baselines/BROWSER_CAPTURE.json',
    'baselines/donor-notes/grid-v2.md',
    'baselines/donor-notes/wander-pattern.md',
    'baselines/donor-notes/void.md'
];

const expectedProjects = [
    'dither',
    'grid_generator',
    'keyboarder',
    'label_generator',
    'pulsar_coder',
    'sparky',
    'wander_bender',
    'wordplayer',
    'framework-v3',
    'void-active'
];

const expectedScreenshots = [
    'dither-desktop-1440x900.jpg',
    'pizza-boxer-desktop-1440x900.jpg',
    'keyboarder-desktop-1440x900.jpg',
    'sticky-fingers-desktop-1440x900.jpg',
    'pulsar-coder-desktop-1440x900.jpg',
    'sparky-desktop-1440x900.jpg',
    'wander-bender-desktop-1440x900.jpg',
    'wordplayer-desktop-1440x900.jpg',
    'sparky-mobile-390x844.jpg',
    'sparky-mobile-430x932.jpg'
];

for (const relativePath of requiredFiles) {
    try {
        await access(path.join(upgradeRoot, relativePath));
    } catch {
        failures.push(`Missing required file: ${relativePath}`);
    }
}

let sourceManifest = null;
let browserCapture = null;
let testBaseline = '';

try {
    sourceManifest = JSON.parse(await readFile(path.join(upgradeRoot, 'SOURCE_MANIFEST.json'), 'utf8'));
} catch (error) {
    failures.push(`SOURCE_MANIFEST.json cannot be parsed: ${error.message}`);
}

try {
    browserCapture = JSON.parse(await readFile(path.join(upgradeRoot, 'baselines/BROWSER_CAPTURE.json'), 'utf8'));
} catch (error) {
    failures.push(`BROWSER_CAPTURE.json cannot be parsed: ${error.message}`);
}

try {
    testBaseline = await readFile(path.join(upgradeRoot, 'baselines/TEST_BASELINES.md'), 'utf8');
} catch {
    // Missing file is already reported above.
}

if (sourceManifest) {
    if (sourceManifest.schemaVersion !== 1) failures.push('Unexpected source manifest schema version.');
    if (!Array.isArray(sourceManifest.entries) || sourceManifest.entries.length === 0) failures.push('Source manifest has no entries.');

    for (const project of expectedProjects) {
        if (!sourceManifest.summary?.[project]) failures.push(`Source manifest has no summary for ${project}.`);
    }

    for (const entry of sourceManifest.entries || []) {
        if (!['copy', 'donor-only'].includes(entry.decision)) failures.push(`Unexpected manifest decision for ${entry.source}: ${entry.decision}`);
        if (!entry.sha256 || !/^[a-f0-9]{64}$/.test(entry.sha256)) failures.push(`Invalid SHA-256 for ${entry.source}.`);
        if (!/^0[0-7]{3}$/.test(entry.mode || '')) failures.push(`Invalid file mode for ${entry.source}: ${entry.mode}`);
        if (entry.decision === 'copy') {
            const normalizedTarget = path.posix.normalize(entry.target || '');
            if (!entry.target || path.posix.isAbsolute(normalizedTarget) || normalizedTarget === '..' || normalizedTarget.startsWith('../')) {
                failures.push(`Copy target escapes upgrade: ${entry.source} -> ${entry.target}`);
            }
        } else if (entry.target !== null) {
            failures.push(`Donor entry has a copy target: ${entry.source}`);
        }
    }
}

if (browserCapture) {
    const captureNames = new Set((browserCapture.captures || []).map(capture => capture.name));
    for (const filename of expectedScreenshots) {
        const name = filename.replace(/\.jpg$/, '');
        if (!captureNames.has(name)) failures.push(`Browser capture metadata is missing: ${name}`);

        const screenshotPath = path.join(upgradeRoot, 'baselines', 'screenshots', filename);
        try {
            const metadata = await stat(screenshotPath);
            if (!metadata.isFile() || metadata.size < 1024) failures.push(`Screenshot is empty or invalid: ${filename}`);
            const header = await readFile(screenshotPath);
            if (header[0] !== 0xff || header[1] !== 0xd8) failures.push(`Screenshot is not JPEG: ${filename}`);
        } catch {
            failures.push(`Missing screenshot: ${filename}`);
        }
    }

    const sparkyMobile = (browserCapture.captures || []).filter(capture => capture.name.startsWith('sparky-mobile-'));
    if (sparkyMobile.length !== 2) failures.push('Exactly two Sparky mobile captures are required.');
    for (const capture of sparkyMobile) {
        if (capture.metrics?.document?.overflowX) failures.push(`Sparky mobile has horizontal overflow in ${capture.name}.`);
        if ((capture.logs || []).some(log => log.level === 'error')) failures.push(`Sparky mobile has console errors in ${capture.name}.`);
    }
}

for (const requiredText of ['165 tests, 165 pass', '222 tests: 221 pass, 1 fail', '195 tests, 195 pass', 'dither-worker.test.mjs', 'forms-worker.test.mjs']) {
    if (!testBaseline.includes(requiredText)) failures.push(`Test baseline is missing required evidence: ${requiredText}`);
}

if (failures.length) {
    console.error('Gate G0 failed:');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Gate G0 passed: ${sourceManifest.entries.length} source entries, ${expectedScreenshots.length} screenshots, architecture and test baselines present.`);
}
