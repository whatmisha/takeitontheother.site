import { ColorUtils } from "../utils/ColorUtils.js";

export class BackgroundColorPicker {
  constructor(controller) {
    this.controller = controller;
    this.hsb = { h: 0, s: 0, b: 2 };
    this.elements = {
      row: document.getElementById("backgroundColorRow"),
      item: document.getElementById("backgroundColorItem"),
      picker: document.getElementById("backgroundColorPicker"),
      preview: document.getElementById("backgroundColorPreview"),
      hex: document.getElementById("backgroundColorHex"),
      hue: document.getElementById("backgroundHueInput"),
      saturation: document.getElementById("backgroundSaturationInput"),
      brightness: document.getElementById("backgroundBrightnessInput"),
      hueValue: document.getElementById("backgroundHueValue"),
      saturationValue: document.getElementById("backgroundSaturationValue"),
      brightnessValue: document.getElementById("backgroundBrightnessValue")
    };
  }

  init() {
    if (!this.elements.hex || !this.elements.picker) return;
    this.bind();
    this.setColor(this.elements.hex.value || "#050505");
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
    this.controller.setBackgroundColor(hex);
  }

  applyHsb() {
    const hex = this.currentHex();
    this.updateUi(hex);
    this.controller.setBackgroundColor(hex);
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
