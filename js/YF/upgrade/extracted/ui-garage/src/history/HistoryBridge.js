import { HISTORY_AUTOSNAPSHOT_DEBOUNCE_MS } from '../config/timings.js';

/**
 * HistoryBridge — decides *when* to record history.
 *
 * It sits between change events and a `commit(label)` function (typically
 * PresetSession.commit). It provides:
 *   - debounced auto-snapshots, so a burst of changes collapses into one entry
 *   - explicit transactions (begin/end) for continuous gestures like slider drags
 *   - a `restoring` guard so applying undo/redo doesn't record new history
 *
 * The bridge is storage-agnostic: it never holds snapshots itself.
 */
export class HistoryBridge {
    /**
     * @param {Object} config
     * @param {(label:string)=>void} config.commit — record a snapshot now
     * @param {number} [config.debounceMs]
     */
    constructor({ commit, debounceMs = HISTORY_AUTOSNAPSHOT_DEBOUNCE_MS } = {}) {
        this.commit = commit || (() => {});
        this.debounceMs = debounceMs;
        this._timer = null;
        this._pendingLabel = 'change';
        this._inTransaction = false;
        this._restoring = false;
    }

    /** True while applying undo/redo — callers should skip change tracking. */
    get isRestoring() { return this._restoring; }

    setRestoring(v) { this._restoring = !!v; }

    /** Run `fn` with the restoring guard set (auto-reset afterwards). */
    runRestoring(fn) {
        const prev = this._restoring;
        this._restoring = true;
        try { return fn(); }
        finally { this._restoring = prev; }
    }

    /**
     * Note a change. Ignored while restoring or inside a transaction (the
     * transaction commits a single snapshot on end). Otherwise schedules a
     * debounced snapshot.
     */
    notifyChange(label = 'change') {
        if (this._restoring || this._inTransaction) return;
        this.scheduleAutoSnapshot(label);
    }

    scheduleAutoSnapshot(label = 'change') {
        if (this._restoring) return;
        this._pendingLabel = label;
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            this._timer = null;
            this.commit(this._pendingLabel);
        }, this.debounceMs);
    }

    /** Flush any pending debounced snapshot immediately. */
    flush() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
            this.commit(this._pendingLabel);
        }
    }

    /** Cancel a pending debounced snapshot without committing. */
    cancelPending() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    /** Begin a continuous gesture — defers snapshots until endTransaction(). */
    beginTransaction(label = 'change') {
        this.cancelPending();
        this._inTransaction = true;
        this._pendingLabel = label;
    }

    /** End the gesture and record a single snapshot. */
    endTransaction() {
        if (!this._inTransaction) return;
        this._inTransaction = false;
        if (!this._restoring) this.commit(this._pendingLabel);
    }

    destroy() {
        this.cancelPending();
        this._inTransaction = false;
        this._restoring = false;
    }
}
