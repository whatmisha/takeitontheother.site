import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relativePath => readFile(new URL(relativePath, root), 'utf8');
const [plan, acceptance, gate] = await Promise.all([
    read('docs/G12_OPENTYPE_FEATURES.md'),
    read('docs/G12_UI_ACCEPTANCE.md'),
    read('docs/GATE_G12.md')
]);

assert.match(plan, /## UPG-094[\s\S]*?Статус: \*\*Complete\*\*/u);
assert.match(plan, /## UPG-096[\s\S]*?Статус: \*\*Complete\*\*/u);
assert.match(plan, /Objects → text object → Lunnen Display → OpenType/u);
assert.match(plan, /12\.8 px[\s\S]*?500[\s\S]*?24 px[\s\S]*?4×10 px/u);
assert.match(plan, /glyph substitution/u);
assert.match(acceptance, /Text \/ Text \/ Headline/u);
assert.match(acceptance, /salt \/ aalt \/ ss01/u);
assert.match(gate, /Статус: \*\*Passed\*\*/u);

console.log('Gate G12 contract passed: shared OpenType presentation and private typography behavior are accepted.');
