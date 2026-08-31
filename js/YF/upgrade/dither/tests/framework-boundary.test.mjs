import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    DITHER_FRAMEWORK_ADAPTER,
    DitherPanelManager
} from '../js/framework/FrameworkAdapter.js';
import { ColorUtils, PanelManager } from '../../framework/src/index.js';

const appRoot = new URL('../', import.meta.url);

test('Dither reaches shared UI and color behavior through one public-barrel facade', async () => {
    const [adapter, app] = await Promise.all([
        readFile(new URL('js/framework/FrameworkAdapter.js', appRoot), 'utf8'),
        readFile(new URL('dither.js', appRoot), 'utf8')
    ]);

    assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/framework\/src\/index\.js';/u);
    assert.deepEqual(DITHER_FRAMEWORK_ADAPTER.sharedCapabilities, [
        'ColorUtils',
        'PanelManager'
    ]);
    assert.ok(new DitherPanelManager() instanceof PanelManager);
    assert.equal(typeof ColorUtils.hexToRgb, 'function');

    assert.match(app, /\.\/js\/framework\/FrameworkAdapter\.js\?v=g4-dither-2/u);
    assert.match(app, /new DitherPanelManager\(\)/u);
    assert.doesNotMatch(app, /initPanelDrag\s*\(/u);
    assert.match(app, /return ColorUtils\.hexToRgb\(hex\);/u);
    assert.match(app, /return ColorUtils\.rgbToHex\(r, g, b\);/u);
    assert.match(app, /return ColorUtils\.rgbToHsb\(r, g, b\);/u);
    assert.match(app, /return ColorUtils\.hsbToRgb\(h, s, b\);/u);
});

test('shared CSS stays below the Dither compatibility skin', async () => {
    const [html, bridge, skin, sharedStyles] = await Promise.all([
        readFile(new URL('index.html', appRoot), 'utf8'),
        readFile(new URL('framework-base.css', appRoot), 'utf8'),
        readFile(new URL('style.css', appRoot), 'utf8'),
        readFile(new URL('../framework/css/othersite-styles.css', appRoot), 'utf8')
    ]);

    assert.match(
        bridge,
        /@import url\('\.\.\/framework\/css\/othersite-styles\.css\?v=g4-dither-1'\) layer\(framework\);/u
    );
    assert.ok(
        html.indexOf('framework-base.css') < html.indexOf('style.css'),
        'shared CSS must load before Dither compatibility CSS'
    );
    assert.match(html, /style\.css\?v=g5-dither-value-3/u);
    assert.match(skin, /Shared-framework parity bridge/u);
    assert.match(skin, /\.main-content\s*\{\s*height: auto;\s*flex: 0 1 auto;/u);
    assert.match(
        sharedStyles,
        /(?:^|\n)\.value-display\s*\{[\s\S]*?font-variant-numeric: tabular-nums;[\s\S]*?\}/u
    );
    assert.match(
        sharedStyles,
        /(?:^|\n)\.value-display:focus\s*\{[\s\S]*?color: var\(--color-text\);[\s\S]*?\}/u
    );
    assert.match(
        sharedStyles,
        /(?:^|\n)\.value-display:disabled\s*\{[\s\S]*?opacity: 0\.4;[\s\S]*?cursor: default;[\s\S]*?\}/u
    );
    const skinWithoutComments = skin.replace(/\/\*[\s\S]*?\*\//gu, '');
    const privateValueDisplaySelectors = Array.from(
        skinWithoutComments.matchAll(/(?:^|\})\s*([^{}]*\.value-display(?![\w-])[^{}]*)\{/gu),
        match => match[1].trim()
    );
    assert.deepEqual(
        privateValueDisplaySelectors,
        ['.control-group label .value-display'],
        'Dither must retain only its local flex-layout extension'
    );
    assert.match(
        skin,
        /\.control-group label \.value-display\s*\{\s*flex-shrink: 1;\s*margin-left: auto;\s*font-variant-numeric: normal;\s*\}/u
    );
    assert.match(
        skin,
        /\.hsb-value\s*\{[\s\S]*?font-variant-numeric: normal;[\s\S]*?\}/u,
        'Dither HSB fields keep the raster-safe numeric glyph contract'
    );
    assert.equal(
        html.match(/class="value-display(?!-)/gu)?.length || 0,
        13,
        'Dither value-display inventory changed'
    );
});

test('Dither keeps private value formatting, raster invalidation and PNG export', async () => {
    const app = await readFile(new URL('dither.js', appRoot), 'utf8');

    assert.match(app, /input\.dataset\.originalValue = input\.value;/u);
    assert.match(
        app,
        /input\.value = input\.dataset\.originalValue;\s*input\.blur\(\);/u,
        'Escape must restore the focus snapshot through the existing blur lifecycle'
    );
    assert.match(app, /if \(sliderId === 'scale'\)/u);
    assert.match(app, /const percentStep = e\.shiftKey \? 10 : 1;/u);
    assert.match(app, /this\.dom\.scaleValue\.value = percentage \+ '%';/u);
    assert.match(app, /this\.dom\.rotationValue\.value = numValue \+ '°';/u);
    assert.match(app, /this\.cache\.processedImage = null;/u);
    assert.match(app, /exportCanvas\.toBlob\(\(blob\) =>/u);
    assert.match(app, /link\.download = 'dithered-image\.png';/u);
});

test('ordinary panel clicks remain paint-neutral while a drag restores legacy stacking', () => {
    const manager = new DitherPanelManager();
    const controls = { style: { zIndex: '999' } };
    const transform = { style: { zIndex: '999' } };
    manager.panels = new Map([
        ['controlsPanel', { element: controls }],
        ['transformPanel', { element: transform }]
    ]);

    manager.bringToFront('controlsPanel');
    assert.equal(controls.style.zIndex, '999');
    assert.equal(transform.style.zIndex, '999');

    manager.dragState.isDragging = true;
    manager.bringToFront('controlsPanel');
    assert.equal(controls.style.zIndex, '1000');
    assert.equal(transform.style.zIndex, '999');
});

test('Dither panel drag preserves the legacy unbounded coordinates', () => {
    const manager = new DitherPanelManager();
    const calls = [];
    manager.setPosition = (...args) => calls.push(args);
    manager.dragState = {
        isDragging: true,
        panel: 'controlsPanel',
        startX: 200,
        startY: 100,
        initialX: 960,
        initialY: 20
    };

    manager.onDragging({ clientX: -40, clientY: 900 });

    assert.deepEqual(calls, [['controlsPanel', 720, 820]]);
});
