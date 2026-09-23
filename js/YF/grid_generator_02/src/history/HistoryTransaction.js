/** Captures before/after state for one semantic history action. */
export class HistoryTransaction {
    constructor({ serializer, comparator } = {}) {
        this.serializer = serializer;
        this.comparator = comparator;
        this.current = null;
        this.isRestoring = false;
    }

    begin(label = '', state = null, startIndex = -1) {
        if (this.isRestoring) return false;
        this.current = {
            label,
            beforeState: state == null ? null : this.serializer(state),
            startIndex
        };
        return true;
    }

    finish(afterState) {
        if (this.isRestoring || !this.current) return null;
        const transaction = this.current;
        this.current = null;
        const state = this.serializer(afterState);
        if (transaction.beforeState && this.comparator(transaction.beforeState, state)) {
            return { changed: false, state, label: transaction.label };
        }
        return { changed: true, state, label: transaction.label || 'action' };
    }

    cancel() {
        this.current = null;
    }

    setRestoring(value) {
        this.isRestoring = Boolean(value);
        if (this.isRestoring) this.cancel();
    }
}
