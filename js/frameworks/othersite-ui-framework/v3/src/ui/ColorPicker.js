/**
 * ColorPicker - HSB Color Picker with gradient control
 * 
 * Standalone version - requires no external dependencies except ColorUtils
 */
import { ColorUtils } from '../utils/ColorUtils.js';

export class ColorPicker {
    /**
     * @param {Object} options - Initialization options
     * @param {string} options.containerId - Container ID for picker
     * @param {string} options.initialColor - Initial color (HEX)
     * @param {Function} options.onChange - Callback on color change
     */
    constructor(options = {}) {
        this.options = {
            containerId: 'colorPickerContainer',
            initialColor: '#808080',
            onChange: null,
            ...options
        };
        
        this.isUpdating = false;
        this.isHexInputFocused = false; // Flag to track focus on HEX input
        
        // HSB values
        this.hsb = { h: 0, s: 0, b: 50 };
        
        // Unique IDs for elements
        this.ids = {};
        
        // DOM elements
        this.elements = {
            container: null,
            picker: null,
            preview: null,
            hexInput: null,
            hueSlider: null,
            saturationSlider: null,
            brightnessSlider: null,
            hueValue: null,
            saturationValue: null,
            brightnessValue: null
        };
    }

    /**
     * Initialize picker
     */
    init() {
        this.elements.container = document.getElementById(this.options.containerId);
        
        if (!this.elements.container) {
            console.error(`ColorPicker: Container #${this.options.containerId} not found`);
            return;
        }

        // Generate unique IDs for sliders and values
        const uniqueId = this.options.containerId.replace(/[^a-zA-Z0-9]/g, '');
        this.ids = {
            hueSlider: `hueSlider_${uniqueId}`,
            saturationSlider: `saturationSlider_${uniqueId}`,
            brightnessSlider: `brightnessSlider_${uniqueId}`,
            hueValue: `hueValue_${uniqueId}`,
            saturationValue: `saturationValue_${uniqueId}`,
            brightnessValue: `brightnessValue_${uniqueId}`
        };

        // Create HTML structure
        this.createHTML();
        
        // Get element references (hex/preview optional — swatch row has its own hex inputs)
        this.elements.picker = this.elements.container.querySelector('.hsb-picker');
        this.elements.preview = this.elements.container.querySelector('.color-preview');
        this.elements.hexInput = this.elements.container.querySelector('.hex-color-input');
        this.elements.inputGroup = this.elements.container.querySelector('.color-input-group');
        this.elements.hueSlider = document.getElementById(this.ids.hueSlider);
        this.elements.saturationSlider = document.getElementById(this.ids.saturationSlider);
        this.elements.brightnessSlider = document.getElementById(this.ids.brightnessSlider);
        this.elements.hueValue = document.getElementById(this.ids.hueValue);
        this.elements.saturationValue = document.getElementById(this.ids.saturationValue);
        this.elements.brightnessValue = document.getElementById(this.ids.brightnessValue);

        // Event handlers
        this.initEventListeners();
        
        // Initialize with initial color
        this.setColorFromHex(this.options.initialColor);
    }

