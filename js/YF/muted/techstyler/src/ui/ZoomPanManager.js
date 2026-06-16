/**
 * ZoomPanManager - Figma-like canvas zoom and pan control
 * 
 * Features:
 * - Zoom: mouse wheel centred on the cursor (vector via viewBox)
 * - Pan: Space + drag or middle mouse button
 * - Pinch-to-zoom on touchpads
 * - Fit to screen
 * - Reset zoom (100%)
 * 
 * IMPORTANT: Uses the SVG viewBox for true vector scaling
 *
 * @param {HTMLElement} containerElement — usually #canvasContainer (area between the top and bottom panels)
 * @param {SVGSVGElement} svgElement
 * @param {Object} [options]
 * @param {{ top?: number, right?: number, bottom?: number, left?: number }} [options.fitPadding]
 *        Padding inside the container for fitToScreen (default is a small inset so the artwork fits inside the canvas slot)
 */
export class ZoomPanManager {
    constructor(containerElement, svgElement, options = {}) {
        this.container = containerElement;
        this.svg = svgElement;

        const fp = options.fitPadding || {};
        this.fitPadding = {
            top:    fp.top    ?? 20,
            right:  fp.right  ?? 20,
            bottom: fp.bottom ?? 20,
            left:   fp.left   ?? 20
        };
        
        // Transform state
        this.zoom = 1;
        this.baseZoom = 1; // Zoom level considered 100% (usually fitToScreen)
        this.minZoom = 0.05; // Allow zooming out below 1.0; otherwise fit breaks on large artboards
        this.maxZoom = 10;
        this.panX = 0;
        this.panY = 0;
        
        // Original SVG dimensions
        this.originalWidth = 0;
        this.originalHeight = 0;
        
        // Drag state
        this.isPanning = false;
        this.isSpacePressed = false;
        this.startX = 0;
        this.startY = 0;
        this.lastX = 0;
        this.lastY = 0;
        
        // Initialize SVG for vector zoom
        this.initializeSVG();
        
        // Initialize handlers
        this.initEventListeners();
    }
    
    /**
     * Reads SVG dimensions and configures container styles.
     * Does NOT touch viewBox — it is controlled only by zoom logic (fitToScreen / updateTransform).
     */
    initializeSVG() {
        this.reinitializeSVGDimensions();

        this.svg.style.width = '100%';
        this.svg.style.height = '100%';
        this.svg.style.shapeRendering = 'geometricPrecision';
        this.svg.style.textRendering = 'geometricPrecision';

        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'default';
    }
    
    /**
     * Initialize all event handlers
     */
    initEventListeners() {
        // Bind once so destroy() can detach the exact same references.
        this._onWheel = this.handleWheel.bind(this);
        this._onKeyDown = this.handleKeyDown.bind(this);
        this._onKeyUp = this.handleKeyUp.bind(this);
        this._onMouseDown = this.handleMouseDown.bind(this);
        this._onMouseMove = this.handleMouseMove.bind(this);
        this._onMouseUp = this.handleMouseUp.bind(this);
        this._onContextMenu = (e) => { if (e.button === 1) e.preventDefault(); };

        this.container.addEventListener('wheel', this._onWheel, { passive: false });
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        this.container.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
        this.container.addEventListener('contextmenu', this._onContextMenu);
    }
    
    /**
     * Mouse wheel handler for zoom and pan
     */
    handleWheel(e) {
        e.preventDefault();
        
        // Get cursor coordinates relative to the container
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Cmd/Ctrl pressed: zoom (like Figma/Apple apps)
        if (e.metaKey || e.ctrlKey) {
            // Determine zoom direction
            const delta = -Math.sign(e.deltaY);
            const zoomSpeed = 0.05; // Reduced 2× (was 0.1)
            const newZoom = this.zoom * (1 + delta * zoomSpeed);
            
            // Apply zoom centred on the cursor
            this.zoomTo(newZoom, mouseX, mouseY);
        } else {
            // Otherwise pan (for Apple Magic Mouse and trackpads)
            const viewBox = this.getViewBox();
            
            // Convert movement to SVG coordinates
            const deltaXSvg = (e.deltaX / rect.width) * viewBox.width;
            const deltaYSvg = (e.deltaY / rect.height) * viewBox.height;
            
            // Update viewBox position
            this.panX += deltaXSvg;
            this.panY += deltaYSvg;
            
            this.updateTransform();
        }
    }
    
