import { RenderTarget } from './RenderTarget.js';
import { ZoomPanManager } from '../ui/ZoomPanManager.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * SvgTarget — an `<svg>`-backed artboard.
 *
 * The tool draws SVG DOM nodes directly into `target.element` (or via the
 * `target.create()` helper) inside its `render(ctx)`. Zoom/pan is handled by
 * ZoomPanManager (vector viewBox, not CSS transform), and export serialises the
 * live tree at logical size.
 */
export class SvgTarget extends RenderTarget {
    constructor(container, options = {}) {
        super(container, options);

        let svg = options.element || container.querySelector('svg');
        if (!svg) {
            svg = document.createElementNS(SVG_NS, 'svg');
            container.appendChild(svg);
        }
        this.svg = svg;
        this.zoomPan = null;
        this.fitPadding = options.fitPadding;
    }

    get type() { return 'svg'; }
    get element() { return this.svg; }

    /** Convenience: create an SVG element in the SVG namespace. */
    create(tag, attrs = {}) {
        const el = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (v != null) el.setAttribute(k, String(v));
        }
        return el;
    }

    beginFrame() {
        const svg = this.svg;
        svg.replaceChildren();
        const w = this.logicalWidth;
        const h = this.logicalHeight;
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        if (!this.zoomPan) {
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }
    }

    endFrame() {
        if (this.zoomPan) this.zoomPan.reinitializeSVGDimensions();
    }

    initZoom(options = {}) {
        if (this.zoomPan) return;
        this.zoomPan = new ZoomPanManager(this.container, this.svg, {
            fitPadding: options.fitPadding || this.fitPadding,
            interactive: options.interactive
        });
        this.container.addEventListener('zoomchange', () => {
            this._emitZoomChange(this.zoomPan.getZoomPercent());
        });
        this.zoomPan.fitToScreen();
    }

    fitToScreen() { this.zoomPan?.fitToScreen(); }
    resetZoom() { this.zoomPan?.resetZoom(); }
    zoomIn() { this.zoomPan?.zoomIn(); }
    zoomOut() { this.zoomPan?.zoomOut(); }
    getZoomPercent() { return this.zoomPan ? this.zoomPan.getZoomPercent() : 100; }

    /**
     * Serialize the artboard at logical size (zoom/pan never affect the result).
     * @returns {Promise<string>}
     */
    async toSVGString() {
        const clone = this.svg.cloneNode(true);
        clone.querySelectorAll('[data-export-exclude="true"]').forEach((element) => element.remove());
        clone.setAttribute('xmlns', SVG_NS);
        clone.setAttribute('width', this.logicalWidth);
        clone.setAttribute('height', this.logicalHeight);
        clone.setAttribute('viewBox', `0 0 ${this.logicalWidth} ${this.logicalHeight}`);
        // ZoomPanManager sets style width/height:100% on the live node; strip it so
        // the exported file uses its intrinsic logical size (needed for rasterising).
        clone.style.width = '';
        clone.style.height = '';
        clone.removeAttribute('style');
        return new XMLSerializer().serializeToString(clone);
    }

    destroy() {
        super.destroy();
        this.zoomPan?.destroy();
        this.zoomPan = null;
    }
}
