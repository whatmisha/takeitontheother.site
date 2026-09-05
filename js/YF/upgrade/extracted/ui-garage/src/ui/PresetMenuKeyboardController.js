/**
 * Adds one keyboard contract to existing preset dropdowns without owning their
 * data, rendering or selection callbacks.
 */
export class PresetMenuKeyboardController {
    constructor({ ownerDocument = globalThis.document } = {}) {
        this.document = ownerDocument;
        this.bound = false;
        this.focusTimer = null;
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
        clearTimeout(this.focusTimer);
        this.focusTimer = null;
        this.bound = false;
    }

    sync() {
        this.document?.querySelectorAll?.('[aria-haspopup="listbox"][aria-controls]').forEach(toggle => {
            const menu = this.menuFor(toggle);
            if (!menu) return;
            toggle.dataset.presetKeyboardReady = 'true';
            this.items(menu).forEach(item => {
                item.tabIndex = -1;
                item.setAttribute('aria-selected', String(item.classList.contains('selected')));
            });
        });
    }

    menuFor(toggle) {
        const id = toggle?.getAttribute?.('aria-controls');
        return id ? this.document.getElementById(id) : null;
    }

    items(menu) {
        return [...(menu?.querySelectorAll?.('[role="option"]:not([aria-disabled="true"])') || [])];
    }

    open(toggle, menu) {
        if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
        toggle.setAttribute('aria-expanded', 'true');
        menu.classList.add('active');
    }

    close(toggle, menu, { restoreFocus = true } = {}) {
        if (toggle.getAttribute('aria-expanded') === 'true') toggle.click();
        toggle.setAttribute('aria-expanded', 'false');
        menu.classList.remove('active');
        if (restoreFocus) toggle.focus();
    }

    focusItem(items, index) {
        if (!items.length) return false;
        items[(index + items.length) % items.length].focus();
        return true;
    }

    finish(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    handleToggleKeydown(event, toggle) {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const menu = this.menuFor(toggle);
        const items = this.items(menu);
        if (!menu || !items.length) return;
        this.open(toggle, menu);
        const selected = items.findIndex(item => item.classList.contains('selected'));
        let index = selected >= 0 ? selected : 0;
        if (event.key === 'ArrowUp' || event.key === 'End') index = items.length - 1;
        if (event.key === 'Home' || event.key === 'ArrowDown') index = selected >= 0 ? selected : 0;
        this.focusItem(items, index);
        // Some application dropdowns complete their own click lifecycle after
        // the shared capture handler. Reassert focus once that lifecycle has
        // settled so the first Arrow key enters the list, not the second one.
        clearTimeout(this.focusTimer);
        this.focusTimer = setTimeout(() => {
            this.focusTimer = null;
            if (toggle.getAttribute('aria-expanded') === 'true') {
                this.focusItem(this.items(menu), index);
            }
        }, 0);
        this.finish(event);
    }

    handleOptionKeydown(event, option) {
        const menu = option.closest('[role="listbox"]');
        const toggle = menu?.id
            ? this.document.querySelector(`[aria-haspopup="listbox"][aria-controls="${menu.id}"]`)
            : null;
        if (!menu || !toggle) return;
        const items = this.items(menu);
        const current = items.indexOf(option);
        if (current < 0) return;

        if (event.key === 'Escape') {
            this.close(toggle, menu);
        } else if (event.key === 'ArrowDown') {
            this.focusItem(items, current + 1);
        } else if (event.key === 'ArrowUp') {
            this.focusItem(items, current - 1);
        } else if (event.key === 'Home') {
            this.focusItem(items, 0);
        } else if (event.key === 'End') {
            this.focusItem(items, items.length - 1);
        } else if (event.key === 'Enter' || event.key === ' ') {
            option.click();
            this.close(toggle, menu);
        } else {
            return;
        }
        this.finish(event);
    }

    handleKeydown(event) {
        if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
        const target = event.target;
        if (target?.matches?.('[aria-haspopup="listbox"][aria-controls]')) {
            this.handleToggleKeydown(event, target);
            return;
        }
        const option = target?.closest?.('[role="option"]');
        if (option) this.handleOptionKeydown(event, option);
    }
}

export function initPresetMenuKeyboards(options) {
    return new PresetMenuKeyboardController(options).init();
}
