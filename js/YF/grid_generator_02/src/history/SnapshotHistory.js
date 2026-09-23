/** Stores serialized snapshots, branch truncation and the undo/redo cursor. */
export class SnapshotHistory {
    constructor({ maxSize = 50, comparator, now = () => Date.now() } = {}) {
        this.maxSize = maxSize;
        this.comparator = comparator;
        this.now = now;
        this.entries = [];
        this.index = -1;
    }

    save(state, label = 'snapshot') {
        const current = this.current();
        if (current && this.comparator(current, state)) return false;
        this.push(state, label);
        return true;
    }

    push(state, label = 'action') {
        if (this.entries.length > 0) {
            const safeIndex = Math.max(0, Math.min(this.index, this.entries.length - 1));
            this.entries = this.entries.slice(0, safeIndex + 1);
        }
        this.entries.push({ state, label, timestamp: this.now() });
        this.index = this.entries.length - 1;
        if (this.entries.length > this.maxSize) {
            this.entries.shift();
            this.index -= 1;
        }
    }

    undo() {
        if (!this.canUndo()) return null;
        this.index -= 1;
        return this.current();
    }

    redo() {
        if (!this.canRedo()) return null;
        this.index += 1;
        return this.current();
    }

    canUndo() {
        return this.entries.length > 0 && this.index > 0;
    }

    canRedo() {
        return this.entries.length > 0 && this.index < this.entries.length - 1;
    }

    current() {
        if (this.entries.length === 0) return null;
        const safeIndex = Math.max(0, Math.min(this.index, this.entries.length - 1));
        return this.entries[safeIndex].state;
    }

    clear() {
        this.entries = [];
        this.index = -1;
    }
}
