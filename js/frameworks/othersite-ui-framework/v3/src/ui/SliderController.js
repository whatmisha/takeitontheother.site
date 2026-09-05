/**
 * SliderController - Universal controller for all sliders
 * Handles slider interaction, validation, keyboard events
 */
export class SliderController {
    constructor(settings, callbacks = {}) {
        this.settings = settings;
        this.callbacks = callbacks; // { onUpdate: fn, onGridUpdate: fn, etc }
        this.sliders = new Map();
        this.isUpdating = false; // Flag to prevent cyclic updates
    }

    /**
     * Initialize slider with its configuration
     */
    initSlider(sliderId, config) {
        const slider = document.getElementById(sliderId);
        const valueInput = document.getElementById(config.valueId);
        
        if (!slider || !valueInput) {
            console.warn(`Slider or value input not found: ${sliderId}`);
            return;
        }

        // Sync HTML attributes with config,
        // so range and step match settings.
        if (typeof config.min === 'number') {
            slider.min = String(config.min);
        }
        if (typeof config.max === 'number') {
            slider.max = String(config.max);
        }
        if (typeof config.baseStep === 'number' && config.baseStep > 0) {
            slider.step = String(config.baseStep);
        }

        // Shift+Arrow step is always 10× the base step unless explicitly overridden.
        if ((config.shiftStep == null || config.shiftStep <= 0) && config.baseStep > 0) {
            config.shiftStep = config.baseStep * 10;
        }

        this.sliders.set(sliderId, {
            element: slider,
            valueInput: valueInput,
            config: config
        });

        // Clamp current value to range and format display
        let initialValue = parseFloat(slider.value);
        if (!isNaN(initialValue)) {
            initialValue = this.clamp(initialValue, config.min, config.max);
            slider.value = initialValue;
            this.updateValueDisplay(valueInput, initialValue, config);
        }

        // Event handlers
        slider.addEventListener('input', (e) => this.handleSliderInput(sliderId, e));
        // Removed input handler for valueInput - changes applied only on blur or Enter
        valueInput.addEventListener('keydown', (e) => this.handleKeyDown(sliderId, e));
        valueInput.addEventListener('focus', (e) => e.target.select());
        valueInput.addEventListener('blur', (e) => this.handleValueBlur(sliderId, e));
    }

    /**
     * Handle slider change
     */
    handleSliderInput(sliderId, event) {
        if (this.isUpdating) return;
        
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        const { config, valueInput } = sliderData;
        let value = parseFloat(event.target.value);
        
        // Validation considering rounding error
        // If value very close to boundary (within step), force set boundary
        const epsilon = config.baseStep ? config.baseStep * 0.1 : 0.001;
        if (Math.abs(value - config.max) < epsilon) {
            value = config.max;
        } else if (Math.abs(value - config.min) < epsilon) {
            value = config.min;
        } else {
            value = this.clamp(value, config.min, config.max);
        }
        
        // Update display
        this.updateValueDisplay(valueInput, value, config);
        
        // Update settings
        if (config.setting) {
            this.settings.set(config.setting, value);
        }
        
        // Call callback
        if (config.onUpdate) {
            config.onUpdate(value);
        }
    }

    /**
     * Handle text field input
     */
    handleValueInput(sliderId, event) {
        if (this.isUpdating) return;
        
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        const { element, config } = sliderData;
        let value = parseFloat(event.target.value);
        
        if (isNaN(value)) return;
        
        // Validation
        value = this.clamp(value, config.min, config.max);
        
        // Update slider
        element.value = value;
        
        // Update settings
        if (config.setting) {
            this.settings.set(config.setting, value);
        }
        
        // Call callback
        if (config.onUpdate) {
            config.onUpdate(value);
        }
    }

