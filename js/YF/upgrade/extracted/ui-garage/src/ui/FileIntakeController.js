function normalizeAccept(accept) {
    return String(accept || '')
        .split(',')
        .map(token => token.trim().toLowerCase())
        .filter(Boolean);
}

export function fileMatchesAccept(file, accept = '') {
    const tokens = normalizeAccept(accept);
    if (!file || tokens.length === 0) return Boolean(file);

    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    return tokens.some((token) => {
        if (token.startsWith('.')) return name.endsWith(token);
        if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
        return type === token;
    });
}

function resolveElement(value, ownerDocument) {
    if (!value || typeof value !== 'string') return value || null;
    return ownerDocument?.getElementById?.(value) || null;
}

function isNativeControl(element) {
    return ['BUTTON', 'INPUT', 'LABEL', 'SELECT', 'TEXTAREA', 'A']
        .includes(String(element?.tagName || '').toUpperCase());
}

export class FileIntakeController {
    constructor({
        ownerDocument = globalThis.document,
        root = null,
        input,
        trigger,
        dropzone = null,
        status = null,
        removeButton = null,
        accept = null,
        maxBytes = Infinity,
        initialState = 'empty',
        initialStatus = null,
        loadingText = file => `Loading ${file.name || 'file'}…`,
        typeErrorText = 'Choose a supported file.',
        sizeErrorText = file => `${file.name || 'This file'} is too large.`,
        errorText = () => 'Could not load this file.',
        emptyText = '',
        selectFile = files => files[0] || null,
        onSelect = async () => {},
        onRemove = async () => {},
        onReject = async () => {},
        onError = async () => {}
    } = {}) {
        this.document = ownerDocument;
        this.input = resolveElement(input, ownerDocument);
        this.trigger = resolveElement(trigger, ownerDocument);
        this.dropzone = resolveElement(dropzone, ownerDocument);
        this.status = resolveElement(status, ownerDocument);
        this.removeButton = resolveElement(removeButton, ownerDocument);
        this.root = resolveElement(root, ownerDocument)
            || this.dropzone
            || this.input?.closest?.('.file-intake')
            || null;
        this.accept = accept ?? this.input?.accept ?? '';
        this.maxBytes = Number.isFinite(maxBytes) ? Math.max(0, maxBytes) : Infinity;
        this.state = initialState;
        this.initialStatus = initialStatus;
        this.loadingText = loadingText;
        this.typeErrorText = typeErrorText;
        this.sizeErrorText = sizeErrorText;
        this.errorText = errorText;
        this.emptyText = emptyText;
        this.selectFile = selectFile;
        this.onSelect = onSelect;
        this.onRemove = onRemove;
        this.onReject = onReject;
        this.onError = onError;
        this.currentFile = null;
        this.bound = false;
        this.busy = false;
        this.operationId = 0;
        this.listeners = [];
    }

    init() {
        if (this.bound || !this.input || !this.trigger) return this;
        this.bound = true;

        if (this.accept) this.input.accept = this.accept;
        this._prepareSemantics();
        this._listen(this.trigger, 'click', (event) => {
            if (event.target === this.input) return;
            this.open();
        });
        this._listen(this.input, 'change', (event) => {
            const files = [...(event.target?.files || [])];
            event.target.value = '';
            void this.consume(files, 'picker');
        });

        if (this.dropzone) this._bindDropzone();
        if (this.removeButton) {
            this._listen(this.removeButton, 'click', () => void this.remove());
        }

        this.setState(this.state, {
            text: this.initialStatus,
            preserveText: this.initialStatus === null
        });
        return this;
    }

    open() {
        if (this.busy) return false;
        this.input?.click?.();
        return true;
    }

    validate(file) {
        if (!file) return { ok: false, code: 'empty', message: this.emptyText };
        if (!fileMatchesAccept(file, this.accept)) {
            return { ok: false, code: 'type', message: this.typeErrorText, file };
        }
        if (Number(file.size || 0) > this.maxBytes) {
            return {
                ok: false,
                code: 'size',
                message: typeof this.sizeErrorText === 'function'
                    ? this.sizeErrorText(file, this.maxBytes)
                    : this.sizeErrorText,
                file
            };
        }
        return { ok: true, code: 'accepted', message: '', file };
    }

