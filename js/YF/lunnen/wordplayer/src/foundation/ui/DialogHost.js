/**
 * DialogHost — generic native `<dialog>` host with a Promise-based API.
 *
 * Provides the reusable primitives (show / close / confirm / prompt / alert)
 * extracted from the original tool's ModalManager. App-specific dialogs
 * (e.g. preset prompts) should be built on top of these, not baked in here.
 *
 * Required markup (IDs are configurable):
 *   <dialog id="dialog" class="modal">
 *     <div class="modal-content">
 *       <h2 id="dialogTitle"></h2>
 *       <div id="dialogText"></div>
 *       <input id="dialogInput" class="modal-input" />
 *       <div id="dialogButtons" class="modal-buttons"></div>
 *     </div>
 *   </dialog>
 */
export class DialogHost {
    /**
     * @param {Object} [ids]
     * @param {string} [ids.dialog='dialog']
     * @param {string} [ids.title='dialogTitle']
     * @param {string} [ids.text='dialogText']
     * @param {string} [ids.input='dialogInput']
     * @param {string} [ids.buttons='dialogButtons']
     */
    constructor(ids = {}) {
        const id = {
            dialog: 'dialog',
            title: 'dialogTitle',
            text: 'dialogText',
            input: 'dialogInput',
            buttons: 'dialogButtons',
            ...ids
        };
        this.modal = document.getElementById(id.dialog);
        this.titleEl = document.getElementById(id.title);
        this.textEl = document.getElementById(id.text);
        this.inputEl = document.getElementById(id.input);
        this.buttonsEl = document.getElementById(id.buttons);
        this.resolvePromise = null;

        if (!this.modal) {
            console.warn(`DialogHost: <dialog id="${id.dialog}"> not found.`);
            return;
        }

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close('cancel');
        });
        this.modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.close('cancel');
            }
        });
    }

    /**
     * Show a dialog with arbitrary content and buttons.
     * @param {Object} options
     * @param {string} [options.title]
     * @param {string} [options.text]
     * @param {boolean} [options.html] — treat text as HTML
     * @param {boolean} [options.showInput]
     * @param {string} [options.inputValue]
     * @param {string} [options.inputPlaceholder]
     * @param {Array<{id:string,text:string,type?:string}>} [options.buttons]
     * @returns {Promise<{action:string, inputValue?:string}>}
     */
    show(options = {}) {
        if (!this.modal) return Promise.resolve({ action: 'cancel' });
        const {
            title = '',
            text = '',
            html = false,
            showInput = false,
            inputValue = '',
            inputPlaceholder = '',
            buttons = []
        } = options;

        if (this.titleEl) this.titleEl.textContent = title;
        if (this.textEl) {
            if (html) this.textEl.innerHTML = text;
            else this.textEl.textContent = text;
        }

        if (this.inputEl) {
            if (showInput) {
                this.inputEl.style.display = 'block';
                this.inputEl.value = inputValue;
                this.inputEl.placeholder = inputPlaceholder;
            } else {
                this.inputEl.style.display = 'none';
            }
        }

        if (this.buttonsEl) {
            this.buttonsEl.innerHTML = '';
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = `modal-btn modal-btn-${btn.type || 'secondary'}`;
                button.textContent = btn.text;
                button.addEventListener('click', () => this.close(btn.id));
                this.buttonsEl.appendChild(button);
            });
        }

        this.modal.showModal();

        if (showInput && this.inputEl) {
            this.inputEl.focus();
            this.inputEl.select();
        } else if (this.buttonsEl && this.buttonsEl.firstChild) {
            this.buttonsEl.firstChild.focus();
        }

        return new Promise(resolve => { this.resolvePromise = resolve; });
    }

    close(action) {
        if (!this.modal) return;
        this.modal.close();
        if (this.buttonsEl) {
            this.buttonsEl.style.display = '';
            this.buttonsEl.style.justifyContent = '';
            this.buttonsEl.style.alignItems = '';
            this.buttonsEl.style.gap = '';
        }
        if (this.resolvePromise) {
            this.resolvePromise({
                action,
                inputValue: this.inputEl ? this.inputEl.value.trim() : ''
            });
            this.resolvePromise = null;
        }
    }

    /* ------------------------------ sugar helpers ------------------------------ */

    /**
     * @returns {Promise<boolean>}
     */
    async confirm({ title = 'Are you sure?', text = '', confirmText = 'OK', cancelText = 'Cancel', danger = false } = {}) {
        const result = await this.show({
            title, text,
            buttons: [
                { id: 'ok', text: confirmText, type: danger ? 'danger' : 'primary' },
                { id: 'cancel', text: cancelText, type: 'ghost' }
            ]
        });
        return result.action === 'ok';
    }

    /**
     * @returns {Promise<string|null>} entered value, or null if cancelled/empty
     */
    async prompt({ title = '', text = '', value = '', placeholder = '', confirmText = 'OK', cancelText = 'Cancel' } = {}) {
        const result = await this.show({
            title, text,
            showInput: true, inputValue: value, inputPlaceholder: placeholder,
            buttons: [
                { id: 'ok', text: confirmText, type: 'primary' },
                { id: 'cancel', text: cancelText, type: 'ghost' }
            ]
        });
        return result.action === 'ok' && result.inputValue ? result.inputValue : null;
    }

    async alert({ title = '', text = '', okText = 'OK' } = {}) {
        await this.show({ title, text, buttons: [{ id: 'ok', text: okText, type: 'primary' }] });
    }
}
