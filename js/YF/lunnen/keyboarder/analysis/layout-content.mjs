import assert from 'node:assert/strict';
import { buildLayout } from '../app/kb/grid.js';
import { LAYOUTS, LCAKB23 } from '../app/kb/layouts.js';
import { attachContent } from '../app/kb/legends.js';
import CONTENT from '../app/kb/content/lcakb23.js';
import { generatedContentForLayout, generatedContentStatsForLayout } from '../app/kb/content/generated-layouts.js';

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

const idsRepeatLayout = {
    meta: { name: 'IDS_REPEAT' },
    grid: {
        origin: { x: 0, y: 0 },
        colPitch: 12,
        rowPitch: 12,
        keyWidth1U: 10,
        keyHeight: 10
    },
    blocks: [{ id: 'main', x: 0, width: 34 }],
    rows: [{ main: [{ u: 1, repeat: 3, ids: ['esc', 'f1', 'a'] }] }]
};
const idsRepeatKeys = buildLayout(idsRepeatLayout).keys;
assert.deepEqual(idsRepeatKeys.map((key) => key.id), ['esc', 'f1', 'a']);
const idsRepeatContent = generatedContentForLayout(idsRepeatLayout, TYPE_DEFAULTS, CONTENT);
assert.deepEqual(idsRepeatContent.keys.map((key) => key.tpl), ['generated-label', 'fkey-icon+label', 'alpha-dual']);
assert.deepEqual(idsRepeatContent.keys[1].elements.map((element) => element.kind === 'ico' ? `${element.slot}:${element.icon}:${element.group}` : `${element.slot}:${element.text}`), ['FC:volume-mute:f-icons', 'BC:F1']);
assert.deepEqual(idsRepeatContent.keys[2].elements.map((element) => `${element.slot}:${element.text}`), ['TL:A', 'BR:Ф']);
assert.deepEqual(generatedContentStatsForLayout(idsRepeatLayout), {
    keys: 3,
    alphaDualKeys: 1,
    punctuationDualKeys: 0,
    cornerTemplateKeys: 0,
    fIconKeys: 1,
    generatedLabelKeys: 1,
    placeholderKeys: 0
});
const idsRepeatResult = attachContent(idsRepeatKeys, idsRepeatContent);
assert.equal(idsRepeatResult.matched, 3);
assert.equal(idsRepeatResult.orphans, 0);

const ansiTklContent = generatedContentForLayout(LAYOUTS.ANSI_TKL, TYPE_DEFAULTS, CONTENT);
assert.equal(ansiTklContent.keys[1].tpl, 'fkey-icon+label');
assert.equal(ansiTklContent.keys[1].elements[0].icon, 'volume-mute');
assert.equal(ansiTklContent.keys[10].tpl, 'icon+word-stack');
assert.equal(ansiTklContent.keys[10].elements[0].icon, 'search');
assert.equal(generatedContentStatsForLayout(LAYOUTS.ANSI_TKL).fIconKeys, 12);

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
