import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const stripComments = source => source.replace(/\/\*[\s\S]*?\*\//gu, '');
const count = (source, pattern) => source.match(pattern)?.length || 0;
const countClass = (source, className) => [...source.matchAll(/\bclass=["']([^"']*)["']/gu)]
    .filter(match => match[1].split(/\s+/u).includes(className))
    .length;
const bottomBar = (source, name) => {
    const match = source.match(
        /<nav\b[^>]*\bclass=["'][^"']*\bbottom-buttons\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/u
    );
    assert.ok(match, `${name} bottom action bar missing`);
    return match[0];
};

const appHtmlPaths = {
    Sparky: 'sparky/index.html',
    'Pizza Boxer': 'grid_generator/src/ui/fragments/actions.html',
    'Sticky Fingers': 'label_generator/index.html',
    Keyboarder: 'keyboarder/index.html',
    Wordplayer: 'wordplayer/index.html',
    'Pulsar Coder': 'pulsar_coder/index.html',
    Dither: 'dither/index.html',
    'Wander Bender': 'wander_bender/index.html'
};

const appHtml = Object.fromEntries(await Promise.all(
    Object.entries(appHtmlPaths).map(async ([name, path]) => [name, await read(path)])
));
const bars = Object.fromEntries(
    Object.entries(appHtml).map(([name, html]) => [name, bottomBar(html, name)])
);

assert.match(
    bars['Wander Bender'],
    /<nav\b[^>]*\bclass=["'][^"']*\baction-dock\b[^"']*["'][^>]*>[\s\S]*?action-dock__slot--primary/u,
    'Wander Bender must remain the ActionDock primary-slot canary'
);
assert.match(
    bars['Pulsar Coder'],
    /<nav\b[^>]*\bclass=["'][^"']*\baction-dock\b[^"']*["'][^>]*>[\s\S]*?action-dock__slot--utility[\s\S]*?\bid=["']verifyBtn["'][\s\S]*?\bid=["']copyBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']downloadBtn["']/u,
    'Pulsar must keep Verify/Copy in utility and Download in the primary ActionDock slot'
);
assert.match(
    bars.Wordplayer,
    /action-dock__slot--utility[\s\S]*?\bid=["']introHelpBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']exportPngBtn["'][\s\S]*?\bid=["']exportSvgBtn["'][\s\S]*?action-dock__slot--options[\s\S]*?\bid=["']transparentPngCheckbox["']/u,
    'Wordplayer must keep About/exports/Transparent in utility/primary/options slots'
);
assert.match(
    bars.Keyboarder,
    /action-dock__slot--utility[\s\S]*?\bid=["']aboutBtn["'][\s\S]*?\bid=["']verifyBtn["'][\s\S]*?\bid=["']exportJsonBtn["'][\s\S]*?\bid=["']importJsonBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']exportPdfBtn["'][\s\S]*?\bid=["']exportPngBtn["'][\s\S]*?\bid=["']exportSvgBtn["'][\s\S]*?action-dock__slot--options[\s\S]*?\bid=["']convertToOutlinesCheckbox["']/u,
    'Keyboarder must keep document utilities, primary exports and Outline in their ActionDock slots'
);
assert.match(
    bars['Pizza Boxer'],
    /action-dock__slot--utility[\s\S]*?\bid=["']exportSettingsBtn["'][\s\S]*?\bid=["']importSettingsBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']exportPDFBtn["'][\s\S]*?\bid=["']exportBtn["'][\s\S]*?action-dock__slot--options[\s\S]*?\bid=["']convertToOutlinesCheckbox["']/u,
    'Pizza Boxer must keep setup utilities, primary exports and Outline in their ActionDock slots'
);
assert.match(
    bars['Sticky Fingers'],
    /action-dock__slot--utility[\s\S]*?\bid=["']exportSettingsBtn["'][\s\S]*?\bid=["']importSettingsBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']exportPdfBtn["'][\s\S]*?\bid=["']generateAllStickersBtn["'][\s\S]*?\bid=["']exportCurrentSvgBtn["'][\s\S]*?\bid=["']exportAllSvgBtn["'][\s\S]*?action-dock__slot--options[\s\S]*?\bid=["']convertToOutlinesCheckbox["'][\s\S]*?\bid=["']prepressCheckbox["']/u,
    'Sticky Fingers must keep preset utilities, PDF/SVG exports and options in their ActionDock slots'
);
assert.match(
    bars.Sparky,
    /action-dock__slot--utility[\s\S]*?\bid=["']shortcutHelpBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']animationExportActions["'][\s\S]*?\bid=["']exportPngBtn["'][\s\S]*?\bid=["']exportSvgBtn["'][\s\S]*?\bid=["']animationExportStatus["'][\s\S]*?\bid=["']animationExportCancelBtn["']/u,
    'Sparky must keep shortcut help separate from its private export/progress lifecycle'
);
assert.match(
    bars.Dither,
    /action-dock__slot--utility[\s\S]*?\bid=["']uploadBtnFixed["'][\s\S]*?\bid=["']removeImageBtn["'][\s\S]*?\bid=["']uploadSampleBtn["'][\s\S]*?\bid=["']removeSampleBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']exportBtn["'][\s\S]*?action-dock__slot--options[\s\S]*?\bid=["']exportWithAlpha["'][\s\S]*?\bid=["']export2x["'][\s\S]*?\bid=["']export4x["'][\s\S]*?\bid=["']export8x["']/u,
    'Dither must keep source actions, PNG export and raster options in their ActionDock slots'
);

const expected = {
    Sparky: {
        buttons: 4,
        fixed: 2,
        labels: 0,
        ids: ['shortcutHelpBtn', 'exportPngBtn', 'exportSvgBtn', 'animationExportCancelBtn']
    },
    'Pizza Boxer': {
        buttons: 4,
        fixed: 4,
        labels: 1,
        ids: ['exportSettingsBtn', 'importSettingsBtn', 'exportPDFBtn', 'exportBtn',
            'convertToOutlinesCheckbox']
    },
    'Sticky Fingers': {
        buttons: 6,
        fixed: 6,
        labels: 2,
        ids: ['exportSettingsBtn', 'importSettingsBtn', 'exportPdfBtn',
            'generateAllStickersBtn', 'exportCurrentSvgBtn', 'exportAllSvgBtn',
            'convertToOutlinesCheckbox', 'prepressCheckbox']
    },
    Keyboarder: {
        buttons: 7,
        fixed: 7,
        labels: 1,
        ids: ['aboutBtn', 'verifyBtn', 'exportJsonBtn', 'importJsonBtn', 'exportPdfBtn',
            'exportPngBtn', 'exportSvgBtn', 'convertToOutlinesCheckbox']
    },
    Wordplayer: {
        buttons: 3,
        fixed: 3,
        labels: 1,
        ids: ['introHelpBtn', 'exportPngBtn', 'exportSvgBtn', 'transparentPngCheckbox']
    },
    'Pulsar Coder': {
        buttons: 3,
        fixed: 3,
        labels: 0,
        ids: ['verifyBtn', 'copyBtn', 'downloadBtn']
    },
    Dither: {
        buttons: 5,
        fixed: 5,
        labels: 4,
        ids: ['uploadBtnFixed', 'removeImageBtn', 'uploadSampleBtn', 'removeSampleBtn',
            'exportBtn', 'exportWithAlpha', 'export2x', 'export4x', 'export8x']
    },
    'Wander Bender': {
        buttons: 1,
        fixed: 1,
        labels: 0,
        ids: ['exportBtn']
    }
};

for (const [name, contract] of Object.entries(expected)) {
    const bar = bars[name];
    assert.equal(count(bar, /<button\b/gu), contract.buttons, `${name} button count changed`);
    assert.equal(countClass(bar, 'btn-fixed'), contract.fixed, `${name} btn-fixed count changed`);
    assert.equal(count(bar, /<label\b/gu), contract.labels, `${name} action-label count changed`);
    assert.match(
        bar,
        /<nav\b[^>]*\brole=["']toolbar["'][^>]*\baria-label=["'][^"']+["']/u,
        `${name} action bar must have an explicit toolbar name`
    );
    for (const id of contract.ids) {
        assert.equal(
            count(bar, new RegExp(`\\bid=["']${id}["']`, 'gu')),
            1,
            `${name} action id ${id} changed`
        );
    }
}

const buttonCount = Object.values(bars).reduce((total, bar) => total + count(bar, /<button\b/gu), 0);
const fixedCount = Object.values(bars).reduce((total, bar) => total + countClass(bar, 'btn-fixed'), 0);
const labelCount = Object.values(bars).reduce((total, bar) => total + count(bar, /<label\b/gu), 0);
assert.equal(buttonCount, 33);
assert.equal(fixedCount, 31);
assert.equal(labelCount, 9);
assert.equal(buttonCount + labelCount, 42);

const [
    sharedCss,
    sparkyCss,
    keyboarderCss,
    wordplayerCss,
    pulsarCss,
    pulsarBridge,
    wanderCss,
    wanderBridge,
    stickyCss,
    stickyBridge,
    pizzaCss,
    pizzaEditorCss,
    pizzaResponsiveCss,
    ditherCss,
    ditherBridge,
    sparkyTool,
    keyboarderTool,
    wordplayerControls,
    pulsarScript,
    wanderScript,
    stickyScript,
    pizzaExportController,
    ditherScript
] = await Promise.all([
    read('framework/css/othersite-styles.css'),
    read('sparky/styles/sparky.css'),
    read('keyboarder/app/theme.css'),
    read('wordplayer/styles.css'),
    read('pulsar_coder/css/yf-styles.css'),
    read('pulsar_coder/pulsar-styles.css'),
    read('wander_bender/css/yf-styles.css'),
    read('wander_bender/css/wander-bender.css'),
    read('label_generator/style.css'),
    read('label_generator/framework-base.css'),
    read('grid_generator/styles/actions-modal.css'),
    read('grid_generator/styles/editors.css'),
    read('grid_generator/styles/canvas-responsive.css'),
    read('dither/style.css'),
    read('dither/framework-base.css'),
    read('sparky/tool.js'),
    read('keyboarder/app/tool.js'),
    read('wordplayer/src/ui/controls.js'),
    read('pulsar_coder/pulsar-main.js'),
    read('wander_bender/js/wander-bender.js'),
    read('label_generator/script.js'),
    read('grid_generator/src/svg/ExportController.js'),
    read('dither/dither.js')
]);

const activeSharedCss = stripComments(sharedCss);
for (const selector of ['bottom-buttons', 'btn-fixed']) {
    assert.match(
        activeSharedCss,
        new RegExp(`\\.${selector}(?:[\\s:{.#]|$)`, 'u'),
        `shared ${selector} presentation missing`
    );
}
assert.match(activeSharedCss, /\.btn-fixed:disabled\s*\{/u);
assert.match(activeSharedCss, /\.btn-fixed\.btn-intro-help\s*\{/u);
assert.match(activeSharedCss, /\.btn-fixed\.btn-fixed--muted,/u);
assert.match(activeSharedCss, /\.bottom-buttons\.action-dock\s*\{/u);
assert.match(activeSharedCss, /\.action-dock__slot--primary\s*\{/u);

const localButtonBase = css => /(?:^|\})\s*\.btn-fixed\s*\{/u.test(stripComments(css));
const localBarBase = css => /(?:^|\})\s*\.bottom-buttons\s*\{/u.test(stripComments(css));
for (const [name, css] of [
    ['Sparky', sparkyCss],
    ['Keyboarder', keyboarderCss],
    ['Wordplayer', wordplayerCss],
    ['Pulsar Coder', pulsarCss],
    ['Wander Bender', wanderCss],
    ['Pizza Boxer', pizzaCss],
    ['Sticky Fingers', stickyCss],
    ['Dither', ditherCss]
]) {
    assert.equal(localButtonBase(css), false, `${name} reintroduced a local button base`);
    assert.equal(localBarBase(css), false, `${name} reintroduced a local action-bar base`);
}
assert.doesNotMatch(
    stripComments(await read('grid_generator/framework-base.css')),
    /all:\s*revert-layer/u,
    'Pizza Boxer must consume the canonical shared action presentation without reset promotions'
);
assert.equal(localButtonBase(pizzaEditorCss), false, 'Pizza Boxer editor CSS reintroduced a local button base');
assert.equal(localBarBase(pizzaResponsiveCss), false, 'Pizza Boxer responsive CSS reintroduced a local action-bar base');
assert.equal(localButtonBase(pizzaResponsiveCss), false, 'Pizza Boxer responsive CSS reintroduced a local button base');
assert.match(stripComments(pizzaCss), /\.btn-export-pdf\s*\{/u);
assert.match(stripComments(pizzaCss), /\.btn-export-settings,\s*\.btn-import-settings\s*\{/u);
assert.doesNotMatch(
    stripComments(pizzaCss),
    /\.export-group-right\s*\{/u,
    'Pizza Boxer retired its centered-bar grouping after adopting ActionDock slots'
);
assert.doesNotMatch(stripComments(stickyBridge), /all:\s*revert-layer/u,
    'Sticky Fingers must consume the canonical shared action presentation without reset promotions');
assert.match(stripComments(stickyCss), /\.btn-export-settings,\s*\.btn-import-settings\s*\{/u);
assert.doesNotMatch(
    stripComments(stickyCss),
    /\.export-group-right\s*\{/u,
    'Sticky Fingers retired its centered-bar grouping after adopting ActionDock slots'
);
assert.match(stripComments(stickyCss), /body:not\(\.edit-mode-active\) \.edit-mode-only\s*\{/u);
assert.doesNotMatch(stripComments(ditherBridge), /all:\s*revert-layer/u,
    'Dither must consume the shared action shell without reset promotions');
assert.match(
    stripComments(ditherBridge),
    /\.dither-action-dock\s*\{\s*z-index:\s*1000;\s*\}/u,
    'Dither must retain only its private overlay-order extension'
);
assert.doesNotMatch(stripComments(ditherBridge), /\.bottom-buttons\s*\{/u,
    'Dither must not retain its private left action anchor');
assert.match(stripComments(ditherCss), /\.btn-remove\s*\{/u);
assert.match(stripComments(ditherCss), /\.export-transparency-label\s*\{/u);
assert.doesNotMatch(stripComments(pulsarBridge), /all:\s*revert-layer/u,
    'Pulsar must consume the canonical shared action presentation without reset promotions');
assert.doesNotMatch(stripComments(wanderBridge), /all:\s*revert-layer/u,
    'Wander must consume the canonical shared action presentation without reset promotions');

assert.match(sparkyCss, /\.sparky-export-status\s*\{/u);
assert.match(sparkyCss, /\.sparky-export-actions\.is-exporting > \.btn-fixed\s*\{/u);
assert.match(sparkyCss, /@media[^\{]*max-width:\s*768px[\s\S]*?\.bottom-buttons,[\s\S]*?display:\s*none\s*!important;/u);
assert.match(sparkyTool, /new AnimationExporter\s*\(/u);
assert.match(sparkyTool, /Export PNG sequence/u);
assert.match(sparkyTool, /Export MP4/u);
assert.match(sparkyTool, /animationExportCancelBtn/u);

for (const marker of ['exportSVG()', 'exportPNG()', 'exportPDF()', 'exportModelJSON']) {
    assert.ok(keyboarderTool.includes(marker), `Keyboarder lost ${marker}`);
}
assert.match(keyboarderTool, /convertToOutlinesCheckbox/u);
assert.match(wordplayerControls, /setAttribute\('aria-busy', 'true'\)/u);
assert.match(wordplayerControls, /exportPng\(this\.getScene\(\)/u);
assert.match(wordplayerControls, /exportCurvedSvg\(this\.getScene\(\)\)/u);

for (const marker of ['function downloadSvg()', 'function copySvg()', 'function verify()']) {
    assert.ok(pulsarScript.includes(marker), `Pulsar lost ${marker}`);
}
assert.match(pulsarScript, /btn\.textContent = '✓ Copied!'/u);
assert.match(wanderScript, /areaBoundary\.remove\(\)/u);
assert.match(wanderScript, /wander-bender-\$\{settings\.get\('rays'\)\}-rays\.svg/u);

for (const marker of [
    'exportPDF()',
    'exportCurrentLabelSVG()',
    'exportAllLabelsSVG()',
    'generateAllStickers()',
    'loadDataFromGoogleSheets()'
]) {
    assert.ok(stickyScript.includes(marker), `Sticky lost ${marker}`);
}
assert.match(stickyScript, /generateAllStickersBtn\.disabled = true/u);
assert.match(stickyScript, /exportAllSvgBtn\.disabled = true/u);
assert.match(stickyScript, /prepressCheckbox/u);

for (const marker of ['async exportSvg()', 'async exportPdf()', 'exportSettings()']) {
    assert.ok(pizzaExportController.includes(marker), `Pizza lost ${marker}`);
}
assert.match(pizzaExportController, /convertToOutlinesCheckbox/u);

assert.match(ditherScript, /exportBtn\.disabled = true/u);
assert.match(ditherScript, /exportBtn\.disabled = false/u);
assert.match(ditherScript, /if \(this\.settings\.export8x\)/u);
assert.match(ditherScript, /else if \(this\.settings\.export4x\)/u);
assert.match(ditherScript, /else if \(this\.settings\.export2x\)/u);
assert.match(ditherScript, /if \(this\.settings\.exportWithAlpha\)/u);
assert.match(stripComments(ditherCss), /\.help-container\s*\{[^}]*bottom:\s*calc\(var\(--spacing-3xl\) \+ var\(--button-height\) \+ var\(--spacing-lg\)\);/su);

console.log(
    `Action contract passed: 8 toolbars; ${fixedCount} btn-fixed + ${buttonCount - fixedCount} `
    + `special buttons + ${labelCount} labels = ${buttonCount + labelCount} direct controls; `
    + '8 shared shells + 1 private Dither overlay-order extension; 8 private export pipelines protected.'
);
