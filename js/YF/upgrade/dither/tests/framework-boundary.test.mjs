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

test('shared CSS stays below the frozen Dither skin', async () => {
    const [html, bridge, skin] = await Promise.all([
        readFile(new URL('index.html', appRoot), 'utf8'),
        readFile(new URL('framework-base.css', appRoot), 'utf8'),
        readFile(new URL('style.css', appRoot), 'utf8')
    ]);

    assert.match(
        bridge,
        /@import url\('\.\.\/framework\/css\/othersite-styles\.css\?v=g4-dither-1'\) layer\(framework\);/u
    );
    assert.ok(
        html.indexOf('framework-base.css') < html.indexOf('style.css'),
        'shared CSS must load before Dither compatibility CSS'
    );
    assert.match(skin, /Shared-framework parity bridge/u);
    assert.match(skin, /\.main-content\s*\{\s*height: auto;\s*flex: 0 1 auto;/u);
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