    /**
     * Zoom to the given point
     */
    zoomTo(newZoom, mouseX, mouseY) {
        newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        if (newZoom === this.zoom) return;

        const viewBox = this.getViewBox();
        const rect = this.container.getBoundingClientRect();

        const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
        const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;

        const newWidth = rect.width / newZoom;
        const newHeight = rect.height / newZoom;

        this.panX = svgX - (mouseX / rect.width) * newWidth;
        this.panY = svgY - (mouseY / rect.height) * newHeight;
        this.zoom = newZoom;

        this.updateTransform();
        this.notifyZoomChange();
    }
    
    /**
     * Keydown handler
     */
    handleKeyDown(e) {
        // Make sure focus is not on input elements
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'TEXTAREA' || 
            e.target.tagName === 'SELECT') {
            return;
        }
        
        if (e.code === 'Space' && !this.isSpacePressed) {
            e.preventDefault();
            this.isSpacePressed = true;
            this.container.style.cursor = 'grab';
        }
        
        // Zoom shortcuts
        // Cmd/Ctrl + 0: Fit to screen
        if ((e.metaKey || e.ctrlKey) && e.key === '0') {
            e.preventDefault();
            this.fitToScreen();
        }
        
        // Cmd/Ctrl + 1: Reset to 100%
        if ((e.metaKey || e.ctrlKey) && e.key === '1') {
            e.preventDefault();
            this.resetZoom();
        }
        
