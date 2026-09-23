/** Renders non-blocking application errors in one accessible live region. */
export class ErrorPresenter {
    constructor({ documentRef = globalThis.document, timeoutMs = 7000 } = {}) {
        this.document = documentRef;
        this.timeoutMs = timeoutMs;
        this.timer = null;
        this.element = null;
    }

    ensureElement() {
        if (this.element?.isConnected) return this.element;
        const element = this.document?.createElement?.('div');
        if (!element) return null;
        element.className = 'app-notification app-notification-error';
        element.setAttribute('role', 'alert');
        element.setAttribute('aria-live', 'assertive');
        element.hidden = true;
        this.document.body?.appendChild(element);
        this.element = element;
        return element;
    }

    show(error, { title = 'Error', timeoutMs = this.timeoutMs } = {}) {
        const element = this.ensureElement();
        if (!element) return false;
        const message = error instanceof Error ? error.message : String(error || 'Unknown error');
        element.replaceChildren();
        const heading = this.document.createElement('strong');
        heading.textContent = title;
        const detail = this.document.createElement('span');
        detail.textContent = message;
        element.append(heading, detail);
        element.hidden = false;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.clear(), timeoutMs);
        return true;
    }

    clear() {
        clearTimeout(this.timer);
        this.timer = null;
        if (this.element) this.element.hidden = true;
    }

    dispose() {
        this.clear();
        this.element?.remove();
        this.element = null;
        return true;
    }
}
