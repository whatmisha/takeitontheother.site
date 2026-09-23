const numericSlider = (valueId, setting, min, max, decimals, baseStep, shiftStep, group, extra = {}) => ({
    valueId,
    setting,
    min,
    max,
    decimals,
    baseStep,
    shiftStep,
    group,
    ...extra
});

const DIMENSION_SLIDERS = Object.fromEntries([
    ['frontWidthSlider', 'frontWidthValue', 'frontWidth'],
    ['frontHeightSlider', 'frontHeightValue', 'frontHeight'],
    ['thicknessSlider', 'thicknessValue', 'thickness']
].map(([id, valueId, setting]) => [
    id,
    numericSlider(valueId, setting, 10, 1000, 1, 1, 10, 'dimensions')
]));

const GRID_SLIDERS = {
    gridModuleSlider: numericSlider('gridModuleValue', 'gridModule', 0.1, 100, 4, 0.1, 1, 'grid'),
    marginsSlider: numericSlider('marginsValue', null, 0, 50, 4, 0.0001, 0.1, 'grid'),
    columnCountSlider: numericSlider('columnCountValue', 'columnCount', 1, 128, 0, 1, 10, 'grid'),
    rowCountSlider: numericSlider('rowCountValue', 'rowCount', 1, 128, 0, 1, 10, 'grid'),
    rowHeightSlider: numericSlider('rowHeightValue', 'rowHeight', 1, 64, 0, 1, 10, 'grid')
};

const COLOR_SLIDERS = Object.fromEntries([
    ['hue', 360],
    ['saturation', 100],
    ['brightness', 100]
].map(([channel, max]) => [
    `${channel}Slider`,
    numericSlider(`${channel}Value`, null, 0, max, 0, 1, 10, 'color')
]));

const TYPOGRAPHY_STYLES = Object.freeze({
    headline: {
        size: ['headlineSizeSlider', 'headlineSizeValue'],
        lineHeight: ['lineHeightSlider', 'lineHeightValue'],
        tracking: ['trackingSlider', 'trackingValue', 'tracking']
    },
    text: {
        size: ['textSizeSlider', 'textSizeValue'],
        lineHeight: ['textLineHeightSlider', 'textLineHeightValue'],
        tracking: ['textTrackingSlider', 'textTrackingValue', 'textTracking']
    },
    caption: {
        size: ['captionSizeSlider', 'captionSizeValue'],
        lineHeight: ['captionLineHeightSlider', 'captionLineHeightValue'],
        tracking: ['captionTrackingSlider', 'captionTrackingValue', 'captionTracking']
    },
    lunnenDisplay: {
        size: ['lunnenDisplaySizeSlider', 'lunnenDisplaySizeValue'],
        lineHeight: ['lunnenDisplayLineHeightSlider', 'lunnenDisplayLineHeightValue'],
        tracking: ['lunnenDisplayTrackingSlider', 'lunnenDisplayTrackingValue', 'lunnenDisplayTracking']
    }
});

function createTypographySliders() {
    const sliders = {};
    Object.entries(TYPOGRAPHY_STYLES).forEach(([style, definitions]) => {
        const [sizeId, sizeValueId] = definitions.size;
        const [lineId, lineValueId] = definitions.lineHeight;
        const [trackingId, trackingValueId, trackingSetting] = definitions.tracking;
        sliders[sizeId] = numericSlider(sizeValueId, null, 0.01, 25, 2, 0.1, 1, 'typography', { style });
        sliders[lineId] = numericSlider(lineValueId, null, 0.01, 50, 2, 0.1, 1, 'typography', { style });
        sliders[trackingId] = numericSlider(trackingValueId, trackingSetting, -0.1, 0.1, 3, 0.001, 0.01, 'typography', { style });
    });
    return sliders;
}

export const SLIDER_CONFIG = Object.freeze({
    ...DIMENSION_SLIDERS,
    ...GRID_SLIDERS,
    ...COLOR_SLIDERS,
    ...createTypographySliders()
});

export function getSlidersByGroup(group) {
    return Object.fromEntries(
        Object.entries(SLIDER_CONFIG).filter(([, config]) => config.group === group)
    );
}

export function getTypographySliders(style) {
    return Object.fromEntries(
        Object.entries(SLIDER_CONFIG).filter(([, config]) => (
            config.group === 'typography' && config.style === style
        ))
    );
}
