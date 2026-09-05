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
assert.doesNotMatch(contractCss, /\b(?:600|700|800|900|bold)\b/u);
assert.doesNotMatch(contractCss, /Arial|TT Commons|CoFo Sans/u);

entrypoints.forEach((html, index) => {
    const app = applications[index];
    assert.match(html, /framework\/css\/ui-contract\.css\?v=g8-ui-1/u, `${app}: missing final UI CSS`);
    assert.match(html, /framework\/src\/ui\/unifiedUiAutoInit\.js\?v=g8-ui-1/u, `${app}: missing shared UI controller`);
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

const [ditherHtml, keyboarderSource, wordplayerSource] = await Promise.all([
    read('dither/index.html'),
    read('keyboarder/app/tool.js'),
    read('wordplayer/src/ui/controls.js')
]);
assert.doesNotMatch(ditherHtml, /How it Works|Show instructions/u);
assert.doesNotMatch(keyboarderSource, /getElementById\('aboutBtn'\).*addEventListener/u);
assert.doesNotMatch(wordplayerSource, /getElementById\('introHelpBtn'\).*addEventListener/u);

console.log('G8 UI contract passed: 8 entrypoints, system typography, fixed summaries, shortcuts and export feedback are wired.');
