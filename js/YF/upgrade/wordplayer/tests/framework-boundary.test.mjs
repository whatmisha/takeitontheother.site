import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const [toolSource, htmlSource] = await Promise.all([
    readFile(new URL('../tool.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

assert.match(
    toolSource,
    /import\s*\{\s*defineTool\s*\}\s*from\s*['"]\.\.\/framework\/src\/index\.js['"];/,
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
assert.doesNotMatch(htmlSource, /href=["']foundation\.css["']/, 'retired local foundation CSS is still linked');
assert.match(htmlSource, /\.\.\/framework\/fonts\/CoFoSans-Regular\.woff2/, 'shared regular CoFo font is not preloaded');
assert.match(htmlSource, /\.\.\/framework\/fonts\/CoFoSans-Medium\.woff2/, 'shared medium CoFo font is not preloaded');

console.log(`Wordplayer framework boundary passed (${appRoot})`);
