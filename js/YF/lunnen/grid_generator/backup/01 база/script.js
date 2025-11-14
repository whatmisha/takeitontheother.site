class GridGenerator {
    constructor() {
        // Settings
        this.settings = {
            frontWidth: 390.5,  // mm
            frontHeight: 395.5, // mm
            thickness: 39,      // mm
            showDimensions: false,
            showLabels: false,
            boxColor: '#808080'
        };
        
        // Display constants
        this.PADDING = 60; // padding around the grid (increased for dimensions)
        
        // Cache DOM elements
        this.dom = this.cacheDOMElements();
        
        // Initialize
        this.initEventListeners();
        this.initPanelDrag('controlsPanel', 'panelHeader');
        this.initValueInputs();
        this.updateCanvasSize();
        this.updateGrid();
        
        // Update canvas size on window resize
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.updateGrid();
        });
    }
    
    cacheDOMElements() {
        return {
            svg: document.getElementById('gridSvg'),
            
            // Sliders
            frontWidthSlider: document.getElementById('frontWidth'),
            frontHeightSlider: document.getElementById('frontHeight'),
            thicknessSlider: document.getElementById('thickness'),
            
            // Value displays
            frontWidthValue: document.getElementById('frontWidthValue'),
            frontHeightValue: document.getElementById('frontHeightValue'),
            thicknessValue: document.getElementById('thicknessValue'),
            
            // Checkboxes
            showDimensions: document.getElementById('showDimensions'),
            
            // Color controls
            boxColor: document.getElementById('boxColor'),
            hexColorInput: document.getElementById('hexColorInput'),
            lunnenBlue: document.getElementById('lunnenBlue'),
            
            // Buttons
            exportBtn: document.getElementById('exportBtn'),
            helpButton: document.getElementById('helpButton'),
            modalOverlay: document.getElementById('modalOverlay'),
            modalClose: document.getElementById('modalClose')
        };
    }
    
    initEventListeners() {
        // Front width slider
        this.dom.frontWidthSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.dom.frontWidthValue.value = value.toFixed(1);
            this.settings.frontWidth = value;
            this.updateGrid();
        });
        
        // Front height slider
        this.dom.frontHeightSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.dom.frontHeightValue.value = value.toFixed(1);
            this.settings.frontHeight = value;
            this.updateGrid();
        });
        
        // Thickness slider
        this.dom.thicknessSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.dom.thicknessValue.value = value.toFixed(1);
            this.settings.thickness = value;
            this.updateGrid();
        });
        
        // Show dimensions checkbox
        this.dom.showDimensions.addEventListener('change', (e) => {
            this.settings.showDimensions = e.target.checked;
            this.updateGrid();
        });
        
        // Box color picker
        this.dom.boxColor.addEventListener('input', (e) => {
            const colorValue = e.target.value;
            this.settings.boxColor = colorValue;
            this.dom.hexColorInput.value = colorValue;
            this.updateGrid();
        });
        
        // Lunnen Blue preset
        this.dom.lunnenBlue.addEventListener('click', () => {
            const lunnenBlueColor = '#2353DB';
            this.settings.boxColor = lunnenBlueColor;
            this.dom.boxColor.value = lunnenBlueColor;
            this.dom.hexColorInput.value = lunnenBlueColor;
            this.updateGrid();
        });
        
        // Hex color input
        this.dom.hexColorInput.addEventListener('input', (e) => {
            let hexValue = e.target.value;
            
            if (!hexValue.startsWith('#')) {
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
                
                this.settings.boxColor = hexValue;
                this.dom.boxColor.value = hexValue;
                this.updateGrid();
            }
        });
        
        // Validate hex input when focus is lost
        this.dom.hexColorInput.addEventListener('blur', (e) => {
            let hexValue = e.target.value;
            
            if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/)) {
                hexValue = '#808080';
            }
            
            e.target.value = hexValue;
            this.dom.boxColor.value = hexValue;
            this.settings.boxColor = hexValue;
            this.updateGrid();
        });
        
        // Export button
        this.dom.exportBtn.addEventListener('click', () => this.exportSVG());
        
        // Help button and modal
        if (this.dom.helpButton) {
            this.dom.helpButton.addEventListener('click', () => this.openModal());
        }
        
        if (this.dom.modalClose) {
            this.dom.modalClose.addEventListener('click', () => this.closeModal());
        }
        
        if (this.dom.modalOverlay) {
            this.dom.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.dom.modalOverlay) {
                    this.closeModal();
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportSVG();
            }
            if (e.key === 'Escape') {
                if (this.dom.modalOverlay && this.dom.modalOverlay.classList.contains('active')) {
                    this.closeModal();
                }
            }
        });
    }
    
    openModal() {
        if (this.dom.modalOverlay) {
            this.dom.modalOverlay.classList.add('active');
            this.dom.modalOverlay.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeModal() {
        if (this.dom.modalOverlay) {
            this.dom.modalOverlay.classList.remove('active');
            this.dom.modalOverlay.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }
    
    initPanelDrag(panelId, headerId) {
        const panel = document.getElementById(panelId);
        const header = document.getElementById(headerId);
        
        if (!panel || !header) return;
        
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        const computedStyle = window.getComputedStyle(panel);
        const top = parseInt(computedStyle.top);
        const right = parseInt(computedStyle.right);
        
        if (!isNaN(right)) {
            xOffset = window.innerWidth - right - panel.offsetWidth;
        }
        yOffset = top;
        
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            
            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                panel.style.transition = 'none';
            }
        }
        
        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
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
        }
    }
    
    initValueInputs() {
        const valueInputs = document.querySelectorAll('.value-display');
        
        valueInputs.forEach(input => {
            const sliderId = input.id.replace('Value', '');
            const slider = document.getElementById(sliderId);
            const min = parseFloat(input.dataset.min);
            const max = parseFloat(input.dataset.max);
            
            if (!slider) return;
            
            input.addEventListener('focus', () => {
                input.dataset.originalValue = input.value;
                input.select();
            });
            
            input.addEventListener('blur', () => {
                this.processValueInput(input, slider, min, max);
            });
            
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
                    this.handleArrowKey(e, input, slider, min, max);
                }
            });
        });
    }
    
    handleArrowKey(e, input, slider, min, max) {
        let rawValue = input.value.replace(/[^\d.-]/g, '');
        let currentValue = parseFloat(rawValue);
        
        if (isNaN(currentValue)) {
            currentValue = parseFloat(slider.value);
        }
        
        const step = e.shiftKey ? 10 : 0.5;
        let newValue = e.key === 'ArrowUp' ? currentValue + step : currentValue - step;
        newValue = Math.max(min, Math.min(max, newValue));
        newValue = parseFloat(newValue.toFixed(1));
        
        slider.value = newValue;
        input.value = newValue.toFixed(1);
        
        // Update settings
        const sliderId = slider.id;
        if (sliderId === 'frontWidth') {
            this.settings.frontWidth = newValue;
        } else if (sliderId === 'frontHeight') {
            this.settings.frontHeight = newValue;
        } else if (sliderId === 'thickness') {
            this.settings.thickness = newValue;
        }
        
        this.updateGrid();
    }
    
    processValueInput(input, slider, min, max) {
        let rawValue = input.value.replace(/[^\d.-]/g, '');
        let numValue = parseFloat(rawValue);
        
        if (isNaN(numValue)) {
            input.value = input.dataset.originalValue;
            return;
        }
        
        numValue = Math.max(min, Math.min(max, numValue));
        numValue = parseFloat(numValue.toFixed(1));
        
        slider.value = numValue;
        input.value = numValue.toFixed(1);
        
        // Update settings
        const sliderId = slider.id;
        if (sliderId === 'frontWidth') {
            this.settings.frontWidth = numValue;
        } else if (sliderId === 'frontHeight') {
            this.settings.frontHeight = numValue;
        } else if (sliderId === 'thickness') {
            this.settings.thickness = numValue;
        }
        
        this.updateGrid();
    }
    
    updateCanvasSize() {
        // Calculate canvas size based on viewport height
        const viewportHeight = window.innerHeight;
        const topBottomPadding = 40; // 20px padding on each side
        this.DISPLAY_SIZE = viewportHeight - topBottomPadding;
    }
    
    updateGrid() {
        const { frontWidth, frontHeight, thickness } = this.settings;
        
        // Calculate total dimensions in mm
        const totalWidth = frontWidth + 2 * thickness;
        const totalHeight = frontHeight + 2 * thickness;
        
        // Calculate scale to fit in display area with extra space for dimensions
        const maxDimension = Math.max(totalWidth, totalHeight);
        const availableSize = this.DISPLAY_SIZE - 2 * this.PADDING;
        const scale = availableSize / maxDimension;
        
        // Calculate scaled dimensions
        const scaledTotalWidth = totalWidth * scale;
        const scaledTotalHeight = totalHeight * scale;
        
        // Set SVG to fixed size (square, equal to viewport height)
        const svgSize = this.DISPLAY_SIZE;
        this.dom.svg.setAttribute('width', svgSize);
        this.dom.svg.setAttribute('height', svgSize);
        this.dom.svg.setAttribute('viewBox', `0 0 ${svgSize} ${svgSize}`);
        
        // Clear existing content
        this.dom.svg.innerHTML = '';
        
        // Calculate positions (perfectly centered)
        const startX = (svgSize - scaledTotalWidth) / 2;
        const startY = (svgSize - scaledTotalHeight) / 2;
        
        const scaledFrontWidth = frontWidth * scale;
        const scaledFrontHeight = frontHeight * scale;
        const scaledThickness = thickness * scale;
        
        // Draw rectangles
        this.drawRectangles(startX, startY, scaledFrontWidth, scaledFrontHeight, scaledThickness);
        
        // Draw dimensions if enabled
        if (this.settings.showDimensions) {
            this.drawDimensions(startX, startY, scaledFrontWidth, scaledFrontHeight, scaledThickness);
        }
        
        // Draw labels if enabled (but default is false now)
        if (this.settings.showLabels) {
            this.drawLabels(startX, startY, scaledFrontWidth, scaledFrontHeight, scaledThickness);
        }
    }
    
    drawRectangles(x, y, frontW, frontH, thickness) {
        // Front (center)
        this.createRect(x + thickness, y + thickness, frontW, frontH);
        
        // Left
        this.createRect(x, y + thickness, thickness, frontH);
        
        // Right
        this.createRect(x + thickness + frontW, y + thickness, thickness, frontH);
        
        // Top
        this.createRect(x + thickness, y, frontW, thickness);
        
        // Bottom
        this.createRect(x + thickness, y + thickness + frontH, frontW, thickness);
    }
    
    createRect(x, y, width, height) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', this.settings.boxColor);
        rect.setAttribute('stroke', '#000000');
        rect.setAttribute('stroke-width', '1');
        this.dom.svg.appendChild(rect);
    }
    
    drawDimensions(x, y, frontW, frontH, thickness) {
        const { frontWidth, frontHeight, thickness: thicknessMm } = this.settings;
        const offset = 15; // offset for dimension text
        
        // Front width dimension (below front panel)
        this.createDimensionText(
            x + thickness + frontW / 2,
            y + thickness + frontH + offset,
            `${frontWidth.toFixed(1)} mm`
        );
        
        // Front height dimension (right of front panel)
        this.createDimensionText(
            x + thickness + frontW + offset,
            y + thickness + frontH / 2,
            `${frontHeight.toFixed(1)} mm`,
            'middle'
        );
        
        // Thickness dimension (right of right panel)
        this.createDimensionText(
            x + thickness + frontW + thickness + offset,
            y + thickness + frontH / 2,
            `${thicknessMm.toFixed(1)} mm`,
            'middle'
        );
    }
    
    createDimensionText(x, y, text, anchor = 'middle') {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', x);
        textElement.setAttribute('y', y);
        textElement.setAttribute('text-anchor', anchor);
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('class', 'grid-text');
        textElement.textContent = text;
        this.dom.svg.appendChild(textElement);
    }
    
    drawLabels(x, y, frontW, frontH, thickness) {
        // Front label
        this.createLabel(
            x + thickness + frontW / 2,
            y + thickness + frontH / 2,
            'FRONT'
        );
        
        // Left label
        this.createLabel(
            x + thickness / 2,
            y + thickness + frontH / 2,
            'LEFT',
            true
        );
        
        // Right label
        this.createLabel(
            x + thickness + frontW + thickness / 2,
            y + thickness + frontH / 2,
            'RIGHT',
            true
        );
        
        // Top label
        this.createLabel(
            x + thickness + frontW / 2,
            y + thickness / 2,
            'TOP'
        );
        
        // Bottom label
        this.createLabel(
            x + thickness + frontW / 2,
            y + thickness + frontH + thickness / 2,
            'BOTTOM'
        );
    }
    
    createLabel(x, y, text, rotate = false) {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', x);
        textElement.setAttribute('y', y);
        textElement.setAttribute('text-anchor', 'middle');
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('class', 'grid-label');
        
        if (rotate) {
            textElement.setAttribute('transform', `rotate(-90 ${x} ${y})`);
        }
        
        textElement.textContent = text;
        this.dom.svg.appendChild(textElement);
    }
    
    exportSVG() {
        const { frontWidth, frontHeight, thickness } = this.settings;
        
        // Create a new SVG for export with actual mm dimensions
        const totalWidth = frontWidth + 2 * thickness;
        const totalHeight = frontHeight + 2 * thickness;
        
        // Create SVG with mm units
        const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        exportSvg.setAttribute('width', `${totalWidth}mm`);
        exportSvg.setAttribute('height', `${totalHeight}mm`);
        exportSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
        
        // Draw rectangles at actual mm scale
        this.drawRectanglesToSVG(exportSvg, 0, 0, frontWidth, frontHeight, thickness);
        
        // Add dimensions if enabled
        if (this.settings.showDimensions) {
            this.drawDimensionsToSVG(exportSvg, 0, 0, frontWidth, frontHeight, thickness);
        }
        
        // Add labels if enabled
        if (this.settings.showLabels) {
            this.drawLabelsToSVG(exportSvg, 0, 0, frontWidth, frontHeight, thickness);
        }
        
        // Convert to string
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(exportSvg);
        
        // Create blob and download
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `grid-${frontWidth}x${frontHeight}-${thickness}.svg`;
        link.href = url;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
    
    drawRectanglesToSVG(svg, x, y, frontW, frontH, thickness) {
        const createRect = (x, y, width, height) => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            rect.setAttribute('fill', this.settings.boxColor);
            rect.setAttribute('stroke', '#000000');
            rect.setAttribute('stroke-width', '0.25');
            svg.appendChild(rect);
        };
        
        // Front (center)
        createRect(x + thickness, y + thickness, frontW, frontH);
        
        // Left
        createRect(x, y + thickness, thickness, frontH);
        
        // Right
        createRect(x + thickness + frontW, y + thickness, thickness, frontH);
        
        // Top
        createRect(x + thickness, y, frontW, thickness);
        
        // Bottom
        createRect(x + thickness, y + thickness + frontH, frontW, thickness);
    }
    
    drawDimensionsToSVG(svg, x, y, frontW, frontH, thickness) {
        const { frontWidth, frontHeight, thickness: thicknessMm } = this.settings;
        const offset = 5; // smaller offset in mm
        
        const createText = (x, y, text, anchor = 'middle') => {
            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', x);
            textElement.setAttribute('y', y);
            textElement.setAttribute('text-anchor', anchor);
            textElement.setAttribute('dominant-baseline', 'middle');
            textElement.setAttribute('font-size', '3');
            textElement.setAttribute('font-family', 'Arial, sans-serif');
            textElement.setAttribute('fill', '#666666');
            textElement.textContent = text;
            svg.appendChild(textElement);
        };
        
        // Front width
        createText(
            x + thickness + frontW / 2,
            y + thickness + frontH + offset,
            `${frontWidth.toFixed(1)} mm`
        );
        
        // Front height
        createText(
            x + thickness + frontW + offset,
            y + thickness + frontH / 2,
            `${frontHeight.toFixed(1)} mm`
        );
        
        // Thickness
        createText(
            x + thickness + frontW + thickness + offset,
            y + thickness + frontH / 2,
            `${thicknessMm.toFixed(1)} mm`
        );
    }
    
    drawLabelsToSVG(svg, x, y, frontW, frontH, thickness) {
        const createLabel = (x, y, text, rotate = false) => {
            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', x);
            textElement.setAttribute('y', y);
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('dominant-baseline', 'middle');
            textElement.setAttribute('font-size', '4');
            textElement.setAttribute('font-weight', '600');
            textElement.setAttribute('font-family', 'Arial, sans-serif');
            textElement.setAttribute('fill', '#999999');
            
            if (rotate) {
                textElement.setAttribute('transform', `rotate(-90 ${x} ${y})`);
            }
            
            textElement.textContent = text;
            svg.appendChild(textElement);
        };
        
        // Front
        createLabel(x + thickness + frontW / 2, y + thickness + frontH / 2, 'FRONT');
        
        // Left
        createLabel(x + thickness / 2, y + thickness + frontH / 2, 'LEFT', true);
        
        // Right
        createLabel(x + thickness + frontW + thickness / 2, y + thickness + frontH / 2, 'RIGHT', true);
        
        // Top
        createLabel(x + thickness + frontW / 2, y + thickness / 2, 'TOP');
        
        // Bottom
        createLabel(x + thickness + frontW / 2, y + thickness + frontH + thickness / 2, 'BOTTOM');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GridGenerator();
});

