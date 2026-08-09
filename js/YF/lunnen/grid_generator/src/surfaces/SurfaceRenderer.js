const DEFAULT_SIDE_SURFACES = Object.freeze(['left', 'right', 'top', 'bottom']);
const GRID_CONTEXT_KEYS = Object.freeze([
    'gridModule',
    'margins',
    'columnCount',
    'rowCount',
    'rowHeight',
    'frontWidth',
    'frontHeight'
]);

/**
 * Renders side-surface grids and objects without owning editor state.
 */
export class SurfaceRenderer {
    constructor({
        settings,
        surfaceManager,
        sideSurfaces = DEFAULT_SIDE_SURFACES,
        getGridContext,
        createSvgElement,
        getContrastColor,
        getGridOpacity,
        getTextBlocks = () => [],
        getGraphicsBlocks = () => [],
        drawTextBlock,
        drawGraphicsBlock,
        drawGraphicsBlockForExport
    }) {
        this.settings = settings;
        this.surfaceManager = surfaceManager;
        this.sideSurfaces = sideSurfaces;
        this.getGridContext = getGridContext;
        this.createSvgElement = createSvgElement;
        this.getContrastColor = getContrastColor;
        this.getGridOpacity = getGridOpacity;
        this.getTextBlocks = getTextBlocks;
        this.getGraphicsBlocks = getGraphicsBlocks;
        this.drawTextBlock = drawTextBlock;
        this.drawGraphicsBlock = drawGraphicsBlock;
        this.drawGraphicsBlockForExport = drawGraphicsBlockForExport;
    }

    withGridContext(surface, callback) {
        const context = this.getGridContext(surface);
        const previous = Object.fromEntries(
            GRID_CONTEXT_KEYS.map(key => [key, this.settings.get(key)])
        );
        try {
            GRID_CONTEXT_KEYS.forEach(key => this.settings.set(key, context[key], true));
            return callback(context);
        } finally {
            GRID_CONTEXT_KEYS.forEach(key => this.settings.set(key, previous[key], true));
        }
    }

    createLayer(container, surface, layout, suffix = 'display') {
        const geometry = this.surfaceManager.getGeometry(surface, layout);
        const clipId = `surface-clip-${suffix}-${surface}`;
        let defs = container.querySelector(':scope > defs[data-surface-defs]');
        if (!defs) {
            defs = this.createSvgElement('defs', { 'data-surface-defs': suffix }, container);
        }
        const clipPath = this.createSvgElement('clipPath', {
            id: clipId,
            clipPathUnits: 'userSpaceOnUse'
        }, defs);
        this.createSvgElement('rect', {
            x: 0,
            y: 0,
            width: geometry.localWidth,
            height: geometry.localHeight
        }, clipPath);

        const layer = this.createSvgElement('g', {
            id: `surface-${suffix}-${surface}`,
            transform: geometry.transform,
            'clip-path': `url(#${clipId})`,
            'data-surface': surface
        }, container);

        return { layer, geometry };
    }

    drawGrid(container, surface, geometry, scale) {
        const context = this.getGridContext(surface);
        const module = context.gridModule * scale;
        const margins = context.margins * module;
        const width = geometry.localWidth;
        const height = geometry.localHeight;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.08);
        const baselineOpacity = this.getGridOpacity(0.15);
        const strokeWidth = scale === 1 ? '0.088194444' : '1';
        const contentWidth = Math.max(0, width - 2 * margins);
        const contentHeight = Math.max(0, height - 2 * margins);

        if (this.settings.get('showColumns') && contentWidth > 0) {
            const gutter = module;
            const columnWidth = Math.max(
                0,
                (contentWidth - (context.columnCount - 1) * gutter) / context.columnCount
            );
            for (let index = 0; index < context.columnCount; index++) {
                const x = margins + index * (columnWidth + gutter);
                if (x >= width - margins + 1e-6) break;
                this.createSvgElement('rect', {
                    x,
                    y: margins,
                    width: Math.min(columnWidth, width - margins - x),
                    height: contentHeight,
                    fill: gridColor,
                    'fill-opacity': opacity,
                    stroke: 'none'
                }, container);
            }
        }

        if (this.settings.get('showRows') && contentHeight > 0) {
            const rowHeight = context.rowHeight * module;
            for (let index = 0; index < context.rowCount; index++) {
                const y = margins + index * (rowHeight + module);
                if (y + rowHeight > height - margins + 1e-6) break;
                this.createSvgElement('rect', {
                    x: margins,
                    y,
                    width: contentWidth,
                    height: rowHeight,
                    fill: gridColor,
                    'fill-opacity': opacity,
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
                    stroke: gridColor,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': baselineOpacity,
                    'vector-effect': 'non-scaling-stroke'
                }, container);
            }
        }
    }

    drawObjects(container, surface, geometry, scale, forExport = false) {
        if (!this.settings.get('showObjects') && !forExport) return;

        this.withGridContext(surface, () => {
            this.getTextBlocks().forEach(block => {
                if ((block.surface || 'front') !== surface || block.visible === false || block.deleting) return;
                this.drawTextBlock(
                    container,
                    block,
                    0,
                    0,
                    geometry.localWidth,
                    geometry.localHeight,
                    scale
                );
            });
            this.getGraphicsBlocks().forEach(block => {
                if ((block.surface || 'front') !== surface || block.visible === false || block.deleting || !block.svgContent) return;
                const draw = forExport ? this.drawGraphicsBlockForExport : this.drawGraphicsBlock;
                draw(
                    container,
                    block,
                    0,
                    0,
                    geometry.localWidth,
                    geometry.localHeight,
                    scale
                );
            });
        });
    }

    drawSideLayers(container, layout, scale, { forExport = false } = {}) {
        this.sideSurfaces.forEach(surface => {
            if (!this.surfaceManager.isVisible(surface)) return;
            const { layer, geometry } = this.createLayer(
                container,
                surface,
                layout,
                forExport ? 'export' : 'display'
            );
            this.drawGrid(layer, surface, geometry, scale);
            this.drawObjects(layer, surface, geometry, scale, forExport);
        });
    }
}
