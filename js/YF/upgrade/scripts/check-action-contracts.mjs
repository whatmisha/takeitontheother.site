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
    Sparky: 'tools/sparky/index.html',
    'Pizza Boxer': 'tools/grid_generator/src/ui/fragments/actions.html',
    'Sticky Fingers': 'tools/label_generator/index.html',
    Keyboarder: 'tools/keyboarder/index.html',
    Wordplayer: 'tools/wordplayer/index.html',
    'Pulsar Coder': 'tools/pulsar_coder/index.html',
    Dither: 'tools/dither/index.html',
    'Wander Bender': 'tools/wander_bender/index.html'
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
    /action-dock__slot--utility[\s\S]*?\bid=["']shortcutHelpBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']exportPngBtn["'][\s\S]*?\bid=["']exportSvgBtn["'][\s\S]*?action-dock__slot--options[\s\S]*?\bid=["']transparentPngCheckbox["']/u,
    'Wordplayer must keep shortcuts/exports/Transparent in utility/primary/options slots'
);
assert.match(
    bars.Keyboarder,
    /action-dock__slot--utility[\s\S]*?\bid=["']shortcutHelpBtn["'][\s\S]*?\bid=["']verifyBtn["'][\s\S]*?\bid=["']exportJsonBtn["'][\s\S]*?\bid=["']importJsonBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']exportPdfBtn["'][\s\S]*?\bid=["']exportPngBtn["'][\s\S]*?\bid=["']exportSvgBtn["'][\s\S]*?action-dock__slot--options[\s\S]*?\bid=["']convertToOutlinesCheckbox["']/u,
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
    /action-dock__slot--utility[\s\S]*?\bid=["']shortcutHelpBtn["'][\s\S]*?action-dock__slot--primary[\s\S]*?\bid=["']exportBtn["'][\s\S]*?action-dock__slot--options[\s\S]*?\bid=["']exportWithAlpha["'][\s\S]*?action-dock__segment[\s\S]*?\bid=["']export1x["'][\s\S]*?\bid=["']export2x["'][\s\S]*?\bid=["']export4x["'][\s\S]*?\bid=["']export8x["']/u,
    'Dither must keep help, PNG export and raster options in their ActionDock slots'
);
assert.doesNotMatch(bars.Dither, /id="(?:uploadBtnFixed|removeImageBtn|uploadSampleBtn|removeSampleBtn)"/u,
    'Dither source management belongs in the Texture panel, not the export dock');

const expected = {
    Sparky: {
        buttons: 5,
        fixed: 4,
        labels: 0,
        ids: ['shortcutHelpBtn', 'exportSettingsBtn', 'exportPngBtn', 'exportSvgBtn', 'animationExportCancelBtn']
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
        ids: ['shortcutHelpBtn', 'verifyBtn', 'exportJsonBtn', 'importJsonBtn', 'exportPdfBtn',
            'exportPngBtn', 'exportSvgBtn', 'convertToOutlinesCheckbox']
    },
    Wordplayer: {
        buttons: 3,
        fixed: 3,
        labels: 1,
        ids: ['shortcutHelpBtn', 'exportPngBtn', 'exportSvgBtn', 'transparentPngCheckbox']
    },
    'Pulsar Coder': {
        buttons: 5,
        fixed: 5,
        labels: 0,
        ids: ['decodeBtn', 'verifyBtn', 'copyBtn', 'pngBtn', 'downloadBtn']
    },
    Dither: {
        buttons: 2,
        fixed: 2,
        labels: 5,
        ids: ['shortcutHelpBtn',
            'exportBtn', 'exportWithAlpha', 'export1x', 'export2x', 'export4x', 'export8x']
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
assert.equal(fixedCount, 32);
assert.equal(labelCount, 10);
assert.equal(buttonCount + labelCount, 43);

for (const [name, bar] of Object.entries(bars)) {
    assert.match(bar, /data-action-dock-primary-export/u, `${name} canonical primary export missing`);
}
for (const name of ['Sparky', 'Pizza Boxer', 'Sticky Fingers', 'Keyboarder']) {
    assert.match(bars[name], /data-action-dock-json-export[^>]*hidden/u,
        `${name} JSON export must be hidden by default`);
}
for (const name of ['Pizza Boxer', 'Sticky Fingers', 'Keyboarder']) {
    assert.match(bars[name], /data-action-dock-json-import[^>]*hidden/u,
        `${name} JSON import must be hidden by default`);
}

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
    ditherScript,
    ditherExport,
    wanderExport,
    pulsarExport,
    pulsarPngExport
] = await Promise.all([
    read('framework/css/othersite-styles.css'),
    read('tools/sparky/styles/sparky.css'),
    read('tools/keyboarder/app/theme.css'),
    read('tools/wordplayer/styles.css'),
    read('tools/pulsar_coder/css/yf-styles.css'),
    read('tools/pulsar_coder/pulsar-styles.css'),
    read('tools/wander_bender/css/yf-styles.css'),
    read('tools/wander_bender/css/wander-bender.css'),
    read('tools/label_generator/style.css'),
    read('tools/label_generator/framework-base.css'),
    read('tools/grid_generator/styles/actions-modal.css'),
    read('tools/grid_generator/styles/editors.css'),
    read('tools/grid_generator/styles/canvas-responsive.css'),
    read('tools/dither/style.css'),
    read('tools/dither/framework-base.css'),
    read('tools/sparky/tool.js'),
    read('tools/keyboarder/app/tool.js'),
    read('tools/wordplayer/src/ui/controls.js'),
    read('tools/pulsar_coder/pulsar-main.js'),
    read('tools/wander_bender/js/wander-bender.js'),
    read('tools/label_generator/script.js'),
    read('tools/grid_generator/src/svg/ExportController.js'),
    read('tools/dither/dither.js'),
    read('tools/dither/js/export/DitherPngExport.js'),
    read('tools/wander_bender/js/export/WanderSvgExport.js'),
    read('tools/pulsar_coder/js/export/PulsarSvgExport.js'),
    read('tools/pulsar_coder/js/export/PulsarPngExport.js')
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
assert.match(activeSharedCss, /\[data-action-dock-extra\]\[hidden\]\s*\{/u);

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
    stripComments(await read('tools/grid_generator/framework-base.css')),
    /all:\s*revert-layer/u,
    'Pizza Boxer must consume the canonical shared action presentation without reset promotions'
);
assert.equal(localButtonBase(pizzaEditorCss), false, 'Pizza Boxer editor CSS reintroduced a local button base');
assert.equal(localBarBase(pizzaResponsiveCss), false, 'Pizza Boxer responsive CSS reintroduced a local action-bar base');
assert.equal(localButtonBase(pizzaResponsiveCss), false, 'Pizza Boxer responsive CSS reintroduced a local button base');
assert.match(stripComments(pizzaCss), /\.btn-export-pdf\s*\{/u);
assert.match(stripComments(pizzaCss), /\.btn-export-pdf\s*\{[^}]*border:\s*none;/su);
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
assert.doesNotMatch(stripComments(ditherCss), /\.btn-remove\s*\{/u);
assert.match(bars.Dither, /class=["']toggle-label["'][\s\S]*?id=["']exportWithAlpha["']/u);
assert.doesNotMatch(stripComments(pulsarBridge), /all:\s*revert-layer/u,
    'Pulsar must consume the canonical shared action presentation without reset promotions');
assert.doesNotMatch(stripComments(wanderBridge), /all:\s*revert-layer/u,
    'Wander must consume the canonical shared action presentation without reset promotions');

assert.match(sparkyCss, /\.sparky-export-status\s*\{/u);
assert.match(sparkyCss, /\.sparky-export-actions\.is-exporting > \.btn-fixed\s*\{/u);
assert.match(sparkyCss, /@media[^\{]*max-width:\s*768px[\s\S]*?\.bottom-buttons\.action-dock\s*\{[^}]*display:\s*flex\s*!important;/u);
assert.match(sparkyTool, /new AnimationExporter\s*\(/u);
assert.match(sparkyTool, /PNG ZIP/u);
assert.match(sparkyTool, /MP4 ⌘E/u);
assert.match(sparkyTool, /animationExportCancelBtn/u);

const keyboarderExportActions = await read('tools/keyboarder/app/export-actions.js');
assert.match(keyboarderTool, /import \{ bindKeyboarderExportActions \} from '\.\/export-actions\.js/u);
assert.match(keyboarderTool, /bindKeyboarderExportActions\(\{\s*app: readyApp, ExportFeedbackController, exportJSON: exportModelJSON/u);
for (const [buttonId, method] of [['exportSvgBtn', 'exportSVG'], ['exportPngBtn', 'exportPNG'], ['exportPdfBtn', 'exportPDF']]) {
    assert.ok(keyboarderExportActions.includes(`'${buttonId}'`) && keyboarderExportActions.includes(`app.${method}()`), `Keyboarder lost ${buttonId} → ${method}`);
}
assert.match(keyboarderExportActions, /'exportJsonBtn', 'JSON', \(\) => exportJSON\(app\)/u);
assert.match(keyboarderTool, /convertToOutlinesCheckbox/u);
assert.match(wordplayerControls, /new this\.ExportFeedbackController\(/u);
assert.match(wordplayerControls, /feedback\.run\(async \(\) =>/u);
assert.match(wordplayerControls, /exportPng\(scene,/u);
assert.match(wordplayerControls, /exportCurvedSvg\(scene\)/u);
assert.match(wordplayerControls, /const scene = this\.getScene\(\);[\s\S]*?await operation\(scene\)/u);

for (const marker of ['function downloadSvg()', 'async function downloadPng()', 'function copySvg()', 'function verify()']) {
    assert.ok(pulsarScript.includes(marker), `Pulsar lost ${marker}`);
}
assert.match(pulsarScript, /await navigator\.clipboard\.writeText\(currentSvg\)/u);
assert.match(pulsarScript, /button\.textContent = '✓ Copied!'/u);
assert.match(wanderScript, /areaBoundary\.remove\(\)/u);
assert.match(wanderScript, /downloadWanderSvg\(svgElement, \{ rays: settings\.get\('rays'\) \}\)/u);
assert.match(wanderExport, /filename: `wander-bender-\$\{rays\}-rays\.svg`/u);
assert.match(pulsarScript, /downloadPulsarSvg\(currentSvg\)/u);
assert.match(pulsarScript, /downloadPulsarPng\(currentSvg\)/u);
assert.match(pulsarExport, /filename: `pulsar-code-\$\{timestamp\}\.svg`/u);
assert.match(pulsarPngExport, /filename: `pulsar-code-\$\{timestamp\}\.png`/u);

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
assert.match(ditherScript, /DitherPngExport\.resolveScale\(this\.settings\)/u);
assert.match(ditherExport, /if \(settings\.export8x\) return 8;/u);
assert.match(ditherExport, /if \(settings\.export4x\) return 4;/u);
assert.match(ditherExport, /if \(settings\.export2x\) return 2;/u);
assert.match(ditherScript, /if \(this\.settings\.exportWithAlpha\)/u);
assert.match(ditherScript, /DitherPngExport\.downloadCanvas\(exportCanvas\)/u);
assert.match(ditherExport, /canvas\.toBlob\(blob =>/u);
assert.match(ditherExport, /const FILENAME = 'dithered-image\.png';/u);
assert.match(bars.Dither, /\bid=["']shortcutHelpBtn["'][^>]*>\?<\/button>/u);
assert.doesNotMatch(stripComments(ditherCss), /\.(?:help-container|btn-help)\b/u);

console.log(
    `Action contract passed: 8 toolbars; ${fixedCount} btn-fixed + ${buttonCount - fixedCount} `
    + `special buttons + ${labelCount} labels = ${buttonCount + labelCount} direct controls; `
    + '8 shared shells + 1 private Dither overlay-order extension; 8 private export pipelines protected.'
);
