import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const [html, css] = await Promise.all([
    readFile(new URL('infra/framework/component-lab/index.html', root), 'utf8'),
    readFile(new URL('infra/framework/component-lab/styles.css', root), 'utf8')
]);

assert.match(html, /\.\.\/css\/othersite-styles\.css\?v=g6-choice-1/u);
assert.match(html, /\.\.\/css\/ui-contract\.css\?v=uiq-4/u);
assert.ok(html.lastIndexOf('ui-contract.css') > html.lastIndexOf('./styles.css'), 'Lab must use the same final CSS layer as the applications');
assert.match(html, /<h3 class="control-field-heading"/u);
assert.match(html, /<div class="control-field-heading"/u);
for (const state of ['normal', 'hover', 'focus', 'disabled', 'loading', 'error']) {
    assert.match(html, new RegExp(`data-state="${state}"`, 'u'), `Component Lab lost ${state}`);
}
for (const family of ['action-dock', 'segmented-control', 'toggle-switch', 'file-intake', 'controls-panel']) {
    assert.match(html, new RegExp(`class="[^"]*${family}`, 'u'), `Component Lab lost ${family}`);
}
assert.doesNotMatch(`${html}\n${css}`, /https?:\/\//u);

console.log('Component Lab passed: action, choice, intake and panel families expose normal/hover/focus/disabled/loading/error states.');
