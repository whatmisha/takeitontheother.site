const STYLE_SIZE_SETTINGS = Object.freeze({
    headline: 'headlineSize',
    text: 'textSize',
    caption: 'captionSize',
    lunnenDisplay: 'lunnenDisplaySize'
});

/** Prepares all surface-aware text and editor geometry before SVG creation. */
export class TextBlockRenderModel {
    constructor({ settings, getContrastColor, getStyleSettings, getFontMetrics, layout }) {
        this.settings = settings;
        this.getContrastColor = getContrastColor;
        this.getStyleSettings = getStyleSettings;
        this.getFontMetrics = getFontMetrics;
        this.layout = layout;
    }

    create(block, frontX, frontY, scale, explicitGridContext = null) {
        const color = this.getContrastColor();
        const gridContext = this.layout.getGridContext
            ? this.layout.getGridContext(block, explicitGridContext)
            : explicitGridContext;
        const module = gridContext?.gridModule ?? this.settings.get('gridModule');
        const margins = gridContext?.margins ?? this.settings.get('margins');
        const position = this.layout.calculateBlockPosition(block, scale, gridContext);
        const topMargin = module * margins * scale;
        const inputLines = String(block.content || '').split('\n');
        const base = { color, position, topMargin };
        if (inputLines.length === 1 && inputLines[0].trim() === '') {
            return {
                ...base,
                kind: 'placeholder',
                x: frontX + position.x,
                y: frontY + position.y + topMargin + 20 * scale
            };
        }

        const alignment = block.alignment || 'left';
        const styleRef = block.styleRef || 'text';
        const style = this.getStyleSettings(styleRef, module);
        const width = this.layout.calculateBlockWidth(block, gridContext) * scale;
        const lines = inputLines.flatMap(line => (
            this.layout.wrapText(line, width, style.fontSize, scale, style.tracking)
        ));
        const left = alignment === 'right'
            ? frontX + position.x - width
            : frontX + position.x;
        const alignmentMode = block.alignmentMode || 'baseline';
        const { capHeight, xHeight } = this.calculateGlyphMetrics(
            styleRef,
            style.useXHeight,
            scale,
            module
        );
        const firstLineY = this.calculateFirstLineY({
            frontY,
            positionY: position.y,
            topMargin,
            alignmentMode,
            capHeight,
            xHeight,
            scale,
            module
        });
        const lineHeight = module * style.lineHeight * scale;
        const placement = this.getHorizontalPlacement(block.textAlign || 'left', left, width);
        const baselines = this.calculateBaselines(lines.length, {
            firstLineY, lineHeight, frontY, scale, alignmentMode, gridContext
        });
        return {
            ...base,
            kind: 'text',
            style,
            anchor: placement.anchor,
            lines: lines.map((text, index) => ({ text, x: placement.x, y: baselines[index] })),
            editor: scale === 1 ? null : this.createEditorGeometry({
                frontX, position, alignment, width, firstLineY, capHeight, lineHeight,
                lineCount: lines.length
            })
        };
    }

    getStyleSizeInModules(styleRef = 'text') {
        return this.settings.get(STYLE_SIZE_SETTINGS[styleRef] || STYLE_SIZE_SETTINGS.text);
    }

    calculateGlyphMetrics(
        styleRef,
        useXHeight,
        scale,
        module = this.settings.get('gridModule')
    ) {
        const target = module * this.getStyleSizeInModules(styleRef) * scale;
        const metrics = this.getFontMetrics(styleRef);
        if (useXHeight) {
            return { xHeight: target, capHeight: target * (metrics.capHeight / metrics.xHeight) };
        }
        return { capHeight: target, xHeight: target * (metrics.xHeight / metrics.capHeight) };
    }

    calculateFirstLineY({
        frontY,
        positionY,
        topMargin,
        alignmentMode,
        capHeight,
        xHeight,
        scale,
        module = this.settings.get('gridModule')
    }) {
        const origin = frontY + positionY + topMargin;
        if (alignmentMode === 'x-height') return origin + xHeight;
        if (alignmentMode === 'cap-height') return origin + capHeight;
        return origin + module * scale;
    }

    getHorizontalPlacement(textAlign, left, width) {
        if (textAlign === 'center') return { anchor: 'middle', x: left + width / 2 };
        if (textAlign === 'right') return { anchor: 'end', x: left + width };
        return { anchor: 'start', x: left };
    }

    calculateBaselines(lineCount, {
        firstLineY,
        lineHeight,
        frontY,
        scale,
        alignmentMode,
        gridContext = null
    }) {
        const baselines = [];
        for (let index = 0; index < lineCount; index += 1) {
            if (index === 0) {
                baselines.push(this.layout.snapToBaseline(
                    firstLineY,
                    frontY,
                    scale,
                    true,
                    alignmentMode,
                    gridContext
                ));
            } else if (alignmentMode === 'x-height' || alignmentMode === 'cap-height') {
                baselines.push(baselines[index - 1] + lineHeight);
            } else {
                baselines.push(this.layout.snapToBaseline(
                    baselines[index - 1] + lineHeight,
                    frontY,
                    scale,
                    false,
                    'baseline',
                    gridContext
                ));
            }
        }
        return baselines;
    }

    createEditorGeometry({ frontX, position, alignment, width, firstLineY, capHeight, lineHeight, lineCount }) {
        const x = alignment === 'right' ? frontX + position.x - width : frontX + position.x;
        const y = firstLineY - capHeight;
        const height = capHeight + lineHeight * (lineCount - 1) + capHeight * 0.25;
        return {
            x,
            y,
            width,
            height,
            handleX: alignment === 'right' ? x - 2 : frontX + position.x + width - 2
        };
    }
}
