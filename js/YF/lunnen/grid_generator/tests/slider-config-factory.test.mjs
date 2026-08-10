import assert from 'node:assert/strict';
import test from 'node:test';

import { createSliderConfig } from '../src/config/SliderConfigFactory.js';
import { SLIDER_CONFIG } from '../src/config/SliderConfig.js';

function createHost(overrides = {}) {
    const values = new Map([
        ['fontSizeUnit', 'mod'],
        ['lineHeightUnit', 'mod'],
        ['gridModule', 5]
    ]);
    const calls = [];
    return {
        settingsModule: {
            get: key => values.get(key),
            set: (key, value) => {
                values.set(key, value);
                calls.push(['set', key, value]);
            }
        },
        textStyleResolver: {
            fontSizeMmToModules: millimeters => millimeters / 2
        },
        updateGridDebounced: () => calls.push(['render']),
        markAsChanged: () => calls.push(['changed']),
        updateColorFromHSB: () => calls.push(['color']),
        updateSaturationGradient: () => calls.push(['saturation']),
        updateBrightnessGradient: () => calls.push(['brightness']),
        surfacePanelController: {
            applyGridValue: (field, value) => calls.push(['surface', field, value])
        },
        calls,
        values,
        ...overrides
    };
}

test('runtime slider configuration does not mutate the shared base data', () => {
    const host = createHost();
    const config = createSliderConfig(host);

    assert.notEqual(config.headlineSizeSlider, SLIDER_CONFIG.headlineSizeSlider);
    assert.equal(SLIDER_CONFIG.headlineSizeSlider.onUpdate, undefined);
    assert.equal(config.surfaceGridMarginsSlider.group, 'surface');
});

test('all typography size sliders share the pt-to-module conversion rule', () => {
    const host = createHost();
    host.values.set('fontSizeUnit', 'pt');
    const config = createSliderConfig(host);

    config.captionSizeSlider.onUpdate(28.3465);

    assert.equal(host.values.get('captionSize'), 5);
    assert.deepEqual(host.calls.at(-1), ['render']);
});

test('all line-height sliders keep modular storage when the UI uses points', () => {
    const host = createHost();
    host.values.set('lineHeightUnit', 'pt');
    const config = createSliderConfig(host);

    config.lunnenDisplayLineHeightSlider.onUpdate(28.3465);

    assert.equal(host.values.get('lunnenDisplayLineHeight'), 2);
    assert.deepEqual(host.calls.at(-1), ['render']);
});

test('color and side-grid callbacks preserve their specific update fan-out', () => {
    const host = createHost();
    const config = createSliderConfig(host);

    config.saturationSlider.onUpdate(60);
    config.surfaceGridRowsSlider.onUpdate(18);

    assert.deepEqual(host.calls, [
        ['color'],
        ['brightness'],
        ['surface', 'rows', 18]
    ]);
});
