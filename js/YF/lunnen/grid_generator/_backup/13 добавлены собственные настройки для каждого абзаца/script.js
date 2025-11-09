class GridGenerator {
    constructor() {
        // Slider configuration - defines behavior for each slider
        this.SLIDER_CONFIG = {
            frontWidthSlider: {
                setting: 'frontWidth',
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => this.updateGrid()
            },
            frontHeightSlider: {
                setting: 'frontHeight',
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        this.calculateModule();
                    } else {
                        this.calculateRowCount();
                    }
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            thicknessSlider: {
                setting: 'thickness',
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => this.updateGrid()
            },
            gridModuleSlider: {
                setting: 'gridModule',
                decimals: 4,
                baseStep: 0.0001,
                shiftStep: 0.1,
                onUpdate: () => {
                    this.calculateRowCount();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            marginsSlider: {
                setting: 'margins',
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        this.calculateModule();
                    } else {
                        this.calculateRowCount();
                    }
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            columnCountSlider: {
                setting: 'columnCount',
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateTextWidthConstraints();
                    this.updateGrid();
                }
            },
            rowCountSlider: {
                setting: 'rowCount',
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        this.calculateModule();
                    } else if (this.settings.linkMode === 'rows-height') {
                        this.calculateRowHeight();
                    }
                    this.updatePresetButtons();
                    this.updateGrid();
                }
            },
            rowHeightSlider: {
                setting: 'rowHeight',
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        this.calculateModule();
                    } else if (this.settings.linkMode === 'rows-height') {
                        this.calculateRowCount();
                    }
                    this.updatePresetButtons();
                    this.updateGrid();
                }
            },
            hueSlider: {
                setting: null, // Handled specially
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                    this.updateSaturationGradient();
                    this.updateBrightnessGradient();
                }
            },
            saturationSlider: {
                setting: null, // Handled specially
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                    this.updateBrightnessGradient();
                }
            },
            brightnessSlider: {
                setting: null, // Handled specially
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                    this.updateSaturationGradient();
                }
            },
            headlineSizeSlider: {
                setting: 'headlineSize',
                decimals: 2,
                baseStep: 0.25,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            lineHeightSlider: {
                setting: 'lineHeight',
                decimals: 2,
                baseStep: 0.25,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            trackingSlider: {
                setting: 'tracking',
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.05,
                onUpdate: () => this.updateGrid()
            },
            textSizeSlider: {
                setting: 'textSize',
                decimals: 2,
                baseStep: 0.25,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            textLineHeightSlider: {
                setting: 'textLineHeight',
                decimals: 2,
                baseStep: 0.25,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            textTrackingSlider: {
                setting: 'textTracking',
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.05,
                onUpdate: () => this.updateGrid()
            }
        };
        
        // Settings
        this.settings = {
            frontWidth: 382,  // mm
            frontHeight: 387, // mm
            thickness: 39,      // mm
            showDimensions: false,
            showLabels: false,
            showSidePanels: true,
            boxColor: '#dadde6',
            // Grid settings
            gridModule: 3.3076,  // mm - base unit for gutter and baseline (387mm / 117 modules: 4 margins + 95 row content + 18 gutters)
            margins: 2,  // in modules - margin from edges
            columnCount: 12,
            rowCount: 19,  // will be calculated after DOM is ready
            rowHeight: 5,  // in modules (5 baseline per row)
            linkMode: 'module',  // 'off', 'rows-height', or 'module'
            showColumns: true,
            showRows: true,
            showBaseline: true,
            // Text styles - только типографические параметры
            headlineSize: 1.0,  // in modules
            lineHeight: 2.0,    // in modules - интерлиньяж
            tracking: -0.02,    // in em - межбуквенный интервал
            useXHeight: true,   // false = cap height, true = x-height
            textSize: 1.0,     // in modules
            textLineHeight: 2.0,    // in modules - интерлиньяж
            textTracking: 0,    // in em - межбуквенный интервал
            useXHeight2: false   // false = cap height, true = x-height
        };
        
        // Text blocks - параметры конкретных текстовых блоков на канвасе
        this.textBlocks = [
            {
                id: 'headline',
                content: 'This is a modular grid generator for Lunnen packaging design. The default dimensions match the current Lunnen Outer 16 laptop packaging.',
                styleRef: 'headline',  // ссылка на стиль в settings
                x: 0,  // позиция в колонках от левого края (0 = first column after margin)
                row: 0,  // номер строки Row (0 = первый row)
                baselineOffset: 0,  // смещение в модулях baseline внутри row (0 = первый baseline в row)
                width: 6,  // ширина в колонках
                baselineAlign: 'bottom',  // 'bottom' = низ текста к низу baseline, 'top' = x-height к верху baseline
                showBounds: false  // показывать ли границы (toggle on hover)
            },
            {
                id: 'text',
                content: 'This is a modular grid generator for Lunnen packaging design. The default dimensions match the current Lunnen Outer 16 laptop packaging.',
                styleRef: 'text',  // ссылка на стиль в settings
                x: 6,  // позиция в колонках от левого края
                row: 0,  // номер строки Row
                baselineOffset: 0,  // смещение в модулях baseline внутри row
                width: 3,  // ширина в колонках
                baselineAlign: 'bottom',  // 'bottom' = низ текста к низу baseline, 'top' = x-height к верху baseline
                showBounds: false
            }
        ];
        
        // Состояние для drag & drop текстовых блоков
        this.textDragState = {
            isDragging: false,
            blockId: null,
            startMouseX: 0,
            startMouseY: 0,
            startBlockX: 0,  // позиция блока в колонках
            startBlockY: 0,  // позиция блока в модулях baseline
            frontX: 0,  // координаты front панели для расчетов
            frontY: 0,
            scale: 1
        };
        
        // Добавим обработчики событий для перемещения текстовых блоков
        this.initTextBlockDrag();
        
        // Текущий редактируемый блок в панели параграфа
        this.currentEditingBlock = null;
        
        // Font metrics for TT Commons Classic (measured in font units, assuming UPM=1000)
        this.fontMetrics = {
            capHeight: 630,
            xHeight: 447,
            unitsPerEm: 1000
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
        this.initPanelDrag('textPanel', 'textPanelHeader');
        this.initPanelDrag('paragraphPanel', 'paragraphPanelHeader');
        this.initValueInputs();
        this.initCollapsibleSections();
        this.initDropdowns();
        this.initParagraphPanel();
        this.updateLinkedControlsVisual();
        this.initColorPreview();
        this.updateTextWidthConstraints();
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
            showColumns: document.getElementById('showColumns'),
            showRows: document.getElementById('showRows'),
            showBaseline: document.getElementById('showBaseline'),
            
            // Link mode radio buttons
            linkModeOff: document.getElementById('linkModeOff'),
            linkModeRowsHeight: document.getElementById('linkModeRowsHeight'),
            linkModeModule: document.getElementById('linkModeModule'),
            
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
            modalClose: document.getElementById('modalClose'),
            
            // Text controls - Headline
            headlineSizeSlider: document.getElementById('headlineSizeSlider'),
            headlineSizeValue: document.getElementById('headlineSizeValue'),
            lineHeightSlider: document.getElementById('lineHeightSlider'),
            lineHeightValue: document.getElementById('lineHeightValue'),
            trackingSlider: document.getElementById('trackingSlider'),
            trackingValue: document.getElementById('trackingValue'),
            useXHeight: document.getElementById('useXHeight'),
            // Text controls - Text
            textSizeSlider: document.getElementById('textSizeSlider'),
            textSizeValue: document.getElementById('textSizeValue'),
            textLineHeightSlider: document.getElementById('textLineHeightSlider'),
            textLineHeightValue: document.getElementById('textLineHeightValue'),
            textTrackingSlider: document.getElementById('textTrackingSlider'),
            textTrackingValue: document.getElementById('textTrackingValue'),
            useXHeight2: document.getElementById('useXHeight2'),
            // Paragraph settings panel
            paragraphPanel: document.getElementById('paragraphPanel'),
            paragraphPanelTitle: document.getElementById('paragraphPanelTitle'),
            paragraphXInput: document.getElementById('paragraphXInput'),
            paragraphRowInput: document.getElementById('paragraphRowInput'),
            paragraphBaselineInput: document.getElementById('paragraphBaselineInput'),
            paragraphWidthInput: document.getElementById('paragraphWidthInput'),
            baselineAlignBottom: document.getElementById('baselineAlignBottom'),
            baselineAlignTop: document.getElementById('baselineAlignTop'),
            paragraphTextArea: document.getElementById('paragraphTextArea'),
            paragraphApplyBtn: document.getElementById('paragraphApplyBtn'),
            charCounter: document.getElementById('charCounter')
        };
    }
    
    // Universal slider initialization method
    initSlider(sliderId) {
        const slider = this.dom[sliderId];
        const valueId = sliderId.replace('Slider', 'Value');
        const valueDisplay = this.dom[valueId];
        const config = this.SLIDER_CONFIG[sliderId];
        
        if (!slider || !valueDisplay || !config) return;
        
        const handler = (e) => {
            const value = parseFloat(e.target.value);
            valueDisplay.value = config.decimals === 0 
                ? value 
                : value.toFixed(config.decimals);
            
            if (config.setting) {
                this.settings[config.setting] = config.decimals === 0 
                    ? Math.round(value) 
                    : parseFloat(value.toFixed(config.decimals));
            }
            
            config.onUpdate();
        };
        
        slider.addEventListener('input', handler);
        slider.addEventListener('change', handler);
        slider.addEventListener('keyup', handler);
    }
    
    initEventListeners() {
        // Initialize all sliders using configuration
        Object.keys(this.SLIDER_CONFIG).forEach(sliderId => {
            this.initSlider(sliderId);
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
        
        // Link mode radio buttons
        const linkModeHandler = (e) => {
            this.settings.linkMode = e.target.value;
            this.updateLinkedControlsVisual();
            
            // If switching to module mode, calculate module immediately
            if (e.target.value === 'module') {
                this.calculateModule();
                this.updateGrid();
            }
        };
        
        this.dom.linkModeOff.addEventListener('change', linkModeHandler);
        this.dom.linkModeRowsHeight.addEventListener('change', linkModeHandler);
        this.dom.linkModeModule.addEventListener('change', linkModeHandler);
        
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
        
        // Use x-height checkbox
        this.dom.useXHeight.addEventListener('change', (e) => {
            this.settings.useXHeight = e.target.checked;
            this.updateGrid();
        });
        
        // Use x-height 2 checkbox
        this.dom.useXHeight2.addEventListener('change', (e) => {
            this.settings.useXHeight2 = e.target.checked;
            this.updateGrid();
        });
        
        // Color preview button - toggle HSB picker
        this.dom.colorPreview.addEventListener('click', () => {
            const isVisible = this.dom.hsbPicker.style.display !== 'none';
            this.dom.hsbPicker.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                this.updateHSBFromHex(this.settings.boxColor);
            }
        });
        
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
                hexValue = '#dadde6';
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
        // Update visual grouping of linked controls based on linkMode
        if (this.dom.linkedControlsContainer) {
            if (this.settings.linkMode !== 'off') {
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
    
    initCollapsibleSections() {
        // Initialize collapsible sections (like Headline settings)
        const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
        
        collapsibleHeaders.forEach(header => {
            const toggle = header.querySelector('.collapse-toggle');
            const contentId = header.id.replace('Header', 'Content');
            const content = document.getElementById(contentId);
            
            if (!toggle || !content) return;
            
            // Handle click on header or toggle button
            const handleToggle = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
                const newState = !isExpanded;
                
                // Update aria-expanded attribute
                toggle.setAttribute('aria-expanded', newState);
                
                // Toggle collapsed class
                if (newState) {
                    content.classList.remove('collapsed');
                } else {
                    content.classList.add('collapsed');
                }
            };
            
            // Click on entire header toggles
            header.addEventListener('click', handleToggle);
            
            // Prevent dragging when clicking on collapsible header
            header.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        });
    }
    
    initDropdowns() {
        // Initialize dropdown menus for value inputs
        const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
        
        dropdownToggles.forEach(toggle => {
            const targetId = toggle.getAttribute('data-target');
            const dropdown = document.getElementById(targetId);
            
            if (!dropdown) return;
            
            // Get the input field (sibling of toggle)
            const container = toggle.closest('.value-input-with-dropdown');
            const input = container.querySelector('.value-display');
            const sliderId = input.id.replace('Value', 'Slider');
            
            // Toggle dropdown on button click
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Close all other dropdowns
                document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                    if (menu !== dropdown) {
                        menu.classList.remove('active');
                    }
                });
                
                // Toggle this dropdown
                dropdown.classList.toggle('active');
                
                // Update selected state
                this.updateDropdownSelection(dropdown, input.value);
            });
            
            // Handle item selection
            const items = dropdown.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = parseFloat(item.getAttribute('data-value'));
                    
                    // Update slider using universal method
                    this.updateSliderValue(sliderId, value);
                    
                    // Close dropdown
                    dropdown.classList.remove('active');
                });
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.value-input-with-dropdown')) {
                document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                    menu.classList.remove('active');
                });
            }
        });
    }
    
    updateDropdownSelection(dropdown, currentValue) {
        // Update selected state for dropdown items
        const items = dropdown.querySelectorAll('.dropdown-item');
        const numValue = parseFloat(currentValue);
        
        items.forEach(item => {
            const itemValue = parseFloat(item.getAttribute('data-value'));
            if (Math.abs(itemValue - numValue) < 0.01) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    // Инициализация панели настроек параграфа
    initParagraphPanel() {
        // Обработчики изменений параметров
        if (this.dom.paragraphXInput) {
            this.dom.paragraphXInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    const newX = parseInt(this.dom.paragraphXInput.value);
                    const maxX = this.settings.columnCount - this.currentEditingBlock.width;
                    this.currentEditingBlock.x = Math.max(0, Math.min(newX, maxX));
                    this.dom.paragraphXInput.value = this.currentEditingBlock.x;
                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphXInput.addEventListener('keydown', (e) => {
                this.handleArrowKeysForInput(e, 'x', 'paragraphXInput');
            });
        }
        
        if (this.dom.paragraphRowInput) {
            this.dom.paragraphRowInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    const newRow = parseInt(this.dom.paragraphRowInput.value);
                    this.currentEditingBlock.row = Math.max(-1, newRow);
                    this.dom.paragraphRowInput.value = this.currentEditingBlock.row;
                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphRowInput.addEventListener('keydown', (e) => {
                this.handleArrowKeysForInput(e, 'row', 'paragraphRowInput');
            });
        }
        
        if (this.dom.paragraphBaselineInput) {
            this.dom.paragraphBaselineInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    const newBaseline = parseInt(this.dom.paragraphBaselineInput.value);
                    const rowHeight = this.settings.rowHeight;
                    this.currentEditingBlock.baselineOffset = Math.max(0, Math.min(newBaseline, rowHeight));
                    this.dom.paragraphBaselineInput.value = this.currentEditingBlock.baselineOffset;
                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphBaselineInput.addEventListener('keydown', (e) => {
                this.handleArrowKeysForInput(e, 'baselineOffset', 'paragraphBaselineInput');
            });
        }
        
        if (this.dom.paragraphWidthInput) {
            this.dom.paragraphWidthInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    const newWidth = parseInt(this.dom.paragraphWidthInput.value);
                    const maxWidth = this.settings.columnCount;
                    this.currentEditingBlock.width = Math.max(1, Math.min(newWidth, maxWidth));
                    this.dom.paragraphWidthInput.value = this.currentEditingBlock.width;
                    
                    // Корректируем X если блок вышел за пределы
                    const maxX = this.settings.columnCount - this.currentEditingBlock.width;
                    if (this.currentEditingBlock.x > maxX) {
                        this.currentEditingBlock.x = Math.max(0, maxX);
                        this.dom.paragraphXInput.value = this.currentEditingBlock.x;
                    }
                    
                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphWidthInput.addEventListener('keydown', (e) => {
                this.handleArrowKeysForInput(e, 'width', 'paragraphWidthInput');
            });
        }
        
        // Обработчики для режима выравнивания
        if (this.dom.baselineAlignBottom) {
            this.dom.baselineAlignBottom.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.baselineAlignBottom.checked) {
                    this.currentEditingBlock.baselineAlign = 'bottom';
                    this.updateGrid();
                }
            });
        }
        
        if (this.dom.baselineAlignTop) {
            this.dom.baselineAlignTop.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.baselineAlignTop.checked) {
                    this.currentEditingBlock.baselineAlign = 'top';
                    this.updateGrid();
                }
            });
        }
        
        // Обработчик для текстового поля
        if (this.dom.paragraphTextArea) {
            this.dom.paragraphTextArea.addEventListener('input', () => {
                if (this.currentEditingBlock) {
                    this.currentEditingBlock.content = this.dom.paragraphTextArea.value;
                    this.updateCharCounter();
                    this.updateGrid();
                }
            });
        }
        
        // Кнопка Apply and Close (изменения применяются автоматически, кнопка закрывает панель)
        if (this.dom.paragraphApplyBtn) {
            this.dom.paragraphApplyBtn.addEventListener('click', () => {
                // Показываем визуальный фидбек
                this.dom.paragraphApplyBtn.textContent = 'Applied!';
                setTimeout(() => {
                    this.dom.paragraphApplyBtn.textContent = 'Apply and Close';
                    this.closeParagraphPanel();
                }, 500);
            });
        }
    }
    
    // Обновить счетчик символов
    updateCharCounter() {
        if (this.dom.charCounter && this.dom.paragraphTextArea) {
            const count = this.dom.paragraphTextArea.value.length;
            const plural = count === 1 ? 'character' : 'characters';
            this.dom.charCounter.textContent = `${count} ${plural}`;
        }
    }
    
    // Обработка стрелок клавиатуры для числовых полей
    handleArrowKeysForInput(e, property, inputId) {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        if (!this.currentEditingBlock) return;
        
        e.preventDefault();
        
        const step = e.shiftKey ? 10 : 1;
        const direction = e.key === 'ArrowUp' ? 1 : -1;
        const delta = step * direction;
        
        let newValue = this.currentEditingBlock[property] + delta;
        
        // Применяем ограничения в зависимости от поля
        if (property === 'x') {
            const maxX = this.settings.columnCount - this.currentEditingBlock.width;
            newValue = Math.max(0, Math.min(newValue, maxX));
            this.currentEditingBlock.x = newValue;
            this.dom[inputId].value = newValue;
        } else if (property === 'row') {
            newValue = Math.max(-1, newValue);
            this.currentEditingBlock.row = newValue;
            this.dom[inputId].value = newValue;
        } else if (property === 'baselineOffset') {
            const rowHeight = this.settings.rowHeight;
            newValue = Math.max(0, Math.min(newValue, rowHeight));
            this.currentEditingBlock.baselineOffset = newValue;
            this.dom[inputId].value = newValue;
        } else if (property === 'width') {
            const maxWidth = this.settings.columnCount;
            newValue = Math.max(1, Math.min(newValue, maxWidth));
            this.currentEditingBlock.width = newValue;
            this.dom[inputId].value = newValue;
            
            // Корректируем X если блок вышел за пределы
            const maxX = this.settings.columnCount - this.currentEditingBlock.width;
            if (this.currentEditingBlock.x > maxX) {
                this.currentEditingBlock.x = Math.max(0, maxX);
                this.dom.paragraphXInput.value = this.currentEditingBlock.x;
            }
        }
        
        this.updateGrid();
    }
    
    // Показать панель настроек параграфа
    showParagraphPanel(blockId) {
        const block = this.getTextBlock(blockId);
        if (!block) return;
        
        this.currentEditingBlock = block;
        
        // Устанавливаем заголовок панели с названием стиля и номером
        if (this.dom.paragraphPanelTitle) {
            const styleName = this.getStyleDisplayName(block.styleRef);
            const blockNumber = this.getBlockNumber(blockId);
            const formattedNumber = blockNumber.toString().padStart(2, '0');
            this.dom.paragraphPanelTitle.textContent = `${styleName} ${formattedNumber} Settings`;
        }
        
        // Если панель открывается впервые или была закрыта, центрируем её
        if (this.dom.paragraphPanel && !this.dom.paragraphPanel.classList.contains('active')) {
            // Временно показываем панель для получения размеров
            this.dom.paragraphPanel.style.display = 'flex';
            const rect = this.dom.paragraphPanel.getBoundingClientRect();
            
            // Вычисляем центральную позицию
            const centerX = (window.innerWidth - rect.width) / 2;
            const centerY = (window.innerHeight - rect.height) / 2;
            
            // Устанавливаем позицию напрямую через left/top, убирая transform
            this.dom.paragraphPanel.style.left = `${centerX}px`;
            this.dom.paragraphPanel.style.top = `${centerY}px`;
            this.dom.paragraphPanel.style.transform = 'none';
        }
        
        // Заполняем поля панели
        if (this.dom.paragraphXInput) {
            this.dom.paragraphXInput.value = block.x;
        }
        if (this.dom.paragraphRowInput) {
            this.dom.paragraphRowInput.value = block.row;
        }
        if (this.dom.paragraphBaselineInput) {
            this.dom.paragraphBaselineInput.value = block.baselineOffset;
        }
        if (this.dom.paragraphWidthInput) {
            this.dom.paragraphWidthInput.value = block.width;
        }
        if (this.dom.baselineAlignBottom && this.dom.baselineAlignTop) {
            if (block.baselineAlign === 'bottom') {
                this.dom.baselineAlignBottom.checked = true;
            } else {
                this.dom.baselineAlignTop.checked = true;
            }
        }
        if (this.dom.paragraphTextArea) {
            this.dom.paragraphTextArea.value = block.content;
        }
        
        // Обновляем счетчик символов
        this.updateCharCounter();
        
        // Показываем панель
        if (this.dom.paragraphPanel) {
            this.dom.paragraphPanel.classList.add('active');
            this.dom.paragraphPanel.style.display = 'flex';
        }
    }
    
    // Закрыть панель настроек параграфа
    closeParagraphPanel() {
        this.currentEditingBlock = null;
        if (this.dom.paragraphPanel) {
            this.dom.paragraphPanel.classList.remove('active');
            this.dom.paragraphPanel.style.display = 'none';
        }
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
            
            // Recalculate offset based on CURRENT panel position (handles dynamic height changes)
            const rect = panel.getBoundingClientRect();
            xOffset = rect.left;
            yOffset = rect.top;
            
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
            el.style.bottom = 'auto';
        }
    }
    
    // Universal method to update slider value based on configuration
    updateSliderValue(sliderId, newValue) {
        const config = this.SLIDER_CONFIG[sliderId];
        if (!config) return;
        
        const slider = this.dom[sliderId];
        const valueId = sliderId.replace('Slider', 'Value');
        const valueDisplay = this.dom[valueId];
        
        if (!slider || !valueDisplay) return;
        
        // Format value based on decimals
        const formattedValue = config.decimals === 0 
            ? Math.round(newValue) 
            : parseFloat(newValue.toFixed(config.decimals));
        
        // Update UI
        slider.value = formattedValue;
        valueDisplay.value = config.decimals === 0 
            ? formattedValue 
            : formattedValue.toFixed(config.decimals);
        
        // Update settings if applicable
        if (config.setting) {
            this.settings[config.setting] = formattedValue;
        }
        
        // Run update callback
        config.onUpdate();
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
        const sliderId = slider.id;
        const config = this.SLIDER_CONFIG[sliderId];
        
        if (!config) return;
        
        let rawValue = input.value.replace(/[^\d.-]/g, '');
        let currentValue = parseFloat(rawValue);
        
        if (isNaN(currentValue)) {
            currentValue = parseFloat(slider.value);
        }
        
        // Determine step based on shift key
        let newValue;
        if (e.shiftKey && config.decimals === 2) {
            // For Module and Margins with Shift: round to tenths first, then add/subtract 0.1
            const roundedToTenth = Math.round(currentValue * 10) / 10;
            const step = (e.key === 'ArrowUp' ? 1 : -1) * config.shiftStep;
            newValue = roundedToTenth + step;
        } else {
            const step = e.shiftKey ? config.shiftStep : config.baseStep;
            newValue = e.key === 'ArrowUp' ? currentValue + step : currentValue - step;
        }
        
        // Clamp to min/max
        newValue = Math.max(min, Math.min(max, newValue));
        
        // Update slider using universal method
        this.updateSliderValue(sliderId, newValue);
    }
    
    processValueInput(input, slider, min, max) {
        const sliderId = slider.id;
        const config = this.SLIDER_CONFIG[sliderId];
        
        if (!config) return;
        
        let rawValue = input.value.replace(/[^\d.-]/g, '');
        let numValue = parseFloat(rawValue);
        
        if (isNaN(numValue)) {
            input.value = input.dataset.originalValue;
            return;
        }
        
        // Clamp to min/max
        numValue = Math.max(min, Math.min(max, numValue));
        
        // Update slider using universal method
        this.updateSliderValue(sliderId, numValue);
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
    
    calculateModule() {
        // Calculate module size to fit rows perfectly with given row count and row height
        const frontHeight = this.settings.frontHeight;
        const margins = this.settings.margins;
        const rowCount = this.settings.rowCount;
        const rowHeight = this.settings.rowHeight;
        
        // Formula: 2×margins + rowCount×rowHeight + (rowCount-1)×1 = total modules
        // Module = frontHeight / totalModules
        const totalModules = 2 * margins + rowCount * rowHeight + (rowCount - 1);
        const calculatedModule = frontHeight / totalModules;
        
        // Round down to 4 decimal places to ensure it fits
        this.settings.gridModule = Math.floor(calculatedModule * 10000) / 10000;
        
        // Update UI
        if (this.dom.gridModuleValue) {
            this.dom.gridModuleValue.value = this.settings.gridModule.toFixed(4);
        }
        if (this.dom.gridModuleSlider) {
            this.dom.gridModuleSlider.value = this.settings.gridModule;
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
                
                // Enable rows-height link mode if it was disabled
                if (this.settings.linkMode === 'off') {
                    this.settings.linkMode = 'rows-height';
                    this.dom.linkModeRowsHeight.checked = true;
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
    
    updateTextWidthConstraints() {
        // Обновляем ограничения ширины для всех текстовых блоков
        const maxColumns = this.settings.columnCount;
        
        this.textBlocks.forEach(block => {
            // Клампируем ширину если она превышает количество колонок
            if (block.width > maxColumns) {
                block.width = maxColumns;
            }
            
            // Клампируем позицию + ширину чтобы блок не выходил за пределы
            if (block.x + block.width > maxColumns) {
                block.x = Math.max(0, maxColumns - block.width);
            }
        });
    }
    
    // Получить текстовый блок по ID
    getTextBlock(id) {
        return this.textBlocks.find(block => block.id === id);
    }
    
    // Получить номер блока (для отображения в UI)
    getBlockNumber(blockId) {
        // Группируем блоки по styleRef и считаем номер внутри группы
        const block = this.getTextBlock(blockId);
        if (!block) return 1;
        
        const blocksWithSameStyle = this.textBlocks.filter(b => b.styleRef === block.styleRef);
        const index = blocksWithSameStyle.findIndex(b => b.id === blockId);
        return (index >= 0 ? index : 0) + 1;
    }
    
    // Получить название стиля для отображения
    getStyleDisplayName(styleRef) {
        // Преобразуем 'headline' в 'Headline', 'text' в 'Text'
        return styleRef.charAt(0).toUpperCase() + styleRef.slice(1);
    }
    
    // Конвертировать Row + BaselineOffset в Y (позиция в baseline модулях)
    rowBaselineToY(row, baselineOffset) {
        const rowHeight = this.settings.rowHeight;
        // Формула: row * (rowHeight + 1) + baselineOffset
        // +1 это gutter между rows (1 модуль baseline)
        return row * (rowHeight + 1) + baselineOffset;
    }
    
    // Конвертировать Y (позиция в baseline модулях) в Row + BaselineOffset
    yToRowBaseline(y) {
        const rowHeight = this.settings.rowHeight;
        const rowWithGutter = rowHeight + 1;
        
        const row = Math.floor(y / rowWithGutter);
        const baselineOffset = y % rowWithGutter;
        
        return { row, baselineOffset };
    }
    
    // Получить Y позицию блока в baseline модулях
    getBlockY(block) {
        return this.rowBaselineToY(block.row, block.baselineOffset);
    }
    
    // Calculate font size in mm based on module and height mode
    calculateFontSize() {
        const module = this.settings.gridModule;
        const sizeInModules = this.settings.headlineSize;
        const targetSize = module * sizeInModules; // size in mm
        
        // Calculate font size based on whether we're using cap height or x-height
        let fontSize;
        if (this.settings.useXHeight) {
            // x-height should equal targetSize
            fontSize = targetSize * (this.fontMetrics.unitsPerEm / this.fontMetrics.xHeight);
        } else {
            // cap height should equal targetSize
            fontSize = targetSize * (this.fontMetrics.unitsPerEm / this.fontMetrics.capHeight);
        }
        
        return fontSize; // in mm
    }
    
    // Calculate font size for Text style (cap height or x-height)
    calculateTextStyleFontSize() {
        const module = this.settings.gridModule;
        const sizeInModules = this.settings.textSize;
        const targetSize = module * sizeInModules; // size in mm
        
        // Calculate font size based on whether we're using cap height or x-height
        let fontSize;
        if (this.settings.useXHeight2) {
            // x-height should equal targetSize
            fontSize = targetSize * (this.fontMetrics.unitsPerEm / this.fontMetrics.xHeight);
        } else {
            // cap height should equal targetSize
            fontSize = targetSize * (this.fontMetrics.unitsPerEm / this.fontMetrics.capHeight);
        }
        
        return fontSize; // in mm
    }
    
    // Snap position to nearest baseline grid line (relative to front panel)
    // isFirstLine - если true, привязываем к целому модулю, иначе к четверти модуля
    snapToBaseline(y, frontY, scale, isFirstLine = false) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const topMargin = module * margins * scale;
        
        // Calculate the relative position from the front panel's top margin
        const relativeY = y - (frontY + topMargin);
        
        let nearestBaseline;
        if (isFirstLine) {
            // Первая строка - привязываем к целому модулю (baseline сетка)
            const fullModule = module * scale;
            nearestBaseline = Math.round(relativeY / fullModule) * fullModule;
        } else {
            // Остальные строки - привязываем к четверти модуля
            const quarterModule = (module * scale) / 4;
            nearestBaseline = Math.round(relativeY / quarterModule) * quarterModule;
        }
        
        return frontY + topMargin + nearestBaseline;
    }
    
    // Calculate text block width in mm based on columns
    calculateBlockWidth(block) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const columnCount = this.settings.columnCount;
        const widthInColumns = block.width;
        
        // Calculate column width (same formula as in drawColumns)
        const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount;
        
        // Text width = column width × number of columns + gutters between them
        const textWidth = columnWidth * widthInColumns + module * (widthInColumns - 1);
        
        return textWidth;
    }
    
    // Calculate text block position in mm
    calculateBlockPosition(block, scale = 1) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const columnCount = this.settings.columnCount;
        
        // Calculate column width
        const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount;
        const gutter = module;
        
        // Position based on column and row
        // x включает левый margin, так как колонки считаются внутри margin
        const x = module * margins * scale + block.x * (columnWidth * scale + gutter * scale);
        // y НЕ включает topMargin - он добавляется при отрисовке
        // Получаем Y позицию в baseline модулях из row + baselineOffset
        const yInBaseline = this.getBlockY(block);
        const y = yInBaseline * (module * scale);
        
        return { x, y };
    }
    
    // Измерить ширину текста в SVG точно
    measureTextWidth(text, fontSize, scale) {
        // Используем Canvas для точного измерения текста
        if (!this._measurementCanvas) {
            this._measurementCanvas = document.createElement('canvas');
            this._measurementContext = this._measurementCanvas.getContext('2d');
        }
        
        const ctx = this._measurementContext;
        const scaledFontSize = fontSize * scale;
        
        // Устанавливаем те же параметры шрифта
        ctx.font = `500 ${scaledFontSize}px 'TT Commons Classic', -apple-system, BlinkMacSystemFont, sans-serif`;
        
        // Измеряем ширину текста
        const metrics = ctx.measureText(text);
        let width = metrics.width;
        
        // Учитываем трекинг (letter-spacing)
        // Трекинг применяется к каждому символу, кроме последнего
        if (text.length > 1) {
            const trackingPx = this.settings.tracking * scaledFontSize;
            width += trackingPx * (text.length - 1);
        }
        
        return width;
    }
    
    // Разбить текст на строки с учетом ширины блока
    wrapText(text, maxWidth, fontSize, scale) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = this.measureTextWidth(testLine, fontSize, scale);
            
            if (testWidth > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    // Draw text block on canvas with hover effects and drag handles
    drawTextBlock(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        const gridColor = this.getContrastColor();
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        
        // Get style settings based on block's styleRef
        const isHeadline = block.styleRef === 'headline';
        const fontSize = isHeadline ? this.calculateFontSize() : this.calculateTextStyleFontSize();
        const scaledFontSize = fontSize * scale;
        const lineHeightSetting = isHeadline ? this.settings.lineHeight : this.settings.textLineHeight;
        const trackingSetting = isHeadline ? this.settings.tracking : this.settings.textTracking;
        const useXHeight = isHeadline ? this.settings.useXHeight : this.settings.useXHeight2;
        
        // Get text content
        const inputLines = block.content.split('\n').filter(line => line.trim() !== '');
        if (inputLines.length === 0) {
            // Show placeholder
            const placeholderGroup = this.createSVGElement('g', {
                id: `text-group-${block.id}`,
                style: 'cursor: move;',
                'data-block-id': block.id
            }, container);
            
            const position = this.calculateBlockPosition(block, scale);
            const textX = frontX + position.x;
            const topMargin = module * margins * scale;
            const textY = frontY + position.y + topMargin + 20 * scale;
            
            const placeholder = this.createSVGElement('text', {
                x: textX,
                y: textY,
                'font-family': 'TT Commons Classic, -apple-system, BlinkMacSystemFont, sans-serif',
                'font-size': `${14 * scale}`,
                'fill': gridColor,
                'fill-opacity': '0.3',
                style: 'cursor: move;'
            }, placeholderGroup);
            placeholder.textContent = 'Click to add text';
            
            this.attachTextBlockHandlers(placeholderGroup, block, frontX, frontY, scale);
            return;
        }
        
        // Calculate text block width
        const textBlockWidth = this.calculateBlockWidth(block);
        const scaledTextWidth = textBlockWidth * scale;
        
        // Wrap text lines to fit width
        const wrappedLines = [];
        inputLines.forEach(line => {
            const wrapped = this.wrapText(line, scaledTextWidth, fontSize, scale);
            wrappedLines.push(...wrapped);
        });
        
        // Calculate position
        const position = this.calculateBlockPosition(block, scale);
        const textX = frontX + position.x;
        
        // Calculate cap height and x-height for positioning
        let actualCapHeight, actualXHeight;
        const textSize = isHeadline ? this.settings.headlineSize : this.settings.textSize;
        if (useXHeight) {
            actualXHeight = module * textSize * scale;
            actualCapHeight = actualXHeight * (this.fontMetrics.capHeight / this.fontMetrics.xHeight);
        } else {
            actualCapHeight = module * textSize * scale;
            actualXHeight = actualCapHeight * (this.fontMetrics.xHeight / this.fontMetrics.capHeight);
        }
        
        const topMargin = module * margins * scale;
        
        // Рассчитываем firstLineY в зависимости от режима выравнивания
        let firstLineY;
        if (block.baselineAlign === 'top') {
            // Режим 'top': x-height выравнивается по верху ближайшего baseline
            // Baseline текста должен быть выше на величину x-height
            firstLineY = frontY + position.y + topMargin + actualXHeight;
        } else {
            // Режим 'bottom' (по умолчанию): низ текста (baseline) к низу baseline
            // Baseline текста = низ блока baseline, cap-height сверху
            firstLineY = frontY + position.y + topMargin + actualCapHeight;
        }
        const lineHeightInMm = module * lineHeightSetting * scale;
        
        // Create group for text block with hover
        const textGroup = this.createSVGElement('g', {
            id: `text-group-${block.id}`,
            style: 'cursor: move;',
            'data-block-id': block.id
        }, container);
        
        // Create text elements
        const textAttrs = {
            'font-family': 'TT Commons Classic, -apple-system, BlinkMacSystemFont, sans-serif',
            'font-weight': '500',
            'font-size': `${scaledFontSize}`,
            'text-anchor': 'start',
            'fill': gridColor,
            'fill-opacity': '1',
            'letter-spacing': `${trackingSetting}em`
        };
        
        // Draw each line
        let previousBaselineY = null;
        wrappedLines.forEach((line, index) => {
            let lineBaselineY;
            
            if (index === 0) {
                const lineApproxY = firstLineY;
                lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, true);
                previousBaselineY = lineBaselineY;
            } else {
                const lineApproxY = previousBaselineY + lineHeightInMm;
                lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, false);
                previousBaselineY = lineBaselineY;
            }
            
            const textElement = this.createSVGElement('text', {
                ...textAttrs,
                x: textX,
                y: lineBaselineY
            }, textGroup);
            textElement.textContent = line;
        });
        
        // Create bounds rectangle (hidden by default, shown on hover)
        const boundsRect = this.createSVGElement('rect', {
            id: `bounds-${block.id}`,
            x: textX,
            y: frontY + position.y + topMargin,
            width: scaledTextWidth,
            height: lineHeightInMm * wrappedLines.length,
            fill: 'rgba(255, 255, 255, 0.05)',
            stroke: gridColor,
            'stroke-width': scale === 1 ? '0.5' : '1',
            'stroke-dasharray': '4,4',
            'stroke-opacity': '0',
            'fill-opacity': '0',
            style: 'pointer-events: none; transition: opacity 0.2s;',
            'data-block-id': block.id
        }, container);
        
        // Store bounds element reference for hover effect
        textGroup.boundsElement = boundsRect;
        
        // Attach event handlers
        this.attachTextBlockHandlers(textGroup, block, frontX, frontY, scale);
    }
    
    // Attach event handlers for text block (click, hover, drag)
    attachTextBlockHandlers(textGroup, block, frontX, frontY, scale) {
        let mouseDownTime = 0;
        let mouseDownX = 0;
        let mouseDownY = 0;
        let hasMoved = false;
        
        // Mouse down - начало потенциального drag или клика
        textGroup.addEventListener('mousedown', (e) => {
            // Только левая кнопка мыши
            if (e.button !== 0) return;
            
            e.stopPropagation();
            e.preventDefault();
            
            mouseDownTime = Date.now();
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            hasMoved = false;
            
            // Подписываемся на движение мыши для определения drag
            const mouseMoveHandler = (moveEvent) => {
                const deltaX = Math.abs(moveEvent.clientX - mouseDownX);
                const deltaY = Math.abs(moveEvent.clientY - mouseDownY);
                
                // Если мышь сдвинулась больше чем на 3 пикселя, начинаем drag
                if (!hasMoved && (deltaX > 3 || deltaY > 3)) {
                    hasMoved = true;
                    this.startTextBlockDrag(block.id, mouseDownX, mouseDownY, frontX, frontY, scale);
                }
            };
            
            const mouseUpHandler = (upEvent) => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                
                // Если не было движения, обрабатываем как клик для открытия панели настроек
                if (!hasMoved) {
                    const clickDuration = Date.now() - mouseDownTime;
                    // Короткий клик открывает панель настроек параграфа
                    if (clickDuration < 300) {
                        this.showParagraphPanel(block.id);
                    }
                }
            };
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
        
        // Hover handlers для показа границ
        textGroup.addEventListener('mouseenter', () => {
            if (textGroup.boundsElement && !this.textDragState.isDragging) {
                textGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                textGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
        });
        
        textGroup.addEventListener('mouseleave', () => {
            if (textGroup.boundsElement && !this.textDragState.isDragging) {
                textGroup.boundsElement.setAttribute('stroke-opacity', '0');
                textGroup.boundsElement.setAttribute('fill-opacity', '0');
            }
        });
    }
    
    // OLD METHOD - will be removed after testing
    // Draw Headline text on the canvas
    drawHeadlineText_OLD(container, frontX, frontY, frontWidth, frontHeight, scale) {
        const fontSize = this.calculateFontSize();
        const scaledFontSize = fontSize * scale;
        const gridColor = this.getContrastColor();
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        
        // Get text lines from settings
        const inputLines = this.settings.textContent.split('\n').filter(line => line.trim() !== '');
        if (inputLines.length === 0) {
            // Show placeholder if no text
            const placeholderGroup = this.createSVGElement('g', {
                id: 'text-group',
                style: 'cursor: pointer;'
            }, container);
            
            const leftMargin = module * margins * scale;
            const topMargin = module * margins * scale;
            const textX = frontX + leftMargin;
            const textY = frontY + topMargin + 20 * scale;
            
            const placeholder = this.createSVGElement('text', {
                x: textX,
                y: textY,
                'font-family': 'TT Commons Classic, -apple-system, BlinkMacSystemFont, sans-serif',
                'font-size': `${14 * scale}`,
                'fill': gridColor,
                'fill-opacity': '0.3',
                style: 'cursor: pointer;'
            }, placeholderGroup);
            placeholder.textContent = 'Click to add text';
            
            this.attachTextClickHandler(placeholderGroup, frontX, frontY, scale);
            return;
        }
        
        // Calculate text block width in mm
        const textBlockWidth = this.calculateTextWidth();
        const scaledTextWidth = textBlockWidth * scale;
        
        // Wrap text lines to fit width
        const wrappedLines = [];
        inputLines.forEach(line => {
            const wrapped = this.wrapText(line, scaledTextWidth, fontSize, scale);
            wrappedLines.push(...wrapped);
        });
        
        // Position text at top-left corner with margins
        const leftMargin = module * margins * scale;
        const topMargin = module * margins * scale;
        
        // Calculate cap height in actual size for positioning
        let actualCapHeight;
        if (this.settings.useXHeight) {
            const actualXHeight = module * this.settings.headlineSize * scale;
            actualCapHeight = actualXHeight * (this.fontMetrics.capHeight / this.fontMetrics.xHeight);
        } else {
            actualCapHeight = module * this.settings.headlineSize * scale;
        }
        
        const textX = frontX + leftMargin;
        // Baseline первой строки должен быть ниже на величину cap height,
        // чтобы верх букв начинался от линии margin
        const firstLineY = frontY + topMargin + actualCapHeight;
        
        // Calculate line height in mm
        const lineHeightInMm = module * this.settings.lineHeight * scale;
        
        // Create a group for all text elements to make them clickable
        const textGroup = this.createSVGElement('g', {
            id: 'text-group',
            style: 'cursor: pointer;'
        }, container);
        
        // Create text elements with proper font styling
        const textAttrs = {
            'font-family': 'TT Commons Classic, -apple-system, BlinkMacSystemFont, sans-serif',
            'font-weight': '500',
            'font-size': `${scaledFontSize}`,
            'text-anchor': 'start',  // Выравнивание по левому краю
            'fill': gridColor,
            'fill-opacity': '1',
            'letter-spacing': `${this.settings.tracking}em`  // Трекинг
        };
        
        // Draw each line
        let previousBaselineY = null;
        wrappedLines.forEach((line, index) => {
            let lineBaselineY;
            
            if (index === 0) {
                // Первая строка - привязываем к целому модулю baseline
                const lineApproxY = firstLineY;
                lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, true);
                previousBaselineY = lineBaselineY;
            } else {
                // Последующие строки - отсчитываем от РЕАЛЬНОЙ позиции предыдущей строки
                const lineApproxY = previousBaselineY + lineHeightInMm;
                lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, false);
                previousBaselineY = lineBaselineY;
            }
            
            // Create text element
            const textElement = this.createSVGElement('text', {
                ...textAttrs,
                x: textX,
                y: lineBaselineY
            }, textGroup);
            textElement.textContent = line;
        });
        
        // Attach click handler for editing
        this.attachTextClickHandler(textGroup, frontX, frontY, scale);
        
        // Optional: Draw debug rectangle showing text block boundaries
        if (this.settings.showTextBounds) { // Set to true for debugging
            this.createSVGElement('rect', {
                x: textX,
                y: frontY + topMargin,
                width: scaledTextWidth,
                height: lineHeightInMm * wrappedLines.length,
                fill: 'rgba(255, 0, 0, 0.1)',
                stroke: 'red',
                'stroke-width': scale === 1 ? '0.5' : '1',
                'stroke-dasharray': '4,4'
            }, container);
        }
    }
    
    // Draw Text style text on the canvas (cap height or x-height)
    drawTextStyleText(container, frontX, frontY, frontWidth, frontHeight, scale) {
        const fontSize = this.calculateTextStyleFontSize();
        const scaledFontSize = fontSize * scale;
        const gridColor = this.getContrastColor();
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const columnCount = this.settings.columnCount;
        
        // Get text lines from settings
        const inputLines = this.settings.textContent2.split('\n').filter(line => line.trim() !== '');
        if (inputLines.length === 0) {
            return; // No placeholder for second text block
        }
        
        // Calculate text block width in mm
        const textBlockWidth = this.calculateTextStyleWidth();
        const scaledTextWidth = textBlockWidth * scale;
        
        // Calculate column width and gutter for precise positioning
        const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount;
        const gutter = module;
        
        // Wrap text lines to fit width
        const wrappedLines = [];
        inputLines.forEach(line => {
            const wrapped = this.wrapText(line, scaledTextWidth, fontSize, scale);
            wrappedLines.push(...wrapped);
        });
        
        // Position text after Headline block
        const leftMargin = module * margins * scale;
        const topMargin = module * margins * scale;
        
        // Calculate cap height or x-height in actual size for positioning
        let actualCapHeight;
        if (this.settings.useXHeight2) {
            const actualXHeight = module * this.settings.textSize * scale;
            actualCapHeight = actualXHeight * (this.fontMetrics.capHeight / this.fontMetrics.xHeight);
        } else {
            actualCapHeight = module * this.settings.textSize * scale;
        }
        
        // Text X position: positioned at the column after Headline
        // Headline occupies textWidth columns, so Text starts at (textWidth) column index
        const columnAfterHeadline = this.settings.textWidth;
        const textX = frontX + leftMargin + columnAfterHeadline * (columnWidth * scale + gutter * scale);
        
        // Baseline первой строки должен быть ниже на величину cap height
        const firstLineY = frontY + topMargin + actualCapHeight;
        
        // Calculate line height in mm
        const lineHeightInMm = module * this.settings.textLineHeight * scale;
        
        // Create a group for all text elements to make them clickable
        const textGroup = this.createSVGElement('g', {
            id: 'text-group-2',
            style: 'cursor: pointer;'
        }, container);
        
        // Create text elements with proper font styling
        const textAttrs = {
            'font-family': 'TT Commons Classic, -apple-system, BlinkMacSystemFont, sans-serif',
            'font-weight': '500',
            'font-size': `${scaledFontSize}`,
            'text-anchor': 'start',
            'fill': gridColor,
            'fill-opacity': '1',
            'letter-spacing': `${this.settings.textTracking}em`
        };
        
        // Draw each line
        let previousBaselineY = null;
        wrappedLines.forEach((line, index) => {
            let lineBaselineY;
            
            if (index === 0) {
                // Первая строка - привязываем к целому модулю baseline
                const lineApproxY = firstLineY;
                lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, true);
                previousBaselineY = lineBaselineY;
            } else {
                // Последующие строки - отсчитываем от РЕАЛЬНОЙ позиции предыдущей строки
                const lineApproxY = previousBaselineY + lineHeightInMm;
                lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, false);
                previousBaselineY = lineBaselineY;
            }
            
            // Create text element
            const textElement = this.createSVGElement('text', {
                ...textAttrs,
                x: textX,
                y: lineBaselineY
            }, textGroup);
            textElement.textContent = line;
        });
        
        // Attach click handler for editing
        this.attachTextClickHandler2(textGroup, frontX, frontY, scale);
        
        // Optional: Draw debug rectangle showing text block boundaries
        if (this.settings.showTextBounds2) {
            this.createSVGElement('rect', {
                x: textX,
                y: frontY + topMargin,
                width: scaledTextWidth,
                height: lineHeightInMm * wrappedLines.length,
                fill: 'rgba(0, 0, 255, 0.1)',
                stroke: 'blue',
                'stroke-width': scale === 1 ? '0.5' : '1',
                'stroke-dasharray': '4,4'
            }, container);
        }
    }
    
    attachTextClickHandler(textGroup, frontX, frontY, scale) {
        textGroup.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTextEditor(frontX, frontY, scale, 'headline');
        });
    }
    
    attachTextClickHandler2(textGroup, frontX, frontY, scale) {
        textGroup.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTextEditor(frontX, frontY, scale, 'text');
        });
    }
    
    // Инициализация drag & drop для текстовых блоков
    initTextBlockDrag() {
        // Обработчики мыши на уровне документа
        document.addEventListener('mousemove', (e) => {
            if (!this.textDragState.isDragging) return;
            
            e.preventDefault();
            this.handleTextBlockDrag(e);
        });
        
        document.addEventListener('mouseup', (e) => {
            if (!this.textDragState.isDragging) return;
            
            e.preventDefault();
            this.endTextBlockDrag();
        });
    }
    
    // Начать перемещение текстового блока
    startTextBlockDrag(blockId, mouseX, mouseY, frontX, frontY, scale) {
        const block = this.getTextBlock(blockId);
        if (!block) return;
        
        this.textDragState = {
            isDragging: true,
            blockId: blockId,
            startMouseX: mouseX,
            startMouseY: mouseY,
            startBlockX: block.x,
            startBlockRow: block.row,
            startBlockBaselineOffset: block.baselineOffset,
            frontX: frontX,
            frontY: frontY,
            scale: scale
        };
        
        // Показать границы блока во время перемещения
        const boundsElement = document.getElementById(`bounds-${blockId}`);
        if (boundsElement) {
            boundsElement.setAttribute('stroke-opacity', '0.5');
            boundsElement.setAttribute('fill-opacity', '0.05');
        }
    }
    
    // Обработка перемещения мыши
    handleTextBlockDrag(e) {
        const block = this.getTextBlock(this.textDragState.blockId);
        if (!block) return;
        
        const { startMouseX, startMouseY, startBlockX, startBlockRow, startBlockBaselineOffset, frontX, frontY, scale } = this.textDragState;
        
        // Вычисляем смещение мыши
        const deltaX = e.clientX - startMouseX;
        const deltaY = e.clientY - startMouseY;
        
        // Преобразуем смещение в колонки и baseline модули
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const columnCount = this.settings.columnCount;
        
        // Вычисляем ширину колонки и gutter
        const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount;
        const gutter = module;
        const columnWithGutter = (columnWidth + gutter) * scale;
        const baselineUnit = module * scale;
        
        // Новая позиция в колонках
        let newX = startBlockX + Math.round(deltaX / columnWithGutter);
        
        // Новая позиция в baseline модулях
        const startY = this.rowBaselineToY(startBlockRow, startBlockBaselineOffset);
        const deltaYInBaseline = Math.round(deltaY / baselineUnit);
        let newY = startY + deltaYInBaseline;
        
        // Ограничиваем позицию, чтобы блок не выходил за пределы
        newX = Math.max(0, Math.min(newX, columnCount - block.width));
        // Разрешаем отрицательные значения Y, но не выше чем -margins
        const minY = -Math.floor(margins);
        newY = Math.max(minY, newY);
        
        // Конвертируем Y обратно в row + baselineOffset
        const { row, baselineOffset } = this.yToRowBaseline(newY);
        
        // Обновляем позицию блока
        block.x = newX;
        block.row = row;
        block.baselineOffset = baselineOffset;
        
        // Перерисовываем сетку
        this.updateGrid();
    }
    
    // Завершить перемещение
    endTextBlockDrag() {
        const blockId = this.textDragState.blockId;
        
        // Скрыть границы после окончания перемещения
        const boundsElement = document.getElementById(`bounds-${blockId}`);
        if (boundsElement) {
            boundsElement.setAttribute('stroke-opacity', '0');
            boundsElement.setAttribute('fill-opacity', '0');
        }
        
        this.textDragState.isDragging = false;
        this.textDragState.blockId = null;
    }
    
    showTextEditor(blockId, frontX, frontY, scale) {
        // Remove existing editor if any
        const existingEditor = document.getElementById('text-editor-overlay');
        if (existingEditor) {
            existingEditor.remove();
        }
        
        // Get block data
        const block = this.getTextBlock(blockId);
        if (!block) return;
        
        // Get SVG position
        const svgRect = this.dom.svg.getBoundingClientRect();
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        
        // Calculate text block width and position
        const textBlockWidth = this.calculateBlockWidth(block);
        const scaledTextWidth = textBlockWidth * scale;
        const position = this.calculateBlockPosition(block, scale);
        
        const editorX = svgRect.left + frontX + position.x;
        const editorY = svgRect.top + frontY + position.y + module * margins * scale;
        
        // Create overlay editor
        const editorOverlay = document.createElement('div');
        editorOverlay.id = 'text-editor-overlay';
        editorOverlay.style.cssText = `
            position: fixed;
            left: ${editorX}px;
            top: ${editorY}px;
            width: ${scaledTextWidth}px;
            min-height: 60px;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.95);
            border: 2px solid white;
            border-radius: 4px;
            padding: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        
        const textarea = document.createElement('textarea');
        textarea.value = block.content;
        textarea.style.cssText = `
            width: 100%;
            min-height: 60px;
            background: transparent;
            border: none;
            color: white;
            font-family: 'TT Commons Classic', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.5;
            resize: vertical;
            outline: none;
        `;
        
        editorOverlay.appendChild(textarea);
        document.body.appendChild(editorOverlay);
        
        // Focus and select all
        textarea.focus();
        textarea.select();
        
        // Handle closing
        const closeEditor = () => {
            block.content = textarea.value;
            editorOverlay.remove();
            this.updateGrid();
        };
        
        // Close on Escape or when clicking outside
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeEditor();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        
        const handleClickOutside = (e) => {
            if (!editorOverlay.contains(e.target)) {
                closeEditor();
                document.removeEventListener('click', handleClickOutside);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        
        // Add listeners with slight delay to prevent immediate closure
        setTimeout(() => {
            document.addEventListener('keydown', handleEscape);
            document.addEventListener('click', handleClickOutside);
        }, 100);
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
        this.drawRectangles(this.dom.svg, startX, startY, scaledFrontWidth, scaledFrontHeight, scaledThickness, scale);
        
        // Draw dimensions if enabled
        if (this.settings.showDimensions) {
            this.drawDimensions(this.dom.svg, startX, startY, scaledFrontWidth, scaledFrontHeight, scaledThickness, scale);
        }
        
        // Draw labels if enabled (but default is false now)
        if (this.settings.showLabels) {
            this.drawLabels(this.dom.svg, startX, startY, scaledFrontWidth, scaledFrontHeight, scaledThickness);
        }
        
        // Draw grid elements on front panel
        const frontX = startX + scaledThickness;
        const frontY = startY + scaledThickness;
        
        // Draw columns if enabled
        if (this.settings.showColumns) {
            this.drawColumns(this.dom.svg, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        }
        
        // Draw rows if enabled
        if (this.settings.showRows) {
            this.drawRows(this.dom.svg, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        }
        
        // Draw baseline if enabled
        if (this.settings.showBaseline) {
            this.drawBaseline(this.dom.svg, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
            
            // Draw baseline on side panels if they are visible
            if (this.settings.showSidePanels) {
                // Left panel - vertical baseline (margin from right side where it touches front)
                this.drawBaselineVerticalLeftRight(this.dom.svg, startX, frontY, scaledThickness, scaledFrontHeight, scale, 'left');
                
                // Right panel - vertical baseline (margin from left side where it touches front)
                this.drawBaselineVerticalLeftRight(this.dom.svg, startX + scaledThickness + scaledFrontWidth, frontY, scaledThickness, scaledFrontHeight, scale, 'right');
                
                // Top panel - horizontal baseline (margin from bottom where it touches front)
                this.drawBaselineTopBottom(this.dom.svg, frontX, startY, scaledFrontWidth, scaledThickness, scale, 'top');
                
                // Bottom panel - horizontal baseline (margin from top where it touches front)
                this.drawBaselineTopBottom(this.dom.svg, frontX, startY + scaledThickness + scaledFrontHeight, scaledFrontWidth, scaledThickness, scale, 'bottom');
            }
        }
        
        // Draw columns on side panels if they are visible and columns are enabled
        if (this.settings.showColumns && this.settings.showSidePanels) {
            // Left panel - vertical columns (using rows parameters from front)
            this.drawColumnsVerticalLeftRight(this.dom.svg, startX, frontY, scaledThickness, scaledFrontHeight, scale, 'left');
            
            // Right panel - vertical columns (using rows parameters from front)
            this.drawColumnsVerticalLeftRight(this.dom.svg, startX + scaledThickness + scaledFrontWidth, frontY, scaledThickness, scaledFrontHeight, scale, 'right');
            
            // Top panel - horizontal columns (using columns parameters from front)
            this.drawColumnsTopBottom(this.dom.svg, frontX, startY, scaledFrontWidth, scaledThickness, scale, 'top');
            
            // Bottom panel - horizontal columns (using columns parameters from front)
            this.drawColumnsTopBottom(this.dom.svg, frontX, startY + scaledThickness + scaledFrontHeight, scaledFrontWidth, scaledThickness, scale, 'bottom');
        }
        
        // Draw text blocks on front panel
        this.textBlocks.forEach(block => {
            this.drawTextBlock(this.dom.svg, block, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        });
    }
    
    // Universal method for creating SVG elements
    createSVGElement(type, attrs, container) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', type);
        Object.entries(attrs).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        container.appendChild(element);
        return element;
    }
    
    drawRectangles(container, x, y, frontW, frontH, thickness, scale = 1) {
        // For export: 0.25pt = 25.4/72*0.25 = 0.088194444... mm (since viewBox is in mm)
        const strokeWidth = scale === 1 ? '0.088194444' : '0.5';
        
        // Front (center) - always visible
        this.createSVGElement('rect', {
            x: x + thickness,
            y: y + thickness,
            width: frontW,
            height: frontH,
            fill: this.settings.boxColor,
            stroke: '#000000',
            'stroke-width': strokeWidth
        }, container);
        
        // Side panels - only if showSidePanels is enabled
        if (this.settings.showSidePanels) {
            // Left
            this.createSVGElement('rect', {
                x: x,
                y: y + thickness,
                width: thickness,
                height: frontH,
                fill: this.settings.boxColor,
                stroke: '#000000',
                'stroke-width': strokeWidth
            }, container);
            
            // Right
            this.createSVGElement('rect', {
                x: x + thickness + frontW,
                y: y + thickness,
                width: thickness,
                height: frontH,
                fill: this.settings.boxColor,
                stroke: '#000000',
                'stroke-width': strokeWidth
            }, container);
            
            // Top
            this.createSVGElement('rect', {
                x: x + thickness,
                y: y,
                width: frontW,
                height: thickness,
                fill: this.settings.boxColor,
                stroke: '#000000',
                'stroke-width': strokeWidth
            }, container);
            
            // Bottom
            this.createSVGElement('rect', {
                x: x + thickness,
                y: y + thickness + frontH,
                width: frontW,
                height: thickness,
                fill: this.settings.boxColor,
                stroke: '#000000',
                'stroke-width': strokeWidth
            }, container);
        }
    }
    
    drawDimensions(container, x, y, frontW, frontH, thickness, scale = 1) {
        const { frontWidth, frontHeight, thickness: thicknessMm } = this.settings;
        const offset = scale === 1 ? 5 : 15; // smaller offset in mm for export
        const fontSize = scale === 1 ? '3' : null; // fontSize only for export
        
        // Front width dimension (below front panel)
        this.createDimensionText(
            container,
            x + thickness + frontW / 2,
            y + thickness + frontH + offset,
            `${frontWidth.toFixed(1)} mm`,
            'middle',
            fontSize
        );
        
        // Front height dimension (right of front panel)
        this.createDimensionText(
            container,
            x + thickness + frontW + offset,
            y + thickness + frontH / 2,
            `${frontHeight.toFixed(1)} mm`,
            'middle',
            fontSize
        );
        
        // Thickness dimension (right of right panel)
        this.createDimensionText(
            container,
            x + thickness + frontW + thickness + offset,
            y + thickness + frontH / 2,
            `${thicknessMm.toFixed(1)} mm`,
            'middle',
            fontSize
        );
    }
    
    createDimensionText(container, x, y, text, anchor = 'middle', fontSize = null) {
        const attrs = {
            x,
            y,
            'text-anchor': anchor,
            'dominant-baseline': 'middle'
        };
        
        if (fontSize) {
            // Export mode
            attrs['font-size'] = fontSize;
            attrs['font-family'] = 'Arial, sans-serif';
            attrs['fill'] = '#666666';
        } else {
            // Display mode
            attrs['class'] = 'grid-text';
        }
        
        const textElement = this.createSVGElement('text', attrs, container);
        textElement.textContent = text;
    }
    
    drawLabels(container, x, y, frontW, frontH, thickness, scale = 1) {
        const fontSize = scale === 1 ? '4' : null;
        
        // Front label
        this.createLabel(container, x + thickness + frontW / 2, y + thickness + frontH / 2, 'FRONT', false, fontSize);
        
        // Left label
        this.createLabel(container, x + thickness / 2, y + thickness + frontH / 2, 'LEFT', true, fontSize);
        
        // Right label
        this.createLabel(container, x + thickness + frontW + thickness / 2, y + thickness + frontH / 2, 'RIGHT', true, fontSize);
        
        // Top label
        this.createLabel(container, x + thickness + frontW / 2, y + thickness / 2, 'TOP', false, fontSize);
        
        // Bottom label
        this.createLabel(container, x + thickness + frontW / 2, y + thickness + frontH + thickness / 2, 'BOTTOM', false, fontSize);
    }
    
    createLabel(container, x, y, text, rotate = false, fontSize = null) {
        const attrs = {
            x,
            y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle'
        };
        
        if (fontSize) {
            // Export mode
            attrs['font-size'] = fontSize;
            attrs['font-weight'] = '600';
            attrs['font-family'] = 'Arial, sans-serif';
            attrs['fill'] = '#999999';
        } else {
            // Display mode
            attrs['class'] = 'grid-label';
        }
        
        if (rotate) {
            attrs['transform'] = `rotate(-90 ${x} ${y})`;
        }
        
        const textElement = this.createSVGElement('text', attrs, container);
        textElement.textContent = text;
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
    
    drawColumns(container, x, y, width, height, scale) {
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
            this.createSVGElement('rect', {
                x: currentX,
                y: y + margin,
                width: scaledColumnWidth,
                height: height - 2 * margin,
                fill: gridColor,
                'fill-opacity': opacity,
                stroke: 'none'
            }, container);
            
            currentX += scaledColumnWidth + gutter;
        }
    }
    
    drawRows(container, x, y, width, height, scale) {
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
            
            this.createSVGElement('rect', {
                x: x + sideMargin,
                y: currentY,
                width: rowWidth,
                height: rowHeight,
                fill: gridColor,
                'fill-opacity': opacity,
                stroke: 'none'
            }, container);
            
            currentY += rowHeight + gutter;
        }
    }
    
    drawBaseline(container, x, y, width, height, scale) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.3);
        const margin = module * margins * scale;
        const baselineHeight = module * scale;
        const baselineWidth = width - 2 * margin;
        // For export: 0.25pt = 25.4/72*0.25 = 0.088194444... mm (since viewBox is in mm)
        const strokeWidth = scale === 1 ? '0.088194444' : '0.5';
        
        let currentY = y + margin;
        const maxY = y + height - margin;
        
        while (currentY + baselineHeight <= maxY) {
            this.createSVGElement('rect', {
                x: x + margin,
                y: currentY,
                width: baselineWidth,
                height: baselineHeight,
                fill: 'none',
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity
            }, container);
            
            currentY += baselineHeight;
        }
    }
    
    drawColumnsVerticalLeftRight(container, x, y, width, height, scale, side) {
        // Left and right panels use rows parameters from front (rotated 90°)
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.rowCount;
        const rowHeightInModules = this.settings.rowHeight;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.1);
        
        // Calculate "column" height (which is row height from front panel)
        let columnHeight = module * rowHeightInModules * scale;
        const margin = module * margins * scale;
        const gutter = module * scale;
        
        // Width with margins (same as front panel height logic)
        let columnWidth = width - 2 * margin;
        
        // Ensure minimum column width and center if needed
        const minColumnWidth = module * scale;
        let columnX = x + margin;
        if (columnWidth < minColumnWidth) {
            columnWidth = minColumnWidth;
            columnX = x + (width - columnWidth) / 2;
        }
        
        // Ensure minimum column height
        const minColumnHeight = module * scale;
        if (columnHeight < minColumnHeight) {
            columnHeight = minColumnHeight;
        }
        
        let currentY = y + margin;
        
        // Draw n "columns" vertically (using row parameters)
        for (let i = 0; i < n; i++) {
            // Check if there's enough space for this column
            if (currentY + columnHeight > y + height - margin) {
                break;
            }
            
            this.createSVGElement('rect', {
                x: columnX,
                y: currentY,
                width: columnWidth,
                height: columnHeight,
                fill: gridColor,
                'fill-opacity': opacity,
                stroke: 'none'
            }, container);
            
            currentY += columnHeight + gutter;
        }
    }
    
    drawColumnsTopBottom(container, x, y, width, height, scale, side) {
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
        let columnHeight = height - 2 * margin;
        
        // Ensure minimum column height and center if needed
        const minColumnHeight = module * scale;
        let columnY = y + margin;
        if (columnHeight < minColumnHeight) {
            columnHeight = minColumnHeight;
            columnY = y + (height - columnHeight) / 2;
        }
        
        let currentX = x + margin;
        
        for (let i = 0; i < n; i++) {
            this.createSVGElement('rect', {
                x: currentX,
                y: columnY,
                width: scaledColumnWidth,
                height: columnHeight,
                fill: gridColor,
                'fill-opacity': opacity,
                stroke: 'none'
            }, container);
            
            currentX += scaledColumnWidth + gutter;
        }
    }
    
    drawBaselineVerticalLeftRight(container, x, y, width, height, scale, side) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.3);
        const margin = module * margins * scale;
        const baselineWidth = module * scale;
        // For export: 0.25pt = 25.4/72*0.25 = 0.088194444... mm (since viewBox is in mm)
        const strokeWidth = scale === 1 ? '0.088194444' : '0.5';
        
        // Height with margins top and bottom
        const baselineHeight = height - 2 * margin;
        
        // Calculate how many full-width elements can fit
        const availableWidth = width - 2 * margin;
        const numFullElements = Math.floor(availableWidth / baselineWidth);
        
        // If no elements fit, draw a line at the center of the panel
        if (numFullElements <= 0) {
            const centerX = x + width / 2;
            this.createSVGElement('line', {
                x1: centerX,
                y1: y + margin,
                x2: centerX,
                y2: y + height - margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity
            }, container);
            return;
        }
        
        // Left panel: start from right edge (touching front) with margin, go left
        // Right panel: start from left edge (touching front) with margin, go right
        let currentX;
        
        if (side === 'left') {
            // Start from right edge with margin
            currentX = x + width - margin;
            
            // Draw elements from right to left (only full-width elements)
            for (let i = 0; i < numFullElements; i++) {
                const elementWidth = baselineWidth;
                const elementX = currentX - elementWidth;
                
                this.createSVGElement('rect', {
                    x: elementX,
                    y: y + margin,
                    width: elementWidth,
                    height: baselineHeight,
                    fill: 'none',
                    stroke: gridColor,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': opacity
                }, container);
                
                currentX -= elementWidth;
            }
            
            // Draw a vertical line at the left margin
            this.createSVGElement('line', {
                x1: x + margin,
                y1: y + margin,
                x2: x + margin,
                y2: y + height - margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity
            }, container);
            
        } else { // right
            // Start from left edge + margin, go right
            currentX = x + margin;
            
            // Draw elements from left to right (only full-width elements)
            for (let i = 0; i < numFullElements; i++) {
                this.createSVGElement('rect', {
                    x: currentX,
                    y: y + margin,
                    width: baselineWidth,
                    height: baselineHeight,
                    fill: 'none',
                    stroke: gridColor,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': opacity
                }, container);
                
                currentX += baselineWidth;
            }
            
            // Draw a vertical line at the right margin
            this.createSVGElement('line', {
                x1: x + width - margin,
                y1: y + margin,
                x2: x + width - margin,
                y2: y + height - margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity
            }, container);
        }
    }
    
    drawBaselineTopBottom(container, x, y, width, height, scale, side) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.3);
        const margin = module * margins * scale;
        const baselineHeight = module * scale;
        // For export: 0.25pt = 25.4/72*0.25 = 0.088194444... mm (since viewBox is in mm)
        const strokeWidth = scale === 1 ? '0.088194444' : '0.5';
        
        // Width with margins left and right
        const baselineWidth = width - 2 * margin;
        
        // Calculate how many full-height elements can fit
        const availableHeight = height - 2 * margin;
        const numFullElements = Math.floor(availableHeight / baselineHeight);
        
        // If no elements fit, draw a line at the center of the panel
        if (numFullElements <= 0) {
            const centerY = y + height / 2;
            this.createSVGElement('line', {
                x1: x + margin,
                y1: centerY,
                x2: x + width - margin,
                y2: centerY,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity
            }, container);
            return;
        }
        
        // Top panel: start from bottom edge (touching front) with margin, go up
        // Bottom panel: start from top edge (touching front) with margin, go down
        let currentY;
        
        if (side === 'top') {
            // Start from bottom edge with margin
            currentY = y + height - margin;
            
            // Draw only full-height elements from bottom to top
            for (let i = 0; i < numFullElements; i++) {
                const elementY = currentY - baselineHeight;
                
                this.createSVGElement('rect', {
                    x: x + margin,
                    y: elementY,
                    width: baselineWidth,
                    height: baselineHeight,
                    fill: 'none',
                    stroke: gridColor,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': opacity
                }, container);
                
                currentY -= baselineHeight;
            }
            
            // Draw a horizontal line at the top margin
            this.createSVGElement('line', {
                x1: x + margin,
                y1: y + margin,
                x2: x + width - margin,
                y2: y + margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity
            }, container);
            
        } else { // bottom
            // Start from top edge + margin, go down
            currentY = y + margin;
            
            // Draw only full-height elements from top to bottom
            for (let i = 0; i < numFullElements; i++) {
                this.createSVGElement('rect', {
                    x: x + margin,
                    y: currentY,
                    width: baselineWidth,
                    height: baselineHeight,
                    fill: 'none',
                    stroke: gridColor,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': opacity
                }, container);
                
                currentY += baselineHeight;
            }
            
            // Draw a horizontal line at the bottom margin
            this.createSVGElement('line', {
                x1: x + margin,
                y1: y + height - margin,
                x2: x + width - margin,
                y2: y + height - margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity
            }, container);
        }
    }
    
    exportSVG() {
        const { frontWidth, frontHeight, thickness, gridModule, margins, columnCount, rowCount, rowHeight } = this.settings;
        
        // Create a new SVG for export with actual mm dimensions
        const totalWidth = frontWidth + 2 * thickness;
        const totalHeight = frontHeight + 2 * thickness;
        const scale = 1; // Export uses scale = 1 (actual mm)
        
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
        this.drawRectangles(boxGroup, 0, 0, frontWidth, frontHeight, thickness, scale);
        
        // Draw grid elements on front panel (in mm)
        const frontX = thickness;
        const frontY = thickness;
        
        // Draw columns if enabled (in separate group)
        if (this.settings.showColumns) {
            const columnsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            columnsGroup.setAttribute('id', 'columns');
            exportSvg.appendChild(columnsGroup);
            this.drawColumns(columnsGroup, frontX, frontY, frontWidth, frontHeight, scale);
            
            // Draw columns on side panels if enabled
            if (this.settings.showSidePanels) {
                // Left panel - vertical columns (using rows parameters from front)
                this.drawColumnsVerticalLeftRight(columnsGroup, 0, frontY, thickness, frontHeight, scale, 'left');
                
                // Right panel - vertical columns (using rows parameters from front)
                this.drawColumnsVerticalLeftRight(columnsGroup, thickness + frontWidth, frontY, thickness, frontHeight, scale, 'right');
                
                // Top panel - horizontal columns (using columns parameters from front)
                this.drawColumnsTopBottom(columnsGroup, frontX, 0, frontWidth, thickness, scale, 'top');
                
                // Bottom panel - horizontal columns (using columns parameters from front)
                this.drawColumnsTopBottom(columnsGroup, frontX, thickness + frontHeight, frontWidth, thickness, scale, 'bottom');
            }
        }
        
        // Draw rows if enabled (in separate group)
        if (this.settings.showRows) {
            const rowsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            rowsGroup.setAttribute('id', 'rows');
            exportSvg.appendChild(rowsGroup);
            this.drawRows(rowsGroup, frontX, frontY, frontWidth, frontHeight, scale);
        }
        
        // Draw baseline if enabled (in separate group)
        if (this.settings.showBaseline) {
            const baselineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            baselineGroup.setAttribute('id', 'baseline');
            exportSvg.appendChild(baselineGroup);
            
            // Front panel baseline
            this.drawBaseline(baselineGroup, frontX, frontY, frontWidth, frontHeight, scale);
            
            // Side panels baseline if enabled
            if (this.settings.showSidePanels) {
                // Left panel - vertical baseline (margin from right side where it touches front)
                this.drawBaselineVerticalLeftRight(baselineGroup, 0, frontY, thickness, frontHeight, scale, 'left');
                
                // Right panel - vertical baseline (margin from left side where it touches front)
                this.drawBaselineVerticalLeftRight(baselineGroup, thickness + frontWidth, frontY, thickness, frontHeight, scale, 'right');
                
                // Top panel - horizontal baseline (margin from bottom where it touches front)
                this.drawBaselineTopBottom(baselineGroup, frontX, 0, frontWidth, thickness, scale, 'top');
                
                // Bottom panel - horizontal baseline (margin from top where it touches front)
                this.drawBaselineTopBottom(baselineGroup, frontX, thickness + frontHeight, frontWidth, thickness, scale, 'bottom');
            }
        }
        
        // Add dimensions if enabled (in separate group)
        if (this.settings.showDimensions) {
            const dimensionsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            dimensionsGroup.setAttribute('id', 'dimensions');
            exportSvg.appendChild(dimensionsGroup);
            this.drawDimensions(dimensionsGroup, 0, 0, frontWidth, frontHeight, thickness, scale);
        }
        
        // Add labels if enabled (in separate group)
        if (this.settings.showLabels) {
            const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelsGroup.setAttribute('id', 'labels');
            exportSvg.appendChild(labelsGroup);
            this.drawLabels(labelsGroup, 0, 0, frontWidth, frontHeight, thickness, scale);
        }
        
        // Add text blocks (in separate groups)
        this.textBlocks.forEach(block => {
            const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            textGroup.setAttribute('id', `text-${block.id}`);
            exportSvg.appendChild(textGroup);
            this.drawTextBlock(textGroup, block, frontX, frontY, frontWidth, frontHeight, scale);
        });
        
        // Convert to string
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(exportSvg);
        
        // Create blob and download
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `grid_width${frontWidth}_height${frontHeight}_thickness${thickness}_module${gridModule.toFixed(2)}_margins${margins.toFixed(2)}_columns${columnCount}_rows${rowCount}_rowheight${rowHeight}.svg`;
        link.href = url;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}

// Initialize when DOM is loaded and fonts are ready
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for fonts to load before initializing
    try {
        // Загружаем шрифт явно
        await document.fonts.load('500 16px "TT Commons Classic"');
        await document.fonts.load('400 16px "TT Commons Classic"');
        
        // Также ждем когда все шрифты будут готовы
        await document.fonts.ready;
    } catch (e) {
        console.warn('Font loading warning:', e);
    }
    
    // Небольшая дополнительная задержка для уверенности
    setTimeout(() => {
        new GridGenerator();
    }, 50);
});
