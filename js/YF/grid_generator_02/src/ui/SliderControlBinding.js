import { clampSliderValue, formatSliderValue } from './SliderValueMath.js';
import { ListenerScope } from '../core/ListenerScope.js';

/** Resolves and binds one range/input pair. */
export class SliderControlBinding {
    constructor({ documentRef = globalThis.document } = {}) {
        this.document = documentRef;
        this.listeners = new ListenerScope();
    }

    create(sliderId, config, handlers) {
        const element = this.document?.getElementById(sliderId);
        const valueInput = this.document?.getElementById(config.valueId);
        if (!element || !valueInput) {
            console.warn(`Slider or value input not found: ${sliderId}`);
            return null;
        }

        if (typeof config.min === 'number') element.min = String(config.min);
        if (typeof config.max === 'number') element.max = String(config.max);
        if (typeof config.baseStep === 'number' && config.baseStep > 0) {
            element.step = String(config.baseStep);
        }

        const data = {
            element,
            valueInput,
            config,
            defaultLimits: { min: config.min, max: config.max }
        };
        const initial = Number.parseFloat(element.value);
        if (Number.isFinite(initial)) {
            const value = clampSliderValue(initial, config.min, config.max);
            element.value = value;
            valueInput.value = formatSliderValue(value, config);
        }

        this.listeners.listen(element, 'input', handlers.sliderInput);
        this.listeners.listen(valueInput, 'keydown', handlers.keydown);
        this.listeners.listen(valueInput, 'focus', event => {
            event.target.dataset.originalValue = event.target.value;
            event.target.select();
        });
        this.listeners.listen(valueInput, 'blur', handlers.blur);
        return data;
    }

    dispose() {
        return this.listeners.dispose();
    }
}
