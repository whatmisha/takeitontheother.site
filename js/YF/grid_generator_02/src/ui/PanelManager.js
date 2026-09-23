import { PanelDragController } from './PanelDragController.js';
import { PanelRegistry } from './PanelRegistry.js';

/** Facade for panel lifecycle, stacking and pointer interactions. */
export class PanelManager {
    constructor(documentRef = document, windowRef = window) {
        this.registry = new PanelRegistry(documentRef, windowRef);
        this.dragController = new PanelDragController(this.registry, documentRef, windowRef);
        this.panels = this.registry.panels;
    }

    registerPanel(panelId, config = {}) {
        const panel = this.registry.register(panelId, config);
        if (panel) this.dragController.bind(panelId);
        return panel;
    }

    initDragging(panelId) {
        this.dragController.bind(panelId);
    }

    startDragging(panelId, event) {
        this.dragController.start(panelId, event);
    }

    onDragging(event) {
        this.dragController.move(event);
    }

    stopDragging() {
        this.dragController.stop();
    }

    get dragState() {
        return this.dragController.state;
    }

    open(panelId) {
        return this.registry.open(panelId);
    }

    close(panelId) {
        return this.registry.close(panelId);
    }

    toggle(panelId) {
        return this.isOpen(panelId) ? this.close(panelId) : this.open(panelId);
    }

    setCollapsed(panelId, collapsed) {
        return this.registry.setCollapsed(panelId, collapsed);
    }

    isCollapsed(panelId) {
        const panel = this.registry.get(panelId);
        return panel ? panel.isCollapsed : this.registry.getElement(panelId)?.classList.contains('panel-collapsed') || false;
    }

    bringToFront(panelId) {
        return this.registry.bringToFront(panelId);
    }

    isOpen(panelId) {
        return this.registry.get(panelId)?.isOpen || false;
    }

    closeAll(except = []) {
        this.panels.forEach((panel, panelId) => {
            if (!except.includes(panelId) && !panel.config.persistent && panel.isOpen) this.close(panelId);
        });
    }

    setPosition(panelId, x, y) {
        return this.registry.setPosition(panelId, x, y);
    }

    resetPosition(panelId) {
        return this.registry.resetPosition(panelId);
    }

    getPosition(panelId) {
        const position = this.registry.get(panelId)?.position;
        return position ? { ...position } : null;
    }

    center(panelId) {
        return this.registry.center(panelId);
    }

    dispose() {
        const disposed = this.dragController.dispose();
        this.panels.clear();
        return disposed;
    }
}
