/** Deduplicates immutable SVG template loads and exposes cache measurements. */
export class SvgAssetTemplateCache {
    constructor() {
        this.entries = new Map();
        this.requests = 0;
        this.hits = 0;
    }

    load(key, loader) {
        if (this.entries.has(key)) {
            this.hits += 1;
            return this.entries.get(key);
        }
        this.requests += 1;
        const pending = Promise.resolve()
            .then(loader)
            .then(value => {
                if (value == null) this.entries.delete(key);
                return value;
            })
            .catch(error => {
                this.entries.delete(key);
                throw error;
            });
        this.entries.set(key, pending);
        return pending;
    }

    clear() {
        this.entries.clear();
    }

    getMetrics() {
        return Object.freeze({
            entries: this.entries.size,
            requests: this.requests,
            hits: this.hits
        });
    }
}
