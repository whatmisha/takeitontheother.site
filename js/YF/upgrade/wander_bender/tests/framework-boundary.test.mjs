import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    SliderController as AdaptedSliderController,
    WANDER_FRAMEWORK_ADAPTER,
    WanderPanelManager
} from '../js/framework/FrameworkAdapter.js';
import { PanelManager, SliderController } from '../../framework/src/index.js';

const appRoot = new URL('../', import.meta.url);

test('Wander reaches shared panels and sliders through one public-barrel facade', async () => {
    const [adapter, app] = await Promise.all([
        readFile(new URL('js/framework/FrameworkAdapter.js', appRoot), 'utf8'),
        readFile(new URL('js/wander-bender.js', appRoot), 'utf8')
    ]);

    assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/framework\/src\/index\.js';/u);
    assert.deepEqual(WANDER_FRAMEWORK_ADAPTER.sharedCapabilities, [
        'PanelManager',
        'SliderController'
    ]);
    assert.ok(new WanderPanelManager() instanceof PanelManager);
    assert.equal(AdaptedSliderController, SliderController);

    assert.match(app, /from '\.\/framework\/FrameworkAdapter\.js';/u);
    assert.match(app, /from '\.\/ui\/ZoomPanManager\.js';/u);
    assert.match(app, /new WanderPanelManager\(\)/u);
    assert.match(app, /panelManager\.initCollapse\(\);/u);
    assert.doesNotMatch(app, /from '\.\/ui\/(?:PanelManager|SliderController)\.js';/u);

    for (const file of [
        'js/ui/PanelManager.js',
        'js/ui/SliderController.js',
        'js/ui/ColorPicker.js',
        'js/utils/ColorUtils.js',
        'js/utils/DOMUtils.js',
        'js/utils/MathUtils.js'
    ]) {
        await assert.rejects(
            access(new URL(file, appRoot)),
            error => error?.code === 'ENOENT'
        );
    }
});

test('Wander-specific zoom remains explicit private behavior', async () => {
    const [localZoom, sharedZoom] = await Promise.all([
        readFile(new URL('js/ui/ZoomPanManager.js', appRoot), 'utf8'),
        readFile(new URL('../framework/src/ui/ZoomPanManager.js', appRoot), 'utf8')
    ]);

    assert.notEqual(localZoom, sharedZoom);
    assert.match(localZoom, /paddingHorizontal = 360/u);
    assert.match(localZoom, /this\.minZoom = 1\.0/u);
});

