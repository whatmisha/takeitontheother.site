import { MathUtils } from '../utils/MathUtils.js';
import { SLIDER_CONFIG } from './SliderConfig.js?v=1.12.64';

const SIZE_SLIDERS = {
    headlineSizeSlider: ['headlineSize', 'headline'],
    textSizeSlider: ['textSize', 'text'],
    captionSizeSlider: ['captionSize', 'caption'],
    lunnenDisplaySizeSlider: ['lunnenDisplaySize', 'lunnenDisplay']
};

const LINE_HEIGHT_SLIDERS = {
    lineHeightSlider: 'lineHeight',
    textLineHeightSlider: 'textLineHeight',
    captionLineHeightSlider: 'captionLineHeight',
    lunnenDisplayLineHeightSlider: 'lunnenDisplayLineHeight'
};

const TRACKING_SLIDERS = [
    'trackingSlider',
    'textTrackingSlider',
    'captionTrackingSlider',
    'lunnenDisplayTrackingSlider'
];

const SURFACE_GRID_SLIDERS = {
    surfaceGridModuleSlider: {
        valueId: 'surfaceGridModuleInput',
        field: 'module',
        min: 0.1,
        max: 100,
        decimals: 4,
        baseStep: 0.1,
        shiftStep: 1
    },
    surfaceGridMarginsSlider: {
        valueId: 'surfaceGridMarginsInput',
        field: 'margins',
        min: 0,
        max: 10,
        decimals: 4,
        baseStep: 0.0001,
        shiftStep: 0.1
    },
    surfaceGridColumnsSlider: {
        valueId: 'surfaceGridColumnsInput',
        field: 'columns',
        min: 1,
        max: 128,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10
    },
    surfaceGridRowsSlider: {
        valueId: 'surfaceGridRowsInput',
        field: 'rows',
        min: 1,
        max: 128,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10
    },
    surfaceGridRowHeightSlider: {
        valueId: 'surfaceGridRowHeightInput',
        field: 'rowHeight',
        min: 1,
        max: 64,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10
    }
};

function cloneBaseConfig() {
    return Object.fromEntries(
        Object.entries(SLIDER_CONFIG).map(([sliderId, config]) => [sliderId, { ...config }])
    );
}

function readDisplayValue(host, sliderId, displayValue) {
    if (Number.isFinite(displayValue)) return displayValue;

    const controllerValue = host.sliderController?.getValue(sliderId);
    if (Number.isFinite(controllerValue)) return controllerValue;

    const inputValue = Number.parseFloat(host.dom?.[sliderId]?.value || '0');
    return Number.isFinite(inputValue) ? inputValue : 0;
}

function updateSize(host, sliderId, setting, style, displayValue) {
    const value = readDisplayValue(host, sliderId, displayValue);
    const sizeInModules = host.settingsModule.get('fontSizeUnit') === 'pt'
        ? host.textStyleResolver.fontSizeMmToModules(MathUtils.ptToMm(value), style)
        : value;

    host.settingsModule.set(setting, Number.parseFloat(sizeInModules.toFixed(2)));
    host.updateGridDebounced();
}

function updateLineHeight(host, sliderId, setting, displayValue) {
    const value = readDisplayValue(host, sliderId, displayValue);
    const gridModule = host.settingsModule.get('gridModule');
    const lineHeightInModules = host.settingsModule.get('lineHeightUnit') === 'pt'
        ? (gridModule > 0 ? MathUtils.ptToMm(value) / gridModule : 0)
        : value;

    host.settingsModule.set(setting, Number.parseFloat(lineHeightInModules.toFixed(2)));
    host.updateGridDebounced();
}

/**
 * Builds the runtime slider configuration without duplicating typography and
 * surface conversion rules in the application shell.
 */
export function createSliderConfig(host) {
    const config = cloneBaseConfig();

    Object.entries(SURFACE_GRID_SLIDERS).forEach(([sliderId, surfaceConfig]) => {
        const { field, ...sliderConfig } = surfaceConfig;
        config[sliderId] = {
            ...sliderConfig,
            setting: null,
            group: 'surface',
            onUpdate: value => host.surfacePanelController?.applyGridValue(field, value)
        };
    });

    config.hueSlider.onUpdate = () => host.colorPanelController?.handleHsbSlider('hue');
    config.saturationSlider.onUpdate = () => (
        host.colorPanelController?.handleHsbSlider('saturation')
    );
    config.brightnessSlider.onUpdate = () => (
        host.colorPanelController?.handleHsbSlider('brightness')
    );

    Object.entries(SIZE_SLIDERS).forEach(([sliderId, [setting, style]]) => {
        config[sliderId].onUpdate = value => (
            updateSize(host, sliderId, setting, style, value)
        );
    });

    Object.entries(LINE_HEIGHT_SLIDERS).forEach(([sliderId, setting]) => {
        config[sliderId].onUpdate = value => (
            updateLineHeight(host, sliderId, setting, value)
        );
    });

    TRACKING_SLIDERS.forEach(sliderId => {
        config[sliderId].onUpdate = () => {
            host.markAsChanged();
            host.updateGridDebounced();
        };
    });

    return config;
}
