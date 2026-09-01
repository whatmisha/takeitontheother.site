import { HistoryManager } from '../history/HistoryManager.js';

/** Reserved name for the ephemeral "opened from a share link" slot. */
export const SHARED_SLOT = '__shared__';

/** Reserved name for the ephemeral "+ New" (clean defaults) slot. */
export const NEW_SLOT = '__new__';

/**
 * PresetSession — ties together PresetStore, per-preset undo/redo history and the
 * ephemeral "shared" slot into one stateful coordinator.
 *
 * The app injects two pure callbacks:
 *   - `snapshot()`  → a serialisable snapshot of the full editable state
 *   - `restore(s)`  → apply such a snapshot back into the app
 * and optionally `collect()` / `apply()` if the persisted preset blob differs
 * from the history snapshot (defaults to snapshot/restore).
 *
 * It does NOT show dialogs — the host decides how to confirm overwrites etc.
 */
export class PresetSession {
    /**
     * @param {Object} config
     * @param {import('./PresetStore.js').PresetStore} config.store
     * @param {() => Object} config.snapshot — current state snapshot (history + save)
     * @param {(snap:Object) => void} config.restore — apply a snapshot
     * @param {() => Object} [config.collect] — preset blob to persist (defaults to snapshot)
     * @param {(blob:Object) => void} [config.apply] — load a preset blob (defaults to restore)
     * @param {number} [config.historyMaxSize=50]
     * @param {() => void} [config.onChange] — fired when current/dirty changes
     */
    constructor(config) {
        this.store = config.store;
        this.snapshotFn = config.snapshot;
        this.restoreFn = config.restore;
        this.collectFn = config.collect || config.snapshot;
        this.applyFn = config.apply || config.restore;
        this.historyMaxSize = config.historyMaxSize ?? 50;
        this.onChange = config.onChange || (() => {});

        /** @type {Map<string, HistoryManager>} */
        this.histories = new Map();
        this.currentName = null;
        this._dirty = false;
        this._sharedBlob = null;
    }

    /* --------------------------------- state --------------------------------- */

    get isDirty() { return this._dirty; }
    get isShared() { return this.currentName === SHARED_SLOT; }
    get isNew() { return this.currentName === NEW_SLOT || this.currentName == null; }
    /** True for reserved, non-persisted slots (New / shared). */
    get isEphemeral() { return this.currentName === NEW_SLOT || this.currentName === SHARED_SLOT || this.currentName == null; }

    /** Mark current preset dirty (call from settings change tracking). */
    markDirty() {
        if (!this._dirty) {
            this._dirty = true;
            this.onChange();
        }
    }

    markClean() {
        if (this._dirty) {
            this._dirty = false;
            this.onChange();
        }
    }

    /** History stack for the current preset (lazily created). */
    history() {
        if (!this.currentName) return null;
        if (!this.histories.has(this.currentName)) {
            this.histories.set(this.currentName, new HistoryManager({ maxSize: this.historyMaxSize }));
        }
        return this.histories.get(this.currentName);
    }

    /* ------------------------------- navigation ------------------------------- */

    /**
     * Make `name` the active preset and apply its stored blob.
     * @param {string} name
     * @param {Object} [opts]
     * @param {boolean} [opts.apply=true] — load the blob into the app
     */
    switchTo(name, { apply = true } = {}) {
        this.currentName = name;
        this._dirty = false;
        if (apply && name !== SHARED_SLOT) {
            const blob = this.store.load(name);
            if (blob) this.applyFn(blob);
        } else if (apply && name === SHARED_SLOT && this._sharedBlob) {
            this.applyFn(this._sharedBlob);
        }
        // Seed the per-preset history baseline.
        const h = this.history();
        if (h) { h.clear(); h.saveSnapshot(this.snapshotFn(), `open:${name}`); }
        this.onChange();
    }

    /* --------------------------------- saving --------------------------------- */

    /** Persist current state into the current preset (must not be the shared slot). */
    saveCurrent() {
        if (this.isEphemeral) return { ok: false, reason: 'no-target' };
        const ok = this.store.update(this.currentName, this.collectFn());
        if (ok) this.markClean();
        return { ok };
    }

