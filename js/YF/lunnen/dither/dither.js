// Dithering Tool - Main JavaScript File

class DitheringTool {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.originalImage = null;
        this.currentImageData = null;
        
        this.settings = {
            blur: 0,
            grain: 0,
            gamma: 1,
            blackPoint: 0,
            whitePoint: 255,
            pattern: 'floyd-steinberg',
            pixelSize: 1,
            threshold: 128,
            colorMode: 'monochrome',
            showEffect: true,
            invertImage: false
        };
        
        this.initEventListeners();
        this.initPanelDrag();
        this.loadDefaultImage();
    }
    
    initEventListeners() {
        // File input
        const imageInput = document.getElementById('imageInput');
        imageInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
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
        this.addSliderListener('blur', (val) => parseFloat(val));
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
                this.applyEffects();
            });
        });
        
        // Color mode selection
        document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.settings.colorMode = e.target.value;
                this.applyEffects();
            });
        });
        
        // Invert image checkbox
        document.getElementById('invertImage').addEventListener('change', (e) => {
            this.settings.invertImage = e.target.checked;
            this.applyEffects();
        });
        
        // Show effect checkbox
        document.getElementById('showEffect').addEventListener('change', (e) => {
            this.settings.showEffect = e.target.checked;
            this.applyEffects();
        });
        
        // Bottom fixed buttons
        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportImage());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportImage();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                imageInput.click();
            }
        });
    }
    
    addSliderListener(id, parser) {
        const slider = document.getElementById(id);
        const display = document.getElementById(id + 'Value');
        
        slider.addEventListener('input', (e) => {
            const value = parser(e.target.value);
            display.textContent = value;
            this.settings[id] = value;
            this.applyEffects();
        });
    }
    
    initPanelDrag() {
        const panel = document.getElementById('controlsPanel');
        const header = document.getElementById('panelHeader');
        
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        // Get initial position from CSS
        const computedStyle = window.getComputedStyle(panel);
        const top = parseInt(computedStyle.top);
        const right = parseInt(computedStyle.right);
        
        // Convert right to left for easier calculations
        xOffset = window.innerWidth - right - panel.offsetWidth;
        yOffset = top;
        
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        // Touch events for mobile
        header.addEventListener('touchstart', dragStart);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', dragEnd);
        
        function dragStart(e) {
            if (e.type === 'touchstart') {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }
            
            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                panel.style.transition = 'none';
            }
        }
        
        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                
                if (e.type === 'touchmove') {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }
                
                xOffset = currentX;
                yOffset = currentY;
                
                setTranslate(currentX, currentY, panel);
            }
        }
        
        function dragEnd(e) {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            }
        }
        
        function setTranslate(xPos, yPos, el) {
            el.style.left = xPos + 'px';
            el.style.top = yPos + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }
    }
    
    loadDefaultImage() {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            this.originalImage = img;
            this.resizeCanvas(img);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            document.getElementById('exportBtn').disabled = false;
            this.applyEffects();
        };
        
        img.onerror = () => {
            console.log('Не удалось загрузить изображение по умолчанию');
        };
        
        img.src = 'images/sample_image_01.jpg';
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.loadImage(file);
        }
    }
    
    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.resizeCanvas(img);
                this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                // Placeholder removed
                document.getElementById('exportBtn').disabled = false;
                document.getElementById('resetBtn').disabled = false;
                this.applyEffects();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    resizeCanvas(img) {
        // Используем фиксированный размер для лучшего центрирования
        const maxWidth = 800;
        const maxHeight = 600;
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
    }
    
    applyEffects() {
        if (!this.originalImage) return;
        
        // Redraw original image
        this.ctx.drawImage(this.originalImage, 0, 0, this.canvas.width, this.canvas.height);
        
        // Get image data
        let imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.settings.showEffect) {
            return;
        }
        
        // Apply preprocessing
        imageData = this.applyPreprocessing(imageData);
        
        // Apply dithering
        imageData = this.applyDithering(imageData);
        
        // Put processed image back
        this.ctx.putImageData(imageData, 0, 0);
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
        
        // Apply blur
        if (this.settings.blur > 0) {
            imageData = this.applyBlur(imageData, this.settings.blur);
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
    
    applyBlur(imageData, radius) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const newData = new Uint8ClampedArray(data);
        
        const kernelSize = Math.ceil(radius) * 2 + 1;
        const halfKernel = Math.floor(kernelSize / 2);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, count = 0;
                
                for (let ky = -halfKernel; ky <= halfKernel; ky++) {
                    for (let kx = -halfKernel; kx <= halfKernel; kx++) {
                        const px = x + kx;
                        const py = y + ky;
                        
                        if (px >= 0 && px < width && py >= 0 && py < height) {
                            const idx = (py * width + px) * 4;
                            r += data[idx];
                            g += data[idx + 1];
                            b += data[idx + 2];
                            count++;
                        }
                    }
                }
                
                const idx = (y * width + x) * 4;
                newData[idx] = r / count;
                newData[idx + 1] = g / count;
                newData[idx + 2] = b / count;
            }
        }
        
        return new ImageData(newData, width, height);
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
                
                // Distribute error to neighboring pixels
                if (x + 1 < width) {
                    this.distributeError(data, (y * width + x + 1) * 4, error * 7 / 16);
                }
                if (y + 1 < height) {
                    if (x > 0) {
                        this.distributeError(data, ((y + 1) * width + x - 1) * 4, error * 3 / 16);
                    }
                    this.distributeError(data, ((y + 1) * width + x) * 4, error * 5 / 16);
                    if (x + 1 < width) {
                        this.distributeError(data, ((y + 1) * width + x + 1) * 4, error * 1 / 16);
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
        if (this.settings.colorMode === 'monochrome' || this.settings.colorMode === 'grayscale') {
            // Convert to grayscale
            return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        } else {
            // Return average for color mode
            return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        }
    }
    
    setPixelValue(data, idx, value) {
        if (this.settings.colorMode === 'monochrome') {
            data[idx] = value;
            data[idx + 1] = value;
            data[idx + 2] = value;
        } else if (this.settings.colorMode === 'grayscale') {
            const levels = 4; // Number of gray levels
            const quantized = Math.round(value / 255 * (levels - 1)) * (255 / (levels - 1));
            data[idx] = quantized;
            data[idx + 1] = quantized;
            data[idx + 2] = quantized;
        } else {
            // Color mode - apply to each channel separately
            const levels = 2; // Binary for each channel
            data[idx] = value > this.settings.threshold ? 255 : 0;
            data[idx + 1] = data[idx + 1] > this.settings.threshold ? 255 : 0;
            data[idx + 2] = data[idx + 2] > this.settings.threshold ? 255 : 0;
        }
    }
    
    distributeError(data, idx, error) {
        if (this.settings.colorMode === 'color') {
            // For color mode, distribute to each channel
            data[idx] = Math.max(0, Math.min(255, data[idx] + error));
            data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + error));
            data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + error));
        } else {
            // For grayscale/monochrome
            const currentValue = this.getPixelValue(data, idx);
            const newValue = Math.max(0, Math.min(255, currentValue + error));
            data[idx] = newValue;
            data[idx + 1] = newValue;
            data[idx + 2] = newValue;
        }
    }
    
    quantizePixel(value) {
        if (this.settings.colorMode === 'monochrome') {
            return value > this.settings.threshold ? 255 : 0;
        } else if (this.settings.colorMode === 'grayscale') {
            const levels = 4;
            return Math.round(value / 255 * (levels - 1)) * (255 / (levels - 1));
        } else {
            return value > this.settings.threshold ? 255 : 0;
        }
    }
    
    exportImage() {
        if (!this.originalImage) return;
        
        const link = document.createElement('a');
        link.download = 'dithered-image.png';
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }
}

// Initialize the tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DitheringTool();
});

