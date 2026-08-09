const STYLE_SIZE_SETTINGS = Object.freeze({
    headline: 'headlineSize',
    text: 'textSize',
    caption: 'captionSize',
    lunnenDisplay: 'lunnenDisplaySize'
});

/**
 * Owns SVG rendering and vertical layout for text blocks.
 * Text editing and pointer state remain in their dedicated controllers.
 */
export class TextBlockRenderer {
    constructor({
        settings,
        createSvgElement,
        getContrastColor,
        getStyleSettings,
        getFontMetrics,
        layout,
        attachInteractions = () => {},
        attachResize = () => {},
        isDragging = () => false
    }) {
        this.settings = settings;
        this.createSvgElement = createSvgElement;
        this.getContrastColor = getContrastColor;
        this.getStyleSettings = getStyleSettings;
        this.getFontMetrics = getFontMetrics;
        this.layout = layout;
        this.attachInteractions = attachInteractions;
        this.attachResize = attachResize;
        this.isDragging = isDragging;
    }

    getStyleSizeInModules(styleRef = 'text') {
        return this.settings.get(STYLE_SIZE_SETTINGS[styleRef] || STYLE_SIZE_SETTINGS.text);
    }

    calculateGlyphMetrics(styleRef, useXHeight, scale) {
        const module = this.settings.get('gridModule');
        const size = this.getStyleSizeInModules(styleRef);
        const metrics = this.getFontMetrics(styleRef);

        if (useXHeight) {
            const xHeight = module * size * scale;
            return {
                xHeight,
                capHeight: xHeight * (metrics.capHeight / metrics.xHeight)
            };
        }

        const capHeight = module * size * scale;
        return {
            capHeight,
            xHeight: capHeight * (metrics.xHeight / metrics.capHeight)
        };
    }

    calculateFirstLineY({
        frontY,
        positionY,
        topMargin,
        alignmentMode,
        capHeight,
        xHeight,
        scale
    }) {
        const origin = frontY + positionY + topMargin;
        if (alignmentMode === 'x-height') return origin + xHeight;
        if (alignmentMode === 'cap-height') return origin + capHeight;
        return origin + this.settings.get('gridModule') * scale;
    }

    draw(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        const color = this.getContrastColor();
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const alignment = block.alignment || 'left';
        const styleRef = block.styleRef || 'text';
        const style = this.getStyleSettings(styleRef);
        const position = this.layout.calculateBlockPosition(block, scale);
        const topMargin = module * margins * scale;
        const inputLines = block.content.split('\n');

        if (inputLines.length === 0 || (inputLines.length === 1 && inputLines[0].trim() === '')) {
            return this.drawPlaceholder(container, block, frontX, frontY, position, topMargin, color, scale);
        }

        const textBlockWidth = this.layout.calculateBlockWidth(block);
        const scaledTextWidth = textBlockWidth * scale;
        const wrappedLines = inputLines.flatMap(line => (
            this.layout.wrapText(line, scaledTextWidth, style.fontSize, scale, style.tracking)
        ));
        const blockLeftX = alignment === 'right'
            ? frontX + position.x - scaledTextWidth
            : frontX + position.x;
        const alignmentMode = block.alignmentMode || 'baseline';
        const { capHeight, xHeight } = this.calculateGlyphMetrics(
            styleRef,
            style.useXHeight,
            scale
        );
        const firstLineY = this.calculateFirstLineY({
            frontY,
            positionY: position.y,
            topMargin,
            alignmentMode,
            capHeight,
            xHeight,
            scale
        });
        const lineHeight = module * style.lineHeight * scale;
        const textGroup = this.createSvgElement('g', {
            id: `text-group-${block.id}`,
            style: 'cursor: move;',
            'data-block-id': block.id
        }, container);
        const { anchor, x } = this.getHorizontalPlacement(
            block.textAlign || 'left',
            blockLeftX,
            scaledTextWidth
        );
        const textAttrs = this.createTextAttributes(block, style, anchor, color, scale);

        this.drawLines({
            textGroup,
            lines: wrappedLines,
            textAttrs,
            x,
            firstLineY,
            lineHeight,
            frontY,
            scale,
            alignmentMode
        });

        if (scale !== 1) {
            this.drawEditorControls({
                container,
                textGroup,
                block,
                frontX,
                position,
                alignment,
                scaledTextWidth,
                firstLineY,
                capHeight,
                lineHeight,
                lineCount: wrappedLines.length,
                color
            });
        }

        return textGroup;
    }

    drawPlaceholder(container, block, frontX, frontY, position, topMargin, color, scale) {
        const group = this.createSvgElement('g', {
            id: `text-group-${block.id}`,
            style: 'cursor: move;',
            'data-block-id': block.id
        }, container);
        const placeholder = this.createSvgElement('text', {
            x: frontX + position.x,
            y: frontY + position.y + topMargin + 20 * scale,
            'font-family': 'TT Commons Classic, -apple-system, BlinkMacSystemFont, sans-serif',
            'font-size': `${14 * scale}`,
            fill: color,
            'fill-opacity': '0.3',
            style: 'cursor: move;'
        }, group);
        placeholder.textContent = 'Click to add text';
        this.attachInteractions(group, block);
        return group;
    }

