import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import { ColorUtils } from '../../framework/src/index.js';

const appRoot = new URL('../', import.meta.url);

test('Sticky Fingers exposes shared behavior through one public-barrel facade', async () => {
    const [adapter, html, bridge] = await Promise.all([
        readFile(new URL('src/framework/FrameworkAdapter.js', appRoot), 'utf8'),
        readFile(new URL('index.html', appRoot), 'utf8'),
        readFile(new URL('framework-base.css', appRoot), 'utf8')
    ]);
    assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/framework\/src\/index\.js';/u);
    assert.match(adapter, /sharedCapabilities: Object\.freeze\(\['ColorUtils'\]\)/u);
    assert.match(
        bridge,
        /@import url\('\.\.\/framework\/css\/othersite-styles\.css\?v=g5-sticky-2'\) layer\(framework\);/u
    );
    assert.match(bridge, /\.top-link\s*\{\s*padding: var\(--spacing-md\) var\(--spacing-3xl\);/u);
    assert.match(bridge, /\.btn-fixed\s*\{\s*font-family: Arial;/u);
    assert.match(bridge, /\.controls-panel\s*\{\s*max-height: none;/u);
    assert.match(
        html,
        /<a href="\.\.\/" class="top-link" aria-label="Back to Upgrade Tools">\s*←Upgrade Tools\s*<\/a>/u
    );
    assert.doesNotMatch(html, /class="yf-tools-link"/u);
    assert.ok(
        html.indexOf('framework-base.css') < html.indexOf('style.css'),
        'shared CSS must load below the frozen Sticky Fingers skin'
    );

    for (const [source, expectedImport] of [
        ['script.js', "./src/framework/FrameworkAdapter.js"],
        ['src/ui/ColorPicker.js', "../framework/FrameworkAdapter.js"],
        ['src/core/GridGenerator.js', "../framework/FrameworkAdapter.js"]
    ]) {
        assert.equal(
            (await readFile(new URL(source, appRoot), 'utf8'))
                .includes(`from '${expectedImport}';`),
            true
        );
    }

    assert.equal(ColorUtils.rgbToHex(130, 169, 217), '#82a9d9');
    assert.equal(ColorUtils.getContrastColor('#ffffff'), '#000000');
    await assert.rejects(
        access(new URL('src/utils/ColorUtils.js', appRoot)),
        error => error?.code === 'ENOENT'
    );

    const [style, textToPath] = await Promise.all([
        readFile(new URL('style.css', appRoot), 'utf8'),
        readFile(new URL('src/utils/TextToPath.js', appRoot), 'utf8')
    ]);
    assert.match(style, /\.\.\/framework\/fonts\/TT_Commons_Classic_Regular\.woff2/u);
    assert.match(style, /\.\.\/framework\/fonts\/TT_Commons_Classic_Medium\.woff2/u);
    assert.match(textToPath, /\.\.\/framework\/fonts\/TT Commons Classic Regular\.otf/u);
    assert.match(textToPath, /\.\.\/framework\/fonts\/TT Commons Classic Medium\.otf/u);
    assert.match(html, /href="style\.css\?v=g5-sticky-3"/u);
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
