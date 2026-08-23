const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Owns wheel, keyboard, mouse-pan and resize listeners for ZoomPanManager. */
export class ZoomPanEventController {
    constructor(host, {
        documentRef = globalThis.document,
        windowRef = globalThis.window
    } = {}) {
        this.host = host;
        this.document = documentRef;
        this.window = windowRef;
        this.isPanning = false;
        this.isSpacePressed = false;
        this.startX = 0;
        this.startY = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.initialized = false;
        this.handlers = {
            wheel: event => this.handleWheel(event),
            keydown: event => this.handleKeyDown(event),
            keyup: event => this.handleKeyUp(event),
            mousedown: event => this.handleMouseDown(event),
            mousemove: event => this.handleMouseMove(event),
            mouseup: event => this.handleMouseUp(event),
            contextmenu: event => this.handleContextMenu(event),
            resize: () => this.host.updateViewRotation()
        };
    }

    init() {
        if (this.initialized) return;
        const { container } = this.host;
        container.addEventListener('wheel', this.handlers.wheel, { passive: false });
        container.addEventListener('mousedown', this.handlers.mousedown);
        container.addEventListener('contextmenu', this.handlers.contextmenu);
        this.document?.addEventListener('keydown', this.handlers.keydown);
        this.document?.addEventListener('keyup', this.handlers.keyup);
        this.document?.addEventListener('mousemove', this.handlers.mousemove);
        this.document?.addEventListener('mouseup', this.handlers.mouseup);
        this.window?.addEventListener('resize', this.handlers.resize);
        this.initialized = true;
    }

    handleWheel(event) {
        event.preventDefault();
        const host = this.host;
        const rect = host.container.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (event.metaKey || event.ctrlKey) {
            const direction = -Math.sign(event.deltaY);
            host.zoomTo(host.zoom * (1 + direction * 0.05), mouseX, mouseY);
            return;
        }

        const delta = host.screenDeltaToSvg(
            event.deltaX,
            event.deltaY,
            rect,
            host.getViewBox()
        );
        host.panX += delta.x;
        host.panY += delta.y;
        host.updateTransform();
    }

    handleKeyDown(event) {
        if (EDITABLE_TAGS.has(event.target?.tagName)) return;

        if (event.code === 'Space' && !this.isSpacePressed) {
            event.preventDefault();
            this.isSpacePressed = true;
            this.host.container.style.cursor = 'grab';
        }
        if (!(event.metaKey || event.ctrlKey)) return;

        if (event.key === '0') {
            event.preventDefault();
            this.host.fitToScreen();
        } else if (event.key === '1') {
            event.preventDefault();
            this.host.resetZoom();
        } else if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            this.host.zoomIn();
        } else if (event.key === '-') {
            event.preventDefault();
            this.host.zoomOut();
        }
    }

    handleKeyUp(event) {
        if (event.code !== 'Space') return;
        this.isSpacePressed = false;
        if (!this.isPanning) this.host.container.style.cursor = 'default';
    }

    handleMouseDown(event) {
        if (!((this.isSpacePressed && event.button === 0) || event.button === 1)) return;
        event.preventDefault();
        event.stopPropagation();
        this.isPanning = true;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.lastX = this.host.panX;
        this.lastY = this.host.panY;
        this.host.container.style.cursor = 'grabbing';
    }

    handleMouseMove(event) {
        if (!this.isPanning) return;
        event.preventDefault();
        const host = this.host;
        const rect = host.container.getBoundingClientRect();
        const delta = host.screenDeltaToSvg(
            event.clientX - this.startX,
            event.clientY - this.startY,
            rect,
            host.getViewBox()
        );
        host.panX = this.lastX - delta.x;
        host.panY = this.lastY - delta.y;
        host.updateTransform();
    }

    handleMouseUp() {
        if (!this.isPanning) return;
        this.isPanning = false;
        this.host.container.style.cursor = this.isSpacePressed ? 'grab' : 'default';
    }

    handleContextMenu(event) {
        if (event.button === 1) event.preventDefault();
    }

    destroy() {
        if (!this.initialized) return;
        const { container } = this.host;
        container.removeEventListener('wheel', this.handlers.wheel);
        container.removeEventListener('mousedown', this.handlers.mousedown);
        container.removeEventListener('contextmenu', this.handlers.contextmenu);
        this.document?.removeEventListener('keydown', this.handlers.keydown);
        this.document?.removeEventListener('keyup', this.handlers.keyup);
        this.document?.removeEventListener('mousemove', this.handlers.mousemove);
        this.document?.removeEventListener('mouseup', this.handlers.mouseup);
        this.window?.removeEventListener('resize', this.handlers.resize);
        this.initialized = false;
    }
}
