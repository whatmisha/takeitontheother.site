/**
 * Управление пресетами сетки
 * Генерация и обновление кнопок с идеальными комбинациями строк
 */
import { DOMUtils } from '../utils/DOMUtils.js';

export class GridPresets {
    constructor(settings, calculator) {
        this.settings = settings;
        this.calculator = calculator;
        this.container = null;
    }

    /**
     * Установить контейнер для пресетов
     * @param {HTMLElement} container
     */
    setContainer(container) {
        this.container = container;
    }

    /**
     * Сгенерировать кнопки пресетов
     * @param {Function} onPresetClick - колбэк при клике на пресет
     */
    generate(onPresetClick) {
        if (!this.container) {
            console.warn('Presets container not set');
            return;
        }

        const combinations = this.calculator.findPerfectRowCombinations();
        
        // Очистка существующих кнопок
        DOMUtils.clearElement(this.container);
        
        // Создание кнопок для каждой комбинации
        combinations.forEach(combo => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'row-preset-btn';
            button.textContent = `${combo.rowCount}:${combo.rowHeight}`;
            button.setAttribute('aria-label', `Set ${combo.rowCount} rows with height ${combo.rowHeight}`);
            
            button.addEventListener('click', () => {
                if (onPresetClick) {
                    onPresetClick(combo);
                }
            });
            
            this.container.appendChild(button);
        });
        
        this.updateActive();
    }

    /**
     * Обновить активное состояние кнопок
     */
    updateActive() {
        if (!this.container) return;
        
        const currentRowCount = this.settings.get('rowCount');
        const currentRowHeight = this.settings.get('rowHeight');
        
        const buttons = this.container.querySelectorAll('.row-preset-btn');
        buttons.forEach(button => {
            const [rowCount, rowHeight] = button.textContent.split(':').map(n => parseInt(n));
            
            if (rowCount === currentRowCount && rowHeight === currentRowHeight) {
                DOMUtils.addClass(button, 'active');
            } else {
                DOMUtils.removeClass(button, 'active');
            }
        });
    }

    /**
     * Применить пресет
     * @param {{rowCount: number, rowHeight: number}} preset
     * @param {Function} callback - колбэк после применения
     */
    applyPreset(preset, callback) {
        this.settings.setMultiple({
            rowCount: preset.rowCount,
            rowHeight: preset.rowHeight
        });
        
        this.updateActive();
        
        if (callback) {
            callback();
        }
    }
}

