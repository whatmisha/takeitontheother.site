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
     * Получить контрастный цвет для сетки с плавным переходом
     * @param {string} bgColor - цвет фона в формате #RRGGBB
     * @returns {string} - цвет от белого через серый к черному
     */
    static getContrastColor(bgColor) {
        const luminance = this.getLuminance(bgColor);
        
        // Плавный переход от белого к черному через серые тона
        // Расширенная зона перехода: luminance 0.25 - 0.75
        const transitionStart = 0.25;
        const transitionEnd = 0.75;
        
        if (luminance < transitionStart) {
            // Темный фон → белая сетка
            return '#ffffff';
        } else if (luminance > transitionEnd) {
            // Светлый фон → черная сетка
            return '#000000';
        } else {
            // Переходная зона → серая сетка
            // Плавно меняем от белого (255) к черному (0)
            const progress = (luminance - transitionStart) / (transitionEnd - transitionStart);
            const grayValue = Math.round(255 * (1 - progress));
            return this.rgbToHex(grayValue, grayValue, grayValue);
        }
    }

    /**
     * Вычислить прозрачность для сетки в зависимости от яркости фона
     * @param {number} luminance - светимость фона (0-1)
     * @param {number} baseOpacity - базовая прозрачность
     * @returns {number} - итоговая прозрачность
     */
    static getGridOpacity(luminance, baseOpacity) {
        // Нормализуем светимость в диапазон от -1 до 1 с центром в 0.5
        const normalized = 2 * luminance - 1; // -1 (черный) до 1 (белый)
        
        // Используем степень 6 для очень агрессивного снижения прозрачности на краях
        // При luminance = 0.5 (средняя яркость) → factor = 1 (максимум)
        // При luminance близко к 0 или 1 → factor быстро стремится к 0
        // 
        // Примеры:
        // - #ffffff (luminance = 1.0) → normalized = 1 → factor = 0 → минимум
        // - #cccccc (luminance ≈ 0.6) → normalized ≈ 0.2 → factor ≈ 0.9999
        // - #808080 (luminance ≈ 0.5) → normalized = 0 → factor = 1 → максимум
        // - #1c1c1c (luminance ≈ 0.02) → normalized ≈ -0.96 → factor ≈ 0.18
        // - #000000 (luminance = 0.0) → normalized = -1 → factor = 0 → минимум
        let factor = 1 - Math.pow(Math.abs(normalized), 6);
        
        // Дополнительное снижение прозрачности в расширенной зоне перехода цвета (0.25-0.75)
        // где сетка становится серой на сером фоне
        const transitionStart = 0.25;
        const transitionEnd = 0.75;
        
        if (luminance >= transitionStart && luminance <= transitionEnd) {
            // В зоне перехода снижаем прозрачность дополнительно
            // Максимальное снижение в центре (luminance = 0.5)
            const transitionMid = 0.5;
            const distanceFromMid = Math.abs(luminance - transitionMid) / ((transitionEnd - transitionStart) / 2);
            
            // Используем степень 2 для более агрессивного снижения в центре
            const transitionPenalty = Math.pow(1 - distanceFromMid, 2); // 1 в центре, 0 на краях зоны
            
            // Снижаем до 18% в центре зоны перехода (было 25%)
            factor *= (1 - transitionPenalty * 0.82);
        }
        
        const minOpacity = baseOpacity * 0.2; // 20% от базовой на краях
        const maxOpacity = baseOpacity;       // 100% от базовой в центре
        
        return minOpacity + (maxOpacity - minOpacity) * factor;
    }
}

