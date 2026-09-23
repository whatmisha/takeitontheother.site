import assert from 'node:assert/strict';
import test from 'node:test';

import { SliderController } from '../src/ui/SliderController.js';
import { RangeSliderController } from '../src/ui/RangeSliderController.js';

function keyEvent(key, { shiftKey = false, target } = {}) {
    return {
        key,
        shiftKey,
        target,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }
    };
}

function eventTarget() {
    const listeners = new Map();
    return {
        listeners,
        addEventListener(type, listener) { listeners.set(type, listener); },
        removeEventListener(type, listener) {
            if (listeners.get(type) === listener) listeners.delete(type);
        }
    };
}

test('single-slider value fields use exact fine and coarse additive steps', () => {
    const state = new Map([['amount', 23]]);
    const updates = [];
    const controller = new SliderController({
        get: key => state.get(key),
        set: (key, value) => state.set(key, value)
    });
    const element = { value: '23' };
    const valueInput = { value: '23', blur() { this.blurred = true; } };
    controller.sliders.set('amount', {
        element,
        valueInput,
        config: {
            setting: 'amount', min: 0, max: 100, decimals: 0,
            baseStep: 1, shiftStep: 10,
            onUpdate: value => updates.push(value)
        }
    });

    controller.handleKeyDown('amount', keyEvent('ArrowUp', { target: valueInput }));
    assert.equal(valueInput.value, '24');
    valueInput.value = '23';
    controller.handleKeyDown('amount', keyEvent('ArrowUp', { shiftKey: true, target: valueInput }));
    assert.equal(valueInput.value, '33', 'coarse input arrows add the configured step');
    valueInput.value = '27';
    controller.handleKeyDown('amount', keyEvent('ArrowDown', { shiftKey: true, target: valueInput }));
    assert.equal(valueInput.value, '17');
    assert.deepEqual(updates, [24, 33, 17]);
});

test('range-slider thumbs honor arrows, Shift, Home, End and the opposite thumb', () => {
    const controller = new RangeSliderController({ set() {} });
    const minThumb = eventTarget();
    const maxThumb = eventTarget();
    const data = {
        minThumb,
        maxThumb,
        minValue: 20,
        maxValue: 80,
        config: { min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 }
    };
    controller.ranges.set('interval', data);
    controller.updatePositions = () => {};
    controller.updateSettings = () => {};
    controller.setupKeyboardEvents('interval', 'min');
    controller.setupKeyboardEvents('interval', 'max');

    minThumb.listeners.get('keydown')(keyEvent('ArrowRight'));
    assert.equal(data.minValue, 21);
    data.minValue = 20;
    minThumb.listeners.get('keydown')(keyEvent('ArrowUp', { shiftKey: true }));
    assert.equal(data.minValue, 30);

    data.config = { min: 0, max: 1, decimals: 2, baseStep: 0.01, shiftStep: 0.1 };
    data.minValue = 0.25;
    data.maxValue = 0.75;
    minThumb.listeners.get('keydown')(keyEvent('ArrowUp', { shiftKey: true }));
    assert.equal(data.minValue, 0.35, 'decimal coarse step is additive rather than grid-snapped');
    data.config = { min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 };
    data.minValue = 20;
    data.maxValue = 80;
    minThumb.listeners.get('keydown')(keyEvent('End'));
    assert.equal(data.minValue, 80, 'lower End stops at the upper thumb');
    minThumb.listeners.get('keydown')(keyEvent('Home'));
    assert.equal(data.minValue, 0);

    data.minValue = 20;
    maxThumb.listeners.get('keydown')(keyEvent('Home'));
    assert.equal(data.maxValue, 20, 'upper Home stops at the lower thumb');
    maxThumb.listeners.get('keydown')(keyEvent('End'));
    assert.equal(data.maxValue, 100);
    controller.destroy();
});
