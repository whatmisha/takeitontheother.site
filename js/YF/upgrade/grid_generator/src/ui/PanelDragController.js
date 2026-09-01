import { ListenerScope } from '../core/ListenerScope.js';

const EMPTY_DRAG_STATE = Object.freeze({
    isDragging: false,
    panel: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0
});

export class PanelDragController {
    constructor(registry, documentRef = document, windowRef = window) {
        this.registry = registry;
        this.document = documentRef;
        this.window = windowRef;
        this.state = { ...EMPTY_DRAG_STATE };
        this.bindings = new Map();
        this.listeners = new ListenerScope();
        this.onMove = event => this.move(event);
        this.onStop = () => this.stop();
        this.listeners.listen(this.document, 'mousemove', this.onMove);
        this.listeners.listen(this.document, 'mouseup', this.onStop);
    }

    bind(panelId) {
        const panel = this.registry.get(panelId);
        if (!panel || this.bindings.has(panelId)) return;

        const raise = () => this.registry.bringToFront(panelId);
        this.listeners.listen(panel.element, 'mousedown', raise);

        let begin = null;
        if (panel.config.draggable && panel.header) {
            panel.header.style.cursor = 'grab';
            begin = event => {
                if (event.button !== undefined && event.button !== 0) return;
                if (event.target.closest('.collapse-toggle, .collapse-icon')) return;
                this.start(panelId, event);
            };
            this.listeners.listen(panel.header, 'mousedown', begin);
        }
        this.bindings.set(panelId, { panel, raise, begin });
    }

    start(panelId, event) {
        const panel = this.registry.get(panelId);
        if (!panel) return;
        event.preventDefault();
        const rect = panel.element.getBoundingClientRect();
        this.state = {
            isDragging: true,
            panel: panelId,
            startX: event.clientX,
            startY: event.clientY,
            initialX: rect.left,
            initialY: rect.top
        };
        if (panel.header) panel.header.style.cursor = 'grabbing';
        panel.element.style.transition = 'none';
        this.registry.bringToFront(panelId);
    }

    move(event) {
        if (!this.state.isDragging) return;
        const panel = this.registry.get(this.state.panel);
        if (!panel) return this.stop();
        const rect = panel.element.getBoundingClientRect();
        const x = this.state.initialX + event.clientX - this.state.startX;
        const y = this.state.initialY + event.clientY - this.state.startY;
        this.registry.setPosition(
            this.state.panel,
            Math.max(0, Math.min(x, this.window.innerWidth - rect.width)),
            Math.max(0, Math.min(y, this.window.innerHeight - rect.height))
        );
    }

    stop() {
        if (!this.state.isDragging) return;
        const panel = this.registry.get(this.state.panel);
        if (panel?.header) panel.header.style.cursor = 'grab';
        if (panel?.element) panel.element.style.transition = '';
        this.state = { ...EMPTY_DRAG_STATE };
    }

    dispose() {
        this.stop();
        this.bindings.clear();
        return this.listeners.dispose();
    }
}
