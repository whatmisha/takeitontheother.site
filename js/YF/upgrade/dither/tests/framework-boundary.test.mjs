import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    DITHER_FRAMEWORK_ADAPTER,
    DitherPanelManager,
    OverlayDialogHost
} from '../js/framework/FrameworkAdapter.js';
import { ColorUtils, OverlayDialogHost as SharedOverlayDialogHost, PanelManager } from '../../framework/src/index.js';

const appRoot = new URL('../', import.meta.url);

test('Dither reaches shared UI and color behavior through one public-barrel facade', async () => {
    const [adapter, app] = await Promise.all([
        readFile(new URL('js/framework/FrameworkAdapter.js', appRoot), 'utf8'),
        readFile(new URL('dither.js', appRoot), 'utf8')
    ]);

    assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/framework\/src\/index\.js\?v=g5-overlay-1';/u);
    assert.deepEqual(DITHER_FRAMEWORK_ADAPTER.sharedCapabilities, [
        'ColorUtils',
        'OverlayDialogHost',
        'PanelManager'
    ]);
    assert.ok(new DitherPanelManager() instanceof PanelManager);
    assert.equal(OverlayDialogHost, SharedOverlayDialogHost);
    assert.equal(typeof ColorUtils.hexToRgb, 'function');

    assert.match(app, /\.\/js\/framework\/FrameworkAdapter\.js\?v=g5-overlay-1/u);
    assert.match(app, /new DitherPanelManager\(\)/u);
    assert.match(app, /new OverlayDialogHost\(\{/u);
    assert.doesNotMatch(app, /modalOverlay\.classList\.(?:add|remove)\('active'\)/u);
    assert.doesNotMatch(app, /document\.body\.style\.overflow\s*=/u);
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
        /@import url\('\.\.\/framework\/css\/othersite-styles\.css\?v=g5-dialog-scope-1'\) layer\(framework\);/u
    );
    assert.ok(
        html.indexOf('framework-base.css') < html.indexOf('style.css'),
        'shared CSS must load before Dither compatibility CSS'
    );
    assert.match(html, /framework-base\.css\?v=g5-legacy-1/u);
    assert.match(html, /style\.css\?v=g5-legacy-1/u);
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
    assert.match(
        bridge,
        /\.bottom-buttons\s*\{\s*all:\s*revert-layer;\s*left:\s*var\(--spacing-3xl\);\s*transform:\s*none;\s*z-index:\s*1000;\s*\}/u,
        'Dither must keep only its private left action-bar anchor'
    );
    assert.match(bridge, /\.btn-fixed\s*\{\s*all:\s*revert-layer;\s*\}/u);
    assert.match(
        bridge,
        /\.modal-overlay > \.modal-content,\s*\.modal-overlay > \.modal-content h2\s*\{\s*all:\s*revert-layer;/u
    );
    assert.doesNotMatch(
        skinWithoutComments,
        /^\s*\.(?:modal-content|modal-close)(?:\s|:|\{)/mu,
        'Dither must consume shared modal structure'
    );
    assert.match(
        skinWithoutComments,
        /\.modal-overlay\s*\{\s*z-index:\s*1000;\s*transition:\s*opacity var\(--transition-normal\);\s*\}/u
    );
    assert.match(
        skinWithoutComments,
        /\.modal-overlay > \.modal-content\s*\{\s*transform:\s*scale\(0\.9\);\s*transition:\s*transform var\(--transition-normal\);/u
    );
    assert.doesNotMatch(
        skinWithoutComments,
        /(?:^|\})\s*\.(?:bottom-buttons|btn-fixed|btn-export)(?:\s|:|\{|,)/u,
        'Dither must consume the shared action bar and fixed-button base'
    );
    assert.match(skinWithoutComments, /\.btn-remove\s*\{/u);
    assert.match(skinWithoutComments, /\.export-transparency-label\s*\{/u);
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

    assert.equal(html.match(/class="checkbox-label"/gu)?.length || 0, 2);
    assert.equal(html.match(/class="export-transparency-label"/gu)?.length || 0, 4);
    assert.equal(html.match(/<input\b[^>]*\btype="radio"[^>]*>/gu)?.length || 0, 3);
    assert.match(sharedStyles, /(?:^|\n)\.checkbox-label\s*\{/u);
    assert.match(sharedStyles, /(?:^|\n)\.segmented-control\s*\{/u);
    assert.doesNotMatch(
        skinWithoutComments,
        /(?:^|\})\s*\.(?:checkbox-label|segmented-control)(?:\s|:|\{)/u,
        'Dither reintroduced a local shared-choice base'
    );
    assert.match(
        bridge,
        /\.segmented-control,[\s\S]*?\.checkbox-label::after\s*\{\s*all:\s*revert-layer;\s*\}/u
    );
    assert.match(
        bridge,
        /\.control-group \.segmented-control label\s*\{\s*all:\s*revert-layer;\s*margin-top:\s*1px;\s*margin-left:\s*1px;\s*margin-bottom:\s*var\(--spacing-xs\);\s*gap:\s*normal;\s*\}/u
    );
    assert.match(
        bridge,
        /\.segmented-control\s*\{\s*--segmented-control-font-size:\s*0\.85rem;\s*\}/u
    );
    assert.match(
        skinWithoutComments,
        /\.export-transparency-label input\[type="checkbox"\]\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/su,
        'four raster-export checkboxes must remain private'
    );
});

test('all thirteen Dither ranges remain in the private raster-safe variant', async () => {
    const [html, skin, app] = await Promise.all([
        readFile(new URL('index.html', appRoot), 'utf8'),
        readFile(new URL('style.css', appRoot), 'utf8'),
        readFile(new URL('dither.js', appRoot), 'utf8')
    ]);
    const skinWithoutComments = skin.replace(/\/\*[\s\S]*?\*\//gu, '');

    assert.equal(html.match(/<input\b[^>]*\btype="range"[^>]*>/gu)?.length || 0, 13);
    assert.equal(html.match(/class="hsb-control-group"/gu)?.length || 0, 3);
    assert.equal((html.match(/<input\b[^>]*\btype="range"[^>]*>/gu)?.length || 0) - 3, 10);
    assert.match(skinWithoutComments, /--slider-thumb-size:\s*10px;/u);
    assert.match(
        skinWithoutComments,
        /\.control-group input\[type="range"\]\s*\{[^}]*height:\s*1px;[^}]*background:\s*var\(--color-border\);[^}]*margin-top:\s*var\(--spacing-md\);[^}]*\}/su
    );
    assert.match(
        skinWithoutComments,
        /\.control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[^}]*width:\s*var\(--slider-thumb-size\);[^}]*height:\s*var\(--slider-thumb-size\);[^}]*margin-top:\s*-4\.5px;[^}]*\}/su
    );
    assert.match(
        skinWithoutComments,
        /\.control-group input\[type="range"\]::-webkit-slider-thumb:hover\s*\{[^}]*transform:\s*scale\(1\.3\);[^}]*\}/su
    );
    assert.match(
        skinWithoutComments,
        /\.hsb-control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[^}]*width:\s*var\(--slider-thumb-size\);[^}]*height:\s*var\(--slider-thumb-size\);[^}]*margin-top:\s*-4\.5px;[^}]*\}/su
    );
    assert.match(skinWithoutComments, /\.control-group input\[type="range"\]\s*\{\s*bottom:\s*auto;\s*cursor:\s*default;\s*\}/u);
    assert.match(app, /DEBOUNCE_DELAY:\s*16/u);
    assert.equal(app.match(/this\.debouncedApplyEffects\(\);/gu)?.length || 0, 6);
    assert.match(app, /rotation:\s*\(value\)\s*=>\s*\{[\s\S]*?this\.applyEffects\(\);[\s\S]*?this\.drawOverlay\(\);[\s\S]*?\}/u);
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
