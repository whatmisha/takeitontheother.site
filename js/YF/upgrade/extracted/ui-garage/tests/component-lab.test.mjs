import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('Component Lab owns every required visual state and family', async () => {
    const contract = JSON.parse(await readFile(path.join(root, 'component-lab/COMPONENT_STATES.json'), 'utf8'));
    const html = await readFile(path.join(root, 'component-lab/index.html'), 'utf8');
    const requiredStates = ['normal', 'hover', 'focus', 'active', 'selected', 'disabled', 'readonly', 'loading', 'success', 'warning', 'error', 'open', 'closed', 'collapsed', 'mobile', 'reduced-motion'];
    const requiredFamilies = ['panel', 'range', 'choice', 'color', 'preset', 'navigation', 'action', 'dialog', 'status', 'file-intake'];
    assert.deepEqual(contract.states, requiredStates);
    assert.deepEqual(contract.families.map(family => family.name), requiredFamilies);
    for (const state of requiredStates) {
        assert.ok(html.includes(`data-state="${state}"`) || html.includes(`panel-${state}`), `Component Lab does not render ${state}`);
    }
});

test('Component Lab and visual smoke use only portable public resources', async () => {
    const html = await readFile(path.join(root, 'component-lab/index.html'), 'utf8');
    const lab = await readFile(path.join(root, 'component-lab/lab.js'), 'utf8');
    const smoke = await readFile(path.join(root, 'tests/visual-contract/smoke.js'), 'utf8');
    assert.match(html, /\.\.\/css\/framework\.css/u);
    assert.match(html, /\.\.\/css\/ui-contract\.css/u);
    assert.match(lab, /from '\.\.\/src\/index\.js'/u);
    assert.doesNotMatch(lab, /src\/(?:core|ui|render|history|preset|export)\//u);
    assert.doesNotMatch(`${html}\n${lab}\n${smoke}`, /https?:\/\//u);
    for (const marker of ['keyboardWalkthrough', "dispatchShortcut(win, '\\\\'", "dispatchShortcut(win, '?'"] ) {
        assert.ok(smoke.includes(marker), `Visual smoke is missing ${marker}`);
    }
});
