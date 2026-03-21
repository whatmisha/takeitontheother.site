/**
 * ColorPicker — HSB Color Picker с управлением градиентами
 * 
 * @param {Object} options
 * @param {string} [options.settingKey] — ключ в Settings для хранения цвета (по умолчанию 'color')
 * @param {string} [options.defaultColor] — цвет по умолчанию (по умолчанию '#808080')
 * @param {Function} [options.onChange] — callback при изменении цвета
 */
import { ColorUtils } from '../utils/ColorUtils.js';

export class ColorPicker {
    /**
     * @param {Object} settings — Settings store
     * @param {Object} options
     * @param {string}   [options.settingKey]   — ключ в Settings (default 'color')
     * @param {string}   [options.defaultColor] — цвет по умолчанию (default '#808080')
     * @param {Function} [options.onChange]      — callback(hex)
     * @param {Object}   [options.elementIds]   — карта id элементов для кастомных пикеров
     */
    constructor(settings, options = {}) {
        this.settings = settings;
        this.settingKey = options.settingKey || 'color';
        this.defaultColor = options.defaultColor || '#808080';
        this.callbacks = { onChange: options.onChange || null };
        this.isUpdating = false;
        
        this.hsb = { h: 0, s: 0, b: 0 };

        const ids = options.elementIds || {};
        this.elementIds = {
            picker:           ids.picker           || 'hsbPicker',
            preview:          ids.preview          || 'colorPreview',
            hexInput:         ids.hexInput         || 'hexColorInput',
            hueSlider:        ids.hueSlider        || 'hueSlider',
            saturationSlider: ids.saturationSlider || 'saturationSlider',
            brightnessSlider: ids.brightnessSlider || 'brightnessSlider',
            hueValue:         ids.hueValue         || 'hueValue',
            saturationValue:  ids.saturationValue  || 'saturationValue',
            brightnessValue:  ids.brightnessValue  || 'brightnessValue',
        };
        
        this.elements = {
            picker: null, preview: null, hexInput: null,
            hueSlider: null, saturationSlider: null, brightnessSlider: null,
            hueValue: null, saturationValue: null, brightnessValue: null
        };
    }

    init() {
        for (const key of Object.keys(this.elements)) {
            this.elements[key] = document.getElementById(this.elementIds[key]);
        }

        // Проверка наличия элементов
        const missingElements = Object.entries(this.elements)
            .filter(([key, value]) => !value)
            .map(([key]) => key);
        
        if (missingElements.length > 0) {
            console.warn(`ColorPicker: Missing elements: ${missingElements.join(', ')}`);
        }

        // Обработчики событий
        this.initEventListeners();
        
        // Инициализация с текущим цветом
        const currentColor = this.settings.get(this.settingKey) || this.defaultColor;
        this.setColorFromHex(currentColor);
    }

    /**
     * Инициализация обработчиков событий
     */
    initEventListeners() {
        // Превью - открытие/закрытие пикера
        if (this.elements.preview) {
            this.elements.preview.addEventListener('click', () => this.toggle());
        }

        // HEX input
        if (this.elements.hexInput) {
            this.elements.hexInput.addEventListener('input', (e) => {
                this.handleHexInput(e.target.value);
            });
        }

        // HSB слайдеры
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

        // Закрытие пикера при клике вне его
        document.addEventListener('click', (e) => {
            if (this.isOpen() && 
                !this.elements.picker.contains(e.target) && 
                !this.elements.preview.contains(e.target)) {
                this.close();
            }
        });
    }

    /**
     * Обработка ввода HEX цвета
     */
    handleHexInput(value) {
        if (this.isUpdating) return;

        // Добавляем # если нужно
        if (value && !value.startsWith('#')) {
            value = '#' + value;
        }

        // Проверка валидности HEX
        if (/^#[0-9A-F]{6}$/i.test(value)) {
            this.setColorFromHex(value);
        }
    }

