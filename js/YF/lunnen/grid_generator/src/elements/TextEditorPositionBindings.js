import { ListenerScope } from '../core/ListenerScope.js';

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
        this.listeners = new ListenerScope();
    }

    init() {
        if (this.bound) return false;
        this.bindHistory();
        this.bindNumericInputs();
        this.bindSurfaceSelection();
        this.bindAlignmentModes();
        this.bindConstraintToggle();
        this.bindAnchorAlignment();
        this.bindTextAlignment();
        this.bound = true;
        return true;
    }

    bindHistory() {
        NUMERIC_INPUTS.forEach(inputId => {
            const input = this.host.dom[inputId];
            this.listeners.listen(input, 'focus', () => this.host.historyManager.beginAction(
                `edit text block ${inputId}`,
                this.host.getStateSnapshot()
            ));
            this.listeners.listen(input, 'blur', () => (
                this.host.historyManager.commitAction(this.host.getStateSnapshot())
            ));
        });
    }

    bindNumericInputs() {
        const { dom } = this.host;
        this.listeners.listen(dom.paragraphXInput, 'change', () => this.actions.applyXInput());
        this.listeners.listen(dom.paragraphXInput, 'keydown', event => this.actions.handleArrow(event, 'x', 'paragraphXInput'));
        this.listeners.listen(dom.paragraphRowInput, 'change', () => this.actions.applyRowInput());
        this.listeners.listen(dom.paragraphRowInput, 'keydown', event => this.actions.handleArrow(event, 'row', 'paragraphRowInput'));
        this.listeners.listen(dom.paragraphBaselineInput, 'change', () => this.actions.applyBaselineInput());
        this.listeners.listen(dom.paragraphBaselineInput, 'keydown', event => this.actions.handleBaselineArrow(event));
        this.listeners.listen(dom.paragraphWidthInput, 'change', () => this.actions.applyWidthInput());
        this.listeners.listen(dom.paragraphWidthInput, 'keydown', event => this.actions.handleArrow(event, 'width', 'paragraphWidthInput'));
    }

    bindSurfaceSelection() {
        const select = this.host.dom.paragraphSurfaceSelect;
        this.listeners.listen(select, 'change', () => this.actions.moveToSurface(select.value));
    }

    bindAlignmentModes() {
        for (const [id, mode] of [
            ['alignmentModeBaseline', 'baseline'],
            ['alignmentModeXHeight', 'x-height'],
            ['alignmentModeCapHeight', 'cap-height']
        ]) {
            const input = this.host.dom[id];
            this.listeners.listen(input, 'change', () => {
                if (input.checked) this.actions.setAlignmentMode(mode);
            });
        }
    }

    bindConstraintToggle() {
        const toggle = this.host.dom.paragraphLockPositionToggle;
        this.listeners.listen(toggle, 'change', () => this.actions.setConstraint(toggle.checked));
    }

    bindAnchorAlignment() {
        const toggle = this.host.dom.paragraphAlignRightToggle;
        this.listeners.listen(toggle, 'change', () => this.actions.setAnchorAlignment(toggle.checked));
    }

    bindTextAlignment() {
        for (const [id, alignment] of [
            ['textAlignmentLeft', 'left'],
            ['textAlignmentCenter', 'center'],
            ['textAlignmentRight', 'right']
        ]) {
            const input = this.host.dom[id];
            this.listeners.listen(input, 'change', () => {
                if (input.checked) this.actions.setTextAlignment(alignment);
            });
        }
    }

    dispose() {
        return this.listeners.dispose();
    }
}
