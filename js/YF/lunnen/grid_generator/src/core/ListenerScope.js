/** Owns DOM listeners so a controller can bind once and dispose deterministically. */
export class ListenerScope {
    constructor() {
        this.entries = [];
        this.disposed = false;
    }

    listen(target, type, listener, options) {
        if (!target?.addEventListener || typeof listener !== 'function') return listener;
        if (this.disposed) throw new Error('Cannot bind a disposed listener scope');
        target.addEventListener(type, listener, options);
        this.entries.push({ target, type, listener, options });
        return listener;
    }

    dispose() {
        if (this.disposed) return false;
        this.disposed = true;
        for (const { target, type, listener, options } of this.entries.reverse()) {
            target.removeEventListener?.(type, listener, options);
        }
        this.entries = [];
        return true;
    }
}
