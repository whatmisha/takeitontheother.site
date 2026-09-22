import { ColorUtils } from '../framework/FrameworkAdapter.js';
import { ListenerScope } from '../core/ListenerScope.js';

const DEFAULT_COLOR = '#dadde6';
const LUNNEN_BLUE = '#2353DB';

export class ColorPanelController {
    constructor({
        settings,
        dom,
        documentRef = document,
        beginAction = () => {},
        commitAction = () => {},
        markChanged = () => {},
        render = () => {}
    }) {
        this.settings = settings;
        this.dom = dom;
        this.document = documentRef;
        this.beginAction = beginAction;
        this.commitAction = commitAction;
        this.markChanged = markChanged;
        this.render = render;
        this.listeners = new ListenerScope();
        this.bound = false;
    }

    bind() {
        if (this.bound) return false;
        this.bound = true;
        this.listeners.listen(this.dom.colorPreview, 'click', () => this.togglePicker());
        this.listeners.listen(this.dom.lunnenBlue, 'click', () => this.applyPreset(LUNNEN_BLUE));

        const input = this.dom.hexColorInput;
        if (!input) return;

        this.listeners.listen(input, 'focus', () => this.beginAction('edit hex color'));
        this.listeners.listen(input, 'input', event => this.formatHexInput(event.target));
        this.listeners.listen(input, 'keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            input.blur();
        });
        this.listeners.listen(input, 'blur', event => this.commitHexInput(event.target));
        return true;
    }

    initialize() {
        this.sync(this.settings.get('boxColor'));
    }

    sync(hex) {
        if (!hex) return;
        if (this.dom.colorPreview) this.dom.colorPreview.style.backgroundColor = hex;
        if (this.dom.hexColorInput) this.dom.hexColorInput.value = hex;
        this.updateHsbFromHex(hex);
    }

    togglePicker() {
        const picker = this.dom.hsbPicker;
        if (!picker) return;

        const isVisible = picker.style.display !== 'none';
        picker.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) this.updateHsbFromHex(this.settings.get('boxColor'));
    }

    applyPreset(hex) {
        this.beginAction('apply Lunnen Blue color');
        this.markChanged();
        this.settings.set('boxColor', hex);
        this.sync(hex);
        this.render();
        this.commitAction();
    }

    formatHexInput(input) {
        const value = input.value.replace(/#/g, '');
        input.value = value ? `#${value}` : '';
    }

    commitHexInput(input) {
        const currentColor = this.settings.get('boxColor');
        const hex = /^#[0-9A-Fa-f]{6}$/.test(input.value)
            ? input.value
            : (currentColor || DEFAULT_COLOR);

        if (hex !== currentColor) this.markChanged();
        this.settings.set('boxColor', hex);
        this.sync(hex);
        this.render();
        this.commitAction();
    }

    handleHsbSlider(channel) {
        this.updateColorFromHsb();
        if (channel === 'hue' || channel === 'brightness') {
            this.updateSaturationGradient();
        }
        if (channel === 'hue' || channel === 'saturation') {
            this.updateBrightnessGradient();
        }
    }

    updateHsbFromHex(hex) {
        const rgb = ColorUtils.hexToRgb(hex);
        if (!rgb) return;

        const hsb = ColorUtils.rgbToHsb(rgb.r, rgb.g, rgb.b);
        this.setControlValue('hueSlider', 'hueValue', hsb.h);
        this.setControlValue('saturationSlider', 'saturationValue', hsb.s);
        this.setControlValue('brightnessSlider', 'brightnessValue', hsb.b);
        this.updateSaturationGradient();
        this.updateBrightnessGradient();
    }

    setControlValue(sliderKey, valueKey, value) {
        if (this.dom[sliderKey]) this.dom[sliderKey].value = value;
        if (this.dom[valueKey]) this.dom[valueKey].value = value;
    }

    updateColorFromHsb() {
        this.markChanged();
        const hue = Number.parseInt(this.dom.hueSlider?.value || '0');
        const saturation = Number.parseInt(this.dom.saturationSlider?.value || '0');
        const brightness = Number.parseInt(this.dom.brightnessSlider?.value || '0');
        const rgb = ColorUtils.hsbToRgb(hue, saturation, brightness);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);

        this.settings.set('boxColor', hex);
        if (this.dom.hexColorInput) this.dom.hexColorInput.value = hex;
        if (this.dom.colorPreview) this.dom.colorPreview.style.backgroundColor = hex;
        this.render();
    }

    updateSaturationGradient() {
        const hue = Number.parseInt(this.dom.hueSlider?.value || '0');
        const brightness = Number.parseInt(this.dom.brightnessSlider?.value || '0');
        const left = ColorUtils.hsbToRgb(hue, 0, brightness);
        const right = ColorUtils.hsbToRgb(hue, 100, brightness);

        this.updateTrackGradient(
            'saturationSlider',
            `linear-gradient(to right, ${ColorUtils.rgbToHex(left.r, left.g, left.b)}, ${ColorUtils.rgbToHex(right.r, right.g, right.b)})`
        );
    }

    updateBrightnessGradient() {
        const hue = Number.parseInt(this.dom.hueSlider?.value || '0');
        const saturation = Number.parseInt(this.dom.saturationSlider?.value || '0');
        const left = ColorUtils.hsbToRgb(hue, saturation, 0);
        const right = ColorUtils.hsbToRgb(hue, saturation, 100);

        this.updateTrackGradient(
            'brightnessSlider',
            `linear-gradient(to right, ${ColorUtils.rgbToHex(left.r, left.g, left.b)}, ${ColorUtils.rgbToHex(right.r, right.g, right.b)})`
        );
    }

    updateTrackGradient(sliderId, gradient) {
        const styleId = `${sliderId}-wide-track-style`;
        this.document.getElementById(styleId)?.remove();

        const style = this.document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #${sliderId}::-webkit-slider-runnable-track {
                background: ${gradient} !important;
                height: 10px !important;
            }
            #${sliderId}::-moz-range-track {
                background: ${gradient} !important;
                height: 10px !important;
            }
            #${sliderId}::-webkit-slider-thumb {
                width: 8px !important;
                height: 8px !important;
                margin-top: 1px !important;
            }
            #${sliderId}::-moz-range-thumb {
                width: 8px !important;
                height: 8px !important;
            }
        `;
        this.document.head.appendChild(style);
    }

    dispose() {
        this.document.getElementById('saturationSlider-wide-track-style')?.remove();
        this.document.getElementById('brightnessSlider-wide-track-style')?.remove();
        return this.listeners.dispose();
    }
}
