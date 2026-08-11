import { ListenerScope } from '../core/ListenerScope.js';

/** Binds the Fit/zoom indicator and canvas-only rotation controls. */
export class ZoomToolbarController {
    constructor({ dom, zoomPanManager }) {
        this.dom = dom;
        this.zoomPanManager = zoomPanManager;
        this.hovered = false;
        this.percent = 100;
        this.listeners = new ListenerScope();
        this.bound = false;
    }

    bind() {
        if (this.bound) return false;
        this.bound = true;
        const indicator = this.dom.zoomIndicator;
        this.listeners.listen(this.dom.canvasContainer, 'zoomchange', event => {
            this.percent = event.detail.percent;
            if (!this.hovered && indicator) indicator.textContent = `${this.percent}%`;
        });
        this.listeners.listen(indicator, 'mouseenter', () => {
            this.hovered = true;
            indicator.textContent = 'Fit';
        });
        this.listeners.listen(indicator, 'mouseleave', () => {
            this.hovered = false;
            indicator.textContent = `${this.percent}%`;
        });
        this.listeners.listen(indicator, 'click', () => this.zoomPanManager.resetZoom());
        this.listeners.listen(
            this.dom.canvasRotateLeftBtn,
            'click',
            () => this.zoomPanManager.rotateLeft()
        );
        return true;
    }

    dispose() {
        this.bound = false;
        return this.listeners.dispose();
    }
}
