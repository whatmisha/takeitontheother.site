/**
 * ActionDockController keeps bottom actions in one keyboard-accessible group.
 * Tools keep ownership of export/import implementations; the controller only
 * routes canonical shortcuts to declaratively marked buttons and reveals the
 * optional JSON actions.
 */
export class ActionDockController {
    constructor({ ownerDocument = globalThis.document } = {}) {
        this.document = ownerDocument;
        this.bound = false;
        this.handleKeydown = this.handleKeydown.bind(this);
    }

    init() {
        if (!this.document || this.bound) return this;
        this.document.addEventListener('keydown', this.handleKeydown, true);
        this.sync();
        this.bound = true;
        return this;
    }

    destroy() {
        if (!this.document || !this.bound) return;
        this.document.removeEventListener('keydown', this.handleKeydown, true);
        this.bound = false;
    }

    sync() {
        this.document?.querySelectorAll?.('.action-dock').forEach(dock => {
            dock.dataset.actionDockReady = 'true';
            const expanded = dock.dataset.extrasExpanded === 'true';
            this.setExpanded(dock, expanded);
        });
    }

    setExpanded(dock, expanded, { restoreFocus = false } = {}) {
        const extras = [...dock.querySelectorAll('[data-action-dock-extra]')];
        if (!extras.length) return false;
        const focusedExtra = !expanded && extras.includes(this.document.activeElement);
        dock.dataset.extrasExpanded = String(expanded);
        extras.forEach(element => {
            element.hidden = !expanded;
        });
        dock.querySelectorAll('[data-action-dock-extra-toggle]').forEach(toggle => {
            toggle.setAttribute('aria-expanded', String(expanded));
        });
        if (focusedExtra && restoreFocus) {
            const target = dock.querySelector('[data-action-dock-extra-toggle]')
                || dock.querySelector('[data-action-dock-primary-export]');
            target?.focus?.();
        }
        return true;
    }

    toggleExtras({ forceCollapsed = false } = {}) {
        let changed = false;
        this.document.querySelectorAll('.action-dock').forEach(dock => {
            const expanded = dock.dataset.extrasExpanded === 'true';
            if (forceCollapsed && !expanded) return;
            changed = this.setExpanded(dock, forceCollapsed ? false : !expanded, {
                restoreFocus: true
            }) || changed;
        });
        return changed;
    }

    isEditable(target) {
        if (!target) return false;
        return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    }

    enabledAction(selector) {
        return [...this.document.querySelectorAll(selector)].find(element => {
            if (element.disabled) return false;
            if (element.hidden) return true;
            return globalThis.getComputedStyle?.(element).display !== 'none';
        });
    }

    activate(selector) {
        const action = this.enabledAction(selector);
        if (!action) return false;
        action.click();
        return true;
    }

    handleKeydown(event) {
        if (event.repeat || this.isEditable(event.target)) return;
        const key = String(event.key || '').toLowerCase();
        const command = event.metaKey || event.ctrlKey;
        if (event.defaultPrevented && key !== 'escape') return;
        let handled = false;

        if (!command && !event.altKey && !event.shiftKey && key === 'escape') {
            handled = this.toggleExtras({ forceCollapsed: true });
        } else if (!command && !event.altKey && !event.shiftKey && key === 'j') {
            handled = this.toggleExtras();
        } else if (command && !event.altKey && !event.shiftKey && key === 'e') {
            handled = this.activate('[data-action-dock-primary-export]');
        } else if (command && !event.altKey && !event.shiftKey && key === 'j') {
            handled = this.activate('[data-action-dock-json-export]');
        } else if (command && !event.altKey && event.shiftKey && key === 'j') {
            handled = this.activate('[data-action-dock-json-import]');
        }

        if (!handled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}

export function initActionDocks(options) {
    return new ActionDockController(options).init();
}
