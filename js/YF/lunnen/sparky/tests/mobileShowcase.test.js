import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mobile showcase prevents text selection and SVG dragging', async () => {
    const [styles, toolSource] = await Promise.all([
        readFile(new URL('../styles/sparky.css', import.meta.url), 'utf8'),
        readFile(new URL('../tool.js', import.meta.url), 'utf8')
    ]);

    const mobileStyles = styles.match(
        /@media \(max-width: 768px\), \(hover: none\) and \(pointer: coarse\) \{([\s\S]*)$/
    )?.[1] || '';
    assert.match(mobileStyles, /-webkit-user-select:\s*none/);
    assert.match(mobileStyles, /user-select:\s*none/);
    assert.match(mobileStyles, /-webkit-touch-callout:\s*none/);
    assert.match(mobileStyles, /-webkit-user-drag:\s*none/);
    assert.match(toolSource, /addEventListener\('selectstart', preventMobileSelection/);
    assert.match(toolSource, /addEventListener\('dragstart', preventMobileSelection/);
    assert.match(toolSource, /mobileShowcaseFocus \|\| centeredFocus\(settings\)/);
    assert.match(toolSource, /resetMobileFocusMotion\(centeredFocus\(settings\)\)/);
    assert.match(styles, /\.sparky-initializing #mainSvg\s*\{[^}]*visibility:\s*hidden/);
    assert.match(toolSource, /syncMode\(\{ fitImmediately: true \}\)/);
    assert.match(toolSource, /classList\.remove\('sparky-initializing'\)/);
});
