import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const [toolSource, htmlSource, stylesSource, frameworkStylesSource, controlsSource, assetsSource] = await Promise.all([
    readFile(new URL('../tool.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../../framework/css/othersite-styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/controls.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/io/assets.js', import.meta.url), 'utf8')
]);

assert.match(
    toolSource,
    /import\s*\{\s*defineTool,\s*FileIntakeController\s*\}\s*from\s*['"]\.\.\/framework\/src\/index\.js\?v=g6-file-intake-1['"];/,
    'Wordplayer must consume the shared framework through its public barrel'
);
assert.doesNotMatch(
    toolSource,
    /src\/foundation/,
    'Wordplayer runtime must not import its retired framework copy'
);
assert.match(
    toolSource,
    /import\s*\{\s*WordplayerExporter\s*\}\s*from\s*['"]\.\/src\/export\/exporters\.js['"];/,
    'Wordplayer-specific exporter must remain application-owned'
);
assert.match(toolSource, /storageKey:\s*['"]upgrade:wordplayer:presets:v1['"]/, 'storage namespace changed');
assert.match(toolSource, /export:\s*false/, 'shared framework exporter must remain disabled');

const frameworkCss = htmlSource.indexOf('../framework/css/othersite-styles.css');
const applicationCss = htmlSource.indexOf('href="styles.css');
assert.ok(frameworkCss >= 0, 'shared framework stylesheet is missing');
assert.ok(applicationCss > frameworkCss, 'application stylesheet must load after framework CSS');
assert.match(htmlSource, /othersite-styles\.css\?v=g6-file-intake-1/u, 'FileIntake CSS cache boundary changed');
assert.match(htmlSource, /tool\.js\?v=g6-file-intake-3/u, 'FileIntake JS cache boundary changed');
assert.doesNotMatch(htmlSource, /href=["']foundation\.css["']/, 'retired local foundation CSS is still linked');
assert.match(htmlSource, /\.\.\/framework\/fonts\/CoFoSans-Regular\.woff2/, 'shared regular CoFo font is not preloaded');
assert.match(htmlSource, /\.\.\/framework\/fonts\/CoFoSans-Medium\.woff2/, 'shared medium CoFo font is not preloaded');
assert.match(
    htmlSource,
    /<a href="\.\.\/" class="mode-nav-button mode-nav-back" aria-label="Back to Upgrade Tools">←Upgrade Tools<\/a>/u,
    'Wordplayer mode-navigation extension must expose the canonical back-link semantics'
);
assert.doesNotMatch(
    htmlSource,
    /class="[^"]*top-link[^"]*"[^>]*>←Upgrade Tools<\/a>/u,
    'Wordplayer back link must retain its explicit mode-navigation presentation'
);
assert.match(htmlSource, /<nav class="bottom-buttons action-dock" role="toolbar" aria-label="Export actions">/u);
assert.match(htmlSource, /action-dock__slot action-dock__slot--utility[\s\S]*?\bid="introHelpBtn"/u);
assert.match(htmlSource, /action-dock__slot action-dock__slot--primary[\s\S]*?\bid="exportPngBtn"[\s\S]*?\bid="exportSvgBtn"/u);
assert.match(htmlSource, /action-dock__slot action-dock__slot--options[\s\S]*?\bid="transparentPngCheckbox"/u);
assert.equal(htmlSource.match(/class="control-section image-load-section file-intake"/gu)?.length, 2);
assert.equal(htmlSource.match(/file-intake__trigger/gu)?.length, 2);
assert.equal(htmlSource.match(/file-intake__status/gu)?.length, 2);
assert.match(toolSource, /FileIntakeController/u, 'Wordplayer must receive FileIntake from the public barrel');
assert.match(toolSource, /src\/ui\/controls\.js\?v=g6-file-intake-1/u);
assert.match(toolSource, /src\/io\/assets\.js\?v=g6-file-intake-2/u);
assert.match(controlsSource, /new this\.FileIntakeController/u);
assert.match(controlsSource, /dropzone:\s*input\?\.closest\('\.file-intake'\)/u);
assert.match(controlsSource, /accept:\s*'image\/\*'/u);
assert.match(controlsSource, /accept:\s*'\.svg,image\/svg\+xml'/u);
assert.doesNotMatch(controlsSource, /imageInput\?\.addEventListener\('change'/u);
assert.match(controlsSource, /catch \{\s*observer\.disconnect\?\.\(\);\s*\}/u);
assert.match(assetsSource, /async loadImageFile\(file\)/u);
assert.match(assetsSource, /async loadFormFile\(file\)/u);
assert.match(
    assetsSource,
    /this\.formsEngine\.formImage && this\.formsEngine\.formKey === formKey/u,
    'same-content Forms SVG imports must preserve the current deterministic geometry'
);
assert.match(
    frameworkStylesSource,
    /\.panel-header span:first-child\s*\{[^}]*font-weight:\s*500;[^}]*font-size:\s*0\.9rem;/su,
    'shared 14.4/500 panel-title contract changed'
);
assert.doesNotMatch(stylesSource, /\.panel-header span:first-child/u, 'Wordplayer must not fork the shared panel-title presentation');

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

const privateValueDisplaySelectors = Array.from(
    stylesSource.matchAll(/(?:^|\})\s*([^{}]*value-display[^{}]*)\{/gu),
    (match) => match[1].trim()
);
assert.deepEqual(
    privateValueDisplaySelectors,
    ['#formsPanel .compact-slider-control .value-display'],
    'Wordplayer may extend value-display only through the compact Forms variant'
);
assert.match(
    stylesSource,
    /#formsPanel \.compact-slider-control \.value-display\s*\{[^}]*width:\s*3\.2em;[^}]*min-width:\s*0;[^}]*font-size:\s*0\.72rem;[^}]*\}/su,
    'compact Forms value-display geometry changed'
);
assert.equal(htmlSource.match(/class="value-display"/gu)?.length, 20, 'Wordplayer slider display inventory changed');
assert.equal(
    htmlSource.match(/class="control-group compact-slider-control"/gu)?.length,
    8,
    'Wordplayer compact Forms slider inventory changed'
);
assert.equal(
    htmlSource.match(/<input\b[^>]*\btype="range"[^>]*>/gu)?.length,
    20,
    'Wordplayer ordinary range inventory changed'
);
const privateRangeSelectors = Array.from(
    stylesSource.matchAll(/(?:^|\})\s*([^{}]*input\[type="range"\][^{}]*)\{/gu),
    (match) => match[1].trim()
);
assert.deepEqual(
    privateRangeSelectors,
    ['#formsPanel .compact-slider-control input[type="range"]'],
    'Wordplayer may extend range layout only through the compact Forms width rule'
);
assert.match(
    stylesSource,
    /#formsPanel \.compact-slider-control input\[type="range"\]\s*\{\s*width:\s*100%;\s*\}/u,
    'compact Forms range layout extension changed'
);
assert.match(
    frameworkStylesSource,
    /\.control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[\s\S]*?width: var\(--slider-thumb-size\);[\s\S]*?\}/u,
    'shared ordinary range thumb changed'
);
assert.match(
    frameworkStylesSource,
    /\.hsb-control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[\s\S]*?width: 12px;[\s\S]*?height: 12px;[\s\S]*?\}/u,
    'shared HSB range thumb changed'
);
assert.match(toolSource, /colorPickers:\s*\{[\s\S]*?containerId:\s*'unifiedColorPickerContainer'/u);

assert.equal(
    htmlSource.match(/<input\b[^>]*\btype="checkbox"[^>]*>/gu)?.length,
    11,
    'Wordplayer checkbox inventory changed'
);
assert.equal(
    htmlSource.match(/<input\b[^>]*\btype="radio"[^>]*>/gu)?.length,
    2,
    'Wordplayer mode radio inventory changed'
);
assert.equal(htmlSource.match(/class="pill-toggle(?: [^"]*)?"/gu)?.length, 10, 'Wordplayer pill family changed');
assert.match(
    frameworkStylesSource,
    /\.pill-toggle\s*\{[^}]*touch-action:\s*manipulation;[^}]*\}/su,
    'shared pill-toggle base changed'
);
assert.match(
    frameworkStylesSource,
    /\.toggle-switch input:checked \+ \.toggle-slider:before\s*\{[^}]*translateX\(20px\);/su,
    'shared transparent-export switch state changed'
);
assert.doesNotMatch(
    stylesSource.replace(/\/\*[\s\S]*?\*\//gu, ''),
    /(?:^|\})\s*\.(?:pill-toggle|toggle-switch)\s*\{/u,
    'Wordplayer must not fork shared pill or toggle-switch presentation'
);
assert.match(
    stylesSource,
    /\.mode-nav-options input\[type="radio"\]:checked \+ \.mode-nav-button/u,
    'Wordplayer private mode-navigation checked state changed'
);

console.log(`Wordplayer framework boundary passed (${appRoot})`);
