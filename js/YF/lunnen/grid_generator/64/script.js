// ============================================
// Импорты модулей
// ============================================
// Итерация 1: Утилиты
import { ColorUtils } from './src/utils/ColorUtils.js';
import { MathUtils } from './src/utils/MathUtils.js';
import { DOMUtils } from './src/utils/DOMUtils.js';
import { TextToPath } from './src/utils/TextToPath.js';

// Итерация 2: Core
import { Settings } from './src/core/Settings.js';

// Итерация 3: Grid
import { GridCalculator } from './src/grid/GridCalculator.js';
import { GridRenderer } from './src/grid/GridRenderer.js';

// Итерация 5: UI Controllers
import { SliderController } from './src/ui/SliderController.js';
import { ColorPicker } from './src/ui/ColorPicker.js';
import { PanelManager } from './src/ui/PanelManager.js';
import { ZoomPanManager } from './src/ui/ZoomPanManager.js';

// Итерация 6: Elements
import { TextBlockManager } from './src/elements/TextBlockManager.js';
import { TextRenderer } from './src/elements/TextRenderer.js';
import { GraphicsManager } from './src/elements/GraphicsManager.js';
import { GraphicsRenderer } from './src/elements/GraphicsRenderer.js';
import { ElementsNavigator } from './src/elements/ElementsNavigator.js';

// Итерация 7: SVG Export
import { SVGExporter } from './src/svg/SVGExporter.js';

