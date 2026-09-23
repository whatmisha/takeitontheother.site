import assert from 'node:assert/strict';
import test from 'node:test';
import { importPreviousDraft, readLegacyDraft } from '../src/persistence/LegacyDraftMigration.js';
const draft = { version: 1, savedAt: '2026-09-01T10:00:00Z', snapshot: { settings: { width: 500 }, document: {} } };
function fixture() {
    const values = new Map(); let imports = 0;
    return { storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }, values,
        read: async () => draft, store: { importIfEmpty: async value => { imports++; return value; } }, count: () => imports };
}
test('previous draft is imported once, preserving the original timestamp', async () => {
    const f = fixture();
    assert.equal(await importPreviousDraft(f.store, null, f), draft);
    assert.equal(await importPreviousDraft(f.store, null, f), null);
    assert.equal(f.count(), 1);
    assert.equal(draft.savedAt, '2026-09-01T10:00:00Z');
});
test('a current new-version draft is never replaced by a previous draft', async () => {
    const f = fixture(), current = { ...draft, savedAt: '2026-09-23T00:00:00Z' };
    assert.equal(await importPreviousDraft(f.store, current, f), current);
    assert.equal(f.count(), 0);
});
test('failed import remains retryable, and a racing new draft wins', async () => {
    const f = fixture(); f.store.importIfEmpty = async () => null;
    assert.equal(await importPreviousDraft(f.store, null, f), null);
    assert.equal(f.values.size, 0);
    const concurrent = { ...draft, presetName: 'New work' };
    f.store.importIfEmpty = async () => concurrent;
    assert.equal(await importPreviousDraft(f.store, null, f), concurrent);
});
test('missing, unsupported or denied legacy databases do not create a database or block startup', async () => {
    let opened = false;
    assert.equal(await readLegacyDraft({ databases: async () => [], open() { opened = true; } }), null);
    assert.equal(await readLegacyDraft({}), null);
    assert.equal(await readLegacyDraft({ databases: async () => { throw new Error('denied'); } }), null);
    assert.equal(opened, false);
});
