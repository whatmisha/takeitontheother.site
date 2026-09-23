/** Owns pointer binding and surface-local width math for text resize handles. */
export class TextResizeController {
    constructor(host, documentRef = globalThis.document) {
        this.host = host;
        this.document = documentRef;
        this.pendingGestureCleanups = new Set();
    }

    attach(handle, block) {
        let resizing = false;
        let startWidth = 0;
        handle.addEventListener('mousedown', event => {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();
            this.host.historyManager.beginAction('resize text block', this.host.getStateSnapshot());
            resizing = true;
            startWidth = block.width || 1;
            const startPointer = this.host.getSurfacePointer(event.clientX, event.clientY);
            handle.setAttribute('fill-opacity', '0.3');
            const onMove = moveEvent => {
                if (!resizing) return;
                moveEvent.stopPropagation();
                moveEvent.preventDefault();
                const pointer = this.host.getSurfacePointer(moveEvent.clientX, moveEvent.clientY);
                const surface = block.surface || 'front';
                if (!startPointer || !pointer || pointer.surface !== surface) return;
                const context = this.host.getSurfaceGridContext(surface);
                const columnWidth = (
                    context.frontWidth - context.gridModule * context.margins * 2
                    - context.gridModule * (context.columnCount - 1)
                ) / context.columnCount;
                const direction = block.alignment === 'right' ? -1 : 1;
                const delta = direction * (pointer.local.x - startPointer.local.x)
                    / (columnWidth + context.gridModule);
                const maxWidth = block.alignment === 'right'
                    ? block.x
                    : context.columnCount - block.x + 1;
                const width = Math.round(Math.max(0.25, Math.min(maxWidth, startWidth + delta)) * 4) / 4;
                if (Math.abs(width - (block.width || 1)) >= 0.25) {
                    block.width = width;
                    this.host.updateGridThrottled();
                }
            };
            const onUp = () => {
                if (!resizing) return;
                resizing = false;
                handle.setAttribute('fill-opacity', '0');
                cleanup();
                this.host.markAsChanged();
                this.host.historyManager.commitAction(this.host.getStateSnapshot());
            };
            const cleanup = () => {
                this.document.removeEventListener('mousemove', onMove);
                this.document.removeEventListener('mouseup', onUp);
                this.pendingGestureCleanups.delete(cleanup);
            };
            this.pendingGestureCleanups.add(cleanup);
            this.document.addEventListener('mousemove', onMove);
            this.document.addEventListener('mouseup', onUp);
        });
        handle.addEventListener('mouseenter', event => {
            event.stopPropagation();
            if (!resizing) handle.setAttribute('fill-opacity', '0.5');
        });
        handle.addEventListener('mouseleave', event => {
            event.stopPropagation();
            if (!resizing) handle.setAttribute('fill-opacity', '0.2');
        });
    }

    dispose() {
        for (const cleanup of [...this.pendingGestureCleanups]) cleanup();
        return true;
    }
}
