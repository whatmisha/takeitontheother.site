import { RenderTarget } from './RenderTarget.js';

/**
 * CanvasTarget — a `<canvas>`-backed artboard with Figma-like zoom/pan.
 *
 * The tool draws into the 2D context exposed as `ctx` inside its `render(ctx)`,
 * always using logical artboard coordinates (0..width, 0..height). CanvasTarget
 * owns device-pixel-ratio scaling, the zoom/pan transform and fit-to-screen.
 *
 * Because a canvas frame must be repainted on every zoom/pan change, the host
 * (ApplicationShell) assigns `target.requestRender`; CanvasTarget calls it when
 * the view transform changes.
 */
export class CanvasTarget extends RenderTarget {
    constructor(container, options = {}) {
        super(container, options);

        let canvas = options.element || container.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            container.appendChild(canvas);
        }
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.zoom = 1;
        this.baseZoom = 1;
        this.minZoom = 0.05;
        this.maxZoom = 10;
        this.panX = 0;
        this.panY = 0;

        this.fitPadding = Object.assign(
            { top: 20, right: 20, bottom: 20, left: 20 },
            options.fitPadding || {}
        );

        this._isPanning = false;
        this._isSpacePressed = false;
        this._startX = 0;
        this._startY = 0;
        this._startPanX = 0;
        this._startPanY = 0;

        /** Assigned by the host to trigger a repaint. */
        this.requestRender = options.requestRender || (() => {});

        this._zoomEnabled = false;
    }

    get type() { return 'canvas'; }
    get element() { return this.canvas; }

    get dpr() { return window.devicePixelRatio || 1; }

    _containerSize() {
        const rect = this.container.getBoundingClientRect();
        return { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
    }

    beginFrame() {
        const { w, h } = this._containerSize();
        const dpr = this.dpr;
        const bw = Math.round(w * dpr);
        const bh = Math.round(h * dpr);
        if (this.canvas.width !== bw || this.canvas.height !== bh) {
            this.canvas.width = bw;
            this.canvas.height = bh;
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
        }
        const ctx = this.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Map logical artboard coords → screen, honouring dpr, zoom and pan.
        const s = dpr * this.zoom;
        ctx.setTransform(s, 0, 0, s, this.panX * dpr, this.panY * dpr);
    }

    endFrame() { /* no-op for canvas */ }

    initZoom(options = {}) {
        if (this._zoomEnabled) return;
        if (options.fitPadding) Object.assign(this.fitPadding, options.fitPadding);
        this._zoomEnabled = true;

        this.container.style.position = this.container.style.position || 'relative';
        this.container.style.overflow = 'hidden';

        this._onWheel = (e) => this._handleWheel(e);
        this._onKeyDown = (e) => this._handleKeyDown(e);
        this._onKeyUp = (e) => this._handleKeyUp(e);
        this._onMouseDown = (e) => this._handleMouseDown(e);
        this._onMouseMove = (e) => this._handleMouseMove(e);
        this._onMouseUp = (e) => this._handleMouseUp(e);
        this._onContextMenu = (e) => { if (e.button === 1) e.preventDefault(); };

        this.container.addEventListener('wheel', this._onWheel, { passive: false });
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        this.container.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
        this.container.addEventListener('contextmenu', this._onContextMenu);

        this.fitToScreen();
    }

    _handleWheel(e) {
        e.preventDefault();
        const rect = this.container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        if (e.metaKey || e.ctrlKey) {
            const delta = -Math.sign(e.deltaY);
            this._zoomTo(this.zoom * (1 + delta * 0.05), mx, my);
        } else {
            this.panX -= e.deltaX;
            this.panY -= e.deltaY;
            this.requestRender();
        }
    }

    _zoomTo(newZoom, mx, my) {
        newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        if (newZoom === this.zoom) return;
        // Keep the artboard point under the cursor fixed.
        const lx = (mx - this.panX) / this.zoom;
        const ly = (my - this.panY) / this.zoom;
        this.zoom = newZoom;
        this.panX = mx - lx * this.zoom;
        this.panY = my - ly * this.zoom;
        this.requestRender();
        this._emitZoomChange(this.getZoomPercent());
    }

    _handleKeyDown(e) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.code === 'Space' && !this._isSpacePressed) {
            e.preventDefault();
            this._isSpacePressed = true;
            this.container.style.cursor = 'grab';
        }
        if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) { e.preventDefault(); this.zoomIn(); }
        if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); this.zoomOut(); }
    }

    _handleKeyUp(e) {
        if (e.code === 'Space') {
            this._isSpacePressed = false;
            if (!this._isPanning) this.container.style.cursor = 'default';
        }
    }

    _handleMouseDown(e) {
        if ((this._isSpacePressed && e.button === 0) || e.button === 1) {
            e.preventDefault();
            this._isPanning = true;
            this._startX = e.clientX;
            this._startY = e.clientY;
            this._startPanX = this.panX;
            this._startPanY = this.panY;
            this.container.style.cursor = 'grabbing';
        }
    }

    _handleMouseMove(e) {
        if (!this._isPanning) return;
        e.preventDefault();
        this.panX = this._startPanX + (e.clientX - this._startX);
        this.panY = this._startPanY + (e.clientY - this._startY);
        this.requestRender();
    }

    _handleMouseUp() {
        if (this._isPanning) {
            this._isPanning = false;
            this.container.style.cursor = this._isSpacePressed ? 'grab' : 'default';
        }
    }

    zoomIn() {
        const { w, h } = this._containerSize();
        this._zoomTo(this.zoom * 1.2, w / 2, h / 2);
    }

    zoomOut() {
        const { w, h } = this._containerSize();
        this._zoomTo(this.zoom / 1.2, w / 2, h / 2);
    }

    fitToScreen() {
        const { w, h } = this._containerSize();
        const { top, right, bottom, left } = this.fitPadding;
        const availW = Math.max(1, w - left - right);
        const availH = Math.max(1, h - top - bottom);
        const scale = Math.min(availW / this.logicalWidth, availH / this.logicalHeight);
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, scale));
        this.baseZoom = this.zoom;
        this.panX = (w - this.logicalWidth * this.zoom) / 2;
        this.panY = (h - this.logicalHeight * this.zoom) / 2;
        this.requestRender();
        this._emitZoomChange(this.getZoomPercent());
    }

    resetZoom() {
        const { w, h } = this._containerSize();
        this.zoom = this.baseZoom || 1;
        this.panX = (w - this.logicalWidth * this.zoom) / 2;
        this.panY = (h - this.logicalHeight * this.zoom) / 2;
        this.requestRender();
        this._emitZoomChange(this.getZoomPercent());
    }

    getZoomPercent() {
        const base = this.baseZoom || 1;
        return Math.round((this.zoom / base) * 100);
    }

    destroy() {
        super.destroy();
        if (this._zoomEnabled) {
            this.container.removeEventListener('wheel', this._onWheel);
            document.removeEventListener('keydown', this._onKeyDown);
            document.removeEventListener('keyup', this._onKeyUp);
            this.container.removeEventListener('mousedown', this._onMouseDown);
            document.removeEventListener('mousemove', this._onMouseMove);
            document.removeEventListener('mouseup', this._onMouseUp);
            this.container.removeEventListener('contextmenu', this._onContextMenu);
            this._zoomEnabled = false;
        }
    }
}
