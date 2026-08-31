import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    PanelManager,
    SliderController
} from '../../framework/src/index.js';

const appRoot = new URL('../', import.meta.url);

test('Pulsar Coder reaches shared UI behavior through one public-barrel facade', async () => {
    const [adapter, main] = await Promise.all([
        readFile(new URL('js/framework/FrameworkAdapter.js', appRoot), 'utf8'),
        readFile(new URL('pulsar-main.js', appRoot), 'utf8')
    ]);

    assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/framework\/src\/index\.js';/u);
    assert.match(
        adapter,
        /sharedCapabilities: Object\.freeze\(\[\s*'PanelManager',\s*'SliderController'/u
    );
    assert.match(main, /from '\.\/js\/framework\/FrameworkAdapter\.js';/u);
    assert.match(main, /from '\.\/js\/ui\/ZoomPanManager\.js';/u);
    assert.doesNotMatch(main, /from '\.\/js\/ui\/(?:PanelManager|SliderController)\.js';/u);
    assert.match(main, /panelManager\.initCollapse\(\);/u);
    assert.doesNotMatch(
        main,
        /querySelectorAll\('\.collapse-icon'\)\.forEach/u,
        'Pulsar must not duplicate the shared collapse handler'
    );

    assert.equal(typeof PanelManager, 'function');
    assert.equal(typeof SliderController, 'function');

    for (const file of ['js/ui/PanelManager.js', 'js/ui/SliderController.js']) {
        await assert.rejects(
            access(new URL(file, appRoot)),
            error => error?.code === 'ENOENT'
        );
    }

    for (const example of ['examples/example.html', 'examples/minimal-template.html']) {
        const html = await readFile(new URL(example, appRoot), 'utf8');
        assert.match(html, /\.\.\/js\/framework\/FrameworkAdapter\.js/u);
        assert.doesNotMatch(html, /\.\.\/js\/ui\/(?:PanelManager|SliderController)\.js/u);
    }
});

test('Pulsar-specific zoom remains explicit private behavior', async () => {
    const [adapter, localZoom, sharedZoom] = await Promise.all([
        readFile(new URL('js/framework/FrameworkAdapter.js', appRoot), 'utf8'),
        readFile(new URL('js/ui/ZoomPanManager.js', appRoot), 'utf8'),
        readFile(new URL('../framework/src/ui/ZoomPanManager.js', appRoot), 'utf8')
    ]);

    assert.match(adapter, /'ZoomPanManager'/u);
    assert.notEqual(localZoom, sharedZoom);
});

test('shared CSS is layered below the frozen Pulsar skin', async () => {
    const [html, bridge, legacySkin, skin, sharedStyles] = await Promise.all([
        readFile(new URL('index.html', appRoot), 'utf8'),
        readFile(new URL('css/framework-base.css', appRoot), 'utf8'),
        readFile(new URL('css/yf-styles.css', appRoot), 'utf8'),
        readFile(new URL('pulsar-styles.css', appRoot), 'utf8'),
        readFile(new URL('../framework/css/othersite-styles.css', appRoot), 'utf8')
    ]);

    assert.match(
        bridge,
        /@import url\('\.\.\/\.\.\/framework\/css\/othersite-styles\.css\?v=g4-pulsar-1'\) layer\(framework\);/u
    );
    assert.ok(
        html.indexOf('css/framework-base.css') < html.indexOf('css/yf-styles.css'),
        'shared CSS must load before Pulsar compatibility CSS'
    );
    assert.match(html, /css\/yf-styles\.css\?v=g5-pulsar-range-1/u);
    assert.match(
        html,
        /<a href="\.\.\/" class="top-link" aria-label="Back to Upgrade Tools">←Upgrade Tools<\/a>/u
    );
    assert.doesNotMatch(html, /class="yf-tools-link"/u);
    assert.match(skin, /\.top-link\s*\{\s*padding: var\(--spacing-md\) var\(--spacing-3xl\);/u);
    assert.match(
        skin,
        /\.panel-header span:first-child\s*\{\s*font-size: 0\.9rem;\s*line-height: 1rem;/u
    );
    assert.doesNotMatch(
        legacySkin,
        /(?:^|\n)\.value-display(?::(?:focus|disabled))?\s*\{/u,
        'Pulsar must consume base value-display presentation from shared CSS'
    );
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
    assert.match(
        legacySkin,
        /Base range\/thumb\/track\/focus presentation comes from the shared framework\.[\s\S]*?\.control-group input\[type="range"\]\s*\{\s*margin-top: calc\(var\(--spacing-md\) - 2px\);\s*\}/u
    );
    assert.doesNotMatch(
        legacySkin,
        /\.control-group input\[type="range"\](?::focus)?::(?:-webkit-slider-thumb|-moz-range-thumb|-webkit-slider-runnable-track|-moz-range-track)/u,
        'Pulsar must consume active thumb, track, hover and focus presentation from shared CSS'
    );
    assert.match(
        sharedStyles,
        /\.control-group input\[type="range"\]\s*\{[\s\S]*?height: 10px;[\s\S]*?cursor: pointer;[\s\S]*?\}/u
    );
    assert.match(
        sharedStyles,
        /\.control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[\s\S]*?width: var\(--slider-thumb-size\);[\s\S]*?\}/u
    );
    assert.match(
        sharedStyles,
        /\.control-group input\[type="range"\]::-webkit-slider-thumb:hover\s*\{[\s\S]*?transform: scale\(1\.25\);[\s\S]*?\}/u
    );
    assert.match(
        sharedStyles,
        /\.control-group input\[type="range"\]:focus::-webkit-slider-thumb\s*\{[\s\S]*?box-shadow: 0 0 0 2px var\(--color-bg\), 0 0 0 4px var\(--color-text\);[\s\S]*?\}/u
    );
    assert.equal(
        [...html.matchAll(/<input\b[^>]*\btype="range"[^>]*>/gu)].length,
        8,
        'Pulsar range inventory must remain stable'
    );
});

test('unused byte-identical TT Commons copies stay centralized', async () => {
    for (const file of [
        'TT Commons Classic Medium.otf',
        'TT Commons Classic Regular.otf',
        'TT_Commons_Classic_Medium.woff2',
        'TT_Commons_Classic_Regular.woff2'
    ]) {
        await assert.rejects(
            access(new URL(`fonts/${file}`, appRoot)),
            error => error?.code === 'ENOENT'
        );
        await access(new URL(`../framework/fonts/${file}`, appRoot));
    }
});
