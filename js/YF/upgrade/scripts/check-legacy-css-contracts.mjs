import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const count = (source, pattern) => source.match(pattern)?.length || 0;
const countClass = (source, className) => [...source.matchAll(/\bclass=["']([^"']*)["']/gu)]
    .filter(match => match[1].split(/\s+/u).includes(className))
    .length;

async function readJavaScriptTree(relativeDirectory) {
    const directory = new URL(relativeDirectory, root);
    const entries = await readdir(directory, { withFileTypes: true });
    const sources = [];
    for (const entry of entries) {
        if (['node_modules', 'runtime', 'vendor'].includes(entry.name)) continue;
        const relativePath = `${relativeDirectory}${entry.name}`;
        if (entry.isDirectory()) {
            sources.push(await readJavaScriptTree(`${relativePath}/`));
        } else if (/\.(?:js|mjs)$/u.test(entry.name)) {
            sources.push(await read(relativePath));
        }
    }
    return sources.join('\n');
}

const universalResetPaths = [];
const universalResetSources = await Promise.all(universalResetPaths.map(read));
for (const [index, source] of universalResetSources.entries()) {
    assert.match(source, /^\s*\*\s*\{/mu,
        `${universalResetPaths[index]} lost its frozen universal-reset marker`);
}

const promotionBridgeCounts = {};
const promotionBridgeSources = Object.fromEntries(await Promise.all(
    Object.entries(promotionBridgeCounts).map(async ([path, expected]) => {
        const source = await read(path);
        assert.equal(count(source, /all:\s*revert-layer/gu), expected,
            `${path} promotion bridge inventory changed`);
        return [path, source];
    })
));
const promotionBridgeTotal = Object.values(promotionBridgeCounts)
    .reduce((total, value) => total + value, 0);
assert.equal(promotionBridgeTotal, 0);

const pizzaBridge = await read('grid_generator/framework-base.css');
assert.doesNotMatch(pizzaBridge, /all:\s*revert-layer/u,
    'Pizza reset promotions returned');

const stickyBridge = await read('label_generator/framework-base.css');
assert.doesNotMatch(stickyBridge, /all:\s*revert-layer/u,
    'Sticky reset promotions returned');
assert.match(stickyBridge, /\.controls-panel\s*\{\s*max-height:\s*none;/u,
    'Sticky edit-panel parity bridge changed');
const ditherBridge = await read('dither/framework-base.css');
assert.doesNotMatch(ditherBridge, /all:\s*revert-layer/u,
    'Dither reset promotions returned');
assert.doesNotMatch(ditherBridge, /\.bottom-buttons\s*\{/u,
    'Dither private left action anchor returned');
assert.match(ditherBridge,
    /\.dither-action-dock\s*\{\s*z-index:\s*1000;\s*\}/u,
    'Dither modal/action stacking extension changed');
const pulsarBridge = await read('pulsar_coder/pulsar-styles.css');
assert.doesNotMatch(pulsarBridge, /all:\s*revert-layer/u,
    'Pulsar reset promotions returned');

const [
    sharedCss,
    pizzaDocument,
    pizzaLoader,
    pizzaSourceJs,
    pizzaBaseCss,
    pizzaModalCss,
    pizzaResponsiveCss,
    stickyHtml,
    stickyController,
    stickyCss,
    pulsarHtml,
    pulsarCss,
    wanderHtml,
    wanderJs,
    wanderCss,
    ditherHtml
] = await Promise.all([
    read('framework/css/othersite-styles.css'),
    read('grid_generator/src/ui/ApplicationDocument.html'),
    read('grid_generator/src/ui/ApplicationShellLoader.js'),
    readJavaScriptTree('grid_generator/src/'),
    read('grid_generator/styles/base.css'),
    read('grid_generator/styles/actions-modal.css'),
    read('grid_generator/styles/canvas-responsive.css'),
    read('label_generator/index.html'),
    read('label_generator/src/core/GridGenerator.js'),
    read('label_generator/style.css'),
    read('pulsar_coder/index.html'),
    read('pulsar_coder/css/yf-styles.css'),
    read('wander_bender/index.html'),
    read('wander_bender/js/wander-bender.js'),
    read('wander_bender/css/yf-styles.css'),
    read('dither/index.html')
]);

assert.match(sharedCss, /\.modal-overlay\s*>\s*\.modal-content\s*\{/u,
    'shared overlay content shell must remain scoped');
assert.match(sharedCss, /\.modal\s*>\s*\.modal-content\s*\{/u,
    'shared native-dialog content shell must remain scoped');

assert.doesNotMatch(pizzaDocument, /data-ui-fragment=["']help["']/u,
    'Pizza removed help fragment slot returned');
assert.doesNotMatch(pizzaLoader, /name:\s*["']help["']/u,
    'Pizza removed help fragment loader returned');
assert.doesNotMatch(
    `${pizzaBaseCss}\n${pizzaModalCss}\n${pizzaResponsiveCss}`,
    /\.(?:btn-help|modal-overlay|modal-content|modal-close|modal-body)\b/u,
    'Pizza removed help/modal CSS returned'
);
assert.doesNotMatch(pizzaBaseCss, /^\s*\*\s*\{/mu,
    'Pizza local universal reset returned');
const pizzaRuntimeReferences = pizzaSourceJs
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/[^\n]*/gu, '')
    .match(/(?:modalOverlay|modalClose)/gu)?.length || 0;
assert.equal(pizzaRuntimeReferences, 0,
    'Pizza dormant overlay unexpectedly gained an active controller');

assert.equal(countClass(stickyHtml, 'modal-overlay'), 0,
    'Sticky removed overlay fragment returned');
assert.doesNotMatch(stickyHtml, /\bid=["']helpButton["']/u,
    'Sticky removed Help trigger returned');
assert.doesNotMatch(
    stickyController,
    /(?:modalOverlay|modalClose|initializeModals\(\)|showHelp\(\)|getElementById\('helpButton'\))/u,
    'Sticky removed Help controller returned'
);
assert.doesNotMatch(
    stickyCss,
    /\.(?:btn-help|modal-overlay|modal-content|modal-close|modal-body)\b/u,
    'Sticky removed Help/modal CSS returned'
);
assert.doesNotMatch(stickyCss, /^\s*\*\s*\{/mu,
    'Sticky local universal reset returned');

assert.equal(countClass(wanderHtml, 'modal-overlay'), 0,
    'Wander unexpectedly gained overlay markup');
assert.doesNotMatch(wanderJs, /(?:modalOverlay|modalClose|OverlayDialogHost)/u,
    'Wander unexpectedly gained overlay runtime code');
assert.doesNotMatch(wanderCss, /\.(?:modal-overlay|modal-close|modal-body)\b/u,
    'Wander overlay-only legacy selector family returned');
assert.doesNotMatch(wanderCss, /^\s*\.modal-content(?:\s|:|\{)/mu,
    'Wander broad local modal-content collision returned');
assert.doesNotMatch(wanderCss, /^\s*\*\s*\{/mu,
    'Wander local universal reset returned');
assert.doesNotMatch(wanderCss, /\.yf-tools-link\b/u,
    'Wander removed navigation selector returned');

assert.doesNotMatch(pulsarCss, /^\s*\.modal-content(?:\s|:|\{)/mu,
    'Pulsar broad local modal-content collision returned');
assert.doesNotMatch(pulsarCss, /^\s*\*\s*\{/mu,
    'Pulsar local universal reset returned');

const localNativeDialogCollisions = {};
for (const [name, sources] of Object.entries(localNativeDialogCollisions)) {
    assert.equal(count(sources.html, /<dialog\b/gu), 1,
        `${name} native-dialog inventory changed`);
    assert.match(sources.css, /^\.modal-content\s*\{/mu,
        `${name} broad local modal-content collision changed`);
    assert.match(sources.css, /^[\t ]+\.modal-content\s*\{/mu,
        `${name} responsive broad modal-content collision changed`);
}

assert.equal(countClass(ditherHtml, 'modal-overlay'), 1,
    'Dither active overlay must remain protected during orphan cleanup');
const ditherCss = await read('dither/style.css');
assert.doesNotMatch(ditherCss, /^\s*\*\s*\{/mu,
    'Dither local universal reset returned');
assert.equal(countClass(pulsarHtml, 'modal-overlay'), 1,
    'Pulsar active overlay must remain protected during orphan cleanup');

console.log(
    'Legacy CSS contract passed: 0 frozen universal resets; '
    + '0 revert-layer promotions; 0 dormant overlays; '
    + '0 broad local native-dialog collisions; '
    + '0 overlay-selector families without overlay markup.'
);
