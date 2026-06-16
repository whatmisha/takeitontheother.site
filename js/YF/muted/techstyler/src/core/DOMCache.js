/**
 * DOMCache — centralized DOM element caching
 * 
 * Caches elements once during initialization via getElementById, avoiding
 * repeated querySelector calls. Supports a Proxy for accessing elements as
 * object properties.
 * 
 * @example
 * const dom = new DOMCache();
 * dom.init({
 *     svg: 'mainSvg',
 *     canvas: 'canvasContainer',
 *     widthSlider: 'widthSlider',
 *     widthValue: 'widthValue',
 * });
 * 
 * // Via methods
 * const svg = dom.get('svg');
 * 
 * // Via Proxy
 * const proxy = dom.createProxy();
 * proxy.svg.setAttribute('width', 100);
 */
export class DOMCache {
    constructor() {
        this._cache = null;
    }

    /**
     * Initialize the cache
     * @param {Object} elementMap — object { key: 'element-id' }
     * @returns {DOMCache}
     */
    init(elementMap = {}) {
        this._cache = {};
        for (const [key, id] of Object.entries(elementMap)) {
            this._cache[key] = document.getElementById(id);
        }
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
        return this._cache && this._cache[key] != null;
    }

    set(key, value) {
        if (!this._cache) {
            console.warn('DOMCache not initialized. Call init() first.');
            return;
        }
        this._cache[key] = value;
    }

    getAll() {
        return this._cache || {};
    }

    /**
     * Proxy for accessing elements as properties
     * @returns {Proxy}
     */
    createProxy() {
        const cache = this;
        return new Proxy({}, {
            get(_, prop) { return cache.get(prop); },
            set(_, prop, value) { cache.set(prop, value); return true; }
        });
    }
}
