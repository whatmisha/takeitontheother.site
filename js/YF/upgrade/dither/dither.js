let ColorUtils;
let DitherPanelManager;
let OverlayDialogHost;

class DitheringTool {
    // Constants
    static CONSTANTS = {
        // Canvas dimensions
        MAX_CANVAS_WIDTH: 800,
        MAX_CANVAS_HEIGHT: 600,
        OVERLAY_PADDING: 200,
        
        // Interaction handles
        HANDLE_SIZE: 10,
        ROTATE_INNER_RADIUS: 10,  // Start rotation zone right after handle
        ROTATE_OUTER_RADIUS: 30,  // Keep rotation zone compact
        MIN_IMAGE_SIZE: 50,
        
        // Floyd-Steinberg dithering coefficients
        FLOYD_STEINBERG: {
            RIGHT: 7/16,
            BOTTOM_LEFT: 3/16,
            BOTTOM: 5/16,
            BOTTOM_RIGHT: 1/16
        },
        
        // Luminance formula coefficients
        LUMINANCE: {
            R: 0.299,
            G: 0.587,
            B: 0.114
        },
        
        // Color tolerance for alpha export
        COLOR_TOLERANCE: 30,
        
        // Debounce delay (ms)
        DEBOUNCE_DELAY: 16 // ~60fps
    };
    
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.overlayCtx = this.overlayCanvas.getContext('2d', { willReadFrequently: true });
        this.originalImage = null;
        this.currentImageData = null;
        this.sampleImage = null;
        
        // Cache DOM elements
        this.dom = this.cacheDOMElements();
        
        // Debounced version of applyEffects
        this.debouncedApplyEffects = this.debounce(
            this.applyEffects.bind(this), 
            DitheringTool.CONSTANTS.DEBOUNCE_DELAY
        );
        
        // Cache for computed values
        this.cache = {
            baseValue: 0,
            processedImage: null,  // Кэш обработанного изображения
            lastProcessedSettings: null,  // Последние настройки обработки
            overlayImage: null  // Кэш для overlay
        };
        
        // RequestAnimationFrame для плавной отрисовки
        this.rafId = null;
        this.needsRedraw = false;
        
