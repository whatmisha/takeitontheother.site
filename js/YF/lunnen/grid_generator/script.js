class GridGenerator {
    constructor() {
        // Settings
        this.settings = {
            frontWidth: 390.5,  // mm
            frontHeight: 395.5, // mm
            thickness: 39,      // mm
            showDimensions: false,
            showLabels: false,
            showSidePanels: true,
            boxColor: '#e6e6e6',
            // Grid settings
            gridModule: 5.0,  // mm - base unit for gutter and baseline
            margins: 2,  // in modules - margin from edges
            columnCount: 12,
            rowCount: 19,  // will be calculated after DOM is ready
            rowHeight: 3,  // in modules
            linkRowsHeight: true,  // link rows and row height
            showColumns: true,
            showRows: true,
            showBaseline: true
        };
        
        // Display constants
        this.PADDING = 60; // padding around the grid (increased for dimensions)
        
        // Cache DOM elements
        this.dom = this.cacheDOMElements();
        
        // Calculate initial row count to fill the format (after DOM is ready)
        this.calculateRowCount();
        
        // Generate row presets
        this.generateRowPresets();
        
        // Initialize
        this.initEventListeners();
        this.initPanelDrag('controlsPanel', 'panelHeader');
        this.initPanelDrag('gridPanel', 'gridPanelHeader');
        this.initValueInputs();
        this.updateLinkedControlsVisual();
        this.initColorPreview();
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
            frontWidthSlider: document.getElementById('frontWidthSlider'),
            frontHeightSlider: document.getElementById('frontHeightSlider'),
            thicknessSlider: document.getElementById('thicknessSlider'),
            
            // Value displays
            frontWidthValue: document.getElementById('frontWidthValue'),
            frontHeightValue: document.getElementById('frontHeightValue'),
            thicknessValue: document.getElementById('thicknessValue'),
            
            // Checkboxes
            showDimensions: document.getElementById('showDimensions'),
            showSidePanels: document.getElementById('showSidePanels'),
            linkRowsHeight: document.getElementById('linkRowsHeight'),
            showColumns: document.getElementById('showColumns'),
            showRows: document.getElementById('showRows'),
            showBaseline: document.getElementById('showBaseline'),
            
            // Grid controls
            gridModuleSlider: document.getElementById('gridModuleSlider'),
            gridModuleValue: document.getElementById('gridModuleValue'),
            marginsSlider: document.getElementById('marginsSlider'),
            marginsValue: document.getElementById('marginsValue'),
            columnCountSlider: document.getElementById('columnCountSlider'),
            columnCountValue: document.getElementById('columnCountValue'),
            rowCountSlider: document.getElementById('rowCountSlider'),
            rowCountValue: document.getElementById('rowCountValue'),
            rowHeightSlider: document.getElementById('rowHeightSlider'),
            rowHeightValue: document.getElementById('rowHeightValue'),
            
            // Containers
            linkedControlsContainer: document.getElementById('linkedControlsContainer'),
            
            // Color controls
            colorPreview: document.getElementById('colorPreview'),
            hexColorInput: document.getElementById('hexColorInput'),
            lunnenBlue: document.getElementById('lunnenBlue'),
            hsbPicker: document.getElementById('hsbPicker'),
            hueSlider: document.getElementById('hueSlider'),
            saturationSlider: document.getElementById('saturationSlider'),
            brightnessSlider: document.getElementById('brightnessSlider'),
            hueValue: document.getElementById('hueValue'),
            saturationValue: document.getElementById('saturationValue'),
            brightnessValue: document.getElementById('brightnessValue'),
            
            // Buttons
            exportBtn: document.getElementById('exportBtn'),
            helpButton: document.getElementById('helpButton'),
            modalOverlay: document.getElementById('modalOverlay'),
            modalClose: document.getElementById('modalClose')
        };
    }
    
    initEventListeners() {
        // Helper function to add both input and change events for sliders
        const addSliderEvents = (slider, callback) => {
            slider.addEventListener('input', callback);
            slider.addEventListener('change', callback);
        };
        
        // Front width slider
        addSliderEvents(this.dom.frontWidthSlider, (e) => {
            const value = parseFloat(e.target.value);
            this.dom.frontWidthValue.value = value.toFixed(1);
            this.settings.frontWidth = value;
            this.updateGrid();
        });
        
        // Front height slider
        addSliderEvents(this.dom.frontHeightSlider, (e) => {
            const value = parseFloat(e.target.value);
            this.dom.frontHeightValue.value = value.toFixed(1);
            this.settings.frontHeight = value;
            this.calculateRowCount();
            this.generateRowPresets();
            this.updateGrid();
        });
        
        // Thickness slider
        addSliderEvents(this.dom.thicknessSlider, (e) => {
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
        
        // Show side panels checkbox
        this.dom.showSidePanels.addEventListener('change', (e) => {
            this.settings.showSidePanels = e.target.checked;
            this.updateGrid();
        });
        
        // Link rows and row height checkbox
        this.dom.linkRowsHeight.addEventListener('change', (e) => {
            this.settings.linkRowsHeight = e.target.checked;
            this.updateLinkedControlsVisual();
        });
        
        // Show columns checkbox
        this.dom.showColumns.addEventListener('change', (e) => {
            this.settings.showColumns = e.target.checked;
            this.updateGrid();
        });
        
        // Show rows checkbox
        this.dom.showRows.addEventListener('change', (e) => {
            this.settings.showRows = e.target.checked;
            this.updateGrid();
        });
        
        // Show baseline checkbox
        this.dom.showBaseline.addEventListener('change', (e) => {
            this.settings.showBaseline = e.target.checked;
            this.updateGrid();
        });
        
        // Grid module slider
        const gridModuleHandler = (e) => {
            const value = parseFloat(e.target.value);
            this.dom.gridModuleValue.value = value.toFixed(2);
            this.settings.gridModule = value;
            this.calculateRowCount();
            this.generateRowPresets();
            this.updateGrid();
        };
        addSliderEvents(this.dom.gridModuleSlider, gridModuleHandler);
        this.dom.gridModuleSlider.addEventListener('keyup', gridModuleHandler);
        
        // Margins slider
        const marginsHandler = (e) => {
            const value = parseFloat(e.target.value);
            this.dom.marginsValue.value = value.toFixed(2);
            this.settings.margins = value;
            this.calculateRowCount();
            this.generateRowPresets();
            this.updateGrid();
        };
        addSliderEvents(this.dom.marginsSlider, marginsHandler);
        this.dom.marginsSlider.addEventListener('keyup', marginsHandler);
        
        // Column count slider
        const columnCountHandler = (e) => {
            const value = parseInt(e.target.value);
            this.dom.columnCountValue.value = value;
            this.settings.columnCount = value;
            this.updateGrid();
        };
        addSliderEvents(this.dom.columnCountSlider, columnCountHandler);
        this.dom.columnCountSlider.addEventListener('keyup', columnCountHandler);
        
        // Row count slider
        const rowCountHandler = (e) => {
            const value = parseInt(e.target.value);
            this.dom.rowCountValue.value = value;
            this.settings.rowCount = value;
            if (this.settings.linkRowsHeight) {
                this.calculateRowHeight();
            }
            this.updatePresetButtons();
            this.updateGrid();
        };
        addSliderEvents(this.dom.rowCountSlider, rowCountHandler);
        this.dom.rowCountSlider.addEventListener('keyup', rowCountHandler);
        
        // Row height slider
        const rowHeightHandler = (e) => {
            const value = parseInt(e.target.value);
            this.dom.rowHeightValue.value = value;
            this.settings.rowHeight = value;
            if (this.settings.linkRowsHeight) {
                this.calculateRowCount();
            }
            this.updatePresetButtons();
            this.updateGrid();
        };
        addSliderEvents(this.dom.rowHeightSlider, rowHeightHandler);
        this.dom.rowHeightSlider.addEventListener('keyup', rowHeightHandler);
        
        // Color preview button - toggle HSB picker
        this.dom.colorPreview.addEventListener('click', () => {
            const isVisible = this.dom.hsbPicker.style.display !== 'none';
            this.dom.hsbPicker.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                this.updateHSBFromHex(this.settings.boxColor);
            }
        });
        
        // HSB sliders
        const hueHandler = (e) => {
            const value = parseInt(e.target.value);
            this.dom.hueValue.value = value;
            this.updateColorFromHSB();
            this.updateSaturationGradient();
            this.updateBrightnessGradient();
        };
        this.dom.hueSlider.addEventListener('input', hueHandler);
        this.dom.hueSlider.addEventListener('change', hueHandler);
        
        const saturationHandler = (e) => {
            const value = parseInt(e.target.value);
            this.dom.saturationValue.value = value;
            this.updateColorFromHSB();
            this.updateBrightnessGradient();
        };
        this.dom.saturationSlider.addEventListener('input', saturationHandler);
        this.dom.saturationSlider.addEventListener('change', saturationHandler);
        
        const brightnessHandler = (e) => {
            const value = parseInt(e.target.value);
            this.dom.brightnessValue.value = value;
            this.updateColorFromHSB();
            this.updateSaturationGradient();
        };
        this.dom.brightnessSlider.addEventListener('input', brightnessHandler);
        this.dom.brightnessSlider.addEventListener('change', brightnessHandler);
        
        // Lunnen Blue preset
        this.dom.lunnenBlue.addEventListener('click', () => {
            const lunnenBlueColor = '#2353DB';
            this.settings.boxColor = lunnenBlueColor;
            this.dom.hexColorInput.value = lunnenBlueColor;
            this.dom.colorPreview.style.backgroundColor = lunnenBlueColor;
            this.updateHSBFromHex(lunnenBlueColor);
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
                this.dom.colorPreview.style.backgroundColor = hexValue;
                this.updateHSBFromHex(hexValue);
                this.updateGrid();
            }
        });
        
        // Validate hex input when focus is lost
        this.dom.hexColorInput.addEventListener('blur', (e) => {
            let hexValue = e.target.value;
            
            if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/)) {
                hexValue = '#e6e6e6';
            }
            
            e.target.value = hexValue;
            this.settings.boxColor = hexValue;
            this.dom.colorPreview.style.backgroundColor = hexValue;
            this.updateHSBFromHex(hexValue);
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
    
    updateLinkedControlsVisual() {
        // Update visual grouping of linked controls based on linkRowsHeight state
        if (this.dom.linkedControlsContainer) {
            if (this.settings.linkRowsHeight) {
                this.dom.linkedControlsContainer.classList.add('linked-controls-group');
            } else {
                this.dom.linkedControlsContainer.classList.remove('linked-controls-group');
            }
        }
    }
    
    initColorPreview() {
        // Set initial color preview
        this.dom.colorPreview.style.backgroundColor = this.settings.boxColor;
        this.updateHSBFromHex(this.settings.boxColor);
    }
    
    // Color conversion methods
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
    
    rgbToHsb(r, g, b) {
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
    
    hsbToRgb(h, s, b) {
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
        
        this.settings.boxColor = hex;
        this.dom.hexColorInput.value = hex;
        this.dom.colorPreview.style.backgroundColor = hex;
        this.updateGrid();
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
        
        // Prevent dragging from interactive elements
        panel.addEventListener('mousedown', (e) => {
            const target = e.target;
            // Don't interfere with input elements (sliders, text inputs, buttons, checkboxes)
            if (target.tagName === 'INPUT' || 
                target.tagName === 'BUTTON' || 
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT') {
                e.stopPropagation();
                return;
            }
        }, true); // Use capture phase
        
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        function dragStart(e) {
            // Only start dragging if clicking directly on header, not on interactive elements
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'BUTTON' || 
                e.target.tagName === 'TEXTAREA' ||
                e.target.tagName === 'SELECT') {
                return;
            }
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            
            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                panel.style.transition = 'none';
                
                // Bring this panel to front
                const allPanels = document.querySelectorAll('.controls-panel');
                allPanels.forEach(p => {
                    if (p === panel) {
                        p.style.zIndex = '1000';
                    } else {
                        p.style.zIndex = '999';
                    }
                });
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
            // Universal naming convention: inputValue -> inputSlider
            const sliderId = input.id.replace('Value', 'Slider');
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
        
        // Determine step based on slider type
        const sliderId = slider.id;
        const isIntegerSlider = (sliderId === 'columnCountSlider' || sliderId === 'rowCountSlider' || sliderId === 'rowHeightSlider' || 
                                sliderId === 'hueSlider' || sliderId === 'saturationSlider' || sliderId === 'brightnessSlider');
        const isModuleSlider = (sliderId === 'gridModuleSlider');
        const isMarginsSlider = (sliderId === 'marginsSlider');
        
        let baseStep, shiftStep;
        if (isIntegerSlider) {
            baseStep = 1;
            shiftStep = 10;
        } else if (isModuleSlider) {
            baseStep = 0.01;
            shiftStep = 0.1;
        } else if (isMarginsSlider) {
            baseStep = 0.5;
            shiftStep = 1.0;
        } else {
            baseStep = 0.5;
            shiftStep = 10;
        }
        
        let newValue;
        if (e.shiftKey && isModuleSlider) {
            // For Module with Shift: round to tenths first, then add/subtract 0.1
            const roundedToTenth = Math.round(currentValue * 10) / 10;
            const step = (e.key === 'ArrowUp' ? 1 : -1) * shiftStep;
            newValue = roundedToTenth + step;
        } else {
            const step = e.shiftKey ? shiftStep : baseStep;
            newValue = e.key === 'ArrowUp' ? currentValue + step : currentValue - step;
        }
        newValue = Math.max(min, Math.min(max, newValue));
        
        if (isIntegerSlider) {
            newValue = Math.round(newValue);
            slider.value = newValue;
            input.value = newValue;
        } else if (isModuleSlider || isMarginsSlider) {
            newValue = parseFloat(newValue.toFixed(2));
            slider.value = newValue;
            input.value = newValue.toFixed(2);
        } else {
            newValue = parseFloat(newValue.toFixed(1));
            slider.value = newValue;
            input.value = newValue.toFixed(1);
        }
        
        // Update settings
        if (sliderId === 'frontWidthSlider') {
            this.settings.frontWidth = newValue;
        } else if (sliderId === 'frontHeightSlider') {
            this.settings.frontHeight = newValue;
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'thicknessSlider') {
            this.settings.thickness = newValue;
        } else if (sliderId === 'gridModuleSlider') {
            this.settings.gridModule = newValue;
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'marginsSlider') {
            this.settings.margins = newValue;
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'columnCountSlider') {
            this.settings.columnCount = newValue;
        } else if (sliderId === 'rowCountSlider') {
            this.settings.rowCount = newValue;
            if (this.settings.linkRowsHeight) {
                this.calculateRowHeight();
            }
            this.updatePresetButtons();
        } else if (sliderId === 'rowHeightSlider') {
            this.settings.rowHeight = newValue;
            if (this.settings.linkRowsHeight) {
                this.calculateRowCount();
            }
            this.updatePresetButtons();
        } else if (sliderId === 'hueSlider') {
            this.updateColorFromHSB();
            this.updateSaturationGradient();
            this.updateBrightnessGradient();
            return; // HSB updates grid separately
        } else if (sliderId === 'saturationSlider') {
            this.updateColorFromHSB();
            this.updateBrightnessGradient();
            return; // HSB updates grid separately
        } else if (sliderId === 'brightnessSlider') {
            this.updateColorFromHSB();
            this.updateSaturationGradient();
            return; // HSB updates grid separately
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
        
        // Update settings
        const sliderId = slider.id;
        const isIntegerSlider = (sliderId === 'columnCountSlider' || sliderId === 'rowCountSlider' || sliderId === 'rowHeightSlider' || 
                                sliderId === 'hueSlider' || sliderId === 'saturationSlider' || sliderId === 'brightnessSlider');
        const isModuleSlider = (sliderId === 'gridModuleSlider');
        const isMarginsSlider = (sliderId === 'marginsSlider');
        
        if (isIntegerSlider) {
            numValue = Math.round(numValue);
            slider.value = numValue;
            input.value = numValue;
        } else if (isModuleSlider || isMarginsSlider) {
            numValue = parseFloat(numValue.toFixed(2));
            slider.value = numValue;
            input.value = numValue.toFixed(2);
        } else {
            numValue = parseFloat(numValue.toFixed(1));
            slider.value = numValue;
            input.value = numValue.toFixed(1);
        }
        
        if (sliderId === 'frontWidthSlider') {
            this.settings.frontWidth = numValue;
        } else if (sliderId === 'frontHeightSlider') {
            this.settings.frontHeight = numValue;
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'thicknessSlider') {
            this.settings.thickness = numValue;
        } else if (sliderId === 'gridModuleSlider') {
            this.settings.gridModule = numValue;
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'marginsSlider') {
            this.settings.margins = numValue;
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'columnCountSlider') {
            this.settings.columnCount = numValue;
        } else if (sliderId === 'rowCountSlider') {
            this.settings.rowCount = numValue;
            if (this.settings.linkRowsHeight) {
                this.calculateRowHeight();
            }
            this.updatePresetButtons();
        } else if (sliderId === 'rowHeightSlider') {
            this.settings.rowHeight = numValue;
            if (this.settings.linkRowsHeight) {
                this.calculateRowCount();
            }
            this.updatePresetButtons();
        } else if (sliderId === 'hueSlider') {
            this.updateColorFromHSB();
            this.updateSaturationGradient();
            this.updateBrightnessGradient();
            return; // HSB updates grid separately
        } else if (sliderId === 'saturationSlider') {
            this.updateColorFromHSB();
            this.updateBrightnessGradient();
            return; // HSB updates grid separately
        } else if (sliderId === 'brightnessSlider') {
            this.updateColorFromHSB();
            this.updateSaturationGradient();
            return; // HSB updates grid separately
        }
        
        this.updateGrid();
    }
    
    updateCanvasSize() {
        // Calculate canvas size based on viewport height
        const viewportHeight = window.innerHeight;
        const topBottomPadding = 40; // 20px padding on each side
        this.DISPLAY_SIZE = viewportHeight - topBottomPadding;
    }
    
    calculateRowCount() {
        // Calculate how many rows fit in the front height
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const rowHeightInModules = this.settings.rowHeight;
        
        // Available height = frontHeight - top and bottom margins
        const topMargin = module * margins;
        const bottomMargin = module * margins;
        const availableHeight = this.settings.frontHeight - topMargin - bottomMargin;
        
        // Height of one row with gutter
        const rowWithGutter = module * rowHeightInModules + module;
        
        // Calculate how many rows fit
        const rowCount = Math.floor((availableHeight + module) / rowWithGutter);
        
        this.settings.rowCount = Math.max(1, rowCount);
        
        // Update UI
        if (this.dom.rowCountValue) {
            this.dom.rowCountValue.value = this.settings.rowCount;
        }
        if (this.dom.rowCountSlider) {
            this.dom.rowCountSlider.value = this.settings.rowCount;
        }
    }
    
    calculateRowHeight() {
        // Calculate row height based on desired row count
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const rowCount = this.settings.rowCount;
        
        // Available height = frontHeight - top and bottom margins
        const topMargin = module * margins;
        const bottomMargin = module * margins;
        const availableHeight = this.settings.frontHeight - topMargin - bottomMargin;
        
        // Formula: rowCount × rowHeight × module + (rowCount - 1) × module ≤ availableHeight
        // Solve for rowHeight: rowHeight ≤ (availableHeight / module - rowCount + 1) / rowCount
        const availableModules = availableHeight / module;
        const rowHeight = Math.floor((availableModules - rowCount + 1) / rowCount);
        
        this.settings.rowHeight = Math.max(1, rowHeight);
        
        // Update UI
        if (this.dom.rowHeightValue) {
            this.dom.rowHeightValue.value = this.settings.rowHeight;
        }
        if (this.dom.rowHeightSlider) {
            this.dom.rowHeightSlider.value = this.settings.rowHeight;
        }
    }
    
    findPerfectRowCombinations() {
        // Find all combinations of rows and row height that fill the format perfectly
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const topMargin = module * margins;
        const bottomMargin = module * margins;
        const availableHeight = this.settings.frontHeight - topMargin - bottomMargin;
        const availableModules = availableHeight / module;
        
        const combinations = [];
        
        // Try different row heights from 1 to 20
        for (let rowHeight = 1; rowHeight <= 20; rowHeight++) {
            // Calculate how many rows fit with this height
            const rowWithGutter = rowHeight + 1; // row height + gutter (1 module)
            const rowCount = Math.floor((availableModules + 1) / rowWithGutter);
            
            if (rowCount < 1) continue;
            
            // Check if this combination fills the format perfectly (or very close)
            const totalUsed = rowCount * rowHeight + (rowCount - 1);
            const remaining = availableModules - totalUsed;
            
            // Only include if remaining space is less than 1 module (perfect fit)
            if (remaining >= 0 && remaining < 1) {
                combinations.push({ rowCount, rowHeight, remaining });
            }
        }
        
        // Sort by row count (descending)
        combinations.sort((a, b) => b.rowCount - a.rowCount);
        
        return combinations;
    }
    
    generateRowPresets() {
        const container = document.getElementById('rowPresetsContainer');
        if (!container) return;
        
        const combinations = this.findPerfectRowCombinations();
        
        // Clear existing buttons
        container.innerHTML = '';
        
        // Create buttons for each combination
        combinations.forEach(combo => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'row-preset-btn';
            button.textContent = `${combo.rowCount}:${combo.rowHeight}`;
            button.setAttribute('aria-label', `Set ${combo.rowCount} rows with height ${combo.rowHeight}`);
            
            button.addEventListener('click', () => {
                this.settings.rowCount = combo.rowCount;
                this.settings.rowHeight = combo.rowHeight;
                
                // Enable link if it was disabled
                if (!this.settings.linkRowsHeight) {
                    this.settings.linkRowsHeight = true;
                    this.dom.linkRowsHeight.checked = true;
                    this.updateLinkedControlsVisual();
                }
                
                // Update UI
                this.dom.rowCountValue.value = combo.rowCount;
                this.dom.rowCountSlider.value = combo.rowCount;
                this.dom.rowHeightValue.value = combo.rowHeight;
                this.dom.rowHeightSlider.value = combo.rowHeight;
                
                this.updateGrid();
                this.updatePresetButtons();
            });
            
            container.appendChild(button);
        });
        
        this.updatePresetButtons();
    }
    
    updatePresetButtons() {
        const container = document.getElementById('rowPresetsContainer');
        if (!container) return;
        
        const buttons = container.querySelectorAll('.row-preset-btn');
        buttons.forEach(button => {
            const [rowCount, rowHeight] = button.textContent.split(':').map(n => parseInt(n));
            if (rowCount === this.settings.rowCount && rowHeight === this.settings.rowHeight) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
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
        
        // Draw grid elements on front panel
        const frontX = startX + scaledThickness;
        const frontY = startY + scaledThickness;
        
        // Draw columns if enabled
        if (this.settings.showColumns) {
            this.drawColumns(frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        }
        
        // Draw rows if enabled
        if (this.settings.showRows) {
            this.drawRows(frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        }
        
        // Draw baseline if enabled
        if (this.settings.showBaseline) {
            this.drawBaseline(frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
            
            // Draw baseline on side panels if they are visible
            if (this.settings.showSidePanels) {
                // Left panel - vertical baseline (margin from right side where it touches front)
                this.drawBaselineVerticalLeftRight(startX, frontY, scaledThickness, scaledFrontHeight, scale, 'left');
                
                // Right panel - vertical baseline (margin from left side where it touches front)
                this.drawBaselineVerticalLeftRight(startX + scaledThickness + scaledFrontWidth, frontY, scaledThickness, scaledFrontHeight, scale, 'right');
                
                // Top panel - horizontal baseline (margin from bottom where it touches front)
                this.drawBaselineTopBottom(frontX, startY, scaledFrontWidth, scaledThickness, scale, 'top');
                
                // Bottom panel - horizontal baseline (margin from top where it touches front)
                this.drawBaselineTopBottom(frontX, startY + scaledThickness + scaledFrontHeight, scaledFrontWidth, scaledThickness, scale, 'bottom');
            }
        }
        
        // Draw columns on side panels if they are visible and columns are enabled
        if (this.settings.showColumns && this.settings.showSidePanels) {
            // Left panel - vertical columns (using rows parameters from front)
            this.drawColumnsVerticalLeftRight(startX, frontY, scaledThickness, scaledFrontHeight, scale, 'left');
            
            // Right panel - vertical columns (using rows parameters from front)
            this.drawColumnsVerticalLeftRight(startX + scaledThickness + scaledFrontWidth, frontY, scaledThickness, scaledFrontHeight, scale, 'right');
            
            // Top panel - horizontal columns (using columns parameters from front)
            this.drawColumnsTopBottom(frontX, startY, scaledFrontWidth, scaledThickness, scale, 'top');
            
            // Bottom panel - horizontal columns (using columns parameters from front)
            this.drawColumnsTopBottom(frontX, startY + scaledThickness + scaledFrontHeight, scaledFrontWidth, scaledThickness, scale, 'bottom');
        }
    }
    
    drawRectangles(x, y, frontW, frontH, thickness) {
        // Front (center) - always visible
        this.createRect(x + thickness, y + thickness, frontW, frontH);
        
        // Side panels - only if showSidePanels is enabled
        if (this.settings.showSidePanels) {
            // Left
            this.createRect(x, y + thickness, thickness, frontH);
            
            // Right
            this.createRect(x + thickness + frontW, y + thickness, thickness, frontH);
            
            // Top
            this.createRect(x + thickness, y, frontW, thickness);
            
            // Bottom
            this.createRect(x + thickness, y + thickness + frontH, frontW, thickness);
        }
    }
    
    createRect(x, y, width, height) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', this.settings.boxColor);
        rect.setAttribute('stroke', '#000000');
        rect.setAttribute('stroke-width', '0.5');
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
    
    getContrastColor() {
        // Calculate luminance of background color
        const hex = this.settings.boxColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        
        // Convert to linear RGB
        const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        const rLinear = toLinear(r);
        const gLinear = toLinear(g);
        const bLinear = toLinear(b);
        
        // Calculate relative luminance
        let luminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
        
        // Clamp luminance to avoid extreme values at pure black/white
        // This prevents harsh contrast jumps at #000000 and #ffffff
        const minLuminance = 0.02;
        const maxLuminance = 0.98;
        luminance = Math.max(minLuminance, Math.min(maxLuminance, luminance));
        
        // Store clamped luminance for opacity calculation
        this.currentLuminance = luminance;
        
        // Return black for light backgrounds, white for dark backgrounds
        // Use original luminance for color decision to keep accurate contrast
        const originalLuminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
        return originalLuminance > 0.5 ? '#000000' : '#ffffff';
    }
    
    getGridOpacity(baseOpacity) {
        // Calculate opacity based on luminance
        // Maximum opacity when luminance is around 0.5 (medium brightness)
        // Reduced opacity when luminance is close to extremes (very dark or very light)
        
        const luminance = this.currentLuminance || 0.5;
        
        // Use a parabolic curve: maximum at 0.5, minimum at edges
        // Formula: 1 - (2 * luminance - 1)^2
        // luminance is already clamped in getContrastColor()
        const factor = 1 - Math.pow(2 * luminance - 1, 2);
        
        // Define opacity range
        const minOpacity = baseOpacity * 0.3; // 30% of base opacity at extremes
        const maxOpacity = baseOpacity;       // 100% of base opacity at medium
        
        // Calculate final opacity
        const opacity = minOpacity + (maxOpacity - minOpacity) * factor;
        
        return opacity;
    }
    
    drawColumns(x, y, width, height, scale) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.columnCount;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.1);
        
        // Calculate column width based on available space
        // Formula: columnWidth = (frontWidth - module × margins × 2 - module × (n - 1)) / n
        const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (n - 1)) / n;
        
        const margin = module * margins * scale;
        const scaledColumnWidth = columnWidth * scale;
        const gutter = module * scale;
        
        let currentX = x + margin;
        
        for (let i = 0; i < n; i++) {
            const column = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            column.setAttribute('x', currentX);
            column.setAttribute('y', y + margin);
            column.setAttribute('width', scaledColumnWidth);
            column.setAttribute('height', height - 2 * margin);
            column.setAttribute('fill', gridColor);
            column.setAttribute('fill-opacity', opacity);
            column.setAttribute('stroke', 'none');
            this.dom.svg.appendChild(column);
            
            currentX += scaledColumnWidth + gutter;
        }
    }
    
    drawRows(x, y, width, height, scale) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.rowCount;
        const rowHeightInModules = this.settings.rowHeight;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.1);
        
        const topMargin = module * margins * scale;
        const sideMargin = module * margins * scale;
        const rowHeight = module * rowHeightInModules * scale;
        const rowWidth = width - 2 * sideMargin;
        const gutter = module * scale;
        
        let currentY = y + topMargin;
        
        // Draw rows starting from top with fixed top margin
        // Bottom margin will be whatever remains
        for (let i = 0; i < n; i++) {
            // Check if there's enough space for this row
            if (currentY + rowHeight > y + height) {
                break; // Stop if we exceed the available height
            }
            
            const row = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            row.setAttribute('x', x + sideMargin);
            row.setAttribute('y', currentY);
            row.setAttribute('width', rowWidth);
            row.setAttribute('height', rowHeight);
            row.setAttribute('fill', gridColor);
            row.setAttribute('fill-opacity', opacity);
            row.setAttribute('stroke', 'none');
            this.dom.svg.appendChild(row);
            
            currentY += rowHeight + gutter;
        }
    }
    
    drawBaseline(x, y, width, height, scale) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.3);
        const margin = module * margins * scale;
        const baselineHeight = module * scale;
        const baselineWidth = width - 2 * margin;
        
        let currentY = y + margin;
        const maxY = y + height - margin;
        
        while (currentY + baselineHeight <= maxY) {
            const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            baseline.setAttribute('x', x + margin);
            baseline.setAttribute('y', currentY);
            baseline.setAttribute('width', baselineWidth);
            baseline.setAttribute('height', baselineHeight);
            baseline.setAttribute('fill', 'none');
            baseline.setAttribute('stroke', gridColor);
            baseline.setAttribute('stroke-width', '0.5');
            baseline.setAttribute('stroke-opacity', opacity);
            this.dom.svg.appendChild(baseline);
            
            currentY += baselineHeight;
        }
    }
    
    drawColumnsVerticalLeftRight(x, y, width, height, scale, side) {
        // Left and right panels use rows parameters from front (rotated 90°)
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.rowCount;
        const rowHeightInModules = this.settings.rowHeight;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.1);
        
        // Calculate "column" height (which is row height from front panel)
        const columnHeight = module * rowHeightInModules * scale;
        const margin = module * margins * scale;
        const gutter = module * scale;
        
        // Width with margins (same as front panel height logic)
        const columnWidth = width - 2 * margin;
        
        let currentY = y + margin;
        
        // Draw n "columns" vertically (using row parameters)
        for (let i = 0; i < n; i++) {
            // Check if there's enough space for this column
            if (currentY + columnHeight > y + height - margin) {
                break;
            }
            
            const column = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            column.setAttribute('x', x + margin);
            column.setAttribute('y', currentY);
            column.setAttribute('width', columnWidth);
            column.setAttribute('height', columnHeight);
            column.setAttribute('fill', gridColor);
            column.setAttribute('fill-opacity', opacity);
            column.setAttribute('stroke', 'none');
            this.dom.svg.appendChild(column);
            
            currentY += columnHeight + gutter;
        }
    }
    
    drawColumnsTopBottom(x, y, width, height, scale, side) {
        // Top and bottom panels use the same columns parameters as front
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.columnCount;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.1);
        
        // Calculate column width (same as front panel)
        const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (n - 1)) / n;
        
        const margin = module * margins * scale;
        const scaledColumnWidth = columnWidth * scale;
        const gutter = module * scale;
        
        // Height with margins
        const columnHeight = height - 2 * margin;
        
        let currentX = x + margin;
        
        for (let i = 0; i < n; i++) {
            const column = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            column.setAttribute('x', currentX);
            column.setAttribute('y', y + margin);
            column.setAttribute('width', scaledColumnWidth);
            column.setAttribute('height', columnHeight);
            column.setAttribute('fill', gridColor);
            column.setAttribute('fill-opacity', opacity);
            column.setAttribute('stroke', 'none');
            this.dom.svg.appendChild(column);
            
            currentX += scaledColumnWidth + gutter;
        }
    }
    
    drawBaselineVerticalLeftRight(x, y, width, height, scale, side) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.3);
        const margin = module * margins * scale;
        const baselineWidth = module * scale;
        
        // Height with margins top and bottom
        const baselineHeight = height - 2 * margin;
        
        // Left panel: start from right edge (touching front) with margin, go left
        // Right panel: start from left edge (touching front) with margin, go right
        let currentX, minX, maxX;
        
        if (side === 'left') {
            // Calculate how many full-width elements can fit
            const availableWidth = width - 2 * margin;
            const numFullElements = Math.floor(availableWidth / baselineWidth);
            
            // Start from right edge with margin
            currentX = x + width - margin;
            
            // Draw elements from right to left (only full-width elements)
            for (let i = 0; i < numFullElements; i++) {
                const elementWidth = baselineWidth;
                const elementX = currentX - elementWidth;
                
                const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                baseline.setAttribute('x', elementX);
                baseline.setAttribute('y', y + margin);
                baseline.setAttribute('width', elementWidth);
                baseline.setAttribute('height', baselineHeight);
                baseline.setAttribute('fill', 'none');
                baseline.setAttribute('stroke', gridColor);
                baseline.setAttribute('stroke-width', '0.5');
                baseline.setAttribute('stroke-opacity', opacity);
                this.dom.svg.appendChild(baseline);
                
                currentX -= elementWidth;
            }
            
            // Draw a vertical line at the left margin
            const marginLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            marginLine.setAttribute('x1', x + margin);
            marginLine.setAttribute('y1', y + margin);
            marginLine.setAttribute('x2', x + margin);
            marginLine.setAttribute('y2', y + height - margin);
            marginLine.setAttribute('stroke', gridColor);
            marginLine.setAttribute('stroke-width', '0.5');
            marginLine.setAttribute('stroke-opacity', opacity);
            this.dom.svg.appendChild(marginLine);
            
        } else { // right
            // Calculate how many full-width elements can fit
            const availableWidth = width - 2 * margin;
            const numFullElements = Math.floor(availableWidth / baselineWidth);
            
            // Start from left edge + margin, go right
            currentX = x + margin;
            
            // Draw elements from left to right (only full-width elements)
            for (let i = 0; i < numFullElements; i++) {
                const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                baseline.setAttribute('x', currentX);
                baseline.setAttribute('y', y + margin);
                baseline.setAttribute('width', baselineWidth);
                baseline.setAttribute('height', baselineHeight);
                baseline.setAttribute('fill', 'none');
                baseline.setAttribute('stroke', gridColor);
                baseline.setAttribute('stroke-width', '0.5');
                baseline.setAttribute('stroke-opacity', opacity);
                this.dom.svg.appendChild(baseline);
                
                currentX += baselineWidth;
            }
            
            // Draw a vertical line at the right margin
            const marginLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            marginLine.setAttribute('x1', x + width - margin);
            marginLine.setAttribute('y1', y + margin);
            marginLine.setAttribute('x2', x + width - margin);
            marginLine.setAttribute('y2', y + height - margin);
            marginLine.setAttribute('stroke', gridColor);
            marginLine.setAttribute('stroke-width', '0.5');
            marginLine.setAttribute('stroke-opacity', opacity);
            this.dom.svg.appendChild(marginLine);
        }
    }
    
    drawBaselineTopBottom(x, y, width, height, scale, side) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.3);
        const margin = module * margins * scale;
        const baselineHeight = module * scale;
        
        // Width with margins left and right
        const baselineWidth = width - 2 * margin;
        
        // Top panel: start from bottom edge (touching front) with margin, go up
        // Bottom panel: start from top edge (touching front) with margin, go down
        let currentY;
        
        if (side === 'top') {
            // Calculate how many full-height elements can fit
            const availableHeight = height - 2 * margin;
            const numFullElements = Math.floor(availableHeight / baselineHeight);
            
            // Start from bottom edge with margin
            currentY = y + height - margin;
            
            // Draw only full-height elements from bottom to top
            for (let i = 0; i < numFullElements; i++) {
                const elementY = currentY - baselineHeight;
                
                const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                baseline.setAttribute('x', x + margin);
                baseline.setAttribute('y', elementY);
                baseline.setAttribute('width', baselineWidth);
                baseline.setAttribute('height', baselineHeight);
                baseline.setAttribute('fill', 'none');
                baseline.setAttribute('stroke', gridColor);
                baseline.setAttribute('stroke-width', '0.5');
                baseline.setAttribute('stroke-opacity', opacity);
                this.dom.svg.appendChild(baseline);
                
                currentY -= baselineHeight;
            }
            
            // Draw a horizontal line at the top margin
            const marginLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            marginLine.setAttribute('x1', x + margin);
            marginLine.setAttribute('y1', y + margin);
            marginLine.setAttribute('x2', x + width - margin);
            marginLine.setAttribute('y2', y + margin);
            marginLine.setAttribute('stroke', gridColor);
            marginLine.setAttribute('stroke-width', '0.5');
            marginLine.setAttribute('stroke-opacity', opacity);
            this.dom.svg.appendChild(marginLine);
            
        } else { // bottom
            // Calculate how many full-height elements can fit
            const availableHeight = height - 2 * margin;
            const numFullElements = Math.floor(availableHeight / baselineHeight);
            
            // Start from top edge + margin, go down
            currentY = y + margin;
            
            // Draw only full-height elements from top to bottom
            for (let i = 0; i < numFullElements; i++) {
                const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                baseline.setAttribute('x', x + margin);
                baseline.setAttribute('y', currentY);
                baseline.setAttribute('width', baselineWidth);
                baseline.setAttribute('height', baselineHeight);
                baseline.setAttribute('fill', 'none');
                baseline.setAttribute('stroke', gridColor);
                baseline.setAttribute('stroke-width', '0.5');
                baseline.setAttribute('stroke-opacity', opacity);
                this.dom.svg.appendChild(baseline);
                
                currentY += baselineHeight;
            }
            
            // Draw a horizontal line at the bottom margin
            const marginLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            marginLine.setAttribute('x1', x + margin);
            marginLine.setAttribute('y1', y + height - margin);
            marginLine.setAttribute('x2', x + width - margin);
            marginLine.setAttribute('y2', y + height - margin);
            marginLine.setAttribute('stroke', gridColor);
            marginLine.setAttribute('stroke-width', '0.5');
            marginLine.setAttribute('stroke-opacity', opacity);
            this.dom.svg.appendChild(marginLine);
        }
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
        
        // Create groups for better organization in Figma/Illustrator
        const boxGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        boxGroup.setAttribute('id', 'box');
        exportSvg.appendChild(boxGroup);
        
        // Draw rectangles at actual mm scale
        this.drawRectanglesToSVG(boxGroup, 0, 0, frontWidth, frontHeight, thickness);
        
        // Draw grid elements on front panel (in mm)
        const frontX = thickness;
        const frontY = thickness;
        
        // Draw columns if enabled (in separate group)
        if (this.settings.showColumns) {
            const columnsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            columnsGroup.setAttribute('id', 'columns');
            exportSvg.appendChild(columnsGroup);
            this.drawColumnsToSVG(columnsGroup, frontX, frontY, frontWidth, frontHeight);
            
            // Draw columns on side panels if enabled
            if (this.settings.showSidePanels) {
                // Left panel - vertical columns (using rows parameters from front)
                this.drawColumnsVerticalLeftRightToSVG(columnsGroup, 0, frontY, thickness, frontHeight, 'left');
                
                // Right panel - vertical columns (using rows parameters from front)
                this.drawColumnsVerticalLeftRightToSVG(columnsGroup, thickness + frontWidth, frontY, thickness, frontHeight, 'right');
                
                // Top panel - horizontal columns (using columns parameters from front)
                this.drawColumnsTopBottomToSVG(columnsGroup, frontX, 0, frontWidth, thickness, 'top');
                
                // Bottom panel - horizontal columns (using columns parameters from front)
                this.drawColumnsTopBottomToSVG(columnsGroup, frontX, thickness + frontHeight, frontWidth, thickness, 'bottom');
            }
        }
        
        // Draw rows if enabled (in separate group)
        if (this.settings.showRows) {
            const rowsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            rowsGroup.setAttribute('id', 'rows');
            exportSvg.appendChild(rowsGroup);
            this.drawRowsToSVG(rowsGroup, frontX, frontY, frontWidth, frontHeight);
        }
        
        // Draw baseline if enabled (in separate group)
        if (this.settings.showBaseline) {
            const baselineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            baselineGroup.setAttribute('id', 'baseline');
            exportSvg.appendChild(baselineGroup);
            
            // Front panel baseline
            this.drawBaselineToSVG(baselineGroup, frontX, frontY, frontWidth, frontHeight);
            
            // Side panels baseline if enabled
            if (this.settings.showSidePanels) {
                // Left panel - vertical baseline (margin from right side where it touches front)
                this.drawBaselineVerticalLeftRightToSVG(baselineGroup, 0, frontY, thickness, frontHeight, 'left');
                
                // Right panel - vertical baseline (margin from left side where it touches front)
                this.drawBaselineVerticalLeftRightToSVG(baselineGroup, thickness + frontWidth, frontY, thickness, frontHeight, 'right');
                
                // Top panel - horizontal baseline (margin from bottom where it touches front)
                this.drawBaselineTopBottomToSVG(baselineGroup, frontX, 0, frontWidth, thickness, 'top');
                
                // Bottom panel - horizontal baseline (margin from top where it touches front)
                this.drawBaselineTopBottomToSVG(baselineGroup, frontX, thickness + frontHeight, frontWidth, thickness, 'bottom');
            }
        }
        
        // Add dimensions if enabled (in separate group)
        if (this.settings.showDimensions) {
            const dimensionsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            dimensionsGroup.setAttribute('id', 'dimensions');
            exportSvg.appendChild(dimensionsGroup);
            this.drawDimensionsToSVG(dimensionsGroup, 0, 0, frontWidth, frontHeight, thickness);
        }
        
        // Add labels if enabled (in separate group)
        if (this.settings.showLabels) {
            const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelsGroup.setAttribute('id', 'labels');
            exportSvg.appendChild(labelsGroup);
            this.drawLabelsToSVG(labelsGroup, 0, 0, frontWidth, frontHeight, thickness);
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
        
        // Front (center) - always visible
        createRect(x + thickness, y + thickness, frontW, frontH);
        
        // Side panels - only if showSidePanels is enabled
        if (this.settings.showSidePanels) {
            // Left
            createRect(x, y + thickness, thickness, frontH);
            
            // Right
            createRect(x + thickness + frontW, y + thickness, thickness, frontH);
            
            // Top
            createRect(x + thickness, y, frontW, thickness);
            
            // Bottom
            createRect(x + thickness, y + thickness + frontH, frontW, thickness);
        }
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
    
    drawColumnsToSVG(svg, x, y, width, height) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.columnCount;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.1);
        
        // Calculate column width in mm (scale = 1 for export)
        const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (n - 1)) / n;
        
        const margin = module * margins;
        const gutter = module;
        
        let currentX = x + margin;
        
        for (let i = 0; i < n; i++) {
            const column = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            column.setAttribute('x', currentX);
            column.setAttribute('y', y + margin);
            column.setAttribute('width', columnWidth);
            column.setAttribute('height', height - 2 * margin);
            column.setAttribute('fill', gridColor);
            column.setAttribute('fill-opacity', opacity);
            column.setAttribute('stroke', 'none');
            svg.appendChild(column);
            
            currentX += columnWidth + gutter;
        }
    }
    
    drawRowsToSVG(svg, x, y, width, height) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.rowCount;
        const rowHeightInModules = this.settings.rowHeight;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.1);
        
        const topMargin = module * margins;
        const sideMargin = module * margins;
        const rowHeight = module * rowHeightInModules;
        const rowWidth = width - 2 * sideMargin;
        const gutter = module;
        
        let currentY = y + topMargin;
        
        for (let i = 0; i < n; i++) {
            // Check if there's enough space for this row
            if (currentY + rowHeight > y + height) {
                break;
            }
            
            const row = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            row.setAttribute('x', x + sideMargin);
            row.setAttribute('y', currentY);
            row.setAttribute('width', rowWidth);
            row.setAttribute('height', rowHeight);
            row.setAttribute('fill', gridColor);
            row.setAttribute('fill-opacity', opacity);
            row.setAttribute('stroke', 'none');
            svg.appendChild(row);
            
            currentY += rowHeight + gutter;
        }
    }
    
    drawBaselineToSVG(svg, x, y, width, height) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.3);
        const margin = module * margins;
        const baselineHeight = module;
        const baselineWidth = width - 2 * margin;
        
        let currentY = y + margin;
        const maxY = y + height - margin;
        
        while (currentY + baselineHeight <= maxY) {
            const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            baseline.setAttribute('x', x + margin);
            baseline.setAttribute('y', currentY);
            baseline.setAttribute('width', baselineWidth);
            baseline.setAttribute('height', baselineHeight);
            baseline.setAttribute('fill', 'none');
            baseline.setAttribute('stroke', gridColor);
            baseline.setAttribute('stroke-width', '0.5');
            baseline.setAttribute('stroke-opacity', opacity);
            svg.appendChild(baseline);
            
            currentY += baselineHeight;
        }
    }
    
    drawColumnsVerticalLeftRightToSVG(svg, x, y, width, height, side) {
        // Left and right panels use rows parameters from front (rotated 90°)
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.rowCount;
        const rowHeightInModules = this.settings.rowHeight;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.1);
        
        // Calculate "column" height (which is row height from front panel)
        const columnHeight = module * rowHeightInModules;
        const margin = module * margins;
        const gutter = module;
        
        // Width with margins (same as front panel height logic)
        const columnWidth = width - 2 * margin;
        
        let currentY = y + margin;
        
        // Draw n "columns" vertically (using row parameters)
        for (let i = 0; i < n; i++) {
            // Check if there's enough space for this column
            if (currentY + columnHeight > y + height - margin) {
                break;
            }
            
            const column = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            column.setAttribute('x', x + margin);
            column.setAttribute('y', currentY);
            column.setAttribute('width', columnWidth);
            column.setAttribute('height', columnHeight);
            column.setAttribute('fill', gridColor);
            column.setAttribute('fill-opacity', opacity);
            column.setAttribute('stroke', 'none');
            svg.appendChild(column);
            
            currentY += columnHeight + gutter;
        }
    }
    
    drawColumnsTopBottomToSVG(svg, x, y, width, height, side) {
        // Top and bottom panels use the same columns parameters as front
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.columnCount;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.1);
        
        // Calculate column width (same as front panel)
        const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (n - 1)) / n;
        
        const margin = module * margins;
        const gutter = module;
        
        // Height with margins
        const columnHeight = height - 2 * margin;
        
        let currentX = x + margin;
        
        for (let i = 0; i < n; i++) {
            const column = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            column.setAttribute('x', currentX);
            column.setAttribute('y', y + margin);
            column.setAttribute('width', columnWidth);
            column.setAttribute('height', columnHeight);
            column.setAttribute('fill', gridColor);
            column.setAttribute('fill-opacity', opacity);
            column.setAttribute('stroke', 'none');
            svg.appendChild(column);
            
            currentX += columnWidth + gutter;
        }
    }
    
    drawBaselineVerticalLeftRightToSVG(svg, x, y, width, height, side) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.3);
        const margin = module * margins;
        const baselineWidth = module;
        
        // Height with margins top and bottom
        const baselineHeight = height - 2 * margin;
        
        // Left panel: start from right edge (touching front) with margin, go left
        // Right panel: start from left edge (touching front) with margin, go right
        let currentX;
        
        if (side === 'left') {
            // Calculate how many full-width elements can fit
            const availableWidth = width - 2 * margin;
            const numFullElements = Math.floor(availableWidth / baselineWidth);
            
            // Start from right edge with margin
            currentX = x + width - margin;
            
            // Draw elements from right to left (only full-width elements)
            for (let i = 0; i < numFullElements; i++) {
                const elementWidth = baselineWidth;
                const elementX = currentX - elementWidth;
                
                const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                baseline.setAttribute('x', elementX);
                baseline.setAttribute('y', y + margin);
                baseline.setAttribute('width', elementWidth);
                baseline.setAttribute('height', baselineHeight);
                baseline.setAttribute('fill', 'none');
                baseline.setAttribute('stroke', gridColor);
                baseline.setAttribute('stroke-width', '0.5');
                baseline.setAttribute('stroke-opacity', opacity);
                svg.appendChild(baseline);
                
                currentX -= elementWidth;
            }
            
            // Draw a vertical line at the left margin
            const marginLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            marginLine.setAttribute('x1', x + margin);
            marginLine.setAttribute('y1', y + margin);
            marginLine.setAttribute('x2', x + margin);
            marginLine.setAttribute('y2', y + height - margin);
            marginLine.setAttribute('stroke', gridColor);
            marginLine.setAttribute('stroke-width', '0.5');
            marginLine.setAttribute('stroke-opacity', opacity);
            svg.appendChild(marginLine);
            
        } else { // right
            // Calculate how many full-width elements can fit
            const availableWidth = width - 2 * margin;
            const numFullElements = Math.floor(availableWidth / baselineWidth);
            
            // Start from left edge + margin, go right
            currentX = x + margin;
            
            // Draw elements from left to right (only full-width elements)
            for (let i = 0; i < numFullElements; i++) {
                const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                baseline.setAttribute('x', currentX);
                baseline.setAttribute('y', y + margin);
                baseline.setAttribute('width', baselineWidth);
                baseline.setAttribute('height', baselineHeight);
                baseline.setAttribute('fill', 'none');
                baseline.setAttribute('stroke', gridColor);
                baseline.setAttribute('stroke-width', '0.5');
                baseline.setAttribute('stroke-opacity', opacity);
                svg.appendChild(baseline);
                
                currentX += baselineWidth;
            }
            
            // Draw a vertical line at the right margin
            const marginLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            marginLine.setAttribute('x1', x + width - margin);
            marginLine.setAttribute('y1', y + margin);
            marginLine.setAttribute('x2', x + width - margin);
            marginLine.setAttribute('y2', y + height - margin);
            marginLine.setAttribute('stroke', gridColor);
            marginLine.setAttribute('stroke-width', '0.5');
            marginLine.setAttribute('stroke-opacity', opacity);
            svg.appendChild(marginLine);
        }
    }
    
    drawBaselineTopBottomToSVG(svg, x, y, width, height, side) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.3);
        const margin = module * margins;
        const baselineHeight = module;
        
        // Width with margins left and right
        const baselineWidth = width - 2 * margin;
        
        // Top panel: start from bottom edge (touching front) with margin, go up
        // Bottom panel: start from top edge (touching front) with margin, go down
        let currentY;
        
        if (side === 'top') {
            // Calculate how many full-height elements can fit
            const availableHeight = height - 2 * margin;
            const numFullElements = Math.floor(availableHeight / baselineHeight);
            
            // Start from bottom edge with margin
            currentY = y + height - margin;
            
            // Draw only full-height elements from bottom to top
            for (let i = 0; i < numFullElements; i++) {
                const elementY = currentY - baselineHeight;
                
                const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                baseline.setAttribute('x', x + margin);
                baseline.setAttribute('y', elementY);
                baseline.setAttribute('width', baselineWidth);
                baseline.setAttribute('height', baselineHeight);
                baseline.setAttribute('fill', 'none');
                baseline.setAttribute('stroke', gridColor);
                baseline.setAttribute('stroke-width', '0.5');
                baseline.setAttribute('stroke-opacity', opacity);
                svg.appendChild(baseline);
                
                currentY -= baselineHeight;
            }
            
            // Draw a horizontal line at the top margin
            const marginLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            marginLine.setAttribute('x1', x + margin);
            marginLine.setAttribute('y1', y + margin);
            marginLine.setAttribute('x2', x + width - margin);
            marginLine.setAttribute('y2', y + margin);
            marginLine.setAttribute('stroke', gridColor);
            marginLine.setAttribute('stroke-width', '0.5');
            marginLine.setAttribute('stroke-opacity', opacity);
            svg.appendChild(marginLine);
            
        } else { // bottom
            // Calculate how many full-height elements can fit
            const availableHeight = height - 2 * margin;
            const numFullElements = Math.floor(availableHeight / baselineHeight);
            
            // Start from top edge + margin, go down
            currentY = y + margin;
            
            // Draw only full-height elements from top to bottom
            for (let i = 0; i < numFullElements; i++) {
                const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                baseline.setAttribute('x', x + margin);
                baseline.setAttribute('y', currentY);
                baseline.setAttribute('width', baselineWidth);
                baseline.setAttribute('height', baselineHeight);
                baseline.setAttribute('fill', 'none');
                baseline.setAttribute('stroke', gridColor);
                baseline.setAttribute('stroke-width', '0.5');
                baseline.setAttribute('stroke-opacity', opacity);
                svg.appendChild(baseline);
                
                currentY += baselineHeight;
            }
            
            // Draw a horizontal line at the bottom margin
            const marginLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            marginLine.setAttribute('x1', x + margin);
            marginLine.setAttribute('y1', y + height - margin);
            marginLine.setAttribute('x2', x + width - margin);
            marginLine.setAttribute('y2', y + height - margin);
            marginLine.setAttribute('stroke', gridColor);
            marginLine.setAttribute('stroke-width', '0.5');
            marginLine.setAttribute('stroke-opacity', opacity);
            svg.appendChild(marginLine);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GridGenerator();
});

