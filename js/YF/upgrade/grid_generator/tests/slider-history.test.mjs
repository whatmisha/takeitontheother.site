import assert from 'node:assert/strict';
import test from 'node:test';

import { SliderHistoryController } from '../src/ui/SliderHistoryController.js';

class FakeTarget {
    constructor() {
        this.listeners = new Map();
    }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(listener);
    }

    dispatch(type, event = {}) {
        this.listeners.get(type)?.forEach(listener => listener(event));
    }
}

function createFixture() {
    const slider = new FakeTarget();
    const input = new FakeTarget();
    const documentRef = new FakeTarget();
    const calls = [];
    const controller = new SliderHistoryController({
        sliderController: {
            sliders: new Map([['headlineSizeSlider', { element: slider, valueInput: input }]])
        },
        documentRef,
        beginAction: label => calls.push(['begin', label]),
        commitAction: () => calls.push(['commit'])
    });
    controller.bind();
    return { controller, slider, input, documentRef, calls };
}

test('a mouse slider gesture is stored as one history transaction', () => {
    const { slider, calls } = createFixture();

    slider.dispatch('mousedown', { button: 0 });
    slider.dispatch('mouseup', { button: 0 });
    slider.dispatch('mouseup', { button: 0 });

    assert.deepEqual(calls, [
        ['begin', 'adjust headlineSizeSlider'],
        ['commit']
    ]);
});

test('document mouseup commits a drag released outside the slider', () => {
    const { slider, documentRef, calls } = createFixture();

    slider.dispatch('mousedown', { button: 0 });
    documentRef.dispatch('mouseup');

    assert.deepEqual(calls, [
        ['begin', 'adjust headlineSizeSlider'],
        ['commit']
    ]);
});

test('focus and blur group keyboard edits independently from mouse drags', () => {
    const { input, calls } = createFixture();

    input.dispatch('focus');
    input.dispatch('focus');
    input.dispatch('blur');

    assert.deepEqual(calls, [
        ['begin', 'type headlineSizeSlider'],
        ['commit']
    ]);
});