        // Cmd/Ctrl + Plus: Zoom in
        if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            this.zoomIn();
        }
        
        // Cmd/Ctrl + Minus: Zoom out
        if ((e.metaKey || e.ctrlKey) && e.key === '-') {
            e.preventDefault();
            this.zoomOut();
        }
    }
    
    /**
     * Keyup handler
     */
    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.isSpacePressed = false;
            if (!this.isPanning) {
                this.container.style.cursor = 'default';
            }
        }
    }
    
    /**
     * Mouse down handler
     */
    handleMouseDown(e) {
        // Space + left button or middle mouse button
        if ((this.isSpacePressed && e.button === 0) || e.button === 1) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            this.isPanning = true;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.lastX = this.panX;
            this.lastY = this.panY;
            this.container.style.cursor = 'grabbing';
        }
    }
    
    /**
     * Mouse move handler
     */
    handleMouseMove(e) {
        if (this.isPanning) {
            e.preventDefault();
            
            // Calculate movement in pixels
            const dxPixels = e.clientX - this.startX;
            const dyPixels = e.clientY - this.startY;
            
            // Convert movement to SVG coordinates
            const rect = this.container.getBoundingClientRect();
            const viewBox = this.getViewBox();
            const dxSvg = (dxPixels / rect.width) * viewBox.width;
            const dySvg = (dyPixels / rect.height) * viewBox.height;
            
            // Update position (when panning, move the viewBox in the opposite direction)
            this.panX = this.lastX - dxSvg;
            this.panY = this.lastY - dySvg;
            
            this.updateTransform();
        }
    }
    
    /**
     * Mouse up handler
     */
    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.container.style.cursor = this.isSpacePressed ? 'grab' : 'default';
        }
    }
    
    /**
     * Get the current viewBox
     */
    getViewBox() {
        const viewBoxAttr = this.svg.getAttribute('viewBox');
        if (!viewBoxAttr) {
            return { x: 0, y: 0, width: this.originalWidth, height: this.originalHeight };
        }
        const [x, y, width, height] = viewBoxAttr.split(' ').map(Number);
        return { x, y, width, height };
    }
    
    /**
     * Apply the current transform via viewBox (vector scaling).
     * viewBox always matches container proportions, not content proportions.
     */
    updateTransform() {
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const width = rect.width / this.zoom;
        const height = rect.height / this.zoom;

        this.svg.setAttribute('viewBox', `${this.panX} ${this.panY} ${width} ${height}`);
    }
    
    /**
     * Zoom in
     */
    zoomIn() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomTo(this.zoom * 1.2, centerX, centerY);
    }
    
    /**
     * Zoom out
     */
    zoomOut() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomTo(this.zoom / 1.2, centerX, centerY);
    }
    
    /**
     * Reset zoom to the current baseline (100% = baseZoom)
     */
    resetZoom() {
        this.zoom = this.baseZoom || 1;
        this.centerContent();
        this.notifyZoomChange();
    }

    /**
     * Centre SVG content inside the container without changing zoom.
     */
    centerContent() {
        const bbox = this.svg.getBBox();
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const vbW = rect.width / this.zoom;
        const vbH = rect.height / this.zoom;

        this.panX = bbox.x + bbox.width / 2 - vbW / 2;
        this.panY = bbox.y + bbox.height / 2 - vbH / 2;

        this.updateTransform();
    }
    
    /**
     * Fit to screen — fit SVG content into the canvas-container slot with padding.
     * The resulting zoom becomes the baseline and is considered 100%.
     */
    fitToScreen() {
        const bbox = this.svg.getBBox();
        const containerRect = this.container.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) return;

        const { top, right, bottom, left } = this.fitPadding;
        const availableWidth = Math.max(1, containerRect.width - left - right);
        const availableHeight = Math.max(1, containerRect.height - top - bottom);

        const safeWidth = Math.max(1, bbox.width);
        const safeHeight = Math.max(1, bbox.height);
        const scaleX = availableWidth / safeWidth;
        const scaleY = availableHeight / safeHeight;
        const scale = Math.min(scaleX, scaleY);

        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, scale));
        this.baseZoom = this.zoom;

        const vbW = containerRect.width / this.zoom;
        const vbH = containerRect.height / this.zoom;

        this.panX = bbox.x + bbox.width / 2 - vbW / 2;
        this.panY = bbox.y + bbox.height / 2 - vbH / 2;

        this.updateTransform();
        this.notifyZoomChange();
    }
    
    /**
     * Get the current zoom level as a percentage (relative to baseZoom)
     */
    getZoomPercent() {
        const base = this.baseZoom || 1;
        return Math.round((this.zoom / base) * 100);
    }
    
    /**
     * Notify about a zoom change (for UI updates)
     */
    notifyZoomChange() {
        const event = new CustomEvent('zoomchange', { 
            detail: { 
                zoom: this.zoom, 
                percent: this.getZoomPercent() 
            } 
        });
        this.container.dispatchEvent(event);
    }
    
    /**
     * Reinitialize SVG dimensions after content changes
     * Called after updateGrid() to update originalWidth/Height
     */
    reinitializeSVGDimensions() {
        try {
            // Get dimensions from SVG attributes
            const width = parseFloat(this.svg.getAttribute('width')) || this.originalWidth;
            const height = parseFloat(this.svg.getAttribute('height')) || this.originalHeight;
            
            if (width > 0 && height > 0) {
                this.originalWidth = width;
                this.originalHeight = height;
            }
        } catch (e) {
            console.warn('Could not reinitialize SVG dimensions', e);
        }
    }
    
    /**
     * Clean up handlers
     */
    destroy() {
        this.container.removeEventListener('wheel', this._onWheel);
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        this.container.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
        this.container.removeEventListener('contextmenu', this._onContextMenu);
    }
}

