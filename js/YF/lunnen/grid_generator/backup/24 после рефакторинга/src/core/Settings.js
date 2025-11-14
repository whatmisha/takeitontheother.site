/**
 * Управление настройками приложения
 */
import { DEFAULTS } from './Constants.js';

export class Settings {
    constructor(initialSettings = {}) {
        // Объединяем дефолтные настройки с переданными
        this.data = {
            // Размеры коробки
            frontWidth: DEFAULTS.FRONT_WIDTH,
            frontHeight: DEFAULTS.FRONT_HEIGHT,
            thickness: DEFAULTS.THICKNESS,
            boxColor: DEFAULTS.BOX_COLOR,
            
            // Параметры сетки
            gridModule: DEFAULTS.GRID_MODULE,
            margins: DEFAULTS.MARGINS,
            marginsUnit: DEFAULTS.MARGINS_UNIT,
            columnCount: DEFAULTS.COLUMN_COUNT,
            rowCount: DEFAULTS.ROW_COUNT,
            rowHeight: DEFAULTS.ROW_HEIGHT,
            linkMode: DEFAULTS.LINK_MODE,
            
            // Стили текста - Headline
            headlineSize: DEFAULTS.HEADLINE_SIZE,
            lineHeight: DEFAULTS.LINE_HEIGHT,
            tracking: DEFAULTS.TRACKING,
            useXHeight: DEFAULTS.USE_X_HEIGHT,
            headlineFontWeight: DEFAULTS.HEADLINE_FONT_WEIGHT,
            
            // Стили текста - Text
            textSize: DEFAULTS.TEXT_SIZE,
            textLineHeight: DEFAULTS.TEXT_LINE_HEIGHT,
            textTracking: DEFAULTS.TEXT_TRACKING,
            useXHeight2: DEFAULTS.USE_X_HEIGHT_2,
            textFontWeight: DEFAULTS.TEXT_FONT_WEIGHT,
            
            // Видимость элементов
            showDimensions: DEFAULTS.SHOW_DIMENSIONS,
            showLabels: DEFAULTS.SHOW_LABELS,
            showSidePanels: DEFAULTS.SHOW_SIDE_PANELS,
            showColumns: DEFAULTS.SHOW_COLUMNS,
            showRows: DEFAULTS.SHOW_ROWS,
            showBaseline: DEFAULTS.SHOW_BASELINE,
            showObjects: DEFAULTS.SHOW_OBJECTS,
            
            ...initialSettings
        };
        
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
        this.data = {
            frontWidth: DEFAULTS.FRONT_WIDTH,
            frontHeight: DEFAULTS.FRONT_HEIGHT,
            thickness: DEFAULTS.THICKNESS,
            boxColor: DEFAULTS.BOX_COLOR,
            gridModule: DEFAULTS.GRID_MODULE,
            margins: DEFAULTS.MARGINS,
            marginsUnit: DEFAULTS.MARGINS_UNIT,
            columnCount: DEFAULTS.COLUMN_COUNT,
            rowCount: DEFAULTS.ROW_COUNT,
            rowHeight: DEFAULTS.ROW_HEIGHT,
            linkMode: DEFAULTS.LINK_MODE,
            headlineSize: DEFAULTS.HEADLINE_SIZE,
            lineHeight: DEFAULTS.LINE_HEIGHT,
            tracking: DEFAULTS.TRACKING,
            useXHeight: DEFAULTS.USE_X_HEIGHT,
            headlineFontWeight: DEFAULTS.HEADLINE_FONT_WEIGHT,
            textSize: DEFAULTS.TEXT_SIZE,
            textLineHeight: DEFAULTS.TEXT_LINE_HEIGHT,
            textTracking: DEFAULTS.TEXT_TRACKING,
            useXHeight2: DEFAULTS.USE_X_HEIGHT_2,
            textFontWeight: DEFAULTS.TEXT_FONT_WEIGHT,
            showDimensions: DEFAULTS.SHOW_DIMENSIONS,
            showLabels: DEFAULTS.SHOW_LABELS,
            showSidePanels: DEFAULTS.SHOW_SIDE_PANELS,
            showColumns: DEFAULTS.SHOW_COLUMNS,
            showRows: DEFAULTS.SHOW_ROWS,
            showBaseline: DEFAULTS.SHOW_BASELINE,
            showObjects: DEFAULTS.SHOW_OBJECTS
        };
        
        this.notify('*', this.data, {});
    }

    /**
     * Экспорт настроек в JSON
     * @returns {string}
     */
    toJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    /**
     * Импорт настроек из JSON
     * @param {string} json
     */
    fromJSON(json) {
        try {
            const imported = JSON.parse(json);
            this.setMultiple(imported);
        } catch (e) {
            console.error('Failed to import settings:', e);
        }
    }
}