    async consume(files, source = 'picker') {
        if (this.busy) return { ok: false, code: 'busy' };
        const candidates = [...(files || [])];
        const file = this.selectFile(candidates) || null;
        const validation = this.validate(file);
        if (!validation.ok) {
            if (validation.code !== 'empty') {
                this.setState('error', { text: validation.message });
                await this.onReject(validation, { source, controller: this });
            }
            return validation;
        }

        this.busy = true;
        const operationId = ++this.operationId;
        this.setState('loading', {
            text: typeof this.loadingText === 'function'
                ? this.loadingText(file)
                : this.loadingText
        });
        try {
            const result = await this.onSelect(file, { source, controller: this });
            if (operationId !== this.operationId) {
                return { ok: false, code: 'cancelled', file, result };
            }
            this.currentFile = file;
            const text = typeof result === 'string'
                ? result
                : result?.statusText ?? file.name ?? '';
            this.setState('ready', { text });
            return { ok: true, code: 'accepted', file, result };
        } catch (error) {
            if (operationId !== this.operationId) {
                return { ok: false, code: 'cancelled', file, error };
            }
            const text = typeof this.errorText === 'function'
                ? this.errorText(error, file)
                : this.errorText;
            this.setState('error', { text });
            await this.onError(error, { file, source, controller: this });
            return { ok: false, code: 'error', file, error };
        } finally {
            if (operationId === this.operationId) {
                this.busy = false;
                this._syncBusy();
            }
        }
    }

    async remove() {
        if (this.busy) return false;
        await this.onRemove({ file: this.currentFile, controller: this });
        this.currentFile = null;
        this.setState('empty', { text: this.emptyText });
        return true;
    }

    setState(state, { text = null, preserveText = false } = {}) {
        this.state = state;
        for (const element of [this.root, this.trigger, this.status, this.removeButton]) {
            if (!element) continue;
            if (element.dataset) element.dataset.fileState = state;
            else element.setAttribute?.('data-file-state', state);
        }
        if (this.status && !preserveText && text !== null) this.status.textContent = String(text);
        if (this.status) this.status.setAttribute?.('data-state', state);
        if (this.removeButton && 'hidden' in this.removeButton) {
            this.removeButton.hidden = state === 'empty';
        }
        this._syncBusy();
        return this;
    }

    destroy() {
        for (const [element, type, listener, options] of this.listeners) {
            element.removeEventListener?.(type, listener, options);
        }
        this.listeners.length = 0;
        this.dropzone?.classList?.remove('is-dragover');
        this.bound = false;
        this.operationId += 1;
        this.busy = false;
        if (this.state === 'loading') this.setState('empty', { preserveText: true });
        else this._syncBusy();
    }

    _prepareSemantics() {
        if (this.status) {
            this.status.setAttribute?.('role', 'status');
            this.status.setAttribute?.('aria-live', 'polite');
            this.status.setAttribute?.('aria-atomic', 'true');
            if (this.status.id) {
                const describedBy = new Set(
                    String(this.trigger.getAttribute?.('aria-describedby') || '')
                        .split(/\s+/u)
                        .filter(Boolean)
                );
                describedBy.add(this.status.id);
                this.trigger.setAttribute?.('aria-describedby', [...describedBy].join(' '));
            }
        }
        if (this.input.id) this.trigger.setAttribute?.('aria-controls', this.input.id);
    }

    _bindDropzone() {
        const zone = this.dropzone;
        if (zone === this.trigger && !isNativeControl(zone)) {
            if (!zone.getAttribute?.('role')) zone.setAttribute?.('role', 'button');
            if (!zone.getAttribute?.('tabindex')) zone.setAttribute?.('tabindex', '0');
            this._listen(zone, 'keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                this.open();
            });
        }
        this._listen(zone, 'dragenter', event => this._enterDropzone(event));
        this._listen(zone, 'dragover', event => this._enterDropzone(event));
        this._listen(zone, 'dragleave', (event) => {
            if (event.relatedTarget && zone.contains?.(event.relatedTarget)) return;
            zone.classList?.remove('is-dragover');
        });
        this._listen(zone, 'drop', (event) => {
            event.preventDefault();
            event.stopPropagation?.();
            zone.classList?.remove('is-dragover');
            void this.consume(event.dataTransfer?.files || [], 'drop');
        });
    }

    _enterDropzone(event) {
        event.preventDefault();
        event.stopPropagation?.();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        this.dropzone?.classList?.add('is-dragover');
    }

    _syncBusy() {
        const busy = this.busy || this.state === 'loading';
        this.trigger?.setAttribute?.('aria-busy', String(busy));
        this.root?.setAttribute?.('aria-busy', String(busy));
    }

    _listen(element, type, listener, options = false) {
        if (!element?.addEventListener) return;
        element.addEventListener(type, listener, options);
        this.listeners.push([element, type, listener, options]);
    }
}
