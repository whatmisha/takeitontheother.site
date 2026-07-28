import assert from 'node:assert/strict';
import { LCAKB23 } from '../app/kb/layouts.js';
import { toMm } from '../app/kb/units.js';
import {
    MODEL_SCHEMA,
    buildKeyboardModel,
    parseKeyboardModelJSONText,
    presetBlobFromKeyboardModel,
    sanitizeContentEdits,
    sanitizeLayoutEdits
} from '../app/kb/model-io.js';

const TYPE_DEFAULTS = {
    glyphSize: 15.1999,
    numpadSize: 13.1732,
    secondarySize: 12.0745,
    wordSize: 9.1199,
    leading: 13.5279,
    trackingOffset: 0
};

const defaults = {
    layoutName: LCAKB23.meta.name,
    customLayout: null,
    colPitch: toMm(LCAKB23.grid.colPitch),
    rowPitch: toMm(LCAKB23.grid.rowPitch),
    keyWidth1U: toMm(LCAKB23.grid.keyWidth1U),
    keyHeight: toMm(LCAKB23.grid.keyHeight),
    cornerRadius: toMm(LCAKB23.grid.cornerRadius),
    guideInset: toMm(LCAKB23.grid.guideInset),
    ...TYPE_DEFAULTS,
    compensationMode: 'table',
    showCaps: true,
    showGuides: false,
    showGlyphs: true,
    showIcons: true,
    showDrawing: true,
    showColumns: false,
    showIndex: false,
    showInk: false,
    showSlots: false,
    showRef: false,
    showDiff: false,
    showBlocks: false,
    languageLayer: 'dual',
    capColor: '#1e1e1e',
    guideColor: '#2353db',
    inkColor: '#aaaaaa',
    bgColor: '#808080',
    contentEdits: {},
    layoutEdits: {}
};

const options = {
    layoutMeta: LCAKB23.meta,
    sourceRowCount: LCAKB23.rows.length,
    typeDefaults: TYPE_DEFAULTS,
    iconOptions: ['arrow-left'],
    minKeyWidthMm: 4,
    maxKeyWidthMm: 80
};

const edited = {
    ...defaults,
    colPitch: 19.1234,
    showSlots: true,
    layoutEdits: {
        '0:main:0': { widthMm: '18.12345' },
        '0:main:1': { deleted: true, widthMm: 2 },
        'add:0:main:1': { added: true, after: '0:main:0', widthMm: 999 },
        'rowadd:1': { rowAdded: true, afterRow: '0', templateRow: '0' },
        'rowadd:bad': { rowAdded: true, afterRow: 99, templateRow: 0 },
        'order:0:main': { order: ['0:main:0', '0:main:0', '', '0:main:1'] }
    },
    contentEdits: {
        '0:main:0': {
            tpl: 'custom',
            elements: [{
                slot: 'BL',
                kind: 'txt',
                text: 'QA',
                size: '12.3456',
                tracking: '0.02',
                compOverride: { px: '0.5' },
                offset: { x: '1', y: '0', bx: 0, by: '-2' }
            }]
        },
        '0:main:1': {
            tpl: 'icon',
            elements: [{ slot: 'BC', kind: 'ico', icon: '', group: 'f-icons', w: '9.5', h: 'bad' }]
        }
    }
};

const cleanLayout = sanitizeLayoutEdits(edited.layoutEdits, options);
assert.deepEqual(cleanLayout['0:main:0'], { widthMm: 18.123 });
assert.deepEqual(cleanLayout['0:main:1'], { deleted: true, widthMm: 4 });
assert.deepEqual(cleanLayout['add:0:main:1'], { added: true, after: '0:main:0', widthMm: 80 });
assert.deepEqual(cleanLayout['rowadd:1'], { rowAdded: true, afterRow: 0, templateRow: 0 });
assert.deepEqual(cleanLayout['order:0:main'], { order: ['0:main:0', '0:main:1'] });
assert.equal(cleanLayout['rowadd:bad'], undefined);

const cleanContent = sanitizeContentEdits(edited.contentEdits, options);
assert.deepEqual(cleanContent['0:main:0'].elements[0], {
    slot: 'BL',
    kind: 'txt',
    text: 'QA',
    size: 12.3456,
    tracking: 0.02,
    compOverride: { px: 0.5 },
    offset: { x: 1, by: -2 }
});
assert.deepEqual(cleanContent['0:main:1'].elements[0], {
    slot: 'BC',
    kind: 'ico',
    icon: 'arrow-left',
    group: 'f-icons',
    w: 9.5,
    h: 8
});

const model = buildKeyboardModel(edited, defaults, options);
assert.equal(model.schema, MODEL_SCHEMA);
assert.equal(model.baseLayout, 'LCAKB23');
assert.equal(model.settings.layoutName, 'LCAKB23');
assert.equal(model.settings.languageLayer, 'dual');
assert.deepEqual(model.keyboard.edits.layout, cleanLayout);
assert.deepEqual(model.keyboard.edits.content, cleanContent);

const fromFullModel = presetBlobFromKeyboardModel(model, defaults, options);
assert.deepEqual(fromFullModel, model.settings);

const fromTextModel = parseKeyboardModelJSONText(JSON.stringify(model), defaults, options);
assert.deepEqual(fromTextModel, model.settings);

const domainOnlyModel = { ...model, settings: undefined };
const fromDomainOnly = presetBlobFromKeyboardModel(domainOnlyModel, defaults, options);
assert.deepEqual(fromDomainOnly, model.settings);

const fromDomainOnlyText = parseKeyboardModelJSONText(JSON.stringify(domainOnlyModel), defaults, options);
assert.deepEqual(fromDomainOnlyText, model.settings);

const fromLegacyPreset = presetBlobFromKeyboardModel(edited, defaults, options);
assert.deepEqual(fromLegacyPreset, model.settings);

const fromLegacyPresetText = parseKeyboardModelJSONText(JSON.stringify(edited), defaults, options);
assert.deepEqual(fromLegacyPresetText, model.settings);

assert.throws(
    () => presetBlobFromKeyboardModel({ schema: 'keyboarder.model.v2' }, defaults, options),
    /Unsupported model schema/
);
assert.throws(
    () => presetBlobFromKeyboardModel([], defaults, options),
    /JSON root must be an object/
);
assert.throws(
    () => parseKeyboardModelJSONText('{bad', defaults, options),
    /Could not parse JSON/
);

console.log('model IO round-trip passed');