    /** Save current state under a new name and switch to it. */
    saveAs(name, { overwrite = false } = {}) {
        const res = this.store.create(name, this.collectFn(), { overwrite });
        if (res.ok) {
            this.currentName = name.trim();
            this._dirty = false;
            const h = this.history();
            if (h) { h.clear(); h.saveSnapshot(this.snapshotFn(), `save:${name}`); }
            this.onChange();
        }
        return res;
    }

    rename(newName, name = this.currentName) {
        if (!name || name === SHARED_SLOT || name === NEW_SLOT) return { ok: false, reason: 'no-target' };
        const old = name;
        const res = this.store.rename(old, newName);
        if (res.ok) {
            if (this.histories.has(old)) {
                this.histories.set(newName.trim(), this.histories.get(old));
                this.histories.delete(old);
            }
            if (this.currentName === old) this.currentName = newName.trim();
            this.onChange();
        }
        return res;
    }

    delete(name = this.currentName) {
        const ok = this.store.delete(name);
        if (ok) {
            this.histories.delete(name);
            if (this.currentName === name) this.currentName = null;
            this.onChange();
        }
        return ok;
    }

    /**
     * Delete every persisted preset (the reserved New/shared slots are not
     * persisted, so they are untouched in storage). Leaves the session on a
     * blank slot; the host typically follows with `openNew(defaults)`.
     */
    deleteAll() {
        const names = this.store.getNames();
        for (const n of names) this.store.delete(n);
        this.histories.clear();
        this._sharedBlob = null;
        this.currentName = null;
        this._dirty = false;
        this.onChange();
        return true;
    }

    /* --------------------------------- New slot -------------------------------- */

    /**
     * Enter the ephemeral "+ New" slot with a clean defaults blob. Behaves like
     * switchTo but is not backed by storage, so it can never be saved over by
     * name (the host's Save flow routes New through `saveAs`).
     * @param {Object} [defaultsBlob] - blob to apply (pristine defaults)
     */
    openNew(defaultsBlob = null) {
        this._sharedBlob = null;
        this.currentName = NEW_SLOT;
        this._dirty = false;
        if (defaultsBlob) this.applyFn(defaultsBlob);
        const h = this.history();
        if (h) { h.clear(); h.saveSnapshot(this.snapshotFn(), 'open:new'); }
        this.onChange();
    }

    /* ----------------------------- history actions ----------------------------- */

    commit(label = 'change') {
        const h = this.history();
        if (h) h.saveSnapshot(this.snapshotFn(), label);
    }

    undo() {
        const h = this.history();
        if (!h || !h.canUndo()) return false;
        const snap = h.undo();
        if (snap) { this.restoreFn(snap); return true; }
        return false;
    }

    redo() {
        const h = this.history();
        if (!h || !h.canRedo()) return false;
        const snap = h.redo();
        if (snap) { this.restoreFn(snap); return true; }
        return false;
    }

    canUndo() { return !!this.history()?.canUndo(); }
    canRedo() { return !!this.history()?.canRedo(); }

    /* ------------------------------- shared slot ------------------------------- */

    /** Open a blob (decoded from a share link) into the ephemeral shared slot. */
    openShared(blob) {
        this._sharedBlob = JSON.parse(JSON.stringify(blob));
        this.switchTo(SHARED_SLOT, { apply: true });
    }

    /** Persist the shared slot into the library under a permanent name. */
    saveSharedToLibrary(name, opts = {}) {
        if (this.currentName !== SHARED_SLOT) return { ok: false, reason: 'not-shared' };
        const res = this.store.create(name, this.collectFn(), opts);
        if (res.ok) {
            this._sharedBlob = null;
            this.currentName = name.trim();
            this._dirty = false;
            this.onChange();
        }
        return res;
    }

    discardShared() {
        this._sharedBlob = null;
        if (this.currentName === SHARED_SLOT) this.currentName = null;
        this.onChange();
    }
}
