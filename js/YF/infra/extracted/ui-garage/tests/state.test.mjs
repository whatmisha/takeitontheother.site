import assert from 'node:assert/strict';
import test from 'node:test';

import { ApplicationShell } from '../src/core/ApplicationShell.js';
import { HistoryBridge } from '../src/history/HistoryBridge.js';
import { HistoryManager } from '../src/history/HistoryManager.js';
import { PresetSession, SHARED_SLOT } from '../src/preset/PresetSession.js';
import { PresetStore } from '../src/preset/PresetStore.js';
import { ShareCodec } from '../src/preset/ShareCodec.js';

class MemoryStorage {
    constructor(entries = []) { this.values = new Map(entries); }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
}

test('HistoryManager deduplicates snapshots and supports branch-safe undo/redo', () => {
    const history = new HistoryManager({ maxSize: 4 });
    assert.equal(history.saveSnapshot({ value: 1 }, 'initial'), true);
    assert.equal(history.saveSnapshot({ value: 1 }, 'duplicate'), false);
    history.saveSnapshot({ value: 2 }, 'second');
    assert.deepEqual(history.undo(), { value: 1 });
    assert.deepEqual(history.redo(), { value: 2 });
    history.undo();
    history.saveSnapshot({ value: 3 }, 'branch');
    assert.equal(history.canRedo(), false);
    assert.deepEqual(history.getCurrentState(), { value: 3 });
});

test('HistoryBridge collapses changes and guards restoration', async () => {
    const labels = [];
    const bridge = new HistoryBridge({ commit: label => labels.push(label), debounceMs: 5 });
    bridge.notifyChange('first');
    bridge.notifyChange('last');
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.deepEqual(labels, ['last']);
    bridge.beginTransaction('drag');
    bridge.notifyChange('ignored');
    bridge.endTransaction();
    bridge.runRestoring(() => bridge.notifyChange('restore'));
    assert.deepEqual(labels, ['last', 'drag']);
});

test('PresetStore writes only its isolated namespace and seed marker', () => {
    const previousStorage = globalThis.localStorage;
    const storage = new MemoryStorage([['legacyPresetStore', 'original-sentinel']]);
    globalThis.localStorage = storage;
    try {
        const store = new PresetStore({ storageKey: 'ui-garage:test:presets:v1' });
        assert.deepEqual(store.create('One', { value: 1 }), { ok: true });
        store.markSeeded();
        assert.equal(store.load('One').value, 1);
        assert.equal(storage.getItem('ui-garage:test:presets:v1__seeded'), '1');
        assert.equal(storage.getItem('legacyPresetStore'), 'original-sentinel');
    } finally {
        globalThis.localStorage = previousStorage;
    }
});

test('PresetStore rejects a missing shared namespace', () => {
    assert.throws(
        () => new PresetStore(),
        /requires a unique versioned storageKey/u
    );
});

test('PresetStore aborts stalled seed requests at its configured timeout', async () => {
    const previousFetch = globalThis.fetch;
    let capturedSignal = null;
    globalThis.fetch = (_url, options = {}) => new Promise((resolve, reject) => {
        capturedSignal = options.signal;
        capturedSignal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    try {
        const store = new PresetStore({ storageKey: 'ui-garage:timeout-test:v1', fetchTimeoutMs: 5 });
        await assert.rejects(store._fetchJSON('/never.json', 'test seed'), /aborted|timed out/);
        assert.equal(capturedSignal?.aborted, true);
    } finally {
        globalThis.fetch = previousFetch;
    }
});

test('ApplicationShell runs an in-namespace preset migration before forced seeding', async () => {
    const calls = [];
    const shell = new ApplicationShell({
        presets: {
            basePath: 'presets',
            forceSeed: true,
            migrate: async store => calls.push(['migrate', store])
        }
    });
    shell.presets = { openNew: defaults => calls.push(['new', defaults]) };
    shell.presetStore = {
        loadSeed: async options => calls.push(['seed', options]),
        getNames: () => [],
        has: () => false
    };
    shell.settingsStore = { getDefaults: () => ({ clean: true }) };
    shell._refreshChrome = () => calls.push(['refresh']);
    await shell._bootstrapPresets();
    assert.equal(calls[0][0], 'migrate');
    assert.equal(calls[1][0], 'seed');
    assert.equal(calls[1][1].force, true);
    assert.deepEqual(calls[2], ['new', { clean: true }]);
});

test('ApplicationShell uses short URLs only for clean bundled presets', async () => {
    const previousLocation = globalThis.location;
    globalThis.location = {
        href: 'https://example.test/upgrade/tool/?old=1',
        origin: 'https://example.test',
        pathname: '/upgrade/tool/',
        search: '?old=1',
        hash: ''
    };
    try {
        const shell = new ApplicationShell({ share: {} });
        shell.share = new ShareCodec({ pristineDefaults: { value: 0 } });
        shell.presetStore = { load: () => ({ value: 5, seeded: true }) };
        shell.presets = { currentName: 'Basic Look', isDirty: false };
        shell.getPresetBlob = () => ({ value: 5 });

        const shortUrl = await shell._buildShareUrl('Basic Look', { useCurrent: true });
        assert.equal(shortUrl, 'https://example.test/upgrade/tool/?preset=basic-look');

        shell.presets.isDirty = true;
        const fullUrl = await shell._buildShareUrl('Basic Look', { useCurrent: true });
        assert.match(fullUrl, /^https:\/\/example\.test\/upgrade\/tool\/\?old=1#p=v1\./);
    } finally {
        globalThis.location = previousLocation;
    }
});

test('PresetSession keeps per-preset history and shared data ephemeral', () => {
    const previousStorage = globalThis.localStorage;
    globalThis.localStorage = new MemoryStorage();
    try {
        let state = { value: 1 };
        const store = new PresetStore({ storageKey: 'ui-garage:session-test:presets:v1' });
        store.create('Base', state);
        const session = new PresetSession({
            store,
            snapshot: () => ({ ...state }),
            restore: snapshot => { state = { ...snapshot }; },
            apply: blob => { state = { value: blob.value }; },
            collect: () => ({ ...state })
        });
        session.switchTo('Base');
        state.value = 2;
        session.commit('change');
        assert.equal(session.undo(), true);
        assert.equal(state.value, 1);
        session.openShared({ value: 9 });
        assert.equal(session.currentName, SHARED_SLOT);
        assert.equal(state.value, 9);
        assert.equal(store.getNames().includes(SHARED_SLOT), false);
    } finally {
        globalThis.localStorage = previousStorage;
    }
});
