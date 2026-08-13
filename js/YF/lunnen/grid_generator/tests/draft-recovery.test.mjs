import test from 'node:test';
import assert from 'node:assert/strict';

import { DraftRecoveryController } from '../src/persistence/DraftRecoveryController.js';
import { DraftStore } from '../src/persistence/DraftStore.js';

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
