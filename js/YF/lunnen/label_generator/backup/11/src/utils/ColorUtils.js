/**
 * Утилиты для работы с цветами
 * Конвертация между форматами: HEX, RGB, HSB
 */
export class ColorUtils {
    /**
     * Конвертация HEX в RGB
     * @param {string} hex - цвет в формате #RRGGBB
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
     * Конвертация RGB в HEX
     * @param {number} r - красный (0-255)
     * @param {number} g - зеленый (0-255)
     * @param {number} b - синий (0-255)
     * @returns {string} - цвет в формате #RRGGBB
     */
    static rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Конвертация RGB в HSB (Hue, Saturation, Brightness)
     * @param {number} r - красный (0-255)
     * @param {number} g - зеленый (0-255)
     * @param {number} b - синий (0-255)
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
     * Конвертация HSB в RGB
     * @param {number} h - оттенок (0-360)
     * @param {number} s - насыщенность (0-100)
     * @param {number} b - яркость (0-100)
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
     * Рассчитать относительную светимость цвета (WCAG)
     * @param {string} hex - цвет в формате #RRGGBB
     * @returns {number} - светимость (0-1)
     */
    static getLuminance(hex) {
        const rgb = this.hexToRgb(hex.replace('#', ''));
        if (!rgb) return 0.5;
        
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        
        // Конвертация в линейный RGB
        const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        const rLinear = toLinear(r);
        const gLinear = toLinear(g);
        const bLinear = toLinear(b);
        
        // Относительная светимость
        return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
    }

    /**
     * Получить контрастный цвет для сетки
     * @param {string} bgColor - цвет фона в формате #RRGGBB
     * @returns {string} - черный или белый цвет для максимального контраста
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
     * Вычислить прозрачность для сетки
     * @param {number} luminance - светимость фона (0-1) - не используется, оставлен для совместимости
     * @param {number} baseOpacity - базовая прозрачность
     * @returns {number} - всегда возвращает базовую прозрачность
     */
    static getGridOpacity(luminance, baseOpacity) {
        // Always use the same opacity regardless of background brightness
        // Color switching (light/dark) is handled by getContrastColor()
        return baseOpacity;
    }
}