    /**
     * Determine number of decimal places based on step
     * Example: 0.1 -> 1, 0.01 -> 2, 0.001 -> 3, 0.25 -> 2, 1 -> 0
     */
    getDecimalsFromStep(step) {
        if (step >= 1) return 0;
        
        // Convert step to string for analysis
        const stepStr = step.toString();
        
        // If scientific notation exists (e.g., 1e-4)
        if (stepStr.includes('e')) {
            const match = stepStr.match(/e-(\d+)/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        
        // If dot exists, count digits after it
        if (stepStr.includes('.')) {
            const parts = stepStr.split('.');
            if (parts.length === 2) {
                // Return length of entire part after dot (including leading zeros)
                // Example: "01" -> 2, "1" -> 1, "25" -> 2
                return parts[1].length;
            }
        }
        
        return 0;
    }

    /**
     * Handle key presses (Arrow keys, Enter, Escape)
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
        
        // Determine step to use
        const step = event.shiftKey && shiftStep > 0 ? shiftStep : baseStep;
        const stepDecimals = step > 0 ? this.getDecimalsFromStep(step) : (config.decimals || 0);

        switch (event.key) {
            case 'ArrowUp':
                if (event.shiftKey && shiftStep > 0) {
                    // With Shift: snap to nearest larger step up
                    // First round current value to step decimal places
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
                    // Round current value to step decimal places before changing
                    const roundedCurrent = stepDecimals > 0 
                        ? parseFloat(currentValue.toFixed(stepDecimals))
                        : Math.round(currentValue);
                    newValue = roundedCurrent + baseStep;
                }
                handled = true;
                break;
            case 'ArrowDown':
                if (event.shiftKey && shiftStep > 0) {
                    // With Shift: snap to nearest larger step down
                    // First round current value to step decimal places
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
                    // Round current value to step decimal places before changing
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
                // Restore value from settings
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
            
            // Round result by step decimal places (if step specified)
            // Otherwise use config.decimals
            if (step > 0 && stepDecimals > 0) {
                newValue = parseFloat(newValue.toFixed(stepDecimals));
            } else if (typeof config.decimals === 'number') {
                newValue = parseFloat(newValue.toFixed(config.decimals));
            }
            newValue = this.clamp(newValue, config.min, config.max);
            
            // Update UI
            this.updateValueDisplay(valueInput, newValue, config);
            element.value = newValue;
            
            // Update settings
            if (config.setting) {
                this.settings.set(config.setting, newValue);
            }
            
            // Call callback
            if (config.onUpdate) {
                config.onUpdate(newValue);
            }
        } else if (handled) {
            event.preventDefault();
        }
    }

    /**
     * Handle blur - validation, formatting and apply changes
     */
    handleValueBlur(sliderId, event) {
        if (this.isUpdating) return;
        
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        const { element, valueInput, config } = sliderData;
        let value = parseFloat(valueInput.value);
        
        if (isNaN(value)) {
            // Restore from settings
            value = config.setting ? this.settings.get(config.setting) : parseFloat(element.value);
        }
        
        // Validation
        value = this.clamp(value, config.min, config.max);
        
        // Update UI with correct formatting
        this.updateValueDisplay(valueInput, value, config);
        element.value = value;
        
        // Update settings
        if (config.setting) {
            this.settings.set(config.setting, value);
        }
        
        // Call callback to apply changes
        if (config.onUpdate) {
            config.onUpdate(value);
        }
    }

    /**
     * Update displayed value with formatting
     */
    updateValueDisplay(valueInput, value, config) {
        const formatted = value.toFixed(config.decimals);
        const suffix = config.suffix || '';
        valueInput.value = formatted + suffix;
    }

    /**
     * Programmatic slider value update
     */
    setValue(sliderId, value, triggerCallback = true) {
        this.isUpdating = !triggerCallback;
        
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) {
            this.isUpdating = false;
            return;
        }

        const { element, valueInput, config } = sliderData;
        
        // Validation
        value = this.clamp(value, config.min, config.max);
        
        // Update UI
        element.value = value;
        this.updateValueDisplay(valueInput, value, config);
        
        // Update settings
        if (config.setting) {
            this.settings.set(config.setting, value);
        }
        
        // Call callback
        if (triggerCallback && config.onUpdate) {
            config.onUpdate(value);
        }
        
        this.isUpdating = false;
    }

    /**
     * Get current slider value
     */
    getValue(sliderId) {
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return null;
        
        return parseFloat(sliderData.element.value);
    }

    /**
     * Update slider limits
     */
    updateLimits(sliderId, min, max) {
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        const { element, config } = sliderData;
        
        config.min = min;
        config.max = max;
        
        element.min = min;
        element.max = max;
        
        // Validate current value
        const currentValue = parseFloat(element.value);
        if (currentValue < min || currentValue > max) {
            this.setValue(sliderId, this.clamp(currentValue, min, max), true);
        }
    }

    /**
     * Helper function - clamp value
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Get all slider values
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
     * Enable/disable slider
     */
    setEnabled(sliderId, enabled) {
        const sliderData = this.sliders.get(sliderId);
        if (!sliderData) return;

        sliderData.element.disabled = !enabled;
        sliderData.valueInput.disabled = !enabled;
    }
}

