import test from 'node:test';
import assert from 'node:assert/strict';
import { SliderControlBinding } from '../src/ui/SliderControlBinding.js';
import {
    formatSliderValue,
    getDecimalsFromStep,
    normalizeSliderInput,
    stepSliderValue
} from '../src/ui/SliderValueMath.js';

const config = {
    min: 0,
    max: 100,
    decimals: 2,
    baseStep: 0.25,
    shiftStep: 1,
    suffix: ' mm'
};

test('slider value math normalizes boundaries, decimals and large-step snapping', () => {
    assert.equal(getDecimalsFromStep(1), 0);
    assert.equal(getDecimalsFromStep(0.25), 2);
    assert.equal(getDecimalsFromStep(1e-4), 4);
    assert.equal(normalizeSliderInput(99.99, config), 100);
    assert.equal(normalizeSliderInput(-10, config), 0);
    assert.equal(stepSliderValue(2.5, 1, false, config), 2.75);
    assert.equal(stepSliderValue(2.5, 1, true, config), 3);
    assert.equal(stepSliderValue(2.5, -1, true, config), 2);
    assert.equal(formatSliderValue(2.5, config), '2.50 mm');
});

class FakeControl {
    constructor(value = '') {
        this.value = value;
        this.dataset = {};
        this.listeners = new Map();
        this.selectCount = 0;
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    emit(type) { this.listeners.get(type)?.({ target: this }); }
    select() { this.selectCount += 1; }
}

test('slider binding initializes and binds one range/input pair', () => {
    const slider = new FakeControl('120');
    const input = new FakeControl();
    const documentRef = {
        getElementById: id => ({ control: slider, controlValue: input })[id] || null
    };
    const calls = [];
    const binding = new SliderControlBinding({ documentRef });
    const data = binding.create('control', { ...config, valueId: 'controlValue' }, {
        sliderInput: () => calls.push('input'),
        keydown: () => calls.push('keydown'),
        blur: () => calls.push('blur')
    });

    assert.equal(data.element, slider);
    assert.equal(slider.min, '0');
    assert.equal(slider.max, '100');
    assert.equal(slider.step, '0.25');
    assert.equal(slider.value, 100);
    assert.equal(input.value, '100.00 mm');
    input.emit('focus');
    assert.equal(input.dataset.originalValue, '100.00 mm');
    assert.equal(input.selectCount, 1);
    slider.emit('input');
    input.emit('keydown');
    input.emit('blur');
    assert.deepEqual(calls, ['input', 'keydown', 'blur']);
});
