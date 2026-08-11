const NUMERIC_INPUTS = [
    'paragraphXInput',
    'paragraphRowInput',
    'paragraphBaselineInput',
    'paragraphWidthInput'
];

/** Owns editor DOM event wiring and forwards semantic actions. */
export class TextEditorPositionBindings {
    constructor(host, actions) {
        this.host = host;
        this.actions = actions;
        this.bound = false;
    }

    init() {
        if (this.bound) return;
        this.bindHistory();
        this.bindNumericInputs();
        this.bindSurfaceSelection();
        this.bindAlignmentModes();
        this.bindConstraintToggle();
        this.bindAnchorAlignment();
        this.bindTextAlignment();
        this.bound = true;
    }

    bindHistory() {
        NUMERIC_INPUTS.forEach(inputId => {
            const input = this.host.dom[inputId];
            input?.addEventListener('focus', () => this.host.historyManager.beginAction(
                `edit text block ${inputId}`,
                this.host.getStateSnapshot()
            ));
            input?.addEventListener('blur', () => (
                this.host.historyManager.commitAction(this.host.getStateSnapshot())
            ));
        });
    }

    bindNumericInputs() {
        const { dom } = this.host;
        dom.paragraphXInput?.addEventListener('change', () => this.actions.applyXInput());
        dom.paragraphXInput?.addEventListener('keydown', event => this.actions.handleArrow(event, 'x', 'paragraphXInput'));
        dom.paragraphRowInput?.addEventListener('change', () => this.actions.applyRowInput());
        dom.paragraphRowInput?.addEventListener('keydown', event => this.actions.handleArrow(event, 'row', 'paragraphRowInput'));
        dom.paragraphBaselineInput?.addEventListener('change', () => this.actions.applyBaselineInput());
        dom.paragraphBaselineInput?.addEventListener('keydown', event => this.actions.handleBaselineArrow(event));
        dom.paragraphWidthInput?.addEventListener('change', () => this.actions.applyWidthInput());
        dom.paragraphWidthInput?.addEventListener('keydown', event => this.actions.handleArrow(event, 'width', 'paragraphWidthInput'));
    }

    bindSurfaceSelection() {
        const select = this.host.dom.paragraphSurfaceSelect;
        select?.addEventListener('change', () => this.actions.moveToSurface(select.value));
    }

    bindAlignmentModes() {
        for (const [id, mode] of [
            ['alignmentModeBaseline', 'baseline'],
            ['alignmentModeXHeight', 'x-height'],
            ['alignmentModeCapHeight', 'cap-height']
        ]) {
            const input = this.host.dom[id];
            input?.addEventListener('change', () => {
                if (input.checked) this.actions.setAlignmentMode(mode);
            });
        }
    }

    bindConstraintToggle() {
        const toggle = this.host.dom.paragraphLockPositionToggle;
        toggle?.addEventListener('change', () => this.actions.setConstraint(toggle.checked));
    }

    bindAnchorAlignment() {
        const toggle = this.host.dom.paragraphAlignRightToggle;
        toggle?.addEventListener('change', () => this.actions.setAnchorAlignment(toggle.checked));
    }

    bindTextAlignment() {
        for (const [id, alignment] of [
            ['textAlignmentLeft', 'left'],
            ['textAlignmentCenter', 'center'],
            ['textAlignmentRight', 'right']
        ]) {
            const input = this.host.dom[id];
            input?.addEventListener('change', () => {
                if (input.checked) this.actions.setTextAlignment(alignment);
            });
        }
    }
}
