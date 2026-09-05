import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Modes keeps sliders together and exposes only the consolidated controls', async () => {
    const [html, styles, toolSource, uiContract] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles/sparky.css', import.meta.url), 'utf8'),
        readFile(new URL('../tool.js', import.meta.url), 'utf8'),
        readFile(new URL('../../framework/css/ui-contract.css', import.meta.url), 'utf8')
    ]);

    assert.doesNotMatch(html, /bolidHueSpreadSlider|eyePerspectiveSlider|Gets angrier|bolidAngryEyes/);
    assert.doesNotMatch(html, />Motion path</);
    assert.match(html, /id="showMotionPathToggle"[\s\S]*?<span>Path<\/span>/);
    assert.match(html, /class="sparky-mode-slider-group"[\s\S]*?motionDurationSlider[\s\S]*?bolidColorTrailSlider[\s\S]*?motionBlurSlider/);
    assert.doesNotMatch(html, /id="focus(?:Path|Bolid)Controls"/);
    assert.match(styles, /#focusPathActionControls\s*\{[^}]*margin-bottom:\s*12px/);
    assert.match(styles, /#focusManualControls \.sparky-mode-slider-group\s*\{[^}]*margin-bottom:\s*12px/);
    assert.match(html, /id="focusManualControls" class="ui-control-stack"/u);
    assert.match(uiContract, /\.ui-control-stack > \.control-group:last-child\s*\{[^}]*margin-bottom:\s*0\s*!important;/su);
    assert.match(styles, /\.sparky-animation-actions\s*\{[^}]*margin-top:\s*0/);
    assert.match(styles, /#focusPanel\.sparky-focus-panel--bolid \.sparky-animation-actions\s*\{[^}]*margin-top:\s*12px/);
    assert.match(toolSource, /normalized\.eyePerspective\s*=\s*100/);
    assert.match(toolSource, /delete normalized\.bolidHueSpread/);
    assert.match(toolSource, /delete normalized\.bolidAngryEyes/);
});
