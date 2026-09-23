/**
 * One-pass DOM index. Element ids are the public keys, so the cache follows
 * the markup automatically instead of duplicating every id in JavaScript.
 */
export class DOMCache {
    constructor(documentRef = document) {
        this.document = documentRef;
        this._cache = null;
    }

    init() {
        this._cache = Object.fromEntries(
            Array.from(this.document.querySelectorAll('[id]'), element => [element.id, element])
        );
        this._cache.svg = this._cache.gridSvg || null;
        this._cache.presetDropdownText = this._cache.presetDropdownToggle
            ?.querySelector('.preset-dropdown-text') || null;
        return this;
    }

    get(key) {
        if (!this._cache) {
            console.warn('DOMCache not initialized. Call init() first.');
            return null;
        }
        return this._cache[key] || null;
    }

    has(key) {
        return this._cache?.[key] != null;
    }

    getAll() {
        return this._cache || {};
    }
}
