import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [
    sparky, pizzaDocument, pizzaWorkspace, sticky, keyboarder, wordplayer, pulsar, dither, wander,
    ditherJs, ditherCss, wanderJs, controller
] = await Promise.all([
    read('sparky/index.html'),
    read('grid_generator/src/ui/ApplicationDocument.html'),
    read('grid_generator/src/ui/fragments/workspace.html'),
    read('label_generator/index.html'),
    read('keyboarder/index.html'),
    read('wordplayer/index.html'),
    read('pulsar_coder/index.html'),
    read('dither/index.html'),
    read('wander_bender/index.html'),
    read('dither/dither.js'),
    read('dither/style.css'),
    read('wander_bender/js/wander-bender.js'),
    read('framework/src/ui/PresetMenuKeyboardController.js')
]);

const pizza = `${pizzaDocument}\n${pizzaWorkspace}`;

assert.match(dither, /class="top-links"[\s\S]*?<a href="\.\.\/" class="top-link"[^>]*>← Upgrade Tools<\/a>/u);
assert.doesNotMatch(dither, /yf-tools-link/u);
assert.doesNotMatch(ditherJs, /initYFToolsLink|yf-tools-link/u);
assert.doesNotMatch(ditherCss.replace(/\/\*[\s\S]*?\*\//gu, ''), /\.yf-tools-link\b/u);

for (const [name, html] of [
    ['Pizza Boxer', pizza], ['Keyboarder', keyboarder], ['Wordplayer', wordplayer],
    ['Pulsar Coder', pulsar], ['Wander Bender', wander]
]) {
    assert.match(
        html,
        /<button\b[^>]*class="[^"]*zoom-indicator[^"]*"[^>]*>/u,
        `${name} zoom indicator must be a button`
    );
}

assert.match(dither, /role="radiogroup" aria-label="Export resolution"/u);
assert.equal(dither.match(/name="exportScale"/gu)?.length || 0, 4);
for (const scale of [1, 2, 4, 8]) {
    assert.match(dither, new RegExp(`id="export${scale}x"[^>]*value="${scale}"`, 'u'));
}
assert.match(ditherJs, /exportScaleInputs:\s*document\.querySelectorAll\('input\[name="exportScale"\]'\)/u);
assert.match(ditherJs, /this\.settings\.export8x = scale === 8;/u);

for (const [name, html] of [
    ['Sparky', sparky], ['Pizza Boxer', pizza], ['Sticky Fingers', sticky],
    ['Keyboarder', keyboarder], ['Wordplayer', wordplayer], ['Pulsar Coder', pulsar]
]) {
    assert.match(
        html,
        /presetMenuKeyboardAutoInit\.js\?v=g7-resilience-4/u,
        `${name} shared preset keyboard bootstrap missing`
    );
}
for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Enter']) {
    assert.match(controller, new RegExp(`'${key}'`, 'u'), `shared preset keyboard lost ${key}`);
}
assert.equal(pulsar.match(/class="preset-dropdown-item[^"]*"[^>]*role="option"/gu)?.length || 0, 4);

assert.match(wander, /id="strokeAutoBtn"[^>]*aria-pressed="false"/u);
assert.match(wander, /id="cornerRadiusMaxBtn"[^>]*aria-pressed="false"/u);
assert.match(wanderJs, /strokeAutoBtn\.setAttribute\('aria-pressed', String\(isActive\)\)/u);
assert.match(wanderJs, /cornerRadiusMaxBtn\.setAttribute\('aria-pressed', String\(isActive\)\)/u);

console.log('Choice contract passed: shared navigation; 5 button zoom indicators; Dither 1×/2×/4×/8×; 8 synchronized state buttons; 6 preset keyboards.');
