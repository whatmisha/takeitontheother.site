/**
 * Cursor-following tooltip service.
 *
 * Owns a single floating tooltip element appended to <body> and the
 * document-level mouse listeners that drive it. Listeners are kept on
 * fields so they can be detached via destroy().
 *
 * Selector convention: any element carrying [data-tooltip] (or
 * [data-tooltip-disabled] for the inactive state) becomes a host.
 */

const TOOLTIP_HOST_SELECTOR = '[data-tooltip], [data-tooltip-disabled]';
const TOOLTIP_OFFSET_PX = 12;

export class TooltipService {
    constructor({ ownerDocument = document } = {}) {
        this.document = ownerDocument;
        this.window = ownerDocument?.defaultView || globalThis.window;
        this.tooltipElement = null;
        this.visible = false;
        this._mouseX = 0;
        this._mouseY = 0;
        this._listeners = [];
        this._pointerHost = null;
        this._focusHost = null;
        this._focusTarget = null;
        this._focusDismissed = false;
        this._describedElement = null;
        this._descriptionAdded = false;
    }

    /**
     * Attach the tooltip element and document listeners.
     * Idempotent — calling twice is a no-op.
     */
    init() {
        if (this.tooltipElement) return;

        const tooltip = this.document.createElement('div');
        tooltip.className = 'cursor-tooltip';
        tooltip.id = 'cursorTooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        this.document.body.appendChild(tooltip);
        this.tooltipElement = tooltip;

        const onMouseMove = (e) => {
            this._mouseX = e.clientX;
            this._mouseY = e.clientY;
            if (this.visible) {
                this._position(this._mouseX, this._mouseY);
            }
        };

        const getText = (target) => {
            const unavailable =
                target.classList.contains('inactive') ||
                target.classList.contains('controls-disabled') ||
                (target.querySelector && target.querySelector('input:disabled'));
            if (unavailable && target.hasAttribute('data-tooltip-disabled')) {
                return target.getAttribute('data-tooltip-disabled');
            }
            return target.getAttribute('data-tooltip') || null;
        };

        const showPointer = (target) => {
            this._pointerHost = target;
            const text = getText(target);
            if (!text) return;
            this._clearDescription();
            this.show(text, this._mouseX, this._mouseY);
        };

        const restoreFocusOrHide = () => {
            if (this._focusHost && !this._focusDismissed) this._showFocusedTooltip(getText);
            else this.hide();
        };

        const onMouseEnter = (e) => {
            const target = e.target.closest?.(TOOLTIP_HOST_SELECTOR);
            if (!target) return;
            showPointer(target);
        };

        const onMouseLeave = (e) => {
            const target = e.target.closest?.(TOOLTIP_HOST_SELECTOR);
            if (!target) return;
            this._pointerHost = null;
            restoreFocusOrHide();
        };

        const onMouseOver = (e) => {
            const target = e.target.closest?.(TOOLTIP_HOST_SELECTOR);
            if (!target) return;
            showPointer(target);
        };

        const onMouseOut = (e) => {
            const target = e.target;
            const relatedTarget = e.relatedTarget;
            if (target.closest && target.closest(TOOLTIP_HOST_SELECTOR)) {
                const targetEl = target.closest(TOOLTIP_HOST_SELECTOR);
                const relatedEl = relatedTarget?.closest?.(TOOLTIP_HOST_SELECTOR);
                if (targetEl !== relatedEl) {
                    this._pointerHost = null;
                    restoreFocusOrHide();
                }
            }
        };

        const onFocusIn = (e) => {
            const host = e.target.closest?.(TOOLTIP_HOST_SELECTOR);
            if (!host) return;
            this._focusHost = host;
            this._focusTarget = e.target;
            this._focusDismissed = false;
            this._pointerHost = null;
            this._showFocusedTooltip(getText);
        };

        const onFocusOut = (e) => {
            const nextHost = e.relatedTarget?.closest?.(TOOLTIP_HOST_SELECTOR) || null;
            if (nextHost && nextHost === this._focusHost) {
                this._focusTarget = e.relatedTarget;
                this._showFocusedTooltip(getText);
                return;
            }
            this._focusHost = null;
            this._focusTarget = null;
            this._focusDismissed = false;
            if (this._pointerHost) showPointer(this._pointerHost);
            else this.hide();
        };

        const onKeyDown = (e) => {
            if (e.key !== 'Escape' || !this._focusHost || !this.visible) return;
            this._focusDismissed = true;
            this._pointerHost = null;
            this.hide();
        };

        // Attach with options matching the original implementation (capture
        // for enter/leave so they fire reliably for non-bubbling events).
        this._addListener('mousemove', onMouseMove);
        this._addListener('mouseenter', onMouseEnter, true);
        this._addListener('mouseleave', onMouseLeave, true);
        this._addListener('mouseover', onMouseOver);
        this._addListener('mouseout', onMouseOut);
        this._addListener('focusin', onFocusIn);
        this._addListener('focusout', onFocusOut);
        this._addListener('keydown', onKeyDown);
    }

