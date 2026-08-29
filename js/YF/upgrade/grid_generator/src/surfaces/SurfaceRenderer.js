import { SurfaceGridPainter } from './SurfaceGridPainter.js';
import { SurfaceLayerFactory } from './SurfaceLayerFactory.js';

const DEFAULT_SIDE_SURFACES = Object.freeze(['left', 'right', 'top', 'bottom']);
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
        getLayerEntries = null,
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
        this.getLayerEntries = getLayerEntries || (() => [
            ...this.getTextBlocks().map(block => ({ type: 'text', block })),
            ...this.getGraphicsBlocks().map(block => ({ type: 'graphics', block }))
        ]);
        this.drawTextBlock = drawTextBlock;
        this.drawGraphicsBlock = drawGraphicsBlock;
        this.drawGraphicsBlockForExport = drawGraphicsBlockForExport;
        this.layerFactory = new SurfaceLayerFactory({ surfaceManager, createSvgElement });
        this.gridPainter = new SurfaceGridPainter({
            settings,
            getGridContext,
            createSvgElement,
            getContrastColor,
            getGridOpacity
        });
    }

    createLayer(container, surface, layout, suffix = 'display') {
        return this.layerFactory.create(container, surface, layout, suffix);
    }

    drawGrid(container, surface, geometry, scale) {
        this.gridPainter.draw(container, surface, geometry, scale);
    }

    drawObjects(container, surface, geometry, scale, forExport = false) {
        if (!this.settings.get('showObjects') && !forExport) return;

        const context = this.getGridContext(surface);
        this.getLayerEntries().forEach(({ type, block }) => {
            if ((block.surface || 'front') !== surface || block.visible === false || block.deleting) return;
            if (type === 'text') {
                this.drawTextBlock(
                    container,
                    block,
                    0,
                    0,
                    geometry.localWidth,
                    geometry.localHeight,
                    scale,
                    context
                );
                return;
            }
            if (block.svgContent) {
                const draw = forExport ? this.drawGraphicsBlockForExport : this.drawGraphicsBlock;
                draw(
                    container,
                    block,
                    0,
                    0,
                    geometry.localWidth,
                    geometry.localHeight,
                    scale,
                    context
                );
            }
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
