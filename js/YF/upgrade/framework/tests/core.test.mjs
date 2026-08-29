import assert from 'node:assert/strict';
import test from 'node:test';

import { DOMCache } from '../src/core/DOMCache.js';
import { Settings } from '../src/core/Settings.js';
import { ShortcutRouter } from '../src/core/ShortcutRouter.js';
import { RenderTarget } from '../src/render/RenderTarget.js';

test('Settings clones defaults, notifies changes and tracks a clean baseline', () => {
    const defaults = { width: 500, nested: { enabled: true } };
    const settings = new Settings(defaults);
    defaults.nested.enabled = false;
    assert.equal(settings.get('nested').enabled, true);

    const changes = [];
    const unsubscribe = settings.subscribe('*', (next, previous, key) => changes.push({ next, previous, key }));
    settings.set('width', 640);
    settings.set('width', 640);
    assert.equal(changes.length, 1);
    assert.deepEqual(settings.getDirtyKeys(), ['width']);
    settings.markClean();
    assert.equal(settings.isDirty(), false);
    unsubscribe();
    settings.set('width', 720);
    assert.equal(changes.length, 1);
});

test('Settings proxy and serialization preserve plain state', () => {
    const settings = new Settings({ value: 1 });
    const proxy = settings.createProxy();
    proxy.value = 2;
    settings.fromJSON('{"extra":3}');
    assert.deepEqual(settings.toObject(), { value: 2, extra: 3 });
    assert.deepEqual(Object.keys(proxy).sort(), ['extra', 'value']);
});

test('DOMCache resolves ids once and exposes its proxy', () => {
    const previousDocument = globalThis.document;
    const calls = [];
    globalThis.document = {
        getElementById(id) {
            calls.push(id);
            return { id };
        }
    };
    try {
        const cache = new DOMCache().init({ canvas: 'canvas', surface: 'surface' });
        assert.equal(cache.get('canvas').id, 'canvas');
        assert.equal(cache.createProxy().surface.id, 'surface');
        assert.deepEqual(calls, ['canvas', 'surface']);
    } finally {
        globalThis.document = previousDocument;
    }
});

test('ShortcutRouter owns one removable listener and ignores editable targets', () => {
    const listeners = new Map();
    const target = {
        addEventListener(type, handler) { listeners.set(type, handler); },
        removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); }
    };
    const router = new ShortcutRouter({ target }).init();
    let calls = 0;
    router.register('mod+shift+z', () => { calls += 1; });

    const makeEvent = tagName => ({
        key: 'z', metaKey: true, ctrlKey: false, shiftKey: true, altKey: false,
        target: { tagName, isContentEditable: false },
        preventDefault() { this.prevented = true; }
    });
    const editableEvent = makeEvent('INPUT');
    listeners.get('keydown')(editableEvent);
    assert.equal(calls, 0);
    const canvasEvent = makeEvent('DIV');
    listeners.get('keydown')(canvasEvent);
    assert.equal(calls, 1);
    assert.equal(canvasEvent.prevented, true);
    router.destroy();
    assert.equal(listeners.size, 0);
});

test('RenderTarget publishes zoom changes and clears listeners on destroy', () => {
    const target = new RenderTarget({}, { width: 200, height: 100 });
    const values = [];
    const off = target.onZoomChange(value => values.push(value));
    target._emitZoomChange(125);
    off();
    target._emitZoomChange(150);
    assert.deepEqual(values, [125]);
    target.setLogicalSize(320, 240);
    assert.deepEqual([target.width, target.height], [320, 240]);
    target.destroy();
});
