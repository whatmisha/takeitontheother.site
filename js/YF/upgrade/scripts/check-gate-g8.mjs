import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const [plan, acceptance, gate] = await Promise.all([
    read('docs/G8_UI_CONTRACT_PLAN.md'),
    read('docs/G8_UI_ACCEPTANCE.md'),
    read('docs/GATE_G8.md')
]);

for (const stage of ['UPG-081', 'UPG-082', 'UPG-083', 'UPG-084', 'UPG-085']) {
    const section = plan.match(new RegExp(`### ${stage}[\\s\\S]*?(?=\\n### |\\n## |$)`, 'u'))?.[0] || '';
    assert.match(section, /Статус: \*\*Complete\*\*/u, `${stage} is not complete`);
}

assert.match(acceptance, /восемь live entrypoints/u);
assert.match(acceptance, /390×844/u);
assert.match(acceptance, /фиксированных 47 px/u);
assert.match(gate, /Статус: \*\*Passed\*\*/u);

console.log('Gate G8 contract passed: UPG-081—UPG-085 complete; 8 desktop tools and Sparky mobile accepted.');
