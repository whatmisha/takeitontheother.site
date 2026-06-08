/**
 * Settings — реактивное хранилище настроек приложения
 * 
 * Поддерживает:
 * - get/set с уведомлением подписчиков
 * - setMultiple для пакетного обновления
 * - subscribe на конкретный ключ или '*' для всех изменений
 * - silent-режим для обновления без уведомлений
 * - экспорт/импорт через JSON
 * - сброс до дефолтных значений
 * 
 * @example
 * const settings = new Settings({ width: 500, height: 300, color: '#fff' });
 * settings.subscribe('width', (newVal, oldVal) => console.log('width changed'));
 * settings.subscribe('*', (newVal, oldVal, key) => console.log(key, 'changed'));
 * settings.set('width', 600);
 */
export class Settings {
    /**
     * @param {Object} defaults — объект с дефолтными значениями
     */
    constructor(defaults = {}) {
        this._defaults = { ...defaults };
        this.data = { ...defaults };
        this.listeners = {};
    }

    get(key) {
        return this.data[key];
    }

    /**
     * @param {string} key
     * @param {*} value
     * @param {boolean} silent — не уведомлять подписчиков
     */
    set(key, value, silent = false) {
        const oldValue = this.data[key];
        this.data[key] = value;
        if (!silent && oldValue !== value) {
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

    /**
     * Подписка на изменение настройки
     * @param {string} key — ключ или '*' для всех
     * @param {Function} callback — (newValue, oldValue, key)
     * @returns {Function} — функция отписки
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
        this.data = { ...this._defaults };
        this._notify('*', this.data, {});
    }

    toJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    fromJSON(json) {
        try {
            const imported = JSON.parse(json);
            this.setMultiple(imported);
        } catch (e) {
            console.error('Settings.fromJSON failed:', e);
        }
    }

    /**
     * Создать Proxy для доступа к настройкам как к свойствам объекта
     * @returns {Proxy}
     */
    createProxy() {
        const self = this;
        return new Proxy({}, {
            get(_, prop) { return self.get(prop); },
            set(_, prop, value) { self.set(prop, value); return true; }
        });
    }

    /** @private */
    _notify(key, newValue, oldValue) {
        if (this.listeners[key]) {
            this.listeners[key].forEach(cb => cb(newValue, oldValue, key));
        }
        if (this.listeners['*']) {
            this.listeners['*'].forEach(cb => cb(newValue, oldValue, key));
        }
    }
}
