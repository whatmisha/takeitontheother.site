import { ColorUtils } from '../utils/ColorUtils.js';
import { DOMUtils } from '../utils/DOMUtils.js';

/** Owns the complete editor-canvas SVG composition. */
export class CanvasRendererController {
    constructor(host) {
        this.host = host;
    }

    static calculateLayout({ frontWidth, frontHeight, thickness, displaySize, padding }) {
        const totalWidth = frontWidth + 2 * thickness;
        const totalHeight = frontHeight + 2 * thickness;
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
            scale,
            svgSize: displaySize,
            totalWidth: scaledTotalWidth,
            totalHeight: scaledTotalHeight
        };
    }

    render() {
        const host = this.host;
        host.constrainElementsToBounds();

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

        const frontX = layout.x + layout.thickness;
        const frontY = layout.y + layout.thickness;
        this.drawFrontGrid(svg, frontX, frontY, layout);
        host.surfaceRenderer.drawSideLayers(svg, layout, layout.scale);
        this.drawFrontObjects(svg, frontX, frontY, layout);

        host.objectNavigatorController.bindCanvasHover();
        host.typographyUnitController.updateDisplays();
        host.objectNavigatorController.render();
        this.restoreZoom(zoomState);
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

        host.objectDocument.textBlocks.forEach(block => {
            if (!this.isVisibleFrontBlock(block)) return;
            host.textRenderer.draw(
                svg,
                block,
                frontX,
                frontY,
                layout.frontWidth,
                layout.frontHeight,
                layout.scale
            );
        });
        host.objectDocument.graphicsBlocks.forEach(block => {
            if (!this.isVisibleFrontBlock(block)) return;
            host.graphicsRenderer?.draw(
                svg,
                block,
                frontX,
                frontY,
                layout.frontWidth,
                layout.frontHeight,
                layout.scale
            );
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

        rect({ x: x + thickness, y: y + thickness, width: frontWidth, height: frontHeight });
        if (!this.host.settingsModule.get('showSidePanels')) return;

        if (this.host.surfaceManager.isVisible('left')) {
            rect({ x, y: y + thickness, width: thickness, height: frontHeight });
        }
        if (this.host.surfaceManager.isVisible('right')) {
            rect({
                x: x + thickness + frontWidth,
                y: y + thickness,
                width: thickness,
                height: frontHeight
            });
        }
        if (this.host.surfaceManager.isVisible('top')) {
            rect({ x: x + thickness, y, width: frontWidth, height: thickness });
        }
        if (this.host.surfaceManager.isVisible('bottom')) {
            rect({
                x: x + thickness,
                y: y + thickness + frontHeight,
                width: frontWidth,
                height: thickness
            });
        }
    }

    drawLabels(container, x, y, frontWidth, frontHeight, thickness, scale = 1) {
        const fontSize = scale === 1 ? '4' : null;
        this.createLabel(
            container,
            x + thickness + frontWidth / 2,
            y + thickness + frontHeight / 2,
            'FRONT',
            false,
            fontSize
        );
        if (this.host.surfaceManager.isVisible('left')) {
            this.createLabel(
                container, x + thickness / 2, y + thickness + frontHeight / 2,
                'LEFT', true, fontSize
            );
        }
        if (this.host.surfaceManager.isVisible('right')) {
            this.createLabel(
                container,
                x + thickness + frontWidth + thickness / 2,
                y + thickness + frontHeight / 2,
                'RIGHT',
                true,
                fontSize
            );
        }
        if (this.host.surfaceManager.isVisible('top')) {
            this.createLabel(
                container, x + thickness + frontWidth / 2, y + thickness / 2,
                'TOP', false, fontSize
            );
        }
        if (this.host.surfaceManager.isVisible('bottom')) {
            this.createLabel(
                container,
                x + thickness + frontWidth / 2,
                y + thickness + frontHeight + thickness / 2,
                'BOTTOM',
                false,
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
