import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    ColorUtils as AdaptedColorUtils,
    FileIntakeController as AdaptedFileIntakeController,
    PIZZA_BOXER_FRAMEWORK_ADAPTER
} from '../src/framework/FrameworkAdapter.js';
import {
    ColorUtils as SharedColorUtils,
    FileIntakeController as SharedFileIntakeController
} from '../../framework/src/index.js';

test('Pizza Boxer consumes shared capabilities through one explicit adapter', async () => {
    assert.equal(AdaptedColorUtils, SharedColorUtils);
    assert.equal(AdaptedFileIntakeController, SharedFileIntakeController);
    assert.deepEqual(PIZZA_BOXER_FRAMEWORK_ADAPTER, {
        appId: 'pizza-boxer',
        mode: 'grid-application-adapter',
        sharedCapabilities: ['ColorUtils', 'FileIntakeController']
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
        '../src/ui/ColorPanelController.js',
        '../src/ui/ApplicationEventController.js',
        '../src/elements/GraphicsEditorEventController.js'
    ]) {
        assert.match(
            await readFile(new URL(source, import.meta.url), 'utf8'),
            /from '..\/framework\/FrameworkAdapter\.js';/u
        );
    }
});

test('Pizza Boxer layers shared CSS below its production compatibility skin', async () => {
    const baseStyles = await readFile(new URL('../styles/base.css', import.meta.url), 'utf8');
    const [
        html,
        bridge,
        workspace,
        typography,
        editors,
        template,
        panelStyles,
        controlsStyles,
        editorStyles,
        actionStyles,
        responsiveStyles,
        sideStyles,
        toolbarStyles,
        frameworkStyles
    ] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../framework-base.css', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/fragments/workspace.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/fragments/typography.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/fragments/object-editors.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/ApplicationDocument.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles/layout-panels.css', import.meta.url), 'utf8'),
        readFile(new URL('../styles/controls.css', import.meta.url), 'utf8'),
        readFile(new URL('../styles/editors.css', import.meta.url), 'utf8'),
        readFile(new URL('../styles/actions-modal.css', import.meta.url), 'utf8'),
        readFile(new URL('../styles/canvas-responsive.css', import.meta.url), 'utf8'),
        readFile(new URL('../styles/sides.css', import.meta.url), 'utf8'),
        readFile(new URL('../styles/toolbar.css', import.meta.url), 'utf8'),
        readFile(new URL('../../framework/css/othersite-styles.css', import.meta.url), 'utf8')
    ]);

    assert.doesNotMatch(baseStyles, /^\s*\*\s*\{/mu, 'Pizza must consume the shared universal reset');

    assert.match(
        bridge,
        /@import url\('\.\.\/framework\/css\/othersite-styles\.css\?v=g6-choice-1'\) layer\(framework\);/u
    );
    assert.doesNotMatch(bridge, /all:\s*revert-layer/u);
    assert.match(frameworkStyles, /\.top-link\s*\{\s*padding: var\(--spacing-md\) var\(--spacing-3xl\);/u);
    assert.match(
        bridge,
        /\.control-group:has\(\.checkbox-label\)\s*\{\s*margin-bottom:\s*var\(--spacing-xs\);\s*\}/u
    );
    assert.match(
        bridge,
        /\.control-group\.show-toggle-chip-group\s*\{\s*padding-top:\s*0;\s*margin-bottom:\s*var\(--spacing-md\);\s*\}/u
    );
    assert.match(
        bridge,
        /\.control-group \.toggle-chip input\[type="checkbox"\]\s*\{\s*width:\s*0;\s*height:\s*0;\s*\}/u
    );
    assert.match(
        bridge,
        /\.control-group \.segmented-control label\s*\{\s*margin-bottom:\s*0;\s*\}/u
    );
    assert.match(
        bridge,
        /\.control-group \.segmented-control input\[type="radio"\]:checked \+ label\s*\{\s*color:\s*var\(--color-bg\);\s*font-weight:\s*500;/u
    );
    assert.match(
        bridge,
        /\.segmented-control\s*\{\s*--segmented-control-font-size:\s*0\.85rem;\s*\}/u
    );
    assert.match(
        bridge,
        /\.preset-dropdown-toggle\s*\{[\s\S]*?padding:\s*var\(--spacing-md\) var\(--spacing-xl\) var\(--spacing-md\) var\(--spacing-3xl\);[\s\S]*?font-size:\s*0\.9rem;[\s\S]*?font-weight:\s*600;[\s\S]*?\}/u,
        'Pizza Boxer must preserve repository-view width metrics'
    );
    assert.match(
        workspace,
        /<a href="\.\.\/" class="top-link" aria-label="Back to Upgrade Tools">\s*←Upgrade Tools\s*<\/a>/u
    );
    assert.doesNotMatch(workspace, /class="yf-tools-link"/u);
    assert.match(workspace, /id="presetDropdownToggle" type="button"[\s\S]*?aria-controls="presetDropdownMenu"/u);
    assert.ok(
        template.indexOf('framework-base.css') < template.indexOf('../../style.css'),
        'source document must retain shared CSS before the application stylesheet'
    );
    assert.match(
        template,
        /href="\.\.\/\.\.\/framework-base\.css\?v=g6-choice-1"/u,
        'development document must resolve the bridge from src/ui'
    );
    const actionFragment = await readFile(new URL('../src/ui/fragments/actions.html', import.meta.url), 'utf8');
    assert.match(
        actionFragment,
        /action-dock__slot--utility[\s\S]*?id="exportSettingsBtn"[\s\S]*?id="importSettingsBtn"[\s\S]*?action-dock__slot--primary[\s\S]*?id="exportPDFBtn"[\s\S]*?id="exportBtn"[\s\S]*?action-dock__slot--options[\s\S]*?id="convertToOutlinesCheckbox"/u,
        'Pizza Boxer must separate setup utilities, primary exports and Outline in ActionDock'
    );
    assert.doesNotMatch(actionStyles, /\.export-group-right/u, 'retired centered-bar group must stay removed');
    assert.ok(
        html.indexOf('framework-base.css') < html.search(/PublicEntry-[^"/]+\.css/u),
        'shared CSS must load below the frozen Pizza Boxer production skin'
    );
    assert.match(
        html,
        /href="\.\/framework-base\.css\?v=[^"]+"/u,
        'public document must resolve the bridge from the project root'
    );
    assert.match(
        panelStyles,
        /\.panel-header span:first-child\s*\{[^}]*font-size:\s*0\.9rem;[^}]*line-height:\s*1rem;/su
    );
    const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//gu, '');
    assert.doesNotMatch(
        stripComments(toolbarStyles),
        /(?:^|\})\s*\.preset-dropdown(?:-toggle|-text|-arrow|-menu|-item)?(?:\s|:|\{)/u,
        'Pizza Boxer must not retain the preset dropdown component base'
    );
    assert.match(
        stripComments(toolbarStyles),
        /\.preset-dropdown-item\.preset-dropdown-divider\s*\{/u,
        'Pizza Boxer manifest divider remains a private view extension'
    );
    assert.doesNotMatch(
        stripComments(panelStyles),
        /(?:^|\})\s*\.toggle-chip(?:\s|:|\{)/u,
        'Pizza Boxer toggle-chip base must come from shared CSS'
    );
    assert.doesNotMatch(
        stripComments(editorStyles),
        /(?:^|\})\s*\.(?:checkbox-label|segmented-control)(?:\s|:|\{)/u,
        'Pizza Boxer checkbox and segmented bases must come from shared CSS'
    );
    assert.doesNotMatch(
        stripComments(actionStyles),
        /(?:^|\})\s*\.toggle-switch(?:\s|:|\{)/u,
        'Pizza Boxer toggle-switch base must come from shared CSS'
    );
    assert.doesNotMatch(
        stripComments(editorStyles),
        /(?:^|\})\s*\.btn-fixed(?:\s|:|\{|,)/u,
        'Pizza Boxer must not retain the fixed-button base in editor styles'
    );
    assert.doesNotMatch(
        stripComments(actionStyles),
        /(?:^|\})\s*\.(?:bottom-buttons|btn-fixed|btn-export)(?:\s|:|\{|,)/u,
        'Pizza Boxer must retain only semantic action variants locally'
    );
    assert.doesNotMatch(
        stripComments(responsiveStyles),
        /(?:^|\})\s*\.(?:bottom-buttons|btn-fixed)(?:\s|:|\{|,)/u,
        'Pizza Boxer must not override the shared action shell responsively'
    );
    assert.match(sideStyles, /\.surface-tabs\.segmented-control label\s*\{/u);
    assert.match(sideStyles, /\.surface-quick-controls \.toggle-chip-group\s*\{/u);
    assert.match(frameworkStyles, /(?:^|\n)\.toggle-chip\s*\{/u);
    assert.match(frameworkStyles, /(?:^|\n)\.checkbox-label\s*\{/u);
    assert.match(frameworkStyles, /(?:^|\n)\.segmented-control\s*\{/u);
    assert.match(frameworkStyles, /(?:^|\n)\.toggle-switch\s*\{/u);
    assert.match(
        frameworkStyles,
        /(?:^|\n)\.value-display\s*\{[\s\S]*?font-variant-numeric: tabular-nums;[\s\S]*?\}/u
    );
    assert.match(
        frameworkStyles,
        /(?:^|\n)\.value-display:focus\s*\{[\s\S]*?color: var\(--color-text\);[\s\S]*?\}/u
    );
    assert.match(
        frameworkStyles,
        /(?:^|\n)\.value-display:disabled\s*\{[\s\S]*?opacity: 0\.4;[\s\S]*?cursor: default;[\s\S]*?\}/u
    );
    const controlsWithoutComments = controlsStyles.replace(/\/\*[\s\S]*?\*\//gu, '');
    const privateValueDisplaySelectors = Array.from(
        controlsWithoutComments.matchAll(/(?:^|\})\s*([^{}]*\.value-display(?![\w-])[^{}]*)\{/gu),
        match => match[1].trim()
    );
    assert.deepEqual(
        privateValueDisplaySelectors,
        ['.control-group label .value-display'],
        'Pizza Boxer must retain only its local flex-layout extension'
    );
    assert.equal(
        (workspace.match(/class="value-display(?!-)/gu)?.length || 0)
            + (typography.match(/class="value-display(?!-)/gu)?.length || 0)
            + (editors.match(/class="value-display(?!-)/gu)?.length || 0),
        38,
        'Pizza Boxer value-display inventory changed'
    );
    assert.equal(
        (workspace.match(/<input\b[^>]*\btype="range"[^>]*>/gu)?.length || 0)
            + (typography.match(/<input\b[^>]*\btype="range"[^>]*>/gu)?.length || 0)
            + (editors.match(/<input\b[^>]*\btype="range"[^>]*>/gu)?.length || 0),
        29,
        'Pizza Boxer range inventory changed'
    );
    assert.match(
        controlsWithoutComments,
        /\.control-group input\[type="range"\]\s*\{\s*margin-top: calc\(var\(--spacing-md\) - 2px\);\s*margin-bottom: 0;\s*\}/u,
        'Pizza Boxer must preserve its compact ordinary range rhythm'
    );
    assert.match(
        controlsWithoutComments,
        /\.hsb-picker\s*\{\s*margin-top:\s*var\(--spacing-lg\);\s*margin-bottom:\s*0;/u
    );
    assert.doesNotMatch(
        controlsWithoutComments,
        /\.control-group input\[type="range"\](?::focus)?::(?:-webkit-slider-thumb|-moz-range-thumb|-webkit-slider-runnable-track|-moz-range-track)/u,
        'Pizza Boxer ordinary thumb, track, hover and focus must come from shared CSS'
    );
    assert.match(
        frameworkStyles,
        /\.control-group input\[type="range"\]::-webkit-slider-thumb:hover\s*\{[\s\S]*?transform: scale\(1\.25\);[\s\S]*?\}/u
    );
    assert.match(
        frameworkStyles,
        /\.control-group input\[type="range"\]:focus::-webkit-slider-thumb\s*\{[\s\S]*?box-shadow: 0 0 0 2px var\(--color-bg\), 0 0 0 4px var\(--color-text\);[\s\S]*?\}/u
    );
    assert.match(
        controlsWithoutComments,
        /\.hsb-control-group input\[type="range"\]::-webkit-slider-thumb\s*\{[\s\S]*?width: var\(--slider-thumb-size\);[\s\S]*?height: var\(--slider-thumb-size\);[\s\S]*?\}/u,
        'Pizza Boxer private 8 px HSB thumb must remain application-owned'
    );
    assert.match(controlsWithoutComments, /#hueSlider::-webkit-slider-runnable-track\s*\{/u);
    assert.doesNotMatch(html, /(?:src|href)="https?:\/\//u);
});
