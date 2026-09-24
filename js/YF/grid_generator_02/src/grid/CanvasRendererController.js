import { packagingNet, panelNames, activePanelIds } from '../packaging/PackagingModel.js';
import { ColorUtils } from '../framework/FrameworkAdapter.js?layout=root-infra-1';
import { DOMUtils } from '../utils/DOMUtils.js';

/** Owns the complete editor-canvas SVG composition. */
export class CanvasRendererController {
    constructor(host) {
        this.host = host;
    }

    static calculateLayout({ frontWidth, frontHeight, thickness, constructionType = 'lid', flapDepth = 20, displaySize, padding }) {
        const { width: totalWidth, height: totalHeight } = packagingNet({ frontWidth, frontHeight, thickness, constructionType, flapDepth });
        const maxDimension = Math.max(totalWidth, totalHeight, 1);
        const availableSize = Math.max(1, displaySize - 2 * padding);
        const scale = availableSize / maxDimension;
        const scaledTotalWidth = totalWidth * scale;
        const scaledTotalHeight = totalHeight * scale;

        return {
            x: (displaySize - scaledTotalWidth) / 2,
            y: (displaySize - scaledTotalHeight) / 2,
            frontWidth: frontWidth * scale,
            frontHeight: frontHeight * scale,
            thickness: thickness * scale,
            constructionType,
            flapDepth: flapDepth * scale,
            scale,
            svgSize: displaySize,
            totalWidth: scaledTotalWidth,
            totalHeight: scaledTotalHeight
        };
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
            constructionType: settings.constructionType,
            flapDepth: settings.flapDepth,
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

        const { x: frontX, y: frontY } = packagingNet(layout).panels.front;
        this.drawFrontGrid(svg, frontX, frontY, layout);
        host.surfaceRenderer.drawSideLayers(svg, layout, layout.scale);
        this.drawFrontObjects(svg, frontX, frontY, layout);

        host.objectNavigatorController.bindCanvasHover();
        host.typographyUnitController.updateDisplays();
        host.constructionController?.sync();
        host.objectNavigatorController.render();
        host.surfacePanelController?.sync();
        this.restoreZoom(zoomState);
        host.surfaceNetController?.draw();
        return layout;
    }

    drawFrontGrid(svg, frontX, frontY, layout) {
        const { settingsModule: settings, gridRenderer } = this.host;
        if (settings.get('showColumns')) {
            gridRenderer.drawColumns(
                svg, frontX, frontY, layout.frontWidth, layout.frontHeight, layout.scale
            );
        }
        if (settings.get('showRows')) {
            gridRenderer.drawRows(
                svg, frontX, frontY, layout.frontWidth, layout.frontHeight, layout.scale
            );
        }
        if (settings.get('showBaseline')) {
            gridRenderer.drawBaseline(
                svg, frontX, frontY, layout.frontWidth, layout.frontHeight, layout.scale
            );
        }
    }

    drawFrontObjects(svg, frontX, frontY, layout) {
        const host = this.host;
        if (!host.settingsModule.get('showObjects')) return;

        const entries = host.objectDocument.getLayerEntries?.() || [
            ...(host.objectDocument.textBlocks || []).map(block => ({ type: 'text', block })),
            ...(host.objectDocument.graphicsBlocks || []).map(block => ({ type: 'graphics', block }))
        ];
        entries.forEach(({ type, block }) => {
            if (!this.isVisibleFrontBlock(block)) return;
            if (type === 'text') {
                host.textRenderer.draw(
                    svg,
                    block,
                    frontX,
                    frontY,
                    layout.frontWidth,
                    layout.frontHeight,
                    layout.scale
                );
            } else {
                host.graphicsRenderer?.draw(
                    svg,
                    block,
                    frontX,
                    frontY,
                    layout.frontWidth,
                    layout.frontHeight,
                    layout.scale
                );
            }
        });
    }

    isVisibleFrontBlock(block) {
        return (block.surface || 'front') === 'front' &&
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

    drawBoxSurfaces(container, x, y, frontWidth, frontHeight, thickness, scale = 1) {
        const strokeWidth = scale === 1 ? '0.088194444' : '0.5';
        const boxColor = this.host.settingsModule.get('boxColor');
        const rect = attrs => this.createSvgElement('rect', {
            ...attrs,
            fill: boxColor,
            stroke: '#000000',
            'stroke-width': strokeWidth
        }, container);

        const layout = { constructionType: this.host.settingsModule.get('constructionType'), x, y, frontWidth, frontHeight, thickness,
            flapDepth: (this.host.settingsModule.get('flapDepth') ?? 20) * scale };
        const net = packagingNet(layout);
        for (const id of activePanelIds(layout)) {
            if (id === 'front' || (this.host.settingsModule.get('showSidePanels') && this.host.surfaceManager.isVisible(id))) rect({ ...net.panels[id], 'data-panel-outline': id });
        }
    }

    drawLabels(container, x, y, frontWidth, frontHeight, thickness, scale = 1) {
        const layout = { constructionType: this.host.settingsModule.get('constructionType'), x, y, frontWidth, frontHeight, thickness,
            flapDepth: (this.host.settingsModule.get('flapDepth') ?? 20) * scale };
        const net = packagingNet(layout);
        for (const id of activePanelIds(layout)) {
            if (!this.host.surfaceManager.isVisible(id)) continue;
            const rect = net.panels[id];
            this.createLabel(container, rect.x + rect.width / 2, rect.y + rect.height / 2,
                panelNames(layout)[id].toUpperCase(), id === 'left' || id === 'right', scale === 1 ? '4' : null);
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
                'font-family': 'sans-serif',
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
