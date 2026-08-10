/** Owns surface-aware text position, bounds and alignment controls. */
export class TextEditorPositionController {
    constructor(host) {
        this.host = host;
    }

    init() {
        this.bindHistory();
        this.bindNumericInputs();
        this.bindSurfaceSelection();
        this.bindAlignmentModes();
        this.bindConstraintToggle();
        this.bindAnchorAlignment();
        this.bindTextAlignment();
    }

    get block() {
        return this.host.currentEditingBlock;
    }

    getContext(block = this.block) {
        return this.host.getSurfaceGridContext(block?.surface || 'front');
    }

    round(value, decimals = 0) {
        return decimals > 0
            ? Number.parseFloat(value.toFixed(decimals))
            : Math.round(value);
    }

    maxBaseline(context) {
        const contentHeight = context.frontHeight
            - 2 * context.margins * context.gridModule;
        return Math.max(
            0,
            Math.floor(contentHeight / context.gridModule + 1e-9) - 1
        );
    }

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

    bindHistory() {
        for (const inputId of [
            'paragraphXInput',
            'paragraphRowInput',
            'paragraphBaselineInput',
            'paragraphWidthInput'
        ]) {
            const input = this.host.dom[inputId];
            input?.addEventListener('focus', () => {
                this.host.historyManager.beginAction(
                    `edit text block ${inputId}`,
                    this.host.getStateSnapshot()
                );
            });
            input?.addEventListener('blur', () => {
                this.host.historyManager.commitAction(this.host.getStateSnapshot());
            });
        }
    }

    bindNumericInputs() {
        const { dom } = this.host;
        dom.paragraphXInput?.addEventListener('change', () => this.applyXInput());
        dom.paragraphXInput?.addEventListener('keydown', event => (
            this.handleArrow(event, 'x', 'paragraphXInput')
        ));
        dom.paragraphRowInput?.addEventListener('change', () => this.applyRowInput());
        dom.paragraphRowInput?.addEventListener('keydown', event => (
            this.handleArrow(event, 'row', 'paragraphRowInput')
        ));
        dom.paragraphBaselineInput?.addEventListener('change', () => (
            this.applyBaselineInput()
        ));
        dom.paragraphBaselineInput?.addEventListener('keydown', event => (
            this.handleBaselineArrow(event)
        ));
        dom.paragraphWidthInput?.addEventListener('change', () => this.applyWidthInput());
        dom.paragraphWidthInput?.addEventListener('keydown', event => (
            this.handleArrow(event, 'width', 'paragraphWidthInput')
        ));
    }

    applyXInput() {
        const block = this.block;
        if (!block) return;
        const context = this.getContext(block);
        const parsed = Number.parseInt(this.host.dom.paragraphXInput.value, 10);
        let x = Number.isFinite(parsed) ? parsed : block.x;
        const alignment = block.alignment || 'left';
        x = alignment === 'right'
            ? Math.max(Math.ceil(block.width), Math.min(x, context.columnCount))
            : Math.max(1, Math.min(x, context.columnCount));
        block.x = x;

        const maxWidth = alignment === 'right'
            ? block.x
            : context.columnCount - block.x + 1;
        if (block.width > maxWidth) {
            block.width = Math.max(0.25, maxWidth);
            this.host.dom.paragraphWidthInput.value = block.width.toFixed(2);
        }
        this.host.dom.paragraphXInput.value = Math.round(block.x);
        this.markAndRender();
    }

    applyRowInput() {
        const block = this.block;
        if (!block) return;
        const context = this.getContext(block);
        const parsed = Number.parseInt(this.host.dom.paragraphRowInput.value, 10);
        const requestedRow = (Number.isFinite(parsed) ? parsed : block.row + 1) - 1;
        const y = requestedRow * (context.rowHeight + 1);
        const constrainedY = Math.max(0, Math.min(y, this.maxBaseline(context)));
        block.row = Math.floor(constrainedY / (context.rowHeight + 1));
        block.baselineOffset = 0;
        this.syncVerticalInputs(block);
        this.markAndRender();
    }

    applyBaselineInput() {
        const block = this.block;
        if (!block) return;
        const context = this.getContext(block);
        const parsed = Number.parseInt(this.host.dom.paragraphBaselineInput.value, 10);
        const baseline = (Number.isFinite(parsed) ? parsed : 1) - 1;
        this.applyGlobalBaseline(block, baseline, context);
        this.markAndRender();
    }

    applyWidthInput() {
        const block = this.block;
        if (!block) return;
        const context = this.getContext(block);
        const parsed = Number.parseFloat(this.host.dom.paragraphWidthInput.value);
        const requested = Number.isFinite(parsed) ? parsed : block.width;
        const rounded = Math.round(requested * 4) / 4;
        const maxWidth = (block.alignment || 'left') === 'right'
            ? block.x
            : context.columnCount - block.x + 1;
        block.width = Math.max(0.25, Math.min(rounded, maxWidth));
        this.host.dom.paragraphWidthInput.value = block.width.toFixed(2);
        this.markAndRender();
    }

    handleArrow(event, property, inputId) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        const block = this.block;
        if (!block) return;

