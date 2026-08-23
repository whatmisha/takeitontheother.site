import { SurfaceGridPainter } from './SurfaceGridPainter.js';
import { SurfaceLayerFactory } from './SurfaceLayerFactory.js';

/**
 * Renders per-plane grids and objects without owning editor state.
 */
export class SurfaceRenderer {
    constructor({
        settings,
        surfaceManager,
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

    drawGrid(container, surface, geometry, scale, { grouped = false } = {}) {
        this.gridPainter.draw(container, surface, geometry, scale, {
            createGroup: grouped
                ? name => this.createSvgElement('g', { id: `${surface}-${name}` }, container)
                : null
        });
    }

    /** Illustrator layer name for an exported object. */
    static objectGroupId(type, block) {
        if (type === 'text') return `text-${block.id}`;
        return block.isBuiltIn ? block.id : `graphics-${block.id}`;
    }

    drawObjects(container, surface, geometry, scale, forExport = false) {
        if (!this.settings.get('showObjects') && !forExport) return;

        const context = this.getGridContext(surface);
        const rootId = this.surfaceManager.getRootId();
        this.getLayerEntries().forEach(({ type, block }) => {
            const planeId = this.surfaceManager.has(block.planeId) ? block.planeId : rootId;
            if (planeId !== surface || block.visible === false || block.deleting) return;
            if (type !== 'text' && !block.svgContent) return;

            const target = forExport
                ? this.createSvgElement(
                    'g',
                    { id: SurfaceRenderer.objectGroupId(type, block) },
                    container
                )
                : container;
            const draw = type === 'text'
                ? this.drawTextBlock
                : (forExport ? this.drawGraphicsBlockForExport : this.drawGraphicsBlock);

            draw(
                target,
                block,
                0,
                0,
                geometry.localWidth,
                geometry.localHeight,
                scale,
                context
            );
        });
    }

    /**
     * Draws one clipped, transformed layer per plane of the net, including the
     * root: every plane carries its own grid and objects in its own local
     * coordinates, so nothing here depends on how many planes there are.
     */
    drawPlaneLayers(container, layout, scale, { forExport = false, skip = [] } = {}) {
        const net = this.surfaceManager.getNetLayout(layout);
        const skipped = new Set(skip);
        for (const id of net.stackOrder) {
            if (skipped.has(id)) continue;
            const plane = net.planes[id];
            if (!plane.visible) continue;
            const { layer, geometry } = this.createLayer(
                container,
                id,
                layout,
                forExport ? 'export' : 'display'
            );
            this.drawGrid(layer, id, geometry, scale, { grouped: forExport });
            this.drawObjects(layer, id, geometry, scale, forExport);
        }
    }
}
