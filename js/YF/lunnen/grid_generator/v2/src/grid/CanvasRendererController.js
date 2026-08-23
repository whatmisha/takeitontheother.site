import { ColorUtils } from '../utils/ColorUtils.js';
import { DOMUtils } from '../utils/DOMUtils.js';
import { createBoxNet } from '../surfaces/PlaneDefinition.js';
import { computeNetLayout } from '../surfaces/NetLayoutEngine.js';

/** Owns the complete editor-canvas SVG composition. */
export class CanvasRendererController {
    constructor(host) {
        this.host = host;
    }

    /**
     * Fits the net's artboard into the display square.
     *
     * The artboard is the union of every plane, so nets that are not a simple
     * cross scale correctly without the renderer knowing their topology.
     */
    static calculateLayout({ frontWidth, frontHeight, thickness, displaySize, padding, net = null }) {
        const document = net
            || createBoxNet({ width: frontWidth, height: frontHeight, depth: thickness });
        const { bounds } = computeNetLayout(document);
        const maxDimension = Math.max(bounds.width, bounds.height, 1);
        const availableSize = Math.max(1, displaySize - 2 * padding);
        const scale = availableSize / maxDimension;
        const scaledTotalWidth = bounds.width * scale;
        const scaledTotalHeight = bounds.height * scale;

        return {
            x: (displaySize - scaledTotalWidth) / 2,
            y: (displaySize - scaledTotalHeight) / 2,
            frontWidth: frontWidth * scale,
            frontHeight: frontHeight * scale,
            thickness: thickness * scale,
            scale,
            svgSize: displaySize,
            totalWidth: scaledTotalWidth,
            totalHeight: scaledTotalHeight
        };
    }

    /** Artboard size in millimetres, shared by the editor and the export. */
    static calculateArtboard({ frontWidth, frontHeight, thickness, net = null }) {
        const document = net
            || createBoxNet({ width: frontWidth, height: frontHeight, depth: thickness });
        return computeNetLayout(document).bounds;
    }

    render() {
        const host = this.host;
        host.objectPlacementController.constrainAll();

        const zoomState = host.zoomPanManager ? {
            zoom: host.zoomPanManager.zoom,
            panX: host.zoomPanManager.panX,
            panY: host.zoomPanManager.panY
        } : null;
        const settings = host.settingsModule.getAll();
        const layout = CanvasRendererController.calculateLayout({
            frontWidth: settings.frontWidth,
            frontHeight: settings.frontHeight,
            thickness: settings.thickness,
            displaySize: host.DISPLAY_SIZE,
            padding: host.PADDING
        });
        const svg = host.dom.svg;

        svg.setAttribute('width', layout.svgSize);
        svg.setAttribute('height', layout.svgSize);
        host.zoomPanManager?.reinitializeSVGDimensions();
        svg.innerHTML = '';
        host.currentSurfaceLayout = layout;

        this.drawBoxSurfaces(
            svg,
            layout.x,
            layout.y,
            layout.frontWidth,
            layout.frontHeight,
            layout.thickness,
            layout.scale
        );
        if (host.settingsModule.get('showLabels')) {
            this.drawLabels(
                svg,
                layout.x,
                layout.y,
                layout.frontWidth,
                layout.frontHeight,
                layout.thickness,
                layout.scale
            );
        }

        host.surfaceRenderer.drawPlaneLayers(svg, layout, layout.scale);

        host.objectNavigatorController.bindCanvasHover();
        host.typographyUnitController.updateDisplays();
        host.objectNavigatorController.render();
        this.restoreZoom(zoomState);
        return layout;
    }

    /** The net's root plane, resolved for the current layout. */
    rootPlane(layout) {
        const net = this.host.surfaceManager.getNetLayout(layout);
        return net.planes[net.rootId];
    }

    drawFrontGrid(svg, frontX, frontY, layout, root = this.rootPlane(layout)) {
        const { settingsModule: settings, gridRenderer } = this.host;
        const { localWidth: width, localHeight: height } = root;
        if (settings.get('showColumns')) {
            gridRenderer.drawColumns(svg, frontX, frontY, width, height, layout.scale);
        }
        if (settings.get('showRows')) {
            gridRenderer.drawRows(svg, frontX, frontY, width, height, layout.scale);
        }
        if (settings.get('showBaseline')) {
            gridRenderer.drawBaseline(svg, frontX, frontY, width, height, layout.scale);
        }
    }

