import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('Sparky consumes the shared framework without surrendering private mobile and export behavior', async () => {
    const [toolSource, htmlSource, stylesSource, frameworkStylesSource] = await Promise.all([
        readFile(new URL('../tool.js', import.meta.url), 'utf8'),
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles/sparky.css', import.meta.url), 'utf8'),
        readFile(new URL('../../framework/css/othersite-styles.css', import.meta.url), 'utf8')
    ]);

    assert.match(
        toolSource,
        /import\s*\{\s*defineTool\s*,\s*FileIntakeController\s*\}\s*from\s*['"]\.\.\/framework\/src\/index\.js\?v=g6-capabilities-1['"];/,
        'Sparky must consume shared infrastructure through the public barrel'
    );
    assert.doesNotMatch(toolSource, /from\s*['"]\.\/framework\//, 'Sparky runtime still imports its retired framework copy');
    assert.match(toolSource, /storageKey:\s*['"]upgrade:sparky:presets:v1['"]/, 'preset namespace changed');
    assert.match(toolSource, /forceSeed:\s*true/, 'Sparky preset refresh policy changed');
    assert.match(
        toolSource,
        /migrate:\s*migrateSparkyPresetLibrary/u,
        'Sparky must use its tested in-namespace preset migration'
    );
    assert.match(toolSource, /export:\s*\{\s*filename:\s*['"]sparky\.svg['"],\s*guard:\s*false\s*\}/, 'custom export exception changed');
    assert.match(toolSource, /function bindMobileShowcase\(app\)/, 'Sparky mobile showcase must remain application-owned');
    assert.match(toolSource, /interactive:\s*false/, 'Sparky non-interactive zoom contract changed');
    assert.match(toolSource, /tool\.exportSVG\s*=\s*async/, 'Sparky static/animated SVG override changed');
    assert.match(toolSource, /tool\.exportPNG\s*=/, 'Sparky static/animated PNG override changed');
    assert.match(
        toolSource,
        /tool\.exportSVG\(\)\.catch\(\(error\)\s*=>\s*\{[\s\S]*?error\?\.name\s*!==\s*'AbortError'/u,
        'intentional animation cancellation must not be reported as an export failure'
    );

    const frameworkCss = htmlSource.indexOf('../framework/css/othersite-styles.css');
    const applicationCss = htmlSource.indexOf('./styles/sparky.css');
    assert.ok(frameworkCss >= 0, 'shared framework stylesheet is missing');
    assert.ok(applicationCss > frameworkCss, 'Sparky stylesheet must load after framework CSS');
    assert.doesNotMatch(htmlSource, /(?:href|src)=["']\.\/framework\//, 'Sparky HTML still links its retired framework copy');
    assert.match(
        htmlSource,
        /<a href="\.\.\/" class="top-link" aria-label="Back to Upgrade Tools">← Upgrade Tools<\/a>/u,
        'Sparky back link must expose the canonical navigation contract'
    );
    assert.match(
        htmlSource,
        /othersite-styles\.css\?v=g6-choice-1/u,
        'Sparky must load the ActionDock-capable shared stylesheet revision'
    );
    assert.match(
        htmlSource,
        /<nav\b[^>]*\bclass="[^"]*\baction-dock\b[^"]*"[^>]*>[\s\S]*?action-dock__slot--utility[\s\S]*?\bid="shortcutHelpBtn"[\s\S]*?\bid="exportSettingsBtn"[^>]*data-action-dock-json-export[^>]*hidden[\s\S]*?action-dock__slot--primary[\s\S]*?\bid="animationExportActions"[\s\S]*?\bid="exportPngBtn"[\s\S]*?\bid="exportSvgBtn"[^>]*data-action-dock-primary-export[\s\S]*?\bid="animationExportStatus"[\s\S]*?\bid="animationExportCancelBtn"[\s\S]*?<\/nav>/u,
        'Sparky must keep shortcut help separate from its app-owned export/progress lifecycle'
    );
    assert.match(
        stylesSource,
        /\.sparky-shortcut-help\s*\{\s*position:\s*relative;\s*\}/u,
        'Sparky shortcut popup must anchor within the ActionDock utility slot'
    );
    assert.match(
        stylesSource,
        /\.bottom-buttons\.action-dock\s*\{[^}]*display:\s*flex\s*!important;[^}]*max-width:\s*calc\(100% - 24px\);/su,
        'Sparky mobile must retain a centered export ActionDock'
    );
    assert.doesNotMatch(stylesSource, /TT_Commons_Classic_(?:Regular|Medium)\.woff2/u, 'Sparky UI must not disguise TT Commons as CoFo Sans');
    assert.match(htmlSource, /framework\/css\/ui-contract\.css\?v=g13-ui-repair-2/u, 'Sparky must load the shared system-font UI contract');
    assert.doesNotMatch(stylesSource, /\.\.\/framework\/fonts\/TT_Commons/, 'Sparky CSS still depends on the retired local framework directory');
    assert.match(
        frameworkStylesSource,
        /\.panel-header span:first-child\s*\{[^}]*font-weight:\s*500;[^}]*font-size:\s*0\.9rem;/su,
        'shared 14.4/500 panel-title contract changed'
    );
    assert.doesNotMatch(
        stylesSource,
        /\.panel-header span:first-child/u,
        'Sparky must not fork the shared panel-title presentation'
    );
    assert.match(
        frameworkStylesSource,
        /(?:^|\n)\.value-display\s*\{[\s\S]*?font-variant-numeric: tabular-nums;[\s\S]*?\}/u,
        'shared value-display presentation changed'
    );
    assert.match(
        frameworkStylesSource,
        /(?:^|\n)\.value-display:focus\s*\{[\s\S]*?color: var\(--color-text\);[\s\S]*?\}/u,
        'shared value-display focus state changed'
    );
    assert.match(
        frameworkStylesSource,
        /(?:^|\n)\.value-display:disabled\s*\{[\s\S]*?opacity: 0\.4;[\s\S]*?cursor: default;[\s\S]*?\}/u,
        'shared value-display disabled state changed'
    );
    assert.doesNotMatch(
        stylesSource,
        /value-display/u,
        'Sparky desktop/mobile CSS must not fork shared value-display presentation'
    );
    assert.equal(
        htmlSource.match(/class="value-display"/gu)?.length,
        24,
        'Sparky domain slider display inventory changed'
    );
    assert.equal(
        htmlSource.match(/<input\b[^>]*\btype="range"[^>]*>/gu)?.length,
        24,
        'Sparky ordinary range inventory changed'
    );
    assert.doesNotMatch(
        stylesSource,
        /input\[type=["']range["']\]|slider-(?:thumb|runnable-track)|range-(?:thumb|track)/u,
        'Sparky desktop/mobile CSS must not fork shared range presentation'
    );
    assert.match(
        frameworkStylesSource,
        /\.control-group input\[type="range"\]\s*\{[\s\S]*?height: 10px;[\s\S]*?cursor: pointer;[\s\S]*?\}/u,
        'shared ordinary range base changed'
    );
    assert.match(
        frameworkStylesSource,
        /\.control-group input\[type="range"\]::-webkit-slider-thumb:hover\s*\{[\s\S]*?transform: scale\(1\.25\);[\s\S]*?\}/u,
        'shared ordinary range hover state changed'
    );
    assert.match(
        frameworkStylesSource,
        /\.hsb-control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[\s\S]*?width: 12px;[\s\S]*?height: 12px;[\s\S]*?\}/u,
        'shared HSB range thumb changed'
    );
    assert.equal(
        htmlSource.match(/<input\b[^>]*\btype="(?:checkbox|radio)"[^>]*>/gu)?.length,
        8,
        'Sparky toggle/radio inventory changed'
    );
    assert.equal(htmlSource.match(/class="pill-toggle"/gu)?.length, 5, 'Sparky pill input family changed');
    assert.doesNotMatch(htmlSource, /\bid="showPoint"/u, 'Sparky must not expose a redundant Manual pill');
    assert.match(
        htmlSource,
        /type="checkbox"[^>]*\bid="followCursor"/u,
        'Sparky Follow cursor must remain a single checkbox pill'
    );
    assert.equal(
        htmlSource.match(/<input\b[^>]*\bname="focusMode"[^>]*>/gu)?.length,
        3,
        'Sparky focus segmented-control inventory changed'
    );
    assert.match(
        frameworkStylesSource,
        /\.pill-toggle\s*\{[^}]*touch-action:\s*manipulation;[^}]*\}/su,
        'shared pill-toggle touch contract changed'
    );
    assert.match(
        frameworkStylesSource,
        /\.pill-toggle:has\(input:focus-visible\)\s*\{[^}]*outline:\s*2px solid var\(--color-text\);/su,
        'shared pill-toggle keyboard focus changed'
    );
    assert.match(
        frameworkStylesSource,
        /\.segmented-control input\[type="radio"\]:checked \+ label\s*\{[^}]*background:\s*var\(--color-text\);/su,
        'shared segmented checked state changed'
    );
    assert.doesNotMatch(
        stylesSource.replace(/\/\*[\s\S]*?\*\//gu, ''),
        /(?:^|\})\s*\.(?:pill-toggle|segmented-control)\s*\{/u,
        'Sparky must not fork shared pill or segmented-control presentation'
    );
    assert.match(
        htmlSource,
        /id="showMotionPathToggle" hidden/u,
        'Sparky Path-only toggle visibility contract changed'
    );
    assert.match(toolSource, /maxBytes:\s*2 \* 1024 \* 1024/u);
    assert.match(toolSource, /new FileIntakeController\(/u);
    assert.match(toolSource, /colorPickers:\s*\{[\s\S]*?containerId:\s*'unifiedColorPickerContainer'/u);
    assert.match(
        toolSource,
        /function bindInteractivePlacement\(app\)[\s\S]*?document\.addEventListener\('input',[\s\S]*?document\.addEventListener\('change'/u,
        'Sparky range input/change placement lifecycle changed'
    );
    await assert.rejects(
        access(new URL('../framework/', import.meta.url)),
        (error) => error?.code === 'ENOENT',
        'local Sparky framework copy must be retired after acceptance'
    );
});
