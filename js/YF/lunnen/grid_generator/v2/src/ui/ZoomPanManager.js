import {
    calculateFitView,
    calculateZoomView,
    clientToSvgPoint,
    getSvgRenderScale,
    getSvgViewportSize,
    normalizeRotation,
    screenDeltaToSvg
} from './CanvasViewTransform.js';
import { ZoomPanEventController } from './ZoomPanEventController.js';

/** Owns the canvas view state while events and pure coordinate math stay isolated. */
export class ZoomPanManager {
    constructor(containerElement, svgElement) {
        this.container = containerElement;
        this.svg = svgElement;
        this.zoom = 1;
        this.baseZoom = 1;
        this.minZoom = 0.1;
        this.maxZoom = 10;
        this.panX = 0;
        this.panY = 0;
        this.basePanX = 0;
        this.basePanY = 0;
        this.rotation = 0;
        this.originalWidth = 0;
        this.originalHeight = 0;

        this.initializeSVG();
        this.eventController = new ZoomPanEventController(this);
        this.eventController.init();
    }

    initializeSVG() {
        this.initializeFrame = requestAnimationFrame(() => {
            this.initializeFrame = null;
            try {
                const width = parseFloat(this.svg.getAttribute('width')) || 0;
                const height = parseFloat(this.svg.getAttribute('height')) || 0;
                if (width > 0 && height > 0) {
                    this.originalWidth = width;
                    this.originalHeight = height;
                } else {
                    const bbox = this.svg.getBBox();
                    this.originalWidth = bbox.width || 1000;
                    this.originalHeight = bbox.height || 1000;
                }
                this.panX = 0;
                this.panY = 0;
                this.updateTransform();
            } catch {
                console.warn('Could not get SVG dimensions, using fallback');
                this.originalWidth = 1000;
                this.originalHeight = 1000;
                this.updateTransform();
            }
        });

        Object.assign(this.svg.style, {
            width: '100%',
            height: '100%',
            shapeRendering: 'geometricPrecision',
            textRendering: 'geometricPrecision',
            transformOrigin: '50% 50%',
            transformBox: 'fill-box'
        });
        Object.assign(this.container.style, {
            position: 'relative',
            overflow: 'hidden',
            cursor: 'default'
        });
    }

    getViewBox() {
        const value = this.svg.getAttribute('viewBox');
        if (!value) {
            return { x: 0, y: 0, width: this.originalWidth, height: this.originalHeight };
        }
        const [x, y, width, height] = value.trim().split(/\s+/).map(Number);
        return { x, y, width, height };
    }

    screenDeltaToSvg(deltaX, deltaY, rect, viewBox) {
        return screenDeltaToSvg(
            deltaX,
            deltaY,
            rect || this.container.getBoundingClientRect(),
            viewBox || this.getViewBox(),
            this.rotation
        );
    }

    getSvgRenderScale(rect, viewBox) {
        return getSvgRenderScale(
            rect || this.container.getBoundingClientRect(),
            viewBox || this.getViewBox(),
            this.rotation
        );
    }

    getSvgViewportSize(rect) {
        return getSvgViewportSize(rect || this.container.getBoundingClientRect(), this.rotation);
    }

    clientToSvgPoint(clientX, clientY) {
        return clientToSvgPoint(
            clientX,
            clientY,
            this.container.getBoundingClientRect(),
            this.getViewBox(),
            this.rotation
        );
    }

    zoomTo(requestedZoom, mouseX, mouseY) {
        const next = calculateZoomView({
            requestedZoom,
            currentZoom: this.zoom,
            minZoom: this.minZoom,
            maxZoom: this.maxZoom,
            mouseX,
            mouseY,
            rect: this.container.getBoundingClientRect(),
            viewBox: this.getViewBox(),
            originalWidth: this.originalWidth,
            originalHeight: this.originalHeight
        });
        if (!next) return;

        this.zoom = next.zoom;
        this.panX = next.panX;
        this.panY = next.panY;
        this.updateTransform();
        this.notifyZoomChange();
    }

    updateTransform() {
        const width = this.originalWidth / this.zoom;
        const height = this.originalHeight / this.zoom;
        this.svg.setAttribute('viewBox', `${this.panX} ${this.panY} ${width} ${height}`);
    }

    zoomIn() {
        const rect = this.container.getBoundingClientRect();
        this.zoomTo(this.zoom * 1.2, rect.width / 2, rect.height / 2);
    }

    zoomOut() {
        const rect = this.container.getBoundingClientRect();
        this.zoomTo(this.zoom / 1.2, rect.width / 2, rect.height / 2);
    }

    rotateLeft() {
        this.rotation = normalizeRotation(this.rotation + 270);
        this.updateViewRotation();
        this.container.dispatchEvent(new CustomEvent('canvasrotationchange', {
            detail: { rotation: this.rotation }
        }));
        return this.rotation;
    }

    updateViewRotation() {
        const rect = this.container.getBoundingClientRect();
        const viewport = getSvgViewportSize(rect, this.rotation);
        const swapsAxes = viewport.width === rect.height && this.rotation % 180 !== 0;
        this.svg.style.width = swapsAxes ? `${rect.height}px` : '100%';
        this.svg.style.height = swapsAxes ? `${rect.width}px` : '100%';
        this.svg.style.transform = this.rotation === 0 ? '' : `rotate(${this.rotation}deg)`;
    }

    resetZoom() {
        this.zoom = this.baseZoom;
        this.panX = this.basePanX;
        this.panY = this.basePanY;
        this.updateTransform();
        this.notifyZoomChange();
    }

    fitToScreen() {
        const fit = calculateFitView({
            bbox: this.svg.getBBox(),
            containerRect: this.container.getBoundingClientRect(),
            originalWidth: this.originalWidth,
            originalHeight: this.originalHeight,
            minZoom: this.minZoom,
            maxZoom: this.maxZoom
        });
        this.zoom = fit.zoom;
        this.panX = fit.panX;
        this.panY = fit.panY;
        this.baseZoom = fit.zoom;
        this.basePanX = fit.panX;
        this.basePanY = fit.panY;
        this.updateTransform();
        this.notifyZoomChange();
    }

    getZoomPercent() {
        return Math.round((this.zoom / this.baseZoom) * 100);
    }

    notifyZoomChange() {
        this.container.dispatchEvent(new CustomEvent('zoomchange', {
            detail: { zoom: this.zoom, percent: this.getZoomPercent() }
        }));
    }

    reinitializeSVGDimensions() {
        try {
            const width = parseFloat(this.svg.getAttribute('width')) || this.originalWidth;
            const height = parseFloat(this.svg.getAttribute('height')) || this.originalHeight;
            if (width > 0 && height > 0) {
                this.originalWidth = width;
                this.originalHeight = height;
            }
        } catch (error) {
            console.warn('Could not reinitialize SVG dimensions', error);
        }
    }

    destroy() {
        if (this.initializeFrame != null) {
            cancelAnimationFrame(this.initializeFrame);
            this.initializeFrame = null;
        }
        this.eventController.destroy();
    }

    dispose() {
        return this.destroy();
    }
}
