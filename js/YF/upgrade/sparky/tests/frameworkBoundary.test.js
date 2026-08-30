import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('Sparky consumes the shared framework without surrendering private mobile and export behavior', async () => {
    const [toolSource, htmlSource, stylesSource] = await Promise.all([
        readFile(new URL('../tool.js', import.meta.url), 'utf8'),
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles/sparky.css', import.meta.url), 'utf8')
    ]);

    assert.match(
        toolSource,
        /import\s*\{\s*defineTool\s*\}\s*from\s*['"]\.\.\/framework\/src\/index\.js['"];/,
        'Sparky must consume shared infrastructure through the public barrel'
    );
    assert.doesNotMatch(toolSource, /from\s*['"]\.\/framework\//, 'Sparky runtime still imports its retired framework copy');
    assert.match(toolSource, /storageKey:\s*['"]upgrade:sparky:presets:v1['"]/, 'preset namespace changed');
    assert.match(toolSource, /forceSeed:\s*true/, 'Sparky preset refresh policy changed');
    assert.match(toolSource, /export:\s*\{\s*filename:\s*['"]sparky\.svg['"],\s*guard:\s*false\s*\}/, 'custom export exception changed');
    assert.match(toolSource, /function bindMobileShowcase\(app\)/, 'Sparky mobile showcase must remain application-owned');
    assert.match(toolSource, /interactive:\s*false/, 'Sparky non-interactive zoom contract changed');
    assert.match(toolSource, /tool\.exportSVG\s*=\s*async/, 'Sparky static/animated SVG override changed');
    assert.match(toolSource, /tool\.exportPNG\s*=/, 'Sparky static/animated PNG override changed');

    const frameworkCss = htmlSource.indexOf('../framework/css/othersite-styles.css');
    const applicationCss = htmlSource.indexOf('./styles/sparky.css');
    assert.ok(frameworkCss >= 0, 'shared framework stylesheet is missing');
    assert.ok(applicationCss > frameworkCss, 'Sparky stylesheet must load after framework CSS');
    assert.doesNotMatch(htmlSource, /(?:href|src)=["']\.\/framework\//, 'Sparky HTML still links its retired framework copy');
    assert.match(stylesSource, /\.\.\/fonts\/TT_Commons_Classic_Regular\.woff2/, 'private regular TT Commons font moved incorrectly');
    assert.match(stylesSource, /\.\.\/fonts\/TT_Commons_Classic_Medium\.woff2/, 'private medium TT Commons font moved incorrectly');
    assert.doesNotMatch(stylesSource, /\.\.\/framework\/fonts\/TT_Commons/, 'Sparky CSS still depends on the retired local framework directory');
    await assert.rejects(
        access(new URL('../framework/', import.meta.url)),
        (error) => error?.code === 'ENOENT',
        'local Sparky framework copy must be retired after acceptance'
    );
});
