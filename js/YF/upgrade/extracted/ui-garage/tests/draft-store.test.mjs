import assert from 'node:assert/strict';
import test from 'node:test';
import { DraftStore } from '../src/persistence/DraftStore.js';

test('DraftStore requires an explicit versioned application namespace', () => {
    assert.throws(() => new DraftStore(), /non-empty namespace/u);
    assert.throws(() => new DraftStore({ namespace: 'tool', version: 0 }), /positive integer/u);
    const store = new DraftStore({ namespace: 'clean-tool', version: 2, indexedDB: null });
    assert.equal(store.databaseName, 'ui-garage:clean-tool:drafts:v2');
});

test('DraftStore disables recovery cleanly when IndexedDB is unavailable', async () => {
    const store = new DraftStore({ namespace: 'clean-tool', indexedDB: null });
    assert.equal(store.available, false);
    assert.equal(await store.open(), null);
    assert.equal(await store.save({ value: 1 }), false);
    assert.equal(await store.load(), null);
    assert.equal(await store.remove(), false);
    assert.equal(await store.clear(), false);
    store.destroy();
});