    getHorizontalPlacement(textAlign, blockLeftX, width) {
        if (textAlign === 'center') {
            return { anchor: 'middle', x: blockLeftX + width / 2 };
        }
        if (textAlign === 'right') {
            return { anchor: 'end', x: blockLeftX + width };
        }
        return { anchor: 'start', x: blockLeftX };
    }

    createTextAttributes(block, style, anchor, color, scale) {
        const attributes = {
            'font-family': `${style.fontFamily}, -apple-system, BlinkMacSystemFont, sans-serif`,
            'font-weight': (
                block.styleRef === 'lunnenDisplay' && block.fontWeight
                    ? block.fontWeight
                    : style.fontWeight
            ).toString(),
            'font-size': `${style.fontSize * scale}`,
            'text-anchor': anchor,
            fill: color,
            'fill-opacity': '1',
            'letter-spacing': `${style.tracking}em`
        };

        if (block.styleRef !== 'lunnenDisplay') return attributes;

        const inlineStyles = [];
        if (block.fontWeight) {
            const weight = `'wght' ${block.fontWeight}`;
            attributes['font-variation-settings'] = weight;
            inlineStyles.push(`font-variation-settings: ${weight}`);
        }

        const supportedFeatures = ['salt', 'aalt', 'ss01', 'ss02', 'tnum', 'dlig'];
        const features = supportedFeatures
            .filter(feature => block.fontFeatures?.[feature])
            .map(feature => `'${feature}' 1`);
        if (features.length > 0) {
            const value = features.join(', ');
            attributes['font-feature-settings'] = value;
            inlineStyles.push(`font-feature-settings: ${value}`);
        }
        if (inlineStyles.length > 0) {
            attributes.style = `${inlineStyles.join('; ')};`;
        }

        return attributes;
    }

    drawLines({
        textGroup,
        lines,
        textAttrs,
        x,
        firstLineY,
        lineHeight,
        frontY,
        scale,
        alignmentMode
    }) {
        let previousBaselineY = null;
        lines.forEach((line, index) => {
            let y;
            if (index === 0) {
                y = this.layout.snapToBaseline(firstLineY, frontY, scale, true, alignmentMode);
            } else if (alignmentMode === 'x-height' || alignmentMode === 'cap-height') {
                y = previousBaselineY + lineHeight;
            } else {
                y = this.layout.snapToBaseline(previousBaselineY + lineHeight, frontY, scale, false);
            }
            previousBaselineY = y;

            const element = this.createSvgElement('text', {
                ...textAttrs,
                x,
                y
            }, textGroup);
            element.textContent = line;
        });
    }

    drawEditorControls({
        container,
        textGroup,
        block,
        frontX,
        position,
        alignment,
        scaledTextWidth,
        firstLineY,
        capHeight,
        lineHeight,
        lineCount,
        color
    }) {
        const boundsX = alignment === 'right'
            ? frontX + position.x - scaledTextWidth
            : frontX + position.x;
        const firstLineTop = firstLineY - capHeight;
        const totalHeight = capHeight + lineHeight * (lineCount - 1) + capHeight * 0.25;
        const hoverArea = this.createSvgElement('rect', {
            id: `hover-area-${block.id}`,
            x: boundsX,
            y: firstLineTop,
            width: scaledTextWidth,
            height: totalHeight,
            fill: 'transparent',
            'fill-opacity': '0',
            stroke: 'none',
            style: 'pointer-events: all; cursor: move;',
            'data-block-id': block.id
        }, container);
        const bounds = this.createSvgElement('rect', {
            id: `bounds-${block.id}`,
            x: boundsX,
            y: firstLineTop,
            width: scaledTextWidth,
            height: totalHeight,
            fill: 'rgba(255, 255, 255, 0.05)',
            stroke: color,
            'stroke-width': '1',
            'stroke-opacity': '0',
            'fill-opacity': '0',
            style: 'pointer-events: none; transition: opacity 0.2s;',
            'data-block-id': block.id
        }, container);
        const handleWidth = 4;
        const handle = this.createSvgElement('rect', {
            id: `resize-handle-${block.id}`,
            x: alignment === 'right'
                ? boundsX - handleWidth / 2
                : frontX + position.x + scaledTextWidth - handleWidth / 2,
            y: firstLineTop,
            width: handleWidth,
            height: totalHeight,
            fill: color,
            'fill-opacity': '0',
            stroke: 'none',
            style: 'cursor: ew-resize; pointer-events: all; transition: opacity 0.2s;',
            'data-block-id': block.id,
            'vector-effect': 'non-scaling-size'
        }, container);

        textGroup.boundsElement = bounds;
        textGroup.hoverArea = hoverArea;
        textGroup.resizeHandle = handle;
        this.attachInteractions(hoverArea, block);
        this.attachResize(handle, block);

        hoverArea.addEventListener('mouseenter', () => {
            if (!this.isDragging()) {
                bounds.setAttribute('stroke-opacity', '0.5');
                bounds.setAttribute('fill-opacity', '0.05');
            }
            handle.setAttribute('fill-opacity', '0.2');
        });
        hoverArea.addEventListener('mouseleave', () => {
            if (!this.isDragging()) {
                bounds.setAttribute('stroke-opacity', '0');
                bounds.setAttribute('fill-opacity', '0');
            }
            handle.setAttribute('fill-opacity', '0');
        });
    }
}
