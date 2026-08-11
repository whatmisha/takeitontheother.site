/**
 * Управление настройками приложения
 */
import { DEFAULT_SETTINGS } from './Constants.js?v=1.12.64';

export class Settings {
    constructor(initialSettings = {}) {
        // Объединяем дефолтные настройки с переданными
        this.data = { ...DEFAULT_SETTINGS, ...initialSettings };
        
        // Подписчики на изменения
        this.listeners = {};
    }

    /**
     * Получить значение настройки
     * @param {string} key
     * @returns {*}
     */
    get(key) {
        return this.data[key];
    }

    /**
     * Установить значение настройки
     * @param {string} key
     * @param {*} value
     * @param {boolean} silent - не уведомлять подписчиков
     */
    set(key, value, silent = false) {
        const oldValue = this.data[key];
        this.data[key] = value;
        
        if (!silent && oldValue !== value) {
            this.notify(key, value, oldValue);
        }
    }

    /**
     * Установить несколько настроек разом
     * @param {Object} updates - объект с обновлениями
     * @param {boolean} silent - не уведомлять подписчиков
     */
    setMultiple(updates, silent = false) {
        for (const [key, value] of Object.entries(updates)) {
            this.set(key, value, silent);
        }
    }

    /**
     * Получить все настройки
     * @returns {Object}
     */
    getAll() {
        return { ...this.data };
    }

    /**
     * Подписаться на изменение настройки
     * @param {string} key - ключ настройки или '*' для всех
     * @param {Function} callback - функция обратного вызова
     * @returns {Function} - функция для отписки
     */
    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);
        
        // Возвращаем функцию для отписки
        return () => {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        };
    }

    /**
     * Уведомить подписчиков об изменении
     * @param {string} key
     * @param {*} newValue
     * @param {*} oldValue
     */
    notify(key, newValue, oldValue) {
        // Уведомляем подписчиков конкретного ключа
        if (this.listeners[key]) {
            this.listeners[key].forEach(callback => {
                callback(newValue, oldValue, key);
            });
        }
        
        // Уведомляем подписчиков на все изменения
        if (this.listeners['*']) {
            this.listeners['*'].forEach(callback => {
                callback(newValue, oldValue, key);
            });
        }
    }

    /**
     * Сброс до дефолтных значений
     */
    reset() {
        const previous = this.data;
        this.data = { ...DEFAULT_SETTINGS };
        
        this.notify('*', this.data, previous);
    }

}
