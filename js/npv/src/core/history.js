function clone(value) {
    return structuredClone(value);
}

function equal(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

export class HistoryManager {
    constructor(initialState, { limit = 100, debounceMs = 160 } = {}) {
        this.limit = limit;
        this.debounceMs = debounceMs;
        this.stack = [clone(initialState)];
        this.index = 0;
        this.pending = null;
        this.timer = null;
        this.transactionStart = null;
        this.onRestore = null;
    }

    schedule(state) {
        this.pending = clone(state);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), this.debounceMs);
    }

    flush() {
        clearTimeout(this.timer);
        this.timer = null;
        if (!this.pending) return;
        const snapshot = this.pending;
        this.pending = null;
        if (equal(snapshot, this.stack[this.index])) return;
        this.stack = this.stack.slice(0, this.index + 1);
        this.stack.push(snapshot);
        if (this.stack.length > this.limit) this.stack.shift();
        this.index = this.stack.length - 1;
    }

    begin(state) {
        this.flush();
        this.transactionStart = clone(state);
    }

    end(state) {
        if (!this.transactionStart) {
            this.schedule(state);
            return;
        }
        const start = this.transactionStart;
        this.transactionStart = null;
        if (equal(start, state)) return;
        this.pending = clone(state);
        this.flush();
    }

    undo() {
        this.flush();
        if (this.index <= 0) return null;
        this.index -= 1;
        return clone(this.stack[this.index]);
    }

    redo() {
        this.flush();
        if (this.index >= this.stack.length - 1) return null;
        this.index += 1;
        return clone(this.stack[this.index]);
    }

    reset(state) {
        clearTimeout(this.timer);
        this.timer = null;
        this.pending = null;
        this.transactionStart = null;
        this.stack = [clone(state)];
        this.index = 0;
    }
}
