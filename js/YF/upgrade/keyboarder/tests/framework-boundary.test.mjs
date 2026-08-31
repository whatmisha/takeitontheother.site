import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const [toolSource, htmlSource, themeSource, typographySource, frameworkStylesSource] = await Promise.all([
    readFile(new URL('../app/tool.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/theme.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/kb/typography.js', import.meta.url), 'utf8'),
    readFile(new URL('../../framework/css/othersite-styles.css', import.meta.url), 'utf8')
]);

assert.match(
    toolSource,
    /import\s*\{\s*defineTool\s*,\s*SVGExporter\s*\}\s*from\s*['"]\.\.\/\.\.\/framework\/src\/index\.js['"];/,
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
    /<a class="top-link" href="\.\.\/" aria-label="Back to Upgrade Tools">←Upgrade Tools<\/a>/u,
    'Keyboarder back link must expose the canonical navigation contract'
);
assert.match(themeSource, /\.\.\/\.\.\/framework\/fonts\/CoFoSans-Regular\.woff2/, 'shared regular CoFo font is missing');
assert.match(themeSource, /\.\.\/\.\.\/framework\/fonts\/CoFoSans-Medium\.woff2/, 'shared medium CoFo font is missing');
assert.match(themeSource, /\.\.\/fonts\/YS%20Text%20Variable\/YSText-Upright-weight-VF\.ttf/, 'application YS Text font changed');
assert.match(typographySource, /\.\.\/\.\.\/vendor\/lib\/opentype\.module\.js/, 'Keyboarder typography dependency changed');
assert.match(
    frameworkStylesSource,
    /\.panel-header span:first-child\s*\{[^}]*font-weight:\s*500;[^}]*font-size:\s*0\.9rem;/su,
    'shared 14.4/500 panel-title contract changed'
);
assert.doesNotMatch(themeSource, /\.panel-header span:first-child/u, 'Keyboarder must not fork the shared panel-title presentation');

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
