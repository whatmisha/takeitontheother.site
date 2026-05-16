export class ColorUtils {
  static hexToRgb(hex) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return null;
    return {
      r: Number.parseInt(match[1], 16),
      g: Number.parseInt(match[2], 16),
      b: Number.parseInt(match[3], 16)
    };
  }

  static rgbToHex(r, g, b) {
    return `#${[r, g, b].map((value) => {
      const hex = Math.round(value).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    }).join("")}`;
  }

  static rgbToHsb(r, g, b) {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let hue = 0;

    if (delta !== 0) {
      if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
      if (max === green) hue = ((blue - red) / delta + 2) / 6;
      if (max === blue) hue = ((red - green) / delta + 4) / 6;
    }

    return {
      h: Math.round(hue * 360),
      s: Math.round((max === 0 ? 0 : delta / max) * 100),
      b: Math.round(max * 100)
    };
  }

  static hsbToRgb(h, s, b) {
    const hue = h / 360;
    const saturation = s / 100;
    const brightness = b / 100;
    let red;
    let green;
    let blue;

    if (saturation === 0) {
      red = brightness;
      green = brightness;
      blue = brightness;
    } else {
      const sector = Math.floor(hue * 6);
      const fraction = hue * 6 - sector;
      const p = brightness * (1 - saturation);
      const q = brightness * (1 - fraction * saturation);
      const t = brightness * (1 - (1 - fraction) * saturation);

      switch (sector % 6) {
        case 0:
          red = brightness; green = t; blue = p;
          break;
        case 1:
          red = q; green = brightness; blue = p;
          break;
        case 2:
          red = p; green = brightness; blue = t;
          break;
        case 3:
          red = p; green = q; blue = brightness;
          break;
        case 4:
          red = t; green = p; blue = brightness;
          break;
        default:
          red = brightness; green = p; blue = q;
      }
    }

    return {
      r: red * 255,
      g: green * 255,
      b: blue * 255
    };
  }
}
