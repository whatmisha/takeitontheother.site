import test from 'node:test';
import assert from 'node:assert/strict';

import { DraftRecoveryController } from '../src/persistence/DraftRecoveryController.js';
import {
    DATABASE_NAME,
    DraftStore
} from '../src/persistence/DraftStore.js';

class FakeRequest extends EventTarget {
    result = undefined;
    error = null;
}

class FakeDatabase {
    constructor(state) {
        this.state = state;
        this.objectStoreNames = { contains: name => state.stores.has(name) };
    }

    createObjectStore(name) {
        const records = new Map();
        this.state.stores.set(name, records);
        return records;
    }

    transaction(name) {
        const transaction = new EventTarget();
        transaction.error = null;
        transaction.objectStore = () => {
            const records = this.state.stores.get(name);
            const request = operation => {
                const result = new FakeRequest();
                queueMicrotask(() => {
                    try {
                        result.result = operation(records);
                        result.dispatchEvent(new Event('success'));
                        queueMicrotask(() => transaction.dispatchEvent(new Event('complete')));
                    } catch (error) {
                        result.error = error;
                        transaction.error = error;
                        result.dispatchEvent(new Event('error'));
                        transaction.dispatchEvent(new Event('abort'));
                    }
                });
                return result;
            };
            return {
                get: id => request(store => structuredClone(store.get(id))),
                put: value => request(store => {
                    store.set(value.id, structuredClone(value));
                    return value.id;
                }),
                delete: id => request(store => store.delete(id))
            };
        };
        return transaction;
    }

    close() {}
}

class FakeIndexedDB {
    constructor() {
        this.databases = new Map();
        this.openedNames = [];
    }

    open(name) {
        this.openedNames.push(name);
        const request = new FakeRequest();
        queueMicrotask(() => {
            let state = this.databases.get(name);
            const isNew = !state;
            if (!state) {
                state = { stores: new Map() };
                this.databases.set(name, state);
            }
            request.result = new FakeDatabase(state);
            if (isNew) request.dispatchEvent(new Event('upgradeneeded'));
            request.dispatchEvent(new Event('success'));
        });
        return request;
    }
}

test('draft autosave keeps the latest editable snapshot in its isolated store', async () => {
    const saved = [];
    const store = {
        save: async draft => { saved.push(draft); return true; },
        load: async () => null,
        clear: async () => true,
        dispose() {}
    };
    let width = 500;
    const controller = new DraftRecoveryController({
        store,
        createDraft: () => ({
            presetName: 'Airis',
            snapshot: { settings: { frontWidth: width }, document: {} }
        }),
        documentRef: null,
        debounceMs: 1
    });

    controller.scheduleSave();
    width = 640;
    await controller.saveNow();

    assert.equal(saved.length, 1);
    assert.equal(saved[0].presetName, 'Airis');
    assert.equal(saved[0].snapshot.settings.frontWidth, 640);
    controller.dispose();
});

test('recovery is offered only for a valid versioned document draft', async () => {
    const draft = {
        version: 1,
        snapshot: { settings: { frontWidth: 500 }, document: { textBlocks: [] } }
    };
    const store = { load: async () => draft, dispose() {} };
    const controller = new DraftRecoveryController({ store, documentRef: null });
    let presented = null;
    controller.present = value => { presented = value; return true; };

    assert.equal(await controller.checkForRecovery(), true);
    assert.equal(presented, draft);
    controller.dispose();
});

test('IndexedDB absence disables drafts without affecting the application', async () => {
    const store = new DraftStore({ indexedDBRef: null });

    assert.equal(await store.load(), null);
    assert.equal(await store.save({ snapshot: {} }), false);
    assert.equal(await store.clear(), false);
    assert.equal(store.dispose(), true);
});

test('Pizza draft survives a new store instance and clear remains namespace-local', async () => {
    const indexedDBRef = new FakeIndexedDB();
    const writer = new DraftStore({ indexedDBRef });
    assert.equal(await writer.save({
        presetName: 'Reload proof',
        snapshot: {
            settings: { frontWidth: 612 },
            document: { textBlocks: [{ id: 'persisted' }], graphicsBlocks: [] }
        }
    }), true);
    writer.dispose();

    const readerAfterReload = new DraftStore({ indexedDBRef });
    const restored = await readerAfterReload.load();
    assert.equal(restored.version, 1);
    assert.equal(restored.presetName, 'Reload proof');
    assert.equal(restored.snapshot.settings.frontWidth, 612);
    assert.ok(Number.isFinite(Date.parse(restored.savedAt)));
    assert.deepEqual(indexedDBRef.openedNames, [DATABASE_NAME, DATABASE_NAME]);

    assert.equal(await readerAfterReload.clear(), true);
    const finalReload = new DraftStore({ indexedDBRef });
    assert.equal(await finalReload.load(), null);
    assert.deepEqual(indexedDBRef.openedNames, [DATABASE_NAME, DATABASE_NAME, DATABASE_NAME]);
    readerAfterReload.dispose();
    finalReload.dispose();
});
