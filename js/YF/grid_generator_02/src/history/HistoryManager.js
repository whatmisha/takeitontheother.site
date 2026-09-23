import { cloneJson } from '../utils/cloneJson.js';
import { HistoryTransaction } from './HistoryTransaction.js';
import { SnapshotHistory } from './SnapshotHistory.js';

const serialize = cloneJson;
const compare = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/** Public undo/redo facade coordinating snapshots and semantic transactions. */
export class HistoryManager {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 50;
        this.stateSerializer = options.stateSerializer || serialize;
        this.stateComparator = options.stateComparator || compare;
        this.stack = options.stack || new SnapshotHistory({
            maxSize: this.maxSize,
            comparator: this.stateComparator,
            now: options.now
        });
        this.transaction = options.transaction || new HistoryTransaction({
            serializer: this.stateSerializer,
            comparator: this.stateComparator
        });
    }

    get history() { return this.stack.entries; }
    get historyIndex() { return this.stack.index; }
    get currentTransaction() { return this.transaction.current; }
    get isRestoring() { return this.transaction.isRestoring; }

    beginAction(label = '', currentState = null) {
        if (this.currentTransaction) this.cancelAction();
        return this.transaction.begin(label, currentState, this.historyIndex);
    }

    commitAction(afterState) {
        if (this.isRestoring) return false;
        if (!this.currentTransaction) return this.saveSnapshot(afterState);
        const result = this.transaction.finish(afterState);
        if (!result?.changed) return false;
        this.stack.push(result.state, result.label);
        return true;
    }

    cancelAction() {
        this.transaction.cancel();
    }

    saveSnapshot(state, label = '') {
        if (this.isRestoring) return false;
        if (this.currentTransaction) this.cancelAction();
        return this.stack.save(this.stateSerializer(state), label || 'snapshot');
    }

    undo() {
        if (this.currentTransaction) this.cancelAction();
        return this.stack.undo();
    }

    redo() {
        if (this.currentTransaction) this.cancelAction();
        return this.stack.redo();
    }

    canUndo() { return this.stack.canUndo(); }
    canRedo() { return this.stack.canRedo(); }
    getCurrentState() { return this.stack.current(); }

    clear() {
        this.stack.clear();
        this.cancelAction();
    }

    setRestoring(value) {
        this.transaction.setRestoring(value);
    }

    getHistoryInfo() {
        return {
            size: this.history.length,
            index: this.historyIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            hasTransaction: Boolean(this.currentTransaction),
            transactionLabel: this.currentTransaction?.label || null
        };
    }
}
