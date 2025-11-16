/**
 * Константы приложения
 */

// Метрики шрифта TT Commons Classic
export const FONT_METRICS = {
    TT_COMMONS_CLASSIC: {
        capHeight: 630,
        xHeight: 447,
        unitsPerEm: 1000
    }
};

// Стандартные цвета
export const COLORS = {
    LUNNEN_BLUE: '#dadde6'
};

// Настройки отображения
export const DISPLAY = {
    PADDING: 60, // Отступ вокруг сетки (для размеров)
    MIN_CANVAS_SIZE: 400 // Минимальный размер канваса
};

// SVG константы
export const SVG = {
    // Толщина линии для экспорта в мм (0.25pt = 0.088194444 mm)
    EXPORT_STROKE_WIDTH: '0.088194444',
    // Толщина линии для отображения (в пикселях экрана с vector-effect="non-scaling-stroke")
    DISPLAY_STROKE_WIDTH: '1'
};

// Диапазоны значений для контролов
export const RANGES = {
    MODULE: { min: 0.5, max: 20, step: 0.0001 },
    MARGINS: { min: 0, max: 10, step: 0.01 },
    COLUMNS: { min: 1, max: 24, step: 1 },
    ROWS: { min: 1, max: 50, step: 1 },
    ROW_HEIGHT: { min: 1, max: 20, step: 1 },
    WIDTH: { min: 10, max: 1000, step: 0.5 },
    HEIGHT: { min: 10, max: 1000, step: 0.5 },
    HEADLINE_SIZE: { min: 0.25, max: 10, step: 0.25 },
    LINE_HEIGHT: { min: 0.25, max: 10, step: 0.25 },
    TRACKING: { min: -0.05, max: 0.05, step: 0.005 },
    TEXT_SIZE: { min: 0.25, max: 10, step: 0.25 },
    TEXT_LINE_HEIGHT: { min: 0.25, max: 10, step: 0.25 },
    TEXT_TRACKING: { min: -0.05, max: 0.05, step: 0.01 }
};

// Значения по умолчанию (взяты из пресета "+New")
export const DEFAULTS = {
    FRONT_WIDTH: 120,      // mm
    FRONT_HEIGHT: 25,      // mm
    BOX_COLOR: '#ffffff',  // Белый фон
    GRID_MODULE: 0.7037,   // mm
    MARGINS: 4.2632,       // в модулях (≈3 мм)
    MARGINS_UNIT: 'mm',    // 'mod' или 'mm'
    COLUMN_COUNT: 3,
    ROW_COUNT: 4,
    ROW_HEIGHT: 6,         // в модулях
    LINK_MODE: 'module',   // 'off', 'rows-height', или 'module'
    
    // Стили текста
    HEADLINE_SIZE: 1.5,         // в модулях
    LINE_HEIGHT: 2.0,           // в модулях
    TRACKING: -0.015,           // в em
    USE_X_HEIGHT: false,        // false = cap height, true = x-height
    HEADLINE_FONT_WEIGHT: 500,  // 400 = Regular, 500 = Medium
    
    TEXT_SIZE: 0.5,             // в модулях
    TEXT_LINE_HEIGHT: 1.0,      // в модулях
    TEXT_TRACKING: 0,           // в em
    USE_X_HEIGHT_2: false,      // false = cap height, true = x-height
    TEXT_FONT_WEIGHT: 500,      // 400 = Regular, 500 = Medium
    
    // Видимость элементов
    SHOW_DIMENSIONS: false,
    SHOW_LABELS: false,
    SHOW_COLUMNS: true,
    SHOW_ROWS: true,
    SHOW_BASELINE: true,
    SHOW_OBJECTS: true
};

// Конфигурация слайдеров (базовые и shift-шаги)
export const SLIDER_STEPS = {
    frontWidthSlider: { base: 0.5, shift: 10 },
    frontHeightSlider: { base: 0.5, shift: 10 },
    gridModuleSlider: { base: 0.0001, shift: 0.1 },
    columnCountSlider: { base: 1, shift: 10 },
    rowCountSlider: { base: 1, shift: 10 },
    rowHeightSlider: { base: 1, shift: 10 },
    hueSlider: { base: 1, shift: 10 },
    saturationSlider: { base: 1, shift: 10 },
    brightnessSlider: { base: 1, shift: 10 },
    headlineSizeSlider: { base: 0.25, shift: 1 },
    lineHeightSlider: { base: 0.25, shift: 1 },
    trackingSlider: { base: 0.005, shift: 0.05 },
    textSizeSlider: { base: 0.25, shift: 1 },
    textLineHeightSlider: { base: 0.25, shift: 1 },
    textTrackingSlider: { base: 0.01, shift: 0.05 }
};

// Режимы связывания
export const LINK_MODES = {
    OFF: 'off',
    ROWS_HEIGHT: 'rows-height',
    MODULE: 'module'
};

// Типы элементов
export const ELEMENT_TYPES = {
    TEXT: 'text',
    GRAPHICS: 'graphics',
    ICONS: 'icons',
    CLAIM: 'claim'
};

// Клавиатурные сокращения
export const KEYBOARD_SHORTCUTS = {
    EXPORT: 'e',
    EXPORT_SETTINGS: 's',
    HELP: 'h',
    ESCAPE: 'Escape',
    ENTER: 'Enter',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown'
};