    drawFrontObjects(svg, frontX, frontY, layout, root = this.rootPlane(layout)) {
        const host = this.host;
        if (!host.settingsModule.get('showObjects')) return;

        const entries = host.objectDocument.getLayerEntries?.() || [
            ...(host.objectDocument.textBlocks || []).map(block => ({ type: 'text', block })),
            ...(host.objectDocument.graphicsBlocks || []).map(block => ({ type: 'graphics', block }))
        ];
        entries.forEach(({ type, block }) => {
            if (!this.isVisibleRootBlock(block)) return;
            const renderer = type === 'text' ? host.textRenderer : host.graphicsRenderer;
            renderer?.draw(
                svg,
                block,
                frontX,
                frontY,
                root.localWidth,
                root.localHeight,
                layout.scale
            );
        });
    }

    isVisibleRootBlock(block) {
        return this.host.resolveBlockPlane(block) === this.host.surfaceManager.getRootId() &&
            block.visible !== false &&
            !block.deleting;
    }

    restoreZoom(state) {
        const manager = this.host.zoomPanManager;
        if (!manager || !state) return;
        manager.zoom = state.zoom;
        manager.panX = state.panX;
        manager.panY = state.panY;
        manager.updateTransform();
    }

    createSvgElement(type, attrs, container) {
        return DOMUtils.createSVGElement(type, attrs, container);
    }

    /**
     * Planes that take part in the current composition, in document order.
     *
     * The root panel is always drawn; the rest follow their own visibility and
     * the global side-panel switch. Emission order doubles as hit-test priority.
     */
    visiblePlanes(layout) {
        const net = this.host.surfaceManager.getNetLayout(layout);
        const showSides = this.host.settingsModule.get('showSidePanels');
        return net.stackOrder
            .map(id => net.planes[id])
            .filter(plane => plane.id === net.rootId || (showSides && plane.visible));
    }

    drawBoxSurfaces(container, x, y, frontWidth, frontHeight, thickness, scale = 1) {
        const strokeWidth = scale === 1 ? '0.088194444' : '0.5';
        const boxColor = this.host.settingsModule.get('boxColor');

        for (const plane of this.visiblePlanes({ x, y, frontWidth, frontHeight, thickness, scale })) {
            this.createSvgElement('rect', {
                x: plane.rect.x,
                y: plane.rect.y,
                width: plane.rect.width,
                height: plane.rect.height,
                fill: boxColor,
                stroke: '#000000',
                'stroke-width': strokeWidth
            }, container);
        }
    }

    drawLabels(container, x, y, frontWidth, frontHeight, thickness, scale = 1) {
        const fontSize = scale === 1 ? '4' : null;

        for (const plane of this.visiblePlanes({ x, y, frontWidth, frontHeight, thickness, scale })) {
            this.createLabel(
                container,
                plane.rect.x + plane.rect.width / 2,
                plane.rect.y + plane.rect.height / 2,
                plane.name.toUpperCase(),
                plane.rect.height > plane.rect.width,
                fontSize
            );
        }
    }

    createLabel(container, x, y, text, rotate = false, fontSize = null) {
        const attrs = {
            x,
            y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle'
        };
        if (fontSize) {
            Object.assign(attrs, {
                'font-size': fontSize,
                'font-weight': '600',
                'font-family': 'Arial, sans-serif',
                fill: '#999999'
            });
        } else {
            attrs.class = 'grid-label';
        }
        if (rotate) attrs.transform = `rotate(-90 ${x} ${y})`;

        const element = this.createSvgElement('text', attrs, container);
        element.textContent = text;
        return element;
    }

    getContrastColor() {
        const background = this.host.settingsModule.get('boxColor');
        this.host.currentLuminance = ColorUtils.getLuminance(background);
        return ColorUtils.getContrastColor(background);
    }

    getGridOpacity(baseOpacity) {
        return baseOpacity;
    }
}
