/**
 * ShortcutRouter — declarative keyboard-shortcut registry.
 *
 * Shortcuts are described as strings like "mod+z", "mod+shift+z", "mod+e",
 * "shift+?", where `mod` means Cmd on macOS and Ctrl elsewhere. Handlers run on
 * keydown; returning nothing (or a truthy value) prevents the default action by
 * default — pass `{ preventDefault: false }` to opt out.
 *
 * By default, shortcuts do NOT fire while typing in an input/textarea/select or
 * contenteditable element (override per-binding with `allowInInput: true`).
 */
export class ShortcutRouter {
    constructor({ target = document } = {}) {
        this.target = target;
        this.bindings = [];
        this._onKeyDown = this._handle.bind(this);
        this.enabled = true;
    }

    /**
     * @param {string} combo — e.g. "mod+z", "mod+shift+z", "escape"
     * @param {(e:KeyboardEvent)=>void} handler
     * @param {Object} [opts]
     * @param {boolean} [opts.preventDefault=true]
     * @param {boolean} [opts.allowInInput=false]
     * @returns {()=>void} unregister
     */
    register(combo, handler, opts = {}) {
        const parsed = ShortcutRouter.parse(combo);
        const binding = { ...parsed, handler, opts };
        this.bindings.push(binding);
        return () => {
            this.bindings = this.bindings.filter(b => b !== binding);
        };
    }

    /** Register multiple bindings from a map { combo: handler }. */
    registerAll(map, opts = {}) {
        const offs = Object.entries(map).map(([combo, handler]) => this.register(combo, handler, opts));
        return () => offs.forEach(off => off());
    }

    init() {
        this.target.addEventListener('keydown', this._onKeyDown);
        return this;
    }

    destroy() {
        this.target.removeEventListener('keydown', this._onKeyDown);
        this.bindings.length = 0;
    }

    static parse(combo) {
        const parts = String(combo).toLowerCase().split('+').map(s => s.trim());
        const spec = { mod: false, shift: false, alt: false, key: '' };
        for (const p of parts) {
            if (p === 'mod' || p === 'cmd' || p === 'ctrl' || p === 'meta') spec.mod = true;
            else if (p === 'shift') spec.shift = true;
            else if (p === 'alt' || p === 'option') spec.alt = true;
            else spec.key = p;
        }
        return spec;
    }

    _isEditable(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    _handle(e) {
        if (!this.enabled) return;
        const mod = e.metaKey || e.ctrlKey;
        const key = (e.key || '').toLowerCase();
        for (const b of this.bindings) {
            if (b.mod !== mod) continue;
            if (b.shift !== e.shiftKey) continue;
            if (b.alt !== e.altKey) continue;
            // Normalise '=' / '+' and 'esc'
            const wanted = b.key === 'plus' ? '+' : b.key === 'esc' ? 'escape' : b.key;
            const matches = key === wanted ||
                (wanted === '+' && (key === '+' || key === '='));
            if (!matches) continue;
            if (!b.opts.allowInInput && this._isEditable(e.target)) continue;
            if (b.opts.preventDefault !== false) e.preventDefault();
            b.handler(e);
            return;
        }
    }
}