        // Transform state for the processed image
        this.transform = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            originalWidth: 0,
            originalHeight: 0,
            baseWidth: 0,  // Base width for scale calculation
            baseHeight: 0, // Base height for scale calculation
            rotation: 0,
            scale: 1,
            positionX: 0,  // Relative position -100 to 100
            positionY: 0   // Relative position -100 to 100
        };
        
        // Interaction state
        this.interaction = {
            isDragging: false,
            isResizing: false,
            isRotating: false,
            resizeHandle: null, // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
            rotateHandle: null, // 'nw', 'ne', 'sw', 'se'
            startX: 0,
            startY: 0,
            startTransform: null,
            startAngle: 0
        };
        
        this.settings = {
            grain: 0,
            gamma: 1,
            blackPoint: 0,
            whitePoint: 255,
            pattern: 'floyd-steinberg',
            pixelSize: 1,
            threshold: 128,
            colorMode: 'monochrome', // Fixed to monochrome
            showEffect: true,
            invertImage: false,
            exportWithAlpha: true,
            export2x: false,
            export4x: false,
            export8x: false,
            backgroundColor: '#000000'
        };
        
        this.modalHost = new OverlayDialogHost({
            overlayId: 'modalOverlay',
            closeButtonId: 'modalClose',
            triggerId: 'helpButton'
        }).init();
        this.initEventListeners();
        this.panelManager = new DitherPanelManager();
        this.panelManager.registerPanel('controlsPanel', {
            headerId: 'panelHeader',
            persistent: true
        });
        this.panelManager.registerPanel('transformPanel', {
            headerId: 'transformPanelHeader',
            persistent: true
        });
        this.initCanvasInteraction();
        this.initValueInputs();
        this.initColorPreview();
        this.initYFToolsLink();
        this.loadDefaultImage();
        this.loadDefaultSample();
    }
    
    // Cache frequently accessed DOM elements
    cacheDOMElements() {
        return {
            imageInput: document.getElementById('imageInput'),
            sampleInput: document.getElementById('sampleInput'),
            exportBtn: document.getElementById('exportBtn'),
            removeImageBtn: document.getElementById('removeImageBtn'),
            removeSampleBtn: document.getElementById('removeSampleBtn'),
            
            // Value displays
            grainValue: document.getElementById('grainValue'),
            gammaValue: document.getElementById('gammaValue'),
            blackPointValue: document.getElementById('blackPointValue'),
            whitePointValue: document.getElementById('whitePointValue'),
            pixelSizeValue: document.getElementById('pixelSizeValue'),
            thresholdValue: document.getElementById('thresholdValue'),
            positionXValue: document.getElementById('positionXValue'),
            positionYValue: document.getElementById('positionYValue'),
            scaleValue: document.getElementById('scaleValue'),
            rotationValue: document.getElementById('rotationValue'),
            
            // Sliders
            grainSlider: document.getElementById('grain'),
            gammaSlider: document.getElementById('gamma'),
            blackPointSlider: document.getElementById('blackPoint'),
            whitePointSlider: document.getElementById('whitePoint'),
            pixelSizeSlider: document.getElementById('pixelSize'),
            thresholdSlider: document.getElementById('threshold'),
            positionXSlider: document.getElementById('positionX'),
            positionYSlider: document.getElementById('positionY'),
            scaleSlider: document.getElementById('scale'),
            rotationSlider: document.getElementById('rotation'),
            
            // Other controls
            invertImage: document.getElementById('invertImage'),
            showEffect: document.getElementById('showEffect'),
            exportWithAlpha: document.getElementById('exportWithAlpha'),
            export2x: document.getElementById('export2x'),
            export4x: document.getElementById('export4x'),
            export8x: document.getElementById('export8x'),
            hexColorInput: document.getElementById('hexColorInput'),
            lunnenBlue: document.getElementById('lunnenBlue'),
            resetTransform: document.getElementById('resetTransform'),
            
            // Color picker
            colorPreview: document.getElementById('colorPreview'),
            hsbPicker: document.getElementById('hsbPicker'),
            hueSlider: document.getElementById('hueSlider'),
            saturationSlider: document.getElementById('saturationSlider'),
            brightnessSlider: document.getElementById('brightnessSlider'),
            hueValue: document.getElementById('hueValue'),
            saturationValue: document.getElementById('saturationValue'),
            brightnessValue: document.getElementById('brightnessValue')
        };
    }
    
    // Debounce utility function
    debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    // Запросить отрисовку через requestAnimationFrame
    requestRedraw() {
        if (this.rafId) return;
        
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            if (this.needsRedraw) {
                this.needsRedraw = false;
                this.performRedraw();
            }
        });
    }
    
    // Выполнить быструю отрисовку без пересчета эффектов
    performRedraw() {
        if (!this.cache.processedImage) {
            this.applyEffects();
            return;
        }
        
        // Быстрая отрисовка из кэша
        this.ctx.fillStyle = this.settings.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        const drawX = this.transform.x + this.transform.width / 2 - this.cache.processedImage.width / 2;
        const drawY = this.transform.y + this.transform.height / 2 - this.cache.processedImage.height / 2;
        
        this.ctx.drawImage(
            this.cache.processedImage,
            Math.floor(drawX),
            Math.floor(drawY)
        );
        
        if (this.sampleImage) {
            this.ctx.drawImage(this.sampleImage, 0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.drawOverlay();
    }
    
    // Проверить, изменились ли настройки обработки
    hasProcessingSettingsChanged() {
        const current = JSON.stringify({
            blur: this.settings.blur,
            grain: this.settings.grain,
            gamma: this.settings.gamma,
            blackPoint: this.settings.blackPoint,
            whitePoint: this.settings.whitePoint,
            pattern: this.settings.pattern,
            pixelSize: this.settings.pixelSize,
            threshold: this.settings.threshold,
            invertImage: this.settings.invertImage,
            showEffect: this.settings.showEffect,
            backgroundColor: this.settings.backgroundColor,
            rotation: this.transform.rotation,
            width: this.transform.width,
            height: this.transform.height
        });
        
        if (this.cache.lastProcessedSettings !== current) {
            this.cache.lastProcessedSettings = current;
            return true;
        }
        return false;
    }
    
    // Color conversion methods
    hexToRgb(hex) {
        return ColorUtils.hexToRgb(hex);
    }
    
    rgbToHex(r, g, b) {
        return ColorUtils.rgbToHex(r, g, b);
    }
    
    rgbToHsb(r, g, b) {
        return ColorUtils.rgbToHsb(r, g, b);
    }
    
    hsbToRgb(h, s, b) {
        return ColorUtils.hsbToRgb(h, s, b);
    }
    
    updateHSBFromHex(hex) {
        const rgb = this.hexToRgb(hex);
        if (rgb) {
            const hsb = this.rgbToHsb(rgb.r, rgb.g, rgb.b);
            this.dom.hueSlider.value = hsb.h;
            this.dom.saturationSlider.value = hsb.s;
            this.dom.brightnessSlider.value = hsb.b;
            this.dom.hueValue.value = hsb.h;
            this.dom.saturationValue.value = hsb.s;
            this.dom.brightnessValue.value = hsb.b;
            this.updateSaturationGradient();
            this.updateBrightnessGradient();
        }
    }
    
    updateColorFromHSB() {
        const h = parseInt(this.dom.hueSlider.value);
        const s = parseInt(this.dom.saturationSlider.value);
        const b = parseInt(this.dom.brightnessSlider.value);
        
        const rgb = this.hsbToRgb(h, s, b);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        this.settings.backgroundColor = hex;
        this.dom.hexColorInput.value = hex;
        this.dom.colorPreview.style.backgroundColor = hex;
        this.cache.processedImage = null;
        this.applyEffects();
    }
    
    updateSaturationGradient() {
        const h = parseInt(this.dom.hueSlider.value);
        const b = parseInt(this.dom.brightnessSlider.value);
        
        const leftColor = this.hsbToRgb(h, 0, b);
        const rightColor = this.hsbToRgb(h, 100, b);
        
        const leftHex = this.rgbToHex(leftColor.r, leftColor.g, leftColor.b);
        const rightHex = this.rgbToHex(rightColor.r, rightColor.g, rightColor.b);
        
        const gradient = `linear-gradient(to right, ${leftHex}, ${rightHex})`;
        this.dom.saturationSlider.style.background = gradient;
        
        // Update custom CSS for the slider track
        this.updateSliderTrackGradient('saturationSlider', gradient);
    }
    
    updateBrightnessGradient() {
        const h = parseInt(this.dom.hueSlider.value);
        const s = parseInt(this.dom.saturationSlider.value);
        
        const leftColor = this.hsbToRgb(h, s, 0);
        const rightColor = this.hsbToRgb(h, s, 100);
        
        const leftHex = this.rgbToHex(leftColor.r, leftColor.g, leftColor.b);
        const rightHex = this.rgbToHex(rightColor.r, rightColor.g, rightColor.b);
        
        const gradient = `linear-gradient(to right, ${leftHex}, ${rightHex})`;
        this.dom.brightnessSlider.style.background = gradient;
        
        // Update custom CSS for the slider track
        this.updateSliderTrackGradient('brightnessSlider', gradient);
    }
    
    updateSliderTrackGradient(sliderId, gradient) {
        // Remove existing style if present
        let styleId = `${sliderId}-track-style`;
        let existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }
        
        // Create new style element
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #${sliderId}::-webkit-slider-runnable-track {
                background: ${gradient};
            }
            #${sliderId}::-moz-range-track {
                background: ${gradient};
            }
        `;
        document.head.appendChild(style);
    }
    
    initColorPreview() {
        // Set initial color preview
        this.dom.colorPreview.style.backgroundColor = this.settings.backgroundColor;
        this.updateHSBFromHex(this.settings.backgroundColor);
    }
    
    initEventListeners() {
        // File input
        this.dom.imageInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Sample input
        this.dom.sampleInput.addEventListener('change', (e) => this.handleSampleSelect(e));
        
        // Drag and drop
        const canvasContainer = document.querySelector('.canvas-container');
        canvasContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            canvasContainer.classList.add('dragover');
        });
        
        canvasContainer.addEventListener('dragleave', () => {
            canvasContainer.classList.remove('dragover');
        });
        
        canvasContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            canvasContainer.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadImage(file);
            }
        });
        
        // Preprocessing controls
        this.addSliderListener('grain', (val) => parseInt(val));
        this.addSliderListener('gamma', (val) => parseFloat(val));
        this.addSliderListener('blackPoint', (val) => parseInt(val));
        this.addSliderListener('whitePoint', (val) => parseInt(val));
        
        // Dithering controls
        this.addSliderListener('pixelSize', (val) => parseInt(val));
        this.addSliderListener('threshold', (val) => parseInt(val));
        
        // Pattern selection
        document.querySelectorAll('input[name="pattern"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.settings.pattern = e.target.value;
                this.cache.processedImage = null;
                this.applyEffects();
            });
        });
        
        // Color mode is fixed to monochrome
        
        // Invert image checkbox
        this.dom.invertImage.addEventListener('change', (e) => {
            this.settings.invertImage = e.target.checked;
            this.cache.processedImage = null;
            this.applyEffects();
        });
        
        // Show effect checkbox
        this.dom.showEffect.addEventListener('change', (e) => {
            this.settings.showEffect = e.target.checked;
            this.cache.processedImage = null;
            this.applyEffects();
        });
        
        // Export with alpha checkbox
        this.dom.exportWithAlpha.addEventListener('change', (e) => {
            this.settings.exportWithAlpha = e.target.checked;
        });
        
        // Export x2 checkbox (mutually exclusive with x4 and x8)
        this.dom.export2x.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.settings.export2x = true;
                this.settings.export4x = false;
                this.settings.export8x = false;
                this.dom.export4x.checked = false;
                this.dom.export8x.checked = false;
            } else {
                this.settings.export2x = false;
            }
        });
        
        // Export x4 checkbox (mutually exclusive with x2 and x8)
        this.dom.export4x.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.settings.export4x = true;
                this.settings.export2x = false;
                this.settings.export8x = false;
                this.dom.export2x.checked = false;
                this.dom.export8x.checked = false;
            } else {
                this.settings.export4x = false;
            }
        });
        
        // Export x8 checkbox (mutually exclusive with x2 and x4)
        this.dom.export8x.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.settings.export8x = true;
                this.settings.export2x = false;
                this.settings.export4x = false;
                this.dom.export2x.checked = false;
                this.dom.export4x.checked = false;
            } else {
                this.settings.export8x = false;
            }
        });
        
        // Color preview button - toggle HSB picker
        this.dom.colorPreview.addEventListener('click', () => {
            const isVisible = this.dom.hsbPicker.style.display !== 'none';
            this.dom.hsbPicker.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                this.updateHSBFromHex(this.settings.backgroundColor);
            }
        });
        
        // Lunnen Blue preset
        this.dom.lunnenBlue.addEventListener('click', () => {
            const lunnenBlueColor = '#2353DB';
            this.settings.backgroundColor = lunnenBlueColor;
            this.dom.hexColorInput.value = lunnenBlueColor;
            this.dom.colorPreview.style.backgroundColor = lunnenBlueColor;
            this.updateHSBFromHex(lunnenBlueColor);
            this.cache.processedImage = null;
            this.applyEffects();
        });
        
        // HSB Sliders
        this.dom.hueSlider.addEventListener('input', (e) => {
            this.dom.hueValue.value = e.target.value;
            this.updateColorFromHSB();
            this.updateSaturationGradient();
            this.updateBrightnessGradient();
        });
        
        this.dom.saturationSlider.addEventListener('input', (e) => {
            this.dom.saturationValue.value = e.target.value;
            this.updateColorFromHSB();
            this.updateBrightnessGradient();
        });
        
        this.dom.brightnessSlider.addEventListener('input', (e) => {
            this.dom.brightnessValue.value = e.target.value;
            this.updateColorFromHSB();
            this.updateSaturationGradient();
        });
        
        // Hex color input
        this.dom.hexColorInput.addEventListener('input', (e) => {
            let hexValue = e.target.value;
            
            // Remove all # symbols and add one at the start
            hexValue = hexValue.replace(/#/g, '');
            if (hexValue) {
                hexValue = '#' + hexValue;
                e.target.value = hexValue;
            }
            
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            if (hexRegex.test(hexValue)) {
                if (hexValue.length === 4) {
                    const r = hexValue[1];
                    const g = hexValue[2];
                    const b = hexValue[3];
                    hexValue = `#${r}${r}${g}${g}${b}${b}`;
                }
                
                this.settings.backgroundColor = hexValue;
                this.dom.colorPreview.style.backgroundColor = hexValue;
                this.updateHSBFromHex(hexValue);
                this.cache.processedImage = null;
                this.applyEffects();
            }
        });
        
        // Validate hex input when focus is lost
        this.dom.hexColorInput.addEventListener('blur', (e) => {
            let hexValue = e.target.value;
            
            if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/)) {
                hexValue = '#000000';
            }
            
            e.target.value = hexValue;
            this.settings.backgroundColor = hexValue;
            this.dom.colorPreview.style.backgroundColor = hexValue;
            this.updateHSBFromHex(hexValue);
            this.cache.processedImage = null;
            this.applyEffects();
        });
        
        // Bottom fixed buttons
        if (this.dom.exportBtn) {
            this.dom.exportBtn.addEventListener('click', () => this.exportImage());
        }
        
        if (this.dom.resetTransform) {
            this.dom.resetTransform.addEventListener('click', () => this.resetTransform());
        }
        
        // Upload buttons (replaced inline onclick handlers)
        const uploadBtnFixed = document.getElementById('uploadBtnFixed');
        if (uploadBtnFixed) {
            uploadBtnFixed.addEventListener('click', () => this.dom.imageInput.click());
        }
        
        const uploadSampleBtn = document.getElementById('uploadSampleBtn');
        if (uploadSampleBtn) {
            uploadSampleBtn.addEventListener('click', () => this.dom.sampleInput.click());
        }
        
        // Remove image button
        if (this.dom.removeImageBtn) {
            this.dom.removeImageBtn.addEventListener('click', () => this.removeImage());
        }
        
        // Remove sample button
        if (this.dom.removeSampleBtn) {
            this.dom.removeSampleBtn.addEventListener('click', () => this.removeSample());
        }
        
        // Position X slider
        if (this.dom.positionXSlider) {
            this.dom.positionXSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.dom.positionXValue.value = value;
                this.transform.positionX = value;
                this.updatePositionFromSliders();
            });
        }
        
        // Position Y slider
        if (this.dom.positionYSlider) {
            this.dom.positionYSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.dom.positionYValue.value = value;
                this.transform.positionY = value;
                this.updatePositionFromSliders();
            });
        }
        
        // Scale slider - теперь обрабатывается через getSliderHandlers()
        if (this.dom.scaleSlider) {
            this.dom.scaleSlider.addEventListener('input', (e) => {
                const scale = parseFloat(e.target.value);
                // Используем unified handler для консистентности
                const handlers = this.getSliderHandlers();
                handlers.scale(scale);
            });
        }
        
        // Rotation slider
        if (this.dom.rotationSlider) {
            this.dom.rotationSlider.addEventListener('input', (e) => {
                const rotation = parseInt(e.target.value);
                this.dom.rotationValue.value = rotation + '°';
                this.transform.rotation = rotation;
                this.applyEffects();
                this.drawOverlay();
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportImage();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                this.dom.imageInput.click();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                this.dom.sampleInput.click();
            }
        });
    }
    
    openModal() {
        return this.modalHost?.open();
    }
    
    closeModal() {
        return this.modalHost?.close();
    }
    
    // Unified slider update handler map
    getSliderHandlers() {
        return {
            positionX: (value) => {
                const numValue = Math.round(value);
                this.dom.positionXValue.value = numValue;
                this.transform.positionX = numValue;
                this.updatePositionFromSliders();
            },
            positionY: (value) => {
                const numValue = Math.round(value);
                this.dom.positionYValue.value = numValue;
                this.transform.positionY = numValue;
                this.updatePositionFromSliders();
            },
            scale: (value) => {
                const percentage = Math.round(value * 100);
                this.dom.scaleValue.value = percentage + '%';
                this.transform.scale = value;
                this.transform.width = this.transform.baseWidth * value;
                this.transform.height = this.transform.baseHeight * value;
                this.cache.processedImage = null;
                this.updatePositionFromSliders();
            },
            rotation: (value) => {
                const numValue = Math.round(value);
                this.dom.rotationValue.value = numValue + '°';
                this.transform.rotation = numValue;
                this.cache.processedImage = null;
                this.applyEffects();
                this.drawOverlay();
            },
            grain: (value) => {
                const numValue = Math.round(value);
                this.dom.grainValue.value = numValue;
                this.settings.grain = numValue;
                this.cache.processedImage = null;
                this.debouncedApplyEffects();
            },
            gamma: (value) => {
                this.dom.gammaValue.value = value.toFixed(1);
                this.settings.gamma = value;
                this.cache.processedImage = null;
                this.debouncedApplyEffects();
            },
            blackPoint: (value) => {
                const numValue = Math.round(value);
                this.dom.blackPointValue.value = numValue;
                this.settings.blackPoint = numValue;
                this.cache.processedImage = null;
                this.debouncedApplyEffects();
            },
            whitePoint: (value) => {
                const numValue = Math.round(value);
                this.dom.whitePointValue.value = numValue;
                this.settings.whitePoint = numValue;
                this.cache.processedImage = null;
                this.debouncedApplyEffects();
            },
            pixelSize: (value) => {
                const numValue = Math.round(value);
                this.dom.pixelSizeValue.value = numValue;
                this.settings.pixelSize = numValue;
                this.cache.processedImage = null;
                this.debouncedApplyEffects();
            },
            threshold: (value) => {
                const numValue = Math.round(value);
                this.dom.thresholdValue.value = numValue;
                this.settings.threshold = numValue;
                this.cache.processedImage = null;
                this.debouncedApplyEffects();
            }
        };
    }
    
    addSliderListener(id, parser) {
        const slider = document.getElementById(id);
        const display = document.getElementById(id + 'Value');
        
        slider.addEventListener('input', (e) => {
            const value = parser(e.target.value);
            display.value = value;
            this.settings[id] = value;
            // Инвалидировать кэш при изменении настроек
            this.cache.processedImage = null;
            this.applyEffects();
        });
    }
    
    getBaseValue() {
        // Use the larger of base width or height as reference
        // Cache the result to avoid repeated calculations
        if (this.cache.baseValue === 0 || 
            this.cache.lastBaseWidth !== this.transform.baseWidth ||
            this.cache.lastBaseHeight !== this.transform.baseHeight) {
            this.cache.baseValue = Math.max(this.transform.baseWidth, this.transform.baseHeight);
            this.cache.lastBaseWidth = this.transform.baseWidth;
            this.cache.lastBaseHeight = this.transform.baseHeight;
        }
        return this.cache.baseValue;
    }
    
    updatePositionFromSliders() {
        if (!this.originalImage) return;
        
        const baseValue = this.getBaseValue();
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // Convert relative position (-100 to 100) to absolute pixels
        // positionX: 0 means centered, -100 means shifted left by baseValue, +100 means shifted right by baseValue
        const centerX = (canvasWidth - this.transform.width) / 2;
        const centerY = (canvasHeight - this.transform.height) / 2;
        
        this.transform.x = centerX + (this.transform.positionX / 100) * baseValue;
        this.transform.y = centerY + (this.transform.positionY / 100) * baseValue;
        
        this.applyEffects();
        this.drawOverlay();
    }
    
    updateSlidersFromPosition() {
        if (!this.originalImage) return;
        
        const baseValue = this.getBaseValue();
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        const centerX = (canvasWidth - this.transform.width) / 2;
        const centerY = (canvasHeight - this.transform.height) / 2;
        
        // Convert absolute position to relative (-100 to 100)
        const relativeX = ((this.transform.x - centerX) / baseValue) * 100;
        const relativeY = ((this.transform.y - centerY) / baseValue) * 100;
        
        this.transform.positionX = Math.round(relativeX);
        this.transform.positionY = Math.round(relativeY);
        
        // Update sliders
        if (this.dom.positionXSlider) {
            this.dom.positionXSlider.value = this.transform.positionX;
            this.dom.positionXValue.value = this.transform.positionX;
        }
        
        if (this.dom.positionYSlider) {
            this.dom.positionYSlider.value = this.transform.positionY;
            this.dom.positionYValue.value = this.transform.positionY;
        }
    }
    
    initCanvasInteraction() {
        // Enable pointer events on overlay when sample is loaded
        this.overlayCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.overlayCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.overlayCanvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.overlayCanvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    }
    
    initValueInputs() {
        // Add keyboard input support for all value display fields
        const valueInputs = document.querySelectorAll('.value-display');
        
        valueInputs.forEach(input => {
            // Get slider ID from input ID (e.g., 'blurValue' -> 'blur')
            const sliderId = input.id.replace('Value', '');
            const slider = document.getElementById(sliderId);
            const min = parseFloat(input.dataset.min);
            const max = parseFloat(input.dataset.max);
            
            if (!slider) return;
            
            // Get step from slider or determine from data
            const step = parseFloat(slider.step) || this.getStepForSlider(sliderId);
            
            // Store original value on focus
            input.addEventListener('focus', () => {
                input.dataset.originalValue = input.value;
                input.select();
            });
            
            // Handle input changes
            input.addEventListener('blur', () => {
                this.processValueInput(input, slider, min, max);
            });
            
            // Handle keyboard shortcuts
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    input.value = input.dataset.originalValue;
                    input.blur();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.handleArrowKey(e, input, slider, min, max, step);
                }
            });
        });
    }

    initYFToolsLink() {
        // Initialize YF Tools link with relative URL
        const yfToolsLink = document.querySelector('.yf-tools-link');
        if (yfToolsLink) {
            // Use relative path that works on any domain
            const yfToolsUrl = `../`;
            
            yfToolsLink.href = yfToolsUrl;
            
            // Add click handler for analytics or additional functionality if needed
            yfToolsLink.addEventListener('click', (e) => {
                // Optional: Add analytics tracking here
                console.log('Navigating to YF Tools');
            });
        }
    }
    
    getStepForSlider(sliderId) {
        // Determine appropriate step based on slider type
        const integerSliders = ['positionX', 'positionY', 'rotation', 'grain', 'blackPoint', 'whitePoint', 'pixelSize', 'threshold'];
        const decimalSliders = ['gamma', 'scale'];
        
        if (integerSliders.includes(sliderId)) {
            return 1;
        } else if (decimalSliders.includes(sliderId)) {
            return 0.1;
        }
        return 1;
    }
    
    handleArrowKey(e, input, slider, min, max, baseStep) {
        const sliderId = slider.id;
        
        // Special handling for scale (which displays as percentage)
        if (sliderId === 'scale') {
            // Get current value from transform (the source of truth)
            let currentValue = this.transform.scale || 1.0;
            
            // Work in percentage space to avoid floating point issues
            let currentPercent = Math.round(currentValue * 100);
            
            // Step in percentage points: 1% or 10%
            const percentStep = e.shiftKey ? 10 : 1;
            
            // Calculate new percentage
            let newPercent = e.key === 'ArrowUp' 
                ? currentPercent + percentStep 
                : currentPercent - percentStep;
            
            // Clamp to min/max (10% - 400%)
            newPercent = Math.max(10, Math.min(400, newPercent));
            
            // Convert back to decimal
            let newValue = newPercent / 100;
            
            // Directly update transform and UI (bypass slider)
            this.transform.scale = newValue;
            this.transform.width = this.transform.baseWidth * newValue;
            this.transform.height = this.transform.baseHeight * newValue;
            
            // Update both slider and input display
            slider.value = newValue;
            input.value = newPercent + '%';
            
            // Invalidate cache and redraw
            this.cache.processedImage = null;
            this.updatePositionFromSliders();
            return;
        }
        
        // Get current numeric value
        let rawValue = input.value.replace(/[^\d.-]/g, '');
        let currentValue = parseFloat(rawValue);
        
        if (isNaN(currentValue)) {
            currentValue = parseFloat(slider.value);
        }
        
        // Determine step (x10 if Shift is pressed)
        const step = e.shiftKey ? baseStep * 10 : baseStep;
        
        // Calculate new value
        let newValue = e.key === 'ArrowUp' 
            ? currentValue + step 
            : currentValue - step;
        
        // Clamp to min/max
        newValue = Math.max(min, Math.min(max, newValue));
        
        // Round to appropriate precision
        const precision = baseStep < 1 ? 1 : 0;
        newValue = parseFloat(newValue.toFixed(precision));
        
        // Update slider
        slider.value = newValue;
        
        // Update input and apply changes
        this.updateValueFromArrowKey(sliderId, newValue);
    }
    
    updateValueFromArrowKey(sliderId, numValue) {
        // Use unified slider handler
        const handlers = this.getSliderHandlers();
        const handler = handlers[sliderId];
        if (handler) {
            handler(numValue);
        }
    }
    
    processValueInput(input, slider, min, max) {
        const sliderId = slider.id;
        let rawValue = input.value.replace(/[^\d.-]/g, ''); // Remove non-numeric characters except - and .
        let numValue = parseFloat(rawValue);
        
        // Validate and clamp value
        if (isNaN(numValue)) {
            // Restore original value if invalid
            input.value = input.dataset.originalValue;
            return;
        }
        
        // Special handling for scale (convert percentage to decimal)
        if (sliderId === 'scale') {
            // Input is in percentage (e.g., 100), convert to decimal (1.0)
            numValue = numValue / 100;
            
            // Clamp to 0.1 - 4.0 (10% - 400%)
            numValue = Math.max(0.1, Math.min(4.0, numValue));
            
            // Round to 2 decimal places
            numValue = parseFloat(numValue.toFixed(2));
        } else {
            numValue = Math.max(min, Math.min(max, numValue));
        }
        
        // Update slider
        slider.value = numValue;
        
        // Use unified slider handler
        this.updateValueFromArrowKey(sliderId, numValue);
    }
    
    handleMouseDown(e) {
        if (!this.originalImage) return; // Only require original image for transform controls
        
        const rect = this.overlayCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const rotateHandle = this.getRotateHandle(x, y);
        const resizeHandle = this.getResizeHandle(x, y);
        
        if (rotateHandle) {
            this.interaction.isRotating = true;
            this.interaction.rotateHandle = rotateHandle;
            
            // Calculate initial angle
            const padding = (this.overlayCanvas.width - this.canvas.width) / 2;
            const centerX = this.transform.x + padding + this.transform.width / 2;
            const centerY = this.transform.y + padding + this.transform.height / 2;
            this.interaction.startAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
        } else if (resizeHandle) {
            this.interaction.isResizing = true;
            this.interaction.resizeHandle = resizeHandle;
        } else if (this.isPointInImage(x, y)) {
            this.interaction.isDragging = true;
        }
        
        if (this.interaction.isDragging || this.interaction.isResizing || this.interaction.isRotating) {
            this.interaction.startX = x;
            this.interaction.startY = y;
            this.interaction.startTransform = { ...this.transform };
            this.interaction.dominantAxis = null; // Reset dominant axis for new drag
        }
    }
    
    handleMouseMove(e) {
        const rect = this.overlayCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Update cursor
        if (!this.interaction.isDragging && !this.interaction.isResizing && !this.interaction.isRotating && this.originalImage) {
            const rotateHandle = this.getRotateHandle(x, y);
            const resizeHandle = this.getResizeHandle(x, y);
            
            if (rotateHandle) {
                this.overlayCanvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'17\' height=\'17\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\'><path d=\'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2\'/></svg>") 8 8, auto';
            } else if (resizeHandle) {
                this.overlayCanvas.style.cursor = this.getCursorForHandle(resizeHandle);
            } else if (this.isPointInImage(x, y)) {
                this.overlayCanvas.style.cursor = 'move';
            } else {
                this.overlayCanvas.style.cursor = 'default';
            }
        }
        
        // Update cursor during rotation
        if (this.interaction.isRotating) {
            this.overlayCanvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'17\' height=\'17\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\'><path d=\'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2\'/></svg>") 8 8, auto';
        }
        
        if (this.interaction.isDragging) {
            let dx = x - this.interaction.startX;
            let dy = y - this.interaction.startY;
            
            // If Shift is pressed, constrain movement to one axis
            if (e.shiftKey) {
                // Determine dominant axis on first significant movement
                if (!this.interaction.dominantAxis) {
                    const threshold = 10; // Minimum pixels before locking axis
                    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
                        this.interaction.dominantAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                    }
                }
                
                // Lock to dominant axis
                if (this.interaction.dominantAxis === 'x') {
                    dy = 0;
                } else if (this.interaction.dominantAxis === 'y') {
                    dx = 0;
                }
            } else {
                // Reset dominant axis if Shift is released
                this.interaction.dominantAxis = null;
            }
            
            this.transform.x = this.interaction.startTransform.x + dx;
            this.transform.y = this.interaction.startTransform.y + dy;
            
            // Update position sliders
            this.updateSlidersFromPosition();
            
            // Использовать быструю отрисовку вместо полного пересчета
            this.needsRedraw = true;
            this.requestRedraw();
        } else if (this.interaction.isResizing) {
            this.handleResize(x, y);
        } else if (this.interaction.isRotating) {
            this.handleRotate(x, y);
        }
    }
    
    handleMouseUp(e) {
        const wasInteracting = this.interaction.isDragging || 
                              this.interaction.isResizing || 
                              this.interaction.isRotating;
        
        this.interaction.isDragging = false;
        this.interaction.isResizing = false;
        this.interaction.isRotating = false;
        this.interaction.resizeHandle = null;
        this.interaction.rotateHandle = null;
        this.overlayCanvas.style.cursor = 'default';
        
        // При окончании взаимодействия выполнить финальный пересчет
        if (wasInteracting) {
            // Отменить любую запланированную быструю отрисовку
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            this.needsRedraw = false;
            
            // Выполнить полный пересчет
            this.applyEffects();
        }
    }
    
    isPointInImage(x, y) {
        const padding = (this.overlayCanvas.width - this.canvas.width) / 2;
        const t = {
            x: this.transform.x + padding,
            y: this.transform.y + padding,
            width: this.transform.width,
            height: this.transform.height
        };
        
        // Rotate point back to image's local coordinate system
        const centerX = t.x + t.width / 2;
        const centerY = t.y + t.height / 2;
        const rotatedPoint = this.rotatePoint(x, y, centerX, centerY, -this.transform.rotation);
        
        return rotatedPoint.x >= t.x && 
               rotatedPoint.x <= t.x + t.width &&
               rotatedPoint.y >= t.y && 
               rotatedPoint.y <= t.y + t.height;
    }
    
    rotatePoint(x, y, centerX, centerY, angle) {
        const radians = (angle * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        
        const dx = x - centerX;
        const dy = y - centerY;
        
        return {
            x: centerX + (dx * cos - dy * sin),
            y: centerY + (dx * sin + dy * cos)
        };
    }
    
    getRotateHandle(x, y) {
        const innerRadius = DitheringTool.CONSTANTS.ROTATE_INNER_RADIUS;
        const outerRadius = DitheringTool.CONSTANTS.ROTATE_OUTER_RADIUS;
        const padding = (this.overlayCanvas.width - this.canvas.width) / 2;
        
        // Transform coordinates to overlay space
        const t = {
            x: this.transform.x + padding,
            y: this.transform.y + padding,
            width: this.transform.width,
            height: this.transform.height
        };
        
        // Rotate point back to image's local coordinate system
        const centerX = t.x + t.width / 2;
        const centerY = t.y + t.height / 2;
        const rotatedPoint = this.rotatePoint(x, y, centerX, centerY, -this.transform.rotation);
        
        const rx = rotatedPoint.x;
        const ry = rotatedPoint.y;
        
        // Check corners with distance range for rotation zone
        const corners = [
            { x: t.x, y: t.y, handle: 'nw' },
            { x: t.x + t.width, y: t.y, handle: 'ne' },
            { x: t.x, y: t.y + t.height, handle: 'sw' },
            { x: t.x + t.width, y: t.y + t.height, handle: 'se' }
        ];
        
        for (const corner of corners) {
            const dist = Math.sqrt(Math.pow(rx - corner.x, 2) + Math.pow(ry - corner.y, 2));
            if (dist > innerRadius && dist < outerRadius) {
                return corner.handle;
            }
        }
        
        // Check edge midpoints with distance range for rotation zone
        const edges = [
            { x: t.x + t.width / 2, y: t.y, handle: 'n' },
            { x: t.x + t.width / 2, y: t.y + t.height, handle: 's' },
            { x: t.x, y: t.y + t.height / 2, handle: 'w' },
            { x: t.x + t.width, y: t.y + t.height / 2, handle: 'e' }
        ];
        
        for (const edge of edges) {
            const dist = Math.sqrt(Math.pow(rx - edge.x, 2) + Math.pow(ry - edge.y, 2));
            if (dist > innerRadius && dist < outerRadius) {
                return edge.handle;
            }
        }
        
        return null;
    }
    
    getResizeHandle(x, y) {
        const handleSize = DitheringTool.CONSTANTS.HANDLE_SIZE;
        const padding = (this.overlayCanvas.width - this.canvas.width) / 2;
        
        // Transform coordinates to overlay space
        const t = {
            x: this.transform.x + padding,
            y: this.transform.y + padding,
            width: this.transform.width,
            height: this.transform.height
        };
        
        // Rotate point back to image's local coordinate system
        const centerX = t.x + t.width / 2;
        const centerY = t.y + t.height / 2;
        const rotatedPoint = this.rotatePoint(x, y, centerX, centerY, -this.transform.rotation);
        
        const rx = rotatedPoint.x;
        const ry = rotatedPoint.y;
        
        // Check corners first
        if (Math.abs(rx - t.x) < handleSize && Math.abs(ry - t.y) < handleSize) return 'nw';
        if (Math.abs(rx - (t.x + t.width)) < handleSize && Math.abs(ry - t.y) < handleSize) return 'ne';
        if (Math.abs(rx - t.x) < handleSize && Math.abs(ry - (t.y + t.height)) < handleSize) return 'sw';
        if (Math.abs(rx - (t.x + t.width)) < handleSize && Math.abs(ry - (t.y + t.height)) < handleSize) return 'se';
        
        // Check edges
        if (Math.abs(rx - t.x) < handleSize && ry >= t.y && ry <= t.y + t.height) return 'w';
        if (Math.abs(rx - (t.x + t.width)) < handleSize && ry >= t.y && ry <= t.y + t.height) return 'e';
        if (Math.abs(ry - t.y) < handleSize && rx >= t.x && rx <= t.x + t.width) return 'n';
        if (Math.abs(ry - (t.y + t.height)) < handleSize && rx >= t.x && rx <= t.x + t.width) return 's';
        
        return null;
    }
    
    getCursorForHandle(handle) {
        const cursors = {
            'nw': 'nw-resize',
            'ne': 'ne-resize',
            'sw': 'sw-resize',
            'se': 'se-resize',
            'n': 'n-resize',
            's': 's-resize',
            'e': 'e-resize',
            'w': 'w-resize'
        };
        return cursors[handle] || 'default';
    }
    
    handleResize(x, y) {
        const dx = x - this.interaction.startX;
        const dy = y - this.interaction.startY;
        const st = this.interaction.startTransform;
        const handle = this.interaction.resizeHandle;
        
        let newX = st.x;
        let newY = st.y;
        let newWidth = st.width;
        let newHeight = st.height;
        
        // Maintain aspect ratio
        const aspectRatio = this.originalImage.width / this.originalImage.height;
        
        if (handle.includes('e')) {
            newWidth = st.width + dx;
            newHeight = newWidth / aspectRatio;
        } else if (handle.includes('w')) {
            newWidth = st.width - dx;
            newHeight = newWidth / aspectRatio;
            newX = st.x + dx;
        }
        
        if (handle.includes('s')) {
            newHeight = st.height + dy;
            newWidth = newHeight * aspectRatio;
        } else if (handle.includes('n')) {
            newHeight = st.height - dy;
            newWidth = newHeight * aspectRatio;
            newY = st.y + dy;
        }
        
        // Minimum size
        if (newWidth < DitheringTool.CONSTANTS.MIN_IMAGE_SIZE || 
            newHeight < DitheringTool.CONSTANTS.MIN_IMAGE_SIZE) return;
        
        this.transform.x = newX;
        this.transform.y = newY;
        this.transform.width = newWidth;
        this.transform.height = newHeight;
        
        // Update scale based on new size
        const newScale = newWidth / this.transform.baseWidth;
        this.transform.scale = newScale;
        
        // Update scale slider
        if (this.dom.scaleSlider) {
            this.dom.scaleSlider.value = newScale;
            const percentage = Math.round(newScale * 100);
            this.dom.scaleValue.value = percentage + '%';
        }
        
        // Update position sliders
        this.updateSlidersFromPosition();
        
        // Инвалидировать кэш при изменении размера
        this.cache.processedImage = null;
        
        // Использовать быструю отрисовку
        this.needsRedraw = true;
        this.requestRedraw();
    }
    
    handleRotate(x, y) {
        // Calculate center of image in overlay coordinates
        const padding = (this.overlayCanvas.width - this.canvas.width) / 2;
        const centerX = this.transform.x + padding + this.transform.width / 2;
        const centerY = this.transform.y + padding + this.transform.height / 2;
        
        // Calculate current angle
        const currentAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
        
        // Calculate rotation delta
        const angleDelta = currentAngle - this.interaction.startAngle;
        
        // Apply rotation
        let newRotation = this.interaction.startTransform.rotation + angleDelta;
        
        // Normalize to -180 to 180 range
        while (newRotation > 180) newRotation -= 360;
        while (newRotation < -180) newRotation += 360;
        
        this.transform.rotation = newRotation;
        
        // Update rotation slider
        if (this.dom.rotationSlider) {
            this.dom.rotationSlider.value = Math.round(newRotation);
            this.dom.rotationValue.value = Math.round(newRotation) + '°';
        }
        
        // Инвалидировать кэш при вращении
        this.cache.processedImage = null;
        
        // Использовать быструю отрисовку
        this.needsRedraw = true;
        this.requestRedraw();
    }
    
    drawOverlay() {
        // If there's no original image, we can't show transform controls
        if (!this.originalImage) {
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
            this.overlayCanvas.style.pointerEvents = 'none';
            
            // If there's only sample image, draw it on main canvas
            if (this.sampleImage) {
                const ctx = this.canvas.getContext('2d');
                // Fill background with custom color
                ctx.fillStyle = this.settings.backgroundColor;
                ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                // Draw sample image on top
                ctx.drawImage(this.sampleImage, 0, 0, this.canvas.width, this.canvas.height);
            }
            return;
        }
        
        this.overlayCanvas.style.pointerEvents = 'auto';
        
        // Clear overlay
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Calculate padding offset (overlay is centered over main canvas)
        const padding = (this.overlayCanvas.width - this.canvas.width) / 2;
        
        // Transform coordinates for overlay canvas
        const t = {
            x: this.transform.x + padding,
            y: this.transform.y + padding,
            width: this.transform.width,
            height: this.transform.height
        };
        
        // Использовать кэшированное изображение, если оно есть
        let transformCanvas;
        if (this.cache.processedImage) {
            transformCanvas = this.cache.processedImage;
        } else {
            // Создать canvas только если кэш пуст
            transformCanvas = document.createElement('canvas');
            const transformCtx = transformCanvas.getContext('2d', { willReadFrequently: true });
            
            // Make canvas large enough to accommodate rotated image
            const diagonal = Math.sqrt(t.width ** 2 + t.height ** 2);
            transformCanvas.width = Math.ceil(diagonal);
            transformCanvas.height = Math.ceil(diagonal);
            
            // Center of the transform canvas
            const tcx = transformCanvas.width / 2;
            const tcy = transformCanvas.height / 2;
            
            // Draw original image with rotation at center
            transformCtx.save();
            transformCtx.translate(tcx, tcy);
            transformCtx.rotate((this.transform.rotation * Math.PI) / 180);
            transformCtx.translate(-t.width / 2, -t.height / 2);
            transformCtx.drawImage(this.originalImage, 0, 0, t.width, t.height);
            transformCtx.restore();
            
            // Get image data and apply effects
            let imageData = transformCtx.getImageData(0, 0, transformCanvas.width, transformCanvas.height);
            
            if (this.settings.showEffect) {
                imageData = this.applyPreprocessing(imageData);
                imageData = this.applyDithering(imageData);
            }
            
            transformCtx.putImageData(imageData, 0, 0);
        }
        
        // Draw only the parts outside canvas with reduced opacity
        // This allows sample image to stay on top inside the canvas
        this.overlayCtx.save();
        
        // Define the main canvas bounds on overlay
        const canvasBounds = {
            x: padding,
            y: padding,
            width: this.canvas.width,
            height: this.canvas.height
        };
        
        // Create a clipping path that excludes the main canvas area
        this.overlayCtx.save();
        this.overlayCtx.beginPath();
        // Draw entire overlay canvas
        this.overlayCtx.rect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        // Cut out the main canvas area
        this.overlayCtx.rect(canvasBounds.x, canvasBounds.y, canvasBounds.width, canvasBounds.height);
        this.overlayCtx.clip('evenodd'); // This creates an inverted clip
        
        // Draw parts outside canvas with reduced opacity
        this.overlayCtx.globalAlpha = 0.1;
        
        // Position the rotated image (no additional rotation needed, already in transformCanvas)
        const drawX = t.x + t.width / 2 - transformCanvas.width / 2;
        const drawY = t.y + t.height / 2 - transformCanvas.height / 2;
        
        this.overlayCtx.drawImage(
            transformCanvas,
            Math.floor(drawX),
            Math.floor(drawY)
        );
        this.overlayCtx.restore();
        
        // Draw border and handles with rotation
        this.overlayCtx.save();
        
        const handleSize = DitheringTool.CONSTANTS.HANDLE_SIZE;
        this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.overlayCtx.lineWidth = 2;
        
        // Calculate center coordinates for rotation
        const imgCenterX = t.x + t.width / 2;
        const imgCenterY = t.y + t.height / 2;
        
        // Apply rotation for border and handles
        this.overlayCtx.translate(imgCenterX, imgCenterY);
        this.overlayCtx.rotate((this.transform.rotation * Math.PI) / 180);
        this.overlayCtx.translate(-imgCenterX, -imgCenterY);
        
        // Draw border around image
        this.overlayCtx.strokeRect(t.x, t.y, t.width, t.height);
        
        // Draw corner handles
        const corners = [
            [t.x, t.y],
            [t.x + t.width, t.y],
            [t.x, t.y + t.height],
            [t.x + t.width, t.y + t.height]
        ];
        
        corners.forEach(([cx, cy]) => {
            this.overlayCtx.fillRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
            this.overlayCtx.strokeRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
        });
        
        // Draw edge handles
        const edges = [
            [t.x + t.width/2, t.y],
            [t.x + t.width/2, t.y + t.height],
            [t.x, t.y + t.height/2],
            [t.x + t.width, t.y + t.height/2]
        ];
        
        edges.forEach(([cx, cy]) => {
            this.overlayCtx.fillRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
            this.overlayCtx.strokeRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
        });
        
        this.overlayCtx.restore();
    }
    
    loadDefaultImage() {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            this.originalImage = img;
            this.cache.processedImage = null;
            this.updateCanvasSize();
            // Enable export button and show remove button
            if (this.dom.exportBtn) {
                this.dom.exportBtn.disabled = false;
            }
            if (this.dom.removeImageBtn) {
                this.dom.removeImageBtn.classList.add('visible');
            }
            this.applyEffects();
        };
        
        img.onerror = () => {
            console.log('Не удалось загрузить изображение по умолчанию');
        };
        
        img.src = 'images/sample_image_01.jpg';
    }
    
    loadDefaultSample() {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            this.sampleImage = img;
            this.updateCanvasSize();
            // Show remove button
            if (this.dom.removeSampleBtn) {
                this.dom.removeSampleBtn.classList.add('visible');
            }
            this.applyEffects();
        };
        
        img.onerror = () => {
            console.log('Не удалось загрузить образец изображения по умолчанию');
        };
        
        img.src = 'images/sample_image_02.png';
    }
    
    removeImage() {
        // Remove the main image and reset to default
        this.originalImage = null;
        this.cache.processedImage = null;
        
        // Disable export button and hide remove button
        if (this.dom.exportBtn) {
            this.dom.exportBtn.disabled = true;
        }
        if (this.dom.removeImageBtn) {
            this.dom.removeImageBtn.classList.remove('visible');
        }
        
        // Clear canvas
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear overlay canvas
        const overlayCtx = this.overlayCanvas.getContext('2d');
        overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Reset canvas size
        this.updateCanvasSize();
        
        // Redraw - if sample exists, it will be shown
        this.applyEffects();
    }
    
    removeSample() {
        // Remove the sample image
        this.sampleImage = null;
        this.cache.overlayImage = null;
        
        // Hide remove button
        if (this.dom.removeSampleBtn) {
            this.dom.removeSampleBtn.classList.remove('visible');
        }
        
        // Clear overlay canvas
        const overlayCtx = this.overlayCanvas.getContext('2d');
        overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Clear main canvas if there's no original image
        if (!this.originalImage) {
            const ctx = this.canvas.getContext('2d');
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Redraw if there's still a main image
            this.applyEffects();
        }
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.loadImage(file);
            event.target.value = ''; // Reset input to allow reloading the same file
        }
    }
    
    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.cache.processedImage = null;
                this.updateCanvasSize();
                // Enable export button and show remove button
                if (this.dom.exportBtn) {
                    this.dom.exportBtn.disabled = false;
                }
                if (this.dom.removeImageBtn) {
                    this.dom.removeImageBtn.classList.add('visible');
                }
                this.applyEffects();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    handleSampleSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.loadSampleImage(file);
            event.target.value = ''; // Reset input to allow reloading the same file
        }
    }
    
    loadSampleImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.sampleImage = img;
                this.cache.processedImage = null;
                this.updateCanvasSize();
                // Show remove button
                if (this.dom.removeSampleBtn) {
                    this.dom.removeSampleBtn.classList.add('visible');
                }
                this.applyEffects();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    updateCanvasSize() {
        // Canvas size is determined by sample image if it exists, otherwise by processed image
        const referenceImage = this.sampleImage || this.originalImage;
        
        if (!referenceImage) return;
        
        const maxWidth = DitheringTool.CONSTANTS.MAX_CANVAS_WIDTH;
        const maxHeight = DitheringTool.CONSTANTS.MAX_CANVAS_HEIGHT;
        let width = referenceImage.width;
        let height = referenceImage.height;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Set overlay canvas to be larger to show overflow
        const padding = DitheringTool.CONSTANTS.OVERLAY_PADDING;
        this.overlayCanvas.width = width + padding * 2;
        this.overlayCanvas.height = height + padding * 2;
        
        // Initialize or reset transform for the processed image
        // Reset if: no transform exists, no sample, or original image dimensions changed
        if (this.originalImage) {
            const dimensionsChanged = this.transform.originalWidth !== this.originalImage.width || 
                                     this.transform.originalHeight !== this.originalImage.height;
            if (this.transform.originalWidth === 0 || !this.sampleImage || dimensionsChanged) {
                this.resetTransform();
            }
        }
    }
    
    resetTransform() {
        if (!this.originalImage) return;
        
        // Fill the canvas with the image, maintaining aspect ratio (cover behavior)
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        const imgAspect = this.originalImage.width / this.originalImage.height;
        const canvasAspect = canvasWidth / canvasHeight;
        
        let width, height;
        // Cover logic: choose the dimension that fills the canvas
        if (imgAspect > canvasAspect) {
            // Image is wider - fit to height, width will overflow
            height = canvasHeight;
            width = canvasHeight * imgAspect;
        } else {
            // Image is taller - fit to width, height will overflow
            width = canvasWidth;
            height = canvasWidth / imgAspect;
        }
        
        this.transform = {
            x: (canvasWidth - width) / 2,
            y: (canvasHeight - height) / 2,
            width: width,
            height: height,
            originalWidth: width,
            originalHeight: height,
            baseWidth: width,
            baseHeight: height,
            rotation: 0,
            scale: 1,
            positionX: 0,
            positionY: 0
        };
        
        // Инвалидировать кэш при сбросе трансформации
        this.cache.processedImage = null;
        
        // Reset position X slider
        if (this.dom.positionXSlider) {
            this.dom.positionXSlider.value = 0;
            this.dom.positionXValue.value = '0';
        }
        
        // Reset position Y slider
        if (this.dom.positionYSlider) {
            this.dom.positionYSlider.value = 0;
            this.dom.positionYValue.value = '0';
        }
        
        // Reset scale slider
        if (this.dom.scaleSlider) {
            this.dom.scaleSlider.value = 1;
            this.dom.scaleValue.value = '100%';
        }
        
        // Reset rotation slider
        if (this.dom.rotationSlider) {
            this.dom.rotationSlider.value = 0;
            this.dom.rotationValue.value = '0°';
        }
        
        this.applyEffects();
    }
    
    applyEffects() {
        // If there's no original image, just draw the overlay (which handles sample-only case)
        if (!this.originalImage) {
            this.drawOverlay();
            return;
        }
        
        // Проверить, нужно ли пересчитывать эффекты
        const needsProcessing = this.hasProcessingSettingsChanged() || !this.cache.processedImage;
        
        // Clear canvas and fill with background color
        this.ctx.fillStyle = this.settings.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        let processCanvas;
        
        if (needsProcessing) {
            // Step 1: Create a temporary canvas for transforming the original image
            const transformCanvas = document.createElement('canvas');
            const transformCtx = transformCanvas.getContext('2d', { willReadFrequently: true });
            
            // Make canvas large enough to accommodate rotated image
            const diagonal = Math.sqrt(this.transform.width ** 2 + this.transform.height ** 2);
            transformCanvas.width = Math.ceil(diagonal);
            transformCanvas.height = Math.ceil(diagonal);
            
            // Center of the transform canvas
            const tcx = transformCanvas.width / 2;
            const tcy = transformCanvas.height / 2;
            
            // Draw original image with rotation at center
            transformCtx.save();
            transformCtx.translate(tcx, tcy);
            transformCtx.rotate((this.transform.rotation * Math.PI) / 180);
            transformCtx.translate(-this.transform.width / 2, -this.transform.height / 2);
            transformCtx.drawImage(this.originalImage, 0, 0, this.transform.width, this.transform.height);
            transformCtx.restore();
            
            // Get the rotated bounds to crop to actual content
            const rotatedImageData = transformCtx.getImageData(0, 0, transformCanvas.width, transformCanvas.height);
            
            // Step 2: Create processing canvas with exact size needed
            processCanvas = document.createElement('canvas');
            const processCtx = processCanvas.getContext('2d', { willReadFrequently: true });
            processCanvas.width = transformCanvas.width;
            processCanvas.height = transformCanvas.height;
            processCtx.putImageData(rotatedImageData, 0, 0);
            
            // Step 3: Apply effects to the rotated image
            let imageData = processCtx.getImageData(0, 0, processCanvas.width, processCanvas.height);
            
            if (this.settings.showEffect) {
                // Apply preprocessing
                imageData = this.applyPreprocessing(imageData);
                
                // Apply dithering
                imageData = this.applyDithering(imageData);
            }
            
            // Put processed image back to canvas
            processCtx.putImageData(imageData, 0, 0);
            
            // Сохранить в кэш
            this.cache.processedImage = processCanvas;
        } else {
            // Использовать кэшированное изображение
            processCanvas = this.cache.processedImage;
        }
        
        // Step 4: Draw the processed and rotated image on main canvas at position
        const drawX = this.transform.x + this.transform.width / 2 - processCanvas.width / 2;
        const drawY = this.transform.y + this.transform.height / 2 - processCanvas.height / 2;
        
        this.ctx.drawImage(
            processCanvas, 
            Math.floor(drawX), 
            Math.floor(drawY)
        );
        
        // Draw sample image on top if it exists
        if (this.sampleImage) {
            this.ctx.drawImage(this.sampleImage, 0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw overlay with handles and overflow preview
        this.drawOverlay();
    }
    
    applyPreprocessing(imageData) {
        const data = imageData.data;
        
        // Apply invert
        if (this.settings.invertImage) {
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];         // R
                data[i + 1] = 255 - data[i + 1]; // G
                data[i + 2] = 255 - data[i + 2]; // B
                // Alpha remains unchanged
            }
        }
        
        // Apply grain
        if (this.settings.grain > 0) {
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * this.settings.grain;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
            }
        }
        
        // Apply gamma correction
        if (this.settings.gamma !== 1) {
            const gammaCorrection = 1 / this.settings.gamma;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.pow(data[i] / 255, gammaCorrection) * 255;
                data[i + 1] = Math.pow(data[i + 1] / 255, gammaCorrection) * 255;
                data[i + 2] = Math.pow(data[i + 2] / 255, gammaCorrection) * 255;
            }
        }
        
        // Apply black and white point adjustment
        const blackPoint = this.settings.blackPoint;
        const whitePoint = this.settings.whitePoint;
        const range = whitePoint - blackPoint;
        
        if (range !== 255 || blackPoint !== 0) {
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.max(0, Math.min(255, ((data[i] - blackPoint) / range) * 255));
                data[i + 1] = Math.max(0, Math.min(255, ((data[i + 1] - blackPoint) / range) * 255));
                data[i + 2] = Math.max(0, Math.min(255, ((data[i + 2] - blackPoint) / range) * 255));
            }
        }
        
        return imageData;
    }
    
    applyDithering(imageData) {
        const pixelSize = this.settings.pixelSize;
        
        if (pixelSize > 1) {
            imageData = this.downscale(imageData, pixelSize);
        }
        
        switch (this.settings.pattern) {
            case 'floyd-steinberg':
                imageData = this.floydSteinbergDither(imageData);
                break;
            case 'bayer':
                imageData = this.bayerDither(imageData);
                break;
            case 'random':
                imageData = this.randomDither(imageData);
                break;
        }
        
        if (pixelSize > 1) {
            imageData = this.upscale(imageData, pixelSize);
        }
        
        return imageData;
    }
    
    downscale(imageData, factor) {
        const width = Math.floor(imageData.width / factor);
        const height = Math.floor(imageData.height / factor);
        const newData = new Uint8ClampedArray(width * height * 4);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcX = x * factor;
                const srcY = y * factor;
                const srcIdx = (srcY * imageData.width + srcX) * 4;
                const dstIdx = (y * width + x) * 4;
                
                newData[dstIdx] = imageData.data[srcIdx];
                newData[dstIdx + 1] = imageData.data[srcIdx + 1];
                newData[dstIdx + 2] = imageData.data[srcIdx + 2];
                newData[dstIdx + 3] = imageData.data[srcIdx + 3];
            }
        }
        
        return new ImageData(newData, width, height);
    }
    
    upscale(imageData, factor) {
        const width = imageData.width * factor;
        const height = imageData.height * factor;
        const newData = new Uint8ClampedArray(width * height * 4);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcX = Math.floor(x / factor);
                const srcY = Math.floor(y / factor);
                const srcIdx = (srcY * imageData.width + srcX) * 4;
                const dstIdx = (y * width + x) * 4;
                
                newData[dstIdx] = imageData.data[srcIdx];
                newData[dstIdx + 1] = imageData.data[srcIdx + 1];
                newData[dstIdx + 2] = imageData.data[srcIdx + 2];
                newData[dstIdx + 3] = imageData.data[srcIdx + 3];
            }
        }
        
        return new ImageData(newData, width, height);
    }
    
    floydSteinbergDither(imageData) {
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                // Convert to grayscale or apply color mode
                const oldPixel = this.getPixelValue(data, idx);
                const newPixel = this.quantizePixel(oldPixel);
                const error = oldPixel - newPixel;
                
                this.setPixelValue(data, idx, newPixel);
                
                // Distribute error to neighboring pixels using Floyd-Steinberg coefficients
                const fs = DitheringTool.CONSTANTS.FLOYD_STEINBERG;
                if (x + 1 < width) {
                    this.distributeError(data, (y * width + x + 1) * 4, error * fs.RIGHT);
                }
                if (y + 1 < height) {
                    if (x > 0) {
                        this.distributeError(data, ((y + 1) * width + x - 1) * 4, error * fs.BOTTOM_LEFT);
                    }
                    this.distributeError(data, ((y + 1) * width + x) * 4, error * fs.BOTTOM);
                    if (x + 1 < width) {
                        this.distributeError(data, ((y + 1) * width + x + 1) * 4, error * fs.BOTTOM_RIGHT);
                    }
                }
            }
        }
        
        return new ImageData(data, width, height);
    }
    
    bayerDither(imageData) {
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        
        // 8x8 Bayer matrix
        const bayerMatrix = [
            [0, 32, 8, 40, 2, 34, 10, 42],
            [48, 16, 56, 24, 50, 18, 58, 26],
            [12, 44, 4, 36, 14, 46, 6, 38],
            [60, 28, 52, 20, 62, 30, 54, 22],
            [3, 35, 11, 43, 1, 33, 9, 41],
            [51, 19, 59, 27, 49, 17, 57, 25],
            [15, 47, 7, 39, 13, 45, 5, 37],
            [63, 31, 55, 23, 61, 29, 53, 21]
        ];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const threshold = (bayerMatrix[y % 8][x % 8] / 64) * 255;
                
                const oldPixel = this.getPixelValue(data, idx);
                const newPixel = oldPixel > threshold ? 255 : 0;
                
                this.setPixelValue(data, idx, newPixel);
            }
        }
        
        return new ImageData(data, width, height);
    }
    
    randomDither(imageData) {
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const threshold = Math.random() * 255;
                
                const oldPixel = this.getPixelValue(data, idx);
                const newPixel = oldPixel > threshold ? 255 : 0;
                
                this.setPixelValue(data, idx, newPixel);
            }
        }
        
        return new ImageData(data, width, height);
    }
    
    getPixelValue(data, idx) {
        // Convert to grayscale using luminance formula
        const lum = DitheringTool.CONSTANTS.LUMINANCE;
        return data[idx] * lum.R + data[idx + 1] * lum.G + data[idx + 2] * lum.B;
    }
    
    setPixelValue(data, idx, value) {
        // If value is 0 (black), use the background color
        if (value === 0) {
            // Parse the hex color to RGB
            const hexColor = this.settings.backgroundColor;
            const r = parseInt(hexColor.slice(1, 3), 16);
            const g = parseInt(hexColor.slice(3, 5), 16);
            const b = parseInt(hexColor.slice(5, 7), 16);
            
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
        } else {
            // White or other values stay as they are
            data[idx] = value;
            data[idx + 1] = value;
            data[idx + 2] = value;
        }
    }
    
    distributeError(data, idx, error) {
        // For monochrome
        const currentValue = this.getPixelValue(data, idx);
        const newValue = Math.max(0, Math.min(255, currentValue + error));
        data[idx] = newValue;
        data[idx + 1] = newValue;
        data[idx + 2] = newValue;
    }
    
    quantizePixel(value) {
        // Binary threshold for monochrome
        return value > this.settings.threshold ? 255 : 0;
    }
    
    exportImage() {
        if (!this.originalImage) return;
        
        // Determine export scale: 8x, 4x, 2x, or 1x (default)
        let exportScale = 1;
        if (this.settings.export8x) {
            exportScale = 8;
        } else if (this.settings.export4x) {
            exportScale = 4;
        } else if (this.settings.export2x) {
            exportScale = 2;
        }
        
        // Create export canvas with scaled dimensions
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.canvas.width * exportScale;
        exportCanvas.height = this.canvas.height * exportScale;
        const exportCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
        
        // Fill with background color
        exportCtx.fillStyle = this.settings.backgroundColor;
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        // Step 1: Create transform canvas with rotation BEFORE applying effects
        const transformCanvas = document.createElement('canvas');
        const transformCtx = transformCanvas.getContext('2d', { willReadFrequently: true });
        
        // Scale dimensions
        const scaledWidth = this.transform.width * exportScale;
        const scaledHeight = this.transform.height * exportScale;
        
        // Make canvas large enough to accommodate rotated image
        const diagonal = Math.sqrt(scaledWidth ** 2 + scaledHeight ** 2);
        transformCanvas.width = Math.ceil(diagonal);
        transformCanvas.height = Math.ceil(diagonal);
        
        // Center of the transform canvas
        const tcx = transformCanvas.width / 2;
        const tcy = transformCanvas.height / 2;
        
        // Draw original image with rotation at center
        transformCtx.save();
        transformCtx.translate(tcx, tcy);
        transformCtx.rotate((this.transform.rotation * Math.PI) / 180);
        transformCtx.translate(-scaledWidth / 2, -scaledHeight / 2);
        transformCtx.drawImage(this.originalImage, 0, 0, scaledWidth, scaledHeight);
        transformCtx.restore();
        
        // Step 2: Apply effects to the rotated image
        let imageData = transformCtx.getImageData(0, 0, transformCanvas.width, transformCanvas.height);
        
        if (this.settings.showEffect) {
            // Apply preprocessing
            imageData = this.applyPreprocessing(imageData);
            
            // Apply dithering
            imageData = this.applyDithering(imageData);
        }
        
        // Put processed image back to canvas
        transformCtx.putImageData(imageData, 0, 0);
        
        // Step 3: Draw the processed and rotated image on export canvas
        const drawX = (this.transform.x + this.transform.width / 2) * exportScale - transformCanvas.width / 2;
        const drawY = (this.transform.y + this.transform.height / 2) * exportScale - transformCanvas.height / 2;
        
        exportCtx.drawImage(
            transformCanvas, 
            Math.floor(drawX), 
            Math.floor(drawY)
        );
        
        // If export with alpha is enabled, process for transparency
        if (this.settings.exportWithAlpha) {
            const sourceImageData = exportCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
            const exportImageData = exportCtx.createImageData(exportCanvas.width, exportCanvas.height);
            
            const srcData = sourceImageData.data;
            const expData = exportImageData.data;
            
            // Parse background color to RGB
            const hexColor = this.settings.backgroundColor;
            const bgR = parseInt(hexColor.slice(1, 3), 16);
            const bgG = parseInt(hexColor.slice(3, 5), 16);
            const bgB = parseInt(hexColor.slice(5, 7), 16);
            
            // Process each pixel: black/background color becomes transparent, white stays white
            for (let i = 0; i < srcData.length; i += 4) {
                const r = srcData[i];
                const g = srcData[i + 1];
                const b = srcData[i + 2];
                
                // Check if this pixel is close to the background color
                const tolerance = DitheringTool.CONSTANTS.COLOR_TOLERANCE;
                const isBackground = (
                    Math.abs(r - bgR) < tolerance && 
                    Math.abs(g - bgG) < tolerance && 
                    Math.abs(b - bgB) < tolerance
                );
                
                // Calculate brightness for non-background pixels
                const brightness = (r + g + b) / 3;
                
                // Set white color
                expData[i] = 255;     // R
                expData[i + 1] = 255; // G
                expData[i + 2] = 255; // B
                
                // Alpha based on whether it's background or not
                // Background -> alpha 0 (transparent)
                // White -> alpha 255 (opaque)
                expData[i + 3] = isBackground ? 0 : brightness;
            }
            
            exportCtx.putImageData(exportImageData, 0, 0);
        }
        
        // Use toBlob for better Safari compatibility
        exportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = 'dithered-image.png';
            link.href = url;
            
            // Add to DOM, click, and remove (Safari compatibility)
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the URL object
            setTimeout(() => URL.revokeObjectURL(url), 100);
        }, 'image/png');
    }
}

// Initialize the tool when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    ({ ColorUtils, DitherPanelManager, OverlayDialogHost } = await import(
        './js/framework/FrameworkAdapter.js?v=g5-overlay-1'
    ));
    new DitheringTool();
});
