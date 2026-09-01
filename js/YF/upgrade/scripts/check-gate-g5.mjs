import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const upgradeRoot = path.dirname(scriptDir);
const read = relativePath => readFile(path.join(upgradeRoot, relativePath), 'utf8');

const apps = [
    {
        name: 'Sparky',
        href: 'sparky/',
        entry: 'sparky/index.html',
        css: 'sparky/index.html',
        js: 'sparky/tool.js'
    },
    {
        name: 'Pizza Boxer',
        href: 'grid_generator/',
        entry: 'grid_generator/index.html',
        nav: 'grid_generator/src/ui/fragments/workspace.html',
        css: 'grid_generator/framework-base.css',
        js: 'grid_generator/src/framework/FrameworkAdapter.js'
    },
    {
        name: 'Sticky Fingers',
        href: 'label_generator/',
        entry: 'label_generator/index.html',
        css: 'label_generator/framework-base.css',
        js: 'label_generator/src/framework/FrameworkAdapter.js'
    },
    {
        name: 'Keyboarder',
        href: 'keyboarder/',
        entry: 'keyboarder/index.html',
        css: 'keyboarder/index.html',
        js: 'keyboarder/app/tool.js'
    },
    {
        name: 'Wordplayer',
        href: 'wordplayer/',
        entry: 'wordplayer/index.html',
        css: 'wordplayer/index.html',
        js: 'wordplayer/tool.js'
    },
    {
        name: 'Dither',
        href: 'dither/',
        entry: 'dither/index.html',
        css: 'dither/framework-base.css',
        js: 'dither/js/framework/FrameworkAdapter.js'
    },
    {
        name: 'Wander Bender',
        href: 'wander_bender/',
        entry: 'wander_bender/index.html',
        css: 'wander_bender/css/framework-base.css',
        js: 'wander_bender/js/framework/FrameworkAdapter.js'
    },
    {
        name: 'Pulsar Coder',
        href: 'pulsar_coder/',
        entry: 'pulsar_coder/index.html',
        css: 'pulsar_coder/css/framework-base.css',
        js: 'pulsar_coder/js/framework/FrameworkAdapter.js'
    }
];

const hub = await read('index.html');
const hubHrefs = [...hub.matchAll(/<a\s+href="([^"]+)"/gu)].map(match => match[1]);
assert.deepEqual(hubHrefs, apps.map(app => app.href),
    'Upgrade hub must expose exactly the eight accepted tools in priority order');

for (const app of apps) {
    const [entry, navigation, css, js] = await Promise.all([
        read(app.entry),
        read(app.nav || app.entry),
        read(app.css),
        read(app.js)
    ]);
    assert.match(navigation, /aria-label="Back to Upgrade Tools"/u,
        `${app.name} lost its isolated Upgrade navigation boundary`);
    assert.match(entry, /<html\b/u, `${app.name} entrypoint is not an HTML document`);
    assert.match(css, /framework\/css\/othersite-styles\.css/u,
        `${app.name} lost its shared CSS boundary`);
    assert.match(js, /framework\/src\/index\.js/u,
        `${app.name} lost its shared public JavaScript boundary`);
}

const resetFiles = [
    'grid_generator/styles/base.css',
    'label_generator/style.css',
    'dither/style.css',
    'pulsar_coder/css/yf-styles.css',
    'wander_bender/css/yf-styles.css'
];
for (const relativePath of resetFiles) {
    assert.doesNotMatch(await read(relativePath), /^\s*\*\s*\{/mu,
        `${relativePath} restored a local universal reset`);
}

const deltaFiles = [
    'grid_generator/framework-base.css',
    'label_generator/framework-base.css',
    'dither/framework-base.css',
    'pulsar_coder/pulsar-styles.css',
    'wander_bender/css/wander-bender.css'
];
for (const relativePath of deltaFiles) {
    assert.doesNotMatch(await read(relativePath), /all:\s*revert-layer/u,
        `${relativePath} restored a reset-promotion block`);
}

const cleanupMatrix = await read('LEGACY_CSS_CLEANUP_MATRIX.md');
for (const owner of ['Dither', 'Sticky Fingers', 'Pizza Boxer', 'Wander Bender', 'Pulsar Coder']) {
    assert.match(cleanupMatrix, new RegExp(`\\| ${owner.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')} \\|`, 'u'),
        `${owner} app deltas lack an ownership record`);
}
assert.match(cleanupMatrix, /Условие удаления/u,
    'Compatibility matrix must state removal conditions');

const browserCapture = JSON.parse(await read('baselines/BROWSER_CAPTURE.json'));
const captureByName = new Map(browserCapture.captures.map(capture => [capture.name, capture]));
for (const [name, width, height] of [
    ['sparky-desktop-1440x900', 1280, 720],
    ['sparky-mobile-390x844', 390, 844],
    ['sparky-mobile-430x932', 430, 932]
]) {
    const capture = captureByName.get(name);
    assert.ok(capture, `Missing accepted Sparky capture: ${name}`);
    assert.deepEqual(capture.metrics?.viewport, { width, height },
        `${name} viewport contract changed`);
    assert.equal(capture.metrics?.readyState, 'complete', `${name} did not reach complete`);
    assert.equal(capture.metrics?.surface?.width, width, `${name} surface width changed`);
    assert.equal(capture.metrics?.surface?.height, height, `${name} surface height changed`);
    assert.equal(capture.metrics?.document?.overflowX, false, `${name} gained horizontal overflow`);
    assert.equal((capture.logs || []).some(log => log.level === 'error'), false,
        `${name} contains a browser error`);
}

console.log(
    'Gate G5 contract passed: 8 hub links; 8 shared CSS + 8 shared JS boundaries; '
    + '0 local universal resets; 0 reset promotions; owned app deltas; '
    + 'Sparky desktop + 390×844 + 430×932 accepted.'
);
