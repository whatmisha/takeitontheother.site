/**
 * RangeSliderController - Controller for range sliders with two handles
 * Manages value range (min and max) on single visual slider
 */
export class RangeSliderController {
    constructor(settings) {
        this.settings = settings;
        this.ranges = new Map();
        this._cleanups = [];
    }

    /**
     * Initialize range slider
     * @param {string} containerId - Container ID for range slider
     * @param {Object} config - Configuration
     * @param {string} config.minSetting - Setting name for minimum value
     * @param {string} config.maxSetting - Setting name for maximum value
     * @param {number} config.min - Minimum range value
     * @param {number} config.max - Maximum range value
     * @param {number} config.decimals - Number of decimal places
     * @param {number} config.baseStep - Base step
     * @param {number} config.shiftStep - Step when Shift pressed
     * @param {Function} config.onUpdate - Callback on value change
     */
    initRangeSlider(containerId, config) {
        if (this.ranges.has(containerId)) return;
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Range slider container not found: ${containerId}`);
            return;
        }

        // Shift+Arrow step is always 10× the base step unless explicitly overridden.
        if ((config.shiftStep == null || config.shiftStep <= 0) && config.baseStep > 0) {
            config.shiftStep = config.baseStep * 10;
        }

        // Create HTML structure for range slider
        const track = document.createElement('div');
        track.className = 'range-slider-track';
        
        const minThumb = document.createElement('div');
        minThumb.className = 'range-slider-thumb range-slider-thumb-min';
        minThumb.setAttribute('role', 'slider');
        minThumb.setAttribute('tabindex', '0');
        minThumb.setAttribute('aria-valuemin', config.min);
        minThumb.setAttribute('aria-valuemax', config.max);
        
        const maxThumb = document.createElement('div');
        maxThumb.className = 'range-slider-thumb range-slider-thumb-max';
        maxThumb.setAttribute('role', 'slider');
        maxThumb.setAttribute('tabindex', '0');
        maxThumb.setAttribute('aria-valuemin', config.min);
        maxThumb.setAttribute('aria-valuemax', config.max);
        
        const activeRange = document.createElement('div');
        activeRange.className = 'range-slider-active';
        
        // Structure: container contains track, activeRange and thumbs
        // All positioned relative to container
        container.appendChild(track);
        container.appendChild(activeRange);
        container.appendChild(minThumb);
        container.appendChild(maxThumb);

        // Get initial values
        let minValue = this.settings.get(config.minSetting);
        let maxValue = this.settings.get(config.maxSetting);
        
        // Validation and normalization
        minValue = this.clamp(minValue, config.min, config.max);
        maxValue = this.clamp(maxValue, config.min, config.max);
        if (minValue > maxValue) {
            [minValue, maxValue] = [maxValue, minValue];
        }

        this.ranges.set(containerId, {
            container,
            track,
            minThumb,
            maxThumb,
            activeRange,
            config,
            minValue,
            maxValue,
            isDragging: false,
            dragTarget: null,
            createdElements: [track, activeRange, minThumb, maxThumb],
            stopDocumentDrags: []
        });

        // Initialize positions
        this.updatePositions(containerId);
        
        // Update text fields on initialization
        const minValueDisplay = document.getElementById(config.minValueId);
        const maxValueDisplay = document.getElementById(config.maxValueId);
        
        if (minValueDisplay) {
            minValueDisplay.value = minValue.toFixed(config.decimals);
        }
        if (maxValueDisplay) {
            maxValueDisplay.value = maxValue.toFixed(config.decimals);
        }

        // Event handlers for min thumb
        this.setupThumbEvents(containerId, 'min');
        
        // Event handlers for max thumb
        this.setupThumbEvents(containerId, 'max');

        // Keyboard handlers on thumbs
        this.setupKeyboardEvents(containerId, 'min');
        this.setupKeyboardEvents(containerId, 'max');
        
        // Handlers for text input fields
        this.setupInputEvents(containerId, 'min');
        this.setupInputEvents(containerId, 'max');
    }

    /**
     * Setup events for text input fields
     */
    setupInputEvents(containerId, type) {
        const rangeData = this.ranges.get(containerId);
        if (!rangeData) return;

        const inputId = type === 'min' ? rangeData.config.minValueId : rangeData.config.maxValueId;
        const input = document.getElementById(inputId);
        if (!input) return;

        // Select text on focus
        this._listen(input, 'focus', (e) => {
            e.target.select();
        });

        // Apply value on blur
        this._listen(input, 'blur', (e) => {
            this.handleInputBlur(containerId, type, e.target);
        });

        // Handle keys (arrows, Enter, Escape)
        this._listen(input, 'keydown', (e) => {
            this.handleInputKeyDown(containerId, type, e);
        });
    }

    /**
     * Handle text field blur
     */
    handleInputBlur(containerId, type, input) {
        const rangeData = this.ranges.get(containerId);
        if (!rangeData) return;

        let value = parseFloat(input.value);
        
        if (isNaN(value)) {
            // Restore previous value
            value = type === 'min' ? rangeData.minValue : rangeData.maxValue;
        }

        // Validation considering other value
        if (type === 'min') {
            value = this.clamp(value, rangeData.config.min, rangeData.maxValue);
            rangeData.minValue = this.roundToStep(value, rangeData.config.baseStep);
        } else {
            value = this.clamp(value, rangeData.minValue, rangeData.config.max);
            rangeData.maxValue = this.roundToStep(value, rangeData.config.baseStep);
        }

        this.updatePositions(containerId);
        this.updateSettings(containerId);
    }

    /**
     * Determine number of decimal places based on step
     */
    getDecimalsFromStep(step) {
        if (step >= 1) return 0;
        const stepStr = step.toString();
        if (stepStr.includes('e')) {
            const match = stepStr.match(/e-(\d+)/);
            if (match) return parseInt(match[1]);
        }
        if (stepStr.includes('.')) {
            const parts = stepStr.split('.');
            if (parts.length === 2) return parts[1].length;
        }
        return 0;
    }

    /**
     * Handle key presses in text field
     */
    handleInputKeyDown(containerId, type, event) {
        const rangeData = this.ranges.get(containerId);
        if (!rangeData) return;

        const input = event.target;
        let currentValue = parseFloat(input.value);
        if (isNaN(currentValue)) {
            currentValue = type === 'min' ? rangeData.minValue : rangeData.maxValue;
        }

        const baseStep = rangeData.config.baseStep || 0.1;
        const shiftStep = rangeData.config.shiftStep || baseStep * 10;
        const step = event.shiftKey ? shiftStep : baseStep;
        const stepDecimals = step > 0 ? this.getDecimalsFromStep(step) : (rangeData.config.decimals || 0);

        let newValue = currentValue;
        let handled = false;

        switch (event.key) {
            case 'ArrowUp':
                if (event.shiftKey && shiftStep > 0) {
                    // With Shift: snap to nearest larger step up
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
                    const roundedCurrent = stepDecimals > 0 
                        ? parseFloat(currentValue.toFixed(stepDecimals))
                        : Math.round(currentValue);
                    newValue = roundedCurrent - baseStep;
                }
                handled = true;
                break;
            case 'Enter':
                input.blur();
                handled = true;
                break;
            case 'Escape':
                // Restore previous value
                newValue = type === 'min' ? rangeData.minValue : rangeData.maxValue;
                input.value = newValue.toFixed(rangeData.config.decimals);
                input.blur();
                handled = true;
                break;
        }

        if (handled && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            
            // Round result
            if (step > 0 && stepDecimals > 0) {
                newValue = parseFloat(newValue.toFixed(stepDecimals));
            } else if (typeof rangeData.config.decimals === 'number') {
                newValue = parseFloat(newValue.toFixed(rangeData.config.decimals));
            }

            // Validation considering other value
            if (type === 'min') {
                newValue = this.clamp(newValue, rangeData.config.min, rangeData.maxValue);
                rangeData.minValue = newValue;
            } else {
                newValue = this.clamp(newValue, rangeData.minValue, rangeData.config.max);
                rangeData.maxValue = newValue;
            }

            this.updatePositions(containerId);
            this.updateSettings(containerId);
        } else if (handled) {
            event.preventDefault();
        }
    }

    /**
     * Setup events for thumb
     */
    setupThumbEvents(containerId, type) {
        const rangeData = this.ranges.get(containerId);
        if (!rangeData) return;

        const thumb = type === 'min' ? rangeData.minThumb : rangeData.maxThumb;
        const track = rangeData.track;

        let isDragging = false;
        let startX = 0;
        let startMin = 0;
        let startMax = 0;

        const handleMouseDown = (e) => {
            e.preventDefault();
            isDragging = true;
            rangeData.isDragging = true;
            rangeData.dragTarget = type;
            startX = e.clientX;
            startMin = rangeData.minValue;
            startMax = rangeData.maxValue;
            thumb.style.cursor = 'grabbing';
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const rect = track.getBoundingClientRect();
            const percent = this.clamp((e.clientX - rect.left) / rect.width, 0, 1);
            const newValue = rangeData.config.min + percent * (rangeData.config.max - rangeData.config.min);
            
            if (type === 'min') {
                const clampedValue = this.clamp(newValue, rangeData.config.min, rangeData.maxValue);
                rangeData.minValue = this.roundToStep(clampedValue, rangeData.config.baseStep);
            } else {
                const clampedValue = this.clamp(newValue, rangeData.minValue, rangeData.config.max);
                rangeData.maxValue = this.roundToStep(clampedValue, rangeData.config.baseStep);
            }

            this.updatePositions(containerId);
            this.updateSettings(containerId);
        };

        const handleMouseUp = () => {
            isDragging = false;
            rangeData.isDragging = false;
            rangeData.dragTarget = null;
            thumb.style.cursor = 'grab';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        rangeData.stopDocumentDrags.push(() => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            isDragging = false;
        });
        this._listen(thumb, 'mousedown', handleMouseDown);
        thumb.style.cursor = 'grab';
    }

    /**
     * Setup keyboard events
     */
    setupKeyboardEvents(containerId, type) {
        const rangeData = this.ranges.get(containerId);
        if (!rangeData) return;

        const thumb = type === 'min' ? rangeData.minThumb : rangeData.maxThumb;

        this._listen(thumb, 'keydown', (e) => {
            const step = e.shiftKey && rangeData.config.shiftStep > 0 
                ? rangeData.config.shiftStep 
                : rangeData.config.baseStep;
            
            let newValue = type === 'min' ? rangeData.minValue : rangeData.maxValue;

            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowUp':
                    newValue += step;
                    break;
                case 'ArrowLeft':
                case 'ArrowDown':
                    newValue -= step;
                    break;
                case 'Home':
                    newValue = type === 'min' ? rangeData.config.min : rangeData.minValue;
                    break;
                case 'End':
                    newValue = type === 'min' ? rangeData.maxValue : rangeData.config.max;
                    break;
                default:
                    return;
            }

            e.preventDefault();

            // Validation
            if (type === 'min') {
                newValue = this.clamp(newValue, rangeData.config.min, rangeData.maxValue);
            } else {
                newValue = this.clamp(newValue, rangeData.minValue, rangeData.config.max);
            }

            newValue = this.roundToStep(newValue, step);

            if (type === 'min') {
                rangeData.minValue = newValue;
            } else {
                rangeData.maxValue = newValue;
            }

            this.updatePositions(containerId);
            this.updateSettings(containerId);
        });
    }

    /**
     * Update thumb positions and active range
     */
    updatePositions(containerId) {
        const rangeData = this.ranges.get(containerId);
        if (!rangeData) return;

        const { config, minValue, maxValue, track, minThumb, maxThumb, activeRange } = rangeData;
        
        const range = config.max - config.min;
        const minPercent = ((minValue - config.min) / range) * 100;
        const maxPercent = ((maxValue - config.min) / range) * 100;

        // Thumb size for position constraint (so it doesn't go outside container)
        const thumbWidth = 8; // px
        
        // Min thumb: tip on right, constrain so left edge doesn't go left
        // transform: translate(-100%, -50%) shifts element left by its width
        // Minimum position = thumbWidth px, so left edge is at 0
        minThumb.style.left = `clamp(${thumbWidth}px, ${minPercent}%, calc(100% - ${thumbWidth}px))`;
        
        // Max thumb: tip on left, constrain so right edge doesn't go right
        // Maximum position = 100% - thumbWidth px
        maxThumb.style.left = `clamp(${thumbWidth}px, ${maxPercent}%, calc(100% - ${thumbWidth}px))`;
        
        // Active range between min tip and max tip
        // Use left and right for correct constraint
        activeRange.style.left = `clamp(${thumbWidth}px, ${minPercent}%, calc(100% - ${thumbWidth}px))`;
        activeRange.style.right = `clamp(${thumbWidth}px, ${100 - maxPercent}%, calc(100% - ${thumbWidth}px))`;
        activeRange.style.width = 'auto';

        // Update aria attributes
        minThumb.setAttribute('aria-valuenow', minValue.toFixed(config.decimals));
        maxThumb.setAttribute('aria-valuenow', maxValue.toFixed(config.decimals));
    }

    /**
     * Update settings and call callback
     */
    updateSettings(containerId) {
        const rangeData = this.ranges.get(containerId);
        if (!rangeData) return;

        this.settings.set(rangeData.config.minSetting, rangeData.minValue);
        this.settings.set(rangeData.config.maxSetting, rangeData.maxValue);

        // Update displayed values
        const minValueDisplay = document.getElementById(rangeData.config.minValueId);
        const maxValueDisplay = document.getElementById(rangeData.config.maxValueId);
        
        if (minValueDisplay) {
            minValueDisplay.value = rangeData.minValue.toFixed(rangeData.config.decimals);
        }
        if (maxValueDisplay) {
            maxValueDisplay.value = rangeData.maxValue.toFixed(rangeData.config.decimals);
        }

        // Call callback
        if (rangeData.config.onUpdate) {
            rangeData.config.onUpdate(rangeData.minValue, rangeData.maxValue);
        }
    }

    /**
     * Set values programmatically
     */
    setValues(containerId, minValue, maxValue, triggerCallback = true) {
        const rangeData = this.ranges.get(containerId);
        if (!rangeData) return;

        // Validation
        minValue = this.clamp(minValue, rangeData.config.min, rangeData.config.max);
        maxValue = this.clamp(maxValue, rangeData.config.min, rangeData.config.max);
        
        if (minValue > maxValue) {
            [minValue, maxValue] = [maxValue, minValue];
        }

        rangeData.minValue = minValue;
        rangeData.maxValue = maxValue;

        this.updatePositions(containerId);
        
        if (triggerCallback) {
            this.updateSettings(containerId);
        } else {
            // Update only settings without calling callback
            this.settings.set(rangeData.config.minSetting, minValue);
            this.settings.set(rangeData.config.maxSetting, maxValue);
            
            const minValueDisplay = document.getElementById(rangeData.config.minValueId);
            const maxValueDisplay = document.getElementById(rangeData.config.maxValueId);
            
            if (minValueDisplay) {
                minValueDisplay.value = minValue.toFixed(rangeData.config.decimals);
            }
            if (maxValueDisplay) {
                maxValueDisplay.value = maxValue.toFixed(rangeData.config.decimals);
            }
        }
    }

    /**
     * Get values
     */
    getValues(containerId) {
        const rangeData = this.ranges.get(containerId);
        if (!rangeData) return null;

        return {
            min: rangeData.minValue,
            max: rangeData.maxValue
        };
    }

    /**
     * Helper functions
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    roundToStep(value, step) {
        if (step <= 0) return value;
        return Math.round(value / step) * step;
    }

    _listen(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        this._cleanups.push(() => target.removeEventListener(type, listener, options));
    }

    destroy() {
        for (const rangeData of this.ranges.values()) {
            for (const stopDocumentDrag of rangeData.stopDocumentDrags || []) stopDocumentDrag();
            for (const element of rangeData.createdElements || []) element.remove?.();
        }
        for (const cleanup of this._cleanups.splice(0).reverse()) cleanup();
        this.ranges.clear();
    }
}
