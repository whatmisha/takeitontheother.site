import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import { ColorUtils, DialogHost, FileIntakeController } from '../../framework/src/index.js';

const appRoot = new URL('../', import.meta.url);

test('Sticky Fingers exposes shared behavior through one public-barrel facade', async () => {
    const [adapter, html, bridge, sharedStyles, style] = await Promise.all([
        readFile(new URL('src/framework/FrameworkAdapter.js', appRoot), 'utf8'),
        readFile(new URL('index.html', appRoot), 'utf8'),
        readFile(new URL('framework-base.css', appRoot), 'utf8'),
        readFile(new URL('../framework/css/othersite-styles.css', appRoot), 'utf8'),
        readFile(new URL('style.css', appRoot), 'utf8')
    ]);
    assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/framework\/src\/index\.js\?v=g6-file-intake-1';/u);
    assert.match(adapter, /sharedCapabilities: Object\.freeze\(\['ColorUtils', 'DialogHost', 'FileIntakeController'\]\)/u);
    assert.match(
        bridge,
        /@import url\('\.\.\/framework\/css\/othersite-styles\.css\?v=g6-choice-1'\) layer\(framework\);/u
    );
    assert.doesNotMatch(bridge, /all:\s*revert-layer/u);
    assert.match(bridge, /\.controls-panel\s*\{\s*max-height: none;/u);
    assert.doesNotMatch(style, /^\s*\*\s*\{/mu, 'Sticky must consume the shared universal reset');
    assert.match(sharedStyles, /\.top-link\s*\{\s*padding: var\(--spacing-md\) var\(--spacing-3xl\);/u);
    assert.match(
        html,
        /<a href="\.\.\/" class="top-link" aria-label="Back to Upgrade Tools">\s*← Upgrade Tools\s*<\/a>/u
    );
    assert.doesNotMatch(html, /class="yf-tools-link"/u);
    assert.ok(
        html.indexOf('framework-base.css') < html.indexOf('style.css'),
        'shared CSS must load below the frozen Sticky Fingers skin'
    );
    assert.match(html, /href="framework-base\.css\?v=g6-choice-1"/u);
    assert.match(html, /href="style\.css\?v=g6-file-intake-1"/u);
    assert.doesNotMatch(html, /(?:modal-overlay|\bid="helpButton")/u);

    assert.equal(html.match(/class="toggle-chip"/gu)?.length || 0, 9);
    assert.equal(html.match(/class="checkbox-label"/gu)?.length || 0, 10);
    assert.equal(html.match(/class="toggle-switch"/gu)?.length || 0, 3);
    assert.equal(
        [...html.matchAll(/<div class="segmented-control(?: segmented-control-compact)?"[\s\S]*?<\/div>/gu)]
            .reduce((count, match) => count + (match[0].match(/type="radio"/gu)?.length || 0), 0),
        6
    );

    const sharedWithoutComments = sharedStyles.replace(/\/\*[\s\S]*?\*\//gu, '');
    const styleWithoutComments = style.replace(/\/\*[\s\S]*?\*\//gu, '');
    assert.doesNotMatch(
        styleWithoutComments,
        /\.(?:btn-help|modal-overlay|modal-content|modal-close|modal-body)\b/u,
        'Sticky removed Help/modal CSS must not return'
    );
    assert.doesNotMatch(
        styleWithoutComments,
        /(?:^|\})\s*\.(?:bottom-buttons|btn-fixed|btn-export)(?:\s|:|\{|,)/u,
        'Sticky Fingers must retain only semantic action variants locally'
    );
    assert.match(styleWithoutComments, /\.btn-export-settings,\s*\.btn-import-settings\s*\{/u);
    assert.doesNotMatch(
        styleWithoutComments,
        /\.export-group-right\s*\{/u,
        'Sticky retired its centered-bar grouping after adopting ActionDock slots'
    );
    assert.match(
        html,
        /action-dock__slot--utility[\s\S]*?id="exportSettingsBtn"[\s\S]*?id="importSettingsBtn"[\s\S]*?action-dock__slot--primary[\s\S]*?id="exportPdfBtn"[\s\S]*?id="generateAllStickersBtn"[\s\S]*?id="exportCurrentSvgBtn"[\s\S]*?id="exportAllSvgBtn"[\s\S]*?action-dock__slot--options[\s\S]*?id="convertToOutlinesCheckbox"[\s\S]*?id="prepressCheckbox"/u,
        'Sticky must separate preset utilities, PDF/SVG exports and export options in ActionDock'
    );
    for (const selector of [
        /(?:^|\})\s*\.toggle-chip(?:\s|:|\{)/u,
        /(?:^|\})\s*\.(?:checkbox-label|segmented-control)(?:\s|:|\{)/u,
        /(?:^|\})\s*\.toggle-switch(?:\s|:|\{)/u
    ]) {
        assert.match(sharedWithoutComments, selector);
        assert.doesNotMatch(styleWithoutComments, selector);
    }
    assert.match(
        bridge,
        /\.toggle-chip span\s*\{\s*justify-content:\s*center;\s*padding:\s*var\(--spacing-sm\) var\(--spacing-xl\);\s*font-size:\s*0\.85rem;\s*\}/u
    );
    assert.match(
        bridge,
        /\.segmented-control\s*\{\s*--segmented-control-font-size:\s*0\.85rem;\s*\}/u
    );
    assert.match(
        bridge,
        /\.control-group\.show-toggle-chip-group\s*\{\s*padding-top:\s*0;\s*margin-bottom:\s*var\(--spacing-md\);\s*\}/u
    );
    assert.match(bridge, /\.control-group:has\(\.checkbox-label\)\s*\{\s*margin-bottom:\s*var\(--spacing-xs\);/u);
    assert.match(
        bridge,
        /\.control-group \.toggle-chip input\[type="checkbox"\]\s*\{\s*width:\s*0;\s*height:\s*0;\s*\}/u
    );
    assert.match(
        bridge,
        /\.control-group \.segmented-control label\s*\{\s*margin-bottom:\s*0;\s*\}/u
    );
    assert.match(
        bridge,
        /\.control-group \.segmented-control input\[type="radio"\]:checked \+ label\s*\{\s*color:\s*var\(--color-bg\);\s*font-weight:\s*500;/u
    );
    assert.doesNotMatch(
        styleWithoutComments,
        /(?:^|\})\s*\.preset-dropdown(?:-toggle|-text|-arrow|-menu|-item)?(?:\s|:|\{)/u,
        'Sticky Fingers must not retain the preset dropdown component base'
    );
    assert.match(
        bridge,
        /\.preset-dropdown-toggle\s*\{[\s\S]*?padding:\s*var\(--spacing-md\) var\(--spacing-xl\) var\(--spacing-md\) var\(--spacing-3xl\);[\s\S]*?font-size:\s*0\.9rem;[\s\S]*?font-weight:\s*600;[\s\S]*?\}/u,
        'Sticky Fingers must preserve manifest-loader width metrics'
    );
    assert.match(html, /id="presetDropdownToggle" type="button"[\s\S]*?aria-controls="presetDropdownMenu"/u);

    for (const [source, expectedImport] of [
        ['script.js', "./src/framework/FrameworkAdapter.js?v=g6-file-intake-1"],
        ['src/ui/ColorPicker.js', "../framework/FrameworkAdapter.js?v=g6-file-intake-1"],
        ['src/core/GridGenerator.js', "../framework/FrameworkAdapter.js?v=g6-file-intake-1"],
        ['src/elements/ElementsNavigator.js', "../framework/FrameworkAdapter.js?v=g6-file-intake-1"]
    ]) {
        assert.equal(
            (await readFile(new URL(source, appRoot), 'utf8'))
                .includes(`from '${expectedImport}';`),
            true
        );
    }

    assert.equal(ColorUtils.rgbToHex(130, 169, 217), '#82a9d9');
    assert.equal(ColorUtils.getContrastColor('#ffffff'), '#000000');
    assert.equal(typeof DialogHost, 'function');
    assert.equal(typeof FileIntakeController, 'function');
    await assert.rejects(
        access(new URL('src/utils/ColorUtils.js', appRoot)),
        error => error?.code === 'ENOENT'
    );

    const [textToPath] = await Promise.all([
        readFile(new URL('src/utils/TextToPath.js', appRoot), 'utf8')
    ]);
    assert.match(style, /\.\.\/framework\/fonts\/TT_Commons_Classic_Regular\.woff2/u);
    assert.match(style, /\.\.\/framework\/fonts\/TT_Commons_Classic_Medium\.woff2/u);
    assert.match(textToPath, /\.\.\/framework\/fonts\/TT Commons Classic Regular\.otf/u);
    assert.match(textToPath, /\.\.\/framework\/fonts\/TT Commons Classic Medium\.otf/u);
    assert.match(
        style,
        /\.panel-header span:first-child\s*\{[^}]*font-size:\s*0\.9rem;[^}]*line-height:\s*1rem;/su
    );
    for (const file of [
        'TT_Commons_Classic_Regular.woff2',
        'TT_Commons_Classic_Medium.woff2',
        'TT Commons Classic Regular.otf',
        'TT Commons Classic Medium.otf'
    ]) {
        await assert.rejects(
            access(new URL(`fonts/${file}`, appRoot)),
            error => error?.code === 'ENOENT'
        );
        await access(new URL(`../framework/fonts/${file}`, appRoot));
    }
});

test('Sticky Fingers keeps native number inputs outside the value-display contract', async () => {
    const [html, style, sharedStyles, script, controller] = await Promise.all([
        readFile(new URL('index.html', appRoot), 'utf8'),
        readFile(new URL('style.css', appRoot), 'utf8'),
        readFile(new URL('../framework/css/othersite-styles.css', appRoot), 'utf8'),
        readFile(new URL('script.js', appRoot), 'utf8'),
        readFile(new URL('src/ui/NumberInputController.js', appRoot), 'utf8')
    ]);

    assert.equal(html.match(/type="number"/gu)?.length || 0, 39);
    assert.equal(html.match(/class="number-input"/gu)?.length || 0, 39);
    assert.equal(html.match(/<input\b[^>]*\btype="range"[^>]*>/gu)?.length || 0, 0);
    assert.equal(html.match(/class="value-display(?!-)/gu)?.length || 0, 0);
    assert.equal(script.match(/input\.type = 'number';/gu)?.length || 0, 1);
    assert.match(script, /input\.className = 'number-input';/u);

    const styleWithoutComments = style.replace(/\/\*[\s\S]*?\*\//gu, '');
    assert.doesNotMatch(
        styleWithoutComments,
        /(?:^|\})\s*[^{}]*\.value-display(?![\w-])[^{}]*\{/gu,
        'Sticky has no active text value-display and must consume shared CSS if one is added'
    );
    assert.match(
        sharedStyles,
        /(?:^|\n)\.value-display\s*\{[\s\S]*?font-variant-numeric: tabular-nums;[\s\S]*?\}/u
    );
    assert.match(
        style,
        /\.number-input\s*\{[\s\S]*?height: 32px;[\s\S]*?font-size: 0\.85rem;[\s\S]*?margin-top: var\(--spacing-md\);[\s\S]*?\}/u
    );
    assert.match(
        style,
        /\.number-input::-webkit-inner-spin-button,\s*\.number-input::-webkit-outer-spin-button\s*\{\s*opacity: 1;\s*\}/u
    );
    assert.match(
        styleWithoutComments,
        /\.control-group input\[type="range"\]\s*\{/u,
        'legacy range presentation remains dormant until dead-CSS cleanup'
    );
    assert.match(controller, /if \(event\.shiftKey && config\.decimals === 2\)/u);
    assert.match(controller, /const roundedToTenth = Math\.round\(currentValue \* 10\) \/ 10;/u);
    assert.match(controller, /newValue = this\.settings\.get\(config\.setting\);/u);
    assert.match(controller, /element\.value = newValue\.toFixed\(config\.decimals\);/u);
});

test('manifest.json is the only Sticky Fingers preset discovery source', async () => {
    const manifest = JSON.parse(await readFile(new URL('presets/manifest.json', appRoot), 'utf8'));
    assert.equal(manifest.count, 3);
    assert.equal(manifest.presets.length, 3);
    for (const preset of manifest.presets) {
        await access(new URL(`presets/${preset.file}`, appRoot));
    }

    const script = await readFile(new URL('script.js', appRoot), 'utf8');
    assert.match(script, /presets\/manifest\.json\?ts=/u);
    assert.doesNotMatch(script, /loadPresetsFromDirectoryListing|loadPresetsFromGitHubAPI|extractJsonFilenamesFromListing/u);
});

test('Google Sheets remains explicit user-initiated external functionality', async () => {
    const [script, html] = await Promise.all([
        readFile(new URL('script.js', appRoot), 'utf8'),
        readFile(new URL('index.html', appRoot), 'utf8')
    ]);
    assert.match(script, /async loadDataFromGoogleSheets\(\)/u);
    assert.match(script, /const response = await fetch\(csvUrl\);/u);
    assert.match(script, /https:\/\/docs\.google\.com\/spreadsheets/u);
    assert.match(html, /id="loadDataBtn"/u);
    assert.match(html, /id="googleSheetsUrl"/u);
    assert.match(html, /src="script\.js\?v=g6-action-dock-5"/u);
    assert.match(
        html,
        /id="dataStatus" class="data-status" role="status" aria-live="polite" aria-atomic="true"/u
    );
    assert.match(script, /const isError = type === 'error';/u);
    assert.match(script, /setAttribute\('role', isError \? 'alert' : 'status'\)/u);
    assert.match(script, /setAttribute\('aria-live', isError \? 'assertive' : 'polite'\)/u);
    assert.match(html, /<dialog id="dialog" class="modal" aria-labelledby="dialogTitle">/u);
    assert.match(script, /this\.feedbackDialogHost = new DialogHost\(\);/u);
    assert.equal((script.match(/await this\.feedbackDialogHost\.alert\(\{/gu) || []).length, 5);
    assert.doesNotMatch(script, /(?:^|[^\w$.])alert\s*\(/u);

    const navigator = await readFile(new URL('src/elements/ElementsNavigator.js', appRoot), 'utf8');
    assert.match(navigator, /await this\.dialogHost\.confirm\(\{/u);
    assert.doesNotMatch(navigator, /(?:^|[^\w$.])confirm\s*\(/u);
});

test('the existing EAN-13 checksum warning behavior is preserved', async () => {
    const source = await readFile(new URL('src/utils/BarcodeGenerator.js', appRoot), 'utf8');
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    const { BarcodeGenerator } = await import(moduleUrl);

    assert.equal(BarcodeGenerator.calculateEAN13Checksum('477735828177'), '6');
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = message => warnings.push(message);
    try {
        const svg = BarcodeGenerator.generateEAN13SVG('4777358281777');
        assert.match(svg, /^<svg /u);
    } finally {
        console.warn = originalWarn;
    }
    assert.deepEqual(warnings, [
        'EAN-13 checksum mismatch: provided 7, calculated 6'
    ]);
});
