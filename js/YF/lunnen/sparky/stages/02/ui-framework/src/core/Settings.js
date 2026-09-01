/**
 * Settings — reactive key-value store for application state.
 *
 * Features:
 * - get / set with subscriber notification
 * - setMultiple for batch updates
 * - subscribe to a specific key or '*' for all changes
 * - silent mode (update without notifications)
 * - JSON serialize / deserialize
 * - reset to defaults
 * - dirty-tracking: knows which keys differ from the last "clean" baseline
 *   (used for unsaved-changes indicators and history)
 * - createProxy() for `settings.width` property-style access
 *
 * @example
 * const settings = new Settings({ width: 500, height: 300, color: '#fff' });
 * settings.subscribe('width', (newVal, oldVal) => console.log('width changed'));
 * settings.subscribe('*', (newVal, oldVal, key) => console.log(key, 'changed'));
 * settings.set('width', 600);
 */
export class Settings {
    /**
     * @param {Object} defaults — object with default values
     */
    constructor(defaults = {}) {
        this._defaults = JSON.parse(JSON.stringify(defaults));
        this.data = JSON.parse(JSON.stringify(defaults));
        this.listeners = {};
        /** Snapshot of values considered "saved/clean". */
        this._cleanSnapshot = JSON.stringify(this.data);
    }

    /** Alias kept for parity with apps that read `settings.values`. */
    get values() {
        return this.data;
    }

    get(key) {
        return this.data[key];
    }

    /**
     * @param {string} key
     * @param {*} value
     * @param {boolean} silent — do not notify subscribers
     */
    set(key, value, silent = false) {
        const oldValue = this.data[key];
        this.data[key] = value;
        if (!silent && !this._equal(oldValue, value)) {
            this._notify(key, value, oldValue);
        }
    }

    setMultiple(updates, silent = false) {
        for (const [key, value] of Object.entries(updates)) {
            this.set(key, value, silent);
        }
    }

    getAll() {
        return { ...this.data };
    }

    getDefaults() {
        return JSON.parse(JSON.stringify(this._defaults));
    }

    /**
     * Subscribe to a setting change.
     * @param {string} key — a key, or '*' for all keys
     * @param {Function} callback — (newValue, oldValue, key)
     * @returns {Function} — unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);
        return () => {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        };
    }

    reset() {
        this.data = JSON.parse(JSON.stringify(this._defaults));
        this._notify('*', this.data, {});
    }

    /* ----------------------------- dirty tracking ----------------------------- */

    /** Mark the current values as the clean/saved baseline. */
    markClean() {
        this._cleanSnapshot = JSON.stringify(this.data);
    }

    /** @returns {boolean} whether any value differs from the clean baseline. */
    isDirty() {
        return JSON.stringify(this.data) !== this._cleanSnapshot;
    }

    /** @returns {string[]} keys whose value differs from the clean baseline. */
    getDirtyKeys() {
        let clean = {};
        try { clean = JSON.parse(this._cleanSnapshot); } catch (_) { /* ignore */ }
        const keys = new Set([...Object.keys(clean), ...Object.keys(this.data)]);
        const dirty = [];
        for (const k of keys) {
            if (!this._equal(clean[k], this.data[k])) dirty.push(k);
        }
        return dirty;
    }

    /* ------------------------------ serialization ------------------------------ */

    /** @returns {Object} plain object snapshot (deep clone). */
    toObject() {
        return JSON.parse(JSON.stringify(this.data));
    }

    toJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    /**
     * Load values from a plain object or JSON string.
     * @param {Object|string} input
     * @param {boolean} silent
     */
    fromJSON(input, silent = false) {
        try {
            const imported = typeof input === 'string' ? JSON.parse(input) : input;
            this.setMultiple(imported, silent);
        } catch (e) {
            console.error('Settings.fromJSON failed:', e);
        }
    }

    /**
     * Create a Proxy so settings can be read/written as object properties.
     * @returns {Proxy}
     */
    createProxy() {
        const self = this;
        return new Proxy({}, {
            get(_, prop) { return self.get(prop); },
            set(_, prop, value) { self.set(prop, value); return true; },
            has(_, prop) { return prop in self.data; },
            ownKeys() { return Reflect.ownKeys(self.data); },
            getOwnPropertyDescriptor(_, prop) {
                if (prop in self.data) {
                    return { enumerable: true, configurable: true, value: self.data[prop] };
                }
                return undefined;
            }
        });
    }

    /** @private */
    _equal(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a === 'object' || typeof b === 'object') {
            try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
        }
        return false;
    }

    /** @private */
    _notify(key, newValue, oldValue) {
        if (this.listeners[key]) {
            this.listeners[key].slice().forEach(cb => cb(newValue, oldValue, key));
        }
        if (this.listeners['*']) {
            this.listeners['*'].slice().forEach(cb => cb(newValue, oldValue, key));
        }
    }
}
