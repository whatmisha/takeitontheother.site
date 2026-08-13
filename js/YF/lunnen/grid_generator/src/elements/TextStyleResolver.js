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

    getFontFamily(styleRef = 'text') {
        return this.getConfig(styleRef).fontFamily;
    }

    getFontMetrics(styleRef = 'text') {
        const family = this.getFontFamily(styleRef);
        return this.fontMetrics[family] || this.fontMetrics['TT Commons Classic'];
    }

    calculateFontSize(styleRef = 'text', sizeInModules = null, gridModule = null) {
        const config = this.getConfig(styleRef);
        const metrics = this.getFontMetrics(styleRef);
        const size = sizeInModules ?? this.settings.get(config.size);
        const targetSize = (gridModule ?? this.settings.get('gridModule')) * size;
        const metric = this.settings.get(config.useXHeight)
            ? metrics.xHeight
            : metrics.capHeight;
        return targetSize * (metrics.unitsPerEm / metric);
    }

    fontSizeMmToModules(fontSizeMm, styleRef = 'text') {
        if (!STYLE_CONFIG[styleRef]) {
            const module = this.settings.get('gridModule');
            return module > 0 ? fontSizeMm / module : 0;
        }
        const config = this.getConfig(styleRef);
        const metrics = this.getFontMetrics(styleRef);
        const metric = this.settings.get(config.useXHeight)
            ? metrics.xHeight
            : metrics.capHeight;
        const targetSize = fontSizeMm * (metric / metrics.unitsPerEm);
        const module = this.settings.get('gridModule');
        return module > 0 ? targetSize / module : 0;
    }

    getStyleSettings(styleRef = 'text', gridModule = null) {
        const normalizedStyle = STYLE_CONFIG[styleRef] ? styleRef : 'text';
        const config = this.getConfig(normalizedStyle);
        const isDisplay = normalizedStyle === 'lunnenDisplay';
        return {
            fontSize: this.calculateFontSize(normalizedStyle, null, gridModule),
            lineHeight: this.settings.get(config.lineHeight),
            tracking: this.settings.get(config.tracking),
            useXHeight: isDisplay ? false : Boolean(this.settings.get(config.useXHeight)),
            fontWeight: isDisplay ? 400 : this.settings.get(config.fontWeight),
            fontFamily: config.fontFamily
        };
    }
}
