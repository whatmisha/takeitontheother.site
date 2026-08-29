import { TextEditorPositionBindings } from './TextEditorPositionBindings.js';
import { TextPositionGeometry } from './TextPositionGeometry.js';

/** Coordinates text-position commands while bindings and geometry stay isolated. */
export class TextEditorPositionController {
    constructor(host, { geometry = null, bindings = null } = {}) {
        this.host = host;
        this.geometry = geometry || new TextPositionGeometry(host);
        this.bindings = bindings || new TextEditorPositionBindings(host, this);
    }

    init() { this.bindings.init(); }
    get block() { return this.host.currentEditingBlock; }
    getContext(block = this.block) { return this.geometry.getContext(block); }
    round(value, decimals = 0) { return this.geometry.round(value, decimals); }
    maxBaseline(context) { return this.geometry.maxBaseline(context); }

    markAndRender() {
        this.host.markAsChanged();
        this.host.updateGrid();
    }

    mutate(label, callback, { renderNavigator = false } = {}) {
        if (!this.block) return false;
        this.host.historyManager.beginAction(label, this.host.getStateSnapshot());
        callback(this.block);
        this.host.markAsChanged();
        if (renderNavigator) this.host.objectNavigatorController.render();
        this.host.updateGrid();
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
        return true;
    }

    applyXInput() {
        const block = this.block;
        if (!block) return;
        const parsed = Number.parseInt(this.host.dom.paragraphXInput.value, 10);
        this.geometry.constrainX(block, Number.isFinite(parsed) ? parsed : block.x);
        this.host.dom.paragraphXInput.value = Math.round(block.x);
        this.syncWidthInput(block);
        this.markAndRender();
    }

    applyRowInput() {
        const block = this.block;
        if (!block) return;
        const parsed = Number.parseInt(this.host.dom.paragraphRowInput.value, 10);
        this.geometry.constrainRow(block, (Number.isFinite(parsed) ? parsed : block.row + 1) - 1);
        this.syncVerticalInputs(block);
        this.markAndRender();
    }

    applyBaselineInput() {
        const block = this.block;
        if (!block) return;
        const parsed = Number.parseInt(this.host.dom.paragraphBaselineInput.value, 10);
        this.applyGlobalBaseline(block, (Number.isFinite(parsed) ? parsed : 1) - 1);
        this.markAndRender();
    }

    applyWidthInput() {
        const block = this.block;
        if (!block) return;
        const parsed = Number.parseFloat(this.host.dom.paragraphWidthInput.value);
        this.geometry.constrainWidth(block, Number.isFinite(parsed) ? parsed : block.width);
        this.syncWidthInput(block);
        this.markAndRender();
    }

    handleArrow(event, property, inputId) {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !this.block) return;
        event.preventDefault();
        const block = this.block;
        const baseStep = property === 'width' ? 0.25 : 1;
        const step = event.shiftKey ? (property === 'width' ? 1 : 10) : baseStep;
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        const value = this.round(
            Number(block[property]) || 0,
            this.host.sliderController.getDecimalsFromStep(step)
        ) + step * direction;
        if (property === 'x') {
            this.geometry.constrainX(block, value);
            this.host.dom[inputId].value = block.x;
            this.syncWidthInput(block);
        } else if (property === 'row') {
            this.geometry.constrainRow(block, value);
            this.syncVerticalInputs(block);
        } else if (property === 'width') {
            this.geometry.constrainWidth(block, value);
            this.syncWidthInput(block, inputId);
        }
        this.markAndRender();
    }

    handleBaselineArrow(event) {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !this.block) return;
        event.preventDefault();
        const block = this.block;
        const surface = block.surface || 'front';
        const current = this.host.rowBaselineToY(block.row, block.baselineOffset, surface);
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        this.applyGlobalBaseline(block, current + direction * (event.shiftKey ? 10 : 1));
        this.markAndRender();
    }

    applyGlobalBaseline(block, baseline, context = this.getContext(block)) {
        this.geometry.applyGlobalBaseline(block, baseline, context);
        this.syncVerticalInputs(block);
    }

    syncVerticalInputs(block) {
        const surface = block.surface || 'front';
        if (this.host.dom.paragraphRowInput) this.host.dom.paragraphRowInput.value = block.row + 1;
        if (this.host.dom.paragraphBaselineInput) {
            this.host.dom.paragraphBaselineInput.value = this.host.rowBaselineToY(
                block.row,
                block.baselineOffset,
                surface
            ) + 1;
        }
    }

    syncWidthInput(block, inputId = 'paragraphWidthInput') {
        if (this.host.dom[inputId]) this.host.dom[inputId].value = block.width.toFixed(2);
    }

    moveToSurface(surface) {
        return this.mutate('move text to surface', block => {
            this.host.moveBlockToSurface(block, surface);
        }, { renderNavigator: true });
    }

    setAlignmentMode(mode) {
        return this.mutate(`change text alignment mode to ${mode}`, block => {
            block.alignmentMode = mode;
        });
    }

    setConstraint(locked) {
        return this.mutate('toggle text constraint', block => {
            block.lockPosition = locked;
        });
    }

    setAnchorAlignment(right) {
        return this.mutate('change text anchor alignment', block => {
            this.geometry.switchAnchor(block, right);
            if (this.host.dom.paragraphXInput) this.host.dom.paragraphXInput.value = block.x;
        });
    }

    setTextAlignment(alignment) {
        return this.mutate(`change paragraph alignment to ${alignment}`, block => {
            block.textAlign = alignment;
        });
    }

    bindHistory() { return this.bindings.bindHistory(); }
    bindNumericInputs() { return this.bindings.bindNumericInputs(); }
    bindSurfaceSelection() { return this.bindings.bindSurfaceSelection(); }
    bindAlignmentModes() { return this.bindings.bindAlignmentModes(); }
    bindConstraintToggle() { return this.bindings.bindConstraintToggle(); }
    bindAnchorAlignment() { return this.bindings.bindAnchorAlignment(); }
    bindTextAlignment() { return this.bindings.bindTextAlignment(); }
    dispose() { return this.bindings.dispose?.() ?? false; }
}