        event.preventDefault();
        const context = this.getContext(block);
        const baseStep = property === 'width' ? 0.25 : 1;
        const step = event.shiftKey ? (property === 'width' ? 1 : 10) : baseStep;
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        const current = Number(block[property]) || 0;
        let value = this.round(
            current,
            this.host.sliderController.getDecimalsFromStep(step)
        ) + step * direction;

        if (property === 'x') {
            value = Math.max(1, Math.min(value, context.columnCount));
            if ((block.alignment || 'left') === 'right') {
                value = Math.max(Math.ceil(block.width), value);
            }
            block.x = value;
            this.host.dom[inputId].value = value;
            const maxWidth = (block.alignment || 'left') === 'right'
                ? block.x
                : context.columnCount - block.x + 1;
            if (block.width > maxWidth) {
                block.width = Math.max(0.25, maxWidth);
                this.host.dom.paragraphWidthInput.value = block.width.toFixed(2);
            }
        } else if (property === 'row') {
            const y = value * (context.rowHeight + 1);
            const constrainedY = Math.max(0, Math.min(y, this.maxBaseline(context)));
            block.row = Math.floor(constrainedY / (context.rowHeight + 1));
            block.baselineOffset = 0;
            this.syncVerticalInputs(block);
        } else if (property === 'width') {
            value = Math.round(value * 4) / 4;
            const maxWidth = (block.alignment || 'left') === 'right'
                ? block.x
                : context.columnCount - block.x + 1;
            block.width = Math.max(0.25, Math.min(value, maxWidth));
            this.host.dom[inputId].value = block.width.toFixed(2);
        }

        this.markAndRender();
    }

    handleBaselineArrow(event) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        const block = this.block;
        if (!block) return;
        event.preventDefault();

        const surface = block.surface || 'front';
        const context = this.getContext(block);
        const current = this.host.rowBaselineToY(
            block.row,
            block.baselineOffset,
            surface
        );
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        const step = event.shiftKey ? 10 : 1;
        this.applyGlobalBaseline(block, current + direction * step, context);
        this.markAndRender();
    }

    applyGlobalBaseline(block, baseline, context = this.getContext(block)) {
        const surface = block.surface || 'front';
        const constrained = Math.max(0, Math.min(baseline, this.maxBaseline(context)));
        const position = this.host.yToRowBaseline(constrained, surface);
        block.row = Math.max(0, position.row);
        block.baselineOffset = position.baselineOffset;
        this.syncVerticalInputs(block);
    }

    syncVerticalInputs(block) {
        const surface = block.surface || 'front';
        if (this.host.dom.paragraphRowInput) {
            this.host.dom.paragraphRowInput.value = block.row + 1;
        }
        if (this.host.dom.paragraphBaselineInput) {
            this.host.dom.paragraphBaselineInput.value = this.host.rowBaselineToY(
                block.row,
                block.baselineOffset,
                surface
            ) + 1;
        }
    }

    bindSurfaceSelection() {
        const select = this.host.dom.paragraphSurfaceSelect;
        select?.addEventListener('change', () => {
            this.mutate('move text to surface', block => {
                this.host.moveBlockToSurface(block, select.value);
            }, { renderNavigator: true });
        });
    }

    bindAlignmentModes() {
        for (const [id, mode] of [
            ['alignmentModeBaseline', 'baseline'],
            ['alignmentModeXHeight', 'x-height'],
            ['alignmentModeCapHeight', 'cap-height']
        ]) {
            const input = this.host.dom[id];
            input?.addEventListener('change', () => {
                if (!input.checked) return;
                this.mutate(`change text alignment mode to ${mode}`, block => {
                    block.alignmentMode = mode;
                });
            });
        }
    }

    bindConstraintToggle() {
        const toggle = this.host.dom.paragraphLockPositionToggle;
        toggle?.addEventListener('change', () => {
            this.mutate('toggle text constraint', block => {
                block.lockPosition = toggle.checked;
            });
        });
    }

    bindAnchorAlignment() {
        const toggle = this.host.dom.paragraphAlignRightToggle;
        toggle?.addEventListener('change', () => {
            this.mutate('change text anchor alignment', block => {
                const wasRight = block.alignment === 'right';
                const nowRight = toggle.checked;
                if (nowRight === wasRight) return;
                const delta = Math.max(0, Math.ceil(block.width) - 1);
                block.x = nowRight
                    ? Math.min(this.getContext(block).columnCount, block.x + delta)
                    : Math.max(1, block.x - delta);
                block.alignment = nowRight ? 'right' : 'left';
                if (this.host.dom.paragraphXInput) {
                    this.host.dom.paragraphXInput.value = block.x;
                }
            });
        });
    }

    bindTextAlignment() {
        for (const [id, alignment] of [
            ['textAlignmentLeft', 'left'],
            ['textAlignmentCenter', 'center'],
            ['textAlignmentRight', 'right']
        ]) {
            const input = this.host.dom[id];
            input?.addEventListener('change', () => {
                if (!input.checked) return;
                this.mutate(`change paragraph alignment to ${alignment}`, block => {
                    block.textAlign = alignment;
                });
            });
        }
    }
}
