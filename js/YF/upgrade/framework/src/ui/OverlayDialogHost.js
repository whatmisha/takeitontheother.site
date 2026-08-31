/**
 * Lifecycle host for an existing non-native modal overlay.
 *
 * The application keeps ownership of markup, copy and presentation. This host
 * only coordinates open/close state, Escape/backdrop dismissal, focus, Tab
 * containment and reversible body scroll locking.
 */
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

export class OverlayDialogHost {
    constructor({
        ownerDocument = globalThis.document,
        overlay = null,
        overlayId = 'modalOverlay',
        closeButton = null,
        closeButtonId = 'modalClose',
        trigger = null,
        triggerId = 'helpButton',
        content = null,
        contentSelector = '[role="dialog"], .modal-content',
        activeClass = 'active',
        lockBodyScroll = true
    } = {}) {
        this.document = ownerDocument;
        this.overlay = overlay || this.document?.getElementById(overlayId) || null;
        this.closeButton = closeButton || this.document?.getElementById(closeButtonId) || null;
        this.trigger = trigger || this.document?.getElementById(triggerId) || null;
        this.content = content || this.overlay?.querySelector?.(contentSelector) || null;
        this.activeClass = activeClass;
        this.lockBodyScroll = lockBodyScroll;
        this.previousActiveElement = null;
        this.previousBodyOverflow = '';
        this.scrollLocked = false;
        this.initialized = false;
        this._listeners = [];
    }

    init() {
        if (this.initialized || !this.overlay) return this;
        this.initialized = true;

        this.content?.setAttribute?.('role', 'dialog');
        this.content?.setAttribute?.('aria-modal', 'true');
        this.trigger?.setAttribute?.('aria-haspopup', 'dialog');
        if (this.overlay.id) this.trigger?.setAttribute?.('aria-controls', this.overlay.id);
        this.trigger?.setAttribute?.('aria-expanded', String(this.isOpen()));

        this._addListener(this.trigger, 'click', () => this.open());
        this._addListener(this.closeButton, 'click', () => this.close());
        this._addListener(this.overlay, 'click', (event) => {
            if (event.target === this.overlay) this.close();
        });
        this._addListener(this.document, 'keydown', (event) => {
            if (!this.isOpen()) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
                return;
            }
            if (event.key === 'Tab') this._containFocus(event);
        });
        return this;
    }

    isOpen() {
        return Boolean(this.overlay?.classList?.contains(this.activeClass));
    }

    open() {
        if (!this.overlay) return false;
        if (this.isOpen()) return true;

        const activeElement = this.document?.activeElement;
        this.previousActiveElement = activeElement && activeElement !== this.document?.body
            ? activeElement
            : this.trigger;
        if (this.lockBodyScroll && this.document?.body) {
            this.previousBodyOverflow = this.document.body.style.overflow;
            this.document.body.style.overflow = 'hidden';
            this.scrollLocked = true;
        }

        this.overlay.classList.add(this.activeClass);
        this.overlay.setAttribute?.('aria-hidden', 'false');
        this.trigger?.setAttribute?.('aria-expanded', 'true');
        this._focusableElements()[0]?.focus?.();
        return true;
    }

    close() {
        if (!this.overlay) return false;
        const wasOpen = this.isOpen();
        this.overlay.classList.remove(this.activeClass);
        this.overlay.setAttribute?.('aria-hidden', 'true');
        this.trigger?.setAttribute?.('aria-expanded', 'false');

        if (this.scrollLocked && this.document?.body) {
            this.document.body.style.overflow = this.previousBodyOverflow;
            this.scrollLocked = false;
        }

        const focusTarget = this.previousActiveElement || this.trigger;
        this.previousActiveElement = null;
        if (wasOpen && focusTarget?.isConnected !== false) focusTarget?.focus?.();
        return wasOpen;
    }

    destroy() {
        if (this.isOpen()) this.close();
        for (const [target, type, listener] of this._listeners) {
            target?.removeEventListener?.(type, listener);
        }
        this._listeners.length = 0;
        this.previousActiveElement = null;
        this.initialized = false;
    }

    _addListener(target, type, listener) {
        if (!target?.addEventListener) return;
        target.addEventListener(type, listener);
        this._listeners.push([target, type, listener]);
    }

    _focusableElements() {
        if (!this.content?.querySelectorAll) return this.closeButton ? [this.closeButton] : [];
        return Array.from(this.content.querySelectorAll(FOCUSABLE_SELECTOR)).filter(element => (
            !element.disabled
            && !element.hidden
            && element.getAttribute?.('aria-hidden') !== 'true'
            && element.getAttribute?.('tabindex') !== '-1'
        ));
    }

    _containFocus(event) {
        const focusable = this._focusableElements();
        if (!focusable.length) {
            event.preventDefault();
            this.content?.focus?.();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = this.document?.activeElement;
        if (event.shiftKey && (active === first || !focusable.includes(active))) {
            event.preventDefault();
            last.focus?.();
        } else if (!event.shiftKey && (active === last || !focusable.includes(active))) {
            event.preventDefault();
            first.focus?.();
        }
    }
}
