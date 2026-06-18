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

        // Синхронизируем HTML-атрибуты с конфигом,
        // чтобы диапазон и шаг ползунка соответствовали настройкам.
        if (typeof config.min === 'number') {
            slider.min = String(config.min);
        }
        if (typeof config.max === 'number') {
            slider.max = String(config.max);
        }
        if (typeof config.baseStep === 'number' && config.baseStep > 0) {
            slider.step = String(config.baseStep);
        }

        this.sliders.set(sliderId, {
            element: slider,
            valueInput: valueInput,
            config: config
        });

        // Приводим текущее значение к диапазону и форматируем отображение
        let initialValue = parseFloat(slider.value);
        if (!isNaN(initialValue)) {
            initialValue = this.clamp(initialValue, config.min, config.max);
            slider.value = initialValue;
            this.updateValueDisplay(valueInput, initialValue, config);
        }

        // Обработчики событий
        slider.addEventListener('input', (e) => this.handleSliderInput(sliderId, e));
        // Убрали обработчик input для valueInput - изменения применяются только при blur или Enter
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
        
        // Валидация с учетом погрешности округления
        // Если значение очень близко к границе (в пределах шага), принудительно устанавливаем границу
        const epsilon = config.baseStep ? config.baseStep * 0.1 : 0.001;
        if (Math.abs(value - config.max) < epsilon) {
            value = config.max;
        } else if (Math.abs(value - config.min) < epsilon) {
            value = config.min;
        } else {
            value = this.clamp(value, config.min, config.max);
        }
        
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
     * Определяет количество знаков после запятой на основе шага
     * Например: 0.1 -> 1, 0.01 -> 2, 0.001 -> 3, 0.25 -> 2, 1 -> 0
     */
    getDecimalsFromStep(step) {
        if (step >= 1) return 0;
        
        // Преобразуем шаг в строку для анализа
        const stepStr = step.toString();
        
        // Если есть научная нотация (например, 1e-4)
        if (stepStr.includes('e')) {
            const match = stepStr.match(/e-(\d+)/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        
        // Если есть точка, считаем знаки после неё
        if (stepStr.includes('.')) {
            const parts = stepStr.split('.');
            if (parts.length === 2) {
                // Возвращаем длину всей части после точки (включая ведущие нули)
                // Например: "01" -> 2, "1" -> 1, "25" -> 2
                return parts[1].length;
            }
        }
        
        return 0;
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

        const baseStep = config.baseStep || 0;
        const shiftStep = config.shiftStep || 0;
        
        // Определяем шаг, который будет использоваться
        const step = event.shiftKey && shiftStep > 0 ? shiftStep : baseStep;
        const stepDecimals = step > 0 ? this.getDecimalsFromStep(step) : (config.decimals || 0);

        switch (event.key) {
            case 'ArrowUp':
                if (event.shiftKey && shiftStep > 0) {
                    // С Shift: прилипание к ближайшему большому шагу вверх
                    // Сначала округляем текущее значение до количества знаков шага
                    const roundedCurrent = stepDecimals > 0 
                        ? parseFloat(currentValue.toFixed(stepDecimals))
                        : Math.round(currentValue);
                    const k = roundedCurrent / shiftStep;
                    const nearest = Math.round(k);
                    const isMultiple = Math.abs(k - nearest) < 1e-6;
                    if (isMultiple) {
                        newValue = roundedCurrent + shiftStep;
                    } else {
                        newValue = Math.ceil(k) * shiftStep;
                    }
                } else if (baseStep > 0) {
                    // Округляем текущее значение до количества знаков шага перед изменением
                    const roundedCurrent = stepDecimals > 0 
                        ? parseFloat(currentValue.toFixed(stepDecimals))
                        : Math.round(currentValue);
                    newValue = roundedCurrent + baseStep;
                }
                handled = true;
                break;
            case 'ArrowDown':
                if (event.shiftKey && shiftStep > 0) {
                    // С Shift: прилипание к ближайшему большому шагу вниз
                    // Сначала округляем текущее значение до количества знаков шага
                    const roundedCurrent = stepDecimals > 0 
                        ? parseFloat(currentValue.toFixed(stepDecimals))
                        : Math.round(currentValue);
                    const k = roundedCurrent / shiftStep;
                    const nearest = Math.round(k);
                    const isMultiple = Math.abs(k - nearest) < 1e-6;
                    if (isMultiple) {
                        newValue = roundedCurrent - shiftStep;
                    } else {
                        newValue = Math.floor(k) * shiftStep;
                    }
                } else if (baseStep > 0) {
                    // Округляем текущее значение до количества знаков шага перед изменением
                    const roundedCurrent = stepDecimals > 0 
                        ? parseFloat(currentValue.toFixed(stepDecimals))
                        : Math.round(currentValue);
                    newValue = roundedCurrent - baseStep;
                }
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
            
            // Округляем результат по количеству знаков шага (если шаг задан)
            // Иначе используем config.decimals
            if (step > 0 && stepDecimals > 0) {
                newValue = parseFloat(newValue.toFixed(stepDecimals));
            } else if (typeof config.decimals === 'number') {
                newValue = parseFloat(newValue.toFixed(config.decimals));
            }
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
     * Обработка потери фокуса - валидация, форматирование и применение изменений
     */
    handleValueBlur(sliderId, event) {
        if (this.isUpdating) return;
        
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
        
        // Обновление настроек
        if (config.setting) {
            this.settings.set(config.setting, value);
        }
        
        // Вызов коллбэка для применения изменений
        if (config.onUpdate) {
            config.onUpdate(value);
        }
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

