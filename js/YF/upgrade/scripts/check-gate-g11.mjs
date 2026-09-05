import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const [plan, acceptance, gate] = await Promise.all([
    read('docs/G11_CONTROL_CONSOLIDATION.md'),
    read('docs/G11_UI_ACCEPTANCE.md'),
    read('docs/GATE_G11.md')
]);

for (const stage of ['UPG-092', 'UPG-093']) {
    const section = plan.match(new RegExp(`## ${stage}[\\s\\S]*?(?=\\n## |$)`, 'u'))?.[0] || '';
    assert.match(section, /Статус: \*\*Complete\*\*/u, `${stage} is not complete`);
}

const openType = plan.match(/## UPG-094[\s\S]*?(?=\n## |$)/u)?.[0] || '';
assert.match(openType, /Статус: \*\*Deferred by design\*\*/u);
assert.match(openType, /glyph substitution\/metrics/u);
assert.match(acceptance, /Static · Follow.*Static · Fixed.*Static · Follow/u);
assert.match(acceptance, /Все 13 color triggers/u);
assert.match(acceptance, /Position X 25[\s\S]*?возвращается в 0/u);
assert.match(gate, /Статус: \*\*Passed\*\*/u);

console.log('Gate G11 contract passed: controls, swatches, Reset and Sparky Follow cursor are accepted.');
