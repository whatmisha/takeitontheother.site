import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const [toolSource, htmlSource, themeSource, typographySource, frameworkStylesSource, colorPickerSource] = await Promise.all([
    readFile(new URL('../app/tool.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/theme.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/kb/typography.js', import.meta.url), 'utf8'),
    readFile(new URL('../../framework/css/othersite-styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../../framework/src/ui/ColorPicker.js', import.meta.url), 'utf8')
]);

assert.match(
    toolSource,
    /import\s*\{[\s\S]*?defineTool[\s\S]*?FileIntakeController[\s\S]*?SVGExporter[\s\S]*?\}\s*from\s*['"]\.\.\/\.\.\/framework\/src\/index\.js\?v=g6-capabilities-1['"];/,
    'Keyboarder must consume shared infrastructure through the public barrel'
);
assert.doesNotMatch(toolSource, /vendor\/framework/, 'Keyboarder runtime still imports its retired framework copy');
assert.match(toolSource, /readyApp\.exporter\s*=\s*new SVGExporter/, 'Keyboarder custom exporter initialization changed');
assert.match(toolSource, /installPdfExport\(readyApp\)/, 'editable PDF integration changed');
assert.match(toolSource, /installCleanExports\(readyApp\)/, 'clean export wrapper changed');
assert.match(toolSource, /storageKey:\s*['"]upgrade:keyboarder:presets:v1['"]/, 'preset namespace changed');
assert.match(toolSource, /upgrade:keyboarder:svg-export-mode:v1/, 'SVG mode namespace changed');
assert.match(toolSource, /upgrade:keyboarder:ui-mode:v1/, 'UI mode namespace changed');

const frameworkCss = htmlSource.indexOf('../framework/css/othersite-styles.css');
const applicationCss = htmlSource.indexOf('app/theme.css');
assert.ok(frameworkCss >= 0, 'shared framework stylesheet is missing');
assert.ok(applicationCss > frameworkCss, 'Keyboarder theme must load after framework CSS');
assert.doesNotMatch(htmlSource, /vendor\/framework/, 'Keyboarder HTML still links its retired framework copy');
assert.match(
    htmlSource,
    /<a class="top-link" href="\.\.\/" aria-label="Back to Upgrade Tools">← Upgrade Tools<\/a>/u,
    'Keyboarder back link must expose the canonical navigation contract'
);
assert.match(
    htmlSource,
    /othersite-styles\.css\?v=g6-choice-1/u,
    'Keyboarder must load the ActionDock-capable shared stylesheet revision'
);
assert.match(
    htmlSource,
    /<nav\b[^>]*\bclass="[^"]*\baction-dock\b[^"]*"[^>]*>[\s\S]*?action-dock__slot--utility[\s\S]*?\bid="shortcutHelpBtn"[\s\S]*?\bid="verifyBtn"[\s\S]*?\bid="exportJsonBtn"[\s\S]*?\bid="importJsonBtn"[\s\S]*?action-dock__slot--primary[\s\S]*?\bid="exportPdfBtn"[\s\S]*?\bid="exportPngBtn"[\s\S]*?\bid="exportSvgBtn"[\s\S]*?action-dock__slot--options[\s\S]*?\bid="convertToOutlinesCheckbox"[\s\S]*?<\/nav>/u,
    'Keyboarder must keep document utilities, primary exports and Outline in their ActionDock slots'
);
assert.doesNotMatch(themeSource, /CoFoSans-(?:Regular|Medium)\.woff2/u, 'Keyboarder UI must use the shared system stack');
assert.match(htmlSource, /framework\/css\/ui-contract\.css\?v=g12-opentype-1/u, 'Keyboarder must load the shared system-font UI contract');
assert.match(themeSource, /\.\.\/fonts\/YS%20Text%20Variable\/YSText-Upright-weight-VF\.ttf/, 'application YS Text font changed');
assert.match(typographySource, /\.\.\/\.\.\/vendor\/lib\/opentype\.module\.js/, 'Keyboarder typography dependency changed');
assert.match(
    frameworkStylesSource,
    /\.panel-header span:first-child\s*\{[^}]*font-weight:\s*500;[^}]*font-size:\s*0\.9rem;/su,
    'shared 14.4/500 panel-title contract changed'
);
assert.doesNotMatch(themeSource, /\.panel-header span:first-child/u, 'Keyboarder must not fork the shared panel-title presentation');

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

const themeWithoutComments = themeSource.replace(/\/\*[\s\S]*?\*\//gu, '');
assert.doesNotMatch(
    themeWithoutComments,
    /#layersPanel\s+\.pill-toggle(?:-row)?/u,
    'Layers pills must use the shared intrinsic-width wrapping contract'
);
const privateValueDisplaySelectors = Array.from(
    themeWithoutComments.matchAll(/(?:^|\})\s*([^{}]*value-display[^{}]*)\{/gu),
    (match) => match[1].trim()
);
assert.deepEqual(
    privateValueDisplaySelectors,
    [
        '#gridPanel .value-display',
        '.control-group > label .value-display',
        '#typePanel .value-display'
    ],
    'Keyboarder value-display extensions must stay scoped to private numeric editors'
);
assert.match(
    themeWithoutComments,
    /\.control-group > label \.value-display\s*\{[^}]*height:\s*26px;[^}]*border:\s*1px solid var\(--color-border\);[^}]*font-family:\s*var\(--font-mono\);[^}]*font-size:\s*10px;[^}]*font-variant-numeric:\s*tabular-nums;[^}]*\}/su,
    'Keyboarder bordered numeric-field presentation changed'
);
assert.doesNotMatch(
    themeWithoutComments,
    /value-display:(?:focus|disabled)/u,
    'Keyboarder must inherit shared value-display state selectors'
);
assert.equal(htmlSource.match(/class="value-display"/gu)?.length, 6, 'Keyboarder mm-field inventory changed');
assert.equal(
    toolSource.match(/\{\s*inputId:\s*'[^']+'[^}]*suffix:\s*' mm'\s*\}/gu)?.length,
    6,
    'Keyboarder private mm numeric-control contract changed'
);
assert.match(toolSource, /input\.dataset\.numericSetting\s*=\s*config\.setting/u, 'mm fields lost private ownership');
assert.match(htmlSource, /<div id="unifiedColorPickerContainer"><\/div>/u, 'shared readonly HSB host changed');
assert.equal(
    htmlSource.match(/<input\b[^>]*\btype="range"[^>]*>/gu)?.length || 0,
    0,
    'Keyboarder must not add ordinary range controls'
);
assert.doesNotMatch(
    themeWithoutComments,
    /input\[type=["']range["']\]|slider-(?:thumb|runnable-track)|range-(?:thumb|track)/u,
    'Keyboarder theme must not fork shared range presentation'
);
assert.match(
    frameworkStylesSource,
    /\.hsb-control-group input\[type="range"\]\s*\{[\s\S]*?height: 10px;[\s\S]*?background: transparent;[\s\S]*?\}/u,
    'shared HSB range base changed'
);
assert.match(
    frameworkStylesSource,
    /\.hsb-control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[\s\S]*?width: 12px;[\s\S]*?height: 12px;[\s\S]*?\}/u,
    'shared HSB range thumb changed'
);
assert.equal(
    colorPickerSource.match(/<input type="range"/gu)?.length,
    3,
    'shared ColorPicker HSB range inventory changed'
);
assert.match(toolSource, /colorPickers:\s*\{[\s\S]*?containerId:\s*'unifiedColorPickerContainer'/u);
assert.equal(htmlSource.match(/type="file"/gu)?.length, 5, 'Keyboarder file-surface inventory changed');
assert.match(toolSource, /installFileIntakes\(readyApp\)/u);
assert.match(toolSource, /new FileIntakeController\(options\)\.init\(\)/u);

assert.equal(
    htmlSource.match(/<input\b[^>]*\btype="checkbox"[^>]*>/gu)?.length,
    12,
    'Keyboarder checkbox inventory changed'
);
assert.doesNotMatch(htmlSource, /<input\b[^>]*\btype="radio"/u, 'Keyboarder must retain its private button segment');
assert.equal(htmlSource.match(/class="pill-toggle"/gu)?.length, 11, 'Keyboarder pill family changed');
assert.equal(
    htmlSource.match(/<button type="button" data-mode="[^"]+" aria-pressed="(?:true|false)">/gu)?.length,
    3,
    'Keyboarder compensation segment contract changed'
);
assert.match(
    frameworkStylesSource,
    /\.pill-toggle\s*\{[^}]*touch-action:\s*manipulation;[^}]*\}/su,
    'shared pill-toggle base changed'
);
assert.match(
    frameworkStylesSource,
    /\.toggle-switch\s*\{[^}]*width:\s*40px;[^}]*height:\s*20px;[^}]*\}/su,
    'shared export toggle-switch geometry changed'
);
assert.doesNotMatch(
    themeWithoutComments,
    /(?:^|\})\s*\.(?:pill-toggle|toggle-switch)\s*\{/u,
    'Keyboarder must not fork shared pill or toggle-switch presentation'
);
assert.match(
    themeWithoutComments,
    /\.segmented-control\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3,/su,
    'Keyboarder private button segment geometry changed'
);
assert.match(
    toolSource,
    /setAttrIfChanged\(btn, 'aria-pressed', active \? 'true' : 'false'\)/u,
    'Keyboarder compensation aria-pressed synchronization changed'
);

for (const [relativePath, label] of [
    ['../vendor/framework/', 'local framework copy'],
    ['../fonts/CoFo Sans/', 'local CoFo copy'],
    ['../vendor/lib/jspdf.umd.min.js', 'local jsPDF copy'],
    ['../vendor/lib/svg2pdf.umd.min.js', 'local svg2pdf copy']
]) {
    await assert.rejects(
        access(new URL(relativePath, import.meta.url)),
        (error) => error?.code === 'ENOENT',
        `${label} must be retired after shared-framework acceptance`
    );
}

console.log('Keyboarder framework boundary passed');
