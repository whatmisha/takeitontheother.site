/** Explicit operation feedback. Availability (disabled) is not an operation. */
export class ExportFeedbackController {
    constructor({ button, status = null, ownerWindow = globalThis.window } = {}) {
        if (!button) throw new TypeError('An export button is required.');
        this.button = button;
        this.status = status;
        this.window = ownerWindow;
        this.pending = null;
        this.timer = null;
        this.revision = 0;
        this.destroyed = false;
        this.originalBusy = button.getAttribute('aria-busy');
        button.dataset.exportFeedback = 'explicit';
    }

    clearTimer() {
        if (this.timer != null) this.window.clearTimeout(this.timer);
        this.timer = null;
    }

    setState(state, error) {
        if (state) {
            this.button.dataset.exportFeedbackState = state;
            this.button.dataset.exportFeedbackMessage = {
                working: 'Exporting…', success: 'Done', error: 'Failed'
            }[state];
        } else {
            delete this.button.dataset.exportFeedbackState;
        }
        if (state === 'working') this.button.setAttribute('aria-busy', 'true');
        else if (this.originalBusy == null) this.button.removeAttribute('aria-busy');
        else this.button.setAttribute('aria-busy', this.originalBusy);
        if (this.status && state) {
            this.status.textContent = state === 'working' ? 'Exporting…'
                : state === 'success' ? 'Export complete.'
                    : `Export failed.${error?.message ? ` ${error.message}` : ''}`;
        }
    }

    run(operation) {
        // Join repeated gestures during an operation; allow immediate retry afterwards.
        if (this.pending) return this.pending;
        if (this.destroyed || this.button.disabled) return Promise.resolve({ status: 'unavailable' });
        if (typeof operation !== 'function') throw new TypeError('An export operation is required.');
        this.clearTimer();
        const revision = ++this.revision;
        this.setState('working');
        const finish = (state, error) => {
            if (this.destroyed || revision !== this.revision) return;
            this.setState(state, error);
            this.timer = this.window.setTimeout(() => {
                if (!this.destroyed && revision === this.revision) this.setState(null);
                this.timer = null;
            }, state === 'error' ? 2200 : 620);
        };
        const pending = Promise.resolve().then(operation).then(value => {
            finish('success');
            return { status: 'success', value };
        }, error => {
            finish('error', error);
            return { status: 'error', error };
        }).finally(() => {
            if (this.pending === pending) this.pending = null;
        });
        this.pending = pending;
        return pending;
    }

    destroy() {
        this.destroyed = true;
        this.revision++;
        this.clearTimer();
        this.setState(null);
        if (this.status) this.status.textContent = '';
    }
}
