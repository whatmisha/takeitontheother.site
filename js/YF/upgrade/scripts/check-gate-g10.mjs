import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const [audit, acceptance, gate] = await Promise.all([
    read('docs/G10_UI_VARIANCE_AUDIT.md'),
    read('docs/G10_UI_ACCEPTANCE.md'),
    read('docs/GATE_G10.md')
]);

for (const stage of ['UPG-089', 'UPG-090']) {
    const section = audit.match(new RegExp(`### ${stage}[\\s\\S]*?(?=\\n### |\\n## |$)`, 'u'))?.[0] || '';
    assert.match(section, /Статус: \*\*Complete\*\*/u, `${stage} is not complete`);
}

assert.match(audit, /один checkbox\/pill `Follow cursor`/u);
assert.match(audit, /Keyboarder \/ Layers/u);
assert.match(acceptance, /horizontal overflow 0/u);
assert.match(acceptance, /24 px от separator/u);
assert.match(gate, /Статус: \*\*Passed\*\*/u);

console.log('Gate G10 contract passed: corrected controls and semantic variance audit are accepted.');
