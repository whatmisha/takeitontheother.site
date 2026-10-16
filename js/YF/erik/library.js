import { svgBitmap, loadLottie } from './ending-assets.js';
import { PRESET_MAX_BYTES } from './ending-model.js';
import { FileIntakeController, PresetMenuKeyboardController } from '../infra/framework/src/index.js';
import { DEFAULTS, normalize } from './model.js';
import { presetDocument, presetName, parsePreset, applyStyle } from './document.js';
import { FULL_CREDITS_NAME, expandedCredits } from './expanded-credits.js';
import { download } from './exporter.js';
export const PRESET_KEY = 'upgrade:erik:presets:v1';
export const LEGACY_KEYS = { projects: 'upgrade:erik:projects:v1', styles: 'upgrade:erik:styles:v1' };
const $ = id => document.getElementById(id);
const serial = settings => JSON.stringify(normalize(settings));
function readMap(storage, key) {
    try { const value = JSON.parse(storage.getItem(key)); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch { return {}; }
}
// One atomic additive migration. Originals remain available for recovery.
export function migrateLibrary(store, current, { storage = localStorage, legacyKeys = LEGACY_KEYS } = {}) {
    const marker = store.storageKey + ':unified-v1';
    if (storage.getItem(marker) === '1') return migrateNotation(store, storage);
    const all = Object.assign(Object.create(null), store.loadAll());
    const add = (name, settings, migrationId) => {
        if (Object.values(all).some(value => value?.migrationId === migrationId)) return;
        let unique = name, suffix = 2;
        while (Object.hasOwn(all, unique)) unique = `${name} (${suffix++})`;
        all[unique] = { ...presetDocument(settings, unique), migrationId, createdAt: Date.now(), updatedAt: Date.now() };
    };
    for (const [key, doc] of Object.entries(readMap(storage, legacyKeys.projects))) {
        if (!key.startsWith('item:')) continue;
        try { const parsed = parsePreset(doc); add(parsed.name, parsed.settings, `project:${key}`); }
        catch { /* Keep unsupported legacy entries untouched in their original storage. */ }
    }
    for (const [key, doc] of Object.entries(readMap(storage, legacyKeys.styles))) {
        if (!key.startsWith('item:') || !doc?.style || typeof doc.style !== 'object') continue;
        try { add(presetName(key.slice(5)), applyStyle(current, doc.style), `style:${key}`); } catch { /* Preserve original. */ }
    }
    if (!Object.hasOwn(all, 'Lunnen Airis')) add('Lunnen Airis', DEFAULTS, 'original');
    add(FULL_CREDITS_NAME, expandedCredits(current), 'full-credits');
    if (!store.saveAll(all)) throw new Error('Presets could not be migrated. The original libraries and draft are intact.');
    storage.setItem(marker, '1');
    migrateNotation(store, storage);
}
export function migrateNotation(store, storage = localStorage) {
    const all = store.loadAll(), changed = Object.values(all).some(doc => [1, 2].includes(doc?.schemaVersion));
    if (!changed) return;
    const backup = store.storageKey + ':before-inline-v3';
    if (!storage.getItem(backup)) storage.setItem(backup, JSON.stringify(all));
    const next = Object.fromEntries(Object.entries(all).map(([name, doc]) => {
        if (![1, 2].includes(doc?.schemaVersion)) return [name, doc];
        const converted = parsePreset(doc);
        return [name, { ...doc, ...converted, name }];
    }));
    if (!store.saveAll(next)) throw new Error('Presets could not be upgraded. The original library is backed up.');
}
// Refresh shipped Draft once per revision; preserve deletions and unrelated custom names.
export const DRAFT_PRESET_REVISION = '2';
export async function seedDraftPreset(store, assetStorage, { storage = localStorage, load = async () => {
    const response = await fetch(new URL('./presets/draft.json', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error('Draft preset could not be loaded. Reload to retry.');
    return response.json();
} } = {}) {
    const marker = store.storageKey + ':draft-revision', legacyMarker = store.storageKey + ':draft-v1';
    if (storage.getItem(marker) === DRAFT_PRESET_REVISION) return null;
    const wasSeeded = storage.getItem(legacyMarker) === '1' || storage.getItem(marker) !== null;
    const previous = store.load('Draft');
    if ((!previous && wasSeeded) || (previous && !wasSeeded)) {
        storage.setItem(marker, DRAFT_PRESET_REVISION); return null;
    }
    const current = parsePreset(await load());
    await assetStorage.prepare(current.settings.endingAsset);
    if (!store.create('Draft', current, { overwrite: Boolean(previous) }).ok) throw new Error('Draft preset could not be saved. Reload to retry.');
    storage.setItem(marker, DRAFT_PRESET_REVISION);
    storage.setItem(legacyMarker, '1');
    return { previous, current };
}
export class PresetLibrary {
    constructor({ app, status, changed, assetStorage }) { Object.assign(this, { app, status, changed, assetStorage }); this.abort = new AbortController(); }
    get currentName() { return this.app.presets.isEphemeral ? null : this.app.presets.currentName; }
    sync() {
        const session = this.app.presets;
        // Compare full content as well as settings; undo back to the saved state is clean.
        const stored = this.currentName && this.app.presetStore.load(this.currentName);
        const clean = serial(stored?.settings || DEFAULTS) === serial(this.app.getSnapshot());
        if (!session.isShared && clean && session.isDirty) session.markClean();
        else if (!session.isShared && !clean && !session.isDirty) session.markDirty();
        $('presetStatus').textContent = this.currentName
            ? `${this.currentName}${session.isDirty ? ' · Unsaved changes' : ''}` : session.isShared ? 'Shared preset' : session.isDirty ? 'Unsaved preset' : 'New preset';
    }
    init() {
        this.intake = new FileIntakeController({ input: 'presetFile', accept: '.json,application/json', maxBytes: PRESET_MAX_BYTES,
            onSelect: async file => {
                const doc = parsePreset(await file.text());
                if (doc.settings.endingAsset) {
                    const resource = doc.settings.endingAsset.kind === 'svg' ? await svgBitmap(doc.settings.endingAsset) : await loadLottie(doc.settings.endingAsset);
                    if (doc.settings.endingAsset.kind === 'svg') resource.close(); else resource.destroy();
                }
                await this.assetStorage?.prepare(doc.settings.endingAsset);
                if (await this.canLeave()) {
                    this.app.history.flush(); this.app.presets.openNew(doc);
                    this.app.presets.markDirty(); this.suggestedName = doc.name;
                    this.changed(); this.status('Preset imported. Save to keep it in this browser.');
                }
            }, onReject: result => this.status(result.message), onError: error => this.status(error.message)
        }).init();
        this.keyboard = new PresetMenuKeyboardController().init();
        this.sync(); return this;
    }
    async saveCopy() {
        const answer = await this.app.dialog.prompt({ title: 'Save preset as', text: 'Includes the logo, all text, the ending asset and every setting.', value: `${this.currentName || this.suggestedName || 'Lunnen Airis'} copy`, confirmText: 'Save' });
        if (!answer) return false;
        const name = presetName(answer), overwrite = this.app.presetStore.has(name);
        if (overwrite && !await this.app.dialog.confirm({ title: 'Replace preset?', text: name, confirmText: 'Replace' })) return false;
        this.app.history.flush();
        if (!this.app.presets.saveAs(name, { overwrite }).ok) throw new Error('Preset could not be saved. Download JSON as a backup.');
        this.sync(); this.changed(); this.status(`Saved “${name}”.`); return true;
    }
    async canLeave() {
        if (!this.app.presets.isDirty) return true;
        const result = await this.app.dialog.show({ title: 'Save changes?', text: 'Save this preset before importing another one.', buttons: [
            { id: 'save', text: 'Save', type: 'primary' }, { id: 'discard', text: 'Discard', type: 'secondary' }, { id: 'cancel', text: 'Cancel', type: 'ghost' }
        ] });
        return result.action === 'save' ? this.app.savePreset() : result.action === 'discard';
    }
    download() {
        const doc = presetDocument(this.app.getSnapshot(), this.currentName || this.suggestedName || 'Untitled');
        download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${doc.name.replace(/[\\/:*?"<>|]/g, '-')}.erik.json`);
        this.status('Preset JSON downloaded.');
    }
    destroy() { this.abort.abort(); this.intake?.destroy(); this.keyboard?.destroy(); }
}
