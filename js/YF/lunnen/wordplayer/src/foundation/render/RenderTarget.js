/**
 * RenderTarget — abstract drawing surface.
 *
 * The framework is renderer-agnostic: a tool implements `render(ctx)` and draws
 * natively into whatever surface the target exposes (an `<svg>` DOM tree or a
 * Canvas 2D context). The target owns the cross-cutting concerns shared by every
 * tool: logical artboard sizing, clearing between frames, zoom/pan, fit-to-screen
 * and export.
 *
 * Concrete subclasses: SvgTarget, CanvasTarget.
 */
export class RenderTarget {
    /**
     * @param {HTMLElement} container — the canvas-area element the surface lives in
     * @param {Object} [options]
     * @param {number} [options.width=500]
     * @param {number} [options.height=500]
     */
    constructor(container, options = {}) {
        if (!container) throw new Error('RenderTarget requires a container element');
        this.container = container;
        this.options = options;
        this.logicalWidth = options.width || 500;
        this.logicalHeight = options.height || 500;
        this._zoomChangeHandlers = [];
    }

    /** @returns {'svg'|'canvas'} */
    get type() { return 'abstract'; }

    /** @returns {Element} the underlying surface element. */
    get element() { return null; }

    get width() { return this.logicalWidth; }
    get height() { return this.logicalHeight; }

    /**
     * Set the logical artboard size. Does not redraw — call within `beginFrame`.
     * @param {number} w
     * @param {number} h
     */
    setLogicalSize(w, h) {
        this.logicalWidth = w;
        this.logicalHeight = h;
    }

    /** Prepare a fresh frame (clear + size). Subclasses override. */
    beginFrame() {}

    /** Finalise a frame (refresh zoom dimensions). Subclasses override. */
    endFrame() {}

    /** Wire up zoom/pan interaction. Subclasses override. */
    initZoom(/* options */) {}

    fitToScreen() {}
    resetZoom() {}
    /** @returns {number} current zoom in percent relative to fit. */
    getZoomPercent() { return 100; }

    /**
     * Register a callback invoked whenever zoom changes.
     * @param {(percent:number)=>void} cb
     * @returns {()=>void} unsubscribe
     */
    onZoomChange(cb) {
        this._zoomChangeHandlers.push(cb);
        return () => {
            this._zoomChangeHandlers = this._zoomChangeHandlers.filter(h => h !== cb);
        };
    }

    /** @protected */
    _emitZoomChange(percent) {
        this._zoomChangeHandlers.slice().forEach(h => h(percent));
    }

    /**
     * Serialize the current artboard to an SVG string (always at logical size,
     * never affected by zoom/pan). Returns null for surfaces that cannot.
     * @returns {Promise<string|null>}
     */
    async toSVGString() { return null; }

    destroy() {
        this._zoomChangeHandlers.length = 0;
    }
}
