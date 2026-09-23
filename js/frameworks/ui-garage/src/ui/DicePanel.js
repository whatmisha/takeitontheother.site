/**
 * DicePanel — generic "randomizable parameter" controller (the dice system).
 *
 * Each parameter can be toggled between a fixed value (single slider) and a
 * random range (two-handle range slider). A dice button (◇ off / ◆ on) flips
 * the parameter's boolean flag in Settings and swaps which control is visible.
 * `randomize()` rolls a fresh value for every enabled parameter within its range.
 *
 * The panel is fully config-driven — no tool-specific knowledge lives here.
 *
 * @example
 * const dice = new DicePanel({
 *   settings,
 *   params: [{
 *     key: 'strokeWidth', flag: 'randomStrokeWidth',
 *     diceId: 'strokeWidthDice', singleId: 'strokeWidthSingle', rangeId: 'strokeWidthRange',
 *     min: 1, max: 20, decimals: 0, rangeMinKey: 'strokeWidthMin', rangeMaxKey: 'strokeWidthMax'
 *   }],
 *   onToggle: () => app.syncControls(),
 *   onUpdate: () => app.render()
 * });
 * dice.init();
 */
export class DicePanel {
    /**
     * @param {Object} config
     * @param {import('../core/Settings.js').Settings} config.settings
     * @param {Array<Object>} config.params
     * @param {Function} [config.rng] — returns [0,1); defaults to Math.random
     * @param {Function} [config.onToggle] — called after a dice flips (key)
     * @param {Function} [config.onUpdate] — called after values change
     */
    constructor({ settings, params = [], rng = Math.random, onToggle, onUpdate } = {}) {
        this.settings = settings;
        this.params = params;
        this.rng = rng;
        this.onToggle = onToggle || (() => {});
        this.onUpdate = onUpdate || (() => {});
        this._byKey = new Map(params.map(p => [p.key, p]));
        this._cleanups = [];
    }

    init() {
        for (const cleanup of this._cleanups.splice(0).reverse()) cleanup();
        for (const p of this.params) {
            const dice = p.diceId && document.getElementById(p.diceId);
            if (dice) {
                const listener = () => this.toggle(p.key);
                dice.addEventListener('click', listener);
                this._cleanups.push(() => dice.removeEventListener?.('click', listener));
            }
            this._applyVisibility(p);
            this._syncDice(p);
        }
        return this;
    }

    isActive(key) {
        const p = this._byKey.get(key);
        return p ? !!this.settings.get(p.flag) : false;
    }

    /** @returns {Array<Object>} params currently enabled for randomization. */
    getActiveParams() {
        return this.params.filter(p => this.settings.get(p.flag));
    }

    toggle(key, force) {
        const p = this._byKey.get(key);
        if (!p) return;
        const next = typeof force === 'boolean' ? force : !this.settings.get(p.flag);
        this.settings.set(p.flag, next);
        this._applyVisibility(p);
        this._syncDice(p);
        this.onToggle(key, next);
        this.onUpdate();
    }

    /** Roll fresh values for every enabled parameter. */
    randomize() {
        for (const p of this.getActiveParams()) {
            this._rollParam(p);
        }
        this.onUpdate();
    }

    /** Roll fresh values for a single parameter (if enabled). */
    randomizeOne(key) {
        const p = this._byKey.get(key);
        if (p && this.settings.get(p.flag)) {
            this._rollParam(p);
            this.onUpdate();
        }
    }

    /** Disable randomization for one parameter and restore its visibility. */
    reset(key) {
        this.toggle(key, false);
    }

    /** Disable randomization for all parameters. */
    resetAll() {
        for (const p of this.params) {
            this.settings.set(p.flag, false);
            this._applyVisibility(p);
            this._syncDice(p);
        }
        this.onToggle(null, false);
        this.onUpdate();
    }

    /** Re-read flags from settings and refresh dice + visibility (after preset load). */
    sync() {
        for (const p of this.params) {
            this._applyVisibility(p);
            this._syncDice(p);
        }
    }

    /* -------------------------------- internals -------------------------------- */

    _rollParam(p) {
        const lo = p.rangeMinKey != null ? Number(this.settings.get(p.rangeMinKey)) : p.min;
        const hi = p.rangeMaxKey != null ? Number(this.settings.get(p.rangeMaxKey)) : p.max;
        const min = Math.min(lo, hi);
        const max = Math.max(lo, hi);
        let value = min + this.rng() * (max - min);
        const decimals = p.decimals ?? 0;
        const factor = Math.pow(10, decimals);
        value = Math.round(value * factor) / factor;
        this.settings.set(p.key, value);
    }

    _applyVisibility(p) {
        const active = !!this.settings.get(p.flag);
        const single = p.singleId && document.getElementById(p.singleId);
        const range = p.rangeId && document.getElementById(p.rangeId);
        if (single) single.style.display = active ? 'none' : '';
        if (range) range.style.display = active ? '' : 'none';
        // The single-mode value display (above the track) is hidden in range mode —
        // only the two values below the range track remain.
        const value = p.valueId && document.getElementById(p.valueId);
        if (value) value.style.visibility = active ? 'hidden' : '';
    }

    _syncDice(p) {
        const dice = p.diceId && document.getElementById(p.diceId);
        if (!dice) return;
        const active = !!this.settings.get(p.flag);
        dice.classList.toggle('active', active);
        dice.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (p.label) {
            dice.title = active ? `${p.label}: random on` : `${p.label}: random off`;
        }
    }

    destroy() {
        for (const cleanup of this._cleanups.splice(0).reverse()) cleanup();
    }
}
