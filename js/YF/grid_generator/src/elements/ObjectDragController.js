import { ObjectDragEventBinder } from './ObjectDragEventBinder.js';
import { ObjectDragState } from './ObjectDragState.js';
import { TextResizeController } from './TextResizeController.js';

/** Coordinates object drag commands while binding and state have single owners. */
export class ObjectDragController {
    constructor(host, { state = null, events = null, textResize = null } = {}) {
        this.host = host;
        this.state = state || new ObjectDragState(host);
        this.events = events || new ObjectDragEventBinder(host, this);
        this.textResize = textResize || new TextResizeController(host);
    }

    init() { this.events.init(); }
    isDragging(kind) { return this.state.is(kind); }
    attachText(group, block) { this.events.attachText(group, block); }
    attachGraphics(group, block) { this.events.attachGraphics(group, block); }
    attachTextResize(handle, block) { this.textResize.attach(handle, block); }

    startText(blockId, clientX, clientY) {
        const block = this.host.objectDocument.getTextBlock(blockId);
        if (!block) return false;
        this.host.historyManager.beginAction('drag text block', this.host.getStateSnapshot());
        this.state.start('text', blockId, this.getPointerOffset(block, clientX, clientY), {
            startBlockX: block.x,
            startBlockRow: block.row,
            startBlockBaselineOffset: block.baselineOffset
        });
        this.setTextBounds(blockId, 0.5, 0.05);
        return true;
    }

    moveText(event) {
        if (!this.isDragging('text')) return false;
        const state = this.state.current;
        if ((event.altKey || event.metaKey) && !state.duplicated) {
            const duplicate = this.duplicate('text', state.blockId);
            if (duplicate) this.state.useDuplicate(duplicate.id);
        }
        return this.positionCurrent('text', event.clientX, event.clientY);
    }

    endText() {
        if (!this.isDragging('text')) return false;
        this.setTextBounds(this.state.current.blockId, 0, 0);
        return this.finish();
    }

    startGraphics(block, clientX, clientY) {
        this.host.historyManager.beginAction('drag graphics block', this.host.getStateSnapshot());
        this.state.start('graphics', block.id, this.getPointerOffset(block, clientX, clientY));
        return true;
    }

    moveGraphics(event, originalBlock) {
        if (!this.isDragging('graphics')) return false;
        const state = this.state.current;
        if ((event.altKey || event.metaKey) && !state.duplicated && state.blockId === originalBlock.id) {
            const type = originalBlock.isBuiltIn ? originalBlock.id : 'graphics';
            const duplicate = this.duplicate(type, originalBlock.id);
            if (duplicate) this.state.useDuplicate(duplicate.id);
        }
        return this.positionCurrent('graphics', event.clientX, event.clientY);
    }

    endGraphics() {
        if (!this.isDragging('graphics')) return false;
        return this.finish();
    }

    positionCurrent(kind, clientX, clientY) {
        const state = this.state.current;
        const block = kind === 'text'
            ? this.host.objectDocument.getTextBlock(state.blockId)
            : this.host.objectDocument.getGraphicsBlock(state.blockId);
        if (!block) return false;
        const positioned = this.host.objectPlacementController.positionAtPointer(
            block,
            clientX,
            clientY,
            kind,
            state.pointerOffset
        );
        if (!positioned) return false;
        this.state.markMoved();
        this.host.updateGridThrottled();
        return true;
    }

    duplicate(type, blockId) {
        return this.host.objectNavigatorController.duplicate(type, blockId, true);
    }

    getPointerOffset(block, clientX, clientY) {
        return this.host.objectPlacementController.getPointerOffset(block, clientX, clientY);
    }

    finish() {
        const state = this.state.current;
        if (state.moved || state.duplicated) this.host.markAsChanged();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        this.resetState();
        this.host.updateGrid();
        return true;
    }

    resetState() { this.state.reset(); }

    setTextBounds(blockId, stroke, fill) {
        const bounds = this.events.document.getElementById(`bounds-${blockId}`);
        if (!bounds) return;
        bounds.setAttribute('stroke-opacity', String(stroke));
        bounds.setAttribute('fill-opacity', String(fill));
    }

    setGraphicsBounds(group, stroke, fill) {
        if (!group.boundsElement) return;
        group.boundsElement.setAttribute('stroke-opacity', String(stroke));
        group.boundsElement.setAttribute('fill-opacity', String(fill));
    }

    dispose() {
        this.resetState();
        this.textResize.dispose?.();
        return this.events.dispose?.() ?? false;
    }
}
