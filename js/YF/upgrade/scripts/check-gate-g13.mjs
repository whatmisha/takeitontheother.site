import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const [plan, acceptance, gate, controller, stickyHtml, stickyScript, wanderHtml, pizzaDropdown] = await Promise.all([
    read('docs/G13_UI_REPAIR.md'),
    read('docs/G13_UI_ACCEPTANCE.md'),
    read('docs/GATE_G13.md'),
    read('framework/src/ui/UnifiedUiController.js'),
    read('label_generator/index.html'),
    read('label_generator/script.js'),
    read('wander_bender/index.html'),
    read('grid_generator/src/preset/PresetDropdownView.js')
]);

for (const id of ['UPG-098', 'UPG-099', 'UPG-100']) {
    assert.match(plan, new RegExp(`## ${id}[\\s\\S]*?Статус: \\*\\*Complete\\*\\*`, 'u'));
}
assert.match(controller, /indicator\.textContent = 'Fit'/u);
assert.doesNotMatch(controller, /Fit \/ actual size|⌘0 \/ ⌘1/u);
assert.equal(stickyHtml.match(/id="(?:hue|saturation|brightness|contentHue|contentSaturation|contentBrightness)Slider"/gu)?.length || 0, 6);
assert.match(stickyScript, /slider\.type = 'range'/u);
assert.equal(wanderHtml.match(/class="control-field-heading"/gu)?.length || 0, 2);
const openMethod = pizzaDropdown.match(/open\(\)\s*\{[\s\S]*?\n    \}/u)?.[0] || '';
assert.doesNotMatch(openMethod, /style\.width/u);
assert.match(acceptance, /custom[\s\S]*?column[\s\S]*?30\.00[\s\S]*?35\.00/u);
assert.match(gate, /Статус: \*\*Passed\*\*/u);

console.log('Gate G13 contract passed: zoom, Pizza, Sticky and Wander UI repairs are accepted.');
