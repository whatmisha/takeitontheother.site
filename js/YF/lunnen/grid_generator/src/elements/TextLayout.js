/**
 * Surface-aware text geometry and line wrapping.
 * The module has no editor state and lazily creates its measurement canvas.
 */
export class TextLayout {
    constructor({
        settings,
        getSurfaceGridContext,
        getBlockY,
        createMeasurementContext = () => document.createElement('canvas').getContext('2d')
    }) {
        this.settings = settings;
        this.getSurfaceGridContext = getSurfaceGridContext;
        this.getBlockY = getBlockY;
        this.createMeasurementContext = createMeasurementContext;
        this.measurementContext = null;
    }

    calculateBlockWidth(block) {
        const context = this.getSurfaceGridContext(block.surface || 'front');
        const columnWidth = this.calculateColumnWidth(context);
        return columnWidth * block.width + context.gridModule * (block.width - 1);
    }

    calculateBlockPosition(block, scale = 1) {
        const context = this.getSurfaceGridContext(block.surface || 'front');
        const module = context.gridModule;
        const columnWidth = this.calculateColumnWidth(context);
        const columnLeft = module * context.margins * scale
            + (block.x - 1) * (columnWidth + module) * scale;
        const x = (block.alignment || 'left') === 'right'
            ? columnLeft + columnWidth * scale
            : columnLeft;
        const y = this.getBlockY(block) * module * scale;
        return { x, y };
    }

    calculateColumnWidth(context) {
        return (
            context.frontWidth
            - context.gridModule * context.margins * 2
            - context.gridModule * (context.columnCount - 1)
        ) / context.columnCount;
    }

    snapToBaseline(y, frontY, scale, isFirstLine = false, alignmentMode = 'baseline') {
        if (isFirstLine && (alignmentMode === 'x-height' || alignmentMode === 'cap-height')) {
            return y;
        }

        const module = this.settings.get('gridModule');
        const topMargin = module * this.settings.get('margins') * scale;
        const relativeY = y - (frontY + topMargin);
        const step = isFirstLine ? module * scale : module * scale / 4;
        const snappedY = Math.round(relativeY / step) * step;
        return frontY + topMargin + snappedY;
    }

    measureTextWidth(text, fontSize, scale, tracking = 0) {
        if (!this.measurementContext) {
            this.measurementContext = this.createMeasurementContext();
        }

        const scaledFontSize = fontSize * scale;
        this.measurementContext.font = (
            `500 ${scaledFontSize}px 'TT Commons Classic', `
            + '-apple-system, BlinkMacSystemFont, sans-serif'
        );
        let width = this.measurementContext.measureText(text).width;
        if (text.length > 1) {
            width += tracking * scaledFontSize * (text.length - 1);
        }
        return width;
    }

    wrapText(text, maxWidth, fontSize, scale, tracking = 0) {
        const lines = [];

        text.split('\n').forEach(forcedLine => {
            const parts = this.tokenizeLine(forcedLine);
            let currentLine = '';

            parts.forEach(part => {
                if (part === ' ') {
                    if (!currentLine) return;
                    const candidate = `${currentLine} `;
                    if (this.measureTextWidth(candidate, fontSize, scale, tracking) > maxWidth) {
                        lines.push(currentLine);
                        currentLine = '';
                    } else {
                        currentLine = candidate;
                    }
                    return;
                }

                const candidate = currentLine ? `${currentLine}${part}` : part;
                if (
                    this.measureTextWidth(candidate, fontSize, scale, tracking) > maxWidth
                    && currentLine
                ) {
                    lines.push(currentLine);
                    currentLine = part;
                } else {
                    currentLine = candidate;
                }
            });

            if (currentLine) lines.push(currentLine);
        });

        return lines;
    }

    tokenizeLine(line) {
        const parts = [];
        let currentPart = '';

        for (const character of line) {
            if (character === '\u00A0') {
                currentPart += character;
            } else if (character === ' ' || character === '\t') {
                if (currentPart) {
                    parts.push(currentPart);
                    currentPart = '';
                }
                parts.push(' ');
            } else {
                currentPart += character;
            }
        }
        if (currentPart) parts.push(currentPart);
        return parts;
    }
}