    /**
     * Create picker HTML structure
     */
    createHTML() {
        this.elements.container.innerHTML = `
            <div class="color-picker-wrapper">
                <div class="hsb-picker" style="display: none;">
                    <div class="hsb-controls">
                        <div class="hsb-control-group">
                            <label for="${this.ids.hueSlider}">
                                <span>Hue</span>
                                <input type="text" class="value-display hsb-value" id="${this.ids.hueValue}" value="0°" readonly>
                            </label>
                            <input type="range" id="${this.ids.hueSlider}" min="0" max="360" step="1" value="0">
                        </div>
                        
                        <div class="hsb-control-group">
                            <label for="${this.ids.saturationSlider}">
                                <span>Saturation</span>
                                <input type="text" class="value-display hsb-value" id="${this.ids.saturationValue}" value="0%" readonly>
                            </label>
                            <input type="range" id="${this.ids.saturationSlider}" min="0" max="100" step="1" value="0">
                        </div>
                        
                        <div class="hsb-control-group">
                            <label for="${this.ids.brightnessSlider}">
                                <span>Brightness</span>
                                <input type="text" class="value-display hsb-value" id="${this.ids.brightnessValue}" value="50%" readonly>
                            </label>
                            <input type="range" id="${this.ids.brightnessSlider}" min="0" max="100" step="1" value="50">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Initialize event handlers
     */
    initEventListeners() {
        if (this.elements.preview) {
            this.elements.preview.addEventListener('click', () => this.toggle());
        }

        if (this.elements.hexInput) {
            this.elements.hexInput.addEventListener('input', (e) => {
                this.handleHexInput(e.target.value);
            });
            this.elements.hexInput.addEventListener('focus', () => {
                this.isHexInputFocused = true;
            });
            this.elements.hexInput.addEventListener('blur', () => {
                this.isHexInputFocused = false;
                if (this.elements.hexInput.value) {
                    this.handleHexInput(this.elements.hexInput.value);
                }
            });
        }

        // HSB sliders
        if (this.elements.hueSlider) {
            this.elements.hueSlider.addEventListener('input', (e) => {
                this.hsb.h = parseInt(e.target.value);
                this.updateFromHSB();
            });
        }

        if (this.elements.saturationSlider) {
            this.elements.saturationSlider.addEventListener('input', (e) => {
                this.hsb.s = parseInt(e.target.value);
                this.updateFromHSB();
            });
        }

        if (this.elements.brightnessSlider) {
            this.elements.brightnessSlider.addEventListener('input', (e) => {
                this.hsb.b = parseInt(e.target.value);
                this.updateFromHSB();
            });
        }
    }

    /**
     * Handle HEX color input
     */
    handleHexInput(value) {
        if (this.isUpdating) return;

        // Add # if needed
        if (value && !value.startsWith('#')) {
            value = '#' + value;
        }

        // Validate HEX
        if (/^#[0-9A-F]{6}$/i.test(value)) {
            this.setColorFromHex(value);
        }
    }

    /**
     * Set color from HEX
     * @param {string} hex
     * @param {Object} [options]
     * @param {boolean} [options.silent=false] - When true, skip the onChange
     *   callback. Use this for purely programmatic display updates so they
     *   don't accidentally re-trigger renderer/state changes.
     */
    setColorFromHex(hex, options = {}) {
        this.isUpdating = true;

        const rgb = ColorUtils.hexToRgb(hex);
        if (!rgb) {
            this.isUpdating = false;
            return;
        }

        this.hsb = ColorUtils.rgbToHsb(rgb.r, rgb.g, rgb.b);
        
        // Update UI
        this.updateUI();
        
        // Call callback (skip when called silently — e.g. when syncing the
        // picker to externally changed settings)
        if (!options.silent && this.options.onChange) {
            this.options.onChange(hex);
        }

        this.isUpdating = false;
    }

    /**
     * Update from HSB values
     */
    updateFromHSB() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;

        const rgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, this.hsb.b);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Update UI
        this.updateUI();
        
        // Call callback
        if (this.options.onChange) {
            this.options.onChange(hex);
        }

        this.isUpdating = false;
    }

    /**
     * Update UI elements
     */
    updateUI() {
        const rgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, this.hsb.b);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);

        // HEX input - update only if not focused (to avoid interfering with input)
        if (this.elements.hexInput && !this.isHexInputFocused) {
            this.elements.hexInput.value = hex;
        }

        // Preview
        if (this.elements.preview) {
            this.elements.preview.style.backgroundColor = hex;
        }

        // HSB sliders
        if (this.elements.hueSlider) {
            this.elements.hueSlider.value = this.hsb.h;
        }
        if (this.elements.saturationSlider) {
            this.elements.saturationSlider.value = this.hsb.s;
        }
        if (this.elements.brightnessSlider) {
            this.elements.brightnessSlider.value = this.hsb.b;
        }

        // HSB values
        if (this.elements.hueValue) {
            this.elements.hueValue.value = this.hsb.h + '°';
        }
        if (this.elements.saturationValue) {
            this.elements.saturationValue.value = this.hsb.s + '%';
        }
        if (this.elements.brightnessValue) {
            this.elements.brightnessValue.value = this.hsb.b + '%';
        }

        // Update gradients
        this.updateGradients();
    }

    /**
     * Update slider gradients
     */
    updateGradients() {
        // Hue gradient (always rainbow)
        if (this.elements.hueSlider) {
            this.elements.hueSlider.style.background = 
                'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';
        }

        // Saturation gradient (from gray to pure color)
        if (this.elements.saturationSlider) {
            const baseColorRgb = ColorUtils.hsbToRgb(this.hsb.h, 100, this.hsb.b);
            const baseColor = ColorUtils.rgbToHex(baseColorRgb.r, baseColorRgb.g, baseColorRgb.b);
            const grayRgb = ColorUtils.hsbToRgb(this.hsb.h, 0, this.hsb.b);
            const gray = ColorUtils.rgbToHex(grayRgb.r, grayRgb.g, grayRgb.b);
            
            this.elements.saturationSlider.style.background = 
                `linear-gradient(to right, ${gray}, ${baseColor})`;
        }

        // Brightness gradient (from black to bright color)
        if (this.elements.brightnessSlider) {
            const brightColorRgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, 100);
            const brightColor = ColorUtils.rgbToHex(brightColorRgb.r, brightColorRgb.g, brightColorRgb.b);
            
            this.elements.brightnessSlider.style.background = 
                `linear-gradient(to right, #000000, ${brightColor})`;
        }
    }

    /**
     * Open picker
     */
    open() {
        if (this.elements.picker) {
            this.elements.picker.style.display = 'block';
        }
    }

    /**
     * Close picker
     */
    close() {
        if (this.elements.picker) {
            this.elements.picker.style.display = 'none';
        }
    }

    /**
     * Toggle picker visibility
     */
    toggle() {
        if (this.isOpen()) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Check if picker is open
     */
    isOpen() {
        if (!this.elements.picker) return false;
        return this.elements.picker.style.display !== 'none';
    }

    /**
     * Get current color in HEX
     */
    getColor() {
        const rgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, this.hsb.b);
        return ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    /**
     * Set color programmatically (e.g. when syncing the picker to
     * externally changed settings). Does NOT fire the onChange callback —
     * callers are responsible for any side-effects (settings.set,
     * updateRenderer, markAsChanged).
     */
    setColor(hex) {
        this.setColorFromHex(hex, { silent: true });
    }
}
