import assert from 'node:assert/strict';
import test from 'node:test';

import { PresetSession } from '../src/preset/PresetSession.js';
import { PresetStore } from '../src/preset/PresetStore.js';

class MemoryStorage {
    constructor(entries = []) { this.values = new Map(entries); }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
}

const presetKeys = [
    'upgrade:sparky:presets:v1',
    'upgrade:keyboarder:presets:v1',
    'upgrade:wordplayer:presets:v1'
];

test('saved preset libraries survive store re-instantiation without crossing namespaces', () => {
    const previousStorage = globalThis.localStorage;
    const storage = new MemoryStorage([
        ['lunnenSparkyGeneratorV2', 'original-sparky-sentinel'],
        ['wordplayerPresetsV18', 'original-wordplayer-sentinel'],
        ['keyboarder', 'original-keyboarder-sentinel']
    ]);
    globalThis.localStorage = storage;
    try {
        presetKeys.forEach((storageKey, index) => {
            const writer = new PresetStore({ storageKey });
            assert.deepEqual(writer.create('Reload proof', { owner: storageKey, value: index }), { ok: true });
            writer.markSeeded();
        });

        presetKeys.forEach((storageKey, index) => {
            const readerAfterReload = new PresetStore({ storageKey });
            assert.equal(readerAfterReload.load('Reload proof').owner, storageKey);
            assert.equal(readerAfterReload.load('Reload proof').value, index);
            assert.equal(readerAfterReload.isSeeded(), true);
        });

        assert.equal(storage.getItem('lunnenSparkyGeneratorV2'), 'original-sparky-sentinel');
        assert.equal(storage.getItem('wordplayerPresetsV18'), 'original-wordplayer-sentinel');
        assert.equal(storage.getItem('keyboarder'), 'original-keyboarder-sentinel');
    } finally {
        globalThis.localStorage = previousStorage;
    }
});

test('one tool clearing its library cannot clear another tool or an original namespace', () => {
    const previousStorage = globalThis.localStorage;
    const storage = new MemoryStorage([['othersitePresets', 'original-sentinel']]);
    globalThis.localStorage = storage;
    try {
        const sparky = new PresetStore({ storageKey: presetKeys[0] });
        const keyboarder = new PresetStore({ storageKey: presetKeys[1] });
        sparky.create('Sparky only', { value: 1 });
        keyboarder.create('Keyboarder only', { value: 2 });
        sparky.markSeeded();
        keyboarder.markSeeded();

        assert.equal(sparky.clearAll(), true);
        assert.equal(sparky.load('Sparky only'), null);
        assert.equal(keyboarder.load('Keyboarder only').value, 2);
        assert.equal(keyboarder.isSeeded(), true);
        assert.equal(storage.getItem('othersitePresets'), 'original-sentinel');
    } finally {
        globalThis.localStorage = previousStorage;
    }
});

test('malformed data falls back locally without mutating adjacent storage', () => {
    const previousStorage = globalThis.localStorage;
    const storage = new MemoryStorage([
        [presetKeys[0], '{broken'],
        [presetKeys[1], JSON.stringify({ Stable: { value: 7 } })]
    ]);
    const previousError = console.error;
    console.error = () => {};
    globalThis.localStorage = storage;
    try {
        assert.deepEqual(new PresetStore({ storageKey: presetKeys[0] }).loadAll(), {});
        assert.equal(new PresetStore({ storageKey: presetKeys[1] }).load('Stable').value, 7);
        assert.equal(storage.getItem(presetKeys[0]), '{broken');
    } finally {
        globalThis.localStorage = previousStorage;
        console.error = previousError;
    }
});

test('undo history remains session-only while persisted presets reload', () => {
    const previousStorage = globalThis.localStorage;
    globalThis.localStorage = new MemoryStorage();
    try {
        let state = { value: 1 };
        const store = new PresetStore({ storageKey: presetKeys[2] });
        store.create('Saved', state);
        const firstSession = new PresetSession({
            store,
            snapshot: () => ({ ...state }),
            restore: snapshot => { state = { ...snapshot }; }
        });
        firstSession.switchTo('Saved');
        state.value = 2;
        firstSession.commit('session change');
        assert.equal(firstSession.canUndo(), true);

        const reloadedSession = new PresetSession({
            store: new PresetStore({ storageKey: presetKeys[2] }),
            snapshot: () => ({ ...state }),
            restore: snapshot => { state = { ...snapshot }; }
        });
        reloadedSession.switchTo('Saved');

        assert.equal(reloadedSession.canUndo(), false);
        assert.equal(reloadedSession.store.load('Saved').value, 1);
    } finally {
        globalThis.localStorage = previousStorage;
    }
});
