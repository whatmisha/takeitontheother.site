import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const applications = [
    'sparky',
    'grid_generator',
    'label_generator',
    'keyboarder',
    'wordplayer',
    'dither',
    'pulsar_coder',
    'wander_bender'
];
const read = relative => readFile(new URL(relative, root), 'utf8');
const [contractCss, controller, plan, ...entrypoints] = await Promise.all([
    read('framework/css/ui-contract.css'),
    read('framework/src/ui/UnifiedUiController.js'),
    read('docs/G8_UI_CONTRACT_PLAN.md'),
    ...applications.map(app => read(`${app}/index.html`))
]);

assert.match(contractCss, /--ui-font-stack:\s*-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif/u);
assert.match(contractCss, /--ui-foreground:\s*#d2d2d2/u);
assert.match(contractCss, /--ui-panel-collapsed-height:\s*47px/u);
assert.match(contractCss, /text-overflow:\s*ellipsis/u);
assert.match(contractCss, /\.controls-panel\.panel-collapsed[\s\S]*?height:\s*var\(--ui-panel-collapsed-height\)\s*!important/u);
assert.match(contractCss, /\.controls-panel \.control-group > input\[type="range"\][\s\S]*?height:\s*10px\s*!important[\s\S]*?margin-top:\s*6px\s*!important[\s\S]*?margin-bottom:\s*12px\s*!important/u);
assert.match(contractCss, /\.controls-panel \.segmented-control label[\s\S]*?height:\s*30px[\s\S]*?white-space:\s*nowrap/u);
assert.match(contractCss, /\.controls-panel,[\s\S]*?color:\s*var\(--ui-foreground\)\s*!important/u);
assert.match(contractCss, /\.controls-panel \.control-group:not\(\[data-ui-custom-spacing\]\)[\s\S]*?padding-top:\s*0\s*!important/u);
assert.match(contractCss, /\.controls-panel \.pill-toggle:has\(input:checked:not\(:disabled\)\)[\s\S]*?background:\s*var\(--ui-foreground\)\s*!important/u);
assert.doesNotMatch(contractCss, /\b(?:600|700|800|900|bold)\b/u);
assert.doesNotMatch(contractCss, /Arial|TT Commons|CoFo Sans/u);

entrypoints.forEach((html, index) => {
    const app = applications[index];
    assert.match(html, /framework\/css\/ui-contract\.css\?v=g10-toggle-2/u, `${app}: missing final UI CSS`);
    assert.match(html, /framework\/src\/ui\/unifiedUiAutoInit\.js\?v=g8-ui-1/u, `${app}: missing shared UI controller`);
    if (app !== 'grid_generator') {
        assert.match(html, /←\s+Upgrade Tools/u, `${app}: back link needs a readable arrow gap`);
    }
    assert.ok(
        html.lastIndexOf('ui-contract.css') > html.lastIndexOf('framework-base.css')
            || html.lastIndexOf('ui-contract.css') > html.lastIndexOf('othersite-styles.css'),
        `${app}: UI contract must load after the application framework stylesheet`
    );
});

assert.match(controller, /key === '\\\\'/u);
assert.match(controller, /this\.expandedPanels = panels/u);
assert.match(controller, /dataExportFeedbackState|exportFeedbackState/u);
assert.match(controller, /\.paragraph-settings-panel, #paragraphPanel, #graphicsPanel/u);
assert.match(controller, /if \(target\.textContent !== summary\)/u);
assert.match(controller, /\(\?:mm\|keys\?\)/u);
assert.match(controller, /Number\(target\?\.scrollWidth\) > Number\(target\?\.clientWidth\)/u);
assert.match(controller, /mainFileTrigger\(\)/u);
assert.match(plan, /никогда не меняет габариты панели/u);

const hub = await read('index.html');
const pizzaNavigation = await read('grid_generator/src/ui/fragments/workspace.html');
assert.match(pizzaNavigation, /←\s+Upgrade Tools/u, 'grid_generator: back link needs a readable arrow gap');
assert.match(hub, /<title>YF Tools<\/title>/u);
assert.match(hub, /<h1>YF Tools<\/h1>/u);
assert.match(hub, /<h2 id="lunnen-heading">Lunnen<\/h2>/u);
assert.match(hub, /<h2 id="muted-heading">Muted<\/h2>/u);
for (const name of [
    'Hyperspace', 'Pattern 01', 'Pattern 02', 'Random Lines',
    'Rays Pattern', 'Asterisk Pattern', 'Calendar Randomizer', 'Chladni Sound Pattern'
]) {
    assert.match(hub, new RegExp(`<span class="tool-placeholder">${name}<\\/span>`, 'u'));
    assert.doesNotMatch(hub, new RegExp(`<a[^>]*>${name}<\\/a>`, 'u'));
}

const [ditherHtml, keyboarderSource, wordplayerSource] = await Promise.all([
    read('dither/index.html'),
    read('keyboarder/app/tool.js'),
    read('wordplayer/src/ui/controls.js')
]);
assert.doesNotMatch(ditherHtml, /How it Works|Show instructions/u);
assert.doesNotMatch(keyboarderSource, /getElementById\('aboutBtn'\).*addEventListener/u);
assert.doesNotMatch(wordplayerSource, /getElementById\('introHelpBtn'\).*addEventListener/u);

const [wordplayerHtml, keyboarderCss, stickyHtml] = await Promise.all([
    read('wordplayer/index.html'),
    read('keyboarder/app/theme.css'),
    read('label_generator/index.html')
]);
assert.match(wordplayerHtml, /class="control-group pill-toggle-row pixel-toggle-row" data-ui-custom-spacing/u);
assert.doesNotMatch(keyboarderCss, /#layersPanel\s+\.pill-toggle(?:-row)?/u);
for (const html of [pizzaNavigation, stickyHtml]) {
    for (const id of ['showColumns', 'showRows', 'showBaseline']) {
        assert.match(
            html,
            new RegExp(`<label class="pill-toggle" for="${id}">[\\s\\S]*?<input[^>]*id="${id}"[^>]*class="sr-only"`, 'u')
        );
    }
}
const pizzaGridToggleBlock = pizzaNavigation.match(/aria-label="Show grid options"[\s\S]*?<\/div>/u)?.[0] || '';
assert.doesNotMatch(pizzaGridToggleBlock, /toggle-chip|<svg/u);

console.log('G8 UI contract passed: 8 entrypoints, system typography, fixed summaries, shortcuts and export feedback are wired.');
