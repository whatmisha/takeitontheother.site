import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');
const count = (source, pattern) => source.match(pattern)?.length || 0;
const countClass = (source, className) => [...source.matchAll(/\bclass=["']([^"']*)["']/gu)]
    .filter(match => match[1].split(/\s+/u).includes(className))
    .length;

async function readJavaScriptTree(relativeDirectory) {
    const directory = new URL(relativeDirectory, root);
    const entries = await readdir(directory, { withFileTypes: true });
    const sources = [];
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'runtime' || entry.name === 'vendor') continue;
        const relativePath = `${relativeDirectory}${entry.name}`;
        if (entry.isDirectory()) {
            sources.push(await readJavaScriptTree(`${relativePath}/`));
        } else if (/\.(?:js|mjs)$/u.test(entry.name)) {
            sources.push(await read(relativePath));
        }
    }
    return sources.join('\n');
}

const htmlPaths = {
    Sparky: 'sparky/index.html',
    Keyboarder: 'keyboarder/index.html',
    Wordplayer: 'wordplayer/index.html',
    'Pizza Boxer': 'grid_generator/src/ui/fragments/help.html',
    'Sticky Fingers': 'label_generator/index.html',
    'Pulsar Coder': 'pulsar_coder/index.html',
    Dither: 'dither/index.html',
    'Wander Bender': 'wander_bender/index.html'
};

const html = Object.fromEntries(await Promise.all(
    Object.entries(htmlPaths).map(async ([name, path]) => [name, await read(path)])
));

const nativeDialogInventory = Object.fromEntries(
    Object.entries(html).map(([name, source]) => [name, count(source, /<dialog\b/gu)])
);
assert.deepEqual(nativeDialogInventory, {
    Sparky: 1,
    Keyboarder: 1,
    Wordplayer: 1,
    'Pizza Boxer': 0,
    'Sticky Fingers': 1,
    'Pulsar Coder': 1,
    Dither: 0,
    'Wander Bender': 1
}, 'native dialog inventory changed');

