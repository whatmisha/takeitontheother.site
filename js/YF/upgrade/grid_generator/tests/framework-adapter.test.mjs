import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    ColorUtils as AdaptedColorUtils,
    PIZZA_BOXER_FRAMEWORK_ADAPTER
} from '../src/framework/FrameworkAdapter.js';
import { ColorUtils as SharedColorUtils } from '../../framework/src/index.js';

test('Pizza Boxer consumes shared capabilities through one explicit adapter', async () => {
    assert.equal(AdaptedColorUtils, SharedColorUtils);
    assert.deepEqual(PIZZA_BOXER_FRAMEWORK_ADAPTER, {
        appId: 'pizza-boxer',
        mode: 'grid-application-adapter',
        sharedCapabilities: ['ColorUtils']
    });
    assert.equal(Object.isFrozen(PIZZA_BOXER_FRAMEWORK_ADAPTER), true);
    assert.equal(Object.isFrozen(PIZZA_BOXER_FRAMEWORK_ADAPTER.sharedCapabilities), true);

    await assert.rejects(
        access(new URL('../src/utils/ColorUtils.js', import.meta.url)),
        error => error?.code === 'ENOENT'
    );
    for (const source of [
        '../src/grid/CanvasRendererController.js',
        '../src/grid/GridRenderer.js',
        '../src/ui/ColorPanelController.js'
    ]) {
        assert.match(
            await readFile(new URL(source, import.meta.url), 'utf8'),
            /from '..\/framework\/FrameworkAdapter\.js';/u
        );
    }
});

test('Pizza Boxer layers shared CSS below its production compatibility skin', async () => {
    const [html, bridge, workspace, template, panelStyles] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../framework-base.css', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/fragments/workspace.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/ApplicationDocument.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles/layout-panels.css', import.meta.url), 'utf8')
    ]);

    assert.match(
        bridge,
        /@import url\('\.\.\/framework\/css\/othersite-styles\.css\?v=g5-pizza-2'\) layer\(framework\);/u
    );
    assert.match(bridge, /\.top-link\s*\{\s*padding: var\(--spacing-md\) var\(--spacing-3xl\);/u);
    assert.match(bridge, /\.btn-fixed\s*\{\s*font-family: Arial;/u);
    assert.match(
        workspace,
        /<a href="\.\.\/" class="top-link" aria-label="Back to Upgrade Tools">\s*←Upgrade Tools\s*<\/a>/u
    );
    assert.doesNotMatch(workspace, /class="yf-tools-link"/u);
    assert.ok(
        template.indexOf('framework-base.css') < template.indexOf('../../style.css'),
        'source document must retain shared CSS before the application stylesheet'
    );
    assert.ok(
        html.indexOf('framework-base.css') < html.search(/PublicEntry-[^"/]+\.css/u),
        'shared CSS must load below the frozen Pizza Boxer production skin'
    );
    assert.match(
        panelStyles,
        /\.panel-header span:first-child\s*\{[^}]*font-size:\s*0\.9rem;[^}]*line-height:\s*1rem;/su
    );
    assert.doesNotMatch(html, /(?:src|href)="https?:\/\//u);
});
