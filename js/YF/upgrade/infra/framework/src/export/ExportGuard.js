function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function valuesEqual(left, right) {
    try { return JSON.stringify(left) === JSON.stringify(right); } catch (_) { return false; }
}

/**
 * Runs an export against a captured state and restores it if preparation or the
 * exporter mutates that state. This keeps preview/preset/history state stable.
 */
export class ExportGuard {
    constructor({ capture, restore, prepare, equals = valuesEqual } = {}) {
        this.capture = capture;
        this.restore = restore;
        this.prepare = prepare;
        this.equals = equals;
    }

    async run(format, operation) {
        if (typeof operation !== 'function') throw new TypeError('Export operation must be a function.');
        const canRestore = typeof this.capture === 'function' && typeof this.restore === 'function';
        const before = canRestore ? cloneValue(await this.capture({ format })) : null;
        try {
            if (typeof this.prepare === 'function') await this.prepare({ format });
            return await operation();
        } finally {
            if (canRestore) {
                const after = await this.capture({ format });
                if (!this.equals(before, after)) await this.restore(cloneValue(before), { format });
            }
        }
    }
}
