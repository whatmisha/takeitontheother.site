export function clampSliderValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function getDecimalsFromStep(step) {
    if (step >= 1) return 0;
    const value = String(step);
    if (value.includes('e')) {
        const match = value.match(/e-(\d+)/);
        if (match) return Number.parseInt(match[1], 10);
    }
    return value.includes('.') ? value.split('.')[1].length : 0;
}

export function normalizeSliderInput(value, config) {
    const epsilon = config.baseStep ? config.baseStep * 0.1 : 0.001;
    if (Math.abs(value - config.max) < epsilon) return config.max;
    if (Math.abs(value - config.min) < epsilon) return config.min;
    return clampSliderValue(value, config.min, config.max);
}

export function stepSliderValue(currentValue, direction, shiftKey, config) {
    const baseStep = config.baseStep || 0;
    const shiftStep = config.shiftStep || 0;
    const step = shiftKey && shiftStep > 0 ? shiftStep : baseStep;
    const decimals = step > 0
        ? getDecimalsFromStep(step)
        : (config.decimals || 0);
    let value = currentValue;

    if (shiftKey && shiftStep > 0) {
        const ratio = currentValue / shiftStep;
        const nearest = Math.round(ratio);
        const isMultiple = Math.abs(ratio - nearest) < 1e-6;
        value = isMultiple
            ? currentValue + direction * shiftStep
            : (direction > 0 ? Math.ceil(ratio) : Math.floor(ratio)) * shiftStep;
    } else if (baseStep > 0) {
        const rounded = decimals > 0
            ? Number.parseFloat(currentValue.toFixed(decimals))
            : Math.round(currentValue);
        value = rounded + direction * baseStep;
    }

    if (step > 0 && decimals > 0) value = Number.parseFloat(value.toFixed(decimals));
    else if (typeof config.decimals === 'number') {
        value = Number.parseFloat(value.toFixed(config.decimals));
    }
    return clampSliderValue(value, config.min, config.max);
}

export function formatSliderValue(value, config) {
    return `${value.toFixed(config.decimals)}${config.suffix || ''}`;
}
