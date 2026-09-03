import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [plan, gate, browser, manifest, lab] = await Promise.all([
    read('docs/G6_INTERFACE_UNIFICATION_PLAN.md'),
    read('docs/GATE_G6.md'),
    read('docs/BROWSER_ACCEPTANCE.md'),
    read('APPLICATION_CAPABILITIES.json'),
    read('framework/component-lab/index.html')
]);

for (const stage of ['UPG-060', 'UPG-061', 'UPG-062', 'UPG-063', 'UPG-064']) {
    const section = plan.match(new RegExp(`### ${stage}[\\s\\S]*?(?=\\n### |\\n## |$)`, 'u'))?.[0] || '';
    assert.match(section, /статус: \*\*Complete\*\*/u, `${stage} is not complete`);
}
assert.match(plan, /Intentional visual diffs G6 относительно G5/u);
assert.match(gate, /Status: \*\*Complete\*\*/u);
assert.match(gate, /55\/55/u);
assert.match(browser, /centered ActionDock/u);
assert.match(browser, /1b4c210c87d08f9b628d8f1fd8c146b3258544c82c1bef41822f4178abc7ff9e/u);
assert.match(browser, /390×844/u);
assert.equal(JSON.parse(manifest).applications.length, 8);
assert.equal(lab.match(/data-state="(?:normal|hover|focus|disabled|loading|error)"/gu)?.length || 0, 6);

console.log('Gate G6 contract passed: UPG-060—UPG-064 complete; intentional diffs documented; browser, isolation and component evidence recorded.');