    show(text, x, y) {
        if (!this.tooltipElement) return;
        this.tooltipElement.textContent = text;
        this.visible = true;
        this._position(x, y);
        this.tooltipElement.classList.add('visible');
        this.tooltipElement.setAttribute('aria-hidden', 'false');
    }

    hide() {
        if (!this.tooltipElement) return;
        this.visible = false;
        this.tooltipElement.classList.remove('visible');
        this.tooltipElement.setAttribute('aria-hidden', 'true');
        this._clearDescription();
    }

    destroy() {
        this.hide();
        for (const [type, listener, capture] of this._listeners) {
            this.document.removeEventListener(type, listener, capture);
        }
        this._listeners.length = 0;
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
        }
        this.tooltipElement = null;
        this.visible = false;
        this._pointerHost = null;
        this._focusHost = null;
        this._focusTarget = null;
        this._focusDismissed = false;
    }

    _addListener(type, listener, capture = false) {
        this.document.addEventListener(type, listener, capture);
        this._listeners.push([type, listener, capture]);
    }

    _position(x, y) {
        const el = this.tooltipElement;
        if (!el) return;
        const rect = el.getBoundingClientRect();

        let left = x + TOOLTIP_OFFSET_PX;
        let top = y + TOOLTIP_OFFSET_PX;

        const viewportWidth = this.window?.innerWidth || 0;
        const viewportHeight = this.window?.innerHeight || 0;

        if (viewportWidth && left + rect.width > viewportWidth) {
            left = x - rect.width - TOOLTIP_OFFSET_PX;
        }
        if (viewportHeight && top + rect.height > viewportHeight) {
            top = y - rect.height - TOOLTIP_OFFSET_PX;
        }
        if (left < 0) left = TOOLTIP_OFFSET_PX;
        if (top < 0) top = TOOLTIP_OFFSET_PX;

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    }

    _showFocusedTooltip(getText) {
        if (!this._focusHost || !this._focusTarget) return;
        const text = getText(this._focusHost);
        if (!text) {
            this.hide();
            return;
        }
        const rect = this._focusHost.getBoundingClientRect?.();
        const x = rect ? rect.left + rect.width / 2 : this._mouseX;
        const y = rect ? rect.bottom : this._mouseY;
        this._setDescription(this._focusTarget);
        this.show(text, x, y);
    }

    _setDescription(element) {
        this._clearDescription();
        if (!element?.getAttribute || !element?.setAttribute || !this.tooltipElement) return;
        const id = this.tooltipElement.id;
        const tokens = (element.getAttribute('aria-describedby') || '')
            .split(/\s+/u)
            .filter(Boolean);
        this._descriptionAdded = !tokens.includes(id);
        if (this._descriptionAdded) {
            tokens.push(id);
            element.setAttribute('aria-describedby', tokens.join(' '));
        }
        this._describedElement = element;
    }

    _clearDescription() {
        const element = this._describedElement;
        const id = this.tooltipElement?.id;
        if (element && id && this._descriptionAdded) {
            const tokens = (element.getAttribute('aria-describedby') || '')
                .split(/\s+/u)
                .filter(token => token && token !== id);
            if (tokens.length) element.setAttribute('aria-describedby', tokens.join(' '));
            else element.removeAttribute('aria-describedby');
        }
        this._describedElement = null;
        this._descriptionAdded = false;
    }
}
