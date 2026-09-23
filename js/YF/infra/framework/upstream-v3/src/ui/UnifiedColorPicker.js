/**
 * UnifiedColorPicker
 *
 * A single HSB picker shared across several colour swatch rows. Only one row is
 * expanded at a time: clicking a row docks the shared picker into that row's
 * `.color-hsb-slot` and highlights it; clicking the active row again collapses
 * it. Each row also carries its own hex `<input>`.
 *
 * This is the generic, tool-agnostic colour UI extracted from the Void project
 * (its `ColorController`), minus all palette/gradient/random specifics. Drive it
 * with a `swatches` array describing the DOM ids of each row.
 *
 * Expected per-swatch DOM (ids are configurable):
 *
 *   <div class="color-swatch-row">
 *     <div class="color-swatch-compact" id="{itemId}" data-color-type="{type}">
 *       <button class="color-dot color-dot--expandable" id="{dotId}"></button>
 *       <span class="color-label">{label}</span>
 *       <input class="color-swatch-hex" id="{hexId}">
 *     </div>
 *     <div class="color-hsb-slot" id="{hsbSlotId}"></div>
 *   </div>
 *
 * One row's slot should contain the shared picker container
 * (`<div id="{containerId}"></div>`); it is moved between slots on demand.
 */
import { ColorPicker } from './ColorPicker.js';
import { ColorUtils } from '../utils/ColorUtils.js';

export class UnifiedColorPicker {
    /**
     * @param {Object} options
     * @param {Object} options.settings - reactive settings store
     * @param {string} [options.containerId='unifiedColorPickerContainer']
     * @param {Array<Object>} options.swatches - { type, setting, itemId, dotId, hexId, hsbSlotId, label }
     * @param {Function} [options.onChange] - (type, hex) called after any change
     */
    constructor({ settings, containerId = 'unifiedColorPickerContainer', swatches = [], onChange = null } = {}) {
        this.settings = settings;
        this.containerId = containerId;
        this.swatches = swatches;
        this.onChange = onChange;
        this.activeType = null;
        this.picker = null;
        this._byType = new Map();
        for (const s of swatches) this._byType.set(s.type, s);
    }

    init() {
        for (const s of this.swatches) {
            this.updateSwatchDisplay(s.type, this.settings.get(s.setting));
        }

        const first = this.swatches[0];
        this.picker = new ColorPicker({
            containerId: this.containerId,
            initialColor: first ? this.settings.get(first.setting) : '#808080',
            onChange: (hex) => {
                const s = this._byType.get(this.activeType);
                if (!s) return;
                this.settings.set(s.setting, hex);
                this.updateSwatchDisplay(s.type, hex);
                if (this.onChange) this.onChange(s.type, hex);
            }
        });
        this.picker.init();

        for (const s of this.swatches) {
            const toggle = () => this._toggle(s.type);

            const dot = document.getElementById(s.dotId);
            if (dot) {
                dot.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle();
                });
            }

            const item = document.getElementById(s.itemId);
            if (item) {
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.color-swatch-hex')) return;
                    e.preventDefault();
                    toggle();
                });
            }

            const hex = document.getElementById(s.hexId);
            if (hex && hex.tagName === 'INPUT') {
                hex.addEventListener('click', (e) => e.stopPropagation());
                hex.addEventListener('keydown', (e) => e.stopPropagation());
                hex.addEventListener('blur', () => {
                    if (!this._applyHex(s.type, hex.value)) {
                        hex.value = this.settings.get(s.setting);
                    }
                });
            }

            // Keep swatch + active picker in sync when the setting changes elsewhere.
            this.settings.subscribe?.(s.setting, (value) => {
                this.updateSwatchDisplay(s.type, value);
                if (this.activeType === s.type && this.picker && this.picker.getColor() !== value) {
                    this.picker.setColor(value);
                }
            });
        }

        // Pre-select the first row but keep the picker collapsed.
        this.activeType = first ? first.type : null;
        if (this.activeType) this.picker.setColor(this.settings.get(this._byType.get(this.activeType).setting));
        this._highlight(null);
    }

    _toggle(type) {
        const pickerEl = this.picker?.elements?.picker;
        const isOpen = this.activeType === type && pickerEl && pickerEl.style.display !== 'none';
        if (isOpen) {
            this.picker.close();
            this._highlight(null);
            return;
        }
        this.activeType = type;
        this._dock(type);
        this.picker.setColor(this.settings.get(this._byType.get(type).setting));
        this.picker.open();
        this._highlight(type);
    }

    _dock(type) {
        const s = this._byType.get(type);
        if (!s?.hsbSlotId) return;
        const slot = document.getElementById(s.hsbSlotId);
        const container = document.getElementById(this.containerId);
        if (slot && container && container.parentElement !== slot) {
            slot.appendChild(container);
        }
    }

    _highlight(activeType) {
        for (const s of this.swatches) {
            const item = document.getElementById(s.itemId);
            if (!item) continue;
            item.classList.toggle('active', s.type === activeType);
            const row = item.closest('.color-swatch-row');
            if (row) row.classList.toggle('active', s.type === activeType);
        }
    }

    _applyHex(type, raw) {
        const s = this._byType.get(type);
        if (!s) return false;
        let v = (raw || '').trim();
        if (v && !v.startsWith('#')) v = '#' + v;
        if (!/^#[0-9A-F]{6}$/i.test(v)) return false;
        const hex = v.toLowerCase();
        if (!ColorUtils.hexToRgb(hex)) return false;
        this.settings.set(s.setting, hex);
        this.updateSwatchDisplay(type, hex);
        if (this.activeType === type && this.picker) this.picker.setColor(hex);
        if (this.onChange) this.onChange(type, hex);
        return true;
    }

    /** Update a single swatch dot + hex input from a colour. */
    updateSwatchDisplay(type, color) {
        const s = this._byType.get(type);
        if (!s) return;
        const dot = document.getElementById(s.dotId);
        const hexEl = document.getElementById(s.hexId);
        if (dot) dot.style.background = color;
        if (hexEl) {
            if (hexEl.tagName === 'INPUT') hexEl.value = color;
            else hexEl.textContent = color;
        }
    }

    /** Re-sync all swatches + the active picker from settings (presets / undo). */
    sync() {
        for (const s of this.swatches) {
            this.updateSwatchDisplay(s.type, this.settings.get(s.setting));
        }
        if (this.activeType && this.picker) {
            this.picker.setColor(this.settings.get(this._byType.get(this.activeType).setting));
        }
    }
}
