import { MathUtils } from '../utils/MathUtils.js';

/**
 * Owns graphics-object geometry and SVG rendering for both the editor and export.
 * Editor state and pointer interactions stay in their dedicated controllers.
 */
export class GraphicsRenderer {
    constructor({
        settings,
        createSvgElement,
        getContrastColor,
        getBlockY,
        sanitizeSvgContent = content => content,
        attachInteractions = () => {}
    }) {
        this.settings = settings;
        this.createSvgElement = createSvgElement;
        this.getContrastColor = getContrastColor;
        this.getBlockY = getBlockY;
        this.sanitizeSvgContent = sanitizeSvgContent;
        this.attachInteractions = attachInteractions;
    }

    calculateDimensions(block) {
        const module = this.settings.get('gridModule');
        const aspectRatio = block.originalWidth / block.originalHeight;
        let widthInMm;
        let heightInMm;

        if (block.sizeMode === 'width') {
            const frontWidth = this.settings.get('frontWidth');
            const margins = this.settings.get('margins');
            const columnCount = this.settings.get('columnCount');
            const contentWidth = frontWidth - 2 * margins * module;
            const columnWidth = (contentWidth - (columnCount - 1) * module) / columnCount;
            widthInMm = block.widthInColumns * columnWidth
                + (block.widthInColumns - 1) * module;
            heightInMm = widthInMm / aspectRatio;
        } else {
            heightInMm = block.heightInModules * module;
            widthInMm = heightInMm * aspectRatio;
        }

        return {
            width: MathUtils.mmToPt(widthInMm),
            height: MathUtils.mmToPt(heightInMm)
        };
    }

    calculateLayout(block, frontX, frontY, frontWidth, scale) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const columnCount = this.settings.get('columnCount');
        const dimensions = this.calculateDimensions(block);
        const widthInMm = MathUtils.ptToMm(dimensions.width);
        const heightInMm = MathUtils.ptToMm(dimensions.height);
        const columnWidth = (
            frontWidth / scale
            - module * margins * 2
            - module * (columnCount - 1)
        ) / columnCount;
        const graphicsWidthInColumns = Math.ceil(widthInMm / (columnWidth + module));
        const columnX = frontX
            + module * margins * scale
            + (block.x - 1) * (columnWidth + module) * scale;

        let x = columnX;
        if ((block.alignment || 'left') === 'right') {
            const areaRightColumn = block.x + graphicsWidthInColumns - 1;
            const areaRightEdge = frontX
                + module * margins * scale
                + (areaRightColumn - 1) * (columnWidth + module) * scale
                + columnWidth * scale;
            x = areaRightEdge - widthInMm * scale;
        }

        return {
            x,
            y: frontY
                + this.getBlockY(block) * module * scale
                + module * margins * scale,
            width: widthInMm * scale,
            height: heightInMm * scale
        };
    }

    draw(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        if (!block.svgContent) return null;

        const color = this.getContrastColor();
        const layout = this.calculateLayout(block, frontX, frontY, frontWidth, scale);
        const group = this.createSvgElement('g', {
            id: `graphics-group-${block.id}`,
            style: 'cursor: move;',
            'data-block-id': block.id
        }, container);
        const bounds = this.createSvgElement('rect', {
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height,
            fill: color,
            'fill-opacity': '0',
            stroke: color,
            'stroke-width': scale === 1 ? '0.5' : '1',
            'stroke-opacity': '0',
            style: 'pointer-events: all; transition: opacity 0.2s;',
            'data-block-id': block.id
        }, group);
        group.boundsElement = bounds;

        const svg = this.createGraphicSvg(group, block, layout, color, true);
        svg.innerHTML = this.sanitizeSvgContent(block.svgContent);
        this.attachInteractions(group, block);
        return group;
    }

    drawForExport(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        if (!block.svgContent) return null;

        const color = this.getContrastColor();
        const layout = this.calculateLayout(block, frontX, frontY, frontWidth, scale);
        const svg = this.createGraphicSvg(container, block, layout, color, false);
        svg.innerHTML = this.sanitizeSvgContent(block.svgContent);
        this.applyContrastColor(svg, color);
        return svg;
    }

    createGraphicSvg(container, block, layout, color, disablePointerEvents) {
        return this.createSvgElement('svg', {
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height,
            viewBox: `0 0 ${block.originalWidth} ${block.originalHeight}`,
            preserveAspectRatio: 'xMinYMin meet',
            style: `color: ${color}; overflow: visible;${disablePointerEvents ? ' pointer-events: none;' : ''}`
        }, container);
    }

    applyContrastColor(svgElement, color) {
        svgElement.querySelectorAll('style').forEach(styleElement => {
            const value = this.replaceMonochromeColors(styleElement.textContent || '', color);
            styleElement.textContent = value;
        });

        svgElement.querySelectorAll('*').forEach(element => {
            for (const attribute of ['fill', 'stroke']) {
                const value = element.getAttribute(attribute);
                if (this.isMonochromeColor(value)) {
                    element.setAttribute(attribute, color);
                }
            }
        });
    }

    replaceMonochromeColors(value, color) {
        return value.replace(
            /(fill|stroke):\s*(?:#fff(?:fff)?|white|#000(?:000)?|black)/gi,
            `$1: ${color}`
        );
    }

    isMonochromeColor(value) {
        return /^(?:#fff(?:fff)?|white|#000(?:000)?|black)$/i.test(value?.trim() || '');
    }
}
