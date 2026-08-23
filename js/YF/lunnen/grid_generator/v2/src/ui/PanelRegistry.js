const DEFAULT_PANEL_CONFIG = Object.freeze({
    draggable: true,
    initialPosition: null,
    onOpen: null,
    onClose: null,
    persistent: false
});

export class PanelRegistry {
    constructor(documentRef = document, windowRef = window) {
        this.document = documentRef;
        this.window = windowRef;
        this.panels = new Map();
        this.highestZIndex = 1000;
    }

    register(panelId, config = {}) {
        const element = this.document.getElementById(panelId);
        if (!element) {
            console.warn(`Panel not found: ${panelId}`);
            return null;
        }

        const panel = {
            element,
            header: config.headerId ? this.document.getElementById(config.headerId) : null,
            config: { ...DEFAULT_PANEL_CONFIG, ...config },
            isOpen: element.style.display !== 'none',
            isCollapsed: element.classList.contains('panel-collapsed'),
            position: { x: 0, y: 0 }
        };
        this.panels.set(panelId, panel);

        if (panel.config.initialPosition) {
            this.setPosition(panelId, panel.config.initialPosition.x, panel.config.initialPosition.y);
        }
        return panel;
    }

    get(panelId) {
        return this.panels.get(panelId) || null;
    }

    getElement(panelId) {
        return this.get(panelId)?.element || this.document.getElementById(panelId);
    }

    open(panelId) {
        const panel = this.get(panelId);
        if (!panel) return false;
        panel.element.style.display = 'block';
        panel.isOpen = true;
        this.bringToFront(panelId);
        panel.config.onOpen?.();
        return true;
    }

    close(panelId) {
        const panel = this.get(panelId);
        if (!panel) return false;
        panel.element.style.display = 'none';
        panel.isOpen = false;
        panel.config.onClose?.();
        return true;
    }

    setCollapsed(panelId, collapsed) {
        const element = this.getElement(panelId);
        if (!element) return false;
        element.classList.toggle('panel-collapsed', collapsed);
        const panel = this.get(panelId);
        if (panel) panel.isCollapsed = collapsed;
        return true;
    }

    setPosition(panelId, x, y) {
        const panel = this.get(panelId);
        if (!panel) return false;
        Object.assign(panel.element.style, {
            left: `${x}px`,
            top: `${y}px`,
            right: 'auto',
            bottom: 'auto'
        });
        panel.position = { x, y };
        return true;
    }

    resetPosition(panelId) {
        const panel = this.get(panelId);
        if (!panel) return false;
        Object.assign(panel.element.style, { left: '', top: '', right: '', bottom: '' });
        panel.position = { x: 0, y: 0 };
        const initial = panel.config.initialPosition;
        return initial ? this.setPosition(panelId, initial.x, initial.y) : true;
    }

    center(panelId) {
        const panel = this.get(panelId);
        if (!panel) return false;
        const rect = panel.element.getBoundingClientRect();
        return this.setPosition(
            panelId,
            (this.window.innerWidth - rect.width) / 2,
            (this.window.innerHeight - rect.height) / 2
        );
    }

    bringToFront(panelId) {
        const panel = this.get(panelId);
        if (!panel) return false;
        this.highestZIndex += 1;
        panel.element.style.zIndex = String(this.highestZIndex);
        return true;
    }
}
