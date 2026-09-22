import assert from 'node:assert/strict';
import test from 'node:test';

import { PanelUiController } from '../src/ui/PanelUiController.js';

function createFixture() {
    const elements = new Map([
        ['gridParams', { textContent: '' }],
        ['dimensionsParams', { textContent: '' }],
        ['objectsParams', { textContent: '' }],
        ['textStylesParams', { textContent: '' }],
        ['headlineStyleDropdown', { value: '' }],
        ['textStyleDropdown', { value: '' }],
        ['captionStyleDropdown', { value: '' }]
    ]);
    const values = {
        gridModule: 5.125,
        columnCount: 12,
        rowCount: 10,
        frontWidth: 500,
        frontHeight: 400,
        thickness: 50,
        headlineFontWeight: 400,
        textFontWeight: 500,
        captionFontWeight: 400
    };
    const host = {
        settingsModule: {
            get: key => values[key],
            getAll: () => ({ ...values })
        },
        objectDocument: {
            textBlocks: [
                { styleRef: 'headline' },
                { styleRef: 'headline' },
                { styleRef: 'caption' },
                {}
            ],
            graphicsBlocks: [{}, {}, {}]
        }
    };
    const documentRef = {
        getElementById: id => elements.get(id) || null
    };
    return {
        controller: new PanelUiController(host, documentRef, {}),
        elements
    };
}

test('collapsed panel summaries are derived from current application state', () => {
    const { controller, elements } = createFixture();

    controller.updatePanelParams();

    assert.equal(elements.get('gridParams').textContent, 'Mod 5.13  •  Col 12  •  Row 10');
    assert.equal(elements.get('dimensionsParams').textContent, '500\u2009×\u2009400\u2009×\u200950 mm');
    assert.equal(elements.get('objectsParams').textContent, 'Txt 4  •  Obj 3');
    assert.equal(elements.get('textStylesParams').textContent, '2 styles');
});

test('font-weight controls synchronize all supported text styles', () => {
    const { controller, elements } = createFixture();

    controller.syncFontWeights();

    assert.equal(elements.get('headlineStyleDropdown').value, '400');
    assert.equal(elements.get('textStyleDropdown').value, '500');
    assert.equal(elements.get('captionStyleDropdown').value, '400');
});
