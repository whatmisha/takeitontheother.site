/** Binds the Fit/zoom indicator and canvas-only rotation controls. */
export class ZoomToolbarController {
    constructor({ dom, zoomPanManager }) {
        this.dom = dom;
        this.zoomPanManager = zoomPanManager;
        this.hovered = false;
        this.percent = 100;
    }

    bind() {
        const indicator = this.dom.zoomIndicator;
        this.dom.canvasContainer.addEventListener('zoomchange', event => {
            this.percent = event.detail.percent;
            if (!this.hovered && indicator) indicator.textContent = `${this.percent}%`;
        });
        indicator?.addEventListener('mouseenter', () => {
            this.hovered = true;
            indicator.textContent = 'Fit';
        });
        indicator?.addEventListener('mouseleave', () => {
            this.hovered = false;
            indicator.textContent = `${this.percent}%`;
        });
        indicator?.addEventListener('click', () => this.zoomPanManager.resetZoom());
        this.dom.canvasRotateLeftBtn?.addEventListener(
            'click',
            () => this.zoomPanManager.rotateLeft()
        );
    }
}