for (const name of ['Sparky', 'Keyboarder', 'Wordplayer', 'Sticky Fingers', 'Wander Bender']) {
    assert.equal(countClass(html[name], 'modal'), 1, `${name} shared native modal shell changed`);
    assert.match(
        html[name],
        /<dialog\b[^>]*\bid=["']dialog["'][^>]*\baria-labelledby=["']dialogTitle["']/u,
        `${name} native dialog label changed`
    );
    for (const id of ['dialog', 'dialogTitle', 'dialogText', 'dialogInput', 'dialogButtons']) {
        assert.equal(
            count(html[name], new RegExp(`\\bid=["']${id}["']`, 'gu')),
            1,
            `${name} DialogHost element ${id} changed`
        );
    }
}
assert.match(
    html['Pulsar Coder'],
    /<dialog\b[^>]*\bid=["']feedbackDialog["'][^>]*\baria-labelledby=["']feedbackDialogTitle["']/u,
    'Pulsar feedback dialog label changed'
);
for (const id of [
    'feedbackDialog', 'feedbackDialogTitle', 'feedbackDialogText',
    'feedbackDialogInput', 'feedbackDialogButtons'
]) {
    assert.equal(
        count(html['Pulsar Coder'], new RegExp(`\\bid=["']${id}["']`, 'gu')),
        1,
        `Pulsar feedback DialogHost element ${id} changed`
    );
}

const overlayInventory = Object.fromEntries(
    Object.entries(html).map(([name, source]) => [name, countClass(source, 'modal-overlay')])
);
assert.deepEqual(overlayInventory, {
    Sparky: 0,
    Keyboarder: 0,
    Wordplayer: 0,
    'Pizza Boxer': 1,
    'Sticky Fingers': 1,
    'Pulsar Coder': 1,
    Dither: 1,
    'Wander Bender': 0
}, 'legacy overlay inventory changed');

for (const name of ['Pizza Boxer', 'Sticky Fingers', 'Pulsar Coder', 'Dither']) {
    assert.equal(
        countClass(html[name], 'modal-content'),
        ['Sticky Fingers', 'Pulsar Coder'].includes(name) ? 2 : 1,
        `${name} dialog/overlay content shell changed`
    );
    assert.equal(countClass(html[name], 'modal-close'), 1, `${name} overlay close action changed`);
}
for (const name of ['Pizza Boxer', 'Sticky Fingers', 'Pulsar Coder', 'Dither']) {
    assert.match(html[name], /\brole=["']dialog["']/u, `${name} overlay dialog role changed`);
    assert.match(html[name], /\baria-modal=["']true["']/u, `${name} overlay modal semantics changed`);
    assert.match(html[name], /\baria-hidden=["']true["']/u, `${name} closed overlay state changed`);
}

assert.equal(countClass(html.Sparky, 'sparky-shortcut-help-popup'), 1,
    'Sparky shortcut popup inventory changed');
assert.match(
    html.Sparky,
    /id=["']shortcutHelpBtn["'][^>]*aria-haspopup=["']dialog["'][^>]*aria-expanded=["']false["'][^>]*aria-controls=["']shortcutHelpPopup["']/u,
    'Sparky shortcut trigger semantics changed'
);
assert.match(
    html.Sparky,
    /id=["']shortcutHelpPopup["'][^>]*role=["']dialog["'][^>]*hidden/u,
    'Sparky shortcut popup semantics changed'
);

const tooltipInventory = Object.fromEntries(
    Object.entries(html).map(([name, source]) => [name, count(source, /\bdata-tooltip(?:-disabled)?=/gu)])
);
assert.deepEqual(tooltipInventory, {
    Sparky: 4,
    Keyboarder: 21,
    Wordplayer: 22,
    'Pizza Boxer': 0,
    'Sticky Fingers': 0,
    'Pulsar Coder': 0,
    Dither: 0,
    'Wander Bender': 0
}, 'static tooltip host inventory changed');
const tooltipTotal = Object.values(tooltipInventory).reduce((sum, value) => sum + value, 0);
assert.equal(tooltipTotal, 47);

const [
    dialogHost,
    overlayDialogHost,
    tooltipService,
    applicationShell,
    sharedCss,
    sparkyTool,
    keyboarderTool,
    wordplayerControls,
    pizzaErrorPresenter,
    pizzaDraftRecovery,
    pizzaSourceJs,
    stickyScript,
    stickyNavigator,
    stickyController,
    stickyCss,
    pulsarScript,
    ditherScript,
    wanderScript,
    wanderCss
] = await Promise.all([
    read('framework/src/ui/DialogHost.js'),
    read('framework/src/ui/OverlayDialogHost.js'),
    read('framework/src/ui/TooltipService.js'),
    read('framework/src/core/ApplicationShell.js'),
    read('framework/css/othersite-styles.css'),
    read('sparky/tool.js'),
    read('keyboarder/app/tool.js'),
    read('wordplayer/src/ui/controls.js'),
    read('grid_generator/src/ui/ErrorPresenter.js'),
    read('grid_generator/src/persistence/DraftRecoveryController.js'),
    readJavaScriptTree('grid_generator/src/'),
    read('label_generator/script.js'),
    read('label_generator/src/elements/ElementsNavigator.js'),
    read('label_generator/src/core/GridGenerator.js'),
    read('label_generator/style.css'),
    read('pulsar_coder/pulsar-main.js'),
    read('dither/dither.js'),
    read('wander_bender/js/wander-bender.js'),
    read('wander_bender/css/yf-styles.css')
]);

for (const marker of ['show(options = {})', 'async confirm(', 'async prompt(', 'async alert(']) {
    assert.ok(dialogHost.includes(marker), `DialogHost lost ${marker}`);
}
assert.match(dialogHost, /this\.modal\.showModal\(\)/u);
assert.match(dialogHost, /if \(e\.target === this\.modal\) this\.close\('cancel'\)/u);
assert.match(dialogHost, /if \(e\.key === 'Escape'\)/u);
assert.match(dialogHost, /if \(html\) this\.textEl\.innerHTML = text/u,
    'DialogHost rich HTML must remain explicitly opt-in');

for (const marker of [
    'class OverlayDialogHost',
    "if (event.key === 'Escape')",
    "if (event.key === 'Tab') this._containFocus(event)",
    "if (event.target === this.overlay) this.close()",
    "this.document.body.style.overflow = 'hidden'",
    'destroy()'
]) {
    assert.ok(overlayDialogHost.includes(marker), `OverlayDialogHost lost ${marker}`);
}
assert.match(overlayDialogHost, /this\.previousBodyOverflow = this\.document\.body\.style\.overflow/u);
assert.match(overlayDialogHost, /this\.document\.body\.style\.overflow = this\.previousBodyOverflow/u);

for (const marker of [
    "const TOOLTIP_HOST_SELECTOR = '[data-tooltip], [data-tooltip-disabled]'",
    "this._addListener('mousemove'",
    "this._addListener('mouseover'",
    "this._addListener('focusin'",
    "this._addListener('focusout'",
    "this._addListener('keydown'",
    'destroy()'
]) {
    assert.ok(tooltipService.includes(marker), `TooltipService lost ${marker}`);
}
assert.match(tooltipService, /target\.classList\.contains\('inactive'\)/u);
assert.match(tooltipService, /target\.hasAttribute\('data-tooltip-disabled'\)/u);
assert.match(tooltipService, /tooltip\.setAttribute\('role', 'tooltip'\)/u);
assert.match(tooltipService, /tooltip\.setAttribute\('aria-hidden', 'true'\)/u);
assert.match(tooltipService, /element\.setAttribute\('aria-describedby', tokens\.join\(' '\)\)/u);
assert.match(tooltipService, /element\.removeAttribute\('aria-describedby'\)/u);
assert.match(tooltipService, /ownerDocument\?\.defaultView \|\| globalThis\.window/u);
assert.match(sharedCss, /\.cursor-tooltip\s*\{/u);
assert.match(sharedCss, /\.cursor-tooltip\.visible\s*\{/u);

assert.match(applicationShell, /_showToast\(message\)/u);
assert.match(applicationShell, /el\.setAttribute\('role', 'status'\)/u);
assert.match(applicationShell, /\}, 2200\)/u);
assert.match(sharedCss, /\.void-share-toast\s*\{/u);
assert.equal(count(keyboarderTool, /_showToast\?\.\(/gu), 8,
    'Keyboarder shared toast call inventory changed');

assert.match(pizzaErrorPresenter, /class ErrorPresenter/u);
assert.match(pizzaErrorPresenter, /setAttribute\('role', 'alert'\)/u);
assert.match(pizzaErrorPresenter, /setAttribute\('aria-live', 'assertive'\)/u);
assert.match(pizzaErrorPresenter, /setTimeout\(\(\) => this\.clear\(\), timeoutMs\)/u);
assert.match(pizzaErrorPresenter, /dispose\(\)/u);
assert.match(pizzaDraftRecovery, /class DraftRecoveryController/u);
assert.match(pizzaDraftRecovery, /setAttribute\('role', 'dialog'\)/u);
for (const action of ['Restore', 'Discard']) {
    assert.ok(pizzaDraftRecovery.includes(action), `Pizza draft action ${action} changed`);
}
const pizzaReferencesOutsideFragment = stripComments(pizzaSourceJs)
    .match(/(?:modalOverlay|modalClose)/gu)?.length || 0;
assert.equal(pizzaReferencesOutsideFragment, 0,
    'Pizza orphan help overlay gained a controller outside a dedicated rollout');
assert.doesNotMatch(pizzaSourceJs, /OverlayDialogHost/u,
    'Pizza orphan help overlay unexpectedly gained a shared host');

assert.match(
    html['Sticky Fingers'],
    /id=["']dataStatus["'][^>]*class=["']data-status["'][^>]*role=["']status["'][^>]*aria-live=["']polite["'][^>]*aria-atomic=["']true["']/u
);
for (const state of ['loading', 'error', 'success']) {
    assert.match(stickyCss, new RegExp(`\\.data-status\\.${state}\\s*\\{`, 'u'),
        `Sticky data status ${state} presentation changed`);
}
assert.match(stickyScript, /this\.dom\.dataStatus\.className = `data-status \$\{type\}`/u);
assert.match(stickyScript, /setAttribute\('role', isError \? 'alert' : 'status'\)/u);
assert.match(stickyScript, /setAttribute\('aria-live', isError \? 'assertive' : 'polite'\)/u);
assert.equal(count(stripComments(stickyScript), /(?:^|[^\w$.])alert\s*\(/gu), 0,
    'Sticky blocking alerts returned');
assert.equal(count(stripComments(stickyNavigator), /(?:^|[^\w$.])confirm\s*\(/gu), 0,
    'Sticky blocking confirm returned');
assert.equal(count(stickyScript, /await this\.feedbackDialogHost\.alert\(\{/gu), 5,
    'Sticky shared error-dialog paths changed');
assert.match(stickyNavigator, /await this\.dialogHost\.confirm\(\{/u,
    'Sticky delete confirmation must use DialogHost');
assert.match(stickyController, /initializeModals\(\)/u);
assert.match(stickyController, /showHelp\(\)/u);
assert.doesNotMatch(`${stickyScript}\n${stickyNavigator}\n${stickyController}`, /OverlayDialogHost/u,
    'Sticky dormant help overlay unexpectedly gained a shared host');
assert.doesNotMatch(html['Sticky Fingers'], /\bid=["']helpButton["']/u,
    'Sticky dormant help overlay unexpectedly gained a UI trigger');

assert.equal(count(stripComments(pulsarScript), /(?:^|[^\w$.])alert\s*\(/gu), 0,
    'Pulsar blocking alerts returned');
assert.match(pulsarScript, /return feedbackDialogHost\.alert\(\{/u,
    'Pulsar empty-map guards must use DialogHost');
assert.match(pulsarScript, /new OverlayDialogHost\(\{/u,
    'Pulsar must consume the shared overlay lifecycle');
assert.match(pulsarScript, /verifyModalHost\.open\(\);/u);
assert.doesNotMatch(pulsarScript, /verifyModal[^\n]*classList\.(?:add|remove)\('active'\)/u,
    'Pulsar duplicated shared overlay class lifecycle');
assert.match(pulsarScript, /btn\.textContent = '✓ Copied!'/u);

assert.match(ditherScript, /new OverlayDialogHost\(\{/u,
    'Dither must consume the shared overlay lifecycle');
assert.doesNotMatch(ditherScript, /modalOverlay\.classList\.(?:add|remove)\('active'\)/u,
    'Dither duplicated shared overlay class lifecycle');
assert.doesNotMatch(ditherScript, /document\.body\.style\.overflow\s*=/u,
    'Dither duplicated shared scroll locking');

assert.equal(count(stripComments(wanderScript), /(?:^|[^\w$.])alert\s*\(/gu), 0,
    'Wander blocking alert returned');
assert.match(wanderScript, /await feedbackDialogHost\.alert\(\{/u,
    'Wander clipboard fallback must use the shared DialogHost');
assert.doesNotMatch(wanderCss, /\.(?:modal-overlay|modal-close|modal-body)\b/u,
    'Wander removed overlay-only CSS returned after UPG-058b');

assert.match(html.Sparky, /id=["']animationExportStatus["'][^>]*aria-live=["']polite["']/u);
assert.match(sparkyTool, /function bindShortcutHelp\(\)/u);
assert.match(sparkyTool, /if \(event\.key === 'Escape'/u);
assert.match(keyboarderTool, /svg-import-review-live["'] aria-live=["']polite/u);
assert.match(wordplayerControls, /app\.dialog\?\.alert/u);

const activeSharedCss = stripComments(sharedCss);
assert.match(activeSharedCss, /\.modal-overlay\s*\{/u);
assert.match(activeSharedCss, /\.modal\s*\{/u);
assert.equal(count(activeSharedCss, /^\.modal-content\s*\{/gmu), 0,
    'unscoped overlay/native .modal-content collision returned');
assert.match(activeSharedCss, /^\.modal-overlay > \.modal-content\s*\{/mu,
    'scoped overlay content shell changed');
assert.match(activeSharedCss, /^\.modal > \.modal-content\s*\{/mu,
    'scoped native dialog content shell changed');

const activeOverlays = overlayInventory['Pulsar Coder']
    + overlayInventory.Dither;
const dormantOverlays = overlayInventory['Pizza Boxer'] + overlayInventory['Sticky Fingers'];
const primaryBlockingCalls = 0;
console.log(
    `Feedback contract passed: 6 native dialogs; ${activeOverlays} active overlays + ${dormantOverlays} dormant fragments; `
    + `1 private popup; ${tooltipTotal} tooltip hosts; ${primaryBlockingCalls} primary blocking calls; `
    + 'shared shells and private feedback/recovery ownership protected.'
);
