import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    DITHER_FRAMEWORK_ADAPTER,
    FileIntakeController,
    OverlayDialogHost,
    PanelManager as AdapterPanelManager
} from '../js/framework/FrameworkAdapter.js';
import { ColorUtils, OverlayDialogHost as SharedOverlayDialogHost, PanelManager } from '../../framework/src/index.js';

const appRoot = new URL('../', import.meta.url);

test('Dither reaches shared UI and color behavior through one public-barrel facade', async () => {
    const [adapter, app] = await Promise.all([
        readFile(new URL('js/framework/FrameworkAdapter.js', appRoot), 'utf8'),
        readFile(new URL('dither.js', appRoot), 'utf8')
    ]);

    assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/framework\/src\/index\.js\?v=g6-file-intake-1';/u);
    assert.deepEqual(DITHER_FRAMEWORK_ADAPTER.sharedCapabilities, [
        'ColorUtils',
        'FileIntakeController',
        'OverlayDialogHost',
        'PanelManager'
    ]);
    assert.equal(AdapterPanelManager, PanelManager);
    assert.equal(OverlayDialogHost, SharedOverlayDialogHost);
    assert.equal(typeof ColorUtils.hexToRgb, 'function');
    assert.equal(typeof FileIntakeController, 'function');

    assert.match(app, /\.\/js\/framework\/FrameworkAdapter\.js\?v=g6-file-intake-1/u);
    assert.equal((app.match(/new FileIntakeController\(\{/gu) || []).length, 2);
    assert.match(app, /dropzone:\s*document\.querySelector\('\.canvas-container'\)/u);
    assert.doesNotMatch(app, /imageInput\.addEventListener\('change'/u);
    assert.doesNotMatch(app, /sampleInput\.addEventListener\('change'/u);
    assert.match(app, /new PanelManager\(\)/u);
    assert.match(app, /this\.panelManager\.initCollapse\(\);/u);
    assert.match(app, /summaryProvider:\s*\(\) => this\.getTextureSettingsSummary\(\)/u);
    assert.match(app, /summaryProvider:\s*\(\) => this\.getTextureTransformSummary\(\)/u);
    assert.match(app, /new OverlayDialogHost\(\{/u);
    assert.doesNotMatch(app, /modalOverlay\.classList\.(?:add|remove)\('active'\)/u);
    assert.doesNotMatch(app, /document\.body\.style\.overflow\s*=/u);
    assert.doesNotMatch(app, /initPanelDrag\s*\(/u);
    assert.doesNotMatch(adapter, /class DitherPanelManager/u);
    assert.match(app, /return ColorUtils\.hexToRgb\(hex\);/u);
    assert.match(app, /return ColorUtils\.rgbToHex\(r, g, b\);/u);
    assert.match(app, /return ColorUtils\.rgbToHsb\(r, g, b\);/u);
    assert.match(app, /return ColorUtils\.hsbToRgb\(h, s, b\);/u);
});

test('shared CSS stays below the Dither compatibility skin', async () => {
    const [html, bridge, skin, sharedStyles, app] = await Promise.all([
        readFile(new URL('index.html', appRoot), 'utf8'),
        readFile(new URL('framework-base.css', appRoot), 'utf8'),
        readFile(new URL('style.css', appRoot), 'utf8'),
        readFile(new URL('../framework/css/othersite-styles.css', appRoot), 'utf8'),
        readFile(new URL('dither.js', appRoot), 'utf8')
    ]);

    assert.match(
        bridge,
        /@import url\('\.\.\/framework\/css\/othersite-styles\.css\?v=g6-choice-1'\) layer\(framework\);/u
    );
    assert.ok(
        html.indexOf('framework-base.css') < html.indexOf('style.css'),
        'shared CSS must load before Dither compatibility CSS'
    );
    assert.match(html, /framework-base\.css\?v=g6-choice-1/u);
    assert.match(html, /style\.css\?v=g6-file-intake-1/u);
    assert.match(html, /js\/export\/DitherPngExport\.js\?v=g7-export-1/u);
    assert.match(html, /dither\.js\?v=g7-export-1/u);
    assert.doesNotMatch(skin, /^\s*\*\s*\{/mu, 'Dither must consume the shared universal reset');
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
    assert.doesNotMatch(bridge, /all:\s*revert-layer/u);
    assert.match(
        bridge,
        /\.dither-action-dock\s*\{\s*z-index:\s*1000;\s*\}/u,
        'Dither must keep its overlay-order extension without forking ActionDock layout'
    );
    assert.doesNotMatch(bridge, /\.bottom-buttons\s*\{/u, 'Dither must retire its private left action anchor');
    assert.match(
        html,
        /action-dock__slot--utility[\s\S]*?id="uploadBtnFixed"[\s\S]*?id="removeImageBtn"[\s\S]*?id="uploadSampleBtn"[\s\S]*?id="removeSampleBtn"[\s\S]*?action-dock__slot--primary[\s\S]*?id="exportBtn"[\s\S]*?action-dock__slot--options[\s\S]*?id="exportWithAlpha"[\s\S]*?class="segmented-control action-dock__segment"[\s\S]*?id="export1x"[\s\S]*?id="export2x"[\s\S]*?id="export4x"[\s\S]*?id="export8x"/u,
        'Dither must separate source actions, PNG export and raster options in ActionDock'
    );
    assert.match(html, /\bid="helpButton"[^>]*>\?<\/button>/u,
        'Dither help must live inside the shared ActionDock');
    assert.doesNotMatch(skinWithoutComments, /\.(?:help-container|btn-help)\b/u,
        'Dither must retire its old floating help presentation');
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
    assert.doesNotMatch(
        skinWithoutComments,
        /(?:^|\})\s*\.(?:controls-panel|panel-header|drag-icon)(?:\s|:|\{|,)/u,
        'Dither must consume the shared panel shell/header and must not restore a drag glyph'
    );
    assert.equal(html.match(/class="collapse-icon"/gu)?.length || 0, 2);
    assert.equal(html.match(/class="panel-params"/gu)?.length || 0, 2);
    assert.equal(html.match(/class="drag-icon"/gu)?.length || 0, 0);
    assert.match(sharedStyles, /(?:^|\n)\.panel-header\s*\{/u);
    assert.match(sharedStyles, /(?:^|\n)\.collapse-icon\s*\{/u);
    assert.match(sharedStyles, /(?:^|\n)\.panel-params\s*\{/u);
    assert.match(skinWithoutComments, /\.btn-remove\s*\{/u);
    assert.doesNotMatch(skinWithoutComments, /\.export-transparency-label\b/u);
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
    assert.equal(html.match(/class="toggle-label"/gu)?.length || 0, 1);
    assert.equal(html.match(/<input\b[^>]*\btype="radio"[^>]*>/gu)?.length || 0, 7);
    assert.match(sharedStyles, /(?:^|\n)\.checkbox-label\s*\{/u);
    assert.match(sharedStyles, /(?:^|\n)\.segmented-control\s*\{/u);
    assert.doesNotMatch(
        skinWithoutComments,
        /(?:^|\})\s*\.(?:checkbox-label|segmented-control)(?:\s|:|\{)/u,
        'Dither reintroduced a local shared-choice base'
    );
    assert.match(
        bridge,
        /\.control-group \.segmented-control label\s*\{\s*margin-top:\s*1px;\s*margin-left:\s*1px;\s*margin-bottom:\s*var\(--spacing-xs\);\s*gap:\s*normal;\s*\}/u
    );
    assert.match(
        bridge,
        /\.control-group \.segmented-control input\[type="radio"\]:checked \+ label\s*\{\s*color:\s*var\(--color-bg\);\s*font-weight:\s*500;/u
    );
    assert.match(bridge, /\.control-group:has\(\.checkbox-label\)\s*\{\s*margin-bottom:\s*var\(--spacing-xs\);/u);
    assert.match(bridge, /\.control-section > \.control-group:has\(\.checkbox-label\):last-child\s*\{\s*margin-bottom:\s*0;/u);
    assert.match(
        bridge,
        /\.segmented-control\s*\{\s*--segmented-control-font-size:\s*0\.85rem;\s*\}/u
    );
    assert.equal(html.match(/class="toggle-label"/gu)?.length || 0, 1,
        'only the independent transparency option must use the shared toggle presentation');
    assert.match(html, /role="radiogroup" aria-label="Export resolution"/u);
    assert.equal(html.match(/name="exportScale"/gu)?.length || 0, 4);
    assert.match(app, /this\.dom\.exportScaleInputs\.forEach/u);
    assert.match(app, /this\.settings\.export2x = scale === 2;/u);
    assert.match(sharedStyles, /(?:^|\n)\.toggle-switch\s*\{/u);
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
        /\.control-group input\[type="range"\]\s*\{[^}]*height:\s*1px;[^}]*background:\s*var\(--color-border\);[^}]*margin-top:\s*var\(--spacing-md\);[^}]*margin-bottom:\s*0;[^}]*\}/su
    );
    assert.match(skinWithoutComments, /\.hsb-picker\s*\{\s*margin-top:\s*var\(--spacing-lg\);\s*margin-bottom:\s*0;/u);
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
    const exporter = await readFile(new URL('js/export/DitherPngExport.js', appRoot), 'utf8');

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
    assert.match(app, /DitherPngExport\.resolveScale\(this\.settings\)/u);
    assert.match(app, /DitherPngExport\.downloadCanvas\(exportCanvas\)/u);
    assert.match(exporter, /canvas\.toBlob\(blob =>/u);
    assert.match(exporter, /const FILENAME = 'dithered-image\.png';/u);
});

test('Dither panels use shared stacking behavior', () => {
    const manager = new AdapterPanelManager();
    const controls = {
        style: { zIndex: '999' },
        getBoundingClientRect: () => ({ width: 300, height: 400 })
    };
    const transform = {
        style: { zIndex: '999' },
        getBoundingClientRect: () => ({ width: 300, height: 300 })
    };
    manager.panels = new Map([
        ['controlsPanel', { element: controls }],
        ['transformPanel', { element: transform }]
    ]);

    manager.bringToFront('controlsPanel');
    assert.equal(controls.style.zIndex, 1001);
    assert.equal(transform.style.zIndex, '999');
});

test('Dither panels use shared viewport-clamped drag behavior', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { innerWidth: 1280, innerHeight: 720 };
    const manager = new AdapterPanelManager();
    const controls = {
        style: {},
        getBoundingClientRect: () => ({ width: 300, height: 400 })
    };

    const calls = [];
    manager.panels = new Map([['controlsPanel', { element: controls }]]);
    manager.setPosition = (...args) => calls.push(args);
    manager.dragState = {
        isDragging: true,
        panel: 'controlsPanel',
        startX: 200,
        startY: 100,
        initialX: 960,
        initialY: 20
    };

    try {
        manager.onDragging({ clientX: -40, clientY: 900 });
        assert.deepEqual(calls, [['controlsPanel', 720, 320]]);
    } finally {
        globalThis.window = previousWindow;
    }
});
