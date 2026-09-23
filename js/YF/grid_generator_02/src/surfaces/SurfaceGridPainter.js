export class SurfaceGridPainter {
    constructor({ settings, getGridContext, createSvgElement, getContrastColor, getGridOpacity }) {
        this.settings = settings;
        this.getGridContext = getGridContext;
        this.createSvgElement = createSvgElement;
        this.getContrastColor = getContrastColor;
        this.getGridOpacity = getGridOpacity;
    }

    draw(container, surface, geometry, scale) {
        const context = this.getGridContext(surface);
        const module = context.gridModule * scale;
        const margins = context.margins * module;
        const { localWidth: width, localHeight: height } = geometry;
        const color = this.getContrastColor();
        const contentWidth = Math.max(0, width - 2 * margins);
        const contentHeight = Math.max(0, height - 2 * margins);

        if (this.settings.get('showColumns') && contentWidth > 0) {
            const columnWidth = Math.max(0, (contentWidth - (context.columnCount - 1) * module) / context.columnCount);
            for (let index = 0; index < context.columnCount; index += 1) {
                const x = margins + index * (columnWidth + module);
                if (x >= width - margins + 1e-6) break;
                this.createSvgElement('rect', {
                    x,
                    y: margins,
                    width: Math.min(columnWidth, width - margins - x),
                    height: contentHeight,
                    fill: color,
                    'fill-opacity': this.getGridOpacity(0.08),
                    stroke: 'none'
                }, container);
            }
        }

        if (this.settings.get('showRows') && contentHeight > 0) {
            const rowHeight = context.rowHeight * module;
            for (let index = 0; index < context.rowCount; index += 1) {
                const y = margins + index * (rowHeight + module);
                if (y + rowHeight > height - margins + 1e-6) break;
                this.createSvgElement('rect', {
                    x: margins,
                    y,
                    width: contentWidth,
                    height: rowHeight,
                    fill: color,
                    'fill-opacity': this.getGridOpacity(0.08),
                    stroke: 'none'
                }, container);
            }
        }

        if (this.settings.get('showBaseline') && contentHeight > 0) {
            for (let y = margins; y + module <= height - margins + 1e-6; y += module) {
                this.createSvgElement('rect', {
                    x: margins,
                    y,
                    width: contentWidth,
                    height: module,
                    fill: 'none',
                    stroke: color,
                    'stroke-width': scale === 1 ? '0.088194444' : '1',
                    'stroke-opacity': this.getGridOpacity(0.15),
                    'vector-effect': 'non-scaling-stroke'
                }, container);
            }
        }
    }
}