class GridGenerator {
    constructor() {
        // Slider configuration - defines behavior for each slider
        // Дополнено min, max и valueId для использования с SliderController
        this.SLIDER_CONFIG = {
            frontWidthSlider: {
                valueId: 'frontWidthValue',
                setting: 'frontWidth',
                min: 10,
                max: 1000,
                decimals: 1,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => this.updateGrid()
            },
            frontHeightSlider: {
                valueId: 'frontHeightValue',
                setting: 'frontHeight',
                min: 10,
                max: 1000,
                decimals: 1,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        const module = this.gridCalculator.calculateModule();
                        this.settings.gridModule = module;
                        this.sliderController.setValue('gridModuleSlider', module, false);
                    } else {
                        const rowCount = this.gridCalculator.calculateRowCount();
                        this.settings.rowCount = rowCount;
                        this.sliderController.setValue('rowCountSlider', rowCount, false);
                    }
                    this.constrainAllObjectsToGrid();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            thicknessSlider: {
                valueId: 'thicknessValue',
                setting: 'thickness',
                min: 10,
                max: 1000,
                decimals: 1,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => this.updateGrid()
            },
            gridModuleSlider: {
                valueId: 'gridModuleValue',
                setting: 'gridModule',
                min: 0.1,
                max: 100,
                decimals: 4,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => {
                    const rowCount = this.gridCalculator.calculateRowCount();
                    this.settings.rowCount = rowCount;
                    this.sliderController.setValue('rowCountSlider', rowCount, false);
                    this.constrainAllObjectsToGrid();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            marginsSlider: {
                valueId: 'marginsValue',
                // ВАЖНО: margins всегда храним во ВНУТРЕННЕЙ системе в модулях,
                // а слайдер показывает либо модули, либо мм в зависимости от marginsUnit.
                // Поэтому setting здесь не указываем, а записываем в settings.margins
                // вручную внутри onUpdate с учётом текущей единицы.
                setting: null,
                min: 0,
                max: 50,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: (displayValue) => {
                    // displayValue приходит от SliderController (в текущей единице отображения).
                    // Если вызвано из старого кода без аргумента, читаем фактическое значение из слайдера.
                    let value = displayValue;
                    if (typeof value !== 'number' || Number.isNaN(value)) {
                        if (this.sliderController) {
                            const sliderValue = this.sliderController.getValue('marginsSlider');
                            value = typeof sliderValue === 'number' && !Number.isNaN(sliderValue)
                                ? sliderValue
                                : parseFloat(this.dom.marginsSlider?.value || '0');
                        } else {
                            value = parseFloat(this.dom.marginsSlider?.value || '0');
                        }
                    }

                    // Переводим отображаемое значение в модули и сохраняем во внутренних настройках
                    let marginsInMod;
                    const currentModule = this.settings.gridModule;
                    if (this.settings.marginsUnit === 'mm') {
                        marginsInMod = currentModule > 0 ? value / currentModule : 0;
                    } else {
                        marginsInMod = value;
                    }
                    marginsInMod = parseFloat(marginsInMod.toFixed(2));
                    this.settings.margins = marginsInMod;

                    // Дальше логика как раньше: пересчитываем модуль/кол-во строк и обновляем сетку
                    if (this.settings.linkMode === 'module') {
                        const module = this.gridCalculator.calculateModule();
                        this.settings.gridModule = module;
                        this.sliderController.setValue('gridModuleSlider', module, false);
                    } else {
                        const rowCount = this.gridCalculator.calculateRowCount();
                        this.settings.rowCount = rowCount;
                        this.sliderController.setValue('rowCountSlider', rowCount, false);
                    }
                    this.constrainAllObjectsToGrid();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            columnCountSlider: {
                valueId: 'columnCountValue',
                setting: 'columnCount',
                min: 1,
                max: 128,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.constrainAllObjectsToGrid();
                    this.updateGrid();
                }
            },
            rowCountSlider: {
                valueId: 'rowCountValue',
                setting: 'rowCount',
                min: 1,
                max: 128,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        const module = this.gridCalculator.calculateModule();
                        this.settings.gridModule = module;
                        this.sliderController.setValue('gridModuleSlider', module, false);
                    } else if (this.settings.linkMode === 'rows-height') {
                        const rowHeight = this.gridCalculator.calculateRowHeight();
                        this.settings.rowHeight = rowHeight;
                        this.sliderController.setValue('rowHeightSlider', rowHeight, false);
                    }
                    this.constrainAllObjectsToGrid();
                    this.updatePresetButtons();
                    this.updateGrid();
                }
            },
            rowHeightSlider: {
                valueId: 'rowHeightValue',
                setting: 'rowHeight',
                min: 1,
                max: 64,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        const module = this.gridCalculator.calculateModule();
                        this.settings.gridModule = module;
                        this.sliderController.setValue('gridModuleSlider', module, false);
                    } else if (this.settings.linkMode === 'rows-height') {
                        const rowCount = this.gridCalculator.calculateRowCount();
                        this.settings.rowCount = rowCount;
                        this.sliderController.setValue('rowCountSlider', rowCount, false);
                    }
                    this.constrainAllObjectsToGrid();
                    this.updatePresetButtons();
                    this.updateGrid();
                }
            },
            hueSlider: {
                valueId: 'hueValue',
                setting: null, // Handled specially by ColorPicker
                min: 0,
                max: 360,
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
                valueId: 'saturationValue',
                setting: null, // Handled specially by ColorPicker
                min: 0,
                max: 100,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                    this.updateBrightnessGradient();
                }
            },
            brightnessSlider: {
                valueId: 'brightnessValue',
                setting: null, // Handled specially by ColorPicker
                min: 0,
                max: 100,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                    this.updateSaturationGradient();
                }
            },
            headlineSizeSlider: {
                valueId: 'headlineSizeValue',
                setting: 'headlineSize',
                min: 0.01,
                max: 25,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            lineHeightSlider: {
                valueId: 'lineHeightValue',
                setting: 'lineHeight',
                min: 0.01,
                max: 50,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            trackingSlider: {
                valueId: 'trackingValue',
                setting: 'tracking',
                min: -0.1,
                max: 0.1,
                decimals: 3,
                baseStep: 0.001,
                shiftStep: 0.01,
                onUpdate: () => this.updateGrid()
            },
            textSizeSlider: {
                valueId: 'textSizeValue',
                setting: 'textSize',
                min: 0.01,
                max: 25,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            textLineHeightSlider: {
                valueId: 'textLineHeightValue',
                setting: 'textLineHeight',
                min: 0.01,
                max: 50,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            textTrackingSlider: {
                valueId: 'textTrackingValue',
                setting: 'textTracking',
                min: -0.1,
                max: 0.1,
                decimals: 3,
                baseStep: 0.001,
                shiftStep: 0.01,
                onUpdate: () => this.updateGrid()
            },
            captionSizeSlider: {
                valueId: 'captionSizeValue',
                setting: 'captionSize',
                min: 0.01,
                max: 25,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            captionLineHeightSlider: {
                valueId: 'captionLineHeightValue',
                setting: 'captionLineHeight',
                min: 0.01,
                max: 50,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            captionTrackingSlider: {
                valueId: 'captionTrackingValue',
                setting: 'captionTracking',
                min: -0.1,
                max: 0.1,
                decimals: 3,
                baseStep: 0.001,
                shiftStep: 0.01,
                onUpdate: () => this.updateGrid()
            },
            lunnenDisplaySizeSlider: {
                valueId: 'lunnenDisplaySizeValue',
                setting: 'lunnenDisplaySize',
                min: 0.01,
                max: 25,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            lunnenDisplayLineHeightSlider: {
                valueId: 'lunnenDisplayLineHeightValue',
                setting: 'lunnenDisplayLineHeight',
                min: 0.01,
                max: 50,
                decimals: 2,
                baseStep: 0.1,
                shiftStep: 1,
                onUpdate: () => this.updateGrid()
            },
            lunnenDisplayTrackingSlider: {
                valueId: 'lunnenDisplayTrackingValue',
                setting: 'lunnenDisplayTracking',
                min: -0.1,
                max: 0.1,
                decimals: 3,
                baseStep: 0.001,
                shiftStep: 0.01,
                onUpdate: () => this.updateGrid()
            }
        };
        
        // ============================================
        // Settings (Итерация 2: используем Settings модуль)
        // ============================================
        this.settingsModule = new Settings({
            frontWidth: 500,
            frontHeight: 500,
            thickness: 50,
            showLabels: false,
            showSidePanels: true,
            boxColor: '#404040',
            gridModule: 5.0505,
            margins: 2,
            marginsUnit: 'mod',
            columnCount: 12,
            rowCount: 12,
            rowHeight: 7,
            linkMode: 'module',
            showColumns: true,
            showRows: true,
            showBaseline: true,
            showObjects: true,
            headlineSize: 1.5,
            lineHeight: 2.0,
            tracking: -0.015,
            useXHeight: false,
            headlineFontWeight: 500,
            textSize: 0.5,
            textLineHeight: 1.0,
            textTracking: 0,
            useXHeight2: false,
            textFontWeight: 500,
            // Caption style
            captionSize: 0.5,
            captionLineHeight: 1.0,
            captionTracking: 0,
            useXHeightCaption: false,
            captionFontWeight: 500,
            // Lunnen Display style
            lunnenDisplaySize: 3.0,
            lunnenDisplayLineHeight: 4.0,
            lunnenDisplayTracking: 0,
            useXHeightLunnenDisplay: false
        });
        
        // Для обратной совместимости: создаем Proxy который перенаправляет обращения к settingsModule
        // Это КРИТИЧЕСКИ ВАЖНО! Без Proxy старый код будет читать устаревшую копию данных
        this.settings = new Proxy({}, {
            get: (target, prop) => {
                return this.settingsModule.get(prop);
            },
            set: (target, prop, value) => {
                this.settingsModule.set(prop, value);
                return true;
            }
        });
        
        // ============================================
        // Grid Calculator (Итерация 3)
        // ============================================
        this.gridCalculator = new GridCalculator(this.settingsModule);
        
        // ============================================
        // Grid Renderer (Итерация 4)
        // ============================================
        this.gridRenderer = new GridRenderer(this.settingsModule, this.gridCalculator);
        
        // ============================================
        // UI Controllers (Итерация 5)
        // ============================================
        // Инициализируем после cacheDOMElements()
        this.sliderController = null;
        this.colorPicker = null;
        this.panelManager = null;
        this.zoomPanManager = null;
        
        // ============================================
        // Elements Managers (Итерация 6)
        // ============================================
        // Пока используем старую систему (this.textBlocks, this.graphicsBlocks)
        // Полная миграция в TextBlockManager/GraphicsManager - следующий шаг
        this.textBlockManager = null;
        this.textRenderer = null;
        this.graphicsManager = null;
        this.graphicsRenderer = null;
        this.elementsNavigator = null;
        
        // Graphics blocks - UNIFIED array for all graphics (built-in and custom)
        // Initialize if not exists (for backward compatibility)
        if (!this.graphicsBlocks) {
            this.graphicsBlocks = [];
        }
        
        // Storage for deletion timers to allow cancellation
        this.deletionTimers = {};
        
        // Undo/Redo history
        this.history = [];
        this.historyIndex = 0;
        this.maxHistorySize = 50; // Maximum number of undo steps
        this.isRestoringState = false; // Flag to prevent saving state during undo/redo
        this.saveStateTimer = null; // Timer for debounced save
        
        // SVG content will be loaded from graphics/icons.svg in initializeBuiltInGraphics()
        // Initialize built-in graphics blocks (Icons and Claim)
        // Icons block  
        this.graphicsBlocks.push({
            id: 'icons',
            name: 'Icons',
            isBuiltIn: true,  // Flag to identify built-in graphics
            svgContent: '',  // Will be loaded from graphics/icons.svg
            heightInModules: 3,
            widthInModules: null,  // Calculated from aspect ratio
            sizeMode: 'height',  // 'height' or 'width'
            alignment: 'left',  // 'left' or 'right'
            x: 1,
            row: 0,  // Will be calculated
            baselineOffset: 0,  // Will be calculated
            showBounds: false,
            visible: false,
            originalWidth: 204.0944882,
            originalHeight: 28.3464567,
            lockPosition: true  // Constrain to grid bounds by default
        });
        
        // Claim block
        this.graphicsBlocks.push({
            id: 'claim',
            name: 'Claim',
            isBuiltIn: true,  // Flag to identify built-in graphics
            svgContent: '',  // Will be loaded from graphics/yf_claim.svg
            heightInModules: 3,
            widthInModules: null,  // Calculated from aspect ratio
            sizeMode: 'height',  // 'height' or 'width'
            alignment: 'left',  // 'left' or 'right'
            x: 7,
            row: 0,  // Will be calculated
            baselineOffset: 0,  // Will be calculated
            showBounds: false,
            visible: false,
            originalWidth: 186.2242584,
            originalHeight: 28.3464565,
            lockPosition: true  // Constrain to grid bounds by default
        });
        
        // Calculate initial positions for built-in graphics
        this.updateBuiltInGraphicsPositions();
        
        // Text blocks - пустой массив по умолчанию
        this.textBlocks = [];
        
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
        
        // Начальное состояние блока (для отмены изменений)
        this.initialBlockState = null;
        
        // Font metrics for TT Commons Classic (measured in font units, assuming UPM=1000)
        this.fontMetrics = {
            'TT Commons Classic': {
                capHeight: 630,
                xHeight: 447,
                unitsPerEm: 1000
            },
            // Lunnen Display metrics (x-height similar to TT Commons)
            'Lunnen Display': {
                capHeight: 630,
                xHeight: 447,
                unitsPerEm: 1000
            }
        };
        
        // Display constants
        this.PADDING = 60; // padding around the grid (increased for dimensions)
        
        // Cache DOM elements
        this.dom = this.cacheDOMElements();
        
        // ============================================
        // Initialize UI Controllers (Итерация 5)
        // ============================================
        this.initUIControllers();
        
        // ============================================
        // SVG Exporter (Итерация 7)
        // ============================================
        this.textToPath = new TextToPath();
        this.svgExporter = new SVGExporter(this.settingsModule, this.textToPath);
        
        // ============================================
        // Presets (Итерация 10)
        // ============================================
        this.availablePresets = [];
        this.loadPresetsManifest();
        
        // Calculate initial row count to fill the format (after DOM is ready)
        const rowCount = this.gridCalculator.calculateRowCount();
        this.settings.rowCount = rowCount;
        this.sliderController.setValue('rowCountSlider', rowCount, false);
        
        // Generate row presets
        this.generateRowPresets();
        
        // Initialize
        this.initEventListeners();
        
        // ============================================
        // Initialize UI Controllers (Итерация 5.2 & 5.3)
        // ============================================
        // ColorPicker - ВРЕМЕННО ОТКЛЮЧЕНО
        // this.colorPicker.init();
        // console.log('✅ ColorPicker initialized');
        
        // PanelManager - регистрация всех панелей
        this.initPanels();
        console.log('✅ PanelManager initialized with all panels');
        
        // Save initial state for undo
        this.saveState();
        this.initValueInputs();
        this.initSizeInputsWithArrows();
        this.initCollapsibleSections();
        this.initDropdowns();
        this.initParagraphPanel();
        // DEPRECATED: Icons and Claim now use unified graphics system
        // this.initIconsPanel();
        // this.initIconsInputsWithArrows();
        // this.initClaimPanel();
        // this.initClaimInputsWithArrows();
        this.initGraphicsPanel();
        this.initPanelClickOutsideHandler();
        this.initElementsNavigator();
        this.updateLinkedControlsVisual();
        this.initColorPreview();
        this.updateTextWidthConstraints();
        this.updateCanvasSize();
        this.updateGrid();
        
        // Автоматический fit to screen при загрузке (с задержкой для отрисовки SVG)
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (this.zoomPanManager) {
                    this.zoomPanManager.fitToScreen();
                }
            }, 100);
        });
        
        // Update canvas size on window resize
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.updateGrid();
        });
    }
    
    // Getters for backward compatibility with existing code
    get iconsBlock() {
        return this.graphicsBlocks.find(b => b.id === 'icons');
    }
    
    set iconsBlock(value) {
        // Setter for backward compatibility (used when setting to null)
        if (value === null) {
            const index = this.graphicsBlocks.findIndex(b => b.id === 'icons');
            if (index !== -1) {
                this.graphicsBlocks.splice(index, 1);
            }
        }
    }
    
    get claimBlock() {
        return this.graphicsBlocks.find(b => b.id === 'claim');
    }
    
    set claimBlock(value) {
        // Setter for backward compatibility (used when setting to null)
        if (value === null) {
            const index = this.graphicsBlocks.findIndex(b => b.id === 'claim');
            if (index !== -1) {
                this.graphicsBlocks.splice(index, 1);
            }
        }
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
            showSidePanels: document.getElementById('showSidePanels'),
            showColumns: document.getElementById('showColumns'),
            showRows: document.getElementById('showRows'),
            showBaseline: document.getElementById('showBaseline'),
            showObjects: document.getElementById('showObjects'),
            
            // Link mode radio buttons
            linkModeOff: document.getElementById('linkModeOff'),
            linkModeRowsHeight: document.getElementById('linkModeRowsHeight'),
            linkModeModule: document.getElementById('linkModeModule'),
            
            // Grid controls
            gridModuleSlider: document.getElementById('gridModuleSlider'),
            gridModuleValue: document.getElementById('gridModuleValue'),
            marginsSlider: document.getElementById('marginsSlider'),
            marginsValue: document.getElementById('marginsValue'),
            marginsUnitMod: document.getElementById('marginsUnitMod'),
            marginsUnitMm: document.getElementById('marginsUnitMm'),
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
            convertToOutlinesCheckbox: document.getElementById('convertToOutlinesCheckbox'),
            exportSettingsBtn: document.getElementById('exportSettingsBtn'),
            importSettingsBtn: document.getElementById('importSettingsBtn'),
            presetDropdown: document.getElementById('presetDropdown'),
            presetDropdownToggle: document.getElementById('presetDropdownToggle'),
            presetDropdownMenu: document.getElementById('presetDropdownMenu'),
            presetDropdownText: null, // Will be set after DOM is ready
            
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
            // Text controls - Caption
            captionSizeSlider: document.getElementById('captionSizeSlider'),
            captionSizeValue: document.getElementById('captionSizeValue'),
            captionLineHeightSlider: document.getElementById('captionLineHeightSlider'),
            captionLineHeightValue: document.getElementById('captionLineHeightValue'),
            captionTrackingSlider: document.getElementById('captionTrackingSlider'),
            captionTrackingValue: document.getElementById('captionTrackingValue'),
            useXHeightCaption: document.getElementById('useXHeightCaption'),
            captionFontSize: document.getElementById('captionFontSize'),
            // Text controls - Lunnen Display
            lunnenDisplaySizeSlider: document.getElementById('lunnenDisplaySizeSlider'),
            lunnenDisplaySizeValue: document.getElementById('lunnenDisplaySizeValue'),
            lunnenDisplayLineHeightSlider: document.getElementById('lunnenDisplayLineHeightSlider'),
            lunnenDisplayLineHeightValue: document.getElementById('lunnenDisplayLineHeightValue'),
            lunnenDisplayTrackingSlider: document.getElementById('lunnenDisplayTrackingSlider'),
            lunnenDisplayTrackingValue: document.getElementById('lunnenDisplayTrackingValue'),
            lunnenDisplayFontSize: document.getElementById('lunnenDisplayFontSize'),
            // Paragraph settings panel
            paragraphPanel: document.getElementById('paragraphPanel'),
            paragraphPanelTitle: document.getElementById('paragraphPanelTitle'),
            paragraphXInput: document.getElementById('paragraphXInput'),
            paragraphRowInput: document.getElementById('paragraphRowInput'),
            paragraphBaselineInput: document.getElementById('paragraphBaselineInput'),
            paragraphWidthInput: document.getElementById('paragraphWidthInput'),
            paragraphTextArea: document.getElementById('paragraphTextArea'),
            charCounter: document.getElementById('charCounter'),
            // Alignment mode radio buttons
            alignmentModeBaseline: document.getElementById('alignmentModeBaseline'),
            alignmentModeXHeight: document.getElementById('alignmentModeXHeight'),
            // Lock position toggle
            paragraphLockPositionToggle: document.getElementById('paragraphLockPositionToggle'),
            // Align right toggle
            paragraphAlignRightToggle: document.getElementById('paragraphAlignRightToggle'),
            // Font size displays
            headlineFontSize: document.getElementById('headlineFontSize'),
            textFontSize: document.getElementById('textFontSize'),
            // Font weight controls
            headlineFontWeightRegular: document.getElementById('headlineFontWeightRegular'),
            headlineFontWeightMedium: document.getElementById('headlineFontWeightMedium'),
            textFontWeightRegular: document.getElementById('textFontWeightRegular'),
            textFontWeightMedium: document.getElementById('textFontWeightMedium'),
            // Icons settings panel
            iconsPanel: document.getElementById('iconsPanel'),
            iconsPanelTitle: document.getElementById('iconsPanelTitle'),
            iconsXInput: document.getElementById('iconsXInput'),
            iconsRowInput: document.getElementById('iconsRowInput'),
            iconsBaselineInput: document.getElementById('iconsBaselineInput'),
            iconsHeightInput: document.getElementById('iconsHeightInput'),
            iconsApplyBtn: document.getElementById('iconsApplyBtn'),
            iconsCloseBtn: document.getElementById('iconsCloseBtn'),
            // Claim settings panel
            claimPanel: document.getElementById('claimPanel'),
            claimPanelTitle: document.getElementById('claimPanelTitle'),
            claimXInput: document.getElementById('claimXInput'),
            claimRowInput: document.getElementById('claimRowInput'),
            claimBaselineInput: document.getElementById('claimBaselineInput'),
            claimHeightInput: document.getElementById('claimHeightInput'),
            claimApplyBtn: document.getElementById('claimApplyBtn'),
            claimCloseBtn: document.getElementById('claimCloseBtn'),
            // Elements navigator
            elementsNavigator: document.getElementById('elementsNavigator'),
            elementsNavigatorHeader: document.getElementById('elementsNavigatorHeader'),
            elementsList: document.getElementById('elementsList'),
            addTextBtn: document.getElementById('addTextBtn'),
            addGraphicsBtn: document.getElementById('addGraphicsBtn'),
            // Graphics upload panel
            graphicsPanel: document.getElementById('graphicsPanel'),
            graphicsPanelTitle: document.getElementById('graphicsPanelTitle'),
            graphicsXInput: document.getElementById('graphicsXInput'),
            graphicsRowInput: document.getElementById('graphicsRowInput'),
            graphicsBaselineInput: document.getElementById('graphicsBaselineInput'),
            graphicsSizeInput: document.getElementById('graphicsSizeInput'),
            graphicsSizeUnitHeight: document.getElementById('graphicsSizeUnitHeight'),
            graphicsSizeUnitWidth: document.getElementById('graphicsSizeUnitWidth'),
            graphicsHeightInput: document.getElementById('graphicsHeightInput'), // Keep for backward compatibility
            graphicsLockPositionToggle: document.getElementById('graphicsLockPositionToggle'),
            graphicsAlignRightToggle: document.getElementById('graphicsAlignRightToggle'),
            fileUploadArea: document.getElementById('fileUploadArea'),
            svgFileInput: document.getElementById('svgFileInput'),
            // Paragraph style select
            paragraphStyleSelect: document.getElementById('paragraphStyleSelect'),
            paragraphSurfaceSelect: document.getElementById('paragraphSurfaceSelect'),
            // Graphics surface select
            graphicsSurfaceSelect: document.getElementById('graphicsSurfaceSelect'),
            // Zoom controls
            canvasContainer: document.getElementById('canvasContainer'),
            zoomIndicator: document.getElementById('zoomIndicator')
        };
    }
    
    // ============================================
    // OLD SLIDER LOGIC - REPLACED BY SliderController (Итерация 5)
    // ============================================
    // Старый метод initSlider больше не используется
    // Все слайдеры теперь управляются через SliderController в initUIControllers()
    
    initEventListeners() {
        // ============================================
        // NOTE: Slider initialization moved to initUIControllers()
        // ============================================
        
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
                const module = this.gridCalculator.calculateModule();
                this.settings.gridModule = module;
                this.sliderController.setValue('gridModuleSlider', module, false);
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
        
        // Show objects checkbox
        this.dom.showObjects.addEventListener('change', (e) => {
            this.settings.showObjects = e.target.checked;
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
        
        // Use x-height Caption checkbox
        if (this.dom.useXHeightCaption) {
            this.dom.useXHeightCaption.addEventListener('change', (e) => {
                this.settings.useXHeightCaption = e.target.checked;
                this.updateGrid();
            });
        }
        
        
        // Margins unit buttons
        if (this.dom.marginsUnitMod) {
            this.dom.marginsUnitMod.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.settings.marginsUnit !== 'mod') {
                    this.switchMarginsUnit('mod');
                }
            });
        }
        if (this.dom.marginsUnitMm) {
            this.dom.marginsUnitMm.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.settings.marginsUnit !== 'mm') {
                    this.switchMarginsUnit('mm');
                }
            });
        }
        
        // Style dropdowns в панели Text Styles - изменяют начертание (font-weight)
        const headlineStyleDropdown = document.getElementById('headlineStyleDropdown');
        const textStyleDropdown = document.getElementById('textStyleDropdown');
        
        if (headlineStyleDropdown) {
            headlineStyleDropdown.addEventListener('change', (e) => {
                this.settings.headlineFontWeight = parseInt(e.target.value);
                this.updateElementsNavigator();
                this.updateGrid();
            });
        }
        
        if (textStyleDropdown) {
            textStyleDropdown.addEventListener('change', (e) => {
                this.settings.textFontWeight = parseInt(e.target.value);
                this.updateElementsNavigator();
                this.updateGrid();
            });
        }
        
        const captionStyleDropdown = document.getElementById('captionStyleDropdown');
        if (captionStyleDropdown) {
            captionStyleDropdown.addEventListener('change', (e) => {
                this.settings.captionFontWeight = parseInt(e.target.value);
                this.updateElementsNavigator();
                this.updateGrid();
            });
        }
        
        // Lunnen Display doesn't have font weight dropdown (always Regular)
        
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
            // Обновляем через оба способа для совместимости
            this.settings.boxColor = lunnenBlueColor;
            this.settingsModule.set('boxColor', lunnenBlueColor);
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
                
                // Обновляем через оба способа для совместимости
                this.settings.boxColor = hexValue;
                this.settingsModule.set('boxColor', hexValue);
                this.dom.colorPreview.style.backgroundColor = hexValue;
                this.updateHSBFromHex(hexValue);
                this.updateGrid();
            }
        });
        
        // Validate hex input when focus is lost
        this.dom.hexColorInput.addEventListener('blur', (e) => {
            let hexValue = e.target.value;
            
            if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/)) {
                // Если некорректный, берем текущий цвет из настроек вместо дефолтного
                hexValue = this.settingsModule.get('boxColor') || '#dadde6';
            }
            
            e.target.value = hexValue;
            // Обновляем через оба способа для совместимости
            this.settings.boxColor = hexValue;
            this.settingsModule.set('boxColor', hexValue);
            this.dom.colorPreview.style.backgroundColor = hexValue;
            this.updateHSBFromHex(hexValue);
            this.updateGrid();
        });
        
        // Export button
        this.dom.exportBtn.addEventListener('click', () => this.exportSVG());
        
        // Export Settings button
        this.dom.exportSettingsBtn.addEventListener('click', () => this.exportSettings());
        
        // Import Settings button (Итерация 7)
        if (this.dom.importSettingsBtn) {
            this.dom.importSettingsBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.importSettings(file);
                    }
                };
                input.click();
            });
        }
        
        // Help button removed
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd+E / Ctrl+E - Export SVG
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportSVG();
            }
            // Cmd+Z / Ctrl+Z - Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
        });
        
        // Initialize panel collapse functionality
        this.initPanelCollapse();
    }
    
    
    // ============================================
    // Panel Collapse Functionality
    // ============================================
    
    initPanelCollapse() {
        // Storage for text styles state
        this.textStylesState = {
            headline: false, // false = collapsed
            text: false,
            caption: false,
            lunnenDisplay: false
        };
        
        // Find all collapse icons
        const collapseIcons = document.querySelectorAll('.collapse-icon');
        
        collapseIcons.forEach(icon => {
            const panel = icon.closest('.controls-panel');
            if (!panel) return;
            
            const header = icon.closest('.panel-header');
            const content = panel.querySelector('.panel-content');
            
            if (!header || !content) return;
            
            // Check if panel is bottom-anchored (like elements-navigator and text panel)
            const isBottomAnchored = panel.classList.contains('elements-navigator') || panel.classList.contains('controls-panel-text');
            
            // Check if this is the text styles panel
            const isTextPanel = panel.classList.contains('controls-panel-text');
            
            // Store original position for bottom-anchored panels
            if (isBottomAnchored && !panel.dataset.originalTop) {
                // Save the initial top position when panel is first loaded
                const rect = panel.getBoundingClientRect();
                panel.dataset.originalTop = rect.top;
            }
            
            // Click handler
            const toggleCollapse = (e) => {
                e.stopPropagation(); // Prevent drag from triggering
                
                const isCollapsed = panel.classList.contains('panel-collapsed');
                
                if (isCollapsed) {
                    // Expand
                    panel.classList.remove('panel-collapsed');
                    icon.classList.remove('collapsed');
                    icon.setAttribute('aria-label', 'Collapse panel');
                    
                    // For bottom-anchored panels, keep the top position (don't switch back to bottom)
                    // This prevents the panel from jumping
                    
                    // Restore text styles state if this is text panel
                    if (isTextPanel) {
                        this.restoreTextStylesState();
                    }
                } else {
                    // Collapse
                    // Save text styles state if this is text panel
                    if (isTextPanel) {
                        this.saveTextStylesState();
                    }
                    
                    // For bottom-anchored panels, switch to top anchor before collapsing
                    if (isBottomAnchored) {
                        const rect = panel.getBoundingClientRect();
                        panel.style.top = `${rect.top}px`;
                        panel.style.bottom = 'auto';
                    }
                    
                    panel.classList.add('panel-collapsed');
                    icon.classList.add('collapsed');
                    icon.setAttribute('aria-label', 'Expand panel');
                }
                
                // Update panel params display
                this.updatePanelParams();
            };
            
            icon.addEventListener('click', toggleCollapse);
            
            // Keyboard support
            icon.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCollapse(e);
                }
            });
        });
    }
    
    saveTextStylesState() {
        // Save current state of all text style collapsible sections
        const headlineToggle = document.querySelector('#headlineHeader .collapse-toggle');
        const textToggle = document.querySelector('#textHeader .collapse-toggle');
        const captionToggle = document.querySelector('#captionHeader .collapse-toggle');
        const lunnenDisplayToggle = document.querySelector('#lunnenDisplayHeader .collapse-toggle');
        
        if (headlineToggle) {
            this.textStylesState.headline = headlineToggle.getAttribute('aria-expanded') === 'true';
        }
        if (textToggle) {
            this.textStylesState.text = textToggle.getAttribute('aria-expanded') === 'true';
        }
        if (captionToggle) {
            this.textStylesState.caption = captionToggle.getAttribute('aria-expanded') === 'true';
        }
        if (lunnenDisplayToggle) {
            this.textStylesState.lunnenDisplay = lunnenDisplayToggle.getAttribute('aria-expanded') === 'true';
        }
    }
    
    restoreTextStylesState() {
        // Restore saved state of all text style collapsible sections
        const headlineToggle = document.querySelector('#headlineHeader .collapse-toggle');
        const textToggle = document.querySelector('#textHeader .collapse-toggle');
        const captionToggle = document.querySelector('#captionHeader .collapse-toggle');
        const lunnenDisplayToggle = document.querySelector('#lunnenDisplayHeader .collapse-toggle');
        
        const headlineContent = document.getElementById('headlineContent');
        const textContent = document.getElementById('textContent');
        const captionContent = document.getElementById('captionContent');
        const lunnenDisplayContent = document.getElementById('lunnenDisplayContent');
        
        if (headlineToggle && headlineContent) {
            if (this.textStylesState.headline) {
                headlineToggle.setAttribute('aria-expanded', 'true');
                headlineContent.classList.remove('collapsed');
            } else {
                headlineToggle.setAttribute('aria-expanded', 'false');
                headlineContent.classList.add('collapsed');
            }
        }
        
        if (textToggle && textContent) {
            if (this.textStylesState.text) {
                textToggle.setAttribute('aria-expanded', 'true');
                textContent.classList.remove('collapsed');
            } else {
                textToggle.setAttribute('aria-expanded', 'false');
                textContent.classList.add('collapsed');
            }
        }
        
        if (captionToggle && captionContent) {
            if (this.textStylesState.caption) {
                captionToggle.setAttribute('aria-expanded', 'true');
                captionContent.classList.remove('collapsed');
            } else {
                captionToggle.setAttribute('aria-expanded', 'false');
                captionContent.classList.add('collapsed');
            }
        }
        
        if (lunnenDisplayToggle && lunnenDisplayContent) {
            if (this.textStylesState.lunnenDisplay) {
                lunnenDisplayToggle.setAttribute('aria-expanded', 'true');
                lunnenDisplayContent.classList.remove('collapsed');
            } else {
                lunnenDisplayToggle.setAttribute('aria-expanded', 'false');
                lunnenDisplayContent.classList.add('collapsed');
            }
        }
    }
    
    // Update panel parameters display in collapsed state
    updatePanelParams() {
        // Grid panel
        const gridParams = document.getElementById('gridParams');
        if (gridParams) {
            const mod = this.settings.gridModule.toFixed(2);
            const col = this.settings.columnCount;
            const row = this.settings.rowCount;
            gridParams.textContent = `Mod ${mod}  •  Col ${col}  •  Row ${row}`;
        }
        
        // Dimensions panel
        const dimensionsParams = document.getElementById('dimensionsParams');
        if (dimensionsParams) {
            const w = Math.round(this.settings.frontWidth);
            const h = Math.round(this.settings.frontHeight);
            const t = Math.round(this.settings.thickness);
            dimensionsParams.textContent = `${w}\u2009×\u2009${h}\u2009×\u2009${t} mm`;
        }
        
        // Objects panel
        const objectsParams = document.getElementById('objectsParams');
        if (objectsParams) {
            const textCount = this.textBlocks.length;
            const graphicsCount = this.graphicsBlocks.length;
            objectsParams.textContent = `Txt ${textCount}  •  Obj ${graphicsCount}`;
        }
        
        // Text styles panel
        const textStylesParams = document.getElementById('textStylesParams');
        if (textStylesParams) {
            const stylesCount = this.getTextStylesCount();
            textStylesParams.textContent = `${stylesCount} styles`;
        }
    }
    
    getTextStylesCount() {
        if (!Array.isArray(this.textBlocks)) return 0;
        
        const uniqueStyles = new Set();
        
        this.textBlocks.forEach(block => {
            if (block.styleRef) {
                uniqueStyles.add(block.styleRef);
            }
        });
        
        return uniqueStyles.size;
    }
    
    // ============================================
    // Presets Management (Итерация 10)
    // ============================================
    
    async loadPresetsManifest() {
        const manifestUrl = `presets/manifest.json?ts=${Date.now()}`;
        
        try {
            const response = await fetch(manifestUrl, {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                console.warn('No presets manifest found, trying direct folder scan');
                const fallbackLoaded = await this.loadPresetsFromDirectoryListing();
                if (!fallbackLoaded) {
                    this.updateDropdownText('No presets available');
                }
                return;
            }
            
            const manifest = await response.json();
            const presetsFromManifest = Array.isArray(manifest.presets) ? manifest.presets : [];
            
            let hasManifestPresets = presetsFromManifest.length > 0;
            let mergedPresets = presetsFromManifest;
            
            const directoryPresets = await this.loadPresetsFromDirectoryListing(false);
            if (Array.isArray(directoryPresets) && directoryPresets.length > 0) {
                mergedPresets = this.mergePresetLists(presetsFromManifest, directoryPresets);
                hasManifestPresets = mergedPresets.length > 0;
            }
            
            if (!hasManifestPresets) {
                console.warn('No presets available in manifest or directory listing');
                this.updateDropdownText('No presets available');
                return;
            }
            
            this.availablePresets = mergedPresets;
            this.initializePresets();
        } catch (error) {
            console.warn('Failed to load presets manifest, attempting fallback:', error);
            const fallbackLoaded = await this.loadPresetsFromDirectoryListing();
            if (!fallbackLoaded) {
                this.updateDropdownText('Error loading presets');
            }
        }
    }
    
    async loadPresetsFromDirectoryListing(applyImmediately = true) {
        try {
            // Сначала пробуем обычный directory listing
            const listingResponse = await fetch(`presets/?ts=${Date.now()}`, {
                cache: 'no-store'
            });
            
            if (!listingResponse.ok) {
                console.warn('Presets directory listing request failed, trying GitHub API...');
                return await this.loadPresetsFromGitHubAPI(applyImmediately);
            }
            
            const contentType = listingResponse.headers.get('content-type') || '';
            if (!contentType.includes('text') && !contentType.includes('html')) {
                console.warn('Presets directory listing returned unsupported content type, trying GitHub API...');
                return await this.loadPresetsFromGitHubAPI(applyImmediately);
            }
            
            const listingHtml = await listingResponse.text();
            const files = this.extractJsonFilenamesFromListing(listingHtml);
            
            if (files.length === 0) {
                console.warn('No JSON files in directory listing, trying GitHub API...');
                return await this.loadPresetsFromGitHubAPI(applyImmediately);
            }
            
            const presets = [];
            for (const file of files) {
                const presetMeta = await this.fetchPresetMetadataFromFile(file);
                if (presetMeta) {
                    presets.push(presetMeta);
                }
            }
            
            if (presets.length === 0) {
                console.warn('Could not read any presets, trying GitHub API...');
                return await this.loadPresetsFromGitHubAPI(applyImmediately);
            }
            
            const sortedPresets = presets.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            
            if (applyImmediately) {
                this.availablePresets = sortedPresets;
                this.initializePresets();
                return true;
            }
            
            return sortedPresets;
        } catch (error) {
            console.warn('Failed to scan presets directory, trying GitHub API:', error);
            return await this.loadPresetsFromGitHubAPI(applyImmediately);
        }
    }
    
    async loadPresetsFromGitHubAPI(applyImmediately = true) {
        try {
            // GitHub API endpoint для получения списка файлов в папке
            const apiUrl = 'https://api.github.com/repos/mishaivanov/takeitontheother.site/contents/js/YF/lunnen/grid_generator/presets';
            
            const response = await fetch(apiUrl, {
                cache: 'no-store',
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                console.warn('GitHub API request failed with status', response.status);
                return applyImmediately ? false : null;
            }
            
            const files = await response.json();
            
            // Фильтруем только .json файлы, кроме manifest.json
            const presetFiles = files.filter(file => 
                file.type === 'file' && 
                file.name.endsWith('.json') && 
                file.name !== 'manifest.json'
            );
            
            if (presetFiles.length === 0) {
                console.warn('No preset files found via GitHub API');
                return applyImmediately ? false : null;
            }
            
            console.log(`📦 Found ${presetFiles.length} preset(s) via GitHub API`);
            
            const presets = [];
            for (const file of presetFiles) {
                const presetMeta = await this.fetchPresetMetadataFromFile(file.name);
                if (presetMeta) {
                    presets.push(presetMeta);
                }
            }
            
            if (presets.length === 0) {
                console.warn('Could not read any presets via GitHub API');
                return applyImmediately ? false : null;
            }
            
            const sortedPresets = presets.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            
            if (applyImmediately) {
                this.availablePresets = sortedPresets;
                this.initializePresets();
                console.log('✅ Presets loaded via GitHub API');
                return true;
            }
            
            return sortedPresets;
        } catch (error) {
            console.warn('Failed to load presets via GitHub API:', error);
            return applyImmediately ? false : null;
        }
    }
    
    mergePresetLists(primaryList = [], secondaryList = []) {
        const merged = [];
        const seenFiles = new Set();
        
        const addPreset = (preset) => {
            if (!preset || !preset.file) return;
            const normalizedFile = preset.file.toLowerCase();
            if (seenFiles.has(normalizedFile)) return;
            seenFiles.add(normalizedFile);
            merged.push(preset);
        };
        
        primaryList.forEach(addPreset);
        secondaryList.forEach(addPreset);
        
        return merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    
    extractJsonFilenamesFromListing(listingHtml) {
        const files = new Set();
        const regex = /href="([^"]+\.json)"/gi;
        let match;
        
        while ((match = regex.exec(listingHtml)) !== null) {
            const rawPath = match[1];
            const normalized = this.normalizePresetFilename(rawPath);
            if (
                normalized &&
                !/manifest\.json$/i.test(normalized) &&
                !/readme\.json$/i.test(normalized)
            ) {
                files.add(normalized);
            }
        }
        
        return Array.from(files);
    }
    
    normalizePresetFilename(filePath) {
        if (!filePath) return null;
        const decoded = decodeURIComponent(filePath)
            .replace(/\\/g, '/')
            .replace(/^\.?\//, '')
            .replace(/^presets\//i, '');
        return decoded.trim();
    }
    
    async fetchPresetMetadataFromFile(fileName) {
        if (!fileName) return null;
        
        // Use encodeURIComponent for proper encoding of special characters like quotes
        const encodedName = encodeURIComponent(fileName);
        const url = `presets/${encodedName}?ts=${Date.now()}`;
        const fallbackName = this.getPresetDisplayNameFromFilename(fileName);
        
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                console.warn(`Failed to fetch preset ${fileName}:`, response.status);
                return {
                    name: fallbackName,
                    file: fileName
                };
            }
            
            const presetData = await response.json();
            return {
                name: presetData.presetName || fallbackName,
                file: fileName
            };
        } catch (error) {
            console.warn(`Failed to parse preset ${fileName}:`, error);
            return {
                name: fallbackName,
                file: fileName
            };
        }
    }
    
    getPresetDisplayNameFromFilename(fileName) {
        const base = fileName.replace(/^.*\//, '').replace(/\.json$/i, '');
        return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || base || 'Preset';
    }
    
    initializePresets() {
        if (!this.dom.presetDropdownToggle || !this.dom.presetDropdownMenu || this.availablePresets.length === 0) return;
        
        // Get text element
        this.dom.presetDropdownText = this.dom.presetDropdownToggle.querySelector('.preset-dropdown-text');
        
        // Clear menu
        this.dom.presetDropdownMenu.innerHTML = '';
        
        // Current selected preset
        this.currentPreset = null;
        this.currentPresetName = 'Custom';
        
        // Track widths for animation
        this.presetWidths = {};
        
        // Populate dropdown menu with presets
        this.availablePresets.forEach((preset, index) => {
            const item = document.createElement('li');
            item.className = 'preset-dropdown-item';
            item.textContent = preset.name;
            item.dataset.file = preset.file;
            item.setAttribute('role', 'option');
            
            item.addEventListener('click', () => {
                this.selectPreset(preset.file, preset.name);
                this.closeDropdown();
            });
            
            this.dom.presetDropdownMenu.appendChild(item);
        });
        
        // Calculate widths after items are added to DOM
        this.calculatePresetWidths();
        
        // Setup toggle button click
        this.dom.presetDropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.dom.presetDropdown.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        // Close dropdown on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDropdown();
            }
        });
        
        // Load first preset by default
        if (this.availablePresets.length > 0) {
            this.selectPreset(this.availablePresets[0].file, this.availablePresets[0].name);
        }
    }
    
    calculatePresetWidths() {
        // Calculate width for each preset name
        this.availablePresets.forEach(preset => {
            const width = this.measureTextWidth(preset.name);
            this.presetWidths[preset.file] = width;
        });
        
        // Find max width
        this.maxPresetWidth = Math.max(...Object.values(this.presetWidths));
    }
    
    measureTextWidth(text) {
        // Create temporary element to measure text width
        const temp = document.createElement('button');
        temp.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: nowrap;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            font-size: 0.9rem;
            font-weight: 600;
            padding: 8px 20px;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            border: none;
        `;
        
        // Add text span
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        temp.appendChild(textSpan);
        
        // Add arrow (same size as real arrow)
        const arrow = document.createElement('span');
        arrow.style.cssText = `
            width: 12px;
            height: 8px;
            flex-shrink: 0;
        `;
        temp.appendChild(arrow);
        
        document.body.appendChild(temp);
        const width = temp.offsetWidth;
        document.body.removeChild(temp);
        return width;
    }
    
    toggleDropdown() {
        const isOpen = this.dom.presetDropdownToggle.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
    openDropdown() {
        this.dom.presetDropdownToggle.setAttribute('aria-expanded', 'true');
        this.dom.presetDropdownMenu.classList.add('active');
        
        // Animate width expansion to max width
        if (this.maxPresetWidth) {
            this.dom.presetDropdownToggle.style.width = `${this.maxPresetWidth}px`;
        }
    }
    
    closeDropdown() {
        this.dom.presetDropdownToggle.setAttribute('aria-expanded', 'false');
        this.dom.presetDropdownMenu.classList.remove('active');
        
        // Animate width back to current preset width
        if (this.currentPreset && this.presetWidths[this.currentPreset]) {
            this.dom.presetDropdownToggle.style.width = `${this.presetWidths[this.currentPreset]}px`;
        }
    }
    
    updateDropdownText(text) {
        if (this.dom.presetDropdownText) {
            this.dom.presetDropdownText.textContent = text;
        }
    }
    
    selectPreset(file, name) {
        // Update selected state in menu
        const items = this.dom.presetDropdownMenu.querySelectorAll('.preset-dropdown-item');
        items.forEach(item => {
            if (item.dataset.file === file) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // Update button text
        this.updateDropdownText(name);
        
        // Store current preset
        this.currentPreset = file;
        
        // Set button width to match current preset (when closed)
        if (this.presetWidths[file]) {
            const isOpen = this.dom.presetDropdownToggle.getAttribute('aria-expanded') === 'true';
            if (!isOpen) {
                this.dom.presetDropdownToggle.style.width = `${this.presetWidths[file]}px`;
            }
        }
        
        // Load preset
        this.loadPreset(file);
    }
    
    async loadPreset(filename) {
        try {
            console.log(`Loading preset: ${filename}`);
            
            // Fetch preset file from presets folder
            // Encode filename to handle special characters like quotes
            const encodedFilename = encodeURIComponent(filename);
            const response = await fetch(`presets/${encodedFilename}`);
            if (!response.ok) {
                throw new Error(`Failed to load preset: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Use the SVGExporter's importSettings method which handles both formats
            const normalizedData = await this.svgExporter.importSettings(
                new Blob([JSON.stringify(data)], { type: 'application/json' })
            );
            
            // Apply settings
            if (normalizedData.settings) {
                Object.entries(normalizedData.settings).forEach(([key, value]) => {
                    this.settingsModule.set(key, value);
                });
            }
            
            // Apply text blocks
            if (normalizedData.textBlocks) {
                this.textBlocks = normalizedData.textBlocks;
                // Ensure lockPosition is set for all blocks (default to true for backward compatibility)
                this.textBlocks.forEach(block => {
                    if (block.lockPosition === undefined) {
                        block.lockPosition = true;
                    }
                });
            }
            
            // Apply graphics blocks
            if (normalizedData.graphicsBlocks) {
                this.graphicsBlocks = normalizedData.graphicsBlocks;
                // Ensure lockPosition is set for all blocks (default to true for backward compatibility)
                this.graphicsBlocks.forEach(block => {
                    if (block.lockPosition === undefined) {
                        block.lockPosition = true;
                    }
                });
            }
            
            // Update all UI elements to reflect new settings
            this.syncUIWithSettings();
            
            // Store preset name for export
            this.currentPresetName = data.presetName || filename.replace('.json', '');
            
            // Update UI and grid
            this.updateGrid();
            this.updateElementsNavigator();
            
            console.log(`✅ Preset "${this.currentPresetName}" loaded successfully`);
        } catch (error) {
            console.error('Failed to load preset:', error);
            alert(`Failed to load preset: ${error.message}`);
        }
    }
    
    // Sync UI elements with current settings
    syncUIWithSettings() {
        const settings = this.settingsModule.getAll();
        
        // Update sliders via SliderController
        Object.keys(this.SLIDER_CONFIG).forEach(sliderId => {
            const config = this.SLIDER_CONFIG[sliderId];
            if (settings[config.setting] !== undefined) {
                this.sliderController.setValue(sliderId, settings[config.setting], false);
            }
        });
        
        // Update checkboxes
        if (this.dom.showSidePanels) this.dom.showSidePanels.checked = settings.showSidePanels !== false;
        if (this.dom.showColumns) this.dom.showColumns.checked = settings.showColumns !== false;
        if (this.dom.showRows) this.dom.showRows.checked = settings.showRows !== false;
        if (this.dom.showBaseline) this.dom.showBaseline.checked = settings.showBaseline !== false;
        if (this.dom.showObjects) this.dom.showObjects.checked = settings.showObjects !== false;
        if (this.dom.useXHeight) this.dom.useXHeight.checked = settings.useXHeight !== false;
        if (this.dom.useXHeight2) this.dom.useXHeight2.checked = settings.useXHeight2 || false;
        
        // Update link mode
        if (settings.linkMode === 'off') {
            if (this.dom.linkModeOff) this.dom.linkModeOff.checked = true;
        } else if (settings.linkMode === 'rows-height') {
            if (this.dom.linkModeRowsHeight) this.dom.linkModeRowsHeight.checked = true;
        } else if (settings.linkMode === 'module') {
            if (this.dom.linkModeModule) this.dom.linkModeModule.checked = true;
        }
        this.updateLinkedControlsVisual();
        
        // Update margins unit buttons
        if (settings.marginsUnit === 'mm') {
            if (this.dom.marginsUnitMm) this.dom.marginsUnitMm.classList.add('active');
            if (this.dom.marginsUnitMod) this.dom.marginsUnitMod.classList.remove('active');
        } else {
            if (this.dom.marginsUnitMod) this.dom.marginsUnitMod.classList.add('active');
            if (this.dom.marginsUnitMm) this.dom.marginsUnitMm.classList.remove('active');
        }
        
        // Update color
        if (settings.boxColor) {
            if (this.dom.colorPreview) this.dom.colorPreview.style.backgroundColor = settings.boxColor;
            if (this.dom.hexColorInput) this.dom.hexColorInput.value = settings.boxColor;
            this.updateHSBFromHex(settings.boxColor);
        }
        
        // Generate row presets
        this.generateRowPresets();
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
    
    // Initialize Size inputs (without sliders) with arrow key support
    // ПРИМЕЧАНИЕ: headlineSizeValue и textSizeValue теперь обрабатываются через SliderController,
    // поэтому их не нужно обрабатывать здесь отдельно
    initSizeInputsWithArrows() {
        // Эта функция оставлена для будущего использования, если появятся инпуты без слайдеров
        // Сейчас все инпуты размеров шрифта управляются через SliderController
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
        
        // Initialize font weight dropdowns in Text Styles panel
        const headlineStyleDropdown = document.getElementById('headlineStyleDropdown');
        const textStyleDropdown = document.getElementById('textStyleDropdown');
        
        if (headlineStyleDropdown) {
            headlineStyleDropdown.value = this.settings.headlineFontWeight.toString();
        }
        
        if (textStyleDropdown) {
            textStyleDropdown.value = this.settings.textFontWeight.toString();
        }
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
                    let newX = parseInt(this.dom.paragraphXInput.value);
                    
                    // Ограничиваем X в зависимости от alignment
                    const alignment = this.currentEditingBlock.alignment || 'left';
                    if (alignment === 'right') {
                        // For right-aligned: минимум = ceil(width), максимум = columnCount
                        const minX = Math.ceil(this.currentEditingBlock.width);
                        newX = Math.max(minX, Math.min(newX, this.settings.columnCount));
                    } else {
                        // For left-aligned: минимум = 1, максимум зависит от ширины
                        newX = Math.max(1, Math.min(newX, this.settings.columnCount));
                    }
                    
                    // Устанавливаем новое значение X
                    this.currentEditingBlock.x = newX;
                    
                    // Корректируем width если блок выходит за пределы
                    if (alignment === 'right') {
                        // For right-aligned: block grows left, so max width = x
                        if (this.currentEditingBlock.width > this.currentEditingBlock.x) {
                            this.currentEditingBlock.width = Math.max(0.25, this.currentEditingBlock.x);
                            this.dom.paragraphWidthInput.value = this.currentEditingBlock.width.toFixed(2);
                        }
                    } else {
                        // For left-aligned: block grows right
                        // x начинается с 1, поэтому последняя занятая колонка = x + width - 1
                        if (this.currentEditingBlock.x + this.currentEditingBlock.width - 1 > this.settings.columnCount) {
                            this.currentEditingBlock.width = Math.max(0.25, this.settings.columnCount - this.currentEditingBlock.x + 1);
                            this.dom.paragraphWidthInput.value = this.currentEditingBlock.width.toFixed(2);
                        }
                    }
                    
                    // Обновляем отображение X (на случай коррекции), округляем до целого
                    this.dom.paragraphXInput.value = Math.round(this.currentEditingBlock.x);
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
                    const newRow = parseInt(this.dom.paragraphRowInput.value) - 1;
                    
                    // Calculate max allowed row based on content height and text block height
                    const module = this.settings.gridModule;
                    const margins = this.settings.margins;
                    const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module);
                    const textBlockHeightInModules = this.getTextBlockHeightInModules(this.currentEditingBlock);
                    const maxY = maxYInBaseline - textBlockHeightInModules;
                    
                    // Calculate Y position from row (baselineOffset всегда сбрасывается в 0)
                    const rowHeight = this.settings.rowHeight;
                    const yPos = newRow * (rowHeight + 1);
                    
                    // Constrain Y
                    const constrainedY = Math.max(0, Math.min(yPos, maxY));
                    
                    // При изменении Row всегда ставим объект на первый baseline новой row
                    // Поэтому вычисляем только row из constrainedY, а baselineOffset = 0
                    const rowWithGutter = rowHeight + 1;
                    const finalRow = Math.floor(constrainedY / rowWithGutter);
                    
                    this.currentEditingBlock.row = Math.max(0, finalRow);
                    this.currentEditingBlock.baselineOffset = 0; // Всегда на первый baseline в row
                    this.dom.paragraphRowInput.value = this.currentEditingBlock.row + 1;
                    
                    // Update baseline input if needed
                    if (this.dom.paragraphBaselineInput) {
                        const globalBaseline = this.rowBaselineToY(this.currentEditingBlock.row, this.currentEditingBlock.baselineOffset);
                        this.dom.paragraphBaselineInput.value = globalBaseline + 1;
                    }
                    
                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphRowInput.addEventListener('keydown', (e) => {
                this.handleArrowKeysForInput(e, 'row', 'paragraphRowInput');
            });
        }
        
        // Обработчик для Column (всегда целое число)
        if (this.dom.paragraphXInput) {
            this.dom.paragraphXInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    const newX = parseFloat(this.dom.paragraphXInput.value);
                    // Column всегда целое число
                    this.currentEditingBlock.x = Math.max(1, Math.round(newX));
                    this.dom.paragraphXInput.value = this.currentEditingBlock.x;
                    this.updateGrid();
                }
            });
        }
        
        if (this.dom.paragraphBaselineInput) {
            this.dom.paragraphBaselineInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    const globalBaseline = parseInt(this.dom.paragraphBaselineInput.value) - 1;
                    const rowHeight = this.settings.rowHeight;
                    
                    // Calculate max allowed baseline based on content height and text block height
                    const module = this.settings.gridModule;
                    const margins = this.settings.margins;
                    const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module);
                    const textBlockHeightInModules = this.getTextBlockHeightInModules(this.currentEditingBlock);
                    const maxY = maxYInBaseline - textBlockHeightInModules;
                    
                    // Constrain baseline
                    const constrainedBaseline = Math.max(0, Math.min(globalBaseline, maxY));
                    
                    // Преобразуем глобальный номер baseline в row и baselineOffset
                    // Используем yToRowBaseline для правильного учета gutter между rows
                    const { row: newRow, baselineOffset: newBaselineOffset } = this.yToRowBaseline(constrainedBaseline);
                    
                    this.currentEditingBlock.row = Math.max(0, newRow);
                    this.currentEditingBlock.baselineOffset = newBaselineOffset;
                    
                    // Обновляем отображение (на случай коррекции)
                    const correctedGlobalBaseline = this.rowBaselineToY(this.currentEditingBlock.row, this.currentEditingBlock.baselineOffset);
                    this.dom.paragraphBaselineInput.value = correctedGlobalBaseline + 1;
                    this.dom.paragraphRowInput.value = this.currentEditingBlock.row + 1;
                    
                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphBaselineInput.addEventListener('keydown', (e) => {
                if (this.currentEditingBlock && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    const globalBaseline = parseInt(this.dom.paragraphBaselineInput.value) - 1;
                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                    const step = e.shiftKey ? 10 : 1;
                    let newGlobalBaseline = globalBaseline + delta * step;
                    
                    // Calculate max allowed baseline
                    const module = this.settings.gridModule;
                    const margins = this.settings.margins;
                    const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module);
                    const textBlockHeightInModules = this.getTextBlockHeightInModules(this.currentEditingBlock);
                    const maxY = maxYInBaseline - textBlockHeightInModules;
                    
                    newGlobalBaseline = Math.max(0, Math.min(newGlobalBaseline, maxY));
                    
                    // Используем yToRowBaseline для правильного учета gutter между rows
                    const { row: newRow, baselineOffset: newBaselineOffset } = this.yToRowBaseline(newGlobalBaseline);
                    this.currentEditingBlock.row = Math.max(0, newRow);
                    this.currentEditingBlock.baselineOffset = newBaselineOffset;
                    
                    // Обновляем отображение с правильным значением
                    const correctedGlobalBaseline = this.rowBaselineToY(this.currentEditingBlock.row, this.currentEditingBlock.baselineOffset);
                    this.dom.paragraphBaselineInput.value = correctedGlobalBaseline + 1;
                    this.dom.paragraphRowInput.value = this.currentEditingBlock.row + 1;
                    this.updateGrid();
                }
            });
        }
        
        if (this.dom.paragraphWidthInput) {
            this.dom.paragraphWidthInput.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    const newWidth = parseFloat(this.dom.paragraphWidthInput.value);
                    const alignment = this.currentEditingBlock.alignment || 'left';
                    
                    // Округляем до ближайшего кратного 0.25
                    const roundedWidth = Math.round(newWidth * 4) / 4;
                    
                    // Max width depends on alignment
                    let maxWidth;
                    if (alignment === 'right') {
                        // For right-aligned: max width = x (block grows left from column x)
                        maxWidth = this.currentEditingBlock.x;
                    } else {
                        // For left-aligned: max width = columns available to the right
                        maxWidth = this.settings.columnCount - this.currentEditingBlock.x + 1;
                    }
                    
                    this.currentEditingBlock.width = Math.max(0.25, Math.min(roundedWidth, maxWidth));
                    this.dom.paragraphWidthInput.value = this.currentEditingBlock.width.toFixed(2);
                    
                    this.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.dom.paragraphWidthInput.addEventListener('keydown', (e) => {
                this.handleArrowKeysForInput(e, 'width', 'paragraphWidthInput');
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
        
        // Обработчик для дропдауна стиля текста
        if (this.dom.paragraphStyleSelect) {
            this.dom.paragraphStyleSelect.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    this.currentEditingBlock.styleRef = this.dom.paragraphStyleSelect.value;
                    
                    // Показываем/скрываем секцию настроек Lunnen Display
                    const lunnenDisplayFeaturesSection = document.getElementById('lunnenDisplayFeaturesSection');
                    if (lunnenDisplayFeaturesSection) {
                        if (this.dom.paragraphStyleSelect.value === 'lunnenDisplay') {
                            lunnenDisplayFeaturesSection.style.display = 'block';
                        } else {
                            lunnenDisplayFeaturesSection.style.display = 'none';
                        }
                    }
                    
                    // Показываем/скрываем Alignment Mode (для Lunnen Display не показываем)
                    const alignmentModeSection = document.querySelector('#paragraphPanel .control-group:has([name="alignmentMode"])');
                    if (alignmentModeSection) {
                        if (this.dom.paragraphStyleSelect.value === 'lunnenDisplay') {
                            alignmentModeSection.style.display = 'none';
                        } else {
                            alignmentModeSection.style.display = 'block';
                        }
                    }
                    
                    this.updateElementsNavigator();
                    this.updateGrid();
                }
            });
        }
        
        // Обработчик для дропдауна выбора поверхности (текст)
        if (this.dom.paragraphSurfaceSelect) {
            this.dom.paragraphSurfaceSelect.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    this.currentEditingBlock.surface = this.dom.paragraphSurfaceSelect.value;
                    this.updateElementsNavigator();
                    this.updateGrid();
                }
            });
        }
        
        // Обработчик для кнопки Hide
        const paragraphHideBtn = document.getElementById('paragraphHideBtn');
        if (paragraphHideBtn) {
            paragraphHideBtn.addEventListener('click', () => {
                if (this.currentEditingBlock) {
                    this.toggleElementVisibility('text', this.currentEditingBlock.id);
                    // Update button icon based on visibility
                    const block = this.textBlocks.find(b => b.id === this.currentEditingBlock.id);
                    if (block) {
                        const svg = paragraphHideBtn.querySelector('svg');
                        if (svg) {
                            if (block.visible) {
                                // Show hide icon (eye with slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                            } else {
                                // Show visible icon (eye without slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                            }
                        }
                    }
                }
            });
        }
        
        // Обработчик для кнопки Delete
        const paragraphDeleteBtn = document.getElementById('paragraphDeleteBtn');
        if (paragraphDeleteBtn) {
            paragraphDeleteBtn.addEventListener('click', () => {
                if (this.currentEditingBlock) {
                    const blockId = this.currentEditingBlock.id;
                    const block = this.textBlocks.find(b => b.id === blockId);
                    if (block) {
                        const name = block.content.substring(0, 30) + (block.content.length > 30 ? '...' : '');
                        
                        // Close panel first
                        this.closeParagraphPanel();
                        
                        // Find the delete button in elements list and trigger delete
                        const elementButton = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                        if (elementButton) {
                            const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                            if (deleteBtn) {
                                this.startDeleteElement(deleteBtn, 'text', blockId, name);
                            }
                        }
                    }
                }
            });
        }
        
        // Обработчики для режима выравнивания (Alignment Mode)
        if (this.dom.alignmentModeBaseline) {
            this.dom.alignmentModeBaseline.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.alignmentModeBaseline.checked) {
                    this.currentEditingBlock.alignmentMode = 'baseline';
                    this.updateGrid();
                }
            });
        }
        
        if (this.dom.alignmentModeXHeight) {
            this.dom.alignmentModeXHeight.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.alignmentModeXHeight.checked) {
                    this.currentEditingBlock.alignmentMode = 'x-height';
                    this.updateGrid();
                }
            });
        }
        
        // Обработчик для Constrain to Grid toggle
        if (this.dom.paragraphLockPositionToggle) {
            this.dom.paragraphLockPositionToggle.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    this.currentEditingBlock.lockPosition = this.dom.paragraphLockPositionToggle.checked;
                    this.updateGrid();
                }
            });
        }
        
        // Обработчик для Align Right toggle
        if (this.dom.paragraphAlignRightToggle) {
            this.dom.paragraphAlignRightToggle.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    const wasRight = this.currentEditingBlock.alignment === 'right';
                    const nowRight = this.dom.paragraphAlignRightToggle.checked;
                    
                    // Adjust X position to keep block visually in the same place
                    if (nowRight && !wasRight) {
                        // Switching from left to right alignment
                        // X should move right by (width - 1) columns
                        // Example: X=7, width=3, left → X=9, width=3, right (occupies columns 7,8,9 in both cases)
                        const widthInColumns = Math.ceil(this.currentEditingBlock.width);
                        this.currentEditingBlock.x += (widthInColumns - 1);
                        
                        // Update input display
                        if (this.dom.paragraphXInput) {
                            this.dom.paragraphXInput.value = this.currentEditingBlock.x;
                        }
                    } else if (!nowRight && wasRight) {
                        // Switching from right to left alignment
                        // X should move left by (width - 1) columns
                        const widthInColumns = Math.ceil(this.currentEditingBlock.width);
                        this.currentEditingBlock.x -= (widthInColumns - 1);
                        
                        // Ensure X doesn't go below 1
                        this.currentEditingBlock.x = Math.max(1, this.currentEditingBlock.x);
                        
                        // Update input display
                        if (this.dom.paragraphXInput) {
                            this.dom.paragraphXInput.value = this.currentEditingBlock.x;
                        }
                    }
                    
                    this.currentEditingBlock.alignment = nowRight ? 'right' : 'left';
                    this.updateGrid();
                }
            });
        }
        
        // Обработчик для weight slider (Lunnen Display)
        const lunnenDisplayWeightSlider = document.getElementById('lunnenDisplayWeightSlider');
        const lunnenDisplayWeightValue = document.getElementById('lunnenDisplayWeightValue');
        if (lunnenDisplayWeightSlider && lunnenDisplayWeightValue) {
            // Обновление значения при изменении слайдера
            lunnenDisplayWeightSlider.addEventListener('input', () => {
                if (this.currentEditingBlock) {
                    const weight = parseInt(lunnenDisplayWeightSlider.value);
                    lunnenDisplayWeightValue.value = weight;
                    this.currentEditingBlock.fontWeight = weight;
                    this.updateGrid();
                }
            });
            
            // Обновление слайдера при изменении текстового поля
            lunnenDisplayWeightValue.addEventListener('change', () => {
                if (this.currentEditingBlock) {
                    let weight = parseInt(lunnenDisplayWeightValue.value);
                    weight = Math.max(100, Math.min(400, weight));
                    lunnenDisplayWeightValue.value = weight;
                    lunnenDisplayWeightSlider.value = weight;
                    this.currentEditingBlock.fontWeight = weight;
                    this.updateGrid();
                }
            });
        }
        
        // Обработчики для OpenType features checkboxes
        const featureCheckboxes = [
            { id: 'featureSalt', key: 'salt' },
            { id: 'featureAalt', key: 'aalt' },
            { id: 'featureSs01', key: 'ss01' },
            { id: 'featureSs02', key: 'ss02' },
            { id: 'featureTnum', key: 'tnum' },
            { id: 'featureDlig', key: 'dlig' }
        ];
        
        featureCheckboxes.forEach(({ id, key }) => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (this.currentEditingBlock) {
                        if (!this.currentEditingBlock.fontFeatures) {
                            this.currentEditingBlock.fontFeatures = {
                                salt: false,
                                aalt: false,
                                ss01: false,
                                ss02: false,
                                tnum: false,
                                dlig: false
                            };
                        }
                        this.currentEditingBlock.fontFeatures[key] = checkbox.checked;
                        this.updateGrid();
                    }
                });
            }
        });
        
        // Graphics Size Mode переключатели (Height/Width)
        if (this.dom.graphicsSizeUnitHeight) {
            this.dom.graphicsSizeUnitHeight.addEventListener('click', (e) => {
                e.preventDefault();
                const block = this.graphicsBlocks?.find(b => b.id === this.currentEditingGraphicsId);
                if (block && block.sizeMode !== 'height') {
                    this.switchGraphicsSizeMode(block, 'height');
                }
            });
        }
        if (this.dom.graphicsSizeUnitWidth) {
            this.dom.graphicsSizeUnitWidth.addEventListener('click', (e) => {
                e.preventDefault();
                const block = this.graphicsBlocks?.find(b => b.id === this.currentEditingGraphicsId);
                if (block && block.sizeMode !== 'width') {
                    this.switchGraphicsSizeMode(block, 'width');
                }
            });
        }
        
        // Graphics Align Right toggle
        if (this.dom.graphicsAlignRightToggle) {
            this.dom.graphicsAlignRightToggle.addEventListener('change', () => {
                const block = this.graphicsBlocks?.find(b => b.id === this.currentEditingGraphicsId);
                if (block) {
                    const wasRight = block.alignment === 'right';
                    const nowRight = this.dom.graphicsAlignRightToggle.checked;
                    
                    // Don't adjust X position - just change alignment mode
                    // The rendering code will handle positioning correctly based on alignment
                    block.alignment = nowRight ? 'right' : 'left';
                    this.updateGrid();
                }
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
    
    // Ограничить позиции элементов в пределах сетки
    constrainElementsToBounds() {
        const totalColumns = this.settings.columnCount;
        const totalRows = this.settings.rowCount;
        
        // Ограничиваем позиции текстовых блоков
        this.textBlocks.forEach(block => {
            if (block.lockPosition) {
                // Ограничиваем колонку в пределах сетки
                block.x = Math.max(1, Math.min(totalColumns, block.x));
                
                // Ограничиваем row в пределах сетки
                block.row = Math.max(0, Math.min(totalRows - 1, block.row));
                
                // Ограничиваем baselineOffset в пределах row
                const rowHeight = this.settings.rowHeight;
                block.baselineOffset = Math.max(0, Math.min(rowHeight, block.baselineOffset));
            }
        });
        
        // Ограничиваем позиции графических блоков
        this.graphicsBlocks.forEach(block => {
            if (block.lockPosition) {
                // Ограничиваем колонку в пределах сетки
                block.x = Math.max(1, Math.min(totalColumns, block.x));
                
                // Ограничиваем row в пределах сетки
                block.row = Math.max(0, Math.min(totalRows - 1, block.row));
                
                // Ограничиваем baselineOffset в пределах row
                const rowHeight = this.settings.rowHeight;
                block.baselineOffset = Math.max(0, Math.min(rowHeight, block.baselineOffset));
            }
        });
    }
    
    // Инициализация панели настроек иконок
    initIconsPanel() {
        // Обработчик для Column
        if (this.dom.iconsXInput) {
            this.dom.iconsXInput.addEventListener('change', () => {
                const newX = parseInt(this.dom.iconsXInput.value);
                const maxColumns = this.settings.columnCount;
                
                // Calculate icon width and check right boundary
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                const heightInMm = module * this.iconsBlock.heightInModules;
                const aspectRatio = this.iconsBlock.originalWidth / this.iconsBlock.originalHeight;
                const widthInMm = heightInMm * aspectRatio;
                
                // Calculate column width
                const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (maxColumns - 1)) / maxColumns;
                const gutter = module;
                
                // Calculate how many columns the icon takes
                const iconsWidthInColumns = Math.ceil(widthInMm / (columnWidth + gutter));
                const maxX = Math.max(1, maxColumns - iconsWidthInColumns + 1);
                
                this.iconsBlock.x = Math.max(1, Math.min(newX, maxX));
                this.dom.iconsXInput.value = this.iconsBlock.x;
                this.updateGrid();
            });
        }
        
        // Обработчик для Row
        if (this.dom.iconsRowInput) {
            this.dom.iconsRowInput.addEventListener('change', () => {
                const newRow = parseInt(this.dom.iconsRowInput.value) - 1;
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                
                // Calculate max Y position
                const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                const maxYInBaseline = Math.floor(contentHeightMm / module);
                const iconHeightModules = this.iconsBlock.heightInModules;
                const maxY = maxYInBaseline - iconHeightModules;
                
                // Convert row to Y position (baselineOffset сбрасывается в 0)
                const rowHeight = this.settings.rowHeight;
                const yPos = newRow * (rowHeight + 1);
                
                // Constrain Y
                const constrainedY = Math.max(0, Math.min(yPos, maxY));
                
                // При изменении Row всегда ставим объект на первый baseline новой row
                // Поэтому вычисляем только row из constrainedY, а baselineOffset = 0
                const rowWithGutter = rowHeight + 1;
                const finalRow = Math.floor(constrainedY / rowWithGutter);
                
                this.iconsBlock.row = Math.max(0, finalRow);
                this.iconsBlock.baselineOffset = 0; // Всегда на первый baseline в row
                this.dom.iconsRowInput.value = this.iconsBlock.row + 1;
                
                // Update baseline input
                if (this.dom.iconsBaselineInput) {
                    const globalBaseline = this.rowBaselineToY(this.iconsBlock.row, this.iconsBlock.baselineOffset);
                    this.dom.iconsBaselineInput.value = globalBaseline + 1;
                }
                
                this.updateGrid();
            });
        }
        
        // Обработчик для Baseline
        if (this.dom.iconsBaselineInput) {
            this.dom.iconsBaselineInput.addEventListener('change', () => {
                const globalBaseline = parseInt(this.dom.iconsBaselineInput.value) - 1;
                const rowHeight = this.settings.rowHeight;
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                
                // Calculate max Y position
                const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                const maxYInBaseline = Math.floor(contentHeightMm / module);
                const iconHeightModules = this.iconsBlock.heightInModules;
                const maxY = maxYInBaseline - iconHeightModules;
                
                // Constrain Y
                const constrainedY = Math.max(0, Math.min(globalBaseline, maxY));
                const { row, baselineOffset } = this.yToRowBaseline(constrainedY);
                
                this.iconsBlock.row = Math.max(0, row);
                this.iconsBlock.baselineOffset = baselineOffset;
                
                const correctedGlobalBaseline = this.rowBaselineToY(this.iconsBlock.row, this.iconsBlock.baselineOffset);
                this.dom.iconsBaselineInput.value = correctedGlobalBaseline + 1;
                this.dom.iconsRowInput.value = this.iconsBlock.row + 1;
                this.updateGrid();
            });
        }
        
        // Обработчик для Height
        if (this.dom.iconsHeightInput) {
            this.dom.iconsHeightInput.addEventListener('change', () => {
                const newHeight = parseFloat(this.dom.iconsHeightInput.value);
                const roundedHeight = Math.round(newHeight * 4) / 4;
                this.iconsBlock.heightInModules = Math.max(0.25, Math.min(roundedHeight, 20));
                this.dom.iconsHeightInput.value = this.iconsBlock.heightInModules.toFixed(2);
                
                // After changing height, recheck vertical position constraints
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                const maxYInBaseline = Math.floor(contentHeightMm / module);
                const maxY = maxYInBaseline - this.iconsBlock.heightInModules;
                
                // Get current Y position
                const currentY = this.getBlockY(this.iconsBlock);
                if (currentY > maxY) {
                    // Adjust position if icon is now too low
                    const constrainedY = Math.max(0, maxY);
                    const { row, baselineOffset } = this.yToRowBaseline(constrainedY);
                    this.iconsBlock.row = row;
                    this.iconsBlock.baselineOffset = baselineOffset;
                    
                    if (this.dom.iconsRowInput) this.dom.iconsRowInput.value = row + 1;
                    if (this.dom.iconsBaselineInput) {
                        const globalBaseline = row * this.settings.rowHeight + baselineOffset;
                        this.dom.iconsBaselineInput.value = globalBaseline + 1;
                    }
                }
                
                this.updateGrid();
            });
        }
        
        // Кнопка Apply
        if (this.dom.iconsApplyBtn) {
            this.dom.iconsApplyBtn.addEventListener('click', () => {
                const originalText = this.dom.iconsApplyBtn.textContent;
                this.dom.iconsApplyBtn.textContent = 'Applied!';
                setTimeout(() => {
                    this.dom.iconsApplyBtn.textContent = originalText;
                    this.closeIconsPanel();
                }, 500);
            });
        }
        
        // Кнопка Close
        if (this.dom.iconsCloseBtn) {
            this.dom.iconsCloseBtn.addEventListener('click', () => {
                this.closeIconsPanel();
            });
        }
    }
    
    // Инициализация управления стрелками клавиатуры для полей иконок
    initIconsInputsWithArrows() {
        const iconsInputs = [
            { 
                id: 'iconsXInput', 
                property: 'x',
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                applyConstraints: (value) => {
                    const maxColumns = this.settings.columnCount;
                    const module = this.settings.gridModule;
                    const margins = this.settings.margins;
                    const heightInMm = module * this.iconsBlock.heightInModules;
                    const aspectRatio = this.iconsBlock.originalWidth / this.iconsBlock.originalHeight;
                    const widthInMm = heightInMm * aspectRatio;
                    
                    const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (maxColumns - 1)) / maxColumns;
                    const gutter = module;
                    const iconsWidthInColumns = Math.ceil(widthInMm / (columnWidth + gutter));
                    const maxX = Math.max(1, maxColumns - iconsWidthInColumns + 1);
                    
                    return Math.max(1, Math.min(value, maxX));
                }
            },
            { 
                id: 'iconsRowInput', 
                property: 'row',
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                applyConstraints: (value) => {
                    // Convert from 1-based display value to 0-based internal value
                    const row0based = value - 1;
                    
                    const module = this.settings.gridModule;
                    const margins = this.settings.margins;
                    const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module);
                    const iconHeightModules = this.iconsBlock.heightInModules;
                    const maxY = maxYInBaseline - iconHeightModules;
                    
                    const rowHeight = this.settings.rowHeight;
                    const yPos = row0based * (rowHeight + 1) + this.iconsBlock.baselineOffset;
                    const constrainedY = Math.max(0, Math.min(yPos, maxY));
                    const { row, baselineOffset } = this.yToRowBaseline(constrainedY);
                    
                    // Update baselineOffset if needed
                    this.iconsBlock.baselineOffset = baselineOffset;
                    if (this.dom.iconsBaselineInput) {
                        const globalBaseline = this.rowBaselineToY(row, baselineOffset);
                        this.dom.iconsBaselineInput.value = globalBaseline + 1;
                    }
                    
                    // Return 1-based value for display
                    return Math.max(0, row) + 1;
                }
            },
            { 
                id: 'iconsBaselineInput', 
                property: 'baseline',
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                applyConstraints: (value) => {
                    // Convert from 1-based display value to 0-based internal value
                    const baseline0based = value - 1;
                    
                    const module = this.settings.gridModule;
                    const margins = this.settings.margins;
                    const rowHeight = this.settings.rowHeight;
                    const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module);
                    const iconHeightModules = this.iconsBlock.heightInModules;
                    const maxY = maxYInBaseline - iconHeightModules;
                    
                    // Constrain the value directly
                    const constrainedY = Math.max(0, Math.min(Math.round(baseline0based), maxY));
                    const { row, baselineOffset } = this.yToRowBaseline(constrainedY);
                    
                    // Update row and baselineOffset
                    this.iconsBlock.row = Math.max(0, row);
                    this.iconsBlock.baselineOffset = baselineOffset;
                    if (this.dom.iconsRowInput) {
                        this.dom.iconsRowInput.value = this.iconsBlock.row + 1;
                    }
                    
                    // Return the constrained baseline value (1-based for display)
                    return constrainedY + 1;
                }
            },
            { 
                id: 'iconsHeightInput', 
                property: 'heightInModules',
                baseStep: 0.25,
                shiftStep: 1,
                decimals: 2,
                applyConstraints: (value) => {
                    const constrainedValue = Math.max(0.25, Math.min(value, 20));
                    
                    // After changing height, recheck vertical position constraints
                    const module = this.settings.gridModule;
                    const margins = this.settings.margins;
                    const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module);
                    const maxY = maxYInBaseline - constrainedValue;
                    
                    const currentY = this.getBlockY(this.iconsBlock);
                    if (currentY > maxY) {
                        const adjustedY = Math.max(0, maxY);
                        const { row, baselineOffset } = this.yToRowBaseline(adjustedY);
                        this.iconsBlock.row = row;
                        this.iconsBlock.baselineOffset = baselineOffset;
                        
                        if (this.dom.iconsRowInput) this.dom.iconsRowInput.value = row + 1;
                        if (this.dom.iconsBaselineInput) {
                            const globalBaseline = row * this.settings.rowHeight + baselineOffset;
                            this.dom.iconsBaselineInput.value = globalBaseline + 1;
                        }
                    }
                    
                    return constrainedValue;
                }
            }
        ];
        
        iconsInputs.forEach(({ id, property, baseStep, shiftStep, decimals, applyConstraints }) => {
            const input = this.dom[id];
            if (!input) return;
            
            input.addEventListener('focus', () => {
                input.dataset.originalValue = input.value;
                input.select();
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    input.value = input.dataset.originalValue;
                    
                    // Restore original value
                    const originalValue = parseFloat(input.dataset.originalValue);
                    if (property === 'baseline') {
                        const rowHeight = this.settings.rowHeight;
                        const { row, baselineOffset } = this.yToRowBaseline(originalValue);
                        this.iconsBlock.row = row;
                        this.iconsBlock.baselineOffset = baselineOffset;
                    } else {
                        this.iconsBlock[property] = originalValue;
                    }
                    
                    input.blur();
                    this.updateGrid();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    
                    let currentValue = parseFloat(input.value);
                    if (isNaN(currentValue)) {
                        currentValue = property === 'baseline' 
                            ? this.rowBaselineToY(this.iconsBlock.row, this.iconsBlock.baselineOffset)
                            : this.iconsBlock[property];
                    }
                    
                    const step = e.shiftKey ? shiftStep : baseStep;
                    const stepDecimals = step > 0 ? this.getDecimalsFromStep(step) : (decimals || 0);
                    
                    // Округляем текущее значение до количества знаков шага перед изменением
                    const roundedCurrent = stepDecimals > 0 
                        ? parseFloat(currentValue.toFixed(stepDecimals))
                        : Math.round(currentValue);
                    
                    const direction = e.key === 'ArrowUp' ? 1 : -1;
                    let newValue = roundedCurrent + (step * direction);
                    
                    // Округляем результат по количеству знаков шага
                    if (step > 0 && stepDecimals > 0) {
                        newValue = parseFloat(newValue.toFixed(stepDecimals));
                    } else if (decimals > 0) {
                        newValue = parseFloat(newValue.toFixed(decimals));
                    }
                    
                    // Apply constraints
                    if (applyConstraints) {
                        newValue = applyConstraints(newValue);
                    }
                    
                    // Update the block property
                    if (property === 'baseline') {
                        // Already handled in applyConstraints
                    } else {
                        this.iconsBlock[property] = newValue;
                    }
                    
                    // Update input display
                    input.value = decimals > 0 ? newValue.toFixed(decimals) : Math.round(newValue);
                    
                    this.updateGrid();
                }
            });
        });
    }
    
    // Инициализация панели настроек claim
    initClaimPanel() {
        // Обработчик для Column
        if (this.dom.claimXInput) {
            this.dom.claimXInput.addEventListener('change', () => {
                const newX = parseInt(this.dom.claimXInput.value);
                const maxColumns = this.settings.columnCount;
                this.claimBlock.x = Math.max(1, Math.min(newX, maxColumns));
                this.dom.claimXInput.value = this.claimBlock.x;
                this.updateGrid();
            });
        }
        
        // Обработчик для Row
        if (this.dom.claimRowInput) {
            this.dom.claimRowInput.addEventListener('change', () => {
                const newRow = parseInt(this.dom.claimRowInput.value) - 1;
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                
                // Calculate max Y position
                const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                const maxYInBaseline = Math.floor(contentHeightMm / module);
                const claimHeightModules = this.claimBlock.heightInModules;
                const maxY = maxYInBaseline - claimHeightModules;
                
                // Convert row to Y position (baselineOffset сбрасывается в 0)
                const rowHeight = this.settings.rowHeight;
                const yPos = newRow * (rowHeight + 1);
                
                // Constrain Y
                const constrainedY = Math.max(0, Math.min(yPos, maxY));
                
                // При изменении Row всегда ставим объект на первый baseline новой row
                // Поэтому вычисляем только row из constrainedY, а baselineOffset = 0
                const rowWithGutter = rowHeight + 1;
                const finalRow = Math.floor(constrainedY / rowWithGutter);
                
                this.claimBlock.row = Math.max(0, finalRow);
                this.claimBlock.baselineOffset = 0; // Всегда на первый baseline в row
                this.dom.claimRowInput.value = this.claimBlock.row + 1;
                
                // Update baseline input
                if (this.dom.claimBaselineInput) {
                    const globalBaseline = this.rowBaselineToY(this.claimBlock.row, this.claimBlock.baselineOffset);
                    this.dom.claimBaselineInput.value = globalBaseline + 1;
                }
                
                this.updateGrid();
            });
        }
        
        // Обработчик для Baseline
        if (this.dom.claimBaselineInput) {
            this.dom.claimBaselineInput.addEventListener('change', () => {
                const globalBaseline = parseInt(this.dom.claimBaselineInput.value) - 1;
                const rowHeight = this.settings.rowHeight;
                
                // Convert global baseline to row and offset
                const { row, baselineOffset } = this.yToRowBaseline(globalBaseline);
                
                this.claimBlock.row = Math.max(0, row);
                this.claimBlock.baselineOffset = Math.max(0, baselineOffset);
                
                // Update Row input
                if (this.dom.claimRowInput) {
                    this.dom.claimRowInput.value = this.claimBlock.row + 1;
                }
                
                // Update Baseline input with actual value
                const actualBaseline = this.rowBaselineToY(this.claimBlock.row, this.claimBlock.baselineOffset);
                this.dom.claimBaselineInput.value = actualBaseline + 1;
                
                this.updateGrid();
            });
        }
        
        // Обработчик для Height
        if (this.dom.claimHeightInput) {
            this.dom.claimHeightInput.addEventListener('change', () => {
                const newHeight = parseFloat(this.dom.claimHeightInput.value);
                const constrainedHeight = Math.max(0.5, Math.min(newHeight, 20));
                this.claimBlock.heightInModules = constrainedHeight;
                this.dom.claimHeightInput.value = constrainedHeight.toFixed(2);
                
                // After changing height, recheck vertical position constraints
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                const maxYInBaseline = Math.floor(contentHeightMm / module);
                const maxY = maxYInBaseline - constrainedHeight;
                
                const currentY = this.getBlockY(this.claimBlock);
                if (currentY > maxY) {
                    const adjustedY = Math.max(0, maxY);
                    const { row, baselineOffset } = this.yToRowBaseline(adjustedY);
                    this.claimBlock.row = row;
                    this.claimBlock.baselineOffset = baselineOffset;
                    
                    if (this.dom.claimRowInput) this.dom.claimRowInput.value = row + 1;
                    if (this.dom.claimBaselineInput) {
                        const globalBaseline = row * this.settings.rowHeight + baselineOffset;
                        this.dom.claimBaselineInput.value = globalBaseline + 1;
                    }
                }
                
                this.updateGrid();
            });
        }
        
        // Кнопка Apply
        if (this.dom.claimApplyBtn) {
            this.dom.claimApplyBtn.addEventListener('click', () => {
                const originalText = this.dom.claimApplyBtn.textContent;
                this.dom.claimApplyBtn.textContent = 'Applied!';
                setTimeout(() => {
                    this.dom.claimApplyBtn.textContent = originalText;
                    this.closeClaimPanel();
                }, 500);
            });
        }
        
        // Кнопка Close
        if (this.dom.claimCloseBtn) {
            this.dom.claimCloseBtn.addEventListener('click', () => {
                this.closeClaimPanel();
            });
        }
    }
    
    // Инициализация управления стрелками клавиатуры для полей claim
    initClaimInputsWithArrows() {
        const claimInputs = [
            { 
                id: 'claimXInput', 
                property: 'x',
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                applyConstraints: (value) => {
                    const maxColumns = this.settings.columnCount;
                    return Math.max(1, Math.min(Math.round(value), maxColumns));
                }
            },
            { 
                id: 'claimRowInput', 
                property: 'row',
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                applyConstraints: (value) => {
                    return Math.max(0, Math.round(value));
                }
            },
            { 
                id: 'claimBaselineInput', 
                property: 'baseline',
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                applyConstraints: (value) => {
                    // Convert from 1-based display value to 0-based internal value
                    const baseline0based = value - 1;
                    
                    const module = this.settings.gridModule;
                    const margins = this.settings.margins;
                    const rowHeight = this.settings.rowHeight;
                    const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module);
                    const claimHeightModules = this.claimBlock.heightInModules;
                    const maxY = maxYInBaseline - claimHeightModules;
                    
                    const constrainedY = Math.max(0, Math.min(Math.round(baseline0based), maxY));
                    
                    // Convert to row and baseline offset
                    const { row, baselineOffset } = this.yToRowBaseline(constrainedY);
                    this.claimBlock.row = row;
                    this.claimBlock.baselineOffset = baselineOffset;
                    
                    // Update Row input
                    if (this.dom.claimRowInput) {
                        this.dom.claimRowInput.value = row + 1;
                    }
                    
                    // Return 1-based value for display
                    return constrainedY + 1;
                }
            },
            { 
                id: 'claimHeightInput', 
                property: 'heightInModules',
                baseStep: 0.25,
                shiftStep: 1,
                decimals: 2,
                applyConstraints: (value) => {
                    const constrainedValue = Math.max(0.5, Math.min(value, 20));
                    
                    // After changing height, recheck vertical position constraints
                    const module = this.settings.gridModule;
                    const margins = this.settings.margins;
                    const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module);
                    const maxY = maxYInBaseline - constrainedValue;
                    
                    const currentY = this.getBlockY(this.claimBlock);
                    if (currentY > maxY) {
                        const adjustedY = Math.max(0, maxY);
                        const { row, baselineOffset } = this.yToRowBaseline(adjustedY);
                        this.claimBlock.row = row;
                        this.claimBlock.baselineOffset = baselineOffset;
                        
                        if (this.dom.claimRowInput) this.dom.claimRowInput.value = row + 1;
                        if (this.dom.claimBaselineInput) {
                            const globalBaseline = row * this.settings.rowHeight + baselineOffset;
                            this.dom.claimBaselineInput.value = globalBaseline + 1;
                        }
                    }
                    
                    return constrainedValue;
                }
            }
        ];
        
        claimInputs.forEach(({ id, property, baseStep, shiftStep, decimals, applyConstraints }) => {
            const input = this.dom[id];
            if (!input) return;
            
            input.addEventListener('focus', () => {
                input.dataset.originalValue = input.value;
                input.select();
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    input.value = input.dataset.originalValue;
                    
                    // Restore original value
                    const originalValue = parseFloat(input.dataset.originalValue);
                    if (property === 'baseline') {
                        const rowHeight = this.settings.rowHeight;
                        const { row, baselineOffset } = this.yToRowBaseline(originalValue);
                        this.claimBlock.row = row;
                        this.claimBlock.baselineOffset = baselineOffset;
                    } else {
                        this.claimBlock[property] = originalValue;
                    }
                    
                    input.blur();
                    this.updateGrid();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    
                    let currentValue = parseFloat(input.value);
                    if (isNaN(currentValue)) {
                        currentValue = property === 'baseline' 
                            ? this.rowBaselineToY(this.claimBlock.row, this.claimBlock.baselineOffset)
                            : this.claimBlock[property];
                    }
                    
                    const step = e.shiftKey ? shiftStep : baseStep;
                    const stepDecimals = step > 0 ? this.getDecimalsFromStep(step) : (decimals || 0);
                    
                    // Округляем текущее значение до количества знаков шага перед изменением
                    const roundedCurrent = stepDecimals > 0 
                        ? parseFloat(currentValue.toFixed(stepDecimals))
                        : Math.round(currentValue);
                    
                    const direction = e.key === 'ArrowUp' ? 1 : -1;
                    let newValue = roundedCurrent + (step * direction);
                    
                    // Округляем результат по количеству знаков шага
                    if (step > 0 && stepDecimals > 0) {
                        newValue = parseFloat(newValue.toFixed(stepDecimals));
                    } else if (decimals > 0) {
                        newValue = parseFloat(newValue.toFixed(decimals));
                    }
                    
                    // Apply constraints
                    if (applyConstraints) {
                        newValue = applyConstraints(newValue);
                    }
                    
                    // Update the block property
                    if (property === 'baseline') {
                        // Already handled in applyConstraints
                    } else {
                        this.claimBlock[property] = newValue;
                    }
                    
                    // Update input display
                    input.value = decimals > 0 ? newValue.toFixed(decimals) : Math.round(newValue);
                    
                    this.updateGrid();
                }
            });
        });
    }
    
    // Инициализация управления стрелками клавиатуры для полей пользовательской графики
    initGraphicsInputsWithArrows() {
        // Эта функция будет вызываться при открытии панели редактирования графики
        // Она инициализирует обработчики для текущей редактируемой графики
        
        const setupGraphicsHandlers = () => {
            if (!this.currentEditingGraphicsId) return;
            
            const block = this.graphicsBlocks?.find(b => b.id === this.currentEditingGraphicsId);
            if (!block) return;
            
            const graphicsInputs = [
                { 
                    id: 'graphicsXInput', 
                    property: 'x',
                    baseStep: 1,
                    shiftStep: 5,
                    decimals: 0,
                    applyConstraints: (value) => {
                        const maxColumns = this.settings.columnCount;
                        const module = this.settings.gridModule;
                        const margins = this.settings.margins;
                        const heightInMm = module * block.heightInModules;
                        const aspectRatio = block.originalWidth / block.originalHeight;
                        const widthInMm = heightInMm * aspectRatio;
                        
                        const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (maxColumns - 1)) / maxColumns;
                        const gutter = module;
                        const graphicsWidthInColumns = Math.ceil(widthInMm / (columnWidth + gutter));
                        const maxX = Math.max(1, maxColumns - graphicsWidthInColumns + 1);
                        
                        return Math.max(1, Math.min(value, maxX));
                    }
                },
                { 
                    id: 'graphicsRowInput', 
                    property: 'row',
                    baseStep: 1,
                    shiftStep: 5,
                    decimals: 0,
                    applyConstraints: (value) => {
                        // Convert from 1-based display value to 0-based internal value
                        const row0based = value - 1;
                        
                        const module = this.settings.gridModule;
                        const margins = this.settings.margins;
                        const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                        const maxYInBaseline = Math.floor(contentHeightMm / module);
                        const graphicsHeightModules = block.heightInModules;
                        const maxY = maxYInBaseline - graphicsHeightModules;
                        
                        const rowHeight = this.settings.rowHeight;
                        const yPos = row0based * (rowHeight + 1); // baselineOffset сбрасывается в 0
                        const constrainedY = Math.max(0, Math.min(yPos, maxY));
                        
                        // При изменении Row всегда ставим объект на первый baseline новой row
                        // Поэтому вычисляем только row из constrainedY, а baselineOffset = 0
                        const rowWithGutter = rowHeight + 1;
                        const finalRow = Math.floor(constrainedY / rowWithGutter);
                        
                        // Сбрасываем baselineOffset в 0 при изменении row
                        block.baselineOffset = 0;
                        if (this.dom.graphicsBaselineInput) {
                            const globalBaseline = this.rowBaselineToY(finalRow, 0);
                            this.dom.graphicsBaselineInput.value = globalBaseline + 1;
                        }
                        
                        // Return 1-based value for display
                        return Math.max(0, finalRow) + 1;
                    }
                },
                { 
                    id: 'graphicsBaselineInput', 
                    property: 'baseline',
                    baseStep: 1,
                    shiftStep: 5,
                    decimals: 0,
                    applyConstraints: (value) => {
                        // Convert from 1-based display value to 0-based internal value
                        const baseline0based = value - 1;
                        
                        const module = this.settings.gridModule;
                        const margins = this.settings.margins;
                        const rowHeight = this.settings.rowHeight;
                        const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                        const maxYInBaseline = Math.floor(contentHeightMm / module);
                        const graphicsHeightModules = block.heightInModules;
                        const maxY = maxYInBaseline - graphicsHeightModules;
                        
                        // Constrain the value directly
                        const constrainedY = Math.max(0, Math.min(Math.round(baseline0based), maxY));
                        const { row, baselineOffset } = this.yToRowBaseline(constrainedY);
                        
                        // Update row and baselineOffset
                        block.row = Math.max(0, row);
                        block.baselineOffset = baselineOffset;
                        if (this.dom.graphicsRowInput) {
                            this.dom.graphicsRowInput.value = block.row + 1;
                        }
                        
                        // Return the constrained baseline value (1-based for display)
                        return constrainedY + 1;
                    }
                },
                { 
                    id: 'graphicsSizeInput', 
                    property: (block) => {
                        // Determine which property to update based on sizeMode
                        const sizeMode = block.sizeMode || 'height';
                        return sizeMode === 'height' ? 'heightInModules' : 'widthInModules';
                    },
                    baseStep: 0.25,
                    shiftStep: 1,
                    decimals: 2,
                    applyConstraints: (value) => {
                        const sizeMode = block.sizeMode || 'height';
                        const module = this.settings.gridModule;
                        const margins = this.settings.margins;
                        const aspectRatio = block.originalWidth / block.originalHeight;
                        
                        // Different max values for height and width modes
                        const maxValue = sizeMode === 'height' ? 20 : 100;
                        const constrainedValue = Math.max(0.25, Math.min(value, maxValue));
                        
                        if (sizeMode === 'height') {
                            // After changing height, recheck vertical position constraints
                            const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                            const maxYInBaseline = Math.floor(contentHeightMm / module);
                            const maxY = maxYInBaseline - constrainedValue;
                            
                            const currentY = this.getBlockY(block);
                            if (currentY > maxY) {
                                const adjustedY = Math.max(0, maxY);
                                const { row, baselineOffset } = this.yToRowBaseline(adjustedY);
                                block.row = row;
                                block.baselineOffset = baselineOffset;
                                
                                if (this.dom.graphicsRowInput) this.dom.graphicsRowInput.value = row + 1;
                                if (this.dom.graphicsBaselineInput) {
                                    const globalBaseline = this.rowBaselineToY(row, baselineOffset);
                                    this.dom.graphicsBaselineInput.value = globalBaseline + 1;
                                }
                            }
                        } else {
                            // sizeMode === 'width': check horizontal constraints
                            const widthInMm = constrainedValue * module;
                            const contentWidthMm = this.settings.frontWidth - 2 * margins * module;
                            
                            // Ensure graphics fits within content area
                            if (widthInMm > contentWidthMm) {
                                return Math.floor(contentWidthMm / module * 4) / 4; // Round down to 0.25
                            }
                        }
                        
                        return constrainedValue;
                    }
                }
            ];
            
            graphicsInputs.forEach(({ id, property, baseStep, shiftStep, decimals, applyConstraints }) => {
                const input = this.dom[id];
                if (!input) return;
                
                // Remove old event listeners by cloning the node
                const newInput = input.cloneNode(true);
                input.parentNode.replaceChild(newInput, input);
                this.dom[id] = newInput;
                
                newInput.addEventListener('focus', () => {
                    newInput.dataset.originalValue = newInput.value;
                    newInput.select();
                });
                
                newInput.addEventListener('change', () => {
                    // Resolve property name if it's a function
                    const propName = typeof property === 'function' ? property(block) : property;
                    
                    let value = parseFloat(newInput.value);
                    if (isNaN(value)) {
                        value = propName === 'baseline' 
                            ? (this.rowBaselineToY(block.row, block.baselineOffset) + 1)
                            : block[propName];
                    }
                    
                    // Apply constraints
                    if (applyConstraints) {
                        value = applyConstraints(value);
                    }
                    
                    // Update the block property
                    if (propName === 'baseline') {
                        // Already handled in applyConstraints
                    } else {
                        block[propName] = value;
                    }
                    
                    // Update input display
                    newInput.value = decimals > 0 ? value.toFixed(decimals) : Math.round(value);
                    
                    this.updateGrid();
                });
                
                newInput.addEventListener('keydown', (e) => {
                    // Resolve property name if it's a function
                    const propName = typeof property === 'function' ? property(block) : property;
                    
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        newInput.blur();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        newInput.value = newInput.dataset.originalValue;
                        
                        // Restore original value
                        const originalValue = parseFloat(newInput.dataset.originalValue);
                        if (propName === 'baseline') {
                            const rowHeight = this.settings.rowHeight;
                            const { row, baselineOffset } = this.yToRowBaseline(originalValue - 1);
                            block.row = row;
                            block.baselineOffset = baselineOffset;
                        } else {
                            block[propName] = originalValue;
                        }
                        
                        newInput.blur();
                        this.updateGrid();
                    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        
                        let currentValue = parseFloat(newInput.value);
                        if (isNaN(currentValue)) {
                            currentValue = propName === 'baseline' 
                                ? (this.rowBaselineToY(block.row, block.baselineOffset) + 1)
                                : block[propName];
                        }
                        
                        const step = e.shiftKey ? shiftStep : baseStep;
                        const stepDecimals = step > 0 ? this.getDecimalsFromStep(step) : (decimals || 0);
                        
                        // Округляем текущее значение до количества знаков шага перед изменением
                        const roundedCurrent = stepDecimals > 0 
                            ? parseFloat(currentValue.toFixed(stepDecimals))
                            : Math.round(currentValue);
                        
                        const direction = e.key === 'ArrowUp' ? 1 : -1;
                        let newValue = roundedCurrent + (step * direction);
                        
                        // Округляем результат по количеству знаков шага
                        if (step > 0 && stepDecimals > 0) {
                            newValue = parseFloat(newValue.toFixed(stepDecimals));
                        } else if (decimals > 0) {
                            newValue = parseFloat(newValue.toFixed(decimals));
                        }
                        
                        // Apply constraints
                        if (applyConstraints) {
                            newValue = applyConstraints(newValue);
                        }
                        
                        // Update the block property
                        if (propName === 'baseline') {
                            // Already handled in applyConstraints
                        } else {
                            block[propName] = newValue;
                        }
                        
                        // Update input display
                        newInput.value = decimals > 0 ? newValue.toFixed(decimals) : Math.round(newValue);
                        
                        this.updateGrid();
                    }
                });
            });
        };
        
        // Call setup when editing graphics
        setupGraphicsHandlers();
    }
    
    // Обработка стрелок клавиатуры для числовых полей
    handleArrowKeysForInput(e, property, inputId) {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        if (!this.currentEditingBlock) return;
        
        e.preventDefault();
        
        // Для width используем шаг 0.25
        const baseStep = property === 'width' ? 0.25 : 1;
        const step = e.shiftKey ? (property === 'width' ? 1 : 10) : baseStep;
        const stepDecimals = step > 0 ? this.getDecimalsFromStep(step) : 0;
        const direction = e.key === 'ArrowUp' ? 1 : -1;
        
        // Округляем текущее значение до количества знаков шага перед изменением
        let currentValue = this.currentEditingBlock[property];
        const roundedCurrent = stepDecimals > 0 
            ? parseFloat(currentValue.toFixed(stepDecimals))
            : Math.round(currentValue);
        
        const delta = step * direction;
        let newValue = roundedCurrent + delta;
        
        // Применяем ограничения в зависимости от поля
        if (property === 'x') {
            // Ограничиваем X: минимум 1, максимум columnCount
            newValue = Math.max(1, Math.min(newValue, this.settings.columnCount));
            
            // Устанавливаем новое значение X
            this.currentEditingBlock.x = newValue;
            this.dom[inputId].value = newValue;
            
            // Корректируем width если блок выходит за пределы
            // x начинается с 1, поэтому последняя занятая колонка = x + width - 1
            if (this.currentEditingBlock.x + this.currentEditingBlock.width - 1 > this.settings.columnCount) {
                this.currentEditingBlock.width = Math.max(0.25, this.settings.columnCount - this.currentEditingBlock.x + 1);
                this.dom.paragraphWidthInput.value = this.currentEditingBlock.width.toFixed(2);
            }
        } else if (property === 'row') {
            // Calculate max allowed row based on content height and text block height
            const module = this.settings.gridModule;
            const margins = this.settings.margins;
            const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
            const maxYInBaseline = Math.floor(contentHeightMm / module);
            const textBlockHeightInModules = this.getTextBlockHeightInModules(this.currentEditingBlock);
            const maxY = maxYInBaseline - textBlockHeightInModules;
            
            // Calculate Y position from row (baselineOffset всегда сбрасывается в 0)
            const rowHeight = this.settings.rowHeight;
            const yPos = newValue * (rowHeight + 1);
            
            // Constrain Y
            const constrainedY = Math.max(0, Math.min(yPos, maxY));
            
            // При изменении Row всегда ставим объект на первый baseline новой row
            // Поэтому вычисляем только row из constrainedY, а baselineOffset = 0
            const rowWithGutter = rowHeight + 1;
            const finalRow = Math.floor(constrainedY / rowWithGutter);
            
            this.currentEditingBlock.row = Math.max(0, finalRow);
            this.currentEditingBlock.baselineOffset = 0; // Всегда на первый baseline в row
            this.dom[inputId].value = this.currentEditingBlock.row + 1;
            
            // Update baseline input if needed
            if (this.dom.paragraphBaselineInput) {
                const globalBaseline = this.rowBaselineToY(this.currentEditingBlock.row, this.currentEditingBlock.baselineOffset);
                this.dom.paragraphBaselineInput.value = globalBaseline + 1;
            }
        } else if (property === 'width') {
            const maxWidth = this.settings.columnCount;
            // Округляем до ближайшего кратного 0.25
            newValue = Math.round(newValue * 4) / 4;
            newValue = Math.max(0.25, Math.min(newValue, maxWidth));
            this.currentEditingBlock.width = newValue;
            this.dom[inputId].value = newValue.toFixed(2);
            
            // Корректируем X если блок вышел за пределы
            const maxX = this.settings.columnCount - this.currentEditingBlock.width;
            if (this.currentEditingBlock.x > maxX) {
                this.currentEditingBlock.x = Math.max(1, Math.floor(maxX + 1));
            }
            // Округляем X до целого числа
            this.currentEditingBlock.x = Math.round(this.currentEditingBlock.x);
                this.dom.paragraphXInput.value = this.currentEditingBlock.x;
        }
        
        this.updateGrid();
    }
    
    // Показать панель настроек параграфа
    showParagraphPanel(blockId) {
        const block = this.getTextBlock(blockId);
        if (!block) return;
        
        this.currentEditingBlock = block;
        
        // Сохраняем начальное состояние блока для возможности отмены
        this.saveInitialBlockState(block);
        
        // Устанавливаем заголовок панели с названием из контента
        if (this.dom.paragraphPanelTitle) {
            let displayName = block.content.trim().substring(0, 24);
            if (block.content.trim().length > 24) {
                displayName = displayName + '...';
            }
            // Если текст пустой, используем стандартное имя
            if (!displayName) {
            const styleName = this.getStyleDisplayName(block.styleRef);
            const blockNumber = this.getBlockNumber(blockId);
            const formattedNumber = blockNumber.toString().padStart(2, '0');
                displayName = `${styleName} ${formattedNumber}`;
            }
            this.dom.paragraphPanelTitle.textContent = displayName;
        }
        
        // Заполняем поля панели
        if (this.dom.paragraphStyleSelect) {
            // Дропдаун управляет стилем текста (headline/text)
            this.dom.paragraphStyleSelect.value = block.styleRef || 'text';
        }
        if (this.dom.paragraphSurfaceSelect) {
            // Дропдаун управляет выбором поверхности
            this.dom.paragraphSurfaceSelect.value = block.surface || 'front';
        }
        if (this.dom.paragraphXInput) {
            // Column всегда целое число - текст привязывается к левому краю колонки
            this.dom.paragraphXInput.value = Math.round(block.x);
        }
        if (this.dom.paragraphRowInput) {
            this.dom.paragraphRowInput.value = block.row + 1;
        }
        if (this.dom.paragraphBaselineInput) {
            // Показываем глобальный номер baseline на всей сетке (с учетом гутеров между rows)
            const globalBaseline = this.rowBaselineToY(block.row, block.baselineOffset);
            this.dom.paragraphBaselineInput.value = globalBaseline + 1;
        }
        if (this.dom.paragraphWidthInput) {
            this.dom.paragraphWidthInput.value = typeof block.width === 'number' ? block.width.toFixed(2) : block.width;
        }
        if (this.dom.paragraphTextArea) {
            this.dom.paragraphTextArea.value = block.content;
        }
        
        // Показываем/скрываем Alignment Mode в зависимости от стиля
        // Для Lunnen Display не показываем (нет строчных букв)
        const alignmentModeSection = document.querySelector('#paragraphPanel .control-group:has([name="alignmentMode"])');
        if (alignmentModeSection) {
            if (block.styleRef === 'lunnenDisplay') {
                alignmentModeSection.style.display = 'none';
            } else {
                alignmentModeSection.style.display = 'block';
                
                // Устанавливаем режим выравнивания (по умолчанию baseline)
                const alignmentMode = block.alignmentMode || 'baseline';
                if (this.dom.alignmentModeBaseline && this.dom.alignmentModeXHeight) {
                    if (alignmentMode === 'x-height') {
                        this.dom.alignmentModeXHeight.checked = true;
                        this.dom.alignmentModeBaseline.checked = false;
                    } else {
                        this.dom.alignmentModeBaseline.checked = true;
                        this.dom.alignmentModeXHeight.checked = false;
                    }
                }
            }
        }
        
        // Устанавливаем состояние Lock Position toggle
        if (this.dom.paragraphLockPositionToggle) {
            this.dom.paragraphLockPositionToggle.checked = block.lockPosition || false;
        }
        
        // Устанавливаем состояние Align Right toggle
        if (this.dom.paragraphAlignRightToggle) {
            this.dom.paragraphAlignRightToggle.checked = block.alignment === 'right';
        }
        
        // Обновляем счетчик символов
        this.updateCharCounter();
        
        // Показываем/скрываем секцию настроек Lunnen Display в зависимости от выбранного стиля
        const lunnenDisplayFeaturesSection = document.getElementById('lunnenDisplayFeaturesSection');
        if (lunnenDisplayFeaturesSection) {
            if (block.styleRef === 'lunnenDisplay') {
                lunnenDisplayFeaturesSection.style.display = 'block';
                
                // Устанавливаем значения для weight slider
                const weightSlider = document.getElementById('lunnenDisplayWeightSlider');
                const weightValue = document.getElementById('lunnenDisplayWeightValue');
                if (weightSlider && weightValue) {
                    const weight = block.fontWeight || 400;
                    weightSlider.value = weight;
                    weightValue.value = weight;
                }
                
                // Устанавливаем значения для OpenType features checkboxes
                const features = block.fontFeatures || {
                    salt: false,
                    aalt: false,
                    ss01: false,
                    ss02: false,
                    tnum: false,
                    dlig: false
                };
                
                document.getElementById('featureSalt').checked = features.salt || false;
                document.getElementById('featureAalt').checked = features.aalt || false;
                document.getElementById('featureSs01').checked = features.ss01 || false;
                document.getElementById('featureSs02').checked = features.ss02 || false;
                document.getElementById('featureTnum').checked = features.tnum || false;
                document.getElementById('featureDlig').checked = features.dlig || false;
            } else {
                lunnenDisplayFeaturesSection.style.display = 'none';
            }
        }
        
        // Устанавливаем правильную иконку для кнопки Hide/Show
        const paragraphHideBtn = document.getElementById('paragraphHideBtn');
        if (paragraphHideBtn) {
            const svg = paragraphHideBtn.querySelector('svg');
            if (svg) {
                if (block.visible) {
                    // Show hide icon (eye with slash)
                    svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                } else {
                    // Show visible icon (eye without slash)
                    svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                }
            }
        }
        
        // Показываем панель и позиционируем рядом с элементом
        if (this.dom.paragraphPanel) {
            this.dom.paragraphPanel.style.display = 'flex';
            this.dom.paragraphPanel.classList.add('active');
            this.positionPanelNextToBlock(this.dom.paragraphPanel, blockId, 'text');
        }
    }
    
    // Сохранить начальное состояние блока
    saveInitialBlockState(block) {
        this.initialBlockState = {
            x: block.x,
            row: block.row,
            baselineOffset: block.baselineOffset,
            width: block.width,
            content: block.content,
            alignmentMode: block.alignmentMode || 'baseline'
        };
    }
    
    // Отменить изменения и закрыть панель
    cancelParagraphChanges() {
        if (this.currentEditingBlock && this.initialBlockState) {
            // Восстанавливаем начальные значения
            this.currentEditingBlock.x = this.initialBlockState.x;
            this.currentEditingBlock.row = this.initialBlockState.row;
            this.currentEditingBlock.baselineOffset = this.initialBlockState.baselineOffset;
            this.currentEditingBlock.width = this.initialBlockState.width;
            this.currentEditingBlock.content = this.initialBlockState.content;
            this.currentEditingBlock.alignmentMode = this.initialBlockState.alignmentMode;
            
            // Обновляем сетку с восстановленными значениями
            this.updateGrid();
        }
        
        // Закрываем панель
        this.closeParagraphPanel();
    }
    
    // Закрыть панель настроек параграфа
    closeParagraphPanel() {
        this.currentEditingBlock = null;
        this.initialBlockState = null;
        if (this.dom.paragraphPanel) {
            this.dom.paragraphPanel.classList.remove('active');
            this.dom.paragraphPanel.style.display = 'none';
        }
    }
    
    // Show Graphics Upload Panel
    showGraphicsPanel() {
        // Reset panel fields
        if (this.dom.graphicsXInput) {
            this.dom.graphicsXInput.value = 1;
        }
        if (this.dom.graphicsRowInput) {
            this.dom.graphicsRowInput.value = 1;
        }
        if (this.dom.graphicsBaselineInput) {
            this.dom.graphicsBaselineInput.value = 1;
        }
        if (this.dom.graphicsHeightInput) {
            this.dom.graphicsHeightInput.value = '3.00';
        }
        if (this.dom.graphicsLockPositionToggle) {
            this.dom.graphicsLockPositionToggle.checked = false;
        }
        
        // Hide action buttons for new graphics (nothing to hide/delete yet)
        const graphicsHideBtn = document.getElementById('graphicsHideBtn');
        const graphicsDeleteBtn = document.getElementById('graphicsDeleteBtn');
        if (graphicsHideBtn) {
            graphicsHideBtn.style.display = 'none';
        }
        if (graphicsDeleteBtn) {
            graphicsDeleteBtn.style.display = 'none';
        }
        
        // Center panel
        if (this.dom.graphicsPanel) {
            this.dom.graphicsPanel.style.display = 'flex';
            this.dom.graphicsPanel.classList.add('active');
            this.centerPanel(this.dom.graphicsPanel);
        }
    }
    
    // Close Graphics Upload Panel
    closeGraphicsPanel() {
        if (this.dom.graphicsPanel) {
            this.dom.graphicsPanel.classList.remove('active');
            this.dom.graphicsPanel.style.display = 'none';
        }
        
        // Reset file input
        if (this.dom.svgFileInput) {
            this.dom.svgFileInput.value = '';
        }
        
        // Clear any uploaded SVG data
        this.uploadedSvgData = null;
        
        // Reset editing state
        this.currentEditingGraphicsId = null;
        
        // Reset file upload area
        if (this.dom.fileUploadArea) {
            this.dom.fileUploadArea.style.display = 'block';
            const placeholder = this.dom.fileUploadArea.querySelector('.upload-placeholder p');
            if (placeholder) {
                placeholder.textContent = 'Click or drag & drop SVG file here';
            }
        }
        
        // Reset panel title
        if (this.dom.graphicsPanelTitle) {
            this.dom.graphicsPanelTitle.textContent = 'Add Graphics';
        }
    }
    
    // Initialize Graphics Panel
    initGraphicsPanel() {
        // File upload area click handler
        if (this.dom.fileUploadArea) {
            this.dom.fileUploadArea.addEventListener('click', () => {
                if (this.dom.svgFileInput) {
                    this.dom.svgFileInput.click();
                }
            });
            
            // Drag and drop handlers
            this.dom.fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dom.fileUploadArea.classList.add('dragover');
            });
            
            this.dom.fileUploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dom.fileUploadArea.classList.remove('dragover');
            });
            
            this.dom.fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dom.fileUploadArea.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type === 'image/svg+xml') {
                    this.handleSvgFile(files[0]);
                }
            });
        }
        
        // File input change handler
        if (this.dom.svgFileInput) {
            this.dom.svgFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleSvgFile(e.target.files[0]);
                }
            });
        }
        
        // Hide button handler
        const graphicsHideBtn = document.getElementById('graphicsHideBtn');
        if (graphicsHideBtn) {
            graphicsHideBtn.addEventListener('click', () => {
                if (this.currentEditingGraphicsId) {
                    this.toggleElementVisibility('graphics', this.currentEditingGraphicsId);
                    // Update button icon based on visibility
                    const block = this.graphicsBlocks?.find(b => b.id === this.currentEditingGraphicsId);
                    if (block) {
                        const svg = graphicsHideBtn.querySelector('svg');
                        if (svg) {
                            if (block.visible) {
                                // Show hide icon (eye with slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                            } else {
                                // Show visible icon (eye without slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                            }
                        }
                    }
                }
            });
        }
        
        // Delete button handler
        const graphicsDeleteBtn = document.getElementById('graphicsDeleteBtn');
        if (graphicsDeleteBtn) {
            graphicsDeleteBtn.addEventListener('click', () => {
                if (this.currentEditingGraphicsId) {
                    const blockId = this.currentEditingGraphicsId;
                    const block = this.getGraphicsBlock(blockId);
                    if (block) {
                        const name = block.name || 'Graphic';
                        
                        // Close panel first
                        this.closeGraphicsPanel();
                        
                        // Find the delete button in elements list and trigger delete
                        const elementButton = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                        if (elementButton) {
                            const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                            if (deleteBtn) {
                                this.startDeleteElement(deleteBtn, 'graphics', blockId, name);
                            }
                        }
                    }
                }
            });
        }
    }
    
    // Initialize click outside handler for closing panels
    initPanelClickOutsideHandler() {
        document.addEventListener('click', (e) => {
            // Check if paragraph panel is open
            if (this.dom.paragraphPanel && 
                this.dom.paragraphPanel.classList.contains('active')) {
                
                // Check if click was outside the panel
                if (!this.dom.paragraphPanel.contains(e.target)) {
                    // Check if click was not on a text block (which opens the panel) or in elements navigator
                    const isTextBlockClick = e.target.closest('[data-block-id], [data-element-type="text"], .element-button');
                    
                    if (!isTextBlockClick) {
                        this.closeParagraphPanel();
                    }
                }
            }
            
            // Check if graphics panel is open
            if (this.dom.graphicsPanel && 
                this.dom.graphicsPanel.classList.contains('active')) {
                
                // Check if click was outside the panel
                if (!this.dom.graphicsPanel.contains(e.target)) {
                    // Check if click was not on a graphics block, add button, or in elements navigator
                    const isGraphicsBlockClick = e.target.closest('[data-block-id], [data-element-type="graphics"], #addGraphicsBtn, .element-button');
                    
                    if (!isGraphicsBlockClick) {
                        this.closeGraphicsPanel();
                    }
                }
            }
        });
    }
    
    // Load and process SVG file (same as handleSvgFile but for file paths)
    // Works over HTTP and tries XMLHttpRequest as fallback for file:// protocol
    async loadAndProcessSvg(filePath) {
        try {
            let svgContent = null;
            
            // Try fetch first (works over HTTP)
        try {
            const response = await fetch(filePath);
                if (response.ok) {
                    svgContent = await response.text();
                }
            } catch (fetchError) {
                // If fetch fails (e.g., file:// protocol), try XMLHttpRequest
                // Note: XMLHttpRequest also doesn't work with file:// in most browsers
                console.log(`Fetch failed for ${filePath}, trying XMLHttpRequest...`);
                try {
                    svgContent = await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', filePath, true);
                        xhr.onload = () => {
                            if (xhr.status === 0 || xhr.status === 200) {
                                resolve(xhr.responseText);
                            } else {
                                reject(new Error(`XMLHttpRequest failed with status ${xhr.status}`));
                            }
                        };
                        xhr.onerror = () => reject(new Error('XMLHttpRequest failed'));
                        xhr.send();
                    });
                } catch (xhrError) {
                    // Both fetch and XMLHttpRequest failed - likely file:// protocol
                    const isFileProtocol = window.location.protocol === 'file:';
                    if (isFileProtocol) {
                        console.warn(`Cannot load ${filePath} via file:// protocol. Please use a local HTTP server or open via http://localhost`);
                    }
                    throw fetchError; // Re-throw original error
                }
            }
            
            if (!svgContent) {
                console.warn(`Could not load ${filePath} - file may not exist or protocol not supported`);
                return null;
            }
            
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');
            
            if (svgElement) {
                // Extract viewBox or width/height
                const viewBox = svgElement.getAttribute('viewBox');
                let width, height;
                
                if (viewBox) {
                    const [, , w, h] = viewBox.split(' ').map(parseFloat);
                    width = w;
                    height = h;
                } else {
                    width = parseFloat(svgElement.getAttribute('width')) || 100;
                    height = parseFloat(svgElement.getAttribute('height')) || 100;
                }
                
                // Extract inner content FIRST (before processing colors)
                let innerContent = svgElement.innerHTML;
                
                // Process inner content to replace fill colors with currentColor (same as handleSvgFile)
                // Replace all fill attributes with currentColor (except 'none')
                innerContent = innerContent.replace(/fill="(?!none)[^"]*"/gi, 'fill="currentColor"');
                innerContent = innerContent.replace(/fill='(?!none)[^']*'/gi, "fill='currentColor'");
                
                // Replace stroke colors with currentColor (except 'none')
                innerContent = innerContent.replace(/stroke="(?!none)[^"]*"/gi, 'stroke="currentColor"');
                innerContent = innerContent.replace(/stroke='(?!none)[^']*'/gi, "stroke='currentColor'");
                
                // Replace fill in style attributes (be careful not to match path d attributes)
                // Only match fill: in style attributes, not in path data
                innerContent = innerContent.replace(/style="([^"]*)"/gi, (match, styleContent) => {
                    const processed = styleContent
                        .replace(/fill:\s*(?!none)[^;"}]+/gi, 'fill: currentColor')
                        .replace(/stroke:\s*(?!none)[^;"}]+/gi, 'stroke: currentColor');
                    return `style="${processed}"`;
                });
                
                // Process style elements separately
                innerContent = innerContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, styleText) => {
                    const processed = styleText
                        .replace(/fill:\s*(?!none)[^;"}]+/gi, 'fill: currentColor')
                        .replace(/stroke:\s*(?!none)[^;"}]+/gi, 'stroke: currentColor');
                    return match.replace(styleText, processed);
                });
                
                // Replace class names in paths to use currentColor (for claim and icons)
                // Determine which class to use based on file path
                const isIcons = filePath.includes('icons.svg');
                const className = isIcons ? 'icon-fill' : 'claim-fill';
                
                // Replace .st0, .st1, etc. with appropriate class
                innerContent = innerContent.replace(/class="st\d+"/gi, `class="${className}"`);
                innerContent = innerContent.replace(/class='st\d+'/gi, `class='${className}'`);
                
                // Ensure appropriate style is present in defs
                if (innerContent.includes(className) && !innerContent.includes(`.${className}`)) {
                    // Add style if not present
                    const fillStyle = `<defs>
    <style>
      .${className} {
        fill: currentColor;
      }
    </style>
  </defs>`;
                    // Check if defs already exists
                    if (innerContent.includes('<defs>')) {
                        // Add style to existing defs
                        innerContent = innerContent.replace(/<defs>([\s\S]*?)<\/defs>/gi, (match, defsContent) => {
                            if (!defsContent.includes(`.${className}`)) {
                                return `<defs>${defsContent}
    <style>
      .${className} {
        fill: currentColor;
      }
    </style>
  </defs>`;
                            }
                            return match;
                        });
                    } else {
                        // Add defs with style at the beginning
                        innerContent = fillStyle + innerContent;
                    }
                }
                
                return { 
                    width, 
                    height, 
                    content: innerContent
                };
            }
        } catch (error) {
            console.error(`Error loading SVG from ${filePath}:`, error);
        }
        return null;
    }
    
    // Handle SVG file upload
    handleSvgFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const svgContent = e.target.result;
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');
            
            if (svgElement) {
                // Extract viewBox or width/height
                const viewBox = svgElement.getAttribute('viewBox');
                let width, height;
                
                if (viewBox) {
                    const [, , w, h] = viewBox.split(' ').map(parseFloat);
                    width = w;
                    height = h;
                } else {
                    width = parseFloat(svgElement.getAttribute('width')) || 100;
                    height = parseFloat(svgElement.getAttribute('height')) || 100;
                }
                
                // Process SVG content to replace fill colors with currentColor
                let processedContent = svgContent;
                
                // Replace all fill attributes with currentColor (except 'none')
                // This regex matches fill="..." but not fill="none"
                processedContent = processedContent.replace(/fill="(?!none)[^"]*"/gi, 'fill="currentColor"');
                processedContent = processedContent.replace(/fill='(?!none)[^']*'/gi, "fill='currentColor'");
                
                // Replace stroke colors with currentColor (except 'none')
                processedContent = processedContent.replace(/stroke="(?!none)[^"]*"/gi, 'stroke="currentColor"');
                processedContent = processedContent.replace(/stroke='(?!none)[^']*'/gi, "stroke='currentColor'");
                
                // Replace fill in style attributes
                processedContent = processedContent.replace(/fill:\s*(?!none)[^;"}]+/gi, 'fill: currentColor');
                processedContent = processedContent.replace(/stroke:\s*(?!none)[^;"}]+/gi, 'stroke: currentColor');
                
                // Replace class names in paths to use currentColor (for claim and icons)
                // Replace .st0, .st1, etc. with claim-fill or icon-fill classes
                processedContent = processedContent.replace(/class="st\d+"/gi, 'class="claim-fill"');
                processedContent = processedContent.replace(/class='st\d+'/gi, "class='claim-fill'");
                
                // Extract inner content for processing (remove outer SVG tags)
                const parser2 = new DOMParser();
                const svgDoc2 = parser2.parseFromString(processedContent, 'image/svg+xml');
                const svgElement2 = svgDoc2.querySelector('svg');
                let innerContent = svgElement2 ? svgElement2.innerHTML : processedContent;
                
                // Ensure claim-fill style is present in defs
                if (innerContent.includes('claim-fill') && !innerContent.includes('.claim-fill')) {
                    // Add claim-fill style if not present
                    const claimFillStyle = `<defs>
    <style>
      .claim-fill {
        fill: currentColor;
      }
    </style>
  </defs>`;
                    // Check if defs already exists
                    if (innerContent.includes('<defs>')) {
                        // Add style to existing defs
                        innerContent = innerContent.replace(/<defs>([\s\S]*?)<\/defs>/gi, (match, defsContent) => {
                            if (!defsContent.includes('.claim-fill')) {
                                return `<defs>${defsContent}
    <style>
      .claim-fill {
        fill: currentColor;
      }
    </style>
  </defs>`;
                            }
                            return match;
                        });
                    } else {
                        // Add defs with style at the beginning
                        innerContent = claimFillStyle + innerContent;
                    }
                    processedContent = innerContent;
                }
                
                // Store uploaded SVG data
                this.uploadedSvgData = {
                    content: processedContent,
                    name: file.name.replace('.svg', ''),
                    width: width,
                    height: height
                };
                
                // Update UI to show file is loaded
                const placeholder = this.dom.fileUploadArea.querySelector('.upload-placeholder p');
                if (placeholder) {
                    placeholder.textContent = `✓ ${file.name}`;
                }
                
                // If editing existing graphics block, update it immediately
                if (this.currentEditingGraphicsId) {
                    const block = this.getGraphicsBlock(this.currentEditingGraphicsId);
                    if (block) {
                        // Update the block with new SVG data (works for all graphics including built-in)
                        block.svgContent = processedContent;
                        block.name = this.uploadedSvgData.name;
                        block.originalWidth = width;
                        block.originalHeight = height;
                        
                        // Update panel title
                        if (this.dom.graphicsPanelTitle) {
                            let displayName = block.name || 'Graphic';
                            if (displayName.length > 24) {
                                displayName = displayName.substring(0, 24) + '...';
                            }
                            this.dom.graphicsPanelTitle.textContent = displayName;
                        }
                        
                        // Update placeholder text
                        if (placeholder) {
                            placeholder.textContent = `Current: ${block.name || 'Graphic'} — Upload new SVG to replace`;
                        }
                        
                        // Update elements list
                        this.updateElementsNavigator();
                        
                        // Render updated graphics
                        this.updateGrid();
                        
                        console.log('Graphics block updated with new SVG');
                    }
                } else {
                    // Creating NEW graphics block - automatically create it
                    console.log('Creating new graphics block from uploaded SVG');
                    this.addGraphicsBlock(
                        processedContent,
                        this.uploadedSvgData.name,
                        width,
                        height
                    );
                    
                    // Close the panel after creating
                    this.closeGraphicsPanel();
                }
            }
        };
        
        reader.readAsText(file);
    }
    
    // ============================================
    // Color methods (Итерация 8: обертки удалены, используем ColorUtils напрямую)
    // ============================================
    
    updateHSBFromHex(hex) {
        const rgb = ColorUtils.hexToRgb(hex);
        if (rgb) {
            const hsb = ColorUtils.rgbToHsb(rgb.r, rgb.g, rgb.b);
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
        
        const rgb = ColorUtils.hsbToRgb(h, s, b);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Обновляем через оба способа для совместимости
        this.settings.boxColor = hex;
        this.settingsModule.set('boxColor', hex);
        this.dom.hexColorInput.value = hex;
        this.dom.colorPreview.style.backgroundColor = hex;
        this.updateGrid();
    }
    
    updateSaturationGradient() {
        const h = parseInt(this.dom.hueSlider.value);
        const b = parseInt(this.dom.brightnessSlider.value);
        
        const leftColor = ColorUtils.hsbToRgb(h, 0, b);
        const rightColor = ColorUtils.hsbToRgb(h, 100, b);
        
        const leftHex = ColorUtils.rgbToHex(leftColor.r, leftColor.g, leftColor.b);
        const rightHex = ColorUtils.rgbToHex(rightColor.r, rightColor.g, rightColor.b);
        
        const gradient = `linear-gradient(to right, ${leftHex}, ${rightHex})`;
        this.dom.saturationSlider.style.background = gradient;
        
        // Update custom CSS for the slider track
        this.updateSliderTrackGradient('saturationSlider', gradient);
    }
    
    updateBrightnessGradient() {
        const h = parseInt(this.dom.hueSlider.value);
        const s = parseInt(this.dom.saturationSlider.value);
        
        const leftColor = ColorUtils.hsbToRgb(h, s, 0);
        const rightColor = ColorUtils.hsbToRgb(h, s, 100);
        
        const leftHex = ColorUtils.rgbToHex(leftColor.r, leftColor.g, leftColor.b);
        const rightHex = ColorUtils.rgbToHex(rightColor.r, rightColor.g, rightColor.b);
        
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
    
    // ============================================
    // OLD PANEL DRAG LOGIC - REPLACED BY PanelManager (Итерация 5.3)
    // ============================================
    // Старый метод initPanelDrag больше не используется
    // Все панели теперь управляются через PanelManager в initPanels()
    /*
    initPanelDrag(panelId, headerId) {
        // ... старый код закомментирован ...
    }
    */
    
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
        
        // Save state after making changes (only on user interaction, not during restore)
        if (!this.isRestoringState) {
            this.debounceSaveState();
        }
    }
    
    // Switch margins unit between mod and mm
    switchGraphicsSizeMode(block, newMode) {
        if (!block) return;
        
        const oldMode = block.sizeMode || 'height';
        const aspectRatio = block.originalWidth / block.originalHeight;
        const module = this.settings.gridModule;
        
        // Calculate the actual size in mm (physical size that should stay the same)
        let actualHeightInMm, actualWidthInMm;
        if (oldMode === 'height') {
            actualHeightInMm = (block.heightInModules || 3) * module;
            actualWidthInMm = actualHeightInMm * aspectRatio;
        } else {
            // oldMode === 'width'
            actualWidthInMm = (block.widthInModules || 3) * module;
            actualHeightInMm = actualWidthInMm / aspectRatio;
        }
        
        // Update block's size mode
        block.sizeMode = newMode;
        
        // Update active state of buttons
        if (this.dom.graphicsSizeUnitHeight && this.dom.graphicsSizeUnitWidth) {
            if (newMode === 'height') {
                this.dom.graphicsSizeUnitHeight.classList.add('active');
                this.dom.graphicsSizeUnitWidth.classList.remove('active');
            } else {
                this.dom.graphicsSizeUnitWidth.classList.add('active');
                this.dom.graphicsSizeUnitHeight.classList.remove('active');
            }
        }
        
        // Update the input value
        if (newMode === 'height') {
            // Show height in modules
            const heightInModules = actualHeightInMm / module;
            block.heightInModules = parseFloat(heightInModules.toFixed(2));
            if (this.dom.graphicsSizeInput) {
                this.dom.graphicsSizeInput.value = heightInModules.toFixed(2);
            }
        } else {
            // Show width in modules
            const widthInModules = actualWidthInMm / module;
            block.widthInModules = parseFloat(widthInModules.toFixed(2));
            if (this.dom.graphicsSizeInput) {
                this.dom.graphicsSizeInput.value = widthInModules.toFixed(2);
            }
        }
        
        // Update grid to reflect new size
        this.updateGrid();
    }
    
    switchMarginsUnit(newUnit) {
        // Margins ВСЕГДА храним в модулях; при переключении единиц сохраняем физический размер.
        const currentModule = this.settings.gridModule;
        const currentMarginsInMod = this.settings.margins;

        // Физический размер полей в мм, который должен остаться неизменным
        const actualMarginsInMm = currentMarginsInMod * currentModule;

        // Обновляем единицу в настройках
        this.settings.marginsUnit = newUnit;

        // Обновляем активное состояние кнопок
        if (this.dom.marginsUnitMod && this.dom.marginsUnitMm) {
            if (newUnit === 'mod') {
                this.dom.marginsUnitMod.classList.add('active');
                this.dom.marginsUnitMm.classList.remove('active');
            } else {
                this.dom.marginsUnitMm.classList.add('active');
                this.dom.marginsUnitMod.classList.remove('active');
            }
        }

        // Настраиваем диапазоны и отображаемое значение через SliderController
        if (this.sliderController) {
            if (newUnit === 'mm') {
                // Диапазон в мм: 0–250
                const maxMarginsInMm = 250;
                this.sliderController.updateLimits('marginsSlider', 0, maxMarginsInMm);
                this.sliderController.setValue('marginsSlider', parseFloat(actualMarginsInMm.toFixed(2)), false);
            } else {
                // Возвращаемся к модулям: приводим обратно к модулям (на случай, если модуль изменился)
                const marginsInMod = currentModule > 0 ? actualMarginsInMm / currentModule : 0;
                const roundedMarginsInMod = parseFloat(marginsInMod.toFixed(2));
                this.settings.margins = roundedMarginsInMod;
                this.sliderController.updateLimits('marginsSlider', 0, 10);
                this.sliderController.setValue('marginsSlider', roundedMarginsInMod, false);
            }
        } else if (this.dom.marginsSlider && this.dom.marginsValue) {
            // Fallback на прямую работу с DOM (на случай, если SliderController ещё не инициализирован)
            const slider = this.dom.marginsSlider;
            const valueDisplay = this.dom.marginsValue;

            if (newUnit === 'mm') {
                const maxMarginsInMm = 250;
                slider.min = '0';
                slider.max = maxMarginsInMm.toFixed(2);
                slider.value = actualMarginsInMm.toFixed(2);
                valueDisplay.value = actualMarginsInMm.toFixed(2);
                valueDisplay.dataset.min = '0';
                valueDisplay.dataset.max = maxMarginsInMm.toFixed(2);
            } else {
                const marginsInMod = currentModule > 0 ? actualMarginsInMm / currentModule : 0;
                const roundedMarginsInMod = parseFloat(marginsInMod.toFixed(2));
                this.settings.margins = roundedMarginsInMod;
                slider.min = '0';
                slider.max = '10';
                slider.value = roundedMarginsInMod.toFixed(2);
                valueDisplay.value = roundedMarginsInMod.toFixed(2);
                valueDisplay.dataset.min = '0';
                valueDisplay.dataset.max = '10';
            }
        }
    }
    
    initValueInputs() {
        const valueInputs = document.querySelectorAll('.value-display');
        
        valueInputs.forEach(input => {
            // Margins обрабатываем только через SliderController и switchMarginsUnit,
            // чтобы не дублировать логику и не путать единицы измерения.
            if (input.id === 'marginsValue') {
                return;
            }
            
            // Universal naming convention: inputValue -> inputSlider
            const sliderId = input.id.replace('Value', 'Slider');
            const slider = document.getElementById(sliderId);
            const config = this.SLIDER_CONFIG[sliderId];
            
            // Если для этого инпута есть конфиг слайдера, все события (включая стрелки)
            // уже обрабатываются через SliderController, здесь ничего не вешаем.
            if (config) {
                return;
            }
            
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
    
    /**
     * Определяет количество знаков после запятой на основе шага
     * Например: 0.1 -> 1, 0.01 -> 2, 0.001 -> 3, 0.25 -> 2, 1 -> 0
     */
    getDecimalsFromStep(step) {
        if (step >= 1) return 0;
        
        // Преобразуем шаг в строку для анализа
        const stepStr = step.toString();
        
        // Если есть научная нотация (например, 1e-4)
        if (stepStr.includes('e')) {
            const match = stepStr.match(/e-(\d+)/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        
        // Если есть точка, считаем знаки после неё
        if (stepStr.includes('.')) {
            const parts = stepStr.split('.');
            if (parts.length === 2) {
                // Возвращаем длину всей части после точки (включая ведущие нули)
                // Например: "01" -> 2, "1" -> 1, "25" -> 2
                return parts[1].length;
            }
        }
        
        return 0;
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
        
        // Определяем шаг, который будет использоваться
        const step = e.shiftKey ? config.shiftStep : config.baseStep;
        const stepDecimals = step > 0 ? this.getDecimalsFromStep(step) : (config.decimals || 0);
        
        // Determine step based on shift key
        let newValue;
        if (e.shiftKey && config.decimals === 2) {
            // For Module and Margins with Shift: round to tenths first, then add/subtract 0.1
            const roundedToTenth = Math.round(currentValue * 10) / 10;
            const step = (e.key === 'ArrowUp' ? 1 : -1) * config.shiftStep;
            newValue = roundedToTenth + step;
        } else {
            // Округляем текущее значение до количества знаков шага перед изменением
            const roundedCurrent = stepDecimals > 0 
                ? parseFloat(currentValue.toFixed(stepDecimals))
                : Math.round(currentValue);
            const stepValue = e.key === 'ArrowUp' ? step : -step;
            newValue = roundedCurrent + stepValue;
        }
        
        // Округляем результат по количеству знаков шага (если шаг задан)
        if (step > 0 && stepDecimals > 0) {
            newValue = parseFloat(newValue.toFixed(stepDecimals));
        } else if (typeof config.decimals === 'number') {
            newValue = parseFloat(newValue.toFixed(config.decimals));
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
    
    generateRowPresets() {
        const container = document.getElementById('rowPresetsContainer');
        if (!container) return;
        
        const combinations = this.gridCalculator.findPerfectRowCombinations();
        
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
    
    // Функция для ограничения всех объектов в пределах сетки
    constrainAllObjectsToGrid() {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const maxColumns = this.settings.columnCount;
        const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
        const maxYInBaseline = Math.floor(contentHeightMm / module);
        const rowHeight = this.settings.rowHeight;
        
        // Ограничение текстовых блоков
        this.textBlocks.forEach(block => {
            // Горизонтальные ограничения
            // Клампируем позицию X: максимум columnCount - 1 (чтобы width был минимум 1)
            if (block.x > maxColumns - 1) {
                block.x = maxColumns - 1;
            }
            
            // Клампируем ширину если она превышает количество колонок
            if (block.width > maxColumns) {
                block.width = maxColumns;
            }
            
            // Клампируем позицию + ширину чтобы блок не выходил за пределы
            if (block.x + block.width > maxColumns) {
                block.width = Math.max(1, maxColumns - block.x);
            }
            
            // Вертикальные ограничения
            const textBlockHeightInModules = this.getTextBlockHeightInModules(block);
            const maxY = maxYInBaseline - textBlockHeightInModules;
            const currentY = this.getBlockY(block);
            
            if (currentY > maxY) {
                // Корректируем позицию если блок вышел за пределы
                const constrainedY = Math.max(0, maxY);
                const { row, baselineOffset } = this.yToRowBaseline(constrainedY);
                block.row = Math.max(0, row);
                block.baselineOffset = baselineOffset;
            }
        });
        
        // Ограничение графических блоков (icons, claim, custom graphics)
        if (this.graphicsBlocks) {
            this.graphicsBlocks.forEach(block => {
                // Вертикальные ограничения
                const graphicsHeightModules = block.heightInModules || 3;
                const maxY = maxYInBaseline - graphicsHeightModules;
                const currentY = this.getBlockY(block);
                
                if (currentY > maxY) {
                    const constrainedY = Math.max(0, maxY);
                    const { row, baselineOffset } = this.yToRowBaseline(constrainedY);
                    block.row = Math.max(0, row);
                    block.baselineOffset = baselineOffset;
                }
                
                // Горизонтальные ограничения
                const heightInMm = module * graphicsHeightModules;
                const aspectRatio = (block.originalWidth && block.originalHeight) 
                    ? block.originalWidth / block.originalHeight 
                    : 1;
                const widthInMm = heightInMm * aspectRatio;
                const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (maxColumns - 1)) / maxColumns;
                const gutter = module;
                const widthInColumns = Math.ceil(widthInMm / (columnWidth + gutter));
                const maxX = Math.max(1, maxColumns - widthInColumns + 1);
                
                if (block.x > maxX) {
                    block.x = maxX;
                }
            });
        }
    }
    
    // Обратная совместимость - alias для старого названия
    updateTextWidthConstraints() {
        this.constrainAllObjectsToGrid();
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
        switch(styleRef) {
            case 'headline':
                return 'Headline';
            case 'text':
                return 'Text';
            case 'caption':
                return 'Caption';
            case 'lunnenDisplay':
                return 'Lunnen Display';
            default:
                return styleRef.charAt(0).toUpperCase() + styleRef.slice(1);
        }
    }
    
    getStyleFontWeight(styleRef) {
        // Возвращаем начертание (Medium или Regular) вместо стиля
        switch(styleRef) {
            case 'headline':
                return this.settings.headlineFontWeight === 500 ? 'Medium' : 'Regular';
            case 'text':
                return this.settings.textFontWeight === 500 ? 'Medium' : 'Regular';
            case 'caption':
                return this.settings.captionFontWeight === 500 ? 'Medium' : 'Regular';
            case 'lunnenDisplay':
                return 'Regular'; // Lunnen Display always Regular
            default:
                return 'Medium';
        }
    }
    
    // ============================================
    // Graphics Helpers (Path 3 Refactoring)
    // ============================================
    
    // Получить графический блок по ID
    getGraphicsBlock(id) {
        return this.graphicsBlocks?.find(b => b.id === id);
    }
    
    // Получить все встроенные графические блоки
    getBuiltInGraphicsBlocks() {
        return this.graphicsBlocks?.filter(b => b.isBuiltIn) || [];
    }
    
    // Получить все кастомные графические блоки
    getCustomGraphicsBlocks() {
        return this.graphicsBlocks?.filter(b => !b.isBuiltIn) || [];
    }
    
    // Получить все видимые графические блоки
    getVisibleGraphicsBlocks() {
        return this.graphicsBlocks?.filter(b => b.visible !== false) || [];
    }
    
    // Проверить, является ли блок встроенным
    isBuiltInGraphics(blockIdOrBlock) {
        if (typeof blockIdOrBlock === 'string') {
            const block = this.getGraphicsBlock(blockIdOrBlock);
            return block ? block.isBuiltIn === true : false;
        }
        return blockIdOrBlock?.isBuiltIn === true;
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
    
    // Get font metrics for a specific style
    getFontMetricsForStyle(styleRef) {
        const fontFamily = this.getFontFamilyForStyle(styleRef);
        return this.fontMetrics[fontFamily] || this.fontMetrics['TT Commons Classic'];
    }
    
    // Get font family for a specific style
    getFontFamilyForStyle(styleRef) {
        if (styleRef === 'lunnenDisplay') {
            return 'Lunnen Display';
        }
        return 'TT Commons Classic';
    }
    
    // Calculate font size in mm based on module and height mode
    calculateFontSize() {
        const module = this.settings.gridModule;
        const sizeInModules = this.settings.headlineSize;
        const targetSize = module * sizeInModules; // size in mm
        const metrics = this.getFontMetricsForStyle('headline');
        
        // Calculate font size based on whether we're using cap height or x-height
        let fontSize;
        if (this.settings.useXHeight) {
            // x-height should equal targetSize
            fontSize = targetSize * (metrics.unitsPerEm / metrics.xHeight);
        } else {
            // cap height should equal targetSize
            fontSize = targetSize * (metrics.unitsPerEm / metrics.capHeight);
        }
        
        return fontSize; // in mm
    }
    
    // Calculate font size for Text style (cap height or x-height)
    calculateTextStyleFontSize() {
        const module = this.settings.gridModule;
        const sizeInModules = this.settings.textSize;
        const targetSize = module * sizeInModules; // size in mm
        const metrics = this.getFontMetricsForStyle('text');
        
        // Calculate font size based on whether we're using cap height or x-height
        let fontSize;
        if (this.settings.useXHeight2) {
            // x-height should equal targetSize
            fontSize = targetSize * (metrics.unitsPerEm / metrics.xHeight);
        } else {
            // cap height should equal targetSize
            fontSize = targetSize * (metrics.unitsPerEm / metrics.capHeight);
        }
        
        return fontSize; // in mm
    }
    
    // Calculate font size for Caption style
    calculateCaptionStyleFontSize() {
        const module = this.settings.gridModule;
        const sizeInModules = this.settings.captionSize;
        const targetSize = module * sizeInModules;
        const metrics = this.getFontMetricsForStyle('caption');
        
        let fontSize;
        if (this.settings.useXHeightCaption) {
            fontSize = targetSize * (metrics.unitsPerEm / metrics.xHeight);
        } else {
            fontSize = targetSize * (metrics.unitsPerEm / metrics.capHeight);
        }
        
        return fontSize;
    }
    
    // Calculate font size for Lunnen Display style
    calculateLunnenDisplayStyleFontSize() {
        const module = this.settings.gridModule;
        const sizeInModules = this.settings.lunnenDisplaySize;
        const targetSize = module * sizeInModules;
        const metrics = this.getFontMetricsForStyle('lunnenDisplay');
        
        let fontSize;
        if (this.settings.useXHeightLunnenDisplay) {
            fontSize = targetSize * (metrics.unitsPerEm / metrics.xHeight);
        } else {
            fontSize = targetSize * (metrics.unitsPerEm / metrics.capHeight);
        }
        
        return fontSize;
    }
    
    // Get style settings for any styleRef
    getStyleSettings(styleRef) {
        switch(styleRef) {
            case 'headline':
                return {
                    fontSize: this.calculateFontSize(),
                    lineHeight: this.settings.lineHeight,
                    tracking: this.settings.tracking,
                    useXHeight: this.settings.useXHeight,
                    fontWeight: this.settings.headlineFontWeight,
                    fontFamily: this.getFontFamilyForStyle('headline')
                };
            case 'text':
                return {
                    fontSize: this.calculateTextStyleFontSize(),
                    lineHeight: this.settings.textLineHeight,
                    tracking: this.settings.textTracking,
                    useXHeight: this.settings.useXHeight2,
                    fontWeight: this.settings.textFontWeight,
                    fontFamily: this.getFontFamilyForStyle('text')
                };
            case 'caption':
                return {
                    fontSize: this.calculateCaptionStyleFontSize(),
                    lineHeight: this.settings.captionLineHeight,
                    tracking: this.settings.captionTracking,
                    useXHeight: this.settings.useXHeightCaption,
                    fontWeight: this.settings.captionFontWeight,
                    fontFamily: this.getFontFamilyForStyle('caption')
                };
            case 'lunnenDisplay':
                return {
                    fontSize: this.calculateLunnenDisplayStyleFontSize(),
                    lineHeight: this.settings.lunnenDisplayLineHeight,
                    tracking: this.settings.lunnenDisplayTracking,
                    useXHeight: false, // Lunnen Display всегда использует capHeight (нет строчных букв)
                    fontWeight: 400, // Lunnen Display always 400
                    fontFamily: this.getFontFamilyForStyle('lunnenDisplay')
                };
            default:
                // Fallback to text style
                return {
                    fontSize: this.calculateTextStyleFontSize(),
                    lineHeight: this.settings.textLineHeight,
                    tracking: this.settings.textTracking,
                    useXHeight: this.settings.useXHeight2,
                    fontWeight: this.settings.textFontWeight,
                    fontFamily: this.getFontFamilyForStyle('text')
                };
        }
    }
    
    // ============================================
    // Math utilities (Итерация 8: обертки удалены, используем MathUtils напрямую)
    // ============================================
    
    // Get font size in pt for Headline
    getHeadlineFontSizePt() {
        const fontSizeMm = this.calculateFontSize();
        return Math.round(MathUtils.mmToPt(fontSizeMm) * 10) / 10;
    }
    
    // Get line height in pt for Headline
    getHeadlineLineHeightPt() {
        const module = this.settings.gridModule;
        const lineHeightInModules = this.settings.lineHeight;
        const lineHeightMm = module * lineHeightInModules;
        return Math.round(MathUtils.mmToPt(lineHeightMm) * 10) / 10;
    }
    
    // Get font size in pt for Text
    getTextFontSizePt() {
        const fontSizeMm = this.calculateTextStyleFontSize();
        return Math.round(MathUtils.mmToPt(fontSizeMm) * 10) / 10;
    }
    
    // Get line height in pt for Text
    getTextLineHeightPt() {
        const module = this.settings.gridModule;
        const lineHeightInModules = this.settings.textLineHeight;
        const lineHeightMm = module * lineHeightInModules;
        return Math.round(MathUtils.mmToPt(lineHeightMm) * 10) / 10;
    }
    
    // Get font size in pt for Caption
    getCaptionFontSizePt() {
        const fontSizeMm = this.calculateCaptionStyleFontSize();
        return Math.round(MathUtils.mmToPt(fontSizeMm) * 10) / 10;
    }
    
    // Get line height in pt for Caption
    getCaptionLineHeightPt() {
        const module = this.settings.gridModule;
        const lineHeightInModules = this.settings.captionLineHeight;
        const lineHeightMm = module * lineHeightInModules;
        return Math.round(MathUtils.mmToPt(lineHeightMm) * 10) / 10;
    }
    
    // Get font size in pt for Lunnen Display
    getLunnenDisplayFontSizePt() {
        const fontSizeMm = this.calculateLunnenDisplayStyleFontSize();
        return Math.round(MathUtils.mmToPt(fontSizeMm) * 10) / 10;
    }
    
    // Get line height in pt for Lunnen Display
    getLunnenDisplayLineHeightPt() {
        const module = this.settings.gridModule;
        const lineHeightInModules = this.settings.lunnenDisplayLineHeight;
        const lineHeightMm = module * lineHeightInModules;
        return Math.round(MathUtils.mmToPt(lineHeightMm) * 10) / 10;
    }
    
    // Update font size displays in UI
    updateFontSizeDisplays() {
        if (this.dom.headlineFontSize) {
            const fontSize = this.getHeadlineFontSizePt();
            const lineHeight = this.getHeadlineLineHeightPt();
            this.dom.headlineFontSize.textContent = `${fontSize}/${lineHeight} pt`;
        }
        
        if (this.dom.textFontSize) {
            const fontSize = this.getTextFontSizePt();
            const lineHeight = this.getTextLineHeightPt();
            this.dom.textFontSize.textContent = `${fontSize}/${lineHeight} pt`;
        }
        
        if (this.dom.captionFontSize) {
            const fontSize = this.getCaptionFontSizePt();
            const lineHeight = this.getCaptionLineHeightPt();
            this.dom.captionFontSize.textContent = `${fontSize}/${lineHeight} pt`;
        }
        
        if (this.dom.lunnenDisplayFontSize) {
            const fontSize = this.getLunnenDisplayFontSizePt();
            const lineHeight = this.getLunnenDisplayLineHeightPt();
            this.dom.lunnenDisplayFontSize.textContent = `${fontSize}/${lineHeight} pt`;
        }
    }
    
    // Snap position to nearest baseline grid line (relative to front panel)
    // isFirstLine - если true, привязываем к целому модулю, иначе к четверти модуля
    snapToBaseline(y, frontY, scale, isFirstLine = false, alignmentMode = 'baseline') {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const topMargin = module * margins * scale;
        
        // Calculate the relative position from the front panel's top margin
        const relativeY = y - (frontY + topMargin);
        
        let nearestBaseline;
        if (isFirstLine) {
            // Для x-height режима первая строка НЕ привязывается к baseline - возвращаем как есть
            if (alignmentMode === 'x-height') {
                return y; // Возвращаем исходную позицию без округления
            }
            // Первая строка в baseline режиме - привязываем к целому модулю (baseline сетка)
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
        let x;
        
        // Check alignment (default to 'left' for backward compatibility)
        const alignment = block.alignment || 'left';
        
        if (alignment === 'right') {
            // For right alignment: return the RIGHT edge of the column
            // x включает левый margin, так как колонки считаются внутри margin
            // Правый край колонки = левый край + ширина колонки
            x = module * margins * scale + (block.x - 1) * (columnWidth * scale + gutter * scale) + columnWidth * scale;
        } else {
            // Left alignment (default): return the LEFT edge of the column
            // x включает левый margin, так как колонки считаются внутри margin
            // Вычитаем 1, т.к. отсчет колонок начинается с 1
            x = module * margins * scale + (block.x - 1) * (columnWidth * scale + gutter * scale);
        }
        
        // y НЕ включает topMargin - он добавляется при отрисовке
        // Получаем Y позицию в baseline модулях из row + baselineOffset
        const yInBaseline = this.getBlockY(block);
        const y = yInBaseline * (module * scale);
        
        return { x, y };
    }
    
    // Измерить ширину текста в SVG точно
    measureTextWidth(text, fontSize, scale, tracking = 0) {
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
            const trackingPx = tracking * scaledFontSize;
            width += trackingPx * (text.length - 1);
        }
        
        return width;
    }
    
    // Разбить текст на строки с учетом ширины блока
    wrapText(text, maxWidth, fontSize, scale, tracking = 0) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = this.measureTextWidth(testLine, fontSize, scale, tracking);
            
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
    
    // Calculate text block height in modules
    getTextBlockHeightInModules(block) {
        const module = this.settings.gridModule;
        
        // Get style settings based on block's styleRef
        const style = this.getStyleSettings(block.styleRef || 'text');
        
        // Get text content
        const inputLines = block.content.split('\n').filter(line => line.trim() !== '');
        if (inputLines.length === 0) {
            return style.lineHeight; // Return minimum height for empty block
        }
        
        // Calculate text block width
        const textBlockWidth = this.calculateBlockWidth(block);
        
        // Wrap text lines to fit width
        const wrappedLines = [];
        inputLines.forEach(line => {
            const wrapped = this.wrapText(line, textBlockWidth, style.fontSize, 1, style.tracking);
            wrappedLines.push(...wrapped);
        });
        
        // Height in modules = lineHeight * number of lines
        return style.lineHeight * wrappedLines.length;
    }
    
    // Draw text block on canvas with hover effects and drag handles
    drawTextBlock(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        const gridColor = this.getContrastColor();
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const alignment = block.alignment || 'left';
        
        // Get style settings based on block's styleRef
        const style = this.getStyleSettings(block.styleRef || 'text');
        const fontSize = style.fontSize;
        const scaledFontSize = fontSize * scale;
        const lineHeightSetting = style.lineHeight;
        const trackingSetting = style.tracking;
        const useXHeight = style.useXHeight;
        const fontWeight = style.fontWeight;
        const fontFamily = style.fontFamily;
        
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
            const wrapped = this.wrapText(line, scaledTextWidth, fontSize, scale, trackingSetting);
            wrappedLines.push(...wrapped);
        });
        
        // Calculate position
        const position = this.calculateBlockPosition(block, scale);
        // For right-aligned blocks, shift left by block width so the right edge aligns with the column
        // But text inside is still left-aligned within the block
        const textX = alignment === 'right' 
            ? frontX + position.x - scaledTextWidth 
            : frontX + position.x;
        
        // Calculate cap height and x-height for positioning
        let actualCapHeight, actualXHeight;
        const metrics = this.getFontMetricsForStyle(block.styleRef || 'text');
        // Get size in modules for the current style
        let textSize;
        switch(block.styleRef) {
            case 'headline':
                textSize = this.settings.headlineSize;
                break;
            case 'text':
                textSize = this.settings.textSize;
                break;
            case 'caption':
                textSize = this.settings.captionSize;
                break;
            case 'lunnenDisplay':
                textSize = this.settings.lunnenDisplaySize;
                break;
            default:
                textSize = this.settings.textSize;
        }
        
        if (useXHeight) {
            actualXHeight = module * textSize * scale;
            actualCapHeight = actualXHeight * (metrics.capHeight / metrics.xHeight);
        } else {
            actualCapHeight = module * textSize * scale;
            actualXHeight = actualCapHeight * (metrics.xHeight / metrics.capHeight);
        }
        
        const topMargin = module * margins * scale;
        
        // Рассчитываем firstLineY в зависимости от режима выравнивания
        // Элементы baseline сетки - это прямоугольники высотой = module
        // position.y указывает на ВЕРХ элемента baseline
        const baselineElementHeight = module * scale;
        let firstLineY;
        
        // Используем alignmentMode блока (по умолчанию 'baseline')
        const alignmentMode = block.alignmentMode || 'baseline';
        
        if (alignmentMode === 'x-height') {
            // X-Height режим: верх строчных букв выравнивается по ВЕРХУ элемента baseline
            // baseline текста должен быть ниже на величину x-height
            firstLineY = frontY + position.y + topMargin + actualXHeight;
        } else {
            // Baseline режим (по умолчанию): baseline текста выравнивается по НИЗУ элемента baseline
            firstLineY = frontY + position.y + topMargin + baselineElementHeight;
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
            'font-family': `${fontFamily}, -apple-system, BlinkMacSystemFont, sans-serif`,
            'font-weight': (block.styleRef === 'lunnenDisplay' && block.fontWeight) ? block.fontWeight.toString() : fontWeight.toString(),
            'font-size': `${scaledFontSize}`,
            'text-anchor': 'start', // Always left-align text inside the block
            'fill': gridColor,
            'fill-opacity': '1',
            'letter-spacing': `${trackingSetting}em`
        };
        
        // Добавляем настройки шрифта для Lunnen Display через style (для SVG)
        if (block.styleRef === 'lunnenDisplay') {
            const styleAttrs = [];
            
            // Font variation settings
            if (block.fontWeight) {
                const weightSetting = `'wght' ${block.fontWeight}`;
                textAttrs['font-variation-settings'] = weightSetting;
                styleAttrs.push(`font-variation-settings: ${weightSetting}`);
            }
            
            // Font feature settings
            if (block.fontFeatures) {
                const features = [];
                if (block.fontFeatures.salt) features.push("'salt' 1");
                if (block.fontFeatures.aalt) features.push("'aalt' 1");
                if (block.fontFeatures.ss01) features.push("'ss01' 1");
                if (block.fontFeatures.ss02) features.push("'ss02' 1");
                if (block.fontFeatures.tnum) features.push("'tnum' 1");
                if (block.fontFeatures.dlig) features.push("'dlig' 1");
                
                if (features.length > 0) {
                    const featureString = features.join(', ');
                    textAttrs['font-feature-settings'] = featureString;
                    styleAttrs.push(`font-feature-settings: ${featureString}`);
                }
            }
            
            // Объединяем все стили в style атрибут
            if (styleAttrs.length > 0) {
                textAttrs['style'] = styleAttrs.join('; ') + ';';
            }
        }
        
        // Draw each line
        let previousBaselineY = null;
        wrappedLines.forEach((line, index) => {
            let lineBaselineY;
            
            if (index === 0) {
                const lineApproxY = firstLineY;
                lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, true, alignmentMode);
                previousBaselineY = lineBaselineY;
            } else if (alignmentMode === 'x-height') {
                // В режиме x-height все строки после первой НЕ привязываем к сетке
                // Используем точное расстояние согласно интерлиньяжу
                lineBaselineY = previousBaselineY + lineHeightInMm;
                previousBaselineY = lineBaselineY;
            } else {
                // В режиме baseline остальные строки привязываются к сетке
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
        
        // Create bounds rectangle only for canvas (not for export)
        if (scale !== 1) {
            // For right-aligned blocks, bounds are shifted left by block width
            const boundsX = alignment === 'right' 
                ? frontX + position.x - scaledTextWidth  // Left edge of right-aligned block
                : frontX + position.x;                    // Left edge of left-aligned block
            
            // Calculate Y position of the top of the first line
            // Text baseline is at firstLineY, so top is at firstLineY - actualCapHeight
            const firstLineTop = firstLineY - actualCapHeight;
            
            // Calculate total height of text block
            // For multiple lines: first line capHeight + (n-1) * lineHeight + last line descent
            const descent = actualCapHeight * 0.25; // Approximate descent
            const totalHeight = actualCapHeight + lineHeightInMm * (wrappedLines.length - 1) + descent;
            
            // Create invisible hover area for the entire block
            const hoverArea = this.createSVGElement('rect', {
                id: `hover-area-${block.id}`,
                x: boundsX,
                y: firstLineTop,
                width: scaledTextWidth,
                height: totalHeight,
                fill: 'transparent',
                'fill-opacity': '0',
                stroke: 'none',
                style: 'pointer-events: all; cursor: move;',
                'data-block-id': block.id
            }, container);
            
            const boundsRect = this.createSVGElement('rect', {
                id: `bounds-${block.id}`,
                x: boundsX,
                y: firstLineTop,
                width: scaledTextWidth,
                height: totalHeight,
                fill: 'rgba(255, 255, 255, 0.05)',
                stroke: gridColor,
                'stroke-width': '1',
                'stroke-opacity': '0',
                'fill-opacity': '0',
                style: 'pointer-events: none; transition: opacity 0.2s;',
                'data-block-id': block.id
            }, container);
            
            // Store bounds element reference
            textGroup.boundsElement = boundsRect;
            textGroup.hoverArea = hoverArea;
            
            // Attach event handlers to hoverArea instead of textGroup
            this.attachTextBlockHandlers(hoverArea, block, frontX, frontY, scale);
            
            // Create resize handle (on the left for right-aligned blocks, on the right for left-aligned)
            // Фиксированная ширина хэндла независимо от зума (как у бейслайна)
            const handleWidth = 4;
            const handleX = alignment === 'right' 
                ? boundsX - handleWidth / 2                                  // Left edge for right-aligned blocks
                : frontX + position.x + scaledTextWidth - handleWidth / 2;   // Right edge for left-aligned blocks
            const resizeHandle = this.createSVGElement('rect', {
                id: `resize-handle-${block.id}`,
                x: handleX,
                y: firstLineTop,
                width: handleWidth,
                height: totalHeight,
                fill: gridColor,
                'fill-opacity': '0',
                stroke: 'none',
                style: 'cursor: ew-resize; pointer-events: all; transition: opacity 0.2s;',
                'data-block-id': block.id,
                'vector-effect': 'non-scaling-size'
            }, container);
            
            // Store resize handle reference
            textGroup.resizeHandle = resizeHandle;
            
            // Attach resize handler
            this.attachResizeHandle(resizeHandle, block, frontX, frontY, scale);
            
            // Add hover handlers to show/hide bounds and handle
            hoverArea.addEventListener('mouseenter', () => {
                if (boundsRect && !this.textDragState.isDragging) {
                    boundsRect.setAttribute('stroke-opacity', '0.5');
                    boundsRect.setAttribute('fill-opacity', '0.05');
                }
                if (resizeHandle) {
                    resizeHandle.setAttribute('fill-opacity', '0.2');
                }
            });
            
            hoverArea.addEventListener('mouseleave', () => {
                if (boundsRect && !this.textDragState.isDragging) {
                    boundsRect.setAttribute('stroke-opacity', '0');
                    boundsRect.setAttribute('fill-opacity', '0');
                }
                if (resizeHandle) {
                    resizeHandle.setAttribute('fill-opacity', '0');
                }
            });
        }
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
    }
    
    // Attach resize handle for text block width
    attachResizeHandle(handle, block, frontX, frontY, scale) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        handle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            
            isResizing = true;
            startX = e.clientX;
            startWidth = block.width || 1;
            
            // Show handle during resize
            handle.setAttribute('fill-opacity', '0.3');
            
            const mouseMoveHandler = (moveEvent) => {
                if (!isResizing) return;
                
                moveEvent.stopPropagation();
                moveEvent.preventDefault();
                
                const dx = moveEvent.clientX - startX;
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                const columnCount = this.settings.columnCount;
                const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount;
                const gutter = module;
                
                // Convert pixel movement to columns
                const effectiveScale = scale;
                const columnWithGutter = (columnWidth + gutter) * effectiveScale;
                
                // For right-aligned text, handle is on the left, so invert the delta
                const alignment = block.alignment || 'left';
                const deltaColumns = alignment === 'right' ? -dx / columnWithGutter : dx / columnWithGutter;
                
                // Calculate new width in columns
                let newWidth = startWidth + deltaColumns;
                
                // Constrain to valid range (0.25 to remaining columns)
                const minWidth = 0.25;
                // For right-aligned: max width is the column position (grows left from right edge)
                // For left-aligned: max width is remaining columns to the right
                const maxWidth = alignment === 'right' ? block.x : columnCount - block.x + 1;
                newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
                
                // Round to nearest 0.25 column
                const roundedWidth = Math.round(newWidth * 4) / 4;
                
                // Update block width only if changed significantly
                if (Math.abs(roundedWidth - (block.width || 1)) >= 0.25) {
                    // For right-aligned blocks, width changes but position (block.x) stays the same
                    // The right edge remains anchored to the column
                    block.width = roundedWidth;
                    this.updateGrid();
                }
            };
            
            const mouseUpHandler = () => {
                isResizing = false;
                handle.setAttribute('fill-opacity', '0');
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
        
        // Show handle on hover (higher opacity to override hoverArea)
        handle.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            if (!isResizing) {
                handle.setAttribute('fill-opacity', '0.5');
            }
        });
        
        handle.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            if (!isResizing) {
                handle.setAttribute('fill-opacity', '0.2');
            }
        });
    }
    
    // Draw icons block on canvas
    drawIconsBlock(container, frontX, frontY, frontWidth, frontHeight, scale) {
        const gridColor = this.getContrastColor();
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        
        const block = this.iconsBlock;
        
        // Calculate height in mm based on modules
        const heightInMm = module * block.heightInModules;
        
        // Calculate width maintaining aspect ratio
        const aspectRatio = block.originalWidth / block.originalHeight;
        const widthInMm = heightInMm * aspectRatio;
        
        // Calculate position
        const position = this.calculateBlockPosition(block, scale);
        const iconsX = frontX + position.x;
        const topMargin = module * margins * scale;
        const iconsY = frontY + position.y + topMargin;
        
        // Scale dimensions
        const scaledWidth = widthInMm * scale;
        const scaledHeight = heightInMm * scale;
        
        // Create group for icons
        const iconsGroup = this.createSVGElement('g', {
            id: 'icons-group',
            style: 'cursor: move;',
            'data-block-id': 'icons'
        }, container);
        
        // Create bounds rectangle (initially hidden)
        const boundsRect = this.createSVGElement('rect', {
            x: iconsX,
            y: iconsY,
            width: scaledWidth,
            height: scaledHeight,
            fill: gridColor,
            'fill-opacity': '0',
            stroke: gridColor,
            'stroke-width': scale === 1 ? '0.5' : '1',
            'stroke-opacity': '0'
        }, iconsGroup);
        iconsGroup.boundsElement = boundsRect;
        
        // Create nested SVG for icons with correct viewBox
        const nestedSvg = this.createSVGElement('svg', {
            x: iconsX,
            y: iconsY,
            width: scaledWidth,
            height: scaledHeight,
            viewBox: `0 0 ${block.originalWidth} ${block.originalHeight}`,
            preserveAspectRatio: 'xMinYMin meet',
            style: `color: ${gridColor}; overflow: visible;`
        }, iconsGroup);
        
        // Add SVG content (loaded from graphics/icons.svg)
        nestedSvg.innerHTML = block.svgContent || '';
        
        // Attach event handlers similar to text blocks
        this.attachIconsBlockHandlers(iconsGroup, block, frontX, frontY, scale);
    }
    
    // Draw graphics block on canvas
    drawGraphicsBlock(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        if (!block.svgContent) return;
        
        const gridColor = this.getContrastColor();
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        
        // Calculate dimensions based on sizeMode
        const sizeMode = block.sizeMode || 'height';
        const aspectRatio = block.originalWidth / block.originalHeight;
        let heightInMm, widthInMm;
        
        if (sizeMode === 'height') {
            heightInMm = module * (block.heightInModules || 3);
            widthInMm = heightInMm * aspectRatio;
        } else {
            // sizeMode === 'width'
            widthInMm = module * (block.widthInModules || 3);
            heightInMm = widthInMm / aspectRatio;
        }
        
        // Calculate position
        const columnWidth = (frontWidth / scale - module * margins * 2 - module * (this.settings.columnCount - 1)) / this.settings.columnCount;
        const gutter = module;
        const topMargin = module * margins * scale;
        
        const yInBaseline = this.getBlockY({
            row: block.row,
            baselineOffset: block.baselineOffset
        });
        
        // Calculate X position based on alignment
        const alignment = block.alignment || 'left';
        let graphicsX;
        
        // Calculate how many columns the graphic occupies
        const graphicsWidthInColumns = Math.ceil(widthInMm / (columnWidth + gutter));
        
        if (alignment === 'right') {
            // For right alignment: X indicates the left column of the area
            // Calculate the right edge of the rightmost column that graphic would occupy
            // Then offset left by graphic width to align the graphic's right edge with that column's right edge
            const areaRightColumn = block.x + graphicsWidthInColumns - 1; // Last column of the area
            const areaRightEdge = frontX + module * margins * scale + (areaRightColumn - 1) * (columnWidth * scale + gutter * scale) + columnWidth * scale;
            graphicsX = areaRightEdge - widthInMm * scale;
        } else {
            // Left alignment (default): position at the LEFT edge of the column
            graphicsX = frontX + module * margins * scale + (block.x - 1) * (columnWidth * scale + gutter * scale);
        }
        
        const graphicsY = frontY + yInBaseline * (module * scale) + topMargin;
        
        // Scale dimensions
        const scaledWidth = widthInMm * scale;
        const scaledHeight = heightInMm * scale;
        
        // Create group for graphics
        const graphicsGroup = this.createSVGElement('g', {
            id: `graphics-group-${block.id}`,
            style: 'cursor: move;',
            'data-block-id': block.id
        }, container);
        
        // Create bounds rectangle (initially hidden)
        // This rectangle serves as the active area for mouse events
        const boundsRect = this.createSVGElement('rect', {
            x: graphicsX,
            y: graphicsY,
            width: scaledWidth,
            height: scaledHeight,
            fill: gridColor,
            'fill-opacity': '0',
            stroke: gridColor,
            'stroke-width': scale === 1 ? '0.5' : '1',
            'stroke-opacity': '0',
            style: 'pointer-events: all; transition: opacity 0.2s;',
            'data-block-id': block.id
        }, graphicsGroup);
        
        // Store bounds element reference for hover effect
        graphicsGroup.boundsElement = boundsRect;
        
        // Create nested SVG for graphics with correct viewBox
        // Disable pointer events on nested SVG so bounds rectangle handles all interactions
        const nestedSvg = this.createSVGElement('svg', {
            x: graphicsX,
            y: graphicsY,
            width: scaledWidth,
            height: scaledHeight,
            viewBox: `0 0 ${block.originalWidth} ${block.originalHeight}`,
            preserveAspectRatio: 'xMinYMin meet',
            style: `color: ${gridColor}; overflow: visible; pointer-events: none;`
        }, graphicsGroup);
        
        // Add SVG content
        nestedSvg.innerHTML = block.svgContent;
        
        // Attach event handlers
        this.attachGraphicsBlockHandlers(graphicsGroup, block, frontX, frontY, scale);
    }
    
    // Attach event handlers for graphics block (click, hover, drag)
    attachGraphicsBlockHandlers(graphicsGroup, block, frontX, frontY, scale) {
        let mouseDownTime = 0;
        let mouseDownX = 0;
        let mouseDownY = 0;
        
        graphicsGroup.addEventListener('mousedown', (e) => {
            // Только левая кнопка мыши
            if (e.button !== 0) return;
            
            e.stopPropagation();
            e.preventDefault();
            
            mouseDownTime = Date.now();
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            
            // Start dragging
            this.textDragState.isDragging = true;
            this.textDragState.blockId = block.id;
            this.textDragState.startMouseX = e.clientX;
            this.textDragState.startMouseY = e.clientY;
            this.textDragState.startBlockX = block.x;
            this.textDragState.startBlockY = this.getBlockY(block);
            this.textDragState.frontX = frontX;
            this.textDragState.frontY = frontY;
            this.textDragState.scale = scale;
            
            // Show bounds during drag
            if (graphicsGroup.boundsElement) {
                graphicsGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                graphicsGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
            
            const mouseMoveHandler = (e) => {
                if (!this.textDragState.isDragging) return;
                
                const dx = e.clientX - this.textDragState.startMouseX;
                const dy = e.clientY - this.textDragState.startMouseY;
                
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                const columnCount = this.settings.columnCount;
                
                // Calculate column width
                const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount;
                const gutter = module;
                
                // Convert pixel movement to grid units
                const effectiveScale = scale;
                const columnWithGutter = (columnWidth + gutter) * effectiveScale;
                const moduleScaled = module * effectiveScale;
                
                const newX = Math.round((this.textDragState.startBlockX * columnWithGutter + dx) / columnWithGutter);
                let newY = Math.round((this.textDragState.startBlockY * moduleScaled + dy) / moduleScaled);
                
                // Calculate graphics width considering aspect ratio
                const heightInMm = module * block.heightInModules;
                const aspectRatio = block.originalWidth / block.originalHeight;
                const widthInMm = heightInMm * aspectRatio;
                const widthInColumns = widthInMm / (columnWidth + gutter);
                
                // Constrain within grid boundaries
                const minX = 1;
                const maxX = Math.max(1, Math.floor(columnCount - widthInColumns) + 1);
                block.x = Math.max(minX, Math.min(maxX, newX));
                
                // Convert Y from baseline grid to row and baseline offset
                const { row, baselineOffset } = this.yToRowBaseline(newY);
                
                block.row = Math.max(0, row);
                block.baselineOffset = Math.max(0, baselineOffset);
                
                // Update panel inputs if open
                if (this.dom.graphicsPanel && this.dom.graphicsPanel.classList.contains('active')) {
                    if (this.dom.graphicsXInput) this.dom.graphicsXInput.value = block.x;
                    if (this.dom.graphicsRowInput) this.dom.graphicsRowInput.value = block.row + 1;
                    if (this.dom.graphicsBaselineInput) {
                        const globalBaseline = this.rowBaselineToY(block.row, block.baselineOffset);
                        this.dom.graphicsBaselineInput.value = globalBaseline + 1;
                    }
                }
                
                this.updateGrid();
            };
            
            const mouseUpHandler = () => {
                this.textDragState.isDragging = false;
                
                // Check if it was a click (not a drag)
                const timeDiff = Date.now() - mouseDownTime;
                const distance = Math.sqrt(
                    Math.pow(e.clientX - mouseDownX, 2) + 
                    Math.pow(e.clientY - mouseDownY, 2)
                );
                
                // Более щедрые условия для клика: 300мс и 10px
                if (timeDiff < 300 && distance < 10) {
                    // It's a click - open settings panel
                    this.showGraphicsEditPanel(block.id);
                }
                
                // Hide bounds after drag
                if (graphicsGroup.boundsElement) {
                    graphicsGroup.boundsElement.setAttribute('stroke-opacity', '0');
                    graphicsGroup.boundsElement.setAttribute('fill-opacity', '0');
                }
                
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
        
        // Hover handlers - показать/скрыть границы
        graphicsGroup.addEventListener('mouseenter', () => {
            if (graphicsGroup.boundsElement && !this.textDragState.isDragging) {
                graphicsGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                graphicsGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
        });
        
        graphicsGroup.addEventListener('mouseleave', () => {
            if (graphicsGroup.boundsElement && !this.textDragState.isDragging) {
                graphicsGroup.boundsElement.setAttribute('stroke-opacity', '0');
                graphicsGroup.boundsElement.setAttribute('fill-opacity', '0');
            }
        });
    }
    
    // Show Graphics Edit Panel for existing graphics
    showGraphicsEditPanel(blockId) {
        const block = this.graphicsBlocks?.find(b => b.id === blockId);
        if (!block) return;
        
        // Set panel title
        if (this.dom.graphicsPanelTitle) {
            let displayName = block.name || 'Graphic';
            if (displayName.length > 24) {
                displayName = displayName.substring(0, 24) + '...';
            }
            this.dom.graphicsPanelTitle.textContent = displayName;
        }
        
        // Fill panel fields
        if (this.dom.graphicsXInput) {
            this.dom.graphicsXInput.value = block.x;
        }
        if (this.dom.graphicsRowInput) {
            this.dom.graphicsRowInput.value = block.row + 1;
        }
        if (this.dom.graphicsBaselineInput) {
            const globalBaseline = this.rowBaselineToY(block.row, block.baselineOffset);
            this.dom.graphicsBaselineInput.value = globalBaseline + 1;
        }
        if (this.dom.graphicsHeightInput) {
            this.dom.graphicsHeightInput.value = block.heightInModules.toFixed(2);
        }
        
        // Set size mode and value
        const sizeMode = block.sizeMode || 'height';
        if (this.dom.graphicsSizeUnitHeight && this.dom.graphicsSizeUnitWidth) {
            if (sizeMode === 'height') {
                this.dom.graphicsSizeUnitHeight.classList.add('active');
                this.dom.graphicsSizeUnitWidth.classList.remove('active');
                if (this.dom.graphicsSizeInput) {
                    this.dom.graphicsSizeInput.value = (block.heightInModules || 3).toFixed(2);
                }
            } else {
                this.dom.graphicsSizeUnitWidth.classList.add('active');
                this.dom.graphicsSizeUnitHeight.classList.remove('active');
                if (this.dom.graphicsSizeInput) {
                    this.dom.graphicsSizeInput.value = (block.widthInModules || 3).toFixed(2);
                }
            }
        }
        
        if (this.dom.graphicsLockPositionToggle) {
            this.dom.graphicsLockPositionToggle.checked = block.lockPosition || false;
        }
        
        if (this.dom.graphicsAlignRightToggle) {
            this.dom.graphicsAlignRightToggle.checked = block.alignment === 'right';
        }
        
        // Show file upload area with updated placeholder
        if (this.dom.fileUploadArea) {
            this.dom.fileUploadArea.style.display = 'block';
            const placeholder = this.dom.fileUploadArea.querySelector('.upload-placeholder p');
            if (placeholder) {
                placeholder.textContent = `Current: ${block.name || 'Graphic'} — Upload new SVG to replace`;
            }
        }
        
        // Update action button icons and visibility
        const graphicsHideBtn = document.getElementById('graphicsHideBtn');
        const graphicsDeleteBtn = document.getElementById('graphicsDeleteBtn');
        
        if (graphicsHideBtn) {
            // Update hide icon based on visibility
            const svg = graphicsHideBtn.querySelector('svg');
            if (svg) {
                if (block.visible) {
                    // Show hide icon (eye with slash)
                    svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                } else {
                    // Show visible icon (eye without slash)
                    svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                }
            }
        }
        
        if (graphicsDeleteBtn) {
            // Show delete button for all graphics (including built-in)
            graphicsDeleteBtn.style.display = 'flex';
        }
        
        // Также показываем/скрываем кнопку скрытия (она работает для всех типов)
        if (graphicsHideBtn) {
            graphicsHideBtn.style.display = 'flex';
        }
        
        // Center and show panel
        if (this.dom.graphicsPanel) {
            this.dom.graphicsPanel.style.display = 'flex';
            this.dom.graphicsPanel.classList.add('active');
            this.positionPanelNextToBlock(this.dom.graphicsPanel, blockId, 'graphics');
        }
        
        // Store current editing block ID
        this.currentEditingGraphicsId = blockId;
        
        // Initialize input handlers with arrow key support
        this.initGraphicsInputsWithArrows();
    }

    centerPanel(panelElement) {
        if (!panelElement) return;
        
        const padding = 16;
        const panelRect = panelElement.getBoundingClientRect();
        const panelWidth = panelRect.width || panelElement.offsetWidth || 0;
        const panelHeight = panelRect.height || panelElement.offsetHeight || 0;
        
        const availableWidth = window.innerWidth - panelWidth - padding;
        const availableHeight = window.innerHeight - panelHeight - padding;
        
        const left = Math.max(
            padding,
            Math.min((window.innerWidth - panelWidth) / 2, availableWidth)
        );
        const top = Math.max(
            padding,
            Math.min((window.innerHeight - panelHeight) / 2, availableHeight)
        );
        
        panelElement.style.left = `${Math.round(left)}px`;
        panelElement.style.top = `${Math.round(top)}px`;
        panelElement.style.transform = 'none';
    }
    
    positionPanelNextToBlock(panelElement, blockId, type = 'graphics') {
        if (!panelElement) return;
        
        const targetRect = this.getBlockViewportRect(blockId, type);
        if (!targetRect) {
            this.centerPanel(panelElement);
            return;
        }
        
        const padding = 16;
        const offset = 24;
        const bottomMargin = 80; // Минимальный отступ от нижнего края окна
        const panelRect = panelElement.getBoundingClientRect();
        const panelWidth = panelRect.width || panelElement.offsetWidth || 0;
        const panelHeight = panelRect.height || panelElement.offsetHeight || 0;
        
        const maxLeft = window.innerWidth - panelWidth - padding;
        const maxTop = window.innerHeight - panelHeight - padding;
        
        let left = targetRect.right + offset;
        let top = targetRect.top;
        
        // Проверка горизонтального позиционирования
        if (left > maxLeft) {
            left = targetRect.left - panelWidth - offset;
        }
        
        left = Math.max(padding, Math.min(left, maxLeft));
        
        // Проверка вертикального позиционирования с учетом bottomMargin
        // Вычисляем максимальную позицию top так, чтобы нижняя граница панели
        // не опускалась ниже bottomMargin от нижнего края окна
        const maxBottomTop = window.innerHeight - panelHeight - bottomMargin;
        
        // Сначала применяем стандартное ограничение
        top = Math.max(padding, Math.min(top, maxTop));
        
        // Затем применяем ограничение по bottomMargin (только если оно строже)
        if (top > maxBottomTop) {
            top = Math.max(padding, maxBottomTop);
        }
        
        panelElement.style.left = `${Math.round(left)}px`;
        panelElement.style.top = `${Math.round(top)}px`;
        panelElement.style.transform = 'none';
    }
    
    getBlockViewportRect(blockId, type = 'graphics') {
        if (!blockId) return null;
        
        if (type === 'text') {
            const bounds = document.getElementById(`bounds-${blockId}`);
            if (bounds) return bounds.getBoundingClientRect();
            
            const hoverArea = document.getElementById(`hover-area-${blockId}`);
            if (hoverArea) return hoverArea.getBoundingClientRect();
            
            return null;
        }
        
        const specialGroups = {
            icons: 'icons-group',
            claim: 'claim-group'
        };
        
        const specialGroupId = specialGroups[blockId];
        if (specialGroupId) {
            const specialGroup = document.getElementById(specialGroupId);
            if (specialGroup?.boundsElement) {
                return specialGroup.boundsElement.getBoundingClientRect();
            }
            if (specialGroup) {
                return specialGroup.getBoundingClientRect();
            }
        }
        
        const graphicsGroup = document.getElementById(`graphics-group-${blockId}`);
        if (graphicsGroup?.boundsElement) {
            return graphicsGroup.boundsElement.getBoundingClientRect();
        }
        if (graphicsGroup) {
            return graphicsGroup.getBoundingClientRect();
        }
        
        const fallback = document.querySelector(`[data-block-id="${blockId}"]`);
        if (fallback) {
            return fallback.getBoundingClientRect();
        }
        
        return null;
    }
    
    // Draw claim block on canvas
    drawClaimBlock(container, frontX, frontY, frontWidth, frontHeight, scale) {
        const gridColor = this.getContrastColor();
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        
        const block = this.claimBlock;
        
        // Calculate height in mm based on modules
        const heightInMm = module * block.heightInModules;
        
        // Calculate width maintaining aspect ratio
        const aspectRatio = block.originalWidth / block.originalHeight;
        const widthInMm = heightInMm * aspectRatio;
        
        // Calculate position
        const position = this.calculateBlockPosition(block, scale);
        const claimX = frontX + position.x;
        const topMargin = module * margins * scale;
        const claimY = frontY + position.y + topMargin;
        
        // Scale dimensions
        const scaledWidth = widthInMm * scale;
        const scaledHeight = heightInMm * scale;
        
        // Create group for claim
        const claimGroup = this.createSVGElement('g', {
            id: 'claim-group',
            style: 'cursor: move;',
            'data-block-id': 'claim'
        }, container);
        
        // Create bounds rectangle (initially hidden)
        const boundsRect = this.createSVGElement('rect', {
            x: claimX,
            y: claimY,
            width: scaledWidth,
            height: scaledHeight,
            fill: gridColor,
            'fill-opacity': '0',
            stroke: gridColor,
            'stroke-width': scale === 1 ? '0.5' : '1',
            'stroke-opacity': '0'
        }, claimGroup);
        claimGroup.boundsElement = boundsRect;
        
        // Create nested SVG for claim with correct viewBox
        const nestedSvg = this.createSVGElement('svg', {
            x: claimX,
            y: claimY,
            width: scaledWidth,
            height: scaledHeight,
            viewBox: `0 0 ${block.originalWidth} ${block.originalHeight}`,
            preserveAspectRatio: 'xMinYMin meet',
            style: `color: ${gridColor}; overflow: visible;`
        }, claimGroup);
        
        // Add SVG content (loaded from graphics/yf_claim.svg)
        nestedSvg.innerHTML = block.svgContent || '';
        
        // Attach event handlers similar to icons
        this.attachClaimBlockHandlers(claimGroup, block, frontX, frontY, scale);
    }
    
    // Draw graphics block for export (without event handlers)
    drawGraphicsBlockForExport(container, block, frontX, frontY, frontWidth, frontHeight, scale) {
        if (!block.svgContent) return;
        
        const gridColor = this.getContrastColor(); // Color depends on background
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        
        // Calculate dimensions based on sizeMode
        const sizeMode = block.sizeMode || 'height';
        const aspectRatio = block.originalWidth / block.originalHeight;
        let heightInMm, widthInMm;
        
        if (sizeMode === 'height') {
            heightInMm = module * (block.heightInModules || 3);
            widthInMm = heightInMm * aspectRatio;
        } else {
            // sizeMode === 'width'
            widthInMm = module * (block.widthInModules || 3);
            heightInMm = widthInMm / aspectRatio;
        }
        
        // Calculate position
        const columnWidth = (frontWidth / scale - module * margins * 2 - module * (this.settings.columnCount - 1)) / this.settings.columnCount;
        const gutter = module;
        const topMargin = module * margins * scale;
        
        const yInBaseline = this.getBlockY({
            row: block.row,
            baselineOffset: block.baselineOffset
        });
        
        // Calculate X position based on alignment
        const alignment = block.alignment || 'left';
        let graphicsX;
        
        // Calculate how many columns the graphic occupies
        const graphicsWidthInColumns = Math.ceil(widthInMm / (columnWidth + gutter));
        
        if (alignment === 'right') {
            // For right alignment: X indicates the left column of the area
            // Calculate the right edge of the rightmost column that graphic would occupy
            // Then offset left by graphic width to align the graphic's right edge with that column's right edge
            const areaRightColumn = block.x + graphicsWidthInColumns - 1; // Last column of the area
            const areaRightEdge = frontX + module * margins * scale + (areaRightColumn - 1) * (columnWidth * scale + gutter * scale) + columnWidth * scale;
            graphicsX = areaRightEdge - widthInMm * scale;
        } else {
            // Left alignment (default): position at the LEFT edge of the column
            graphicsX = frontX + module * margins * scale + (block.x - 1) * (columnWidth * scale + gutter * scale);
        }
        
        const graphicsY = frontY + yInBaseline * (module * scale) + topMargin;
        
        // Scale dimensions
        const scaledWidth = widthInMm * scale;
        const scaledHeight = heightInMm * scale;
        
        // Create nested SVG for graphics with correct viewBox
        const nestedSvg = this.createSVGElement('svg', {
            x: graphicsX,
            y: graphicsY,
            width: scaledWidth,
            height: scaledHeight,
            viewBox: `0 0 ${block.originalWidth} ${block.originalHeight}`,
            preserveAspectRatio: 'xMinYMin meet',
            style: `color: ${gridColor}; overflow: visible;`
        }, container);
        
        // Add SVG content
        nestedSvg.innerHTML = block.svgContent;
        
        // Apply color to all elements with fill/stroke in the SVG
        this.applyColorToSVGElements(nestedSvg, gridColor);
    }
    
    // Draw icons block for export (without event handlers)
    drawIconsBlockForExport(container, frontX, frontY, frontWidth, frontHeight, scale) {
        const gridColor = this.getContrastColor(); // Color depends on background
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        
        const block = this.iconsBlock;
        
        // Calculate height in mm based on modules
        const heightInMm = module * block.heightInModules;
        
        // Calculate width maintaining aspect ratio
        const aspectRatio = block.originalWidth / block.originalHeight;
        const widthInMm = heightInMm * aspectRatio;
        
        // Calculate position
        const position = this.calculateBlockPosition(block, scale);
        const iconsX = frontX + position.x;
        const topMargin = module * margins * scale;
        const iconsY = frontY + position.y + topMargin;
        
        // Scale dimensions
        const scaledWidth = widthInMm * scale;
        const scaledHeight = heightInMm * scale;
        
        // Create nested SVG for icons with correct viewBox
        const nestedSvg = this.createSVGElement('svg', {
            x: iconsX,
            y: iconsY,
            width: scaledWidth,
            height: scaledHeight,
            viewBox: `0 0 ${block.originalWidth} ${block.originalHeight}`,
            preserveAspectRatio: 'xMinYMin meet',
            style: `color: ${gridColor}; overflow: visible;`
        }, container);
        
        // Add SVG content (loaded from graphics/icons.svg)
        nestedSvg.innerHTML = block.svgContent || '';
        
        // Apply color to all elements with fill/stroke in the SVG
        this.applyColorToSVGElements(nestedSvg, gridColor);
    }
    
    // Draw claim block for export (without event handlers)
    drawClaimBlockForExport(container, frontX, frontY, frontWidth, frontHeight, scale) {
        const gridColor = this.getContrastColor(); // Color depends on background
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        
        const block = this.claimBlock;
        
        // Calculate height in mm based on modules
        const heightInMm = module * block.heightInModules;
        
        // Calculate width maintaining aspect ratio
        const aspectRatio = block.originalWidth / block.originalHeight;
        const widthInMm = heightInMm * aspectRatio;
        
        // Calculate position
        const position = this.calculateBlockPosition(block, scale);
        const claimX = frontX + position.x;
        const topMargin = module * margins * scale;
        const claimY = frontY + position.y + topMargin;
        
        // Scale dimensions
        const scaledWidth = widthInMm * scale;
        const scaledHeight = heightInMm * scale;
        
        // Create nested SVG for claim with correct viewBox
        const nestedSvg = this.createSVGElement('svg', {
            x: claimX,
            y: claimY,
            width: scaledWidth,
            height: scaledHeight,
            viewBox: `0 0 ${block.originalWidth} ${block.originalHeight}`,
            preserveAspectRatio: 'xMinYMin meet',
            style: `color: ${gridColor}; overflow: visible;`
        }, container);
        
        // Add SVG content (loaded from graphics/yf_claim.svg)
        nestedSvg.innerHTML = block.svgContent || '';
        
        // Apply color to all elements with fill/stroke in the SVG
        this.applyColorToSVGElements(nestedSvg, gridColor);
    }
    
    // Apply color to SVG elements (for export)
    // Replaces fill/stroke colors in SVG elements to match background contrast
    applyColorToSVGElements(svgElement, color) {
        // First, update style elements to replace CSS color definitions
        const styleElements = svgElement.querySelectorAll('style');
        styleElements.forEach(styleEl => {
            let styleText = styleEl.textContent || styleEl.innerHTML;
            // Replace fill colors in CSS rules (handles .st0 { fill: #fff; } etc.)
            styleText = styleText.replace(/fill:\s*#fff(fff)?/gi, `fill: ${color}`);
            styleText = styleText.replace(/fill:\s*white/gi, `fill: ${color}`);
            styleText = styleText.replace(/fill:\s*#000(000)?/gi, `fill: ${color}`);
            styleText = styleText.replace(/fill:\s*black/gi, `fill: ${color}`);
            // Replace stroke colors in CSS rules
            styleText = styleText.replace(/stroke:\s*#fff(fff)?/gi, `stroke: ${color}`);
            styleText = styleText.replace(/stroke:\s*white/gi, `stroke: ${color}`);
            styleText = styleText.replace(/stroke:\s*#000(000)?/gi, `stroke: ${color}`);
            styleText = styleText.replace(/stroke:\s*black/gi, `stroke: ${color}`);
            
            if (styleEl.textContent !== undefined) {
                styleEl.textContent = styleText;
            } else {
                styleEl.innerHTML = styleText;
            }
        });
        
        // Then, update all elements with fill or stroke attributes
        const allElements = svgElement.querySelectorAll('*');
        
        allElements.forEach(element => {
            // Check if element has fill attribute
            const fill = element.getAttribute('fill');
            if (fill && fill !== 'none' && fill !== 'transparent') {
                // Replace white (#fff, #ffffff, white) or black (#000, #000000, black) with contrast color
                const fillLower = fill.toLowerCase().trim();
                if (fillLower === '#fff' || fillLower === '#ffffff' || fillLower === 'white' ||
                    fillLower === '#000' || fillLower === '#000000' || fillLower === 'black') {
                    element.setAttribute('fill', color);
                }
            }
            
            // Check if element has stroke attribute
            const stroke = element.getAttribute('stroke');
            if (stroke && stroke !== 'none' && stroke !== 'transparent') {
                const strokeLower = stroke.toLowerCase().trim();
                if (strokeLower === '#fff' || strokeLower === '#ffffff' || strokeLower === 'white' ||
                    strokeLower === '#000' || strokeLower === '#000000' || strokeLower === 'black') {
                    element.setAttribute('stroke', color);
                }
            }
        });
    }
    
    // Attach event handlers for icons block (click, hover, drag)
    attachIconsBlockHandlers(iconsGroup, block, frontX, frontY, scale) {
        let mouseDownTime = 0;
        let mouseDownX = 0;
        let mouseDownY = 0;
        
        iconsGroup.addEventListener('mousedown', (e) => {
            mouseDownTime = Date.now();
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            
            // Start dragging
            this.textDragState.isDragging = true;
            this.textDragState.blockId = block.id;
            this.textDragState.startMouseX = e.clientX;
            this.textDragState.startMouseY = e.clientY;
            this.textDragState.startBlockX = block.x;
            this.textDragState.startBlockY = this.getBlockY(block);
            this.textDragState.frontX = frontX;
            this.textDragState.frontY = frontY;
            this.textDragState.scale = scale;
            
            // Show bounds during drag
            if (iconsGroup.boundsElement) {
                iconsGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                iconsGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
            
            const mouseMoveHandler = (e) => {
                if (!this.textDragState.isDragging) return;
                
                const dx = e.clientX - this.textDragState.startMouseX;
                const dy = e.clientY - this.textDragState.startMouseY;
                
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                const columnCount = this.settings.columnCount;
                
                // Calculate column width
                const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount;
                const gutter = module;
                
                // Convert pixel movement to grid units
                const effectiveScale = scale;
                const columnWithGutter = (columnWidth + gutter) * effectiveScale;
                const moduleScaled = module * effectiveScale;
                
                const newX = Math.round((this.textDragState.startBlockX * columnWithGutter + dx) / columnWithGutter);
                let newY = Math.round((this.textDragState.startBlockY * moduleScaled + dy) / moduleScaled);
                
                // Calculate icon width considering aspect ratio
                const heightInMm = module * block.heightInModules;
                const aspectRatio = block.originalWidth / block.originalHeight;
                const widthInMm = heightInMm * aspectRatio;
                
                // Calculate content area width and check if icon fits
                const contentWidthMm = this.settings.frontWidth - 2 * margins * module;
                
                // Calculate position in mm and check right boundary
                const columnWidthMm = (contentWidthMm - (columnCount - 1) * module) / columnCount;
                // newX начинается с 1, поэтому вычитаем 1 для расчета физической позиции
                const xPositionMm = (newX - 1) * (columnWidthMm + module);
                const rightEdgeMm = xPositionMm + widthInMm;
                
                // Constrain X so icon doesn't exceed right margin
                let constrainedX = newX;
                if (rightEdgeMm > contentWidthMm) {
                    // Calculate max X position where icon fits
                    const maxPositionMm = contentWidthMm - widthInMm;
                    constrainedX = Math.floor(maxPositionMm / (columnWidthMm + module)) + 1;
                }
                constrainedX = Math.max(1, constrainedX);
                
                // Calculate content area in baseline modules
                const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                const maxYInBaseline = Math.floor(contentHeightMm / module);
                
                // Constrain vertical position considering icon height
                const iconHeightModules = block.heightInModules;
                const maxY = maxYInBaseline - iconHeightModules;
                newY = Math.max(0, Math.min(newY, maxY));
                
                // Constrain to grid bounds
                block.x = constrainedX;
                
                const { row, baselineOffset } = this.yToRowBaseline(newY);
                block.row = Math.max(0, row);
                block.baselineOffset = Math.max(0, baselineOffset);
                
                // Update panel inputs if open
                if (this.dom.iconsPanel && this.dom.iconsPanel.classList.contains('active')) {
                    if (this.dom.iconsXInput) this.dom.iconsXInput.value = block.x;
                    if (this.dom.iconsRowInput) this.dom.iconsRowInput.value = block.row + 1;
                    if (this.dom.iconsBaselineInput) {
                        const globalBaseline = this.rowBaselineToY(block.row, block.baselineOffset);
                        this.dom.iconsBaselineInput.value = globalBaseline + 1;
                    }
                }
                
                this.updateGrid();
            };
            
            const mouseUpHandler = () => {
                this.textDragState.isDragging = false;
                
                // Check if it was a click (not a drag)
                const timeDiff = Date.now() - mouseDownTime;
                const distance = Math.sqrt(
                    Math.pow(e.clientX - mouseDownX, 2) + 
                    Math.pow(e.clientY - mouseDownY, 2)
                );
                
                // Более щедрые условия для клика: 300мс и 10px
                if (timeDiff < 300 && distance < 10) {
                    // It's a click - open settings panel (same as user graphics)
                    this.showGraphicsEditPanel('icons');
                }
                
                // Hide bounds after drag
                if (iconsGroup.boundsElement) {
                    iconsGroup.boundsElement.setAttribute('stroke-opacity', '0');
                    iconsGroup.boundsElement.setAttribute('fill-opacity', '0');
                }
                
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
        
        // Hover handlers для показа границ
        iconsGroup.addEventListener('mouseenter', () => {
            if (iconsGroup.boundsElement && !this.textDragState.isDragging) {
                iconsGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                iconsGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
        });
        
        iconsGroup.addEventListener('mouseleave', () => {
            if (iconsGroup.boundsElement && !this.textDragState.isDragging) {
                iconsGroup.boundsElement.setAttribute('stroke-opacity', '0');
                iconsGroup.boundsElement.setAttribute('fill-opacity', '0');
            }
        });
    }
    
    // Attach event handlers for claim block (click, hover, drag)
    attachClaimBlockHandlers(claimGroup, block, frontX, frontY, scale) {
        let mouseDownTime = 0;
        let mouseDownX = 0;
        let mouseDownY = 0;
        
        claimGroup.addEventListener('mousedown', (e) => {
            mouseDownTime = Date.now();
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            
            // Start dragging
            this.textDragState.isDragging = true;
            this.textDragState.blockId = block.id;
            this.textDragState.startMouseX = e.clientX;
            this.textDragState.startMouseY = e.clientY;
            this.textDragState.startBlockX = block.x;
            this.textDragState.startBlockY = this.getBlockY(block);
            this.textDragState.frontX = frontX;
            this.textDragState.frontY = frontY;
            this.textDragState.scale = scale;
            
            // Show bounds during drag
            if (claimGroup.boundsElement) {
                claimGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                claimGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
            
            const mouseMoveHandler = (e) => {
                if (!this.textDragState.isDragging) return;
                
                const dx = e.clientX - this.textDragState.startMouseX;
                const dy = e.clientY - this.textDragState.startMouseY;
                
                const module = this.settings.gridModule;
                const margins = this.settings.margins;
                const columnCount = this.settings.columnCount;
                
                // Calculate column width
                const columnWidth = (this.settings.frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount;
                const gutter = module;
                
                // Convert pixel movement to grid units
                const effectiveScale = scale;
                const columnWithGutter = (columnWidth + gutter) * effectiveScale;
                const moduleScaled = module * effectiveScale;
                
                const newX = Math.round((this.textDragState.startBlockX * columnWithGutter + dx) / columnWithGutter);
                let newY = Math.round((this.textDragState.startBlockY * moduleScaled + dy) / moduleScaled);
                
                // Calculate claim width considering aspect ratio
                const heightInMm = module * block.heightInModules;
                const aspectRatio = block.originalWidth / block.originalHeight;
                const widthInMm = heightInMm * aspectRatio;
                
                // Calculate content area width and check if claim fits
                const contentWidthMm = this.settings.frontWidth - 2 * margins * module;
                
                // Calculate position in mm and check right boundary
                const columnWidthMm = (contentWidthMm - (columnCount - 1) * module) / columnCount;
                // newX начинается с 1, поэтому вычитаем 1 для расчета физической позиции
                const xPositionMm = (newX - 1) * (columnWidthMm + module);
                const rightEdgeMm = xPositionMm + widthInMm;
                
                // Constrain X so claim doesn't exceed right margin
                let constrainedX = newX;
                if (rightEdgeMm > contentWidthMm) {
                    // Calculate max X position where claim fits
                    const maxPositionMm = contentWidthMm - widthInMm;
                    constrainedX = Math.floor(maxPositionMm / (columnWidthMm + module)) + 1;
                }
                constrainedX = Math.max(1, constrainedX);
                
                // Calculate content area in baseline modules
                const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
                const maxYInBaseline = Math.floor(contentHeightMm / module);
                
                // Constrain vertical position considering claim height
                const claimHeightModules = block.heightInModules;
                const maxY = maxYInBaseline - claimHeightModules;
                newY = Math.max(0, Math.min(newY, maxY));
                
                // Constrain to grid bounds
                block.x = constrainedX;
                
                const { row, baselineOffset } = this.yToRowBaseline(newY);
                block.row = Math.max(0, row);
                block.baselineOffset = Math.max(0, baselineOffset);
                
                // Update panel inputs if open
                if (this.dom.claimPanel && this.dom.claimPanel.classList.contains('active')) {
                    if (this.dom.claimXInput) this.dom.claimXInput.value = block.x;
                    if (this.dom.claimRowInput) this.dom.claimRowInput.value = block.row + 1;
                    if (this.dom.claimBaselineInput) {
                        const globalBaseline = this.rowBaselineToY(block.row, block.baselineOffset);
                        this.dom.claimBaselineInput.value = globalBaseline + 1;
                    }
                }
                
                this.updateGrid();
            };
            
            const mouseUpHandler = (e) => {
                this.textDragState.isDragging = false;
                
                // Check if it was a click (not a drag)
                const timeDiff = Date.now() - mouseDownTime;
                const distance = Math.sqrt(
                    Math.pow(e.clientX - mouseDownX, 2) + 
                    Math.pow(e.clientY - mouseDownY, 2)
                );
                
                // Более щедрые условия для клика: 300мс и 10px
                if (timeDiff < 300 && distance < 10) {
                    // It's a click - open settings panel (same as user graphics)
                    this.showGraphicsEditPanel('claim');
                }
                
                // Hide bounds after drag
                if (claimGroup.boundsElement) {
                    claimGroup.boundsElement.setAttribute('stroke-opacity', '0');
                    claimGroup.boundsElement.setAttribute('fill-opacity', '0');
                }
                
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
        
        // Hover handlers для показа границ
        claimGroup.addEventListener('mouseenter', () => {
            if (claimGroup.boundsElement && !this.textDragState.isDragging) {
                claimGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                claimGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
        });
        
        claimGroup.addEventListener('mouseleave', () => {
            if (claimGroup.boundsElement && !this.textDragState.isDragging) {
                claimGroup.boundsElement.setAttribute('stroke-opacity', '0');
                claimGroup.boundsElement.setAttribute('fill-opacity', '0');
            }
        });
    }
    
    // Load SVG files from graphics folder (works only over HTTP, not file://)
    // This function MUST be called to load SVG content for icons and claim
    async initializeBuiltInGraphics() {
        // Load icons.svg from graphics folder
        try {
            const iconsData = await this.loadAndProcessSvg('graphics/icons.svg');
            if (iconsData) {
                const iconsBlock = this.graphicsBlocks.find(b => b.id === 'icons');
                if (iconsBlock) {
                    iconsBlock.originalWidth = iconsData.width;
                    iconsBlock.originalHeight = iconsData.height;
                    // Always update SVG content from file
                    if (iconsData.content) {
                        iconsBlock.svgContent = iconsData.content;
                        console.log(`Icons loaded from graphics/icons.svg: ${iconsData.width} × ${iconsData.height}`);
                    } else {
                        console.warn('Icons SVG content is empty after loading');
                    }
                }
            } else {
                console.error('Failed to load icons.svg - file not found or empty');
            }
        } catch (e) {
            console.error('Error loading icons.svg:', e);
            // Try to show error to user
            const iconsBlock = this.graphicsBlocks.find(b => b.id === 'icons');
            if (iconsBlock && !iconsBlock.svgContent) {
                console.error('Icons block has no SVG content - file graphics/icons.svg must be loaded');
            }
        }
        
        // Load yf_claim.svg from graphics folder
        try {
            const claimData = await this.loadAndProcessSvg('graphics/yf_claim.svg');
            if (claimData) {
                const claimBlock = this.graphicsBlocks.find(b => b.id === 'claim');
                if (claimBlock) {
                    claimBlock.originalWidth = claimData.width;
                    claimBlock.originalHeight = claimData.height;
                    // Always update SVG content from file
                    if (claimData.content) {
                        claimBlock.svgContent = claimData.content;
                        console.log(`Claim loaded from graphics/yf_claim.svg: ${claimData.width} × ${claimData.height}`);
                    } else {
                        console.warn('Claim SVG content is empty after loading');
                    }
                }
            } else {
                console.error('Failed to load yf_claim.svg - file not found or empty');
            }
        } catch (e) {
            console.error('Error loading yf_claim.svg:', e);
            // Try to show error to user
            const claimBlock = this.graphicsBlocks.find(b => b.id === 'claim');
            if (claimBlock && !claimBlock.svgContent) {
                console.error('Claim block has no SVG content - file graphics/yf_claim.svg must be loaded');
            }
        }
        
        // Update positions after dimensions are loaded (or use existing)
        this.updateBuiltInGraphicsPositions();
        
        // ============================================
        // Итерация 6: Инициализация Elements менеджеров
        // ============================================
        // Инициализируем менеджеры после загрузки встроенной графики
        this.initElementsManagers();
        
        // Update navigator and redraw grid
        this.updateElementsNavigator();
        this.updateGrid();
    }
    
    // Update positions for built-in graphics (Icons and Claim) - they go to last baseline
    updateBuiltInGraphicsPositions() {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const frontHeight = this.settings.frontHeight;
        
        // Calculate total available height in modules (excluding margins)
        const contentHeight = frontHeight - (margins * 2 * module);
        const totalModules = Math.floor(contentHeight / module);
        
        // Update positions for all built-in graphics
        this.graphicsBlocks.forEach(block => {
            if (block.isBuiltIn) {
                // Position at last baseline - block height
                const lastBaselineY = totalModules - block.heightInModules;
                
                // Convert to row and baseline offset
                const rowHeight = this.settings.rowHeight;
                const { row, baselineOffset } = this.yToRowBaseline(lastBaselineY);
                
                block.row = row;
                block.baselineOffset = baselineOffset;
            }
        });
    }
    
    // УДАЛЕНО: showIconsPanel, closeIconsPanel, showClaimPanel, closeClaimPanel
    // Icons и Claim теперь используют единую функцию showGraphicsEditPanel()
    // и хранятся в общем массиве graphicsBlocks с флагом isBuiltIn: true
    
    // Initialize Elements Navigator
    initElementsNavigator() {
        this.updateElementsNavigator();
        
        // Add Text button handler
        if (this.dom.addTextBtn) {
            this.dom.addTextBtn.addEventListener('click', () => {
                this.addTextBlock();
            });
        }
        
        // Add Graphics button handler
        if (this.dom.addGraphicsBtn) {
            this.dom.addGraphicsBtn.addEventListener('click', () => {
                this.showGraphicsPanel();
            });
        }
    }
    
    // Update Elements Navigator with current elements
    updateElementsNavigator() {
        if (!this.dom.elementsList) return;
        
        // ============================================
        // Итерация 6: Временно используем старый код
        // ElementsNavigator будет доработан позже для полной интеграции
        // ============================================
        // Clear existing items
        this.dom.elementsList.innerHTML = '';
        
        // Add text blocks
        this.textBlocks.forEach(block => {
            // Получаем имя из контента без ограничения (обрезка будет в CSS)
            let displayName = block.content.trim();
            // Если текст пустой, используем стандартное имя с начертанием
            if (!displayName) {
                const fontWeight = this.getStyleFontWeight(block.styleRef);
                const blockNumber = this.getBlockNumber(block.id);
                const formattedNumber = blockNumber.toString().padStart(2, '0');
                displayName = `${fontWeight} ${formattedNumber}`;
            }
            
            // Создаем элемент (передаем реальное состояние видимости)
            const isVisible = block.visible !== false;
            this.createElementItem(displayName, 'text', block.id, isVisible, block.deleting);
        });
        
        // Add ALL graphics blocks (both custom and built-in)
        if (this.graphicsBlocks) {
            this.graphicsBlocks.forEach(block => {
                const displayName = block.name || 'Graphic';
                // Создаем элемент (передаем реальное состояние видимости)
                const isVisible = block.visible !== false;
                
                // Используем правильный тип для встроенных блоков
                // 'icons' для icons, 'claim' для claim, 'graphics' для кастомных
                let elementType = 'graphics';
                if (block.isBuiltIn) {
                    if (block.id === 'icons') elementType = 'icons';
                    else if (block.id === 'claim') elementType = 'claim';
                }
                
                this.createElementItem(displayName, elementType, block.id, isVisible, block.deleting);
            });
        }
        
        // Update panel params (for Objects count)
        this.updatePanelParams();
    }
    
    // Add hover handlers for objects to highlight corresponding buttons in Objects panel
    addObjectHoverHandlers() {
        // Find all SVG groups that represent objects (text blocks, graphics, icons, claim)
        const svg = this.dom.svg;
        if (!svg) return;
        
        // Find all elements with data-block-id attribute
        const objectElements = svg.querySelectorAll('[data-block-id]');
        
        objectElements.forEach(element => {
            const blockId = element.getAttribute('data-block-id');
            
            // Add mouseenter handler
            element.addEventListener('mouseenter', () => {
                // Find corresponding button in Objects panel
                const button = this.dom.elementsList?.querySelector(`[data-element-id="${blockId}"]`);
                if (button) {
                    button.classList.add('hover-from-canvas');
                }
            });
            
            // Add mouseleave handler
            element.addEventListener('mouseleave', () => {
                // Remove hover class from button
                const button = this.dom.elementsList?.querySelector(`[data-element-id="${blockId}"]`);
                if (button) {
                    button.classList.remove('hover-from-canvas');
                }
            });
        });
    }
    
    // Create element item with actions (visibility and delete)
    createElementItem(name, type, blockId, isVisible, isDeleting = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'element-item-wrapper';
        
        // Если элемент в состоянии удаления, добавляем класс и особое оформление
        if (isDeleting) {
            wrapper.classList.add('deleting');
        }
            
        const button = document.createElement('button');
        button.className = 'element-item';
        button.dataset.elementType = type;
        if (blockId) button.dataset.elementId = blockId;
        
        // Add hidden class if element is not visible
        if (!isDeleting && !isVisible) {
            button.classList.add('hidden');
        }
        
        // Text span
        const textSpan = document.createElement('span');
        textSpan.className = 'element-item-text';
        textSpan.textContent = isDeleting ? 'Undo' : name;
        button.appendChild(textSpan);
        
        // Если в режиме удаления, добавляем обработчик для Undo
        if (isDeleting) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Отменяем таймер удаления
                const timerKey = `${type}-${blockId}`;
                if (this.deletionTimers[timerKey]) {
                    console.log(`[UNDO] Cancelling timer for ${timerKey}`);
                    clearTimeout(this.deletionTimers[timerKey]);
                    delete this.deletionTimers[timerKey];
                }
                
                // Снимаем флаг удаления
                if (type === 'text' && blockId) {
                    const block = this.textBlocks.find(b => b.id === blockId);
                    if (block) {
                        delete block.deleting;
                    }
                } else if ((type === 'graphics' || type === 'icons' || type === 'claim') && blockId) {
                    const block = this.getGraphicsBlock(blockId);
                    if (block) {
                        delete block.deleting;
                    }
                }
                // Обновляем UI
                this.updateGrid();
            });
        }
        
        // Если НЕ в режиме удаления, показываем иконки действий
        if (!isDeleting) {
            // Actions container
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'element-actions';
            
            // Visibility toggle button
            const visibilityBtn = document.createElement('button');
            visibilityBtn.className = 'element-action-btn';
            const visIcon = document.createElement('span');
            visIcon.className = 'element-action-icon';
            // SVG eye icon
            visIcon.innerHTML = isVisible 
                ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/></svg>'
                : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
            visibilityBtn.appendChild(visIcon);
            visibilityBtn.title = isVisible ? 'Hide' : 'Show';
            visibilityBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleElementVisibility(type, blockId);
            });
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'element-action-btn';
            const delIcon = document.createElement('span');
            delIcon.className = 'element-action-icon';
            delIcon.textContent = '×';
            deleteBtn.appendChild(delIcon);
            deleteBtn.title = 'Delete';
            deleteBtn.dataset.elementType = type;
            if (blockId) deleteBtn.dataset.elementId = blockId;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startDeleteElement(deleteBtn, type, blockId, name);
            });
            
            actionsDiv.appendChild(visibilityBtn);
            actionsDiv.appendChild(deleteBtn);
            button.appendChild(actionsDiv);
            
            // Click handler for the main button (только если НЕ в режиме удаления)
            button.addEventListener('click', (e) => {
                // Не срабатывать при клике на иконки действий
                if (e.target.closest('.element-action-btn')) {
                    return;
                }
                this.selectElement(type, blockId);
            });
            
            // Hover handlers (только если НЕ в режиме удаления)
            button.addEventListener('mouseenter', () => {
                this.showElementBounds(type, blockId);
            });
            
            button.addEventListener('mouseleave', () => {
                this.hideElementBounds(type, blockId);
            });
        }
        
        wrapper.appendChild(button);
        this.dom.elementsList.appendChild(wrapper);
    }
    
    // Toggle element visibility
    toggleElementVisibility(type, blockId) {
        if (type === 'text' && blockId) {
            const block = this.textBlocks.find(b => b.id === blockId);
            if (block) {
                block.visible = block.visible === false ? true : false;
                
                // Update UI element
                const button = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                if (button) {
                    if (block.visible) {
                        button.classList.remove('hidden');
                    } else {
                        button.classList.add('hidden');
                    }
                    
                    // Update visibility button icon
                    const visibilityBtn = button.querySelector('.element-action-btn');
                    if (visibilityBtn) {
                        const visIcon = visibilityBtn.querySelector('.element-action-icon');
                        if (visIcon) {
                            visIcon.innerHTML = block.visible 
                                ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/></svg>'
                                : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
                        }
                        visibilityBtn.title = block.visible ? 'Hide' : 'Show';
                    }
                }
                
                this.updateGrid();
            }
        } else if ((type === 'graphics' || type === 'icons' || type === 'claim') && blockId) {
            // Unified handling for all graphics types (custom, icons, claim)
            const block = this.getGraphicsBlock(blockId);
            if (block) {
                block.visible = block.visible === false ? true : false;
                
                // Update UI element
                const button = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                if (button) {
                    if (block.visible) {
                        button.classList.remove('hidden');
                    } else {
                        button.classList.add('hidden');
                    }
                    
                    // Update visibility button icon
                    const visibilityBtn = button.querySelector('.element-action-btn');
                    if (visibilityBtn) {
                        const visIcon = visibilityBtn.querySelector('.element-action-icon');
                        if (visIcon) {
                            visIcon.innerHTML = block.visible 
                                ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/></svg>'
                                : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
                        }
                        visibilityBtn.title = block.visible ? 'Hide' : 'Show';
                    }
                }
                
                // Update grid to reflect visibility change
                this.updateGrid();
                
                // Update panel icon if this block's edit panel is open
                if (this.currentEditingGraphicsId === blockId) {
                    const panelHideBtn = document.getElementById('graphicsHideBtn');
                    if (panelHideBtn) {
                        const svg = panelHideBtn.querySelector('svg');
                        if (svg) {
                            if (block.visible) {
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                            } else {
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Start delete element with progress bar
    startDeleteElement(button, type, blockId, name) {
        // Save state before starting deletion
        this.saveState();
        
        // Создаем уникальный ключ для этого объекта
        const timerKey = `${type}-${blockId}`;
        
        // Если для этого объекта уже есть таймер удаления, отменяем его
        if (this.deletionTimers[timerKey]) {
            clearTimeout(this.deletionTimers[timerKey]);
            delete this.deletionTimers[timerKey];
        }
        
        // ПОМЕЧАЕМ ОБЪЕКТ КАК "УДАЛЯЮЩИЙСЯ" (не скрываем полностью)
        if (type === 'text' && blockId) {
            const block = this.textBlocks.find(b => b.id === blockId);
            if (block) {
                block.deleting = true;
            }
            // Закрываем панель настроек, если она была открыта
            if (this.currentEditingBlock && this.currentEditingBlock.id === blockId) {
                this.closeParagraphPanel();
            }
        } else if ((type === 'graphics' || type === 'icons' || type === 'claim') && blockId) {
            // Unified handling for all graphics types
            const block = this.getGraphicsBlock(blockId);
            if (block) {
                block.deleting = true;
            }
            // Закрываем панель настроек графики, если она была открыта
            if (this.currentEditingGraphicsId === blockId) {
                this.closeGraphicsPanel();
            }
        }
        
        // Обновляем сетку (объект скрыт с флагом deleting)
        this.updateGrid();
        
        // Таймер для окончательного удаления (3 секунды)
        const timerId = setTimeout(() => {
            console.log(`[DELETE] Timer expired for ${timerKey}, checking if still deleting...`);
            // Проверяем, что объект все еще помечен как deleting
            // (если пользователь нажал Undo, флаг будет удален)
            let stillDeleting = false;
            
            if (type === 'text' && blockId) {
                const block = this.textBlocks.find(b => b.id === blockId);
                stillDeleting = block?.deleting === true;
            } else if ((type === 'graphics' || type === 'icons' || type === 'claim') && blockId) {
                const block = this.getGraphicsBlock(blockId);
                stillDeleting = block?.deleting === true;
            }
            
            // Если флаг все еще установлен, окончательно удаляем
            if (stillDeleting) {
                console.log(`[DELETE] Object ${timerKey} is still deleting, removing permanently`);
                if (type === 'text' && blockId) {
                    const index = this.textBlocks.findIndex(b => b.id === blockId);
                    if (index !== -1) {
                        this.textBlocks.splice(index, 1);
                    }
                } else if ((type === 'graphics' || type === 'icons' || type === 'claim') && blockId) {
                    if (this.graphicsBlocks) {
                        const index = this.graphicsBlocks.findIndex(b => b.id === blockId);
                        if (index !== -1) {
                            // Allow deletion of all graphics blocks (including built-in)
                            this.graphicsBlocks.splice(index, 1);
                        }
                    }
                }
                
                // Обновляем UI после окончательного удаления
                this.updateGrid();
            } else {
                console.log(`[DELETE] Object ${timerKey} was restored, not deleting`);
            }
            
            // Удаляем таймер из хранилища
            delete this.deletionTimers[timerKey];
        }, 3000);
        
        // Сохраняем таймер для возможности отмены
        this.deletionTimers[timerKey] = timerId;
    }
    
    // Delete element
    deleteElement(type, blockId) {
        if (type === 'text' && blockId) {
            const index = this.textBlocks.findIndex(b => b.id === blockId);
            if (index !== -1) {
                this.textBlocks.splice(index, 1);
                this.updateElementsNavigator();
                this.updateGrid();
            }
        } else if ((type === 'graphics' || type === 'icons' || type === 'claim') && blockId) {
            // Unified handling for all graphics types
            const index = this.graphicsBlocks?.findIndex(b => b.id === blockId);
            if (index !== -1) {
                // Allow deletion of all graphics blocks (including built-in)
                this.graphicsBlocks.splice(index, 1);
                this.updateElementsNavigator();
                this.updateGrid();
            }
        }
    }
    
    // ============================================
    // Callbacks для ElementsNavigator (Итерация 6)
    // ============================================
    onElementSelect(type, id) {
        // Вызываем существующий метод selectElement
        this.selectElement(type, id);
    }
    
    onElementDelete(type, id) {
        // Вызываем существующий метод deleteElement
        this.deleteElement(type, id);
    }
    
    // Add new text block
    addTextBlock() {
        // Save state before adding
        this.saveState();
        
        // Создаем новый уникальный ID
        const newId = 'text-' + Date.now();
        
        // Создаем новый текстовый блок с дефолтным текстом
        const newBlock = {
            id: newId,
            content: 'Lunnen — бренд компьютерной техники, придуманный в Яндексе. Это спутник, с которым просто. Просто решать задачи. Создавать новое. И изучать неизведанное.',
            styleRef: 'text',
            x: 1,
            row: 0,
            baselineOffset: 0,
            width: 3,
            alignment: 'left',
            showBounds: false,
            visible: true,
            alignmentMode: 'baseline' // Default alignment mode
        };
        
        this.textBlocks.push(newBlock);
        this.updateElementsNavigator();
        this.updateGrid();
        
        // Открываем панель редактирования для нового блока
        setTimeout(() => {
            this.selectElement('text', newId);
        }, 100);
    }
    
    // Add new graphics block
    addGraphicsBlock(svgContent, name, originalWidth, originalHeight) {
        // Save state before adding
        this.saveState();
        
        if (!this.graphicsBlocks) {
            this.graphicsBlocks = [];
        }
        
        // Создаем новый уникальный ID
        const newId = 'graphics-' + Date.now();
        
        // Создаем новый графический блок
        const newBlock = {
            id: newId,
            name: name,
            isBuiltIn: false,  // Explicitly mark as custom (not built-in)
            svgContent: svgContent,
            heightInModules: 3,
            widthInModules: null,
            sizeMode: 'height',
            alignment: 'left',
            x: 1,
            row: 0,
            baselineOffset: 0,
            showBounds: false,
            visible: true,
            originalWidth: originalWidth,
            originalHeight: originalHeight,
            lockPosition: true  // Default to constrain to grid
        };
        
        this.graphicsBlocks.push(newBlock);
        this.updateElementsNavigator();
        this.updateGrid();
    }
    
    // Select and highlight element
    selectElement(type, blockId = null) {
        // Remove all active states
        const allButtons = this.dom.elementsList.querySelectorAll('.element-item');
        allButtons.forEach(btn => btn.classList.remove('active'));
        
        // Highlight selected element on canvas
        this.highlightElement(type, blockId);
        
        // Open appropriate settings panel
        if (type === 'text' && blockId) {
            this.showParagraphPanel(blockId);
            
            // Set active state on button
            const button = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
            if (button) button.classList.add('active');
        } else if (type === 'graphics') {
            // Graphics includes custom uploaded graphics, icons, and claim (all in graphicsBlocks array)
            // blockId can be string (like 'icons', 'claim') or null for built-in items
            const graphicsId = blockId || type; // Use type as ID if blockId is null (for built-in graphics)
            this.showGraphicsEditPanel(graphicsId);
            
            // Set active state on button
            const selector = blockId ? `[data-element-id="${blockId}"]` : `[data-element-type="${type}"]`;
            const button = this.dom.elementsList.querySelector(selector);
            if (button) button.classList.add('active');
        } else if (type === 'icons' || type === 'claim') {
            // Icons and Claim are now treated as graphics
            this.showGraphicsEditPanel(type);
            
            const button = this.dom.elementsList.querySelector(`[data-element-type="${type}"]`);
            if (button) button.classList.add('active');
        }
    }
    
    // Highlight element on canvas
    highlightElement(type, blockId = null) {
        // Remove all existing highlights
        const allBounds = document.querySelectorAll('[id^="bounds-"]');
        allBounds.forEach(bounds => {
            bounds.setAttribute('stroke-opacity', '0');
            bounds.setAttribute('fill-opacity', '0');
        });
        
        // Also check for graphics groups
        const allGraphicsGroups = document.querySelectorAll('[id^="graphics-group-"]');
        allGraphicsGroups.forEach(group => {
            if (group.boundsElement) {
                group.boundsElement.setAttribute('stroke-opacity', '0');
                group.boundsElement.setAttribute('fill-opacity', '0');
            }
        });
        
        // Highlight selected element
        if (type === 'text' && blockId) {
            const bounds = document.getElementById(`bounds-${blockId}`);
            if (bounds) {
                bounds.setAttribute('stroke-opacity', '0.8');
                bounds.setAttribute('fill-opacity', '0.1');
                
                // Auto-hide after 2 seconds
                setTimeout(() => {
                    bounds.setAttribute('stroke-opacity', '0');
                    bounds.setAttribute('fill-opacity', '0');
                }, 2000);
            }
        } else if (type === 'graphics' && blockId) {
            const graphicsGroup = document.getElementById(`graphics-group-${blockId}`);
            if (graphicsGroup && graphicsGroup.boundsElement) {
                graphicsGroup.boundsElement.setAttribute('stroke-opacity', '0.8');
                graphicsGroup.boundsElement.setAttribute('fill-opacity', '0.1');
                
                setTimeout(() => {
                    graphicsGroup.boundsElement.setAttribute('stroke-opacity', '0');
                    graphicsGroup.boundsElement.setAttribute('fill-opacity', '0');
                }, 2000);
            }
        } else if (type === 'icons') {
            const iconsGroup = document.getElementById('icons-group');
            if (iconsGroup && iconsGroup.boundsElement) {
                iconsGroup.boundsElement.setAttribute('stroke-opacity', '0.8');
                iconsGroup.boundsElement.setAttribute('fill-opacity', '0.1');
                
                setTimeout(() => {
                    iconsGroup.boundsElement.setAttribute('stroke-opacity', '0');
                    iconsGroup.boundsElement.setAttribute('fill-opacity', '0');
                }, 2000);
            }
        } else if (type === 'claim') {
            const claimGroup = document.getElementById('claim-group');
            if (claimGroup && claimGroup.boundsElement) {
                claimGroup.boundsElement.setAttribute('stroke-opacity', '0.8');
                claimGroup.boundsElement.setAttribute('fill-opacity', '0.1');
                
                setTimeout(() => {
                    claimGroup.boundsElement.setAttribute('stroke-opacity', '0');
                    claimGroup.boundsElement.setAttribute('fill-opacity', '0');
                }, 2000);
            }
        }
    }
    
    // Show element bounds on hover (from Objects panel)
    showElementBounds(type, blockId = null) {
        if (this.textDragState.isDragging) return;
        
        if (type === 'text' && blockId) {
            const bounds = document.getElementById(`bounds-${blockId}`);
            if (bounds) {
                bounds.setAttribute('stroke-opacity', '0.5');
                bounds.setAttribute('fill-opacity', '0.05');
            }
        } else if (type === 'graphics' && blockId) {
            const graphicsGroup = document.getElementById(`graphics-group-${blockId}`);
            if (graphicsGroup && graphicsGroup.boundsElement) {
                graphicsGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                graphicsGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
        } else if (type === 'icons') {
            const iconsGroup = document.getElementById('icons-group');
            if (iconsGroup && iconsGroup.boundsElement) {
                iconsGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                iconsGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
        } else if (type === 'claim') {
            const claimGroup = document.getElementById('claim-group');
            if (claimGroup && claimGroup.boundsElement) {
                claimGroup.boundsElement.setAttribute('stroke-opacity', '0.5');
                claimGroup.boundsElement.setAttribute('fill-opacity', '0.05');
            }
        }
    }
    
    // Hide element bounds on hover leave (from Objects panel)
    hideElementBounds(type, blockId = null) {
        if (this.textDragState.isDragging) return;
        
        if (type === 'text' && blockId) {
            const bounds = document.getElementById(`bounds-${blockId}`);
            if (bounds) {
                bounds.setAttribute('stroke-opacity', '0');
                bounds.setAttribute('fill-opacity', '0');
            }
        } else if (type === 'graphics' && blockId) {
            const graphicsGroup = document.getElementById(`graphics-group-${blockId}`);
            if (graphicsGroup && graphicsGroup.boundsElement) {
                graphicsGroup.boundsElement.setAttribute('stroke-opacity', '0');
                graphicsGroup.boundsElement.setAttribute('fill-opacity', '0');
            }
        } else if (type === 'icons') {
            const iconsGroup = document.getElementById('icons-group');
            if (iconsGroup && iconsGroup.boundsElement) {
                iconsGroup.boundsElement.setAttribute('stroke-opacity', '0');
                iconsGroup.boundsElement.setAttribute('fill-opacity', '0');
            }
        } else if (type === 'claim') {
            const claimGroup = document.getElementById('claim-group');
            if (claimGroup && claimGroup.boundsElement) {
                claimGroup.boundsElement.setAttribute('stroke-opacity', '0');
                claimGroup.boundsElement.setAttribute('fill-opacity', '0');
            }
        }
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
            const wrapped = this.wrapText(line, scaledTextWidth, fontSize, scale, this.settings.tracking);
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
                'stroke-width': scale === 1 ? '0.5' : '1'
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
            const wrapped = this.wrapText(line, scaledTextWidth, fontSize, scale, this.settings.textTracking);
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
                'stroke-width': scale === 1 ? '0.5' : '1'
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
        
        const effectiveScale = scale;
        const columnWithGutter = (columnWidth + gutter) * effectiveScale;
        const baselineUnit = module * effectiveScale;
        
        // Новая позиция в колонках
        let newX = startBlockX + Math.round(deltaX / columnWithGutter);
        
        // Новая позиция в baseline модулях
        const startY = this.rowBaselineToY(startBlockRow, startBlockBaselineOffset);
        const deltaYInBaseline = Math.round(deltaY / baselineUnit);
        let newY = startY + deltaYInBaseline;
        
        // Ограничиваем позицию, чтобы блок не выходил за пределы margins
        // Ограничение по X (колонки), x начинается с 1
        const alignment = block.alignment || 'left';
        if (alignment === 'right') {
            // For right-aligned: x is the column where right edge is anchored
            // Min: ceil(block.width) (block can't extend left beyond column 1)
            // Max: columnCount (right edge can be on any column)
            newX = Math.max(Math.ceil(block.width), Math.min(newX, columnCount));
        } else {
            // For left-aligned: x is the column where left edge is anchored
            // Последняя занятая колонка = x + width - 1, должна быть <= columnCount
            newX = Math.max(1, Math.min(newX, columnCount - block.width + 1));
        }
        
        // Ограничиваем Y: минимум 0 (не выходим за верхний margin)
        // Максимум - высота контента в baseline модулях минус высота текстового блока
        const contentHeightMm = this.settings.frontHeight - 2 * margins * module;
        const maxYInBaseline = Math.floor(contentHeightMm / module);
        const textBlockHeightInModules = this.getTextBlockHeightInModules(block);
        const maxY = maxYInBaseline - textBlockHeightInModules;
        newY = Math.max(0, Math.min(newY, maxY));
        
        // Конвертируем Y обратно в row + baselineOffset
        const { row, baselineOffset } = this.yToRowBaseline(newY);
        
        // Дополнительные проверки: row и baselineOffset не могут быть отрицательными
        const finalRow = Math.max(0, row);
        const finalBaselineOffset = Math.max(0, baselineOffset);
        
        // Обновляем позицию блока
        block.x = newX;
        block.row = finalRow;
        block.baselineOffset = finalBaselineOffset;
        
        // Если панель настроек открыта для этого блока, обновляем значения в полях
        if (this.currentEditingBlock && this.currentEditingBlock.id === block.id) {
            if (this.dom.paragraphXInput) {
                // Column всегда целое число
                this.dom.paragraphXInput.value = Math.round(block.x);
            }
            if (this.dom.paragraphRowInput) {
                this.dom.paragraphRowInput.value = block.row + 1;
            }
            if (this.dom.paragraphBaselineInput) {
                // Показываем глобальный номер baseline на всей сетке (с учетом гутеров)
                const globalBaseline = this.rowBaselineToY(block.row, block.baselineOffset);
                this.dom.paragraphBaselineInput.value = globalBaseline + 1;
            }
        }
        
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
        
        // Не сохраняем начальное состояние автоматически при перетаскивании
        // Изменения будут применены только при нажатии кнопки Apply
        
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
        // Constrain elements to grid bounds if lockPosition is enabled
        this.constrainElementsToBounds();
        
        // Сохраняем текущее состояние зума ПЕРЕД изменением SVG
        let savedZoom = null;
        let savedPanX = null;
        let savedPanY = null;
        if (this.zoomPanManager) {
            savedZoom = this.zoomPanManager.zoom;
            savedPanX = this.zoomPanManager.panX;
            savedPanY = this.zoomPanManager.panY;
        }
        
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
        // НЕ устанавливаем viewBox напрямую - это управляется ZoomPanManager
        // this.dom.svg.setAttribute('viewBox', `0 0 ${svgSize} ${svgSize}`);
        
        // Обновляем размеры в ZoomPanManager
        if (this.zoomPanManager) {
            this.zoomPanManager.reinitializeSVGDimensions();
        }
        
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
        
        // Draw labels if enabled (but default is false now)
        if (this.settings.showLabels) {
            this.drawLabels(this.dom.svg, startX, startY, scaledFrontWidth, scaledFrontHeight, scaledThickness);
        }
        
        // Draw grid elements on front panel
        const frontX = startX + scaledThickness;
        const frontY = startY + scaledThickness;
        
        // Draw columns if enabled
        if (this.settings.showColumns) {
            this.gridRenderer.drawColumns(this.dom.svg, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        }
        
        // Draw rows if enabled
        if (this.settings.showRows) {
            this.gridRenderer.drawRows(this.dom.svg, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
        }
        
        // Draw baseline if enabled
        if (this.settings.showBaseline) {
            this.gridRenderer.drawBaseline(this.dom.svg, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
            
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
        
        // Draw text blocks, icons and claim on front panel (if enabled)
        if (this.settings.showObjects) {
            // ============================================
            // Итерация 6: Временно используем старый код для browser view
            // Рендереры будут использоваться для экспорта в будущем
            // TODO: Доработать TextRenderer и GraphicsRenderer для полной поддержки интерактивности
            // ============================================
            
            // Draw text blocks on front panel (only visible and not deleting)
            this.textBlocks.forEach(block => {
                if (block.visible !== false && !block.deleting) {
                    this.drawTextBlock(this.dom.svg, block, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
                }
            });
            
            // Draw ALL graphics blocks (icons, claim, custom) on front panel
            if (this.graphicsBlocks) {
                this.graphicsBlocks.forEach(block => {
                    // Only draw if visible and not being deleted
                    if (block.visible !== false && !block.deleting) {
                        this.drawGraphicsBlock(this.dom.svg, block, frontX, frontY, scaledFrontWidth, scaledFrontHeight, scale);
                    }
                });
            }
        }
        
        // Add hover handlers for objects to highlight corresponding buttons in Objects panel
        this.addObjectHoverHandlers();
        
        // Update font size displays
        this.updateFontSizeDisplays();
        
        // Update elements navigator (which also updates panel params)
        this.updateElementsNavigator();
        
        // Восстанавливаем зум ПОСЛЕ обновления SVG
        if (this.zoomPanManager && savedZoom !== null) {
            this.zoomPanManager.zoom = savedZoom;
            this.zoomPanManager.panX = savedPanX;
            this.zoomPanManager.panY = savedPanY;
            this.zoomPanManager.updateTransform();
        }
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
        // Use ColorUtils for consistency with GridRenderer
        const bgColor = this.settings.boxColor;
        const luminance = ColorUtils.getLuminance(bgColor);
        
        // Store luminance for opacity calculation (if needed in future)
        this.currentLuminance = luminance;
        
        return ColorUtils.getContrastColor(bgColor);
    }
    
    getGridOpacity(baseOpacity) {
        // Always use the same opacity regardless of background brightness
        // Color switching (light/dark) is handled by getContrastColor()
        return baseOpacity;
    }
    
    drawColumnsVerticalLeftRight(container, x, y, width, height, scale, side) {
        // Left and right panels use rows parameters from front (rotated 90°)
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const n = this.settings.rowCount;
        const rowHeightInModules = this.settings.rowHeight;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.08);
        
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
        const opacity = this.getGridOpacity(0.08);
        
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
        const opacity = this.getGridOpacity(0.15);
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
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
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
                    'stroke-opacity': opacity,
                    'vector-effect': 'non-scaling-stroke'
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
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
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
                    'stroke-opacity': opacity,
                    'vector-effect': 'non-scaling-stroke'
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
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
            }, container);
        }
    }
    
    drawBaselineTopBottom(container, x, y, width, height, scale, side) {
        const module = this.settings.gridModule;
        const margins = this.settings.margins;
        const gridColor = this.getContrastColor();
        const opacity = this.getGridOpacity(0.15);
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
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
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
                    'stroke-opacity': opacity,
                    'vector-effect': 'non-scaling-stroke'
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
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
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
    
    // Итерация 7: Упрощенный экспорт SVG через SVGExporter
    async exportSVG() {
        const { frontWidth, frontHeight, thickness, gridModule, columnCount, rowCount } = this.settings;
        
        // Создаем SVG для экспорта (scale = 1 для точных размеров)
        const exportSvg = await this.createExportSVG();
        
        // Генерируем timestamp с точностью до минуты
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        
        // Генерируем имя файла: "размер с боковинами колонки строки модуль timestamp.svg"
        // Например: "500×500×50mm 12col 12rows 5.05mm 20251116_1430.svg"
        const size = `${frontWidth}×${frontHeight}×${thickness}mm`;
        const cols = `${columnCount}col`;
        const rows = `${rowCount}rows`;
        const module = `${gridModule.toFixed(2)}mm`;
        
        const filename = `${size} ${cols} ${rows} ${module} ${timestamp}.svg`;
        
        // Получаем значение тогла "Outline fonts"
        const convertToOutlines = this.dom.convertToOutlinesCheckbox ? this.dom.convertToOutlinesCheckbox.checked : false;
        
        // Экспортируем через модуль
        await this.svgExporter.exportToFile(exportSvg, filename, {
            removeInteractive: true,
            optimizeSize: true,
            convertTextToOutlines: convertToOutlines
        });
    }
    
    // Итерация 7: Создание SVG для экспорта (без интерактивных элементов)
    async createExportSVG() {
        const { frontWidth, frontHeight, thickness } = this.settings;
        
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
        
        // Create main grid group to hold all grid elements
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gridGroup.setAttribute('id', 'grid');
        exportSvg.appendChild(gridGroup);
        
        // Draw columns (in separate group, always export but hide if disabled)
        const columnsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        columnsGroup.setAttribute('id', 'columns');
        if (!this.settings.showColumns) {
            columnsGroup.setAttribute('visibility', 'hidden');
        }
        gridGroup.appendChild(columnsGroup);
        this.gridRenderer.drawColumns(columnsGroup, frontX, frontY, frontWidth, frontHeight, scale);
        
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
        
        // Draw rows (in separate group, always export but hide if disabled)
        const rowsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        rowsGroup.setAttribute('id', 'rows');
        if (!this.settings.showRows) {
            rowsGroup.setAttribute('visibility', 'hidden');
        }
        gridGroup.appendChild(rowsGroup);
        this.gridRenderer.drawRows(rowsGroup, frontX, frontY, frontWidth, frontHeight, scale);
        
        // Draw baseline (in separate group, always export but hide if disabled)
        const baselineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        baselineGroup.setAttribute('id', 'baseline');
        if (!this.settings.showBaseline) {
            baselineGroup.setAttribute('visibility', 'hidden');
        }
        gridGroup.appendChild(baselineGroup);
        
        // Front panel baseline
        this.gridRenderer.drawBaseline(baselineGroup, frontX, frontY, frontWidth, frontHeight, scale);
        
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
        
        // Add graphics blocks (in separate groups)
        if (this.graphicsBlocks) {
            this.graphicsBlocks.forEach(block => {
                if (block.visible !== false && block.svgContent) {
                    const graphicsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    // Use simple id for built-in blocks (icons, claim) without prefix
                    graphicsGroup.setAttribute('id', block.isBuiltIn ? block.id : `graphics-${block.id}`);
                    exportSvg.appendChild(graphicsGroup);
                    
                    // Draw graphics block
                    this.drawGraphicsBlockForExport(graphicsGroup, block, frontX, frontY, frontWidth, frontHeight, scale);
                }
            });
        }
        
        // Add text styles summary outside artboard (for reference in editor)
        this.addTextStylesSummary(exportSvg, totalWidth, scale);
        
        // Add design kit (logo and graphic elements) in multiple sizes outside artboard (for reference in editor)
        await this.addLunnenLogoReference(exportSvg, totalWidth, scale);
        
        return exportSvg;
    }
    
    /**
     * Добавить справку по текстовым стилям за пределами артборда
     */
    addTextStylesSummary(svg, artboardWidth, scale = 1) {
        // Позиция справа от артборда с отступом 20mm
        const summaryX = artboardWidth + 20;
        const summaryY = 10;
        const lineHeight = 5; // mm между строками
        
        // Создаем группу для справки
        const summaryGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        summaryGroup.setAttribute('id', 'text-styles-reference');
        summaryGroup.setAttribute('opacity', '0.7');
        
        // Получаем контрастный цвет для текста
        const textColor = this.getContrastColor();
        
        // Функция для создания строки текста
        const createTextLine = (content, x, y, fontSize = 3, fontWeight = 400) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x * scale);
            text.setAttribute('y', y * scale);
            text.setAttribute('font-family', 'TT Commons Classic, -apple-system, sans-serif');
            text.setAttribute('font-size', fontSize * scale);
            text.setAttribute('font-weight', fontWeight);
            text.setAttribute('fill', textColor);
            text.textContent = content;
            return text;
        };
        
        // Заголовок
        summaryGroup.appendChild(createTextLine('Text Styles', summaryX, summaryY, 4, 500));
        
        let currentY = summaryY + lineHeight * 1.5;
        
        // Получаем все текстовые стили и их параметры
        const styles = this.getTextStylesInfo();
        
        styles.forEach(style => {
            const line = `${style.name}  ${style.fontSize}/${style.lineHeight} pt`;
            summaryGroup.appendChild(createTextLine(line, summaryX, currentY, 3, 400));
            currentY += lineHeight;
        });
        
        svg.appendChild(summaryGroup);
    }
    
    /**
     * Получить информацию о всех текстовых стилях
     */
    getTextStylesInfo() {
        const { gridModule } = this.settings;
        const mmToPt = 2.83465; // 1mm = 2.83465pt
        
        const styles = [];
        
        // Headline
        const headlineSize = this.settings.headlineSize || 1;
        const headlineLineHeight = this.settings.lineHeight || 2;
        const headlineFontSize = this.calculateActualFontSize('headline', headlineSize);
        const headlineLineHeightPt = (headlineLineHeight * gridModule * mmToPt).toFixed(1);
        
        styles.push({
            name: 'Headline',
            fontSize: (headlineFontSize * mmToPt).toFixed(1),
            lineHeight: headlineLineHeightPt
        });
        
        // Text
        const textSize = this.settings.textSize || 1;
        const textLineHeight = this.settings.textLineHeight || 2;
        const textFontSize = this.calculateActualFontSize('text', textSize);
        const textLineHeightPt = (textLineHeight * gridModule * mmToPt).toFixed(1);
        
        styles.push({
            name: 'Text',
            fontSize: (textFontSize * mmToPt).toFixed(1),
            lineHeight: textLineHeightPt
        });
        
        // Caption
        const captionSize = this.settings.captionSize || 0.5;
        const captionLineHeight = this.settings.captionLineHeight || 1;
        const captionFontSize = this.calculateActualFontSize('caption', captionSize);
        const captionLineHeightPt = (captionLineHeight * gridModule * mmToPt).toFixed(1);
        
        styles.push({
            name: 'Caption',
            fontSize: (captionFontSize * mmToPt).toFixed(1),
            lineHeight: captionLineHeightPt
        });
        
        // Lunnen Display
        const lunnenSize = this.settings.lunnenDisplaySize || 3;
        const lunnenLineHeight = this.settings.lunnenDisplayLineHeight || 4;
        const lunnenFontSize = this.calculateActualFontSize('lunnenDisplay', lunnenSize);
        const lunnenLineHeightPt = (lunnenLineHeight * gridModule * mmToPt).toFixed(1);
        
        styles.push({
            name: 'Lunnen Display',
            fontSize: (lunnenFontSize * mmToPt).toFixed(1),
            lineHeight: lunnenLineHeightPt
        });
        
        return styles;
    }
    
    /**
     * Рассчитать реальный размер шрифта с учетом cap-height/x-height
     */
    calculateActualFontSize(styleRef, sizeInModules) {
        const { gridModule } = this.settings;
        const targetSize = gridModule * sizeInModules; // size in mm
        
        // Метрики шрифтов
        const fontMetrics = {
            capHeight: 630,
            xHeight: 447,
            unitsPerEm: 1000
        };
        
        // Определяем, какой стиль использует x-height
        let useXHeight = false;
        if (styleRef === 'headline') {
            useXHeight = this.settings.useXHeight !== false;
        } else if (styleRef === 'text') {
            useXHeight = this.settings.useXHeight2 !== false;
        } else if (styleRef === 'caption') {
            useXHeight = this.settings.useXHeightCaption !== false;
        }
        // Lunnen Display всегда использует cap-height
        
        // Calculate font size based on whether we're using cap height or x-height
        let fontSize;
        if (useXHeight) {
            fontSize = targetSize * (fontMetrics.unitsPerEm / fontMetrics.xHeight);
        } else {
            fontSize = targetSize * (fontMetrics.unitsPerEm / fontMetrics.capHeight);
        }
        
        return fontSize; // in mm
    }
    
    /**
     * Добавить дизайн-кит (логотип и графические элементы) в нескольких размерах за пределами артборда
     */
    async addLunnenLogoReference(svg, artboardWidth, scale = 1) {
        try {
            const { gridModule } = this.settings;
            
            // Список всех графических элементов для дизайн-кита
            const graphicElements = [
                { file: 'lunnen_logo.svg', name: 'Lunnen Logo' },
                { file: '1.svg', name: '1' },
                { file: '2.svg', name: '2' },
                { file: '3.svg', name: '3' },
                { file: 'icons.svg', name: 'Icons' },
                { file: 'l_sign.svg', name: 'L Sign' },
                { file: 'qr_lunnen.pro.svg', name: 'QR' },
                { file: 'yf_claim.svg', name: 'YF Claim' }
            ];
            
            // Позиция под справкой по текстовым стилям
            const startX = artboardWidth + 20;
            let currentY = 40; // Под Text Styles
            const verticalGap = 3; // mm между элементами
            const sectionGap = 10; // mm между разными графическими элементами
            
            // Размеры в модулях (от большего к меньшему)
            const sizes = [6, 5, 4, 3, 2, 1];
            
            // Создаем группу для всего дизайн-кита
            const designKitGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            designKitGroup.setAttribute('id', 'design-kit-reference');
            designKitGroup.setAttribute('opacity', '0.7');
            
            // Получаем контрастный цвет для текста
            const textColor = this.getContrastColor();
            
            // Проходим по каждому графическому элементу
            for (const element of graphicElements) {
                // Загружаем SVG элемента
                const response = await fetch(`graphics/${element.file}`);
                if (!response.ok) {
                    console.warn(`Failed to load ${element.file}`);
                    continue;
                }
                
                const svgText = await response.text();
                
                // Парсим SVG
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgElement = svgDoc.querySelector('svg');
                
                if (!svgElement) {
                    console.warn(`Invalid SVG structure for ${element.file}`);
                    continue;
                }
                
                // Получаем оригинальные размеры из viewBox
                const viewBox = svgElement.getAttribute('viewBox');
                const [, , originalWidth, originalHeight] = viewBox.split(' ').map(Number);
                const aspectRatio = originalWidth / originalHeight;
                
                // Добавляем заголовок секции
                const sectionTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                sectionTitle.setAttribute('x', startX * scale);
                sectionTitle.setAttribute('y', currentY * scale);
                sectionTitle.setAttribute('font-family', 'TT Commons Classic, -apple-system, sans-serif');
                sectionTitle.setAttribute('font-size', 4 * scale);
                sectionTitle.setAttribute('font-weight', 500);
                sectionTitle.setAttribute('fill', textColor);
                sectionTitle.setAttribute('dominant-baseline', 'hanging');
                sectionTitle.textContent = element.name;
                
                designKitGroup.appendChild(sectionTitle);
                
                currentY += 6; // Отступ после заголовка
                
                // Рендерим элемент в разных размерах
                sizes.forEach(heightInModules => {
                    // Вычисляем размеры
                    const heightInMm = gridModule * heightInModules;
                    const widthInMm = heightInMm * aspectRatio;
                    
                    // Создаем группу для этого экземпляра
                    const instanceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    instanceGroup.setAttribute('transform', `translate(${startX * scale}, ${currentY * scale}) scale(${(heightInMm / originalHeight) * scale})`);
                    
                    // Копируем все содержимое SVG (включая defs, если есть)
                    Array.from(svgElement.children).forEach(child => {
                        const clonedChild = child.cloneNode(true);
                        instanceGroup.appendChild(clonedChild);
                    });
                    
                    designKitGroup.appendChild(instanceGroup);
                    
                    // Добавляем подпись с размером справа от элемента
                    const labelX = startX + widthInMm + 5; // 5mm отступ справа
                    const labelY = currentY + (heightInMm / 2); // По центру высоты
                    
                    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    label.setAttribute('x', labelX * scale);
                    label.setAttribute('y', labelY * scale);
                    label.setAttribute('font-family', 'TT Commons Classic, -apple-system, sans-serif');
                    label.setAttribute('font-size', 3 * scale);
                    label.setAttribute('font-weight', 400);
                    label.setAttribute('fill', textColor);
                    label.setAttribute('dominant-baseline', 'middle');
                    label.textContent = `${heightInModules} mod`;
                    
                    designKitGroup.appendChild(label);
                    
                    // Обновляем позицию для следующего экземпляра
                    currentY += heightInMm + verticalGap;
                });
                
                // Добавляем отступ между секциями
                currentY += sectionGap;
            }
            
            svg.appendChild(designKitGroup);
        } catch (error) {
            console.error('Error adding design kit reference:', error);
        }
    }
    
    // Итерация 7: Экспорт настроек в JSON через SVGExporter
    exportSettings() {
        const { frontWidth, frontHeight, thickness, gridModule, columnCount, rowCount } = this.settings;
        
        const data = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            settings: this.settingsModule.getAll(),
            textBlocks: this.textBlocks,
            graphicsBlocks: this.graphicsBlocks || [],
            iconsBlock: this.iconsBlock || null,
            claimBlock: this.claimBlock || null
        };
        
        // Генерируем timestamp с точностью до минуты
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        
        // Генерируем имя файла: "размер с боковинами колонки строки модуль timestamp.json"
        // Например: "500×500×50mm 12col 12rows 5.05mm 20251116_1430.json"
        const size = `${frontWidth}×${frontHeight}×${thickness}mm`;
        const cols = `${columnCount}col`;
        const rows = `${rowCount}rows`;
        const module = `${gridModule.toFixed(2)}mm`;
        
        const filename = `${size} ${cols} ${rows} ${module} ${timestamp}.json`;
        
        this.svgExporter.exportSettings(data, filename);
    }
    
    // Итерация 7: Импорт настроек из JSON
    async importSettings(file) {
        try {
            const data = await this.svgExporter.importSettings(file);
            
            if (data.settings) {
                // Применяем настройки
                Object.entries(data.settings).forEach(([key, value]) => {
                    this.settingsModule.set(key, value);
                });
            }
            
            if (data.textBlocks) {
                // Инициализируем новые поля для совместимости со старыми настройками
                this.textBlocks = data.textBlocks.map(block => {
                    // Добавляем fontFeatures если их нет
                    if (!block.fontFeatures) {
                        block.fontFeatures = {
                            salt: false,
                            aalt: false,
                            ss01: false,
                            ss02: false,
                            tnum: false,
                            dlig: false
                        };
                    }
                    // Добавляем fontWeight если его нет (для Lunnen Display по умолчанию 400)
                    if (block.fontWeight === undefined) {
                        block.fontWeight = 400;
                    }
                    return block;
                });
            }
            
            if (data.graphicsBlocks) {
                this.graphicsBlocks = data.graphicsBlocks;
            }
            
            if (data.iconsBlock) {
                this.iconsBlock = data.iconsBlock;
            }
            
            if (data.claimBlock) {
                this.claimBlock = data.claimBlock;
            }
            
            // Обновляем UI
            this.updateGrid();
            this.updateElementsNavigator();
            
            console.log('✅ Settings imported successfully');
        } catch (error) {
            console.error('❌ Failed to import settings:', error);
            alert('Ошибка при импорте настроек: ' + error.message);
        }
    }
    
    // Debounced save state - saves after user stops interacting for 300ms
    debounceSaveState() {
        if (this.saveStateTimer) {
            clearTimeout(this.saveStateTimer);
        }
        this.saveStateTimer = setTimeout(() => {
            this.saveState();
        }, 300);
    }
    
    // Save current state to history
    saveState() {
        // Don't save state if we're currently restoring from history
        if (this.isRestoringState) {
            return;
        }
        
        // Create a deep copy of current state
        const state = {
            settings: JSON.parse(JSON.stringify(this.settings)),
            textBlocks: JSON.parse(JSON.stringify(this.textBlocks)),
            graphicsBlocks: JSON.parse(JSON.stringify(this.graphicsBlocks))
        };
        
        // Check if state is different from the last saved state
        if (this.history.length > 0) {
            const lastState = this.history[this.historyIndex];
            if (JSON.stringify(lastState) === JSON.stringify(state)) {
                // State hasn't changed, don't save
                return;
            }
        }
        
        // Remove any items after current index (when undoing and then making new changes)
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add new state
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        console.log(`[UNDO] State saved. History size: ${this.history.length}, Index: ${this.historyIndex}`);
    }
    
    // Undo last action
    undo() {
        console.log(`[UNDO] Current index: ${this.historyIndex}, History length: ${this.history.length}`);
        
        if (this.history.length < 2 || this.historyIndex <= 0) {
            console.log('[UNDO] Nothing to undo');
            return;
        }
        
        this.historyIndex--;
        console.log(`[UNDO] Moving to index: ${this.historyIndex}`);
        this.restoreState(this.history[this.historyIndex]);
    }
    
    // Restore state from history
    restoreState(state) {
        this.isRestoringState = true;
        
        try {
            // Restore settings
            Object.assign(this.settings, state.settings);
            
            // Restore text blocks
            this.textBlocks = JSON.parse(JSON.stringify(state.textBlocks));
            
            // Restore graphics blocks
            this.graphicsBlocks = JSON.parse(JSON.stringify(state.graphicsBlocks));
            
            // Update all UI elements to reflect restored state
            this.updateAllSliders();
            this.updateElementsNavigator();
            const rowCount = this.gridCalculator.calculateRowCount();
            this.settings.rowCount = rowCount;
            this.sliderController.setValue('rowCountSlider', rowCount, false);
            this.generateRowPresets();
            this.updateGrid();
            
            // Close any open panels
            this.closeParagraphPanel();
            this.closeGraphicsPanel();
            
        } finally {
            this.isRestoringState = false;
        }
    }
    
    // Update all sliders to reflect current settings
    updateAllSliders() {
        // Update dimension sliders
        if (this.dom.frontWidthSlider) {
            this.dom.frontWidthSlider.value = this.settings.frontWidth;
            this.dom.frontWidthValue.value = this.settings.frontWidth.toFixed(1);
        }
        if (this.dom.frontHeightSlider) {
            this.dom.frontHeightSlider.value = this.settings.frontHeight;
            this.dom.frontHeightValue.value = this.settings.frontHeight.toFixed(1);
        }
        if (this.dom.thicknessSlider) {
            this.dom.thicknessSlider.value = this.settings.thickness;
            this.dom.thicknessValue.value = this.settings.thickness.toFixed(1);
        }
        
        // Update grid sliders
        if (this.dom.gridModuleSlider) {
            this.dom.gridModuleSlider.value = this.settings.gridModule;
            this.dom.gridModuleValue.value = this.settings.gridModule.toFixed(4);
        }
        if (this.dom.marginsSlider) {
            if (this.settings.marginsUnit === 'mm') {
                const marginsInMm = this.settings.margins * this.settings.gridModule;
                this.dom.marginsSlider.value = marginsInMm.toFixed(2);
                this.dom.marginsValue.value = marginsInMm.toFixed(2);
            } else {
                this.dom.marginsSlider.value = this.settings.margins;
                this.dom.marginsValue.value = this.settings.margins.toFixed(2);
            }
        }
        if (this.dom.columnCountSlider) {
            this.dom.columnCountSlider.value = this.settings.columnCount;
            this.dom.columnCountValue.value = this.settings.columnCount;
        }
        if (this.dom.rowCountSlider) {
            this.dom.rowCountSlider.value = this.settings.rowCount;
            this.dom.rowCountValue.value = this.settings.rowCount;
        }
        if (this.dom.rowHeightSlider) {
            this.dom.rowHeightSlider.value = this.settings.rowHeight;
            this.dom.rowHeightValue.value = this.settings.rowHeight;
        }
        
        // Update checkboxes
        if (this.dom.showColumns) this.dom.showColumns.checked = this.settings.showColumns;
        if (this.dom.showRows) this.dom.showRows.checked = this.settings.showRows;
        if (this.dom.showBaseline) this.dom.showBaseline.checked = this.settings.showBaseline;
        if (this.dom.showSidePanels) this.dom.showSidePanels.checked = this.settings.showSidePanels;
        if (this.dom.showObjects) this.dom.showObjects.checked = this.settings.showObjects;
        
        // Update color
        if (this.dom.hexColorInput) {
            this.dom.hexColorInput.value = this.settings.boxColor;
            this.updateColorPreview();
            this.updateHSBFromHex(this.settings.boxColor);
        }
        
        // Update link mode radio buttons
        const linkModeRadios = document.querySelectorAll('input[name="linkMode"]');
        linkModeRadios.forEach(radio => {
            radio.checked = radio.value === this.settings.linkMode;
        });
        
        // Update margins unit buttons
        if (this.dom.marginsUnitMod && this.dom.marginsUnitMm) {
            if (this.settings.marginsUnit === 'mod') {
                this.dom.marginsUnitMod.classList.add('active');
                this.dom.marginsUnitMm.classList.remove('active');
            } else {
                this.dom.marginsUnitMm.classList.add('active');
                this.dom.marginsUnitMod.classList.remove('active');
            }
        }
    }
    
    // ============================================
    // UI Controllers initialization (Итерация 5)
    // ============================================
    initUIControllers() {
        // ============================================
        // Шаг 5.1: SliderController
        // ============================================
        // Создаем SliderController
        this.sliderController = new SliderController(this.settingsModule);
        
        // Инициализируем все слайдеры из SLIDER_CONFIG
        // Все слайдеры, включая HSB, управляются через SliderController
        Object.keys(this.SLIDER_CONFIG).forEach(sliderId => {
            const config = this.SLIDER_CONFIG[sliderId];
            this.sliderController.initSlider(sliderId, config);
        });
        
        console.log('✅ SliderController initialized with', this.sliderController.sliders.size, 'sliders');
        
        // ============================================
        // Шаг 5.2: ColorPicker
        // ============================================
        // ВРЕМЕННО ОТКЛЮЧЕНО - ColorPicker вызывает проблемы при инициализации
        // this.colorPicker = new ColorPicker(this.settingsModule, {
        //     onChange: (color) => {
        //         this.settingsModule.set('boxColor', color);
        //         this.updateGrid();
        //     }
        // });
        
        // Инициализация ColorPicker (вызывается после того как DOM готов)
        // Перенесено в init() так как требуется готовый DOM
        
        console.log('✅ ColorPicker created');
        
        // ============================================
        // Шаг 5.3: PanelManager
        // ============================================
        this.panelManager = new PanelManager();
        
        // Регистрация панелей (вызывается после того как DOM готов)
        // Перенесено в init() так как требуется готовый DOM
        
        console.log('✅ PanelManager created');
        
        // ============================================
        // Шаг 5.4: ZoomPanManager
        // ============================================
        this.zoomPanManager = new ZoomPanManager(
            this.dom.canvasContainer,
            this.dom.svg
        );
        
        // Обработчик изменения зума для обновления UI
        this.dom.canvasContainer.addEventListener('zoomchange', (e) => {
            // Сохраняем текущий процент зума
            this.currentZoomPercent = e.detail.percent;
            // Обновляем текст если не наведена мышь
            if (!this.zoomIndicatorHovered) {
                this.dom.zoomIndicator.textContent = `${e.detail.percent}%`;
            }
        });
        
        // Флаг для отслеживания наведения на индикатор зума
        this.zoomIndicatorHovered = false;
        this.currentZoomPercent = 100;
        
        // Обработчик наведения на индикатор зума - меняет текст на "Fit"
        this.dom.zoomIndicator.addEventListener('mouseenter', () => {
            this.zoomIndicatorHovered = true;
            this.dom.zoomIndicator.textContent = 'Fit';
        });
        
        // Обработчик ухода мыши - возвращает процент зума
        this.dom.zoomIndicator.addEventListener('mouseleave', () => {
            this.zoomIndicatorHovered = false;
            this.dom.zoomIndicator.textContent = `${this.currentZoomPercent}%`;
        });
        
        // Клик на индикатор зума - сброс в 100%
        this.dom.zoomIndicator.addEventListener('click', () => {
            this.zoomPanManager.resetZoom();
        });
        
        console.log('✅ ZoomPanManager initialized');
        
    }
    
    // ============================================
    // Panel registration (Итерация 5.3)
    // ============================================
    initPanels() {
        // Регистрируем все панели через PanelManager
        const panels = [
            { id: 'controlsPanel', headerId: 'panelHeader', draggable: true },
            { id: 'gridPanel', headerId: 'gridPanelHeader', draggable: true },
            { id: 'textPanel', headerId: 'textPanelHeader', draggable: true },
            { id: 'paragraphPanel', headerId: 'paragraphPanelHeader', draggable: true },
            { id: 'graphicsPanel', headerId: 'graphicsPanelHeader', draggable: true },
            { id: 'elementsNavigator', headerId: 'elementsNavigatorHeader', draggable: true }
        ];
        
        panels.forEach(panel => {
            this.panelManager.registerPanel(panel.id, {
                headerId: panel.headerId,
                draggable: panel.draggable
            });
        });
    }
    
    // ============================================
    // Elements initialization (Итерация 6)
    // ============================================
    initElementsManagers() {
        // Менеджеры временно отключены - используем старый код
        // TODO: Доработать рендереры для полной поддержки интерактивности и baseline snap
        // После доработки можно будет включить менеджеры обратно
        
        // Создаём менеджеры элементов (для будущего использования)
        this.textBlockManager = new TextBlockManager(this.settingsModule, this.gridCalculator);
        this.textRenderer = new TextRenderer(this.settingsModule, this.gridCalculator);
        this.graphicsManager = new GraphicsManager(this.settingsModule, this.gridCalculator);
        this.graphicsRenderer = new GraphicsRenderer(this.settingsModule, this.gridCalculator);
        
        // Миграция данных НЕ выполняется - используем старые массивы this.textBlocks и this.graphicsBlocks
        // ElementsNavigator также не инициализируется - используется старая логика updateElementsNavigator()
        
        console.log('✅ Elements managers created (not active yet - using legacy code)');
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
    setTimeout(async () => {
        const generator = new GridGenerator();
        // Load built-in graphics dimensions from SVG files
        await generator.initializeBuiltInGraphics();
    }, 50);
});
