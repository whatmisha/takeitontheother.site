/**
 * Конфигурация слайдеров приложения
 * 
 * Содержит только данные (без callback'ов).
 * Callback'и привязываются в GridGenerator через слушатели событий.
 */

export const SLIDER_CONFIG = {
    // ============================================
    // Dimension sliders
    // ============================================
    frontWidthSlider: {
        valueId: 'frontWidthValue',
        setting: 'frontWidth',
        min: 10,
        max: 1000,
        decimals: 1,
        baseStep: 1,
        shiftStep: 10,
        group: 'dimensions'
    },
    frontHeightSlider: {
        valueId: 'frontHeightValue',
        setting: 'frontHeight',
        min: 10,
        max: 1000,
        decimals: 1,
        baseStep: 1,
        shiftStep: 10,
        group: 'dimensions'
    },
    thicknessSlider: {
        valueId: 'thicknessValue',
        setting: 'thickness',
        min: 10,
        max: 1000,
        decimals: 1,
        baseStep: 1,
        shiftStep: 10,
        group: 'dimensions'
    },

    // ============================================
    // Grid sliders
    // ============================================
    gridModuleSlider: {
        valueId: 'gridModuleValue',
        setting: 'gridModule',
        min: 0.1,
        max: 100,
        decimals: 4,
        baseStep: 0.1,
        shiftStep: 1,
        group: 'grid'
    },
    marginsSlider: {
        valueId: 'marginsValue',
        setting: null, // Managed manually due to unit conversion
        min: 0,
        max: 50,
        decimals: 4,
        baseStep: 0.0001,
        shiftStep: 0.1,
        group: 'grid'
    },
    columnCountSlider: {
        valueId: 'columnCountValue',
        setting: 'columnCount',
        min: 1,
        max: 128,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10,
        group: 'grid'
    },
    rowCountSlider: {
        valueId: 'rowCountValue',
        setting: 'rowCount',
        min: 1,
        max: 128,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10,
        group: 'grid'
    },
    rowHeightSlider: {
        valueId: 'rowHeightValue',
        setting: 'rowHeight',
        min: 1,
        max: 64,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10,
        group: 'grid'
    },

    // ============================================
    // Color sliders (HSB)
    // ============================================
    hueSlider: {
        valueId: 'hueValue',
        setting: null, // Handled by ColorPicker
        min: 0,
        max: 360,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10,
        group: 'color'
    },
    saturationSlider: {
        valueId: 'saturationValue',
        setting: null,
        min: 0,
        max: 100,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10,
        group: 'color'
    },
    brightnessSlider: {
        valueId: 'brightnessValue',
        setting: null,
        min: 0,
        max: 100,
        decimals: 0,
        baseStep: 1,
        shiftStep: 10,
        group: 'color'
    },

    // ============================================
    // Typography - Headline
    // ============================================
    headlineSizeSlider: {
        valueId: 'headlineSizeValue',
        setting: null, // Managed manually due to unit conversion
        min: 0.01,
        max: 25,
        decimals: 2,
        baseStep: 0.1,
        shiftStep: 1,
        group: 'typography',
        style: 'headline'
    },
    lineHeightSlider: {
        valueId: 'lineHeightValue',
        setting: null,
        min: 0.01,
        max: 50,
        decimals: 2,
        baseStep: 0.1,
        shiftStep: 1,
        group: 'typography',
        style: 'headline'
    },
    trackingSlider: {
        valueId: 'trackingValue',
        setting: 'tracking',
        min: -0.1,
        max: 0.1,
        decimals: 3,
        baseStep: 0.001,
        shiftStep: 0.01,
        group: 'typography',
        style: 'headline'
    },

    // ============================================
    // Typography - Text
    // ============================================
    textSizeSlider: {
        valueId: 'textSizeValue',
        setting: null,
        min: 0.01,
        max: 25,
        decimals: 2,
        baseStep: 0.1,
        shiftStep: 1,
        group: 'typography',
        style: 'text'
    },
    textLineHeightSlider: {
        valueId: 'textLineHeightValue',
        setting: null,
        min: 0.01,
        max: 50,
        decimals: 2,
        baseStep: 0.1,
        shiftStep: 1,
        group: 'typography',
        style: 'text'
    },
    textTrackingSlider: {
        valueId: 'textTrackingValue',
        setting: 'textTracking',
        min: -0.1,
        max: 0.1,
        decimals: 3,
        baseStep: 0.001,
        shiftStep: 0.01,
        group: 'typography',
        style: 'text'
    },

    // ============================================
    // Typography - Caption
    // ============================================
    captionSizeSlider: {
        valueId: 'captionSizeValue',
        setting: null,
        min: 0.01,
        max: 25,
        decimals: 2,
        baseStep: 0.1,
        shiftStep: 1,
        group: 'typography',
        style: 'caption'
    },
    captionLineHeightSlider: {
        valueId: 'captionLineHeightValue',
        setting: null,
        min: 0.01,
        max: 50,
        decimals: 2,
        baseStep: 0.1,
        shiftStep: 1,
        group: 'typography',
        style: 'caption'
    },
    captionTrackingSlider: {
        valueId: 'captionTrackingValue',
        setting: 'captionTracking',
        min: -0.1,
        max: 0.1,
        decimals: 3,
        baseStep: 0.001,
        shiftStep: 0.01,
        group: 'typography',
        style: 'caption'
    },

    // ============================================
    // Typography - Lunnen Display
    // ============================================
    lunnenDisplaySizeSlider: {
        valueId: 'lunnenDisplaySizeValue',
        setting: null,
        min: 0.01,
        max: 25,
        decimals: 2,
        baseStep: 0.1,
        shiftStep: 1,
        group: 'typography',
        style: 'lunnenDisplay'
    },
    lunnenDisplayLineHeightSlider: {
        valueId: 'lunnenDisplayLineHeightValue',
        setting: null,
        min: 0.01,
        max: 50,
        decimals: 2,
        baseStep: 0.1,
        shiftStep: 1,
        group: 'typography',
        style: 'lunnenDisplay'
    },
    lunnenDisplayTrackingSlider: {
        valueId: 'lunnenDisplayTrackingValue',
        setting: 'lunnenDisplayTracking',
        min: -0.1,
        max: 0.1,
        decimals: 3,
        baseStep: 0.001,
        shiftStep: 0.01,
        group: 'typography',
        style: 'lunnenDisplay'
    }
};

/**
 * Получить слайдеры по группе
 * @param {string} group - название группы (dimensions, grid, color, typography)
 * @returns {Object} - объект с конфигурациями слайдеров группы
 */
export function getSlidersByGroup(group) {
    return Object.entries(SLIDER_CONFIG)
        .filter(([, config]) => config.group === group)
        .reduce((acc, [key, config]) => {
            acc[key] = config;
            return acc;
        }, {});
}

/**
 * Получить слайдеры типографики по стилю
 * @param {string} style - название стиля (headline, text, caption, lunnenDisplay)
 * @returns {Object} - объект с конфигурациями слайдеров стиля
 */
export function getTypographySliders(style) {
    return Object.entries(SLIDER_CONFIG)
        .filter(([, config]) => config.group === 'typography' && config.style === style)
        .reduce((acc, [key, config]) => {
            acc[key] = config;
            return acc;
        }, {});
}
