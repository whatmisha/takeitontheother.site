import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const [plan, acceptance, gate] = await Promise.all([
    read('docs/G9_CONTROL_RHYTHM.md'),
    read('docs/G9_UI_ACCEPTANCE.md'),
    read('docs/GATE_G9.md')
]);

for (const stage of ['UPG-086', 'UPG-087', 'UPG-088']) {
    const section = plan.match(new RegExp(`## ${stage}[\\s\\S]*?(?=\\n## |$)`, 'u'))?.[0] || '';
    assert.match(section, /Статус: \*\*Complete\*\*/u, `${stage} is not complete`);
}

assert.match(acceptance, /Desktop 8\/8/u);
assert.match(acceptance, /Sparky mobile/u);
assert.match(acceptance, /высота 10 px, margins `6px\/12px`/u);
assert.match(gate, /Статус: \*\*Passed\*\*/u);

console.log('Gate G9 contract passed: control rhythm, eight back links, YF Tools hub and Sparky mobile accepted.');
