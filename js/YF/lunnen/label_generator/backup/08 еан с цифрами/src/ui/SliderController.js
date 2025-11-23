/**
 * SliderController - Универсальный контроллер для всех слайдеров
 * Обрабатывает взаимодействие со слайдерами, валидацию, клавиатурные события
 */
export class SliderController {
    constructor(settings, callbacks = {}) {
        this.settings = settings;
        this.callbacks = callbacks; // { onUpdate: fn, onGridUpdate: fn, etc }
        this.sliders = new Map();
        this.isUpdating = false; // Флаг для предотвращения циклических обновлений
    }

    /**
     * Инициализация слайдера с его конфигурацией
     */
    initSlider(sliderId, config) {
        const slider = document.getElementById(sliderId);
        const valueInput = document.getElementById(config.valueId);
        
        if (!slider || !valueInput) {
            console.warn(`Slider or value input not found: ${sliderId}`);
            return;
        }

        this.sliders.set(sliderId, {
            element: slider,
            valueInput: valueInput,
            config: config
        });

        // Обработчики событий
        slider.addEventListener('input', (e) => this.handleSliderInput(sliderId, e));
        valueInput.addEventListener('input', (e) => this.handleValueInput(sliderId, e));
        valueInput.addEventListener('keydown', (e) => this.handleKeyDown(sliderId, e));
        valueInput.addEventListener('focus', (e) => e.target.select());
        valueInput.addEventListener('blur', (e) => this.handleValueBlur(sliderId, e));
    }

    /**
     * Обработка изменения слайдера
     */
    handleSliderInput(sliderId, event) {
        if (this.isUpdating) return;
        
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        const { config, valueInput } = sliderData;
        let value = parseFloat(event.target.value);
        
        // Валидация
        value = this.clamp(value, config.min, config.max);
        
        // Обновление отображения
        this.updateValueDisplay(valueInput, value, config);
        
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
     * Обработка ввода в текстовое поле
     */
    handleValueInput(sliderId, event) {
        if (this.isUpdating) return;
        
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        const { element, config } = sliderData;
        let value = parseFloat(event.target.value);
        
        if (isNaN(value)) return;
        
        // Валидация
        value = this.clamp(value, config.min, config.max);
        
        // Обновление слайдера
        element.value = value;
        
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
    handleKeyDown(sliderId, event) {
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        const { element, valueInput, config } = sliderData;
        let currentValue = parseFloat(valueInput.value);
        
        if (isNaN(currentValue)) return;

        let newValue = currentValue;
        let handled = false;

        const step = event.shiftKey ? config.shiftStep : config.baseStep;

        switch (event.key) {
            case 'ArrowUp':
                newValue = currentValue + step;
                handled = true;
                break;
            case 'ArrowDown':
                newValue = currentValue - step;
                handled = true;
                break;
            case 'Enter':
                valueInput.blur();
                handled = true;
                break;
            case 'Escape':
                // Восстановить значение из настроек
                if (config.setting) {
                    newValue = this.settings.get(config.setting);
                    this.updateValueDisplay(valueInput, newValue, config);
                    element.value = newValue;
                }
                valueInput.blur();
                handled = true;
                break;
        }

        if (handled && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            
            // Валидация
            newValue = this.clamp(newValue, config.min, config.max);
            
            // Обновление UI
            this.updateValueDisplay(valueInput, newValue, config);
            element.value = newValue;
            
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
    handleValueBlur(sliderId, event) {
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        const { element, valueInput, config } = sliderData;
        let value = parseFloat(valueInput.value);
        
        if (isNaN(value)) {
            // Восстановить из настроек
            value = config.setting ? this.settings.get(config.setting) : parseFloat(element.value);
        }
        
        // Валидация
        value = this.clamp(value, config.min, config.max);
        
        // Обновление UI с правильным форматированием
        this.updateValueDisplay(valueInput, value, config);
        element.value = value;
    }

    /**
     * Обновление отображаемого значения с форматированием
     */
    updateValueDisplay(valueInput, value, config) {
        const formatted = value.toFixed(config.decimals);
        const suffix = config.suffix || '';
        valueInput.value = formatted + suffix;
    }

    /**
     * Программное обновление значения слайдера
     */
    setValue(sliderId, value, triggerCallback = true) {
        this.isUpdating = !triggerCallback;
        
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) {
            this.isUpdating = false;
            return;
        }

        const { element, valueInput, config } = sliderData;
        
        // Валидация
        value = this.clamp(value, config.min, config.max);
        
        // Обновление UI
        element.value = value;
        this.updateValueDisplay(valueInput, value, config);
        
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
     * Получение текущего значения слайдера
     */
    getValue(sliderId) {
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return null;
        
        return parseFloat(sliderData.element.value);
    }

    /**
     * Обновление лимитов слайдера
     */
    updateLimits(sliderId, min, max) {
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        const { element, config } = sliderData;
        
        config.min = min;
        config.max = max;
        
        element.min = min;
        element.max = max;
        
        // Валидация текущего значения
        const currentValue = parseFloat(element.value);
        if (currentValue < min || currentValue > max) {
            this.setValue(sliderId, this.clamp(currentValue, min, max), true);
        }
    }

    /**
     * Вспомогательная функция - ограничение значения
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Получение всех значений слайдеров
     */
    getAllValues() {
        const values = {};
        this.sliders.forEach((data, sliderId) => {
            if (data.config.setting) {
                values[data.config.setting] = parseFloat(data.element.value);
            }
        });
        return values;
    }

    /**
     * Активация/деактивация слайдера
     */
    setEnabled(sliderId, enabled) {
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        sliderData.element.disabled = !enabled;
        sliderData.valueInput.disabled = !enabled;
    }
}

