import { ColorUtils } from "../utils/ColorUtils.js";

export class BackgroundColorPicker {
  constructor(controller, options = {}) {
    this.controller = controller;
    this.prefix = options.prefix || "background";
    this.applyColor = options.onChange || ((hex) => this.controller.setBackgroundColor(hex));
    this.initialColor = options.initialColor || "#bbbbbb";
    this.hsb = { h: 0, s: 0, b: 73 };
    this.elements = {
      row: document.getElementById(`${this.prefix}ColorRow`),
      item: document.getElementById(`${this.prefix}ColorItem`),
      picker: document.getElementById(`${this.prefix}ColorPicker`),
      preview: document.getElementById(`${this.prefix}ColorPreview`),
      hex: document.getElementById(`${this.prefix}ColorHex`),
      hue: document.getElementById(`${this.prefix}HueInput`),
      saturation: document.getElementById(`${this.prefix}SaturationInput`),
      brightness: document.getElementById(`${this.prefix}BrightnessInput`),
      hueValue: document.getElementById(`${this.prefix}HueValue`),
      saturationValue: document.getElementById(`${this.prefix}SaturationValue`),
      brightnessValue: document.getElementById(`${this.prefix}BrightnessValue`)
    };
  }

  init() {
    if (!this.elements.hex || !this.elements.picker) return;
    this.bind();
    this.setColor(this.elements.hex.value || this.initialColor);
  }

  bind() {
    this.elements.item.addEventListener("click", (event) => {
      if (event.target === this.elements.hex) return;
      this.toggle();
    });

    this.elements.preview.addEventListener("click", (event) => {
      event.stopPropagation();
      this.toggle();
    });

    this.elements.hex.addEventListener("focus", () => this.open());
    this.elements.hex.addEventListener("input", () => {
      const hex = normalizeHex(this.elements.hex.value);
      if (hex) this.setColor(hex);
    });
    this.elements.hex.addEventListener("blur", () => {
      const hex = normalizeHex(this.elements.hex.value);
      this.setColor(hex || this.currentHex());
    });

    [this.elements.hue, this.elements.saturation, this.elements.brightness].forEach((input) => {
      input.addEventListener("input", () => {
        this.hsb = {
          h: Number(this.elements.hue.value),
          s: Number(this.elements.saturation.value),
          b: Number(this.elements.brightness.value)
        };
        this.applyHsb();
      });
    });

    [
      { value: this.elements.hueValue, range: this.elements.hue, key: "h", min: 0, max: 360, suffix: "°", shiftStep: 10 },
      { value: this.elements.saturationValue, range: this.elements.saturation, key: "s", min: 0, max: 100, suffix: "%", shiftStep: 10 },
      { value: this.elements.brightnessValue, range: this.elements.brightness, key: "b", min: 0, max: 100, suffix: "%", shiftStep: 10 }
    ].forEach((control) => this.bindNumericValue(control));
  }

  bindNumericValue(control) {
    control.value.removeAttribute("readonly");

    const apply = (rawValue) => {
      const next = clampNumber(rawValue, control.min, control.max);
      this.hsb[control.key] = next;
      control.range.value = next;
      control.value.value = `${Math.round(next)}${control.suffix}`;
      this.applyHsb();
      return next;
    };

    control.value.addEventListener("focus", () => {
      control.value.value = String(parseNumber(control.value.value, this.hsb[control.key]));
      control.value.select();
    });

    control.value.addEventListener("blur", () => {
      apply(control.value.value);
    });

    control.value.addEventListener("keydown", (event) => {
      const directionByKey = {
        ArrowUp: 1,
        ArrowRight: 1,
        ArrowDown: -1,
        ArrowLeft: -1
      };
      const direction = directionByKey[event.key];

      if (direction) {
        event.preventDefault();
        const current = parseNumber(control.value.value, this.hsb[control.key]);
        const next = event.shiftKey
          ? snapByStep(current, direction, control.shiftStep)
          : current + direction;
        apply(next);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        control.value.blur();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        control.value.value = `${Math.round(this.hsb[control.key])}${control.suffix}`;
        control.value.blur();
      }
    });
  }

  open() {
    this.elements.picker.hidden = false;
    this.elements.row.classList.add("active");
  }

  close() {
    this.elements.picker.hidden = true;
    this.elements.row.classList.remove("active");
  }

  toggle() {
    if (this.elements.picker.hidden) {
      this.open();
    } else {
      this.close();
    }
  }

  setColor(hex) {
    const rgb = ColorUtils.hexToRgb(hex);
    if (!rgb) return;
    this.hsb = ColorUtils.rgbToHsb(rgb.r, rgb.g, rgb.b);
    this.updateUi(hex.toLowerCase());
    this.applyColor(hex.toLowerCase());
  }

  applyHsb() {
    const hex = this.currentHex();
    this.updateUi(hex);
    this.applyColor(hex);
  }

  currentHex() {
    const rgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, this.hsb.b);
    return ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  updateUi(hex) {
    this.elements.hex.value = hex;
    this.elements.preview.style.backgroundColor = hex;

    this.elements.hue.value = this.hsb.h;
    this.elements.saturation.value = this.hsb.s;
    this.elements.brightness.value = this.hsb.b;
    this.elements.hueValue.value = `${this.hsb.h}°`;
    this.elements.saturationValue.value = `${this.hsb.s}%`;
    this.elements.brightnessValue.value = `${this.hsb.b}%`;

    this.elements.hue.style.background = "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";

    const saturatedRgb = ColorUtils.hsbToRgb(this.hsb.h, 100, this.hsb.b);
    const grayRgb = ColorUtils.hsbToRgb(this.hsb.h, 0, this.hsb.b);
    this.elements.saturation.style.background = `linear-gradient(to right, ${ColorUtils.rgbToHex(grayRgb.r, grayRgb.g, grayRgb.b)}, ${ColorUtils.rgbToHex(saturatedRgb.r, saturatedRgb.g, saturatedRgb.b)})`;

    const brightRgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, 100);
    this.elements.brightness.style.background = `linear-gradient(to right, #000000, ${ColorUtils.rgbToHex(brightRgb.r, brightRgb.g, brightRgb.b)})`;
  }
}

function normalizeHex(value) {
  const raw = String(value).trim();
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : "";
}

function parseNumber(value, fallback) {
  const numeric = Number.parseFloat(String(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, parseNumber(value, min)));
}

function snapByStep(value, direction, step) {
  return direction > 0
    ? Math.ceil((value + 1) / step) * step
    : Math.floor((value - 1) / step) * step;
}
