import assert from 'node:assert/strict';
import { buildLayout } from '../app/kb/grid.js';
import { LAYOUTS, LCAKB23 } from '../app/kb/layouts.js';
import { attachContent } from '../app/kb/legends.js';
import CONTENT from '../app/kb/content/lcakb23.js';
import { generatedContentForLayout } from '../app/kb/content/generated-layouts.js';

const TYPE_DEFAULTS = {
    glyphSize: 15.1999,
    numpadSize: 13.1732,
    secondarySize: 12.0745,
    wordSize: 9.1199
};

const iconGroups = CONTENT.keys.flatMap((key) => key.elements || [])
    .filter((element) => element.kind === 'ico')
    .reduce((acc, element) => {
        acc[element.group] = (acc[element.group] || 0) + 1;
        return acc;
    }, {});
assert.deepEqual(iconGroups, { 'f-icons': 13, icons: 15 });

for (const [name, layout] of Object.entries(LAYOUTS)) {
    if (name === LCAKB23.meta.name) continue;
    const { keys } = buildLayout(layout);
    const content = generatedContentForLayout(layout, TYPE_DEFAULTS, CONTENT);
    const result = attachContent(keys, content);
    assert.equal(result.matched, keys.length, `${name}: every key should receive generated content`);
    assert.equal(result.orphans, 0, `${name}: generated content should not have orphan keys`);
    assert.equal(keys.filter((k) => !(k.elements || []).length).length, 0, `${name}: no blank generated keys`);
}

console.log('generated layout content passed');
