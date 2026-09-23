import test from 'node:test';
import assert from 'node:assert/strict';

import { SliderController } from '../src/ui/SliderController.js';

const createControl = (value, setting = null) => {
    const settings = {
        values: { [setting]: Number(value) },
        get(key) { return this.values[key]; },
        set(key, next) { this.values[key] = next; }
    };
    const updates = [];
    const controller = new SliderController(settings);
    const element = { value: String(value) };
    const valueInput = {
        value: String(value),
        dataset: { originalValue: String(value) },
        blurCount: 0,
        blur() { this.blurCount += 1; }
    };
    controller.sliders.set('control', {
        element,
        valueInput,
        config: {
            setting,
            min: 0,
            max: 100,
            decimals: 2,
            baseStep: 0.25,
            shiftStep: 1,
            onUpdate: next => updates.push(next)
        }
    });
    return { controller, settings, element, valueInput, updates };
};

const keyEvent = (key, shiftKey = false) => ({
    key,
    shiftKey,
    prevented: false,
    preventDefault() { this.prevented = true; }
});

test('shared numeric controls apply arrow and Shift+Arrow steps', () => {
    const control = createControl(2.5, 'amount');
    control.controller.handleKeyDown('control', keyEvent('ArrowUp'));
    assert.equal(control.element.value, 2.75);
    assert.equal(control.settings.get('amount'), 2.75);
    control.controller.handleKeyDown('control', keyEvent('ArrowUp', true));
    assert.equal(control.element.value, 3);
    assert.deepEqual(control.updates, [2.75, 3]);
});

test('Escape restores setting:null controls captured on focus', () => {
    const control = createControl(12.5, null);
    control.valueInput.value = '80';
    control.element.value = '80';
    const event = keyEvent('Escape');
    control.controller.handleKeyDown('control', event);
    assert.equal(control.valueInput.value, '12.50');
    assert.equal(control.element.value, 12.5);
    assert.equal(control.valueInput.blurCount, 1);
    assert.equal(event.prevented, true);
});
