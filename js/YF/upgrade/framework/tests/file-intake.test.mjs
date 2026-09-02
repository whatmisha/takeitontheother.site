import assert from 'node:assert/strict';
import test from 'node:test';

import {
    FileIntakeController,
    fileMatchesAccept
} from '../src/ui/FileIntakeController.js';

function fakeElement(tagName = 'div', { id = '' } = {}) {
    const listeners = new Map();
    const attributes = new Map();
    const classes = new Set();
    const element = {
        id,
        tagName: tagName.toUpperCase(),
        dataset: {},
        hidden: false,
        value: '',
        files: [],
        textContent: '',
        clickCount: 0,
        listeners,
        classList: {
            add: value => classes.add(value),
            remove: value => classes.delete(value),
            contains: value => classes.has(value)
        },
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(listener);
        },
        removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        contains(target) { return target === element; },
        click() { this.clickCount += 1; },
        dispatch(type, init = {}) {
            const event = {
                target: element,
                currentTarget: element,
                key: '',
                relatedTarget: null,
                defaultPrevented: false,
                propagationStopped: false,
                preventDefault() { this.defaultPrevented = true; },
                stopPropagation() { this.propagationStopped = true; },
                ...init
            };
            for (const listener of listeners.get(type) || []) listener(event);
            return event;
        }
    };
    return element;
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('FileIntake accept matching supports extensions, exact MIME and wildcards', () => {
    const svg = { name: 'mark.SVG', type: '' };
    const png = { name: 'image.bin', type: 'image/png' };
    const json = { name: 'preset.json', type: 'application/json' };

    assert.equal(fileMatchesAccept(svg, '.svg,image/svg+xml'), true);
    assert.equal(fileMatchesAccept(png, 'image/*'), true);
    assert.equal(fileMatchesAccept(json, 'application/json,.json'), true);
    assert.equal(fileMatchesAccept(json, '.svg,image/svg+xml'), false);
    assert.equal(fileMatchesAccept(null, 'image/*'), false);
});

test('FileIntake picker is reusable for the same file and exposes busy/ready state', async () => {
    const root = fakeElement('section');
    const input = fakeElement('input', { id: 'imageInput' });
    const trigger = fakeElement('button');
    const status = fakeElement('div', { id: 'imageStatus' });
    status.textContent = 'default-image.avif';
    const selected = [];
    const controller = new FileIntakeController({
        root,
        input,
        trigger,
        status,
        accept: 'image/*',
        initialState: 'ready',
        onSelect: async file => selected.push(file.name)
    }).init();

    assert.equal(status.textContent, 'default-image.avif');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(trigger.getAttribute('aria-describedby'), 'imageStatus');
    assert.equal(trigger.getAttribute('aria-controls'), 'imageInput');
    trigger.dispatch('click');
    assert.equal(input.clickCount, 1);

    const file = { name: 'source.png', type: 'image/png', size: 128 };
    input.files = [file];
    input.value = '/fake/source.png';
    input.dispatch('change');
    assert.equal(input.value, '', 'input must reset synchronously for same-file selection');
    await settle();
    assert.deepEqual(selected, ['source.png']);
    assert.equal(controller.state, 'ready');
    assert.equal(status.textContent, 'source.png');
    assert.equal(trigger.getAttribute('aria-busy'), 'false');

    input.files = [file];
    input.value = '/fake/source.png';
    input.dispatch('change');
    await settle();
    assert.deepEqual(selected, ['source.png', 'source.png']);
    controller.destroy();
    assert.equal(input.listeners.get('change').size, 0);
    assert.equal(trigger.listeners.get('click').size, 0);
});

test('FileIntake rejects invalid type and size before the application callback', async () => {
    const input = fakeElement('input', { id: 'svgInput' });
    const trigger = fakeElement('button');
    const status = fakeElement('div', { id: 'svgStatus' });
    const rejections = [];
    let selections = 0;
    const controller = new FileIntakeController({
        input,
        trigger,
        status,
        accept: '.svg,image/svg+xml',
        maxBytes: 1024,
        typeErrorText: 'SVG only.',
        sizeErrorText: 'SVG too large.',
        onSelect: async () => { selections += 1; },
        onReject: result => rejections.push(result.code)
    }).init();

    assert.equal((await controller.consume([
        { name: 'preset.json', type: 'application/json', size: 100 }
    ])).code, 'type');
    assert.equal(status.textContent, 'SVG only.');
    assert.equal((await controller.consume([
        { name: 'shape.svg', type: 'image/svg+xml', size: 2048 }
    ])).code, 'size');
    assert.equal(status.textContent, 'SVG too large.');
    assert.deepEqual(rejections, ['type', 'size']);
    assert.equal(selections, 0);
});

test('FileIntake dropzone handles pointer state, errors and keyboard picker access', async () => {
    const zone = fakeElement('div');
    const input = fakeElement('input', { id: 'fontInput' });
    const status = fakeElement('div', { id: 'fontStatus' });
    const errors = [];
    const controller = new FileIntakeController({
        input,
        trigger: zone,
        dropzone: zone,
        status,
        accept: '.woff2,font/woff2',
        errorText: error => error.message,
        onSelect: async () => { throw new Error('Font parse failed.'); },
        onError: error => errors.push(error.message)
    }).init();

    assert.equal(zone.getAttribute('role'), 'button');
    assert.equal(zone.getAttribute('tabindex'), '0');
    const key = zone.dispatch('keydown', { key: ' ' });
    assert.equal(key.defaultPrevented, true);
    assert.equal(input.clickCount, 1);

    const transfer = { files: [], dropEffect: 'none' };
    const drag = zone.dispatch('dragover', { dataTransfer: transfer });
    assert.equal(drag.defaultPrevented, true);
    assert.equal(transfer.dropEffect, 'copy');
    assert.equal(zone.classList.contains('is-dragover'), true);

    const drop = zone.dispatch('drop', {
        dataTransfer: {
            files: [{ name: 'broken.woff2', type: 'font/woff2', size: 100 }]
        }
    });
    assert.equal(drop.defaultPrevented, true);
    assert.equal(zone.classList.contains('is-dragover'), false);
    await settle();
    assert.equal(controller.state, 'error');
    assert.equal(status.textContent, 'Font parse failed.');
    assert.deepEqual(errors, ['Font parse failed.']);
});

test('FileIntake ignores a bubbled click from an input nested in its dropzone', () => {
    const zone = fakeElement('div');
    const input = fakeElement('input', { id: 'nestedInput' });
    const controller = new FileIntakeController({
        input,
        trigger: zone,
        dropzone: zone
    }).init();

    zone.dispatch('click', { target: input });
    assert.equal(input.clickCount, 0);
    zone.dispatch('click', { target: zone });
    assert.equal(input.clickCount, 1);
    controller.destroy();
});

test('FileIntake lets an application choose one file from a multi-file drop', async () => {
    const input = fakeElement('input');
    const trigger = fakeElement('button');
    const selected = [];
    const controller = new FileIntakeController({
        input,
        trigger,
        accept: '.otf,.ttf',
        selectFile: files => files.find(file => /\.(?:otf|ttf)$/iu.test(file.name)),
        onSelect: async file => selected.push(file.name)
    }).init();

    const result = await controller.consume([
        { name: 'notes.txt', type: 'text/plain' },
        { name: 'Display.otf', type: 'font/otf' }
    ], 'drop');
    assert.equal(result.ok, true);
    assert.deepEqual(selected, ['Display.otf']);
});
