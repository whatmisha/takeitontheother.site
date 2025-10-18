// Dithering Tool - Main JavaScript File

class DitheringTool {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.originalImage = null;
        this.currentImageData = null;
        this.sampleImage = null;
        
        // Transform state for the processed image
        this.transform = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            originalWidth: 0,
            originalHeight: 0
        };
        
        // Interaction state
        this.interaction = {
            isDragging: false,
            isResizing: false,
            resizeHandle: null, // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
            startX: 0,
            startY: 0,
            startTransform: null
        };
        
        this.settings = {
            blur: 0,
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
            exportWithAlpha: false,
            backgroundColor: '#000000'
        };
        
        this.initEventListeners();
        this.initPanelDrag();
        this.initCanvasInteraction();
        this.loadDefaultImage();
    }
    
    initEventListeners() {
        // File input
        const imageInput = document.getElementById('imageInput');
        imageInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Sample input
        const sampleInput = document.getElementById('sampleInput');
        sampleInput.addEventListener('change', (e) => this.handleSampleSelect(e));
        
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
        
        // Color mode is fixed to monochrome
        
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
        
        // Export with alpha checkbox
        document.getElementById('exportWithAlpha').addEventListener('change', (e) => {
            this.settings.exportWithAlpha = e.target.checked;
        });
        
        // Background color picker
        document.getElementById('backgroundColor').addEventListener('input', (e) => {
            const colorValue = e.target.value;
            this.settings.backgroundColor = colorValue;
            document.getElementById('hexColorInput').value = colorValue;
            this.applyEffects();
        });
        
        // Hex color input
        document.getElementById('hexColorInput').addEventListener('input', (e) => {
            let hexValue = e.target.value;
            
            // Make sure it starts with #
            if (!hexValue.startsWith('#')) {
                hexValue = '#' + hexValue;
                e.target.value = hexValue;
            }
            
            // Validate hex color format
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            if (hexRegex.test(hexValue)) {
                // Convert 3-digit hex to 6-digit if needed
                if (hexValue.length === 4) {
                    const r = hexValue[1];
                    const g = hexValue[2];
                    const b = hexValue[3];
                    hexValue = `#${r}${r}${g}${g}${b}${b}`;
                }
                
                this.settings.backgroundColor = hexValue;
                document.getElementById('backgroundColor').value = hexValue;
                this.applyEffects();
            }
        });
        
        // Validate hex input when focus is lost
        document.getElementById('hexColorInput').addEventListener('blur', (e) => {
            let hexValue = e.target.value;
            
            // Default to black if invalid
            if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/)) {
                hexValue = '#000000';
            }
            
            e.target.value = hexValue;
            document.getElementById('backgroundColor').value = hexValue;
            this.settings.backgroundColor = hexValue;
            this.applyEffects();
        });
        
        // Bottom fixed buttons
        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportImage());
        }
        
        // Reset transform button
        const resetBtn = document.getElementById('resetTransform');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetTransform());
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
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                sampleInput.click();
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
    
    initCanvasInteraction() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    }
    
    handleMouseDown(e) {
        if (!this.originalImage || !this.sampleImage) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const handle = this.getResizeHandle(x, y);
        
        if (handle) {
            this.interaction.isResizing = true;
            this.interaction.resizeHandle = handle;
        } else if (this.isPointInImage(x, y)) {
            this.interaction.isDragging = true;
        }
        
        if (this.interaction.isDragging || this.interaction.isResizing) {
            this.interaction.startX = x;
            this.interaction.startY = y;
            this.interaction.startTransform = { ...this.transform };
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Update cursor
        if (!this.interaction.isDragging && !this.interaction.isResizing && this.sampleImage) {
            const handle = this.getResizeHandle(x, y);
            if (handle) {
                this.canvas.style.cursor = this.getCursorForHandle(handle);
            } else if (this.isPointInImage(x, y)) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
        
        if (this.interaction.isDragging) {
            const dx = x - this.interaction.startX;
            const dy = y - this.interaction.startY;
            
            this.transform.x = this.interaction.startTransform.x + dx;
            this.transform.y = this.interaction.startTransform.y + dy;
            
            this.applyEffects();
        } else if (this.interaction.isResizing) {
            this.handleResize(x, y);
        }
    }
    
    handleMouseUp(e) {
        this.interaction.isDragging = false;
        this.interaction.isResizing = false;
        this.interaction.resizeHandle = null;
        this.canvas.style.cursor = 'default';
    }
    
    isPointInImage(x, y) {
        return x >= this.transform.x && 
               x <= this.transform.x + this.transform.width &&
               y >= this.transform.y && 
               y <= this.transform.y + this.transform.height;
    }
    
    getResizeHandle(x, y) {
        const handleSize = 10;
        const t = this.transform;
        
        // Check corners first
        if (Math.abs(x - t.x) < handleSize && Math.abs(y - t.y) < handleSize) return 'nw';
        if (Math.abs(x - (t.x + t.width)) < handleSize && Math.abs(y - t.y) < handleSize) return 'ne';
        if (Math.abs(x - t.x) < handleSize && Math.abs(y - (t.y + t.height)) < handleSize) return 'sw';
        if (Math.abs(x - (t.x + t.width)) < handleSize && Math.abs(y - (t.y + t.height)) < handleSize) return 'se';
        
        // Check edges
        if (Math.abs(x - t.x) < handleSize && y >= t.y && y <= t.y + t.height) return 'w';
        if (Math.abs(x - (t.x + t.width)) < handleSize && y >= t.y && y <= t.y + t.height) return 'e';
        if (Math.abs(y - t.y) < handleSize && x >= t.x && x <= t.x + t.width) return 'n';
        if (Math.abs(y - (t.y + t.height)) < handleSize && x >= t.x && x <= t.x + t.width) return 's';
        
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
        if (newWidth < 50 || newHeight < 50) return;
        
        this.transform.x = newX;
        this.transform.y = newY;
        this.transform.width = newWidth;
        this.transform.height = newHeight;
        
        this.applyEffects();
    }
    
    drawInteractionHandles() {
        // Only draw handles if sample image exists (making processed image interactive)
        if (!this.sampleImage || !this.originalImage) return;
        
        const t = this.transform;
        const handleSize = 8;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        
        // Draw border around image
        this.ctx.strokeRect(t.x, t.y, t.width, t.height);
        
        // Draw corner handles
        const corners = [
            [t.x, t.y],
            [t.x + t.width, t.y],
            [t.x, t.y + t.height],
            [t.x + t.width, t.y + t.height]
        ];
        
        corners.forEach(([cx, cy]) => {
            this.ctx.fillRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
            this.ctx.strokeRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
        });
        
        // Draw edge handles
        const edges = [
            [t.x + t.width/2, t.y],
            [t.x + t.width/2, t.y + t.height],
            [t.x, t.y + t.height/2],
            [t.x + t.width, t.y + t.height/2]
        ];
        
        edges.forEach(([cx, cy]) => {
            this.ctx.fillRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
            this.ctx.strokeRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
        });
    }
    
    loadDefaultImage() {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            this.originalImage = img;
            this.updateCanvasSize();
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
                this.updateCanvasSize();
                document.getElementById('exportBtn').disabled = false;
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
        }
    }
    
    loadSampleImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.sampleImage = img;
                this.updateCanvasSize();
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
        
        const maxWidth = 800;
        const maxHeight = 600;
        let width = referenceImage.width;
        let height = referenceImage.height;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Initialize or reset transform for the processed image
        if (this.originalImage && (this.transform.originalWidth === 0 || !this.sampleImage)) {
            this.resetTransform();
        }
    }
    
    resetTransform() {
        if (!this.originalImage) return;
        
        // If there's a sample image, fit the processed image within canvas
        // Otherwise, fill the canvas
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        const imgAspect = this.originalImage.width / this.originalImage.height;
        const canvasAspect = canvasWidth / canvasHeight;
        
        let width, height;
        if (imgAspect > canvasAspect) {
            width = canvasWidth;
            height = canvasWidth / imgAspect;
        } else {
            height = canvasHeight;
            width = canvasHeight * imgAspect;
        }
        
        this.transform = {
            x: (canvasWidth - width) / 2,
            y: (canvasHeight - height) / 2,
            width: width,
            height: height,
            originalWidth: width,
            originalHeight: height
        };
        
        this.applyEffects();
    }
    
    applyEffects() {
        if (!this.originalImage) return;
        
        // Clear canvas and fill with background color
        this.ctx.fillStyle = this.settings.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Create a temporary canvas for processing the image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        // Set temp canvas size to match transform size
        tempCanvas.width = Math.floor(this.transform.width);
        tempCanvas.height = Math.floor(this.transform.height);
        
        // Draw original image on temp canvas
        tempCtx.drawImage(this.originalImage, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Get image data from temp canvas
        let imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        if (this.settings.showEffect) {
            // Apply preprocessing
            imageData = this.applyPreprocessing(imageData);
            
            // Apply dithering
            imageData = this.applyDithering(imageData);
        }
        
        // Put processed image back to temp canvas
        tempCtx.putImageData(imageData, 0, 0);
        
        // Draw the processed image on main canvas at transform position
        this.ctx.drawImage(
            tempCanvas, 
            Math.floor(this.transform.x), 
            Math.floor(this.transform.y),
            Math.floor(this.transform.width),
            Math.floor(this.transform.height)
        );
        
        // Draw sample image on top if it exists
        if (this.sampleImage) {
            this.ctx.drawImage(this.sampleImage, 0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw interaction handles if needed
        this.drawInteractionHandles();
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
        // Convert to grayscale using luminance formula
        return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
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
        
        // Create export canvas with canvas dimensions
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.canvas.width;
        exportCanvas.height = this.canvas.height;
        const exportCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
        
        // Fill with background color
        exportCtx.fillStyle = this.settings.backgroundColor;
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        // Create a temporary canvas for processing the image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        // Set temp canvas size to match transform size
        tempCanvas.width = Math.floor(this.transform.width);
        tempCanvas.height = Math.floor(this.transform.height);
        
        // Draw original image on temp canvas
        tempCtx.drawImage(this.originalImage, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Get image data from temp canvas
        let imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        if (this.settings.showEffect) {
            // Apply preprocessing
            imageData = this.applyPreprocessing(imageData);
            
            // Apply dithering
            imageData = this.applyDithering(imageData);
        }
        
        // Put processed image back to temp canvas
        tempCtx.putImageData(imageData, 0, 0);
        
        // Draw the processed image on export canvas at transform position
        exportCtx.drawImage(
            tempCanvas, 
            Math.floor(this.transform.x), 
            Math.floor(this.transform.y),
            Math.floor(this.transform.width),
            Math.floor(this.transform.height)
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
                const isBackground = (
                    Math.abs(r - bgR) < 30 && 
                    Math.abs(g - bgG) < 30 && 
                    Math.abs(b - bgB) < 30
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
        
        const link = document.createElement('a');
        link.download = 'dithered-image.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }
}

// Initialize the tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DitheringTool();
});