test('shared CSS is layered below the frozen Wander skin', async () => {
    const [html, bridge, legacySkin, skin, sharedStyles] = await Promise.all([
        readFile(new URL('index.html', appRoot), 'utf8'),
        readFile(new URL('css/framework-base.css', appRoot), 'utf8'),
        readFile(new URL('css/yf-styles.css', appRoot), 'utf8'),
        readFile(new URL('css/wander-bender.css', appRoot), 'utf8'),
        readFile(new URL('../framework/css/othersite-styles.css', appRoot), 'utf8')
    ]);

    assert.match(
        bridge,
        /@import url\('\.\.\/\.\.\/framework\/css\/othersite-styles\.css\?v=g4-wander-1'\) layer\(framework\);/u
    );
    assert.ok(
        html.indexOf('framework-base.css') < html.indexOf('yf-styles.css') &&
        html.indexOf('yf-styles.css') < html.indexOf('wander-bender.css'),
        'shared CSS must load before the two frozen Wander stylesheets'
    );
    assert.match(html, /css\/yf-styles\.css\?v=g5-wander-range-1/u);
    assert.match(html, /css\/wander-bender\.css\?v=g5-wander-value-1/u);
    assert.match(
        html,
        /<a href="\.\.\/" class="top-link" aria-label="Back to Upgrade Tools">←Upgrade Tools<\/a>/u
    );
    assert.doesNotMatch(html, /class="yf-tools-link"/u);
    assert.match(skin, /Shared-framework parity bridge/u);
    assert.match(skin, /\.controls-panel\s*\{\s*max-height: none;/u);
    assert.match(skin, /\.top-link\s*\{\s*padding: var\(--spacing-md\) var\(--spacing-3xl\);/u);
    assert.match(
        skin,
        /\.panel-header span:first-child\s*\{\s*font-size: 0\.9rem;\s*line-height: 1rem;/u
    );
    assert.doesNotMatch(
        legacySkin,
        /(?:^|\n)\.value-display\s*\{/u,
        'Wander must consume base value-display presentation from shared CSS'
    );
    assert.doesNotMatch(skin, /(?:^|\n)\.value-display\s*\{/u);
    assert.match(
        skin,
        /\.value-display:disabled\s*\{\s*opacity: 0\.3;\s*cursor: not-allowed;/u
    );
    assert.match(
        sharedStyles,
        /(?:^|\n)\.value-display\s*\{[\s\S]*?font-variant-numeric: tabular-nums;[\s\S]*?\}/u
    );
    assert.match(skin, /input\[type="range"\]:disabled\s*\{\s*opacity: 1;/u);
    assert.match(
        legacySkin,
        /Base range\/thumb\/track\/focus presentation comes from the shared framework\.[\s\S]*?\.control-group input\[type="range"\]\s*\{\s*margin-top: calc\(var\(--spacing-md\) - 2px\);\s*\}/u
    );
    assert.doesNotMatch(
        legacySkin,
        /\.control-group input\[type="range"\](?::focus)?::(?:-webkit-slider-thumb|-moz-range-thumb|-webkit-slider-runnable-track|-moz-range-track)/u,
        'Wander must consume active thumb, track, hover and focus presentation from shared CSS'
    );
    assert.match(
        sharedStyles,
        /\.control-group input\[type="range"\]::-webkit-slider-thumb:hover\s*\{[\s\S]*?transform: scale\(1\.25\);[\s\S]*?\}/u
    );
    assert.match(
        sharedStyles,
        /\.control-group input\[type="range"\]:focus::-webkit-slider-thumb\s*\{[\s\S]*?box-shadow: 0 0 0 2px var\(--color-bg\), 0 0 0 4px var\(--color-text\);[\s\S]*?\}/u
    );
    assert.match(
        skin,
        /\.control-group input\[type="range"\]:disabled\s*\{\s*opacity: 1;\s*cursor: pointer;\s*\}/u,
        'Wander Auto/Max disabled range presentation must stay private'
    );
    assert.equal(
        [...html.matchAll(/<input\b[^>]*\btype="range"[^>]*>/gu)].length,
        19,
        'Wander range inventory must remain stable'
    );
});

test('Paper.js is local and donor Pattern never enters the active runtime', async () => {
    const html = await readFile(new URL('index.html', appRoot), 'utf8');

    assert.match(html, /\.\.\/framework\/vendor\/paper\/0\.12\.17\/paper-full\.min\.js/u);
    assert.doesNotMatch(html, /(?:src|href)="https?:\/\//u);
    await access(new URL('../framework/vendor/paper/0.12.17/paper-full.min.js', appRoot));
    await assert.rejects(
        access(new URL('pattern', appRoot)),
        error => error?.code === 'ENOENT'
    );
});

test('Wander panel drag keeps the legacy position write', () => {
    const manager = new WanderPanelManager();
    const element = {
        style: {
            left: '',
            top: '',
            right: '20px',
            bottom: '',
            transform: 'translateX(3px)'
        }
    };
    manager.panels.set('controlsPanel', {
        element,
        position: { x: 0, y: 0 }
    });

    manager.setPosition('controlsPanel', 640, -25);

    assert.deepEqual(manager.getPosition('controlsPanel'), { x: 640, y: -25 });
    assert.equal(element.style.left, '640px');
    assert.equal(element.style.top, '-25px');
    assert.equal(element.style.right, 'auto');
    assert.equal(element.style.bottom, 'auto');
    assert.equal(element.style.transform, 'translateX(3px)');
});
