/** Disposes application-owned resources in reverse construction order. */
export class ApplicationLifecycle {
    constructor() {
        this.cleanups = [];
        this.disposed = false;
    }

    add(cleanup) {
        if (typeof cleanup !== 'function') return cleanup;
        if (this.disposed) cleanup();
        else this.cleanups.push(cleanup);
        return cleanup;
    }

    own(owner, method = 'dispose') {
        if (owner) this.add(() => owner[method]?.());
        return owner;
    }

    dispose() {
        if (this.disposed) return false;
        this.disposed = true;
        const errors = [];
        for (const cleanup of this.cleanups.reverse()) {
            try {
                cleanup();
            } catch (error) {
                errors.push(error);
            }
        }
        this.cleanups = [];
        if (errors.length) throw new AggregateError(errors, 'Application disposal failed');
        return true;
    }
}
