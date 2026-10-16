import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PresetStore, PresetSession, ApplicationShell } from '../../infra/framework/src/index.js';
import { migrateLibrary, migrateNotation } from '../library.js';
import { DEFAULTS, normalize, layoutText, parseBody, creditsToText } from '../model.js';
import { presetDocument, parsePreset } from '../document.js';
import { expandedCredits, FULL_CREDITS_NAME } from '../expanded-credits.js';
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
const measure = (text, size) => [...text].length * size / 2;
test('unified migration preserves projects, enriches styles with current content and seeds extended credits once', () => {
    const storage = memory(); globalThis.localStorage = storage;
    const current = normalize({ title: 'Current logo', body: 'Current body', contentMode: 'credits', speed: 75, fontSize: 65, credits: [{ role: 'Current', name: '@person' }] });
    const legacy = { projects: 'old-projects', styles: 'old-styles' };
    const original = presetDocument(current, 'Keep'); original.schemaVersion = 1; original.settings = { ...current, contentMode: 'text', credits: [] };
    storage.setItem(legacy.projects, JSON.stringify({ 'item:Keep': original }));
    storage.setItem(legacy.styles, JSON.stringify({ 'item:Keep': { style: { speed: 30 } } }));
    const store = new PresetStore({ storageKey: 'presets' });
    migrateLibrary(store, current, { storage, legacyKeys: legacy });
    assert.deepEqual(parsePreset(store.load('Keep')).settings, current);
    const style = store.load('Keep (2)').settings;
    assert.equal(style.speed, 30); assert.equal(style.body, current.body); assert.equal(style.title, current.title);
    const full = store.load(FULL_CREDITS_NAME).settings;
    assert.equal(full.speed, current.speed); assert.equal(full.fontSize, current.fontSize); assert.equal(full.title, current.title);
    assert.equal(parseBody(full.body).length, 19); assert.equal(parseBody(full.body).filter(row => row.kind === 'heading').length, 2);
    const before = storage.getItem('presets');
    migrateLibrary(store, DEFAULTS, { storage, legacyKeys: legacy });
    assert.equal(storage.getItem('presets'), before); assert.ok(storage.getItem(legacy.projects)); assert.ok(storage.getItem(legacy.styles));
});
test('failed migration retains old data and can safely retry', () => {
    const storage = memory(); globalThis.localStorage = storage;
    const store = new PresetStore({ storageKey: 'presets' }); const saveAll = store.saveAll;
    store.saveAll = () => false;
    assert.throws(() => migrateLibrary(store, DEFAULTS, { storage }));
    assert.equal(storage.getItem('presets:unified-v1'), null);
    store.saveAll = saveAll; migrateLibrary(store, DEFAULTS, { storage });
    assert.ok(store.has(FULL_CREDITS_NAME));
});
test('presets switch content and styles together, including team headings; shipped JSON round trips', () => {
    globalThis.localStorage = memory(); const store = new PresetStore({ storageKey: 'presets' });
    let settings = normalize({ contentMode: 'credits' });
    const session = new PresetSession({ store, snapshot: () => settings, restore: s => { settings = normalize(s); }, collect: () => presetDocument(settings), apply: doc => { settings = normalize(doc.settings); } });
    session.saveAs('Original'); const original = structuredClone(settings);
    settings = expandedCredits({ ...settings, speed: 80 }); session.saveAs('Extended');
    session.switchTo('Original'); assert.deepEqual(settings, original);
    session.switchTo('Extended'); assert.equal(settings.speed, 80); assert.equal(parseBody(settings.body).length, 19);
    for (const filename of ['lunnen-airis.json', 'lunnen-airis-full.json', 'draft.json']) assert.ok(parsePreset(readFileSync(new URL('../presets/' + filename, import.meta.url), 'utf8')));
});
test('headings span the full ribbon, center independently of columns and separate teams vertically', () => {
    const settings = expandedCredits(normalize({ contentMode: 'credits' }));
    const lines = layoutText(settings, measure).lines, step = settings.fontSize * settings.lineHeight;
    const first = lines.find(line => line.text === 'Lunnen team');
    const second = lines.find(line => line.text === 'Photo production team');
    assert.equal(first.alignment, 'center'); assert.equal(first.width, undefined); assert.equal(first.y, 0);
    const before = lines.filter(line => line.y < second.y).at(-1), after = lines.find(line => line.y > second.y);
    assert.ok(second.y - before.y >= step * 2); assert.ok(after.y - second.y >= step * 2);
    assert.ok(lines.some(line => line.text.includes('Sergey')));
    assert.ok(!settings.body.includes('@galizdra')); assert.ok(settings.body.includes('product manager | Sergey Kharchenko'));
});
test('native preset save and unsaved guard report storage failure without discarding the draft', async () => {
    const shell = Object.create(ApplicationShell.prototype); let refreshed = 0, toast = '';
    shell.presets = { isDirty: true, isEphemeral: false, currentName: 'Original', saveCurrent: () => ({ ok: false }) };
    shell._refreshChrome = () => refreshed++; shell._showToast = text => { toast = text; };
    shell.dialog = { show: async () => ({ action: 'save' }) };
    assert.equal(await shell.savePreset(), false); assert.equal(await shell._guardUnsaved(), false);
    assert.equal(refreshed, 2); assert.ok(toast.includes('could not be saved'));
});
test('preset store handles malformed containers and prototype-like names', () => {
    globalThis.localStorage = memory(); const store = new PresetStore({ storageKey: 'presets' });
    for (const value of ['null', '[]', '3']) { localStorage.setItem('presets', value); assert.deepEqual(store.getNames(), []); }
    assert.ok(store.create('__proto__', presetDocument(DEFAULTS)).ok);
    assert.ok(store.has('__proto__')); assert.equal(store.load('__proto__').settings.speed, 120);
});

test('v2 notation migration preserves active rows, metadata and a recoverable original backup', () => {
    const storage = memory(); globalThis.localStorage = storage;
    const store = new PresetStore({ storageKey: 'inline' });
    const credits = [{ role: 'Team', name: '', kind: 'heading' }, { role: 'Role', name: '@person' }];
    const old = { ...presetDocument(DEFAULTS, 'Legacy'), schemaVersion: 2, migrationId: 'old', createdAt: 123, settings: { ...DEFAULTS, contentMode: 'credits', credits, body: 'Inactive content' } };
    store.saveAll({ Legacy: old }); const before = storage.getItem('inline');
    migrateNotation(store, storage);
    assert.equal(storage.getItem('inline:before-inline-v3'), before);
    const converted = store.load('Legacy');
    assert.equal(converted.settings.body, creditsToText(credits)); assert.equal(converted.schemaVersion, 5);
    assert.equal(converted.createdAt, 123); assert.equal(converted.migrationId, 'old');
    assert.ok(!('contentMode' in converted.settings) && !('credits' in converted.settings));
    assert.equal(parsePreset({ ...old, settings: { ...old.settings, contentMode: 'text' } }).settings.body, 'Inactive content');
    const after = storage.getItem('inline'); migrateNotation(store, storage); assert.equal(storage.getItem('inline'), after);
});
