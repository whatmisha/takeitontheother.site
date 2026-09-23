/**
 * DOMCache — централизованное кэширование DOM-элементов
 * 
 * Кэширует элементы один раз при инициализации через getElementById,
 * предотвращая повторные querySelector. Поддерживает Proxy для
 * доступа к элементам как к свойствам объекта.
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
 * // Через методы
 * const svg = dom.get('svg');
 * 
 * // Через Proxy
 * const proxy = dom.createProxy();
 * proxy.svg.setAttribute('width', 100);
 */
export class DOMCache {
    constructor() {
        this._cache = null;
    }

    /**
     * Инициализация кэша
     * @param {Object} elementMap — объект { ключ: 'id-элемента' }
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
     * Proxy для доступа к элементам как к свойствам
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
