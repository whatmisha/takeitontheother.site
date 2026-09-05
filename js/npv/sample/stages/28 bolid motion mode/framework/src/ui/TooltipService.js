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
        this.tooltipElement = null;
        this.visible = false;
        this._mouseX = 0;
        this._mouseY = 0;
        this._listeners = [];
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

        const onMouseEnter = (e) => {
            const target = e.target.closest?.(TOOLTIP_HOST_SELECTOR);
            if (!target) return;
            const text = getText(target);
            if (text) this.show(text, this._mouseX, this._mouseY);
        };

        const onMouseLeave = (e) => {
            const target = e.target.closest?.(TOOLTIP_HOST_SELECTOR);
            if (target) this.hide();
        };

        const onMouseOver = (e) => {
            const target = e.target.closest?.(TOOLTIP_HOST_SELECTOR);
            if (!target) return;
            const text = getText(target);
            if (text) this.show(text, this._mouseX, this._mouseY);
        };

        const onMouseOut = (e) => {
            const target = e.target;
            const relatedTarget = e.relatedTarget;
            if (target.closest && target.closest(TOOLTIP_HOST_SELECTOR)) {
                const targetEl = target.closest(TOOLTIP_HOST_SELECTOR);
                const relatedEl = relatedTarget?.closest?.(TOOLTIP_HOST_SELECTOR);
                if (targetEl !== relatedEl) this.hide();
            }
        };

        // Attach with options matching the original implementation (capture
        // for enter/leave so they fire reliably for non-bubbling events).
        this._addListener('mousemove', onMouseMove);
        this._addListener('mouseenter', onMouseEnter, true);
        this._addListener('mouseleave', onMouseLeave, true);
        this._addListener('mouseover', onMouseOver);
        this._addListener('mouseout', onMouseOut);
    }

    show(text, x, y) {
        if (!this.tooltipElement) return;
        this.tooltipElement.textContent = text;
        this.visible = true;
        this._position(x, y);
        this.tooltipElement.classList.add('visible');
    }

    hide() {
        if (!this.tooltipElement) return;
        this.visible = false;
        this.tooltipElement.classList.remove('visible');
    }

    destroy() {
        for (const [type, listener, capture] of this._listeners) {
            this.document.removeEventListener(type, listener, capture);
        }
        this._listeners.length = 0;
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
        }
        this.tooltipElement = null;
        this.visible = false;
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

        if (left + rect.width > window.innerWidth) {
            left = x - rect.width - TOOLTIP_OFFSET_PX;
        }
        if (top + rect.height > window.innerHeight) {
            top = y - rect.height - TOOLTIP_OFFSET_PX;
        }
        if (left < 0) left = TOOLTIP_OFFSET_PX;
        if (top < 0) top = TOOLTIP_OFFSET_PX;

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    }
}

