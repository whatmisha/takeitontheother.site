/**
 * HistoryManager — undo/redo stacks for app state.
 *
 * Snapshot-based: keeps full deep-cloned state payloads. Supports transactions
 * grouping several logical updates (e.g., slider drags) into one undo step.
 *
 * Basic flow:
 *   const history = new HistoryManager({ maxSize: 50 });
 *
 *   // Instant action
 *   history.saveSnapshot(getState(), 'toggle grid');
 *
 *   // Transaction (drag burst, multiple setters)
 *   history.beginAction('adjust stem', getState());
 *   // ... mutate state ...
 *   history.commitAction(getState());
 *
 *   // Roll back
 *   const prev = history.undo();
 *   if (prev) applyState(prev);
 */
export class HistoryManager {
    /**
     * @param {Object} [options]
     * @param {number} [options.maxSize=50] — max stack depth
     * @param {Function} [options.stateSerializer] — custom state serializer
     * @param {Function} [options.stateComparator] — custom equality check
     */
    constructor(options = {}) {
        this.maxSize = options.maxSize || 50;
        this.stateSerializer = options.stateSerializer || this._defaultSerializer;
        this.stateComparator = options.stateComparator || this._defaultComparator;

        this.history = [];
        this.historyIndex = -1;
        this.currentTransaction = null;
        this.isRestoring = false;
    }

    _defaultSerializer(state) {
        return JSON.parse(JSON.stringify(state));
    }

    _defaultComparator(state1, state2) {
        return JSON.stringify(state1) === JSON.stringify(state2);
    }

    /**
     * Start a transaction capturing the "before" snapshot.
     * @param {string} [label] — debug label
     * @param {Object} [currentState] — pre-mutation state
     */
    beginAction(label = '', currentState = null) {
        if (this.isRestoring) return;

        if (this.currentTransaction) {
            this.cancelAction();
        }

        const beforeState = currentState ? this.stateSerializer(currentState) : null;

        this.currentTransaction = {
            label,
            beforeState,
            startIndex: this.historyIndex
        };
    }

    /**
     * Finish a transaction — no-op append if before/after snapshots match.
     * @param {Object} afterState
     * @returns {boolean} true when a history entry was appended
     */
    commitAction(afterState) {
        if (this.isRestoring) return false;

        if (!this.currentTransaction) {
            return this.saveSnapshot(afterState);
        }

        const { beforeState, label } = this.currentTransaction;
        const serializedAfter = this.stateSerializer(afterState);

        if (beforeState && this.stateComparator(beforeState, serializedAfter)) {
            this.currentTransaction = null;
            return false;
        }

        const safeIndex = Math.max(0, this.historyIndex);
        if (this.history.length > 0) {
            this.history = this.history.slice(0, safeIndex + 1);
        }

        this.history.push({
            state: serializedAfter,
            label: label || 'action',
            timestamp: Date.now()
        });

        this.historyIndex = this.history.length - 1;

        if (this.history.length > this.maxSize) {
            this.history.shift();
            this.historyIndex--;
        }

        this.currentTransaction = null;
        return true;
    }

    /**
     * Abort the in-flight transaction without mutating history.
     */
    cancelAction() {
        this.currentTransaction = null;
    }

    /**
     * Push a standalone snapshot (instant actions).
     * @param {Object} state
     * @param {string} [label]
     * @returns {boolean} true when appended
     */
    saveSnapshot(state, label = '') {
        if (this.isRestoring) return false;

        if (this.currentTransaction) {
            this.cancelAction();
        }

        const serializedState = this.stateSerializer(state);

        if (
            this.history.length > 0 &&
            this.historyIndex >= 0 &&
            this.historyIndex < this.history.length
        ) {
            const lastState = this.history[this.historyIndex].state;
            if (this.stateComparator(lastState, serializedState)) {
                return false;
            }
        }

        if (this.history.length === 0) {
            this.history.push({
                state: serializedState,
                label: label || 'snapshot',
                timestamp: Date.now()
            });
            this.historyIndex = 0;
            return true;
        }

        const safeIndex = Math.max(0, Math.min(this.historyIndex, this.history.length - 1));
        this.history = this.history.slice(0, safeIndex + 1);

        this.history.push({
            state: serializedState,
            label: label || 'snapshot',
            timestamp: Date.now()
        });

        this.historyIndex = this.history.length - 1;

        if (this.history.length > this.maxSize) {
            this.history.shift();
            this.historyIndex--;
        }

        return true;
    }

    /**
     * Navigate one step backward in the undo stack.
     * @returns {Object|null}
     */
    undo() {
        if (!this.canUndo()) return null;

        if (this.currentTransaction) {
            this.cancelAction();
        }

        this.historyIndex--;
        if (this.historyIndex < 0) this.historyIndex = 0;

        return this.history[this.historyIndex].state;
    }

    /**
     * Reapply the next forward snapshot after undo().
     * @returns {Object|null}
     */
    redo() {
        if (!this.canRedo()) return null;

        if (this.currentTransaction) {
            this.cancelAction();
        }

        this.historyIndex++;
        if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length - 1;
            return null;
        }

        return this.history[this.historyIndex].state;
    }

    canUndo() {
        return this.history.length > 0 && this.historyIndex > 0;
    }

    canRedo() {
        return this.history.length > 0 && this.historyIndex < this.history.length - 1;
    }

    getCurrentState() {
        if (this.history.length === 0) return null;
        const safeIndex = Math.max(0, Math.min(this.historyIndex, this.history.length - 1));
        return this.history[safeIndex].state;
    }

    clear() {
        this.history = [];
        this.historyIndex = -1;
        this.currentTransaction = null;
    }

    /**
     * Suppress history writes while hydrating external snapshots.
     * @param {boolean} value
     */
    setRestoring(value) {
        this.isRestoring = value;
    }

    /**
     * Debug summary of stack health.
     * @returns {Object}
     */
    getHistoryInfo() {
        return {
            size: this.history.length,
            index: this.historyIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            hasTransaction: !!this.currentTransaction,
            transactionLabel: this.currentTransaction?.label || null
        };
    }
}
