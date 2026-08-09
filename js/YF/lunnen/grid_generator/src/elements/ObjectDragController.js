/**
 * Canvas pointer interactions for text and graphics objects.
 * The state carries an explicit kind so text-level document handlers cannot
 * accidentally finish a graphics drag.
 */
export class ObjectDragController {
    constructor(host) {
        this.host = host;
    }

    init() {
        document.addEventListener('mousemove', event => {
            if (!this.isDragging('text')) return;
            event.preventDefault();
            this.moveText(event);
        });

        document.addEventListener('mouseup', event => {
            if (!this.isDragging('text')) return;
            event.preventDefault();
            this.endText();
        });
    }

    isDragging(kind) {
        const state = this.host.textDragState;
        return state?.isDragging === true && state.kind === kind;
    }

    attachText(group, block) {
        group.addEventListener('mousedown', event => {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();

            const startedAt = Date.now();
            const startX = event.clientX;
            const startY = event.clientY;
            let moved = false;

            const onMove = moveEvent => {
                const dx = Math.abs(moveEvent.clientX - startX);
                const dy = Math.abs(moveEvent.clientY - startY);
                if (!moved && (dx > 3 || dy > 3)) {
                    moved = true;
                    this.startText(block.id, startX, startY);
                }
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (!moved && Date.now() - startedAt < 300) {
                    this.host.showParagraphPanel(block.id);
                }
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    startText(blockId, clientX, clientY) {
        const block = this.host.getTextBlock(blockId);
        if (!block) return false;

        this.host.historyManager.beginAction('drag text block', this.host.getStateSnapshot());
        this.host.textDragState = {
            kind: 'text',
            isDragging: true,
            blockId,
            startBlockX: block.x,
            startBlockRow: block.row,
            startBlockBaselineOffset: block.baselineOffset,
            pointerOffset: this.host.getBlockPointerOffset(block, clientX, clientY),
            duplicated: false,
            moved: false
        };
        this.setTextBounds(blockId, 0.5, 0.05);
        return true;
    }

    moveText(event) {
        if (!this.isDragging('text')) return false;
        const state = this.host.textDragState;

        if ((event.altKey || event.metaKey) && !state.duplicated) {
            const original = this.host.getTextBlock(state.blockId);
            if (original) {
                const duplicate = this.host.duplicateElement('text', original.id, true);
                if (duplicate) {
                    state.blockId = duplicate.id;
                    state.duplicated = true;
                }
            }
        }

        const block = this.host.getTextBlock(state.blockId);
        if (!block) return false;
        const positioned = this.host.positionBlockAtPointer(
            block,
            event.clientX,
            event.clientY,
            'text',
            state.pointerOffset
        );
        if (!positioned) return false;

        state.moved = true;
        this.host.updateGridThrottled();
        return true;
    }

    endText() {
        if (!this.isDragging('text')) return false;
        const state = this.host.textDragState;
        this.setTextBounds(state.blockId, 0, 0);
        if (state.moved || state.duplicated) this.host.markAsChanged();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        this.resetState();
        this.host.updateGrid();
        return true;
    }

    attachTextResize(handle, block) {
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

                const currentPointer = this.host.getSurfacePointer(moveEvent.clientX, moveEvent.clientY);
                const surface = block.surface || 'front';
                if (!startPointer || !currentPointer || currentPointer.surface !== surface) return;

                const context = this.host.getSurfaceGridContext(surface);
                const columnWidth = (
                    context.frontWidth -
                    context.gridModule * context.margins * 2 -
                    context.gridModule * (context.columnCount - 1)
                ) / context.columnCount;
                const direction = block.alignment === 'right' ? -1 : 1;
                const delta = direction * (
                    currentPointer.local.x - startPointer.local.x
                ) / (columnWidth + context.gridModule);
                const maxWidth = block.alignment === 'right'
                    ? block.x
                    : context.columnCount - block.x + 1;
                const width = Math.round(
                    Math.max(0.25, Math.min(maxWidth, startWidth + delta)) * 4
                ) / 4;

                if (Math.abs(width - (block.width || 1)) >= 0.25) {
                    block.width = width;
                    this.host.updateGridThrottled();
                }
            };

            const onUp = () => {
                if (!resizing) return;
                resizing = false;
                handle.setAttribute('fill-opacity', '0');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                this.host.markAsChanged();
                this.host.historyManager.commitAction(this.host.getStateSnapshot());
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
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

    attachGraphics(group, block) {
        group.addEventListener('mousedown', event => {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();

            const startedAt = Date.now();
            const startX = event.clientX;
            const startY = event.clientY;
            this.startGraphics(block, event.clientX, event.clientY);
            this.setGraphicsBounds(group, 0.5, 0.05);

            const onMove = moveEvent => this.moveGraphics(moveEvent, block);
            const onUp = upEvent => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                this.endGraphics();

                const distance = Math.hypot(
                    upEvent.clientX - startX,
                    upEvent.clientY - startY
                );
                if (Date.now() - startedAt < 300 && distance < 10) {
                    this.host.showGraphicsEditPanel(block.id);
                }
                this.setGraphicsBounds(group, 0, 0);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        group.addEventListener('mouseenter', () => {
            if (!this.host.textDragState.isDragging) {
                this.setGraphicsBounds(group, 0.5, 0.05);
            }
        });
        group.addEventListener('mouseleave', () => {
            if (!this.host.textDragState.isDragging) {
                this.setGraphicsBounds(group, 0, 0);
            }
        });
    }

    startGraphics(block, clientX, clientY) {
        this.host.historyManager.beginAction('drag graphics block', this.host.getStateSnapshot());
        this.host.textDragState = {
            kind: 'graphics',
            isDragging: true,
            blockId: block.id,
            pointerOffset: this.host.getBlockPointerOffset(block, clientX, clientY),
            duplicated: false,
            moved: false
        };
    }

    moveGraphics(event, originalBlock) {
        if (!this.isDragging('graphics')) return false;
        const state = this.host.textDragState;

        if (
            (event.altKey || event.metaKey) &&
            !state.duplicated &&
            state.blockId === originalBlock.id
        ) {
            const type = originalBlock.isBuiltIn ? originalBlock.id : 'graphics';
            const duplicate = this.host.duplicateElement(type, originalBlock.id, true);
            if (duplicate) {
                state.blockId = duplicate.id;
                state.duplicated = true;
            }
        }

        const block = this.host.getGraphicsBlock(state.blockId);
        if (!block) return false;
        const positioned = this.host.positionBlockAtPointer(
            block,
            event.clientX,
            event.clientY,
            'graphics',
            state.pointerOffset
        );
        if (!positioned) return false;

        state.moved = true;
        this.host.updateGridThrottled();
        return true;
    }

    endGraphics() {
        if (!this.isDragging('graphics')) return false;
        const state = this.host.textDragState;
        if (state.moved || state.duplicated) this.host.markAsChanged();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        this.resetState();
        this.host.updateGrid();
        return true;
    }

    resetState() {
        this.host.textDragState = {
            kind: null,
            isDragging: false,
            blockId: null,
            duplicated: false,
            moved: false
        };
    }

    setTextBounds(blockId, stroke, fill) {
        const bounds = document.getElementById(`bounds-${blockId}`);
        if (!bounds) return;
        bounds.setAttribute('stroke-opacity', String(stroke));
        bounds.setAttribute('fill-opacity', String(fill));
    }

    setGraphicsBounds(group, stroke, fill) {
        if (!group.boundsElement) return;
        group.boundsElement.setAttribute('stroke-opacity', String(stroke));
        group.boundsElement.setAttribute('fill-opacity', String(fill));
    }
}
