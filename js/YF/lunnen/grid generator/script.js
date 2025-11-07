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
            gridModule: 2.91,  // mm - base unit for gutter and baseline
            margins: 2,  // in modules - margin from edges
            columnCount: 12,
            rowCount: 20,  // will be calculated after DOM is ready
            rowHeight: 6,  // in modules
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
            showSidePanels: document.getElementById('showSidePanels'),
            showColumns: document.getElementById('showColumns'),
            showRows: document.getElementById('showRows'),
            showBaseline: document.getElementById('showBaseline'),
            
            // Grid controls
            gridModuleSlider: document.getElementById('gridModule'),
            gridModuleValue: document.getElementById('gridModuleValue'),
            marginsSlider: document.getElementById('margins'),
            marginsValue: document.getElementById('marginsValue'),
            columnCountSlider: document.getElementById('columnCount'),
            columnCountValue: document.getElementById('columnCountValue'),
            rowCountSlider: document.getElementById('rowCount'),
            rowCountValue: document.getElementById('rowCountValue'),
            rowHeightSlider: document.getElementById('rowHeight'),
            rowHeightValue: document.getElementById('rowHeightValue'),
            
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
            this.dom.marginsValue.value = value.toFixed(1);
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
            this.calculateRowHeight();
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
            this.calculateRowCount();
            this.updatePresetButtons();
            this.updateGrid();
        };
        addSliderEvents(this.dom.rowHeightSlider, rowHeightHandler);
        this.dom.rowHeightSlider.addEventListener('keyup', rowHeightHandler);
        
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
                hexValue = '#e6e6e6';
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
        } else if (sliderId === 'gridModule') {
            this.settings.gridModule = newValue;
            this.dom.gridModuleValue.value = newValue.toFixed(2);
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'margins') {
            this.settings.margins = newValue;
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'columnCount') {
            const intValue = Math.round(newValue);
            slider.value = intValue;
            input.value = intValue;
            this.settings.columnCount = intValue;
        } else if (sliderId === 'rowCount') {
            const intValue = Math.round(newValue);
            slider.value = intValue;
            input.value = intValue;
            this.settings.rowCount = intValue;
            this.calculateRowHeight();
            this.updatePresetButtons();
        } else if (sliderId === 'rowHeight') {
            const intValue = Math.round(newValue);
            slider.value = intValue;
            input.value = intValue;
            this.settings.rowHeight = intValue;
            this.calculateRowCount();
            this.updatePresetButtons();
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
        } else if (sliderId === 'gridModule') {
            this.settings.gridModule = numValue;
            this.dom.gridModuleValue.value = numValue.toFixed(2);
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'margins') {
            this.settings.margins = numValue;
            this.calculateRowCount();
            this.generateRowPresets();
        } else if (sliderId === 'columnCount') {
            const intValue = Math.round(numValue);
            slider.value = intValue;
            input.value = intValue;
            this.settings.columnCount = intValue;
        } else if (sliderId === 'rowCount') {
            const intValue = Math.round(numValue);
            slider.value = intValue;
            input.value = intValue;
            this.settings.rowCount = intValue;
            this.calculateRowHeight();
            this.updatePresetButtons();
        } else if (sliderId === 'rowHeight') {
            const intValue = Math.round(numValue);
            slider.value = intValue;
            input.value = intValue;
            this.settings.rowHeight = intValue;
            this.calculateRowCount();
            this.updatePresetButtons();
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
    
    drawColumns(x, y, width, height, scale) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.columnCount;
        
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
            column.setAttribute('fill', '#ff0000');
            column.setAttribute('fill-opacity', '0.05');
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
            row.setAttribute('fill', '#ff0000');
            row.setAttribute('fill-opacity', '0.05');
            row.setAttribute('stroke', 'none');
            this.dom.svg.appendChild(row);
            
            currentY += rowHeight + gutter;
        }
    }
    
    drawBaseline(x, y, width, height, scale) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
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
            baseline.setAttribute('stroke', '#ff0000');
            baseline.setAttribute('stroke-width', '0.04');
            this.dom.svg.appendChild(baseline);
            
            currentY += baselineHeight;
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
            this.drawBaselineToSVG(baselineGroup, frontX, frontY, frontWidth, frontHeight);
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
            column.setAttribute('fill', '#ff0000');
            column.setAttribute('fill-opacity', '0.05');
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
            row.setAttribute('fill', '#ff0000');
            row.setAttribute('fill-opacity', '0.05');
            row.setAttribute('stroke', 'none');
            svg.appendChild(row);
            
            currentY += rowHeight + gutter;
        }
    }
    
    drawBaselineToSVG(svg, x, y, width, height) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
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
            baseline.setAttribute('stroke', '#ff0000');
            baseline.setAttribute('stroke-width', '0.04');
            svg.appendChild(baseline);
            
            currentY += baselineHeight;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GridGenerator();
});

