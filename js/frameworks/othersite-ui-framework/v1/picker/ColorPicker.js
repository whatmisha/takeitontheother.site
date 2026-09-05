/**
 * ColorPicker - HSB Color Picker с управлением градиентами
 * 
 * Автономная версия - не требует внешних зависимостей кроме ColorUtils
 */
import { ColorUtils } from './ColorUtils.js';

export class ColorPicker {
    /**
     * @param {Object} options - Опции инициализации
     * @param {string} options.containerId - ID контейнера для пикера
     * @param {string} options.initialColor - Начальный цвет (HEX)
     * @param {Function} options.onChange - Callback при изменении цвета
     */
    constructor(options = {}) {
        this.options = {
            containerId: 'colorPickerContainer',
            initialColor: '#808080',
            onChange: null,
            ...options
        };
        
        this.isUpdating = false;
        
        // HSB значения
        this.hsb = { h: 0, s: 0, b: 50 };
        
        // DOM элементы
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
     * Инициализация пикера
     */
    init() {
        this.elements.container = document.getElementById(this.options.containerId);
        
        if (!this.elements.container) {
            console.error(`ColorPicker: Container #${this.options.containerId} not found`);
            return;
        }

        // Создаем HTML структуру
        this.createHTML();
        
        // Получаем ссылки на элементы
        this.elements.picker = this.elements.container.querySelector('.hsb-picker');
        this.elements.preview = this.elements.container.querySelector('.color-preview');
        this.elements.hexInput = this.elements.container.querySelector('.hex-color-input');
        this.elements.hueSlider = this.elements.container.querySelector('#hueSlider');
        this.elements.saturationSlider = this.elements.container.querySelector('#saturationSlider');
        this.elements.brightnessSlider = this.elements.container.querySelector('#brightnessSlider');
        this.elements.hueValue = this.elements.container.querySelector('#hueValue');
        this.elements.saturationValue = this.elements.container.querySelector('#saturationValue');
        this.elements.brightnessValue = this.elements.container.querySelector('#brightnessValue');

        // Обработчики событий
        this.initEventListeners();
        
        // Инициализация с начальным цветом
        this.setColorFromHex(this.options.initialColor);
    }

    /**
     * Создание HTML структуры пикера
     */
    createHTML() {
        this.elements.container.innerHTML = `
            <div class="color-picker-wrapper">
                <div class="color-input-group">
                    <button type="button" class="color-preview" aria-label="Open color picker"></button>
                    <input type="text" class="hex-color-input" value="#808080" placeholder="#808080" maxlength="7" aria-label="Hex color code input">
                </div>
                
                <!-- Custom HSB Color Picker -->
                <div class="hsb-picker" style="display: none;">
                    <div class="hsb-controls">
                        <div class="hsb-control-group">
                            <label for="hueSlider">
                                <span>Hue</span>
                                <input type="text" class="value-display hsb-value" id="hueValue" value="0°" readonly>
                            </label>
                            <input type="range" id="hueSlider" min="0" max="360" step="1" value="0">
                        </div>
                        
                        <div class="hsb-control-group">
                            <label for="saturationSlider">
                                <span>Saturation</span>
                                <input type="text" class="value-display hsb-value" id="saturationValue" value="0%" readonly>
                            </label>
                            <input type="range" id="saturationSlider" min="0" max="100" step="1" value="0">
                        </div>
                        
                        <div class="hsb-control-group">
                            <label for="brightnessSlider">
                                <span>Brightness</span>
                                <input type="text" class="value-display hsb-value" id="brightnessValue" value="50%" readonly>
                            </label>
                            <input type="range" id="brightnessSlider" min="0" max="100" step="1" value="50">
                        </div>
                    </div>
                </div>
            </div>
        `;
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
                !this.elements.preview.contains(e.target) &&
                !this.elements.hexInput.contains(e.target)) {
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
        
        // Вызов коллбэка
        if (this.options.onChange) {
            this.options.onChange(hex);
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
        
        // Вызов коллбэка
        if (this.options.onChange) {
            this.options.onChange(hex);
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
     * Установка цвета
     */
    setColor(hex) {
        this.setColorFromHex(hex);
    }
}

