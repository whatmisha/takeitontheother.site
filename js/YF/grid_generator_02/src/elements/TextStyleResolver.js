export const DEFAULT_FONT_METRICS = Object.freeze({
    'TT Commons Classic': Object.freeze({
        capHeight: 630,
        xHeight: 447,
        unitsPerEm: 1000
    }),
    'Lunnen Display': Object.freeze({
        capHeight: 630,
        xHeight: 447,
        unitsPerEm: 1000
    })
});

const STYLE_CONFIG = Object.freeze({
    headline: Object.freeze({
        size: 'headlineSize',
        lineHeight: 'lineHeight',
        tracking: 'tracking',
        useXHeight: 'useXHeight',
        fontWeight: 'headlineFontWeight',
        fontFamily: 'TT Commons Classic'
    }),
    text: Object.freeze({
        size: 'textSize',
        lineHeight: 'textLineHeight',
        tracking: 'textTracking',
        useXHeight: 'useXHeight2',
        fontWeight: 'textFontWeight',
        fontFamily: 'TT Commons Classic'
    }),
    caption: Object.freeze({
        size: 'captionSize',
        lineHeight: 'captionLineHeight',
        tracking: 'captionTracking',
        useXHeight: 'useXHeightCaption',
        fontWeight: 'captionFontWeight',
        fontFamily: 'TT Commons Classic'
    }),
    lunnenDisplay: Object.freeze({
        size: 'lunnenDisplaySize',
        lineHeight: 'lunnenDisplayLineHeight',
        tracking: 'lunnenDisplayTracking',
        useXHeight: 'useXHeightLunnenDisplay',
        fontFamily: 'Lunnen Display'
    })
});

export class TextStyleResolver {
    constructor(settings, fontMetrics = DEFAULT_FONT_METRICS) {
        this.settings = settings;
        this.fontMetrics = fontMetrics;
    }

    getConfig(styleRef = 'text') {
        return STYLE_CONFIG[styleRef] || STYLE_CONFIG.text;
    }

    getCustomStyle(styleRef) {
        return (this.settings.get('customTextStyles') || []).find(style => style.id === styleRef);
    }

    getDefinition(styleRef = 'text') {
        const custom = this.getCustomStyle(styleRef);
        if (custom) return { ...custom };
        const config = this.getConfig(styleRef);
        return {
            size: this.settings.get(config.size),
            lineHeight: this.settings.get(config.lineHeight),
            tracking: this.settings.get(config.tracking),
            useXHeight: styleRef === 'lunnenDisplay' ? false : Boolean(this.settings.get(config.useXHeight)),
            fontWeight: config.fontWeight ? this.settings.get(config.fontWeight) : 400,
            fontFamily: config.fontFamily
        };
    }

    getFontFamily(styleRef = 'text') {
        return this.getDefinition(styleRef).fontFamily;
    }

    getFontMetrics(styleRef = 'text') {
        return this.fontMetrics[this.getFontFamily(styleRef)] || this.fontMetrics['TT Commons Classic'];
    }

    calculateFontSize(styleRef = 'text', sizeInModules = null, gridModule = null) {
        const style = this.getDefinition(styleRef);
        const metrics = this.getFontMetrics(styleRef);
        const targetSize = (gridModule ?? this.settings.get('gridModule')) * (sizeInModules ?? style.size);
        return targetSize * metrics.unitsPerEm / (style.useXHeight ? metrics.xHeight : metrics.capHeight);
    }

    fontSizeMmToModules(fontSizeMm, styleRef = 'text') {
        const module = this.settings.get('gridModule');
        if (!STYLE_CONFIG[styleRef] && !this.getCustomStyle(styleRef)) {
            return module > 0 ? fontSizeMm / module : 0;
        }
        const style = this.getDefinition(styleRef);
        const metrics = this.getFontMetrics(styleRef);
        const target = fontSizeMm * (style.useXHeight ? metrics.xHeight : metrics.capHeight) / metrics.unitsPerEm;
        return module > 0 ? target / module : 0;
    }

    getStyleSettings(styleRef = 'text', gridModule = null) {
        const { lineHeight, tracking, useXHeight, fontWeight, fontFamily } = this.getDefinition(styleRef);
        return {
            fontSize: this.calculateFontSize(styleRef, null, gridModule),
            lineHeight, tracking, useXHeight, fontWeight, fontFamily
        };
    }
}
