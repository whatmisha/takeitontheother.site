/**
 * Color utilities
 * Conversion between formats: HEX, RGB, HSB
 */
export class ColorUtils {
    /**
     * Convert HEX to RGB
     * @param {string} hex - color in #RRGGBB format
     * @returns {{r: number, g: number, b: number}|null}
     */
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Convert RGB to HEX
     * @param {number} r - red (0-255)
     * @param {number} g - green (0-255)
     * @param {number} b - blue (0-255)
     * @returns {string} - color in #RRGGBB format
     */
    static rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Convert RGB to HSB (Hue, Saturation, Brightness)
     * @param {number} r - red (0-255)
     * @param {number} g - green (0-255)
     * @param {number} b - blue (0-255)
     * @returns {{h: number, s: number, b: number}} - HSB (h: 0-360, s: 0-100, b: 0-100)
     */
    static rgbToHsb(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let h = 0;
        let s = max === 0 ? 0 : delta / max;
        let v = max;
        
        if (delta !== 0) {
            if (max === r) {
                h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
            } else if (max === g) {
                h = ((b - r) / delta + 2) / 6;
            } else {
                h = ((r - g) / delta + 4) / 6;
            }
        }
        
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            b: Math.round(v * 100)
        };
    }

    /**
     * Convert HSB to RGB
     * @param {number} h - hue (0-360)
     * @param {number} s - saturation (0-100)
     * @param {number} b - brightness (0-100)
     * @returns {{r: number, g: number, b: number}} - RGB (0-255)
     */
    static hsbToRgb(h, s, b) {
        h = h / 360;
        s = s / 100;
        b = b / 100;
        
        let r, g, bl;
        
        if (s === 0) {
            r = g = bl = b;
        } else {
            const i = Math.floor(h * 6);
            const f = h * 6 - i;
            const p = b * (1 - s);
            const q = b * (1 - f * s);
            const t = b * (1 - (1 - f) * s);
            
            switch (i % 6) {
                case 0: r = b; g = t; bl = p; break;
                case 1: r = q; g = b; bl = p; break;
                case 2: r = p; g = b; bl = t; break;
                case 3: r = p; g = q; bl = b; break;
                case 4: r = t; g = p; bl = b; break;
                case 5: r = b; g = p; bl = q; break;
            }
        }
        
        return {
            r: r * 255,
            g: g * 255,
            b: bl * 255
        };
    }

    /**
     * Calculate relative color luminance (WCAG)
     * @param {string} hex - color in #RRGGBB format
     * @returns {number} - luminance (0-1)
     */
    static getLuminance(hex) {
        const rgb = this.hexToRgb(hex.replace('#', ''));
        if (!rgb) return 0.5;
        
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        
        // Convert to linear RGB
        const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        const rLinear = toLinear(r);
        const gLinear = toLinear(g);
        const bLinear = toLinear(b);
        
        // Relative luminance
        return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
    }

    /**
     * Get contrasting color for grid
     * @param {string} bgColor - background color in #RRGGBB format
     * @returns {string} - black or white color for maximum contrast
     */
    static getContrastColor(bgColor) {
        const luminance = this.getLuminance(bgColor);
        
        // For medium gray backgrounds (around 0.4-0.6), use darker color for better visibility
        // This ensures grid is visible on medium gray backgrounds like #adadad
        if (luminance >= 0.4 && luminance <= 0.6) {
            // Medium gray - use black for better contrast
            return '#000000';
        }
        
        // Return black for light backgrounds, white for dark backgrounds
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    /**
     * Calculate opacity for grid
     * @param {number} luminance - background luminance (0-1) - not used, kept for compatibility
     * @param {number} baseOpacity - base opacity
     * @returns {number} - always returns base opacity
     */
    static getGridOpacity(luminance, baseOpacity) {
        // Always use the same opacity regardless of background brightness
        // Color switching (light/dark) is handled by getContrastColor()
        return baseOpacity;
    }

    /**
     * Desaturate: perceived luminance in sRGB space → gray #rrggbb
     * @param {string} hex
     * @returns {string}
     */
    static toGrayscaleHex(hex) {
        if (!hex || typeof hex !== 'string') return '#808080';
        const s = hex.trim();
        const normalized = s.startsWith('#') ? s : `#${s}`;
        const rgb = this.hexToRgb(normalized);
        if (!rgb) return normalized;
        const y = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
        return this.rgbToHex(y, y, y);
    }
}

