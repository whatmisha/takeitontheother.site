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
    'ui-garage:tool-alpha:presets:v1',
    'ui-garage:tool-beta:presets:v1',
    'ui-garage:tool-gamma:presets:v1'
];

test('saved preset libraries survive store re-instantiation without crossing namespaces', () => {
    const previousStorage = globalThis.localStorage;
    const storage = new MemoryStorage([
        ['legacyAlphaStore', 'original-alpha-sentinel'],
        ['legacyBetaStore', 'original-beta-sentinel'],
        ['legacyGammaStore', 'original-gamma-sentinel']
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

        assert.equal(storage.getItem('legacyAlphaStore'), 'original-alpha-sentinel');
        assert.equal(storage.getItem('legacyBetaStore'), 'original-beta-sentinel');
        assert.equal(storage.getItem('legacyGammaStore'), 'original-gamma-sentinel');
    } finally {
        globalThis.localStorage = previousStorage;
    }
});

test('one tool clearing its library cannot clear another tool or an original namespace', () => {
    const previousStorage = globalThis.localStorage;
    const storage = new MemoryStorage([['legacyPresetStore', 'original-sentinel']]);
    globalThis.localStorage = storage;
    try {
        const firstTool = new PresetStore({ storageKey: presetKeys[0] });
        const secondTool = new PresetStore({ storageKey: presetKeys[1] });
        firstTool.create('First only', { value: 1 });
        secondTool.create('Second only', { value: 2 });
        firstTool.markSeeded();
        secondTool.markSeeded();

        assert.equal(firstTool.clearAll(), true);
        assert.equal(firstTool.load('First only'), null);
        assert.equal(secondTool.load('Second only').value, 2);
        assert.equal(secondTool.isSeeded(), true);
        assert.equal(storage.getItem('legacyPresetStore'), 'original-sentinel');
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