    /**
     * Установка цвета из HEX
     */
    setColorFromHex(hex) {
        this.isUpdating = true;

        const rgb = ColorUtils.hexToRgb(hex);
        if (!rgb) {
            this.isUpdating = false;
            return;
        }

        this.hsb = ColorUtils.rgbToHsb(rgb.r, rgb.g, rgb.b);
        
        // Обновление UI
        this.updateUI();
        
        // Обновление настроек
        this.settings.set(this.settingKey, hex);
        
        // Вызов коллбэка
        if (this.callbacks.onChange) {
            this.callbacks.onChange(hex);
        }

        this.isUpdating = false;
    }

    /**
     * Обновление из HSB значений
     */
    updateFromHSB() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;

        const rgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, this.hsb.b);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Обновление UI
        this.updateUI();
        
        // Обновление настроек
        this.settings.set(this.settingKey, hex);
        
        // Вызов коллбэка
        if (this.callbacks.onChange) {
            this.callbacks.onChange(hex);
        }

        this.isUpdating = false;
    }

    /**
     * Обновление UI элементов
     */
    updateUI() {
        const rgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, this.hsb.b);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);

        // HEX input
        if (this.elements.hexInput) {
            this.elements.hexInput.value = hex;
        }

        // Preview
        if (this.elements.preview) {
            this.elements.preview.style.backgroundColor = hex;
        }

        // HSB слайдеры
        if (this.elements.hueSlider) {
            this.elements.hueSlider.value = this.hsb.h;
        }
        if (this.elements.saturationSlider) {
            this.elements.saturationSlider.value = this.hsb.s;
        }
        if (this.elements.brightnessSlider) {
            this.elements.brightnessSlider.value = this.hsb.b;
        }

        // HSB значения
        if (this.elements.hueValue) {
            this.elements.hueValue.value = this.hsb.h + '°';
        }
        if (this.elements.saturationValue) {
            this.elements.saturationValue.value = this.hsb.s + '%';
        }
        if (this.elements.brightnessValue) {
            this.elements.brightnessValue.value = this.hsb.b + '%';
        }

        // Обновление градиентов
        this.updateGradients();
    }

    /**
     * Обновление градиентов слайдеров
     */
    updateGradients() {
        // Hue gradient (всегда радуга)
        if (this.elements.hueSlider) {
            this.elements.hueSlider.style.background = 
                'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';
        }

        // Saturation gradient (от серого к чистому цвету)
        if (this.elements.saturationSlider) {
            const baseColorRgb = ColorUtils.hsbToRgb(this.hsb.h, 100, this.hsb.b);
            const baseColor = ColorUtils.rgbToHex(baseColorRgb.r, baseColorRgb.g, baseColorRgb.b);
            const grayRgb = ColorUtils.hsbToRgb(this.hsb.h, 0, this.hsb.b);
            const gray = ColorUtils.rgbToHex(grayRgb.r, grayRgb.g, grayRgb.b);
            
            this.elements.saturationSlider.style.background = 
                `linear-gradient(to right, ${gray}, ${baseColor})`;
        }

        // Brightness gradient (от черного к яркому цвету)
        if (this.elements.brightnessSlider) {
            const brightColorRgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, 100);
            const brightColor = ColorUtils.rgbToHex(brightColorRgb.r, brightColorRgb.g, brightColorRgb.b);
            
            this.elements.brightnessSlider.style.background = 
                `linear-gradient(to right, #000000, ${brightColor})`;
        }
    }

    /**
     * Открытие пикера
     */
    open() {
        if (this.elements.picker) {
            this.elements.picker.style.display = 'block';
        }
    }

    /**
     * Закрытие пикера
     */
    close() {
        if (this.elements.picker) {
            this.elements.picker.style.display = 'none';
        }
    }

    /**
     * Переключение видимости пикера
     */
    toggle() {
        if (this.isOpen()) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Проверка открыт ли пикер
     */
    isOpen() {
        if (!this.elements.picker) return false;
        return this.elements.picker.style.display !== 'none';
    }

    /**
     * Получение текущего цвета в HEX
     */
    getColor() {
        const rgb = ColorUtils.hsbToRgb(this.hsb.h, this.hsb.s, this.hsb.b);
        return ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    /**
     * Установка пресет цвета (например, Lunnen Blue)
     */
    setPresetColor(hex) {
        this.setColorFromHex(hex);
    }
}

