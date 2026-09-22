/**
 * NumberInputController - Универсальный контроллер для всех number inputs
 * Обрабатывает взаимодействие с инпутами, валидацию, клавиатурные события
 */
export class NumberInputController {
    constructor(settings, callbacks = {}) {
        this.settings = settings;
        this.callbacks = callbacks;
        this.inputs = new Map();
        this.isUpdating = false; // Флаг для предотвращения циклических обновлений
    }

    /**
     * Инициализация инпута с его конфигурацией
     */
    initInput(inputId, config) {
        const input = document.getElementById(inputId);
        
        if (!input) {
            console.warn(`Input not found: ${inputId}`);
            return;
        }

        this.inputs.set(inputId, {
            element: input,
            config: config
        });

        // Обработчики событий
        input.addEventListener('input', (e) => this.handleInput(inputId, e));
        input.addEventListener('keydown', (e) => this.handleKeyDown(inputId, e));
        input.addEventListener('focus', (e) => e.target.select());
        input.addEventListener('blur', (e) => this.handleBlur(inputId, e));
    }

    /**
     * Обработка изменения инпута
     */
    handleInput(inputId, event) {
        if (this.isUpdating) return;
        
        const inputData = this.inputs.get(inputId);
        if (!inputData) return;

        const { config, element } = inputData;
        const inputValue = event.target.value.trim();
        
        // Если поле пустое, не обновляем настройки (оставляем текущее значение)
        if (inputValue === '' || inputValue === '-') {
            return;
        }
        
        let value = parseFloat(inputValue);
        
        // Если значение некорректное, не обновляем настройки
        if (isNaN(value)) {
            return;
        }
        
        // Валидация
        value = this.clamp(value, config.min, config.max);
        
        // Обновление настроек
        if (config.setting) {
            this.settings.set(config.setting, value);
        }
        
        // Вызов коллбэка
        if (config.onUpdate) {
            config.onUpdate(value);
        }
    }

    /**
     * Обработка нажатий клавиш (Arrow keys, Enter, Escape)
     */
    handleKeyDown(inputId, event) {
        const inputData = this.inputs.get(inputId);
        if (!inputData) return;

        const { element, config } = inputData;
        let currentValue = parseFloat(element.value);
        
        if (isNaN(currentValue)) return;

        let newValue = currentValue;
        let handled = false;

        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowDown':
                // Determine step based on shift key
                if (event.shiftKey && config.decimals === 2) {
                    // For fields with decimals === 2 (font sizes, line heights): 
                    // round to tenths first, then add/subtract shiftStep
                    const roundedToTenth = Math.round(currentValue * 10) / 10;
                    const step = (event.key === 'ArrowUp' ? 1 : -1) * config.shiftStep;
                    newValue = roundedToTenth + step;
                } else {
                    const step = event.shiftKey ? config.shiftStep : config.baseStep;
                    newValue = event.key === 'ArrowUp' ? currentValue + step : currentValue - step;
                }
                handled = true;
                break;
            case 'Enter':
                element.blur();
                handled = true;
                break;
            case 'Escape':
                // Восстановить значение из настроек
                if (config.setting) {
                    newValue = this.settings.get(config.setting);
                    element.value = newValue.toFixed(config.decimals);
                }
                element.blur();
                handled = true;
                break;
        }

        if (handled && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            
            // Валидация
            newValue = this.clamp(newValue, config.min, config.max);
            
            // Обновление UI
            element.value = newValue.toFixed(config.decimals);
            
            // Обновление настроек
            if (config.setting) {
                this.settings.set(config.setting, newValue);
            }
            
            // Вызов коллбэка
            if (config.onUpdate) {
                config.onUpdate(newValue);
            }
        } else if (handled) {
            event.preventDefault();
        }
    }

    /**
     * Обработка потери фокуса - валидация и форматирование
     */
    handleBlur(inputId, event) {
        const inputData = this.inputs.get(inputId);
        if (!inputData) return;

        const { element, config } = inputData;
        let value = parseFloat(element.value);
        
        if (isNaN(value) || element.value.trim() === '') {
            // Восстановить из настроек
            const savedValue = config.setting ? this.settings.get(config.setting) : config.min;
            // Проверяем, что сохраненное значение валидно
            value = (savedValue !== null && savedValue !== undefined && !isNaN(savedValue)) 
                ? savedValue 
                : config.min;
        }
        
        // Валидация
        value = this.clamp(value, config.min, config.max);
        
        // Обновление UI с правильным форматированием
        element.value = value.toFixed(config.decimals);
        
        // Обновление настроек (гарантируем, что значение валидно)
        if (config.setting && !isNaN(value)) {
            this.settings.set(config.setting, value);
        }
        
        // Вызов коллбэка
        if (config.onUpdate && !isNaN(value)) {
            config.onUpdate(value);
        }
    }

    /**
     * Программное обновление значения инпута
     */
    setValue(inputId, value, triggerCallback = true) {
        this.isUpdating = !triggerCallback;
        
        const inputData = this.inputs.get(inputId);
        if (!inputData) {
            this.isUpdating = false;
            return;
        }

        const { element, config } = inputData;
        
        // Валидация
        value = this.clamp(value, config.min, config.max);
        
        // Обновление UI
        element.value = value.toFixed(config.decimals);
        
        // Обновление настроек
        if (config.setting) {
            this.settings.set(config.setting, value);
        }
        
        // Вызов коллбэка
        if (triggerCallback && config.onUpdate) {
            config.onUpdate(value);
        }
        
        this.isUpdating = false;
    }

    /**
     * Получение текущего значения инпута
     */
    getValue(inputId) {
        const inputData = this.inputs.get(inputId);
        if (!inputData) return null;
        
        return parseFloat(inputData.element.value);
    }

    /**
     * Обновление лимитов инпута
     */
    updateLimits(inputId, min, max) {
        const inputData = this.inputs.get(inputId);
        if (!inputData) return;

        const { element, config } = inputData;
        
        config.min = min;
        config.max = max;
        
        element.min = min;
        element.max = max;
        
        // Валидация текущего значения
        const currentValue = parseFloat(element.value);
        if (currentValue < min || currentValue > max) {
            this.setValue(inputId, this.clamp(currentValue, min, max), true);
        }
    }

    /**
     * Вспомогательная функция - ограничение значения
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Получение всех значений инпутов
     */
    getAllValues() {
        const values = {};
        this.inputs.forEach((data, inputId) => {
            if (data.config.setting) {
                values[data.config.setting] = parseFloat(data.element.value);
            }
        });
        return values;
    }

    /**
     * Активация/деактивация инпута
     */
    setEnabled(inputId, enabled) {
        const inputData = this.inputs.get(inputId);
        if (!inputData) return;

        inputData.element.disabled = !enabled;
    }
}

