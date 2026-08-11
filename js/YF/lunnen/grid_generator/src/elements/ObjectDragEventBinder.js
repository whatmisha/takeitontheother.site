/** Binds click-vs-drag gestures and forwards semantic movement to the controller. */
export class ObjectDragEventBinder {
    constructor(host, controller, documentRef = globalThis.document, now = () => Date.now()) {
        this.host = host;
        this.controller = controller;
        this.document = documentRef;
        this.now = now;
    }

    init() {
        this.document.addEventListener('mousemove', event => {
            if (!this.controller.isDragging('text')) return;
            event.preventDefault();
            this.controller.moveText(event);
        });
        this.document.addEventListener('mouseup', event => {
            if (!this.controller.isDragging('text')) return;
            event.preventDefault();
            this.controller.endText();
        });
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
            const onUp = () => {
                this.document.removeEventListener('mousemove', onMove);
                this.document.removeEventListener('mouseup', onUp);
                if (!moved && this.now() - startedAt < 300) {
                    this.host.objectEditorPanelController.openTextPanel(block.id);
                }
            };
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
            const onUp = upEvent => {
                this.document.removeEventListener('mousemove', onMove);
                this.document.removeEventListener('mouseup', onUp);
                this.controller.endGraphics();
                const distance = Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY);
                if (this.now() - startedAt < 300 && distance < 10) {
                    this.host.objectEditorPanelController.openGraphicsPanel(block.id);
                }
                this.controller.setGraphicsBounds(group, 0, 0);
            };
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
}
