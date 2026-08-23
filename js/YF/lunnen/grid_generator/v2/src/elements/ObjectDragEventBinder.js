import { ListenerScope } from '../core/ListenerScope.js';

/** Binds click-vs-drag gestures and forwards semantic movement to the controller. */
export class ObjectDragEventBinder {
    constructor(host, controller, documentRef = globalThis.document, now = () => Date.now()) {
        this.host = host;
        this.controller = controller;
        this.document = documentRef;
        this.now = now;
        this.listeners = new ListenerScope();
        this.pendingGestureCleanups = new Set();
        this.initialized = false;
        this.handleTextMove = event => {
            if (!this.controller.isDragging('text')) return;
            event.preventDefault();
            this.controller.moveText(event);
        };
        this.handleTextUp = event => {
            if (!this.controller.isDragging('text')) return;
            event.preventDefault();
            this.controller.endText();
        };
    }

    init() {
        if (this.initialized) return false;
        this.listeners.listen(this.document, 'mousemove', this.handleTextMove);
        this.listeners.listen(this.document, 'mouseup', this.handleTextUp);
        this.initialized = true;
        return true;
    }

    attachText(group, block) {
        group.addEventListener('mousedown', event => {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();
            const startedAt = this.now();
            const startX = event.clientX;
            const startY = event.clientY;
            let moved = false;
            const onMove = moveEvent => {
                const dx = Math.abs(moveEvent.clientX - startX);
                const dy = Math.abs(moveEvent.clientY - startY);
                if (!moved && (dx > 3 || dy > 3)) {
                    moved = true;
                    this.controller.startText(block.id, startX, startY);
                }
            };
            const cleanup = () => {
                this.document.removeEventListener('mousemove', onMove);
                this.document.removeEventListener('mouseup', onUp);
                this.pendingGestureCleanups.delete(cleanup);
            };
            const onUp = () => {
                cleanup();
                if (!moved && this.now() - startedAt < 300) {
                    this.host.objectEditorPanelController.openTextPanel(block.id);
                }
            };
            this.pendingGestureCleanups.add(cleanup);
            this.document.addEventListener('mousemove', onMove);
            this.document.addEventListener('mouseup', onUp);
        });
    }

    attachGraphics(group, block) {
        group.addEventListener('mousedown', event => {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();
            const startedAt = this.now();
            const startX = event.clientX;
            const startY = event.clientY;
            this.controller.startGraphics(block, startX, startY);
            this.controller.setGraphicsBounds(group, 0.5, 0.05);
            const onMove = moveEvent => this.controller.moveGraphics(moveEvent, block);
            const cleanup = () => {
                this.document.removeEventListener('mousemove', onMove);
                this.document.removeEventListener('mouseup', onUp);
                this.pendingGestureCleanups.delete(cleanup);
            };
            const onUp = upEvent => {
                cleanup();
                this.controller.endGraphics();
                const distance = Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY);
                if (this.now() - startedAt < 300 && distance < 10) {
                    this.host.objectEditorPanelController.openGraphicsPanel(block.id);
                }
                this.controller.setGraphicsBounds(group, 0, 0);
            };
            this.pendingGestureCleanups.add(cleanup);
            this.document.addEventListener('mousemove', onMove);
            this.document.addEventListener('mouseup', onUp);
        });
        group.addEventListener('mouseenter', () => {
            if (!this.host.textDragState.isDragging) this.controller.setGraphicsBounds(group, 0.5, 0.05);
        });
        group.addEventListener('mouseleave', () => {
            if (!this.host.textDragState.isDragging) this.controller.setGraphicsBounds(group, 0, 0);
        });
    }

    dispose() {
        for (const cleanup of [...this.pendingGestureCleanups]) cleanup();
        this.initialized = false;
        return this.listeners.dispose();
    }
}
