import { SliderControlBinding } from './SliderControlBinding.js';
import {
    clampSliderValue,
    formatSliderValue,
    getDecimalsFromStep,
    normalizeSliderInput,
    stepSliderValue
} from './SliderValueMath.js';

/** Coordinates shared numeric range/input controls and application settings. */
export class SliderController {
    constructor(settings, callbacks = {}) {
        this.settings = settings;
        this.callbacks = callbacks;
        this.sliders = new Map();
        this.isUpdating = false;
        this.binding = new SliderControlBinding({ documentRef: callbacks.documentRef });
    }

    initSlider(sliderId, config) {
        const data = this.binding.create(sliderId, config, {
            sliderInput: event => this.handleSliderInput(sliderId, event),
            keydown: event => this.handleKeyDown(sliderId, event),
            blur: event => this.handleValueBlur(sliderId, event)
        });
        if (data) this.sliders.set(sliderId, data);
    }

    handleSliderInput(sliderId, event) {
        if (this.isUpdating) return;
        const data = this.sliders.get(sliderId);
        if (!data) return;
        const value = normalizeSliderInput(Number.parseFloat(event.target.value), data.config);
        this.updateValueDisplay(data.valueInput, value, data.config);
        this.applyValue(data.config, value);
    }

    handleValueInput(sliderId, event) {
        if (this.isUpdating) return;
        const data = this.sliders.get(sliderId);
        if (!data) return;
        const parsed = Number.parseFloat(event.target.value);
        if (!Number.isFinite(parsed)) return;
        const value = this.clamp(parsed, data.config.min, data.config.max);
        data.element.value = value;
        this.applyValue(data.config, value);
    }

    applyValue(config, value) {
        if (config.setting) this.settings.set(config.setting, value);
        config.onUpdate?.(value);
    }

    getDecimalsFromStep(step) {
        return getDecimalsFromStep(step);
    }

    handleKeyDown(sliderId, event) {
        const data = this.sliders.get(sliderId);
        if (!data) return;
        const { element, valueInput, config } = data;
        const currentValue = Number.parseFloat(valueInput.value);
        if (!Number.isFinite(currentValue)) return;

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const value = stepSliderValue(
                currentValue,
                event.key === 'ArrowUp' ? 1 : -1,
                event.shiftKey,
                config
            );
            this.updateValueDisplay(valueInput, value, config);
            element.value = value;
            this.applyValue(config, value);
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            valueInput.blur();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            const value = config.setting
                ? this.settings.get(config.setting)
                : Number.parseFloat(valueInput.dataset.originalValue ?? element.value);
            if (Number.isFinite(value)) {
                this.updateValueDisplay(valueInput, value, config);
                element.value = value;
            }
            valueInput.blur();
        }
    }

    handleValueBlur(sliderId) {
        if (this.isUpdating) return;
        const data = this.sliders.get(sliderId);
        if (!data) return;
        const { element, valueInput, config } = data;
        let value = Number.parseFloat(valueInput.value);
        if (!Number.isFinite(value)) {
            value = config.setting
                ? this.settings.get(config.setting)
                : Number.parseFloat(element.value);
        }
        value = this.clamp(value, config.min, config.max);
        this.updateValueDisplay(valueInput, value, config);
        element.value = value;
        this.applyValue(config, value);
    }

    updateValueDisplay(valueInput, value, config) {
        valueInput.value = formatSliderValue(value, config);
    }

    setValue(sliderId, requestedValue, triggerCallback = true) {
        const data = this.sliders.get(sliderId);
        if (!data) return;
        this.isUpdating = !triggerCallback;
        try {
            const value = this.clamp(requestedValue, data.config.min, data.config.max);
            data.element.value = value;
            this.updateValueDisplay(data.valueInput, value, data.config);
            if (data.config.setting) this.settings.set(data.config.setting, value);
            if (triggerCallback) data.config.onUpdate?.(value);
        } finally {
            this.isUpdating = false;
        }
    }

    getValue(sliderId) {
        const data = this.sliders.get(sliderId);
        return data ? Number.parseFloat(data.element.value) : null;
    }

    updateLimits(sliderId, min, max) {
        const data = this.sliders.get(sliderId);
        if (!data) return;
        data.config.min = min;
        data.config.max = max;
        data.element.min = min;
        data.element.max = max;
        const current = Number.parseFloat(data.element.value);
        if (current < min || current > max) {
            this.setValue(sliderId, this.clamp(current, min, max), true);
        }
    }

    resetLimits(sliderId) {
        const data = this.sliders.get(sliderId);
        if (!data) return;
        this.updateLimits(sliderId, data.defaultLimits.min, data.defaultLimits.max);
    }

    clamp(value, min, max) {
        return clampSliderValue(value, min, max);
    }

    getAllValues() {
        const values = {};
        this.sliders.forEach(data => {
            if (data.config.setting) {
                values[data.config.setting] = Number.parseFloat(data.element.value);
            }
        });
        return values;
    }

    setEnabled(sliderId, enabled) {
        const data = this.sliders.get(sliderId);
        if (!data) return;
        data.element.disabled = !enabled;
        data.valueInput.disabled = !enabled;
    }
}
