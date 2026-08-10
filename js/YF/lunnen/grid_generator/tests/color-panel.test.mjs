import assert from 'node:assert/strict';
import test from 'node:test';

import { ColorPanelController } from '../src/ui/ColorPanelController.js';

function createFixture(initialColor = '#404040') {
    const values = new Map([['boxColor', initialColor]]);
    const styles = new Map();
    const calls = [];
    const documentRef = {
        head: {
            appendChild: style => styles.set(style.id, style)
        },
        createElement: () => ({ id: '', textContent: '' }),
        getElementById: id => styles.get(id) || null
    };
    const control = value => ({ value, style: {} });
    const dom = {
        colorPreview: control(''),
        hexColorInput: control(initialColor),
        hueSlider: control(0),
        saturationSlider: control(0),
        brightnessSlider: control(0),
        hueValue: control(0),
        saturationValue: control(0),
        brightnessValue: control(0)
    };
    const controller = new ColorPanelController({
        settings: {
            get: key => values.get(key),
            set: (key, value) => values.set(key, value)
        },
        dom,
        documentRef,
        markChanged: () => calls.push('changed'),
        render: () => calls.push('render'),
        commitAction: () => calls.push('commit')
    });
    return { controller, dom, values, calls, styles };
}

test('hex synchronization updates HSB controls and the visible color swatch', () => {
    const { controller, dom, styles } = createFixture();

    controller.sync('#2353DB');

    assert.equal(dom.hexColorInput.value, '#2353DB');
    assert.equal(dom.colorPreview.style.backgroundColor, '#2353DB');
    assert.equal(Number(dom.hueSlider.value), 224);
    assert.ok(styles.has('saturationSlider-wide-track-style'));
    assert.ok(styles.has('brightnessSlider-wide-track-style'));
});

test('invalid hex input restores the current source-of-truth color', () => {
    const { controller, dom, values, calls } = createFixture('#123456');
    dom.hexColorInput.value = '#broken';

    controller.commitHexInput(dom.hexColorInput);

    assert.equal(values.get('boxColor'), '#123456');
    assert.equal(dom.hexColorInput.value, '#123456');
    assert.deepEqual(calls, ['render', 'commit']);
});

test('HSB slider updates store a hex color and refresh only dependent gradients', () => {
    const { controller, dom, values, calls, styles } = createFixture();
    dom.hueSlider.value = 0;
    dom.saturationSlider.value = 100;
    dom.brightnessSlider.value = 100;

    controller.handleHsbSlider('saturation');

    assert.equal(values.get('boxColor'), '#ff0000');
    assert.equal(dom.hexColorInput.value, '#ff0000');
    assert.deepEqual(calls, ['changed', 'render']);
    assert.ok(styles.has('brightnessSlider-wide-track-style'));
    assert.equal(styles.has('saturationSlider-wide-track-style'), false);
});
