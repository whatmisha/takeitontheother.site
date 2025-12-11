// ============================================
// Импорты модулей
// ============================================
// Итерация 1: Утилиты
import { ColorUtils } from './src/utils/ColorUtils.js';
import { MathUtils } from './src/utils/MathUtils.js';
import { DOMUtils } from './src/utils/DOMUtils.js';
import { TextToPath } from './src/utils/TextToPath.js';
import { BarcodeGenerator } from './src/utils/BarcodeGenerator.js';
import { ICONS, createSVGIcon } from './src/core/Constants.js';

// Итерация 2: Core
import { Settings } from './src/core/Settings.js';

// Итерация 3: Grid
import { GridCalculator } from './src/grid/GridCalculator.js';
import { GridRenderer } from './src/grid/GridRenderer.js';

// Итерация 5: UI Controllers
import { NumberInputController } from './src/ui/NumberInputController.js';
import { ColorPicker } from './src/ui/ColorPicker.js';
import { PanelManager } from './src/ui/PanelManager.js';

// Итерация 6: Elements
// DEPRECATED: Менеджеры и рендереры временно отключены - используется старый код
// import { TextBlockManager } from './src/elements/TextBlockManager.js';
// import { TextRenderer } from './src/elements/TextRenderer.js';
// import { GraphicsManager } from './src/elements/GraphicsManager.js';
// import { GraphicsRenderer } from './src/elements/GraphicsRenderer.js';
// import { ElementsNavigator } from './src/elements/ElementsNavigator.js';

// Итерация 7: SVG Export
import { SVGExporter } from './src/svg/SVGExporter.js';
import { PDFExporter } from './src/svg/PDFExporter.js';

class GridGenerator {
    constructor() {
        // Input configuration - defines behavior for each input
        this.INPUT_CONFIG = {
            frontWidthValue: {
                setting: 'frontWidth',
                min: 10,
                max: 1000,
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => this.updateGrid()
            },
            frontHeightValue: {
                setting: 'frontHeight',
                min: 10,
                max: 1000,
                decimals: 1,
                baseStep: 0.5,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        const module = this.gridCalculator.calculateModule();
                        this.settings.gridModule = module;
                        this.inputController.setValue('gridModuleValue', module, false);
                    } else {
                        const rowCount = this.gridCalculator.calculateRowCount();
                        this.settings.rowCount = rowCount;
                        this.inputController.setValue('rowCountValue', rowCount, false);
                    }
                    this.constrainAllObjectsToGrid();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            gridModuleValue: {
                setting: 'gridModule',
                min: 0.5,
                max: 20,
                decimals: 4,
                baseStep: 0.0001,
                shiftStep: 0.1,
                onUpdate: () => {
                    const rowCount = this.gridCalculator.calculateRowCount();
                    this.settings.rowCount = rowCount;
                    this.inputController.setValue('rowCountValue', rowCount, false);
                    this.constrainAllObjectsToGrid();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            marginsValue: {
                setting: 'margins',
                min: 0,
                max: 10,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        const module = this.gridCalculator.calculateModule();
                        this.settings.gridModule = module;
                        this.inputController.setValue('gridModuleValue', module, false);
                    } else {
                        const rowCount = this.gridCalculator.calculateRowCount();
                        this.settings.rowCount = rowCount;
                        this.inputController.setValue('rowCountValue', rowCount, false);
                    }
                    this.constrainAllObjectsToGrid();
                    this.generateRowPresets();
                    this.updateGrid();
                }
            },
            columnCountValue: {
                setting: 'columnCount',
                min: 1,
                max: 24,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.constrainAllObjectsToGrid();
                    this.updateGrid();
                }
            },
            rowCountValue: {
                setting: 'rowCount',
                min: 1,
                max: 50,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        const module = this.gridCalculator.calculateModule();
                        this.settings.gridModule = module;
                        this.inputController.setValue('gridModuleValue', module, false);
                    } else if (this.settings.linkMode === 'rows-height') {
                        const rowHeight = this.gridCalculator.calculateRowHeight();
                        this.settings.rowHeight = rowHeight;
                        this.inputController.setValue('rowHeightValue', rowHeight, false);
                    }
                    this.constrainAllObjectsToGrid();
                    this.updatePresetButtons();
                    this.updateGrid();
                }
            },
            rowHeightValue: {
                setting: 'rowHeight',
                min: 1,
                max: 20,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    if (this.settings.linkMode === 'module') {
                        const module = this.gridCalculator.calculateModule();
                        this.settings.gridModule = module;
                        this.inputController.setValue('gridModuleValue', module, false);
                    } else if (this.settings.linkMode === 'rows-height') {
                        const rowCount = this.gridCalculator.calculateRowCount();
                        this.settings.rowCount = rowCount;
                        this.inputController.setValue('rowCountValue', rowCount, false);
                    }
                    this.constrainAllObjectsToGrid();
                    this.updatePresetButtons();
                    this.updateGrid();
                }
            },
            hueValue: {
                setting: null, // Handled specially by ColorPicker
                min: 0,
                max: 360,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                }
            },
            saturationValue: {
                setting: null, // Handled specially by ColorPicker
                min: 0,
                max: 100,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                }
            },
            brightnessValue: {
                setting: null, // Handled specially by ColorPicker
                min: 0,
                max: 100,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateColorFromHSB();
                }
            },
            contentHueValue: {
                setting: null, // Handled specially by ColorPicker
                min: 0,
                max: 360,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateContentColorFromHSB();
                }
            },
            contentSaturationValue: {
                setting: null, // Handled specially by ColorPicker
                min: 0,
                max: 100,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateContentColorFromHSB();
                }
            },
            contentBrightnessValue: {
                setting: null, // Handled specially by ColorPicker
                min: 0,
                max: 100,
                decimals: 0,
                baseStep: 1,
                shiftStep: 10,
                onUpdate: () => {
                    this.updateContentColorFromHSB();
                }
            },
            headlineSizeValue: {
                setting: 'headlineSize',
                min: 6,
                max: 144,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => this.updateGrid()
            },
            lineHeightValue: {
                setting: 'lineHeight',
                min: 6,
                max: 144,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => this.updateGrid()
            },
            trackingValue: {
                setting: 'tracking',
                min: -0.05,
                max: 0.05,
                decimals: 3,
                baseStep: 0.005,
                shiftStep: 0.05,
                onUpdate: () => this.updateGrid()
            },
            textSizeValue: {
                setting: 'textSize',
                min: 6,
                max: 144,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => this.updateGrid()
            },
            textLineHeightValue: {
                setting: 'textLineHeight',
                min: 6,
                max: 144,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => this.updateGrid()
            },
            textTrackingValue: {
                setting: 'textTracking',
                min: -0.05,
                max: 0.05,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.05,
                onUpdate: () => this.updateGrid()
            },
            captionSizeValue: {
                setting: 'captionSize',
                min: 6,
                max: 144,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => this.updateGrid()
            },
            captionLineHeightValue: {
                setting: 'captionLineHeight',
                min: 6,
                max: 144,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => this.updateGrid()
            },
            captionTrackingValue: {
                setting: 'captionTracking',
                min: -0.05,
                max: 0.05,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.05,
                onUpdate: () => this.updateGrid()
            },
            lunnenDisplaySizeValue: {
                setting: 'lunnenDisplaySize',
                min: 6,
                max: 144,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => this.updateGrid()
            },
            lunnenDisplayLineHeightValue: {
                setting: 'lunnenDisplayLineHeight',
                min: 6,
                max: 144,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.1,
                onUpdate: () => this.updateGrid()
            },
            lunnenDisplayTrackingValue: {
                setting: 'lunnenDisplayTracking',
                min: -0.05,
                max: 0.05,
                decimals: 2,
                baseStep: 0.01,
                shiftStep: 0.05,
                onUpdate: () => this.updateGrid()
            }
        };
        
        // ============================================
        // Settings (Итерация 2: используем Settings модуль)
        // ============================================
        this.settingsModule = new Settings({
            frontWidth: 120,
            frontHeight: 24,
            showLabels: false,
            boxColor: '#808080',
            contentColor: '#17264E',
            gridModule: 5.0505,
            margins: 2,
            marginsUnit: 'mod',
            columnCount: 12,
            rowCount: 12,
            rowHeight: 7,
            linkMode: 'module',
            showColumns: false,
            showRows: false,
            showBaseline: false,
            showObjects: true,
            // Размеры шрифтов теперь хранятся в пунктах (pt) вместо модулей
            // Конвертируем из модулей в пункты: module * sizeInModules * (72/25.4) = pt
            // Для модуля 5.0505: 1.5 mod = 1.5 * 5.0505 * (72/25.4) ≈ 21.5 pt
            headlineSize: 21.5, // было 1.5 mod, теперь в pt
            lineHeight: 28.6, // было 2.0 mod, теперь в pt
            tracking: -0.015,
            useXHeight: false,
            headlineFontWeight: 500,
            textSize: 7.2, // было 0.5 mod, теперь в pt
            textLineHeight: 14.3, // было 1.0 mod, теперь в pt
            textTracking: 0,
            useXHeight2: false,
            textFontWeight: 500,
            // Caption style
            captionSize: 7.2, // было 0.5 mod, теперь в pt
            captionLineHeight: 14.3, // было 1.0 mod, теперь в pt
            captionTracking: 0,
            useXHeightCaption: false,
            captionFontWeight: 500,
            // Lunnen Display style
            lunnenDisplaySize: 43.0, // было 3.0 mod, теперь в pt
            lunnenDisplayLineHeight: 57.3, // было 4.0 mod, теперь в pt
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
        this.inputController = null;
        this.colorPicker = null;
        this.panelManager = null;
        this.editModeActive = false;
        
        // ============================================
        // Elements Managers (Итерация 6)
        // ============================================
        // Пока используем старую систему (this.textBlocks, this.graphicsBlocks)
        // Полная миграция в TextBlockManager/GraphicsManager - следующий шаг
        this.textBlockManager = null;
        this.textRenderer = null;
        this.graphicsManager = null;
        this.graphicsRenderer = null;
        // DEPRECATED: ElementsNavigator не используется - используется старая логика updateElementsNavigator()
        // this.elementsNavigator = null;
        
        // Graphics blocks - UNIFIED array for all graphics (built-in and custom)
        // Изначально пустой массив - данные загрузятся из пресета
        this.graphicsBlocks = [];
        
        // Индексы для быстрого поиска блоков по ID (O(1) вместо O(n))
        this.textBlocksById = new Map();
        this.graphicsBlocksById = new Map();
        
        // SVG содержимое для символа переменного тока (⎓)
        this.dcGlyphSVGContent = null;
        
        // Storage for deletion timers to allow cancellation
        this.deletionTimers = {};
        
        // Undo/Redo history
        this.history = [];
        this.historyIndex = 0;
        this.maxHistorySize = 50; // Maximum number of undo steps
        this.isRestoringState = false; // Flag to prevent saving state during undo/redo
        this.saveStateTimer = null; // Timer for debounced save
        
        // Grid update debouncing для оптимизации производительности
        this.updateGridAnimationFrame = null; // requestAnimationFrame ID для debouncing
        this.updateGridPending = false; // Флаг ожидающего обновления
        
        // Шаблон текстовых блоков пресета с плейсхолдерами (A1, B1 и т.д.)
        // Используется для применения данных из таблицы и генерации всех стикеров
        this.placeholderTextBlocks = null;
        
        // Пример одной строки данных из пресета (если задана в JSON)
        // Используется только для превью до загрузки реальных данных из Google Sheets
        this.presetExampleRow = null;
        
        // Сохраняем загруженные данные из таблицы для генерации нескольких стикеров
        this.loadedTableData = null;
        this.currentRowIndex = null; // Индекс текущей строки данных
        this.modifiedRowsData = {}; // Хранит измененные данные для каждого макета: {rowIndex: {textBlocks, graphicsBlocks}}
        this.saveRowStateTimeout = null; // Таймер для debounce сохранения состояния макета
        this.isSwitchingRow = false; // Флаг для предотвращения сохранения состояния при переключении между макетами
        this.isProgrammaticUpdate = false; // Флаг для предотвращения сохранения состояния при программных обновлениях (загрузка данных, применение данных из строки)
        
        // Text blocks - параметры конкретных текстовых блоков на канвасе
        // Изначально пустой массив - данные загрузятся из пресета
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
        this.pdfExporter = new PDFExporter(this.settingsModule, this.textToPath);
        
        // ============================================
        // Presets (Итерация 10)
        // ============================================
        this.availablePresets = [];
        this.loadPresetsManifest();
        
        // Calculate initial row count to fill the format (after DOM is ready)
        const rowCount = this.gridCalculator.calculateRowCount();
        this.settings.rowCount = rowCount;
        this.inputController.setValue('rowCountValue', rowCount, false);
        
        // Generate row presets
        this.generateRowPresets();
        
        // Initialize
        this.initEventListeners();
        this.updateMarginsSliderHandler();  // Setup margins slider with correct unit handling
        
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
        this.initGraphicsPanel();
        this.initPanelClickOutsideHandler();
        this.initElementsNavigator();
        this.updateLinkedControlsVisual();
        this.initColorPreview();
        this.updateTextWidthConstraints();
        this.updateCanvasSize();
        
        // Скрываем SVG до загрузки пресета
        if (this.dom.svg) {
            this.dom.svg.style.opacity = '0';
        }
        
        // Используем немедленное обновление при инициализации
        this.updateGridImmediate();
        
        // Загружаем SVG символ переменного тока
        this.loadDCGlyphSVG();
        
        // Update canvas size on window resize
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.updateGrid();
        });
    }
    
    cacheDOMElements() {
        return {
            svg: document.getElementById('gridSvg'),
            
            // Number inputs
            frontWidthValue: document.getElementById('frontWidthValue'),
            frontHeightValue: document.getElementById('frontHeightValue'),
            
            // Checkboxes
            showColumns: document.getElementById('showColumns'),
            showRows: document.getElementById('showRows'),
            showBaseline: document.getElementById('showBaseline'),
            showObjects: document.getElementById('showObjects'),
            
            // Link mode radio buttons
            linkModeOff: document.getElementById('linkModeOff'),
            linkModeRowsHeight: document.getElementById('linkModeRowsHeight'),
            linkModeModule: document.getElementById('linkModeModule'),
            
            // Grid controls
            gridModuleValue: document.getElementById('gridModuleValue'),
            marginsValue: document.getElementById('marginsValue'),
            marginsUnitMod: document.getElementById('marginsUnitMod'),
            marginsUnitMm: document.getElementById('marginsUnitMm'),
            columnCountValue: document.getElementById('columnCountValue'),
            rowCountValue: document.getElementById('rowCountValue'),
            rowHeightValue: document.getElementById('rowHeightValue'),
            
            // Containers
            linkedControlsContainer: document.getElementById('linkedControlsContainer'),
            
            // Color controls - Background
            colorPreview: document.getElementById('colorPreview'),
            hexColorInput: document.getElementById('hexColorInput'),
            lunnenBlue: document.getElementById('lunnenBlue'),
            hsbPicker: document.getElementById('hsbPicker'),
            hueValue: document.getElementById('hueValue'),
            saturationValue: document.getElementById('saturationValue'),
            brightnessValue: document.getElementById('brightnessValue'),
            // Color controls - Content
            contentColorPreview: document.getElementById('contentColorPreview'),
            contentHexColorInput: document.getElementById('contentHexColorInput'),
            contentHsbPicker: document.getElementById('contentHsbPicker'),
            contentHueValue: document.getElementById('contentHueValue'),
            contentSaturationValue: document.getElementById('contentSaturationValue'),
            contentBrightnessValue: document.getElementById('contentBrightnessValue'),
            
            // Buttons
            exportPdfBtn: document.getElementById('exportPdfBtn'),
            convertToOutlinesCheckbox: document.getElementById('convertToOutlinesCheckbox'),
            exportSettingsBtn: document.getElementById('exportSettingsBtn'),
            importSettingsBtn: document.getElementById('importSettingsBtn'),
            exportCurrentSvgBtn: document.getElementById('exportCurrentSvgBtn'),
            exportAllSvgBtn: document.getElementById('exportAllSvgBtn'),
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
            alignmentModeCapHeight: document.getElementById('alignmentModeCapHeight'),
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
            // Data Import panel
            googleSheetsUrl: document.getElementById('googleSheetsUrl'),
            loadDataBtn: document.getElementById('loadDataBtn'),
            exportCurrentStickerBtn: document.getElementById('exportCurrentStickerBtn'),
            generateAllStickersBtn: document.getElementById('generateAllStickersBtn'),
            defaultSheetsUrl: document.getElementById('defaultSheetsUrl'),
            tabletSheetsUrl: document.getElementById('tabletSheetsUrl'),
            dataStatus: document.getElementById('dataStatus'),
            dataPreview: document.getElementById('dataPreview'),
            dataRowsList: document.getElementById('dataRowsList'),
            // Elements navigator
            elementsNavigator: document.getElementById('elementsNavigator'),
            elementsNavigatorHeader: document.getElementById('elementsNavigatorHeader'),
            
            // Кэшируем часто используемые селекторы для делегирования событий
            // Контейнеры для делегирования
            document: document, // для глобального делегирования
            body: document.body,
            
            // Селекторы для делегирования (будут заполнены после инициализации)
            _selectors: {
                collapseIcons: null, // будет заполнено при первом использовании
                collapsibleHeaders: null,
                dropdownToggles: null
            },
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
            barcodeInputArea: document.getElementById('barcodeInputArea'),
            barcodeDataInput: document.getElementById('barcodeDataInput'),
            barcodeCharCounter: document.getElementById('barcodeCharCounter'),
            // Paragraph style select
            paragraphStyleSelect: document.getElementById('paragraphStyleSelect'),
            paragraphSurfaceSelect: document.getElementById('paragraphSurfaceSelect'),
            // Graphics surface select
            graphicsSurfaceSelect: document.getElementById('graphicsSurfaceSelect'),
            canvasContainer: document.getElementById('canvasContainer')
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
        
        // Edit mode toggle
        const editModeToggle = document.getElementById('editModeToggle');
        if (editModeToggle) {
            editModeToggle.addEventListener('change', (e) => {
                this.setEditMode(e.target.checked);
            });
        }
        
        // Link mode radio buttons
        const linkModeHandler = (e) => {
            this.settings.linkMode = e.target.value;
            this.updateLinkedControlsVisual();
            
            // If switching to module mode, calculate module immediately
            if (e.target.value === 'module') {
                const module = this.gridCalculator.calculateModule();
                this.settings.gridModule = module;
                this.inputController.setValue('gridModuleValue', module, false);
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
        
        // Content Color preview button - toggle HSB picker
        this.dom.contentColorPreview.addEventListener('click', () => {
            const isVisible = this.dom.contentHsbPicker.style.display !== 'none';
            this.dom.contentHsbPicker.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                this.updateContentHSBFromHex(this.settings.contentColor || '#17264E');
            }
        });
        
        // Content Hex color input
        this.dom.contentHexColorInput.addEventListener('input', (e) => {
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
                this.settings.contentColor = hexValue;
                this.settingsModule.set('contentColor', hexValue);
                this.dom.contentColorPreview.style.backgroundColor = hexValue;
                this.updateContentHSBFromHex(hexValue);
                
                // Обновляем цвет всех штрихкодов
                this.updateAllBarcodesColor(hexValue);
                
                this.updateGrid();
            }
        });
        
        // Validate content hex input when focus is lost
        this.dom.contentHexColorInput.addEventListener('blur', (e) => {
            let hexValue = e.target.value;
            
            if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/)) {
                // Если некорректный, берем текущий цвет из настроек вместо дефолтного
                hexValue = this.settingsModule.get('contentColor') || '#17264E';
            }
            
            e.target.value = hexValue;
            // Обновляем через оба способа для совместимости
            this.settings.contentColor = hexValue;
            this.settingsModule.set('contentColor', hexValue);
            this.dom.contentColorPreview.style.backgroundColor = hexValue;
            this.updateContentHSBFromHex(hexValue);
            
            // Обновляем цвет всех штрихкодов
            this.updateAllBarcodesColor(hexValue);
            
            this.updateGrid();
        });
        
        // Export PDF button
        if (this.dom.exportPdfBtn) {
            this.dom.exportPdfBtn.addEventListener('click', () => this.exportPDF());
        }
        
        // Export Current Label SVG button
        if (this.dom.exportCurrentSvgBtn) {
            this.dom.exportCurrentSvgBtn.addEventListener('click', () => this.exportCurrentLabelSVG());
        }
        
        // Export All Labels SVG button
        if (this.dom.exportAllSvgBtn) {
            this.dom.exportAllSvgBtn.addEventListener('click', () => this.exportAllLabelsSVG());
        }
        
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
        
        // Default Google Sheets URL preset for laptop labels
        if (this.dom.defaultSheetsUrl) {
            this.dom.defaultSheetsUrl.addEventListener('click', () => {
                const defaultUrl = 'https://docs.google.com/spreadsheets/d/1lIFfcoxXf7s-LLTWBmPgMcNx7KVuuV8iAQPOwbqGdkg/edit?usp=sharing';
                this.dom.googleSheetsUrl.value = defaultUrl;
            });
        }
        
        // Default Google Sheets URL preset for tablet labels
        if (this.dom.tabletSheetsUrl) {
            this.dom.tabletSheetsUrl.addEventListener('click', () => {
                const tabletUrl = 'https://docs.google.com/spreadsheets/d/1lIFfcoxXf7s-LLTWBmPgMcNx7KVuuV8iAQPOwbqGdkg/edit?gid=1551313393#gid=1551313393';
                this.dom.googleSheetsUrl.value = tabletUrl;
            });
        }
        
        // Data Import button
        if (this.dom.loadDataBtn) {
            this.dom.loadDataBtn.addEventListener('click', () => {
                this.loadDataFromGoogleSheets();
            });
        }
        
        // Export Current Sticker button (теперь экспортирует PDF)
        if (this.dom.exportCurrentStickerBtn) {
            this.dom.exportCurrentStickerBtn.addEventListener('click', () => {
                this.exportPDF();
            });
        }
        
        // Generate All Stickers button
        if (this.dom.generateAllStickersBtn) {
            this.dom.generateAllStickersBtn.addEventListener('click', () => {
                this.generateAllStickers();
            });
        }
        
        // Help button removed
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd+E / Ctrl+E - Generate All Labels PDF
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                // Проверяем, видна ли кнопка All Labels, и если да - вызываем generateAllStickers
                if (this.dom.generateAllStickersBtn && this.dom.generateAllStickersBtn.style.display !== 'none') {
                    this.generateAllStickers();
                } else {
                    // Если кнопка не видна, экспортируем текущий макет в PDF
                    this.exportPDF();
                }
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
        
        // Используем делегирование событий вместо множественных addEventListener
        // Это оптимизирует производительность и работает с динамически добавленными элементами
        
        // Обработчик для collapse icons через делегирование
        const handleCollapseIconClick = (e) => {
            const icon = e.target.closest('.collapse-icon');
            if (!icon) return;
            
            const panel = icon.closest('.controls-panel');
            if (!panel) return;
            
            const header = icon.closest('.panel-header');
            const content = panel.querySelector('.panel-content');
            
            if (!header || !content) return;
            
            e.stopPropagation(); // Prevent drag from triggering
            
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
            
            const isCollapsed = panel.classList.contains('panel-collapsed');
            
            if (isCollapsed) {
                // Expand
                panel.classList.remove('panel-collapsed');
                icon.classList.remove('collapsed');
                icon.setAttribute('aria-label', 'Collapse panel');
                
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
        
        // Обработчик для клавиатуры через делегирование
        const handleCollapseIconKeydown = (e) => {
            const icon = e.target.closest('.collapse-icon');
            if (!icon) return;
            
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Создаем синтетическое событие клика
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true
                });
                icon.dispatchEvent(clickEvent);
            }
        };
        
        // Используем делегирование на document вместо множественных слушателей
        document.addEventListener('click', handleCollapseIconClick);
        document.addEventListener('keydown', handleCollapseIconKeydown);
        
        // Сохраняем обработчики для возможной очистки в будущем
        this._panelCollapseHandlers = {
            click: handleCollapseIconClick,
            keydown: handleCollapseIconKeydown
        };
        
        // Collapse all panels except Data Import panel by default
        const panelsToCollapse = [
            'controlsPanel',      // Layout settings
            'elementsNavigator',  // Elements navigator
            'textPanel',          // Text styles
        ];
        
        panelsToCollapse.forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel && !panel.classList.contains('panel-collapsed')) {
                const collapseIcon = panel.querySelector('.collapse-icon');
                if (collapseIcon) {
                    panel.classList.add('panel-collapsed');
                    collapseIcon.classList.add('collapsed');
                    collapseIcon.setAttribute('aria-label', 'Expand panel');
                }
            }
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
            dimensionsParams.textContent = `${w}\u2009×\u2009${h} mm`;
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
            // GitHub API endpoint для получения списка файлов в папке (обновлен под sticky_generator)
            const apiUrl = 'https://api.github.com/repos/mishaivanov/takeitontheother.site/contents/js/YF/lunnen/sticky_generator/presets';
            
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
        
        // Clear menu (используем DOMUtils для лучшей производительности)
        DOMUtils.clearElement(this.dom.presetDropdownMenu);
        
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
                
                // Синхронизируем индекс для быстрого поиска
                this._syncTextBlocksIndex();
                
                // Сохраняем шаблонные текстовые блоки с плейсхолдерами,
                // чтобы позже подставлять реальные данные из таблицы
                this.placeholderTextBlocks = JSON.parse(JSON.stringify(this.textBlocks));
                
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
                
                // Синхронизируем индекс для быстрого поиска
                this._syncGraphicsBlocksIndex();
                
                // Ensure lockPosition is set for all blocks (default to true for backward compatibility)
                this.graphicsBlocks.forEach(block => {
                    if (block.lockPosition === undefined) {
                        block.lockPosition = true;
                    }
                });
            }

            // Сохраняем пример строки данных из пресета (если он есть)
            this.presetExampleRow = Array.isArray(normalizedData.exampleRow)
                ? [...normalizedData.exampleRow]
                : null;

            // Если данных из Google Sheets еще нет, применяем примерные данные
            // только для превью, подставляя их в плейсхолдеры и штрихкоды
            if (!this.loadedTableData && this.presetExampleRow) {
                // 1) Тексты: подставляем примерные данные в плейсхолдеры
                if (this.placeholderTextBlocks) {
                    try {
                        // Берем шаблон с плейсхолдерами, чтобы не потерять оригиналы
                        const templateBlocks = JSON.parse(JSON.stringify(this.placeholderTextBlocks));

                        this.textBlocks = templateBlocks.map(block => {
                            const originalContent = block.templateContent || block.content || '';
                            const newContent = this.replacePlaceholders(originalContent, this.presetExampleRow);

                            return {
                                ...block,
                                content: newContent
                            };
                        });
                        
                        // Синхронизируем индекс после изменения массива
                        this._syncTextBlocksIndex();
                    } catch (e) {
                        console.warn('Не удалось применить примерные данные пресета к текстам:', e);
                        // В случае ошибки просто оставляем текстовые блоки как есть (с плейсхолдерами)
                    }
                }

                // 2) Штрихкоды: обновляем графические блоки из той же примерной строки
                try {
                    this.updateBarcodeFromData(this.presetExampleRow);
                } catch (e) {
                    console.warn('Не удалось применить примерные данные пресета к штрихкодам:', e);
                }
            }
            
            // Update all UI elements to reflect new settings
            this.syncUIWithSettings();
            
            // Store preset name for export
            this.currentPresetName = data.presetName || filename.replace('.json', '');
            
            // Update UI and grid (используем немедленное обновление при загрузке пресета)
            this.updateGridImmediate();
            this.updateElementsNavigator();
            
            // Показываем SVG после загрузки пресета и центрируем его
            if (this.dom.svg) {
                this.dom.svg.style.opacity = '1';
            }
            
            
            console.log(`✅ Preset "${this.currentPresetName}" loaded successfully`);
        } catch (error) {
            console.error('Ошибка при загрузке пресета:', error);
            const errorMessage = error.message || 'Неизвестная ошибка';
            alert(`Не удалось загрузить пресет "${filename}": ${errorMessage}`);
            throw error; // Пробрасываем ошибку дальше для обработки на верхнем уровне
        }
    }
    
    // Sync UI elements with current settings
    syncUIWithSettings() {
        const settings = this.settingsModule.getAll();
        
        // Update inputs via NumberInputController
        Object.keys(this.INPUT_CONFIG).forEach(inputId => {
            const config = this.INPUT_CONFIG[inputId];
            if (settings[config.setting] !== undefined) {
                this.inputController.setValue(inputId, settings[config.setting], false);
            }
        });
        
        // Update checkboxes
        if (this.dom.showColumns) this.dom.showColumns.checked = settings.showColumns === true;
        if (this.dom.showRows) this.dom.showRows.checked = settings.showRows === true;
        if (this.dom.showBaseline) this.dom.showBaseline.checked = settings.showBaseline === true;
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
        
        // Update background color
        if (settings.boxColor) {
            if (this.dom.colorPreview) this.dom.colorPreview.style.backgroundColor = settings.boxColor;
            if (this.dom.hexColorInput) this.dom.hexColorInput.value = settings.boxColor;
            this.updateHSBFromHex(settings.boxColor);
        }
        
        // Update content color
        if (settings.contentColor) {
            if (this.dom.contentColorPreview) this.dom.contentColorPreview.style.backgroundColor = settings.contentColor;
            if (this.dom.contentHexColorInput) this.dom.contentHexColorInput.value = settings.contentColor;
            this.updateContentHSBFromHex(settings.contentColor);
        } else {
            // Set default if not present
            const defaultContentColor = '#17264E';
            this.settings.contentColor = defaultContentColor;
            this.settingsModule.set('contentColor', defaultContentColor);
            if (this.dom.contentColorPreview) this.dom.contentColorPreview.style.backgroundColor = defaultContentColor;
            if (this.dom.contentHexColorInput) this.dom.contentHexColorInput.value = defaultContentColor;
            this.updateContentHSBFromHex(defaultContentColor);
        }
        
        // Generate row presets
        this.generateRowPresets();
        
        // Update font size displays
        this.updateFontSizeDisplays();
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
        // Set initial background color preview
        this.dom.colorPreview.style.backgroundColor = this.settings.boxColor;
        this.updateHSBFromHex(this.settings.boxColor);
        
        // Set initial content color preview
        const contentColor = this.settings.contentColor || '#17264E';
        this.dom.contentColorPreview.style.backgroundColor = contentColor;
        this.updateContentHSBFromHex(contentColor);
    }
    
    // Initialize Size inputs (without sliders) with arrow key support
    // ВНИМАНИЕ: кегль и интерлиньяж теперь полностью управляются через NumberInputController.
    // Здесь оставляем только вспомогательную логику для остальных value-инпутов, не дублируя запись в Settings.
    initSizeInputsWithArrows() {
        const sizeInputs = [
            // Headline/Text size хандлятся NumberInputController'ом через INPUT_CONFIG,
            // поэтому здесь их сознательно НЕ трогаем, чтобы избежать конфликтов blur/keydown.
            // { id: 'headlineSizeValue', setting: 'headlineSize' },
            // { id: 'textSizeValue', setting: 'textSize' }
        ];
        
        sizeInputs.forEach(({ id, setting }) => {
            const input = document.getElementById(id);
            if (!input) return;
            
            let min = parseFloat(input.dataset.min);
            let max = parseFloat(input.dataset.max);
            
            if (isNaN(min)) {
                min = input.min !== '' ? parseFloat(input.min) : -Infinity;
            }
            if (isNaN(max)) {
                max = input.max !== '' ? parseFloat(input.max) : Infinity;
            }
            
            input.addEventListener('focus', () => {
                input.dataset.originalValue = input.value;
                input.select();
            });
            
            // Никакой собственной логики blur/keydown здесь не вешаем для кегля,
            // чтобы не спорить с NumberInputController.
        });
    }
    
    initCollapsibleSections() {
        // Используем делегирование событий для оптимизации
        // Обработчик для collapsible headers через делегирование
        const handleCollapsibleHeaderClick = (e) => {
            const header = e.target.closest('.collapsible-header');
            if (!header) return;
            
            const toggle = header.querySelector('.collapse-toggle');
            const contentId = header.id.replace('Header', 'Content');
            const content = document.getElementById(contentId);
            
            if (!toggle || !content) return;
            
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
        
        // Обработчик для предотвращения drag при клике на header
        const handleCollapsibleHeaderMousedown = (e) => {
            const header = e.target.closest('.collapsible-header');
            if (!header) return;
            
            e.stopPropagation();
        };
        
        // Используем делегирование на document
        document.addEventListener('click', handleCollapsibleHeaderClick);
        document.addEventListener('mousedown', handleCollapsibleHeaderMousedown);
        
        // Сохраняем обработчики для возможной очистки
        this._collapsibleHandlers = {
            click: handleCollapsibleHeaderClick,
            mousedown: handleCollapsibleHeaderMousedown
        };
    }
    
    initDropdowns() {
        // Используем делегирование событий для оптимизации
        // Обработчик для dropdown toggles через делегирование
        const handleDropdownToggleClick = (e) => {
            const toggle = e.target.closest('.dropdown-toggle');
            if (!toggle) return;
            
            const targetId = toggle.getAttribute('data-target');
            const dropdown = document.getElementById(targetId);
            
            if (!dropdown) return;
            
            // Get the input field (sibling of toggle)
            const container = toggle.closest('.value-input-with-dropdown');
            const input = container ? container.querySelector('.value-display') : null;
            const sliderId = input ? input.id.replace('Value', 'Slider') : null;
            
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
            if (input) {
                this.updateDropdownSelection(dropdown, input.value);
            }
        };
        
        // Обработчик для dropdown items через делегирование
        const handleDropdownItemClick = (e) => {
            const item = e.target.closest('.dropdown-item');
            if (!item) return;
            
            const dropdown = item.closest('.dropdown-menu');
            if (!dropdown) return;
            
            const container = dropdown.closest('.value-input-with-dropdown');
            const input = container ? container.querySelector('.value-display') : null;
            const sliderId = input ? input.id.replace('Value', 'Slider') : null;
            
            e.stopPropagation();
            const value = parseFloat(item.getAttribute('data-value'));
            
            // Update slider using universal method
            if (sliderId) {
                this.updateSliderValue(sliderId, value);
            }
            
            // Close dropdown
            dropdown.classList.remove('active');
        };
        
        // Используем делегирование на document
        document.addEventListener('click', handleDropdownToggleClick);
        document.addEventListener('click', handleDropdownItemClick);
        
        // Сохраняем обработчики для возможной очистки
        this._dropdownHandlers = {
            toggle: handleDropdownToggleClick,
            item: handleDropdownItemClick
        };
        
        // Close dropdowns when clicking outside (уже есть делегирование, оставляем как есть)
        // Этот обработчик уже использует делегирование, поэтому оставляем его
        
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
                            // Используем константы из Constants.js вместо дублирования SVG строк
                            // Логика: если visible === true, показываем иконку "скрыть" (EYE_HIDDEN)
                            svg.innerHTML = block.visible ? ICONS.EYE_HIDDEN : ICONS.EYE_VISIBLE;
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
        
        if (this.dom.alignmentModeCapHeight) {
            this.dom.alignmentModeCapHeight.addEventListener('change', () => {
                if (this.currentEditingBlock && this.dom.alignmentModeCapHeight.checked) {
                    this.currentEditingBlock.alignmentMode = 'cap-height';
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
    
    // Обновить счетчик символов для штрихкода
    updateBarcodeCharCounter() {
        if (this.dom.barcodeCharCounter && this.dom.barcodeDataInput) {
            const count = this.dom.barcodeDataInput.value.length;
            const plural = count === 1 ? 'character' : 'characters';
            this.dom.barcodeCharCounter.textContent = `${count} ${plural}`;
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
                        
                        const alignment = block.alignment || 'left';
                        let minX = 1;
                        let maxX;
                        
                        if (alignment === 'right') {
                            // x — правая колонка, левая граница не должна выходить за пределы сетки
                            minX = graphicsWidthInColumns;
                            maxX = maxColumns;
                        } else {
                            // x — левая колонка, правая граница не должна выходить за пределы
                            maxX = Math.max(1, maxColumns - graphicsWidthInColumns + 1);
                        }
                        
                        return Math.max(minX, Math.min(value, maxX));
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
                        const direction = e.key === 'ArrowUp' ? 1 : -1;
                        let newValue = currentValue + (step * direction);
                        
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
        const direction = e.key === 'ArrowUp' ? 1 : -1;
        const delta = step * direction;
        
        let newValue = this.currentEditingBlock[property] + delta;
        
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
                if (this.dom.alignmentModeBaseline && this.dom.alignmentModeXHeight && this.dom.alignmentModeCapHeight) {
                    if (alignmentMode === 'x-height') {
                        this.dom.alignmentModeXHeight.checked = true;
                        this.dom.alignmentModeBaseline.checked = false;
                        this.dom.alignmentModeCapHeight.checked = false;
                    } else if (alignmentMode === 'cap-height') {
                        this.dom.alignmentModeCapHeight.checked = true;
                        this.dom.alignmentModeBaseline.checked = false;
                        this.dom.alignmentModeXHeight.checked = false;
                    } else {
                        this.dom.alignmentModeBaseline.checked = true;
                        this.dom.alignmentModeXHeight.checked = false;
                        this.dom.alignmentModeCapHeight.checked = false;
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
                // Используем константы из Constants.js вместо дублирования SVG строк
                // Логика: если visible === true, показываем иконку "скрыть" (EYE_HIDDEN)
                svg.innerHTML = block.visible ? ICONS.EYE_HIDDEN : ICONS.EYE_VISIBLE;
            }
        }
        
        // Показываем панель и позиционируем рядом с элементом
        if (this.dom.paragraphPanel) {
            this.dom.paragraphPanel.style.display = 'flex';
            this.dom.paragraphPanel.classList.add('active');
            this.positionPanelNextToBlock(this.dom.paragraphPanel, blockId, 'text');
            
            // Вне режима редактирования скрываем все элементы кроме текстового поля
            if (!this.editModeActive) {
                const allSections = this.dom.paragraphPanel.querySelectorAll('.control-section');
                allSections.forEach((section, index) => {
                    // Первая секция с настройками - скрываем
                    // Вторая секция с текстом - показываем
                    if (index === 0) {
                        section.style.display = 'none';
                    } else if (index === 1) {
                        section.style.display = 'block';
                    } else {
                        section.style.display = 'none';
                    }
                });
                
                // Скрываем кнопки действий в заголовке
                const headerActions = this.dom.paragraphPanel.querySelector('.panel-header-actions');
                if (headerActions) {
                    headerActions.style.display = 'none';
                }
            } else {
                // В режиме редактирования показываем все элементы
                const allSections = this.dom.paragraphPanel.querySelectorAll('.control-section');
                allSections.forEach(section => {
                    section.style.display = '';
                });
                
                const headerActions = this.dom.paragraphPanel.querySelector('.panel-header-actions');
                if (headerActions) {
                    headerActions.style.display = '';
                }
            }
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
        
        // Hide barcode input area
        if (this.dom.barcodeInputArea) {
            this.dom.barcodeInputArea.style.display = 'none';
        }
        if (this.dom.barcodeDataInput) {
            this.dom.barcodeDataInput.value = '';
            // Обновляем счетчик символов при очистке
            this.updateBarcodeCharCounter();
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
        
        // Barcode data input handler
        if (this.dom.barcodeDataInput) {
            let barcodeInputTimeout = null;
            this.dom.barcodeDataInput.addEventListener('input', (e) => {
                // Обновляем счетчик символов сразу при вводе
                this.updateBarcodeCharCounter();
                
                // Debounce input to avoid generating barcode on every keystroke
                clearTimeout(barcodeInputTimeout);
                barcodeInputTimeout = setTimeout(() => {
                    this.handleBarcodeInputChange(e.target.value);
                }, 500); // Wait 500ms after user stops typing
            });
            
            // Also handle Enter key for immediate generation
            this.dom.barcodeDataInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(barcodeInputTimeout);
                    this.handleBarcodeInputChange(e.target.value);
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
    
    /**
     * Определяет тип штрихкода из блока (универсально для всех пресетов)
     * Проверяет сначала block.barcodeType, затем block.barcode (конфигурацию из пресета)
     * @param {Object} block - Графический блок
     * @returns {Object} { barcodeType: string, displayValue: boolean } или null, если это не штрихкод
     */
    getBarcodeTypeFromBlock(block) {
        if (!block) {
            return null;
        }
        
        // Если есть явный barcodeType, используем его (приоритет 1)
        if (block.barcodeType && (block.barcodeType === 'code128' || block.barcodeType === 'ean13')) {
            return {
                barcodeType: block.barcodeType,
                displayValue: block.barcodeType === 'ean13'
            };
        }
        
        // Если есть конфигурация из пресета (block.barcode), определяем тип из неё (приоритет 2)
        if (block.barcode && block.barcode.type) {
            const logicalType = (block.barcode.type || '').toString().toLowerCase();
            let barcodeType = 'code128';
            let displayValue = false;
            
            switch (logicalType) {
                case 'ean-13':
                case 'ean13':
                    barcodeType = 'ean13';
                    displayValue = true;
                    break;
                case 'sn':
                case 'imei1':
                case 'imei2':
                    barcodeType = 'code128';
                    displayValue = false;
                    break;
                default:
                    barcodeType = 'code128';
                    displayValue = false;
            }
            
            return { barcodeType, displayValue };
        }
        
        // Fallback: определяем по ID блока для обратной совместимости (приоритет 3)
        if (block.id === 'sticker-barcode') {
            return {
                barcodeType: 'ean13',
                displayValue: true
            };
        } else if (block.id === 'sticker-barcode-small' || 
                  block.id === 'sticker-barcode-imei1' || 
                  block.id === 'sticker-barcode-imei2') {
            return {
                barcodeType: 'code128',
                displayValue: false
            };
        }
        
        return null;
    }
    
    /**
     * Handle barcode data input change - generate new barcode
     * @param {string} barcodeData - New barcode data (digits only)
     */
    handleBarcodeInputChange(barcodeData) {
        if (!this.currentEditingGraphicsId) {
            return;
        }
        
        // Используем getGraphicsBlock для консистентности и производительности
        const block = this.getGraphicsBlock(this.currentEditingGraphicsId);
        if (!block) {
            return;
        }
        
        // Универсальная проверка: используем вспомогательную функцию
        const barcodeInfo = this.getBarcodeTypeFromBlock(block);
        if (!barcodeInfo) {
            return;
        }
        
        // Clean input - only digits
        const cleanData = String(barcodeData).replace(/[^0-9]/g, '');
        
        if (!cleanData) {
            console.warn('Barcode input is empty or contains no digits');
            return;
        }
        
        // Get grid settings
        const gridSettings = {
            gridModule: this.settings.gridModule,
            columnCount: this.settings.columnCount,
            frontWidth: this.settings.frontWidth,
            frontHeight: this.settings.frontHeight,
            margins: this.settings.margins,
            marginsUnit: this.settings.marginsUnit,
        };
        
        // Generate new barcode
        const contentColor = this.settings.contentColor || '#17264E';
        // Используем barcodeType из barcodeInfo (не type!)
        const barcodeType = barcodeInfo.barcodeType || 'code128';
        BarcodeGenerator.updateBarcodeBlock(
            block,
            cleanData,
            gridSettings,
            barcodeInfo.displayValue,
            barcodeType,
            contentColor
        );
        
        // Save barcode data in block for future reference
        block.barcodeData = cleanData;
        
        // Update grid to show new barcode
        this.updateGrid();
        
        console.log(`✅ Barcode "${block.id}" updated with data: ${cleanData}`);
    }
    
    // ============================================
    // Color methods (Итерация 8: обертки удалены, используем ColorUtils напрямую)
    // ============================================
    
    updateHSBFromHex(hex) {
        const rgb = ColorUtils.hexToRgb(hex);
        if (rgb) {
            const hsb = ColorUtils.rgbToHsb(rgb.r, rgb.g, rgb.b);
            this.dom.hueValue.value = hsb.h;
            this.dom.saturationValue.value = hsb.s;
            this.dom.brightnessValue.value = hsb.b;
            this.dom.hueValue.value = hsb.h;
            this.dom.saturationValue.value = hsb.s;
            this.dom.brightnessValue.value = hsb.b;
            this.updateSaturationGradient();
            this.updateBrightnessGradient();
        }
    }
    
    updateColorFromHSB() {
        const h = parseInt(this.dom.hueValue.value);
        const s = parseInt(this.dom.saturationValue.value);
        const b = parseInt(this.dom.brightnessValue.value);
        
        const rgb = ColorUtils.hsbToRgb(h, s, b);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Обновляем через оба способа для совместимости
        this.settings.boxColor = hex;
        this.settingsModule.set('boxColor', hex);
        this.dom.hexColorInput.value = hex;
        this.dom.colorPreview.style.backgroundColor = hex;
        this.updateGrid();
    }
    
    updateContentHSBFromHex(hex) {
        const rgb = ColorUtils.hexToRgb(hex);
        if (rgb) {
            const hsb = ColorUtils.rgbToHsb(rgb.r, rgb.g, rgb.b);
            this.dom.contentHueValue.value = hsb.h;
            this.dom.contentSaturationValue.value = hsb.s;
            this.dom.contentBrightnessValue.value = hsb.b;
        }
    }
    
    updateContentColorFromHSB() {
        const h = parseInt(this.dom.contentHueValue.value);
        const s = parseInt(this.dom.contentSaturationValue.value);
        const b = parseInt(this.dom.contentBrightnessValue.value);
        
        const rgb = ColorUtils.hsbToRgb(h, s, b);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Обновляем через оба способа для совместимости
        this.settings.contentColor = hex;
        this.settingsModule.set('contentColor', hex);
        this.dom.contentHexColorInput.value = hex;
        this.dom.contentColorPreview.style.backgroundColor = hex;
        
        // Обновляем цвет всех штрихкодов
        this.updateAllBarcodesColor(hex);
        
        this.updateGrid();
    }
    
    /**
     * Обновляет цвет всех существующих штрихкодов
     * @param {string} color - Новый цвет контента
     */
    updateAllBarcodesColor(color) {
        const gridSettings = {
            gridModule: this.settings.gridModule,
            columnCount: this.settings.columnCount,
            frontWidth: this.settings.frontWidth,
            frontHeight: this.settings.frontHeight,
            margins: this.settings.margins,
            marginsUnit: this.settings.marginsUnit,
        };
        
        const graphicsBlocks = this.graphicsBlocks || [];
        
        // Обновляем все блоки со штрихкодами
        graphicsBlocks.forEach(block => {
            if (!block || !block.barcodeData) return;
            
            // Определяем тип штрихкода и параметры отображения
            let barcodeType = 'code128';
            let displayValue = false;
            
            if (block.barcode) {
                // Новый способ: конфигурация из пресета
                const config = block.barcode;
                switch (config.type?.toLowerCase()) {
                    case 'ean-13':
                    case 'ean13':
                        barcodeType = 'ean13';
                        displayValue = true;
                        break;
                    case 'sn':
                    case 'imei1':
                    case 'imei2':
                        barcodeType = 'code128';
                        displayValue = false;
                        break;
                }
            } else {
                // Старый способ: определяем по ID блока
                if (block.id === 'sticker-barcode') {
                    barcodeType = 'ean13';
                    displayValue = true;
                } else if (block.id === 'sticker-barcode-small' || 
                          block.id === 'sticker-barcode-imei1' || 
                          block.id === 'sticker-barcode-imei2') {
                    barcodeType = 'code128';
                    displayValue = false;
                } else if (block.barcodeType) {
                    // Используем сохраненный тип штрихкода
                    barcodeType = block.barcodeType;
                    displayValue = block.barcodeData ? true : false;
                }
            }
            
            // Перегенерируем штрихкод с новым цветом
            BarcodeGenerator.updateBarcodeBlock(
                block,
                block.barcodeData,
                gridSettings,
                displayValue,
                barcodeType,
                color
            );
        });
    }
    
    updateSaturationGradient() {
        const h = parseInt(this.dom.hueValue.value);
        const b = parseInt(this.dom.brightnessValue.value);
        
        const leftColor = ColorUtils.hsbToRgb(h, 0, b);
        const rightColor = ColorUtils.hsbToRgb(h, 100, b);
        
        const leftHex = ColorUtils.rgbToHex(leftColor.r, leftColor.g, leftColor.b);
        const rightHex = ColorUtils.rgbToHex(rightColor.r, rightColor.g, rightColor.b);
        
        // Gradients не нужны для number inputs
        // const gradient = `linear-gradient(to right, ${leftHex}, ${rightHex})`;
        // this.dom.saturationValue.style.background = gradient;
    }
    
    updateBrightnessGradient() {
        const h = parseInt(this.dom.hueValue.value);
        const s = parseInt(this.dom.saturationValue.value);
        
        const leftColor = ColorUtils.hsbToRgb(h, s, 0);
        const rightColor = ColorUtils.hsbToRgb(h, s, 100);
        
        const leftHex = ColorUtils.rgbToHex(leftColor.r, leftColor.g, leftColor.b);
        const rightHex = ColorUtils.rgbToHex(rightColor.r, rightColor.g, rightColor.b);
        
        // Gradients не нужны для number inputs
        // const gradient = `linear-gradient(to right, ${leftHex}, ${rightHex})`;
        // this.dom.brightnessValue.style.background = gradient;
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
        // Margins are always stored in modules internally
        const currentMarginsInMod = this.settings.margins;
        const currentModule = this.settings.gridModule;
        const oldUnit = this.settings.marginsUnit;
        
        // Update input value display based on new unit
        const input = this.dom.marginsValue;
        
        // Get current value from input (in current unit)
        const currentInputValue = parseFloat(input.value);
        
        // Calculate the actual margins in mm (physical size that should stay the same)
        let actualMarginsInMm;
        if (oldUnit === 'mm') {
            // Already in mm, use current input value
            actualMarginsInMm = currentInputValue;
        } else {
            // Convert from modules to mm
            actualMarginsInMm = currentMarginsInMod * currentModule;
        }
        
        // Update unit setting
        this.settings.marginsUnit = newUnit;
        
        // Update active state of buttons
        if (this.dom.marginsUnitMod && this.dom.marginsUnitMm) {
            if (newUnit === 'mod') {
                this.dom.marginsUnitMod.classList.add('active');
                this.dom.marginsUnitMm.classList.remove('active');
            } else {
                this.dom.marginsUnitMm.classList.add('active');
                this.dom.marginsUnitMod.classList.remove('active');
            }
        }
        
        if (newUnit === 'mm') {
            // Display in mm
            const maxMarginsInMm = 10 * currentModule; // max 10 modules in mm
            
            // Update input range for mm
            input.min = '0';
            input.max = maxMarginsInMm.toFixed(2);
            input.step = (currentModule * 0.01).toFixed(4); // Keep same precision
            input.value = actualMarginsInMm.toFixed(2);
            valueDisplay.dataset.max = maxMarginsInMm.toFixed(2);
        } else {
            // Display in modules - convert from mm to modules
            const marginsInMod = actualMarginsInMm / currentModule;
            
            // Update internal storage
            this.settings.margins = parseFloat(marginsInMod.toFixed(2));
            
            // Restore input range for modules
            input.min = '0';
            input.max = '10';
            input.step = '0.01';
            input.value = marginsInMod.toFixed(2);
        }
        
        // Update NumberInputController for margins to use correct conversion
        this.updateMarginsSliderHandler();
    }
    
    // Update margins input handler to work with current unit
    updateMarginsSliderHandler() {
        // Not needed anymore - NumberInputController handles this
        // Unit switching will update limits and recalculate values
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
            // For fields with decimals === 2 (Module, Margins, font sizes, line heights): 
            // round to tenths first, then add/subtract shiftStep
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
    
    generateRowPresets() {
        const container = document.getElementById('rowPresetsContainer');
        if (!container) return;
        
        const combinations = this.gridCalculator.findPerfectRowCombinations();
        
        // Clear existing buttons (используем DOMUtils для лучшей производительности)
        DOMUtils.clearElement(container);
        
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
                this.dom.rowHeightValue.value = combo.rowHeight;
                
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
    // Синхронизировать индекс textBlocksById с массивом textBlocks
    _syncTextBlocksIndex() {
        this.textBlocksById.clear();
        this.textBlocks.forEach(block => {
            if (block.id) {
                this.textBlocksById.set(block.id, block);
            }
        });
    }
    
    // Синхронизировать индекс graphicsBlocksById с массивом graphicsBlocks
    _syncGraphicsBlocksIndex() {
        this.graphicsBlocksById.clear();
        if (this.graphicsBlocks) {
            this.graphicsBlocks.forEach(block => {
                if (block.id) {
                    this.graphicsBlocksById.set(block.id, block);
                }
            });
        }
    }
    
    getTextBlock(id) {
        // Используем Map для быстрого поиска O(1) вместо O(n) с find()
        return this.textBlocksById.get(id) || null;
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
        // Используем Map для быстрого поиска O(1) вместо O(n) с find()
        return this.graphicsBlocksById.get(id) || null;
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
    
    // Calculate font size in mm based on EM size in points
    calculateFontSize() {
        // headlineSize теперь трактуется как EM-кегль в пунктах (pt)
        let fontSizePt = this.settings.headlineSize;
        
        // Проверка на валидность значения
        if (!fontSizePt || isNaN(fontSizePt) || fontSizePt <= 0) {
            fontSizePt = 16;
        }
        
        // Прямой перевод EM-кегля из pt в мм (1 pt = 25.4/72 mm)
        const fontSizeMm = MathUtils.ptToMm(fontSizePt);
        
        return isNaN(fontSizeMm) || !isFinite(fontSizeMm) || fontSizeMm <= 0
            ? MathUtils.ptToMm(16)
            : fontSizeMm; // in mm
    }
    
    // Calculate font size for Text style (cap height or x-height)
    calculateTextStyleFontSize() {
        // textSize трактуется как EM-кегль в пунктах (pt)
        let fontSizePt = this.settings.textSize;
        
        // Проверка на валидность значения
        if (!fontSizePt || isNaN(fontSizePt) || fontSizePt <= 0) {
            fontSizePt = 12;
        }
        
        const fontSizeMm = MathUtils.ptToMm(fontSizePt);
        
        return isNaN(fontSizeMm) || !isFinite(fontSizeMm) || fontSizeMm <= 0
            ? MathUtils.ptToMm(12)
            : fontSizeMm; // in mm
    }
    
    // Calculate font size for Caption style
    calculateCaptionStyleFontSize() {
        // captionSize трактуется как EM-кегль в пунктах (pt)
        let fontSizePt = this.settings.captionSize;
        
        // Проверка на валидность значения
        if (!fontSizePt || isNaN(fontSizePt) || fontSizePt <= 0) {
            fontSizePt = 10;
        }
        
        const fontSizeMm = MathUtils.ptToMm(fontSizePt);
        
        return isNaN(fontSizeMm) || !isFinite(fontSizeMm) || fontSizeMm <= 0
            ? MathUtils.ptToMm(10)
            : fontSizeMm; // in mm
    }
    
    // Calculate font size for Lunnen Display style
    calculateLunnenDisplayStyleFontSize() {
        // lunnenDisplaySize трактуется как EM-кегль в пунктах (pt)
        let fontSizePt = this.settings.lunnenDisplaySize;
        
        // Проверка на валидность значения
        if (!fontSizePt || isNaN(fontSizePt) || fontSizePt <= 0) {
            fontSizePt = 32;
        }
        
        const fontSizeMm = MathUtils.ptToMm(fontSizePt);
        
        return isNaN(fontSizeMm) || !isFinite(fontSizeMm) || fontSizeMm <= 0
            ? MathUtils.ptToMm(32)
            : fontSizeMm; // in mm
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
        // headlineSize теперь уже хранится в пунктах
        return Math.round(this.settings.headlineSize * 10) / 10;
    }
    
    // Get line height in pt for Headline
    getHeadlineLineHeightPt() {
        // lineHeight теперь хранится в пунктах
        return Math.round(this.settings.lineHeight * 10) / 10;
    }
    
    // Get font size in pt for Text
    getTextFontSizePt() {
        // textSize теперь уже хранится в пунктах
        return Math.round(this.settings.textSize * 10) / 10;
    }
    
    // Get line height in pt for Text
    getTextLineHeightPt() {
        // textLineHeight теперь хранится в пунктах
        return Math.round(this.settings.textLineHeight * 10) / 10;
    }
    
    // Get font size in pt for Caption
    getCaptionFontSizePt() {
        // captionSize теперь уже хранится в пунктах
        return Math.round(this.settings.captionSize * 10) / 10;
    }
    
    // Get line height in pt for Caption
    getCaptionLineHeightPt() {
        // captionLineHeight теперь хранится в пунктах
        return Math.round(this.settings.captionLineHeight * 10) / 10;
    }
    
    // Get font size in pt for Lunnen Display
    getLunnenDisplayFontSizePt() {
        // lunnenDisplaySize теперь уже хранится в пунктах
        return Math.round(this.settings.lunnenDisplaySize * 10) / 10;
    }
    
    // Get line height in pt for Lunnen Display
    getLunnenDisplayLineHeightPt() {
        // lunnenDisplayLineHeight теперь хранится в пунктах
        return Math.round(this.settings.lunnenDisplayLineHeight * 10) / 10;
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
            // Для x-height и cap-height режимов первая строка НЕ привязывается к baseline
            if (alignmentMode === 'x-height' || alignmentMode === 'cap-height') {
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
        
        // Get lineHeight in points for the current style
        let lineHeightPt;
        switch(block.styleRef) {
            case 'headline':
                lineHeightPt = this.settings.lineHeight;
                break;
            case 'text':
                lineHeightPt = this.settings.textLineHeight;
                break;
            case 'caption':
                lineHeightPt = this.settings.captionLineHeight;
                break;
            case 'lunnenDisplay':
                lineHeightPt = this.settings.lunnenDisplayLineHeight;
                break;
            default:
                lineHeightPt = this.settings.textLineHeight;
        }
        
        // Проверка на валидность значения
        if (!lineHeightPt || isNaN(lineHeightPt) || lineHeightPt <= 0) {
            lineHeightPt = 12; // Значение по умолчанию
        }
        
        // Конвертируем пункты в мм, затем в модули
        const lineHeightMm = MathUtils.ptToMm(lineHeightPt);
        const lineHeightInModules = lineHeightMm / module;
        
        // Get text content
        const inputLines = block.content.split('\n').filter(line => line.trim() !== '');
        if (inputLines.length === 0) {
            return lineHeightInModules; // Return minimum height for empty block
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
        return lineHeightInModules * wrappedLines.length;
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
                style: this.editModeActive ? 'cursor: move;' : 'cursor: default;',
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
                style: this.editModeActive ? 'cursor: move;' : 'cursor: default;'
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
        
        // Get size in points (pt) for the current style (EM-кегль)
        let textSizePt;
        switch(block.styleRef) {
            case 'headline':
                textSizePt = this.settings.headlineSize;
                break;
            case 'text':
                textSizePt = this.settings.textSize;
                break;
            case 'caption':
                textSizePt = this.settings.captionSize;
                break;
            case 'lunnenDisplay':
                textSizePt = this.settings.lunnenDisplaySize;
                break;
            default:
                textSizePt = this.settings.textSize;
        }
        
        // Проверка на валидность значения
        if (!textSizePt || isNaN(textSizePt) || textSizePt <= 0) {
            textSizePt = 10; // Значение по умолчанию
        }
        
        // Конвертируем EM-кегль в мм
        const emSizeMm = MathUtils.ptToMm(textSizePt);
        
        // Фактические размеры capHeight и xHeight в мм при данном EM-кегле
        actualCapHeight = emSizeMm * (metrics.capHeight / metrics.unitsPerEm) * scale;
        actualXHeight = emSizeMm * (metrics.xHeight / metrics.unitsPerEm) * scale;
        
        // Проверка на NaN
        if (isNaN(actualCapHeight)) actualCapHeight = 0;
        if (isNaN(actualXHeight)) actualXHeight = 0;
        
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
        } else if (alignmentMode === 'cap-height') {
            // Cap-Height режим: верх заглавных букв выравнивается по ВЕРХУ элемента baseline
            // baseline текста должен быть ниже на величину cap height
            firstLineY = frontY + position.y + topMargin + actualCapHeight;
        } else {
            // Baseline режим (по умолчанию): baseline текста выравнивается по НИЗУ элемента baseline
            firstLineY = frontY + position.y + topMargin + baselineElementHeight;
        }
        
        // lineHeightSetting теперь хранится в пунктах, конвертируем в мм
        let lineHeightPt;
        switch(block.styleRef) {
            case 'headline':
                lineHeightPt = this.settings.lineHeight;
                break;
            case 'text':
                lineHeightPt = this.settings.textLineHeight;
                break;
            case 'caption':
                lineHeightPt = this.settings.captionLineHeight;
                break;
            case 'lunnenDisplay':
                lineHeightPt = this.settings.lunnenDisplayLineHeight;
                break;
            default:
                lineHeightPt = this.settings.textLineHeight;
        }
        
        // Проверка на валидность значения
        if (!lineHeightPt || isNaN(lineHeightPt) || lineHeightPt <= 0) {
            lineHeightPt = 12; // Значение по умолчанию
        }
        
        let lineHeightInMm = MathUtils.ptToMm(lineHeightPt) * scale;
        
        // Проверка на NaN
        if (isNaN(lineHeightInMm)) {
            lineHeightInMm = MathUtils.ptToMm(12) * scale;
        }
        
        // Create group for text block with hover
        const textGroup = this.createSVGElement('g', {
            id: `text-group-${block.id}`,
            style: this.editModeActive ? 'cursor: move;' : 'cursor: default;',
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
            } else if (alignmentMode === 'x-height' || alignmentMode === 'cap-height') {
                // В режиме x-height и cap-height все строки после первой НЕ привязываем к сетке
                // Используем точное расстояние согласно интерлиньяжу
                lineBaselineY = previousBaselineY + lineHeightInMm;
                previousBaselineY = lineBaselineY;
            } else {
                // В режиме baseline остальные строки привязываются к сетке
                const lineApproxY = previousBaselineY + lineHeightInMm;
                lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, false);
                previousBaselineY = lineBaselineY;
            }
            
            // Добавляем data-style для функции renderTextWithDCGlyph
            const textAttrsWithStyle = {
                ...textAttrs,
                'data-style': block.styleRef || 'text'
            };
            
            // Используем функцию замены символа ⎓ на SVG
            this.renderTextWithDCGlyph(line, textAttrsWithStyle, textX, lineBaselineY, textGroup, scale);
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
                style: `pointer-events: all; cursor: ${this.editModeActive ? 'move' : 'default'};`,
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
                // Но только если режим редактирования включен
                if (!hasMoved && (deltaX > 3 || deltaY > 3)) {
                    if (this.editModeActive) {
                        hasMoved = true;
                        this.startTextBlockDrag(block.id, mouseDownX, mouseDownY, frontX, frontY, scale);
                    }
                }
            };
            
            const mouseUpHandler = (upEvent) => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                
                // Если не было движения, обрабатываем как клик для открытия панели настроек
                // Клики работают всегда, не только в режиме редактирования
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
            
            // Отключаем изменение размера, если режим редактирования выключен
            if (!this.editModeActive) {
                return;
            }
            
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
            style: this.editModeActive ? 'cursor: move;' : 'cursor: default;',
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
        if (!block.svgContent || block.svgContent.trim() === '') return;
        
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
        
        // Для EAN13 учитываем внутренний левый отступ до полос
        const isEan = block.barcodeType === 'ean13' && block.leftPaddingMm != null && block.barsWidthMm != null;
        const scaleFactor = widthInMm > 0 ? (widthInMm / (block.originalWidth || widthInMm)) : 1;
        const leftPaddingScaled = isEan ? (block.leftPaddingMm * scaleFactor * scale) : 0;
        
        if (alignment === 'right') {
            // Для правого выравнивания: x — это ПРАВАЯ граница колонки, к которой прижимаются полосы
            const areaRightColumn = block.x;
            const areaRightEdge = frontX + module * margins * scale + (areaRightColumn - 1) * (columnWidth * scale + gutter * scale) + columnWidth * scale;
            // Смещаем SVG так, чтобы правая граница полос совпала с правой границей колонки
            graphicsX = areaRightEdge - widthInMm * scale;
        } else {
            // Для левого выравнивания: x — это ЛЕВАЯ граница колонки, с которой начинается первая полоса
            const columnLeftEdge = frontX + module * margins * scale + (block.x - 1) * (columnWidth * scale + gutter * scale);
            graphicsX = isEan ? (columnLeftEdge - leftPaddingScaled) : columnLeftEdge;
        }
        
        const graphicsY = frontY + yInBaseline * (module * scale) + topMargin;
        
        // Scale dimensions
        const scaledWidth = widthInMm * scale;
        const scaledHeight = heightInMm * scale;

        // Для штрихкода EAN-13 без цифр: подсветку считаем только по графической части
        let boundsX = graphicsX;
        let boundsWidth = scaledWidth;
        if (block.barcodeType === 'ean13' && block.leftPaddingMm != null && block.barsWidthMm != null) {
            const scaleFactor = widthInMm / block.originalWidth;
            const leftPaddingScaled = block.leftPaddingMm * scaleFactor * scale;
            const barsWidthScaled = (block.barsWidthMm * scaleFactor) * scale;
            boundsX = graphicsX + leftPaddingScaled;
            boundsWidth = barsWidthScaled;
        }
        
        // Create group for graphics
        const graphicsGroup = this.createSVGElement('g', {
            id: `graphics-group-${block.id}`,
            style: this.editModeActive ? 'cursor: move;' : 'cursor: default;',
            'data-block-id': block.id
        }, container);
        
        // Create bounds rectangle (initially hidden)
        // This rectangle serves as the active area for mouse events
        const boundsRect = this.createSVGElement('rect', {
            x: boundsX,
            y: graphicsY,
            width: boundsWidth,
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
        // Use contentColor for graphics blocks (except barcodes which use gridColor)
        const contentColor = this.settings.contentColor || '#17264E';
        const svgColor = block.barcodeType ? gridColor : contentColor;
        const nestedSvg = this.createSVGElement('svg', {
            x: graphicsX,
            y: graphicsY,
            width: scaledWidth,
            height: scaledHeight,
            viewBox: `0 0 ${block.originalWidth} ${block.originalHeight}`,
            preserveAspectRatio: 'xMinYMin meet',
            style: `color: ${svgColor}; overflow: visible; pointer-events: none;`
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
            let hasMoved = false;
            
            const mouseMoveHandler = (e) => {
                const deltaX = Math.abs(e.clientX - mouseDownX);
                const deltaY = Math.abs(e.clientY - mouseDownY);
                
                // Если мышь сдвинулась больше чем на 3 пикселя, начинаем drag
                // Но только если режим редактирования включен
                if (!hasMoved && (deltaX > 3 || deltaY > 3)) {
                    if (this.editModeActive) {
                        hasMoved = true;
                        
                        // Start dragging
                        this.textDragState.isDragging = true;
                        this.textDragState.blockId = block.id;
                        this.textDragState.startMouseX = mouseDownX;
                        this.textDragState.startMouseY = mouseDownY;
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
                    }
                }
                
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
                
                // Calculate graphics width for drag constraints
                // Для EAN-13 используем только ширину полос (barsWidthMm),
                // без левого поля с первой цифрой, чтобы блок вел себя
                // как «одноколоночный» и не перепрыгивал во вторую колонку.
                let widthInMm;
                if (block.barcodeType === 'ean13' && block.barsWidthMm != null) {
                    widthInMm = block.barsWidthMm;
                } else {
                    const heightInMm = module * block.heightInModules;
                    const aspectRatio = block.originalWidth / block.originalHeight;
                    widthInMm = heightInMm * aspectRatio;
                }
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
            
            const mouseUpHandler = (upEvent) => {
                const wasDragging = this.textDragState.isDragging;
                this.textDragState.isDragging = false;
                
                // Check if it was a click (not a drag)
                // Клики работают всегда, не только в режиме редактирования
                if (!hasMoved) {
                    const timeDiff = Date.now() - mouseDownTime;
                    const distance = Math.sqrt(
                        Math.pow(upEvent.clientX - mouseDownX, 2) + 
                        Math.pow(upEvent.clientY - mouseDownY, 2)
                    );
                    
                    // Более щедрые условия для клика: 300мс и 10px
                    if (timeDiff < 300 && distance < 10) {
                        // It's a click - open settings panel
                        this.showGraphicsEditPanel(block.id);
                    }
                }
                
                // Hide bounds after drag
                if (graphicsGroup.boundsElement && wasDragging) {
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
        // Используем getGraphicsBlock для консистентности и производительности
        const block = this.getGraphicsBlock(blockId);
        if (!block) return;
        
        // Отладка: проверяем, что блок имеет нужные свойства для штрихкода
        console.log('🔍 showGraphicsEditPanel для блока:', blockId, {
            hasBarcodeType: !!block.barcodeType,
            barcodeType: block.barcodeType,
            hasBarcode: !!block.barcode,
            barcode: block.barcode,
            editModeActive: this.editModeActive
        });
        
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
        
        // Check if this is a barcode block (универсально для всех пресетов)
        const barcodeInfo = this.getBarcodeTypeFromBlock(block);
        const isBarcode = barcodeInfo !== null;
        
        // Отладка
        console.log('🔍 Проверка штрихкода:', {
            blockId: blockId,
            isBarcode,
            barcodeInfo,
            editModeActive: this.editModeActive
        });
        
        if (isBarcode) {
            // Show barcode input area, hide file upload area
            if (this.dom.fileUploadArea) {
                this.dom.fileUploadArea.style.display = 'none';
            }
            if (this.dom.barcodeInputArea) {
                this.dom.barcodeInputArea.style.display = 'block';
            }
            // Set current barcode data if available
            if (this.dom.barcodeDataInput) {
                // Try to extract barcode data from SVG text elements, or use stored value
                let currentData = block.barcodeData || '';
                if (!currentData && block.svgContent) {
                    // Try to extract from SVG text content
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(block.svgContent, 'image/svg+xml');
                    const textElements = svgDoc.querySelectorAll('text');
                    if (textElements.length > 0) {
                        // For EAN-13, combine all text elements; for Code128, use the single text element
                        // Используем barcodeInfo для определения типа (универсально для всех пресетов)
                        if (barcodeInfo.barcodeType === 'ean13') {
                            // EAN-13 has multiple text elements (first digit + left group + right group)
                            const texts = Array.from(textElements).map(el => el.textContent.trim()).join('');
                            currentData = texts;
                        } else {
                            // Code128 has a single text element
                            currentData = textElements[0].textContent.trim();
                        }
                    }
                }
                this.dom.barcodeDataInput.value = currentData;
                // Обновляем счетчик символов при открытии панели редактирования
                this.updateBarcodeCharCounter();
            }
        } else {
            // Show file upload area, hide barcode input area
            if (this.dom.fileUploadArea) {
                this.dom.fileUploadArea.style.display = 'block';
                const placeholder = this.dom.fileUploadArea.querySelector('.upload-placeholder p');
                if (placeholder) {
                    placeholder.textContent = `Current: ${block.name || 'Graphic'} — Upload new SVG to replace`;
                }
            }
            if (this.dom.barcodeInputArea) {
                this.dom.barcodeInputArea.style.display = 'none';
            }
        }
        
        // Update action button icons and visibility
        const graphicsHideBtn = document.getElementById('graphicsHideBtn');
        const graphicsDeleteBtn = document.getElementById('graphicsDeleteBtn');
        
        if (graphicsHideBtn) {
            // Update hide icon based on visibility
            const svg = graphicsHideBtn.querySelector('svg');
            if (svg) {
                // Используем константы из Constants.js вместо дублирования SVG строк
                // Логика: если visible === true, показываем иконку "скрыть" (EYE_HIDDEN)
                svg.innerHTML = block.visible ? ICONS.EYE_HIDDEN : ICONS.EYE_VISIBLE;
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
            
            // Вне режима редактирования для штрихкодов показываем только поле ввода кода
            if (!this.editModeActive && isBarcode) {
                // Показываем секцию
                const allSections = this.dom.graphicsPanel.querySelectorAll('.control-section');
                allSections.forEach(section => {
                    section.style.display = 'block';
                });
                
                // Скрываем fileUploadArea, если он есть
                if (this.dom.fileUploadArea) {
                    this.dom.fileUploadArea.style.display = 'none';
                }
                
                // Скрываем все control-group и control-row, кроме родительского элемента barcodeInputArea
                const allGroups = this.dom.graphicsPanel.querySelectorAll('.control-group, .control-row');
                allGroups.forEach(group => {
                    // Не скрываем barcodeInputArea и его родительский control-group
                    if (group.id !== 'barcodeInputArea' && !group.contains(this.dom.barcodeInputArea)) {
                        group.style.display = 'none';
                    }
                });
                
                // Показываем родительский control-group, который содержит barcodeInputArea
                if (this.dom.barcodeInputArea && this.dom.barcodeInputArea.parentElement) {
                    const parentGroup = this.dom.barcodeInputArea.parentElement.closest('.control-group');
                    if (parentGroup) {
                        parentGroup.style.display = 'block';
                    }
                }
                
                // Показываем только поле ввода штрихкода (на случай, если оно было скрыто)
                if (this.dom.barcodeInputArea) {
                    this.dom.barcodeInputArea.style.display = 'block';
                }
                
                // Скрываем кнопки действий в заголовке
                const headerActions = this.dom.graphicsPanel.querySelector('.panel-header-actions');
                if (headerActions) {
                    headerActions.style.display = 'none';
                }
            } else if (!this.editModeActive) {
                // Для не-штрихкодов вне режима редактирования скрываем панель
                this.dom.graphicsPanel.style.display = 'none';
                this.dom.graphicsPanel.classList.remove('active');
                return;
            } else {
                // В режиме редактирования показываем все элементы
                const allSections = this.dom.graphicsPanel.querySelectorAll('.control-section');
                allSections.forEach(section => {
                    section.style.display = '';
                });
                
                // Показываем все группы внутри секций
                const allGroups = this.dom.graphicsPanel.querySelectorAll('.control-group, .control-row');
                allGroups.forEach(group => {
                    group.style.display = '';
                });
                
                const headerActions = this.dom.graphicsPanel.querySelector('.panel-header-actions');
                if (headerActions) {
                    headerActions.style.display = '';
                }
            }
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
            style: this.editModeActive ? 'cursor: move;' : 'cursor: default;',
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
        if (!block.svgContent || block.svgContent.trim() === '') return;
        
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
        
        // Для EAN13 учитываем внутренний левый отступ до полос
        const isEan = block.barcodeType === 'ean13' && block.leftPaddingMm != null && block.barsWidthMm != null;
        const scaleFactor = widthInMm > 0 ? (widthInMm / (block.originalWidth || widthInMm)) : 1;
        const leftPaddingScaled = isEan ? (block.leftPaddingMm * scaleFactor * scale) : 0;
        
        if (alignment === 'right') {
            // Для правого выравнивания: x — это ПРАВАЯ граница колонки, к которой прижимаются полосы
            const areaRightColumn = block.x;
            const areaRightEdge = frontX + module * margins * scale + (areaRightColumn - 1) * (columnWidth * scale + gutter * scale) + columnWidth * scale;
            // Смещаем SVG так, чтобы правая граница полос совпала с правой границей колонки
            graphicsX = areaRightEdge - widthInMm * scale;
        } else {
            // Для левого выравнивания: x — это ЛЕВАЯ граница колонки, с которой начинается первая полоса
            const columnLeftEdge = frontX + module * margins * scale + (block.x - 1) * (columnWidth * scale + gutter * scale);
            graphicsX = isEan ? (columnLeftEdge - leftPaddingScaled) : columnLeftEdge;
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
            // Только левая кнопка мыши
            if (e.button !== 0) return;
            
            e.stopPropagation();
            e.preventDefault();
            
            mouseDownTime = Date.now();
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            let hasMoved = false;
            
            const mouseMoveHandler = (e) => {
                const deltaX = Math.abs(e.clientX - mouseDownX);
                const deltaY = Math.abs(e.clientY - mouseDownY);
                
                // Если мышь сдвинулась больше чем на 3 пикселя, начинаем drag
                // Но только если режим редактирования включен
                if (!hasMoved && (deltaX > 3 || deltaY > 3)) {
                    if (this.editModeActive) {
                        hasMoved = true;
                        
                        // Start dragging
                        this.textDragState.isDragging = true;
                        this.textDragState.blockId = block.id;
                        this.textDragState.startMouseX = mouseDownX;
                        this.textDragState.startMouseY = mouseDownY;
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
                    }
                }
                
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
            
            const mouseUpHandler = (upEvent) => {
                const wasDragging = this.textDragState.isDragging;
                this.textDragState.isDragging = false;
                
                // Check if it was a click (not a drag)
                // Клики работают всегда, не только в режиме редактирования
                if (!hasMoved) {
                    const timeDiff = Date.now() - mouseDownTime;
                    const distance = Math.sqrt(
                        Math.pow(upEvent.clientX - mouseDownX, 2) + 
                        Math.pow(upEvent.clientY - mouseDownY, 2)
                    );
                    
                    // Более щедрые условия для клика: 300мс и 10px
                    if (timeDiff < 300 && distance < 10) {
                        // It's a click - open settings panel (same as user graphics)
                        this.showGraphicsEditPanel('icons');
                    }
                }
                
                // Hide bounds after drag
                if (iconsGroup.boundsElement && wasDragging) {
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
            // Только левая кнопка мыши
            if (e.button !== 0) return;
            
            e.stopPropagation();
            e.preventDefault();
            
            mouseDownTime = Date.now();
            mouseDownX = e.clientX;
            mouseDownY = e.clientY;
            let hasMoved = false;
            
            const mouseMoveHandler = (e) => {
                const deltaX = Math.abs(e.clientX - mouseDownX);
                const deltaY = Math.abs(e.clientY - mouseDownY);
                
                // Если мышь сдвинулась больше чем на 3 пикселя, начинаем drag
                // Но только если режим редактирования включен
                if (!hasMoved && (deltaX > 3 || deltaY > 3)) {
                    if (this.editModeActive) {
                        hasMoved = true;
                        
                        // Start dragging
                        this.textDragState.isDragging = true;
                        this.textDragState.blockId = block.id;
                        this.textDragState.startMouseX = mouseDownX;
                        this.textDragState.startMouseY = mouseDownY;
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
                    }
                }
                
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
            
            const mouseUpHandler = (upEvent) => {
                const wasDragging = this.textDragState.isDragging;
                this.textDragState.isDragging = false;
                
                // Check if it was a click (not a drag)
                // Клики работают всегда, не только в режиме редактирования
                if (!hasMoved) {
                    const timeDiff = Date.now() - mouseDownTime;
                    const distance = Math.sqrt(
                        Math.pow(upEvent.clientX - mouseDownX, 2) + 
                        Math.pow(upEvent.clientY - mouseDownY, 2)
                    );
                    
                    // Более щедрые условия для клика: 300мс и 10px
                    if (timeDiff < 300 && distance < 10) {
                        // It's a click - open settings panel (same as user graphics)
                        this.showGraphicsEditPanel('claim');
                    }
                }
                
                // Hide bounds after drag
                if (claimGroup.boundsElement && wasDragging) {
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
        // Clear existing items (используем DOMUtils для лучшей производительности)
        DOMUtils.clearElement(this.dom.elementsList);
        
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
    
    // Update Data Rows List with loaded data rows
    updateDataRowsList() {
        if (!this.dom.dataRowsList) return;
        if (!this.loadedTableData || this.loadedTableData.length === 0) {
            // Clear existing items (используем DOMUtils для лучшей производительности)
            DOMUtils.clearElement(this.dom.dataRowsList);
            return;
        }
        
        // Clear existing items (используем DOMUtils для лучшей производительности)
        DOMUtils.clearElement(this.dom.dataRowsList);
        
        // Add each data row
        this.loadedTableData.forEach((row, index) => {
            // Формируем название начиная с колонки B (row[1])
            // Данные из CSV приходят как массив массивов, не объектов
            const parts = [];
            if (row[1]) parts.push(row[1]); // Колонка B
            if (row[2]) parts.push(row[2]); // Колонка C (если есть)
            if (row[3]) parts.push(row[3]); // Колонка D (если есть)
            
            let displayName = parts.length > 0 ? parts.join(' ') : `Row ${index + 1}`;
            
            // Проверяем, был ли макет изменен вручную
            const isModified = this.modifiedRowsData && this.modifiedRowsData[index];
            if (isModified) {
                displayName = `* ${displayName}`;
            }
            
            const wrapper = document.createElement('div');
            wrapper.className = 'element-item-wrapper';
            
            const button = document.createElement('button');
            button.className = 'element-item';
            button.dataset.rowIndex = index;
            
            // Add active class if this is current row
            if (index === this.currentRowIndex) {
                button.classList.add('active');
            }
            
            // Create label with truncated text
            const label = document.createElement('span');
            label.className = 'element-name';
            label.textContent = displayName;
            label.title = displayName;
            
            button.appendChild(label);
            wrapper.appendChild(button);
            
            // Click handler to switch to this row
            button.addEventListener('click', () => {
                this.switchToDataRow(index);
            });
            
            this.dom.dataRowsList.appendChild(wrapper);
        });
    }
    
    // Switch to specific data row
    switchToDataRow(rowIndex) {
        if (!this.loadedTableData || rowIndex >= this.loadedTableData.length) return;
        
        // Устанавливаем флаг переключения, чтобы предотвратить сохранение состояния
        this.isSwitchingRow = true;
        
        // Если есть незавершенный таймер сохранения, завершаем его немедленно
        // Это сохранит изменения, которые пользователь только что сделал
        if (this.currentRowIndex !== null && this.currentRowIndex !== rowIndex && this.saveRowStateTimeout) {
            clearTimeout(this.saveRowStateTimeout);
            this.saveRowStateTimeout = null;
            // Сохраняем состояние только если пользователь действительно что-то изменил
            // (markCurrentRowAsModifiedIfNeeded вызывается только при реальных изменениях)
            this.saveCurrentRowState();
            this.updateDataRowsList();
        }
        // НЕ сохраняем состояние при простом переключении без изменений
        
        this.currentRowIndex = rowIndex;
        
        // Update grid with data from this row
        this.updateSingleSticker(rowIndex);
        
        // Update list to show active row
        this.updateDataRowsList();
        
        // Сбрасываем флаг переключения после небольшой задержки
        setTimeout(() => {
            this.isSwitchingRow = false;
        }, 100);
    }
    
    // Update grid with data from specific row
    updateSingleSticker(rowIndex) {
        if (!this.loadedTableData || rowIndex >= this.loadedTableData.length) return;
        
        // Устанавливаем флаг программного обновления
        this.isProgrammaticUpdate = true;
        
        // Проверяем, есть ли сохраненные изменения для этого макета
        if (this.modifiedRowsData[rowIndex]) {
            // Восстанавливаем сохраненные изменения
            const savedData = this.modifiedRowsData[rowIndex];
            if (savedData.textBlocks) {
                this.textBlocks = JSON.parse(JSON.stringify(savedData.textBlocks));
            }
            if (savedData.graphicsBlocks) {
                this.graphicsBlocks = JSON.parse(JSON.stringify(savedData.graphicsBlocks));
            }
            // ВАЖНО: Синхронизируем индексы после восстановления блоков
            this._syncTextBlocksIndex();
            this._syncGraphicsBlocksIndex();
            console.log(`✅ Восстановлены сохраненные изменения для макета ${rowIndex + 1}`);
        } else {
            // Восстанавливаем оригинальные текстовые блоки с плейсхолдерами
            if (this.originalTextBlocks) {
                this.textBlocks = JSON.parse(JSON.stringify(this.originalTextBlocks));
            }
            
            // Восстанавливаем оригинальные графические блоки
            if (this.originalGraphicsBlocks) {
                this.graphicsBlocks = JSON.parse(JSON.stringify(this.originalGraphicsBlocks));
            }
            
            // ВАЖНО: Синхронизируем индексы после восстановления оригинальных блоков
            this._syncTextBlocksIndex();
            this._syncGraphicsBlocksIndex();
            
            // Применяем данные из таблицы
            const row = this.loadedTableData[rowIndex];
            this.updateTextBlocksFromRow(row, rowIndex);
        }
        
        this.updateGrid();
        
        // Сбрасываем флаг программного обновления после небольшой задержки
        setTimeout(() => {
            this.isProgrammaticUpdate = false;
        }, 100);
    }
    
    // Сохраняет текущее состояние макета перед переключением
    saveCurrentRowState() {
        if (this.currentRowIndex === null) return;
        
        // Сохраняем текущие текстовые и графические блоки
        this.modifiedRowsData[this.currentRowIndex] = {
            textBlocks: JSON.parse(JSON.stringify(this.textBlocks)),
            graphicsBlocks: JSON.parse(JSON.stringify(this.graphicsBlocks))
        };
        
        console.log(`💾 Сохранено состояние макета ${this.currentRowIndex + 1}`);
    }
    
    // Помечает текущий макет как измененный (с debounce для оптимизации)
    markCurrentRowAsModifiedIfNeeded() {
        // Проверяем, загружены ли данные из таблицы и есть ли активный макет
        if (!this.loadedTableData || this.currentRowIndex === null) return;
        
        // Не сохраняем состояние при переключении между макетами
        if (this.isSwitchingRow) return;
        
        // Не сохраняем состояние при программных обновлениях (загрузка данных, применение данных из строки)
        if (this.isProgrammaticUpdate) return;
        
        // Очищаем предыдущий таймер
        if (this.saveRowStateTimeout) {
            clearTimeout(this.saveRowStateTimeout);
        }
        
        // Устанавливаем новый таймер для сохранения состояния через 300мс после последнего изменения
        this.saveRowStateTimeout = setTimeout(() => {
            this.saveCurrentRowState();
            // Обновляем список макетов, чтобы показать звездочку
            this.updateDataRowsList();
        }, 300);
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
            // Используем константы из Constants.js вместо дублирования SVG строк
            // Логика: если isVisible === true, показываем иконку "видимый" (EYE_VISIBLE)
            visIcon.innerHTML = createSVGIcon(isVisible ? ICONS.EYE_VISIBLE : ICONS.EYE_HIDDEN);
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
                            // Используем константы из Constants.js вместо дублирования SVG строк
                            visIcon.innerHTML = createSVGIcon(block.visible ? ICONS.EYE_VISIBLE : ICONS.EYE_HIDDEN);
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
                            // Используем константы из Constants.js вместо дублирования SVG строк
                            visIcon.innerHTML = createSVGIcon(block.visible ? ICONS.EYE_VISIBLE : ICONS.EYE_HIDDEN);
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
                            // Используем константы из Constants.js вместо дублирования SVG строк
                            // Логика: если visible === true, показываем иконку "скрыть" (EYE_HIDDEN)
                            svg.innerHTML = block.visible ? ICONS.EYE_HIDDEN : ICONS.EYE_VISIBLE;
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
                        // Обновляем индекс после удаления
                        this._syncTextBlocksIndex();
                    }
                } else if ((type === 'graphics' || type === 'icons' || type === 'claim') && blockId) {
                    if (this.graphicsBlocks) {
                        const index = this.graphicsBlocks.findIndex(b => b.id === blockId);
                        if (index !== -1) {
                            // Allow deletion of all graphics blocks (including built-in)
                            this.graphicsBlocks.splice(index, 1);
                            // Обновляем индекс после удаления
                            this._syncGraphicsBlocksIndex();
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
                // Обновляем индекс после удаления
                this._syncTextBlocksIndex();
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
        // Обновляем индекс после добавления
        this.textBlocksById.set(newId, newBlock);
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
        // Обновляем индекс после добавления
        this.graphicsBlocksById.set(newId, newBlock);
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
            
            // Добавляем data-style для функции renderTextWithDCGlyph
            const textAttrsWithStyle = {
                ...textAttrs,
                'data-style': 'headline'
            };
            
            // Используем функцию замены символа ⎓ на SVG
            this.renderTextWithDCGlyph(line, textAttrsWithStyle, textX, lineBaselineY, textGroup, scale);
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
            
            // Добавляем data-style для функции renderTextWithDCGlyph
            const textAttrsWithStyle = {
                ...textAttrs,
                'data-style': 'text'
            };
            
            // Используем функцию замены символа ⎓ на SVG
            this.renderTextWithDCGlyph(line, textAttrsWithStyle, textX, lineBaselineY, textGroup, scale);
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
    
    /**
     * Планирует обновление сетки с использованием requestAnimationFrame для оптимизации производительности.
     * Множественные вызовы будут объединены в один кадр анимации.
     * Используйте updateGridImmediate() если требуется синхронное обновление (например, при экспорте).
     */
    scheduleGridUpdate() {
        // Если обновление уже запланировано, ничего не делаем
        if (this.updateGridPending) {
            return;
        }
        
        this.updateGridPending = true;
        
        // Отменяем предыдущий запрос, если он был
        if (this.updateGridAnimationFrame !== null) {
            cancelAnimationFrame(this.updateGridAnimationFrame);
        }
        
        // Планируем обновление на следующий кадр анимации
        this.updateGridAnimationFrame = requestAnimationFrame(() => {
            this._updateGrid();
            this.updateGridPending = false;
            this.updateGridAnimationFrame = null;
        });
    }
    
    /**
     * Немедленное обновление сетки без debouncing.
     * Используется в критических случаях, когда требуется синхронное обновление:
     * - При экспорте SVG
     * - При загрузке пресета
     * - При инициализации
     */
    updateGridImmediate() {
        // Отменяем запланированное обновление, если оно есть
        if (this.updateGridAnimationFrame !== null) {
            cancelAnimationFrame(this.updateGridAnimationFrame);
            this.updateGridAnimationFrame = null;
        }
        this.updateGridPending = false;
        
        // Выполняем обновление немедленно
        this._updateGrid();
    }
    
    /**
     * Публичный метод для обратной совместимости.
     * По умолчанию использует debouncing через scheduleGridUpdate().
     */
    updateGrid() {
        this.scheduleGridUpdate();
    }
    
    /**
     * Внутренний метод, выполняющий фактическое обновление сетки.
     * @private
     */
    _updateGrid() {
        // Constrain elements to grid bounds if lockPosition is enabled
        this.constrainElementsToBounds();
        
        const { frontWidth, frontHeight } = this.settings;
        
        // Calculate scale to fit in display area
        const maxDimension = Math.max(frontWidth, frontHeight);
        const availableSize = this.DISPLAY_SIZE - 2 * this.PADDING;
        const scale = availableSize / maxDimension;
        
        // Set SVG to fixed size (square, equal to viewport height)
        const svgSize = this.DISPLAY_SIZE;
        this.dom.svg.setAttribute('width', svgSize);
        this.dom.svg.setAttribute('height', svgSize);
        this.dom.svg.setAttribute('viewBox', `0 0 ${svgSize} ${svgSize}`);
        
        // Clear existing content (используем DOMUtils для лучшей производительности)
        DOMUtils.clearElement(this.dom.svg);
        
        // Calculate scaled dimensions
        const scaledFrontWidth = frontWidth * scale;
        const scaledFrontHeight = frontHeight * scale;
        
        // Calculate positions (perfectly centered)
        const startX = (svgSize - scaledFrontWidth) / 2;
        const startY = (svgSize - scaledFrontHeight) / 2;
        
        // Draw rectangles
        this.drawRectangles(this.dom.svg, startX, startY, scaledFrontWidth, scaledFrontHeight, scale);
        
        // Draw labels if enabled (but default is false now)
        if (this.settings.showLabels) {
            this.drawLabels(this.dom.svg, startX, startY, scaledFrontWidth, scaledFrontHeight);
        }
        
        // Draw grid elements on front panel
        const frontX = startX;
        const frontY = startY;
        
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
            
        }
        
        
        // Draw text blocks, icons and claim on front panel (if enabled)
        if (this.settings.showObjects) {
            // ============================================
            // Итерация 6: Используем старый код для browser view
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
        
        // Сохраняем состояние макета после изменений (если данные загружены из таблицы)
        this.markCurrentRowAsModifiedIfNeeded();
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
    
    /**
     * Заменяет символ ⎓ (U+2393) на SVG элемент dc_m_glyph.svg
     * Создает группу с text/tspan элементами для текста и SVG для символа
     * Использует предзагруженный SVG из this.dcGlyphSVGContent
     */
    renderTextWithDCGlyph(text, textAttrs, x, y, container, scale = 1) {
        const dcGlyphChar = '\u2393'; // Символ ⎓
        
        // Заменяем "==" на символ ⎓
        text = text.replace(/==/g, dcGlyphChar);
        
        // Если символа нет в тексте, просто создаем обычный text элемент
        if (!text.includes(dcGlyphChar) || !this.dcGlyphSVGContent) {
            const textElement = this.createSVGElement('text', {
                ...textAttrs,
                x: x,
                y: y
            }, container);
            textElement.textContent = text;
            return textElement;
        }
        
        // Создаем группу для строки с текстом и SVG элементами
        const lineGroup = this.createSVGElement('g', {
            class: 'text-line-with-glyph'
        }, container);
        
        // Разбиваем строку на части по символу ⎓
        const parts = text.split(dcGlyphChar);
        
        // Обрабатываем пробелы вокруг символа ⎓ для корректного позиционирования:
        // Если слева от ⎓ есть пробел, оставляем его в левой части
        // Если справа от ⎓ есть пробел, оставляем его в правой части
        // Но нужно добавить один пробел между текстом и символом
        const processedParts = parts.map((part, index) => {
            if (index === 0 && part.endsWith(' ')) {
                // Первая часть: убираем trailing пробел, добавим его позже как отдельный элемент
                return { text: part.trimEnd(), trailingSpace: true };
            } else if (index > 0 && part.startsWith(' ')) {
                // Части после первой: убираем leading пробел, добавим его перед текстом
                return { text: part.trimStart(), leadingSpace: true };
            }
            return { text: part, trailingSpace: false, leadingSpace: false };
        });
        
        let currentX = x;
        
        // Получаем размер шрифта для расчета ширины символа
        const fontSize = parseFloat(textAttrs['font-size']) || 10;
        const styleRef = textAttrs['data-style'] || 'text';
        const metrics = this.getFontMetricsForStyle(styleRef);
        const capHeight = fontSize * (metrics.capHeight / metrics.unitsPerEm);
        
        // Читаем viewBox из SVG динамически
        let glyphViewBoxWidth = 56.6929134; // значения по умолчанию
        let glyphViewBoxHeight = 28.3464565;
        
        if (this.dcGlyphSVGContent) {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(this.dcGlyphSVGContent, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');
            if (svgElement) {
                const viewBox = svgElement.getAttribute('viewBox');
                if (viewBox) {
                    const viewBoxParts = viewBox.split(/\s+/);
                    if (viewBoxParts.length >= 4) {
                        glyphViewBoxWidth = parseFloat(viewBoxParts[2]) || glyphViewBoxWidth;
                        glyphViewBoxHeight = parseFloat(viewBoxParts[3]) || glyphViewBoxHeight;
                    }
                }
            }
        }
        
        // Высота символа должна быть равна capHeight
        const glyphAspectRatio = glyphViewBoxWidth / glyphViewBoxHeight;
        const glyphHeight = capHeight;
        const glyphWidth = glyphHeight * glyphAspectRatio;
        
        // Рендерим каждую часть
        processedParts.forEach((partData, index) => {
            // Добавляем пробел перед текстом, если он был в начале части
            if (partData.leadingSpace) {
                const spaceElement = this.createSVGElement('text', {
                    ...textAttrs,
                    x: currentX,
                    y: y
                }, lineGroup);
                spaceElement.textContent = ' ';
                
                // Вычисляем ширину пробела
                const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                tempSvg.style.position = 'absolute';
                tempSvg.style.visibility = 'hidden';
                document.body.appendChild(tempSvg);
                const tempText = this.createSVGElement('text', textAttrs, tempSvg);
                tempText.textContent = ' ';
                const spaceWidth = tempText.getBBox().width;
                document.body.removeChild(tempSvg);
                currentX += spaceWidth;
            }
            
            // Добавляем текстовую часть
            if (partData.text) {
                const textElement = this.createSVGElement('text', {
                    ...textAttrs,
                    x: currentX,
                    y: y
                }, lineGroup);
                textElement.textContent = partData.text;
                
                // Вычисляем ширину текста для позиционирования следующего элемента
                const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                tempSvg.style.position = 'absolute';
                tempSvg.style.visibility = 'hidden';
                document.body.appendChild(tempSvg);
                const tempText = this.createSVGElement('text', textAttrs, tempSvg);
                tempText.textContent = partData.text;
                const bbox = tempText.getBBox();
                document.body.removeChild(tempSvg);
                currentX += bbox.width;
            }
            
            // Добавляем пробел после текста, если он был в конце части
            if (partData.trailingSpace) {
                const spaceElement = this.createSVGElement('text', {
                    ...textAttrs,
                    x: currentX,
                    y: y
                }, lineGroup);
                spaceElement.textContent = ' ';
                
                // Вычисляем ширину пробела
                const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                tempSvg.style.position = 'absolute';
                tempSvg.style.visibility = 'hidden';
                document.body.appendChild(tempSvg);
                const tempText = this.createSVGElement('text', textAttrs, tempSvg);
                tempText.textContent = ' ';
                const spaceWidth = tempText.getBBox().width;
                document.body.removeChild(tempSvg);
                currentX += spaceWidth;
            }
            
            // Добавляем SVG символ после текстовой части (кроме последней)
            if (index < processedParts.length - 1) {
                // Создаем use элемент или встраиваем SVG
                const glyphGroup = this.createSVGElement('g', {
                    transform: `translate(${currentX}, ${y - capHeight})`
                }, lineGroup);
                
                // Создаем SVG элемент из предзагруженного содержимого
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(this.dcGlyphSVGContent, 'image/svg+xml');
                const svgElement = svgDoc.querySelector('svg');
                
                if (svgElement) {
                    // Получаем viewBox из исходного SVG (если не был прочитан ранее)
                    let viewBoxWidth = glyphViewBoxWidth;
                    let viewBoxHeight = glyphViewBoxHeight;
                    const originalViewBox = svgElement.getAttribute('viewBox');
                    if (originalViewBox) {
                        const viewBoxParts = originalViewBox.split(/\s+/);
                        if (viewBoxParts.length >= 4) {
                            viewBoxWidth = parseFloat(viewBoxParts[2]) || viewBoxWidth;
                            viewBoxHeight = parseFloat(viewBoxParts[3]) || viewBoxHeight;
                        }
                    }
                    
                    // Пересчитываем пропорции на основе актуального viewBox
                    const aspectRatio = viewBoxWidth / viewBoxHeight;
                    const actualGlyphHeight = capHeight;
                    const actualGlyphWidth = actualGlyphHeight * aspectRatio;
                    
                    // Клонируем SVG элемент и масштабируем его
                    const glyphClone = svgElement.cloneNode(true);
                    glyphClone.setAttribute('width', actualGlyphWidth);
                    glyphClone.setAttribute('height', actualGlyphHeight);
                    glyphClone.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
                    glyphClone.setAttribute('preserveAspectRatio', 'xMinYMin meet');
                    
                    // Устанавливаем цвет заливки из textAttrs (цвет текста)
                    const fillColor = textAttrs.fill || '#000000';
                    const fillOpacity = textAttrs['fill-opacity'] || '1';
                    
                    // Удаляем стили из defs, чтобы они не переопределяли fill
                    const defs = glyphClone.querySelector('defs');
                    if (defs) {
                        defs.remove();
                    }
                    
                    // Устанавливаем цвет заливки на все path элементы
                    const paths = glyphClone.querySelectorAll('path');
                    paths.forEach(path => {
                        // Удаляем класс, чтобы стиль из класса не переопределял fill
                        path.removeAttribute('class');
                        path.setAttribute('fill', fillColor);
                        path.setAttribute('fill-opacity', fillOpacity);
                    });
                    
                    glyphGroup.appendChild(glyphClone);
                    
                    // Сдвигаем текущую позицию на ширину символа
                    currentX += actualGlyphWidth;
                }
            }
        });
        
        return lineGroup;
    }
    
    /**
     * Загружает SVG файл dc_m_glyph.svg и сохраняет его содержимое
     */
    async loadDCGlyphSVG() {
        try {
            const response = await fetch('graphics/dc_m_glyph.svg');
            if (response.ok) {
                this.dcGlyphSVGContent = await response.text();
            } else {
                console.warn('Не удалось загрузить dc_m_glyph.svg');
            }
        } catch (error) {
            console.warn('Ошибка при загрузке dc_m_glyph.svg:', error);
        }
    }
    
    drawRectangles(container, x, y, frontW, frontH, scale = 1) {
        // Front panel
        this.createSVGElement('rect', {
            x: x,
            y: y,
            width: frontW,
            height: frontH,
            fill: this.settings.boxColor
        }, container);
    }
    
    drawDimensions(container, x, y, frontW, frontH, scale = 1) {
        const { frontWidth, frontHeight } = this.settings;
        const offset = scale === 1 ? 5 : 15; // smaller offset in mm for export
        const fontSize = scale === 1 ? '3' : null; // fontSize only for export
        
        // Front width dimension (below front panel)
        this.createDimensionText(
            container,
            x + frontW / 2,
            y + frontH + offset,
            `${frontWidth.toFixed(1)} mm`,
            'middle',
            fontSize
        );
        
        // Front height dimension (right of front panel)
        this.createDimensionText(
            container,
            x + frontW + offset,
            y + frontH / 2,
            `${frontHeight.toFixed(1)} mm`,
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
    
    drawLabels(container, x, y, frontW, frontH, scale = 1) {
        const fontSize = scale === 1 ? '4' : null;
        
        // Front label
        this.createLabel(container, x + frontW / 2, y + frontH / 2, 'FRONT', false, fontSize);
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
        // Используем цвет контента вместо вычисления контраста
        return this.settings.contentColor || '#17264E';
    }
    
    getGridOpacity(baseOpacity) {
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
    
    /**
     * Определяет тип устройства на основе имени пресета
     * @returns {string} - 'tablet' или 'laptop' (по умолчанию 'laptop')
     */
    getDeviceType() {
        const presetName = this.currentPresetName || '';
        // Проверяем, содержит ли имя пресета слово "tablet" (регистронезависимо)
        if (presetName.toLowerCase().includes('tablet')) {
            return 'tablet';
        }
        // По умолчанию используем 'laptop'
        return 'laptop';
    }

    // Итерация 7: Упрощенный экспорт SVG через SVGExporter
    async exportSVG() {
        try {
            const { frontWidth, frontHeight, gridModule, columnCount, rowCount } = this.settings;
            
            // Создаем SVG для экспорта (scale = 1 для точных размеров)
            const exportSvg = await this.createExportSVG();
            
            // Генерируем timestamp с точностью до минуты
            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            
            // Генерируем имя файла: "размер колонки строки модуль timestamp.svg"
            // Формируем имя файла: "(значение из ячейки B)_[device]_label_120×24mm.svg"
            // Получаем значение из ячейки B текущей строки данных
            let cellBValue = '';
            if (this.loadedTableData && 
                this.currentRowIndex !== null && 
                this.currentRowIndex !== undefined &&
                this.currentRowIndex >= 0 && 
                this.currentRowIndex < this.loadedTableData.length) {
                const currentRow = this.loadedTableData[this.currentRowIndex];
                if (currentRow && currentRow.length > 1) {
                    cellBValue = currentRow[1] || ''; // Ячейка B (индекс 1)
                }
            }
            
            // Очищаем значение от недопустимых символов для имени файла
            const sanitizedValue = cellBValue.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s\-_]/g, '').trim() || 'label';
            const size = `${frontWidth}×${frontHeight}mm`;
            const deviceType = this.getDeviceType();
            const filename = `${sanitizedValue}_${deviceType}_label_${size}.svg`;
            
            // Получаем значение тогла "Outline fonts" (по умолчанию true)
            const convertToOutlines = this.dom.convertToOutlinesCheckbox ? this.dom.convertToOutlinesCheckbox.checked : true;
            
            // Экспортируем через модуль
            await this.svgExporter.exportToFile(exportSvg, filename, {
                removeInteractive: true,
                optimizeSize: true,
                convertTextToOutlines: convertToOutlines
            });
        } catch (error) {
            console.error('Ошибка при экспорте SVG:', error);
            alert(`Не удалось экспортировать SVG: ${error.message || 'Неизвестная ошибка'}`);
            throw error;
        }
    }
    
    async exportPDF() {
        try {
            const { frontWidth, frontHeight, gridModule, columnCount, rowCount } = this.settings;
            
            // Создаем SVG для экспорта (scale = 1 для точных размеров)
            const exportSvg = await this.createExportSVG();
            
            // Генерируем timestamp с точностью до минуты
            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            
            // Генерируем имя файла аналогично SVG экспорту
            let cellBValue = '';
            if (this.loadedTableData && 
                this.currentRowIndex !== null && 
                this.currentRowIndex !== undefined &&
                this.currentRowIndex >= 0 && 
                this.currentRowIndex < this.loadedTableData.length) {
                const currentRow = this.loadedTableData[this.currentRowIndex];
                if (currentRow && currentRow.length > 1) {
                    cellBValue = currentRow[1] || ''; // Ячейка B (индекс 1)
                }
            }
            
            // Очищаем значение от недопустимых символов для имени файла
            const sanitizedValue = cellBValue.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s\-_]/g, '').trim() || 'label';
            const size = `${frontWidth}×${frontHeight}mm`;
            const deviceType = this.getDeviceType();
            const filename = `${sanitizedValue}_${deviceType}_label_${size}.pdf`;
            
            // Получаем значение тогла "Outline fonts" (по умолчанию true)
            const convertToOutlines = this.dom.convertToOutlinesCheckbox ? this.dom.convertToOutlinesCheckbox.checked : true;
            
            // Используем размеры SVG для формата страницы
            const svgWidth = parseFloat(exportSvg.getAttribute('width')) || parseFloat(exportSvg.viewBox.baseVal.width);
            const svgHeight = parseFloat(exportSvg.getAttribute('height')) || parseFloat(exportSvg.viewBox.baseVal.height);
            
            // Экспортируем через модуль PDFExporter
            await this.pdfExporter.exportToFile(exportSvg, filename, {
                removeInteractive: true,
                convertTextToOutlines: convertToOutlines,
                format: [svgWidth, svgHeight] // Используем размеры SVG как формат страницы
            });
        } catch (error) {
            console.error('Ошибка при экспорте PDF:', error);
            alert(`Не удалось экспортировать PDF: ${error.message || 'Неизвестная ошибка'}`);
            throw error;
        }
    }
    
    async exportCurrentLabelSVG() {
        try {
            // Используем существующую функцию exportSVG
            await this.exportSVG();
        } catch (error) {
            console.error('Ошибка при экспорте текущего лейбла SVG:', error);
            alert(`Не удалось экспортировать SVG: ${error.message || 'Неизвестная ошибка'}`);
            throw error;
        }
    }
    
    async exportAllLabelsSVG() {
        if (!this.loadedTableData || this.loadedTableData.length === 0) {
            this.showDataStatus('Please load data from spreadsheet first', 'error');
            return;
        }

        if (!this.dom.exportAllSvgBtn) {
            return;
        }

        // Отключаем кнопку
        this.dom.exportAllSvgBtn.disabled = true;
        this.showDataStatus(`Generating ${this.loadedTableData.length} SVG file(s)...`, 'loading');

        try {
            // Сохраняем исходное состояние текстовых блоков с плейсхолдерами
            const templateTextBlocks = this.originalTextBlocks ? 
                JSON.parse(JSON.stringify(this.originalTextBlocks)) : 
                JSON.parse(JSON.stringify(this.textBlocks));
            const originalGraphicsBlocks = JSON.parse(JSON.stringify(this.graphicsBlocks));

            const { frontWidth, frontHeight, gridModule, columnCount, rowCount } = this.settings;
            const convertToOutlines = this.dom.convertToOutlinesCheckbox ? this.dom.convertToOutlinesCheckbox.checked : true;

            // Генерируем timestamp
            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            const size = `${frontWidth}×${frontHeight}mm`;

            // Генерируем SVG для каждой строки
            for (let rowIndex = 0; rowIndex < this.loadedTableData.length; rowIndex++) {
                const row = this.loadedTableData[rowIndex];
                
                // Проверяем, есть ли сохраненные изменения для этого макета
                if (this.modifiedRowsData[rowIndex]) {
                    // Используем сохраненные изменения
                    const savedData = this.modifiedRowsData[rowIndex];
                    if (savedData.textBlocks) {
                        this.textBlocks = JSON.parse(JSON.stringify(savedData.textBlocks));
                    }
                    if (savedData.graphicsBlocks) {
                        this.graphicsBlocks = JSON.parse(JSON.stringify(savedData.graphicsBlocks));
                    }
                } else {
                    // Восстанавливаем шаблон с плейсхолдерами перед каждой строкой
                    this.textBlocks = JSON.parse(JSON.stringify(templateTextBlocks));
                    
                    // Обновляем текстовые блоки данными из текущей строки
                    this.updateTextBlocksFromRow(row, rowIndex);
                }

                // Создаем SVG для экспорта
                const exportSvg = await this.createExportSVG();

                // Генерируем имя файла: "(значение из ячейки B)_[device]_label_120×24mm.svg"
                let cellBValue = '';
                if (row && row.length > 1) {
                    cellBValue = row[1] || ''; // Ячейка B (индекс 1)
                }
                const sanitizedValue = cellBValue.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s\-_]/g, '').trim() || `row${rowIndex + 1}`;
                const deviceType = this.getDeviceType();
                const filename = `${sanitizedValue}_${deviceType}_label_${size}.svg`;

                // Экспортируем SVG
                await this.svgExporter.exportToFile(exportSvg, filename, {
                    removeInteractive: true,
                    optimizeSize: true,
                    convertTextToOutlines: convertToOutlines
                });

                // Небольшая задержка между скачиваниями, чтобы браузер успел обработать
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Восстанавливаем состояние текущего макета (с учетом сохраненных изменений)
            if (this.currentRowIndex !== null) {
                this.updateSingleSticker(this.currentRowIndex);
            } else {
                // Если нет текущего макета, восстанавливаем первую строку
                this.currentRowIndex = 0;
                this.updateSingleSticker(0);
            }

            this.showDataStatus(`Successfully exported ${this.loadedTableData.length} SVG file(s)`, 'success');
        } catch (error) {
            console.error('Ошибка при экспорте всех SVG:', error);
            this.showDataStatus(`Error: ${error.message || 'Неизвестная ошибка'}`, 'error');
        } finally {
            // Включаем кнопку обратно
            this.dom.exportAllSvgBtn.disabled = false;
        }
    }
    
    // Итерация 7: Создание SVG для экспорта (без интерактивных элементов)
    async createExportSVG() {
        try {
            const { frontWidth, frontHeight } = this.settings;
            
            // Create a new SVG for export with actual mm dimensions
            const scale = 1; // Export uses scale = 1 (actual mm)
            
            // Create SVG with mm units
            const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            exportSvg.setAttribute('width', `${frontWidth}mm`);
            exportSvg.setAttribute('height', `${frontHeight}mm`);
            exportSvg.setAttribute('viewBox', `0 0 ${frontWidth} ${frontHeight}`);
            
            // Create groups for better organization in Figma/Illustrator
            const boxGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            boxGroup.setAttribute('id', 'box');
            exportSvg.appendChild(boxGroup);
            
            // Draw rectangles at actual mm scale
            this.drawRectangles(boxGroup, 0, 0, frontWidth, frontHeight, scale);
            
            // Сетка не создается при экспорте - макеты всегда сохраняются без сетки
            // (Удалено создание скрытой сетки для оптимизации - экономия ~100 строк кода и времени выполнения)
            
            // Draw grid elements on front panel (in mm)
            const frontX = 0;
            const frontY = 0;
            
            // Add labels if enabled (in separate group)
            if (this.settings.showLabels) {
                const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                labelsGroup.setAttribute('id', 'labels');
                exportSvg.appendChild(labelsGroup);
                this.drawLabels(labelsGroup, 0, 0, frontWidth, frontHeight, scale);
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
            
            return exportSvg;
        } catch (error) {
            console.error('Ошибка при создании SVG для экспорта:', error);
            throw new Error(`Не удалось создать SVG для экспорта: ${error.message || 'Неизвестная ошибка'}`);
        }
    }
    
    // Итерация 7: Экспорт настроек в JSON через SVGExporter
    exportSettings() {
        const { frontWidth, frontHeight, gridModule, columnCount, rowCount } = this.settings;
        
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
        
        // Генерируем имя файла: "размер колонки строки модуль timestamp.json"
        // Например: "120×24mm 12col 12rows 5.05mm 20251116_1430.json"
        const size = `${frontWidth}×${frontHeight}mm`;
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
    
    // ============================================
    // Data Import from Google Sheets
    // ============================================
    
    /**
     * Конвертирует URL Google Sheets в CSV URL
     * @param {string} url - URL таблицы Google Sheets
     * @param {number} sheetNumber - Номер листа (начиная с 1)
     * @returns {string} - CSV URL
     */
    convertSheetUrlToCsv(url, sheetNumber = 1) {
        // Нормализуем номер листа
        const normalizedSheetNumber = Math.max(1, parseInt(sheetNumber, 10) || 1);
        
        // 1) Если это уже CSV/Export URL
        if (url.includes('/pub?output=csv') || url.includes('/export?format=csv')) {
            // Если в URL уже есть gid, оставляем его как есть
            if (url.includes('&gid=') || url.includes('?gid=')) {
                return url;
            }
            // Если gid нет, просто возвращаем URL как есть
            // (Google сам выберет активный лист; номер листа здесь не применим)
            console.warn('ℹ️ Sheet number is ignored for direct CSV/export URLs without gid. Active sheet will be used.');
            return url;
        }
        
        // 2) Опубликованный URL формата /d/e/... (Publish to web)
        const pubMatch = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
        if (pubMatch) {
            // Для опубликованных таблиц Google использует 0‑based индекс листа как gid
            const gid = normalizedSheetNumber - 1;
            return `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?output=csv&gid=${gid}`;
        }
        
        // 3) Обычный URL: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit...
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        
        if (!match) {
            throw new Error('Неверный формат URL Google Sheets');
        }
        
        const sheetId = match[1];
        
        // Пытаемся извлечь gid из URL (если пользователь скопировал URL конкретного листа)
        // Формат: #gid=XXXXX или &gid=XXXXX
        let gid = null;
        const gidMatch = url.match(/[#&]gid=(\d+)/);
        if (gidMatch) {
            gid = gidMatch[1];
        } else if (normalizedSheetNumber > 1) {
            // У обычных ссылок без gid мы не можем надёжно вычислить gid по номеру листа,
            // поэтому просто предупреждаем и используем первый лист (по умолчанию)
            console.warn('ℹ️ Sheet number > 1 is ignored for standard edit URLs without gid. First sheet will be used. Open needed sheet in browser and copy its URL (with gid).');
        }
        
        // Конструируем CSV URL
        let csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        if (gid !== null) {
            csvUrl += `&gid=${gid}`;
        }
        return csvUrl;
    }

    /**
     * Парсит CSV текст в массив строк
     * @param {string} csvText - CSV текст
     * @returns {Array<Array<string>>} - Массив строк, каждая строка - массив значений
     */
    parseCsv(csvText) {
        const rows = [];
        let currentRow = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Двойные кавычки - экранированная кавычка
                    current += '"';
                    i++; // Пропускаем следующую кавычку
                } else {
                    // Начало или конец кавычек
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Запятая вне кавычек - разделитель колонок
                currentRow.push(current.trim());
                current = '';
            } else if ((char === '\n' || (char === '\r' && nextChar !== '\n')) && !inQuotes) {
                // Перенос строки вне кавычек - конец строки данных
                currentRow.push(current.trim());
                current = '';
                
                // Добавляем строку только если она не пустая
                if (currentRow.some(val => val.trim() !== '')) {
                    rows.push([...currentRow]);
                }
                currentRow = [];
            } else if (char === '\r' && nextChar === '\n' && !inQuotes) {
                // Windows-style перенос строки (\r\n) вне кавычек
                currentRow.push(current.trim());
                current = '';
                
                // Добавляем строку только если она не пустая
                if (currentRow.some(val => val.trim() !== '')) {
                    rows.push([...currentRow]);
                }
                currentRow = [];
                i++; // Пропускаем \n
            } else {
                // Обычный символ (включая переносы строк внутри кавычек)
                current += char;
            }
        }
        
        // Если мы дошли до конца, но еще не добавили последнее значение
        if (current.trim() || currentRow.length > 0) {
            currentRow.push(current.trim());
            if (currentRow.some(val => val.trim() !== '')) {
                rows.push([...currentRow]);
            }
        }
        
        return rows;
    }

    /**
     * Загружает данные из Google Sheets и обновляет текстовые блоки
     */
    async loadDataFromGoogleSheets() {
        if (!this.dom.googleSheetsUrl || !this.dom.loadDataBtn) {
            return;
        }

        const url = this.dom.googleSheetsUrl.value.trim();
        
        if (!url) {
            this.showDataStatus('Please enter a URL', 'error');
            return;
        }

        // Отключаем кнопку и показываем статус загрузки
        this.dom.loadDataBtn.disabled = true;
        this.showDataStatus('Loading data...', 'loading');

        try {
            // Конвертируем URL в CSV формат
            const csvUrl = this.convertSheetUrlToCsv(url);
            console.log('CSV URL:', csvUrl);

            // Загружаем CSV
            const response = await fetch(csvUrl);
            
            if (!response.ok) {
                throw new Error(`Ошибка загрузки: ${response.status} ${response.statusText}`);
            }

            const csvText = await response.text();
            console.log('CSV данные загружены, длина:', csvText.length);

            // Парсим CSV
            const rows = this.parseCsv(csvText);
            console.log('Распарсенные строки:', rows);
            console.log('Количество строк:', rows.length);

            // Сохраняем загруженные данные
            this.loadedTableData = rows;
            this.currentRowIndex = 0; // Начинаем с первой строки

            // Очищаем сохраненные изменения при новой загрузке данных
            this.modifiedRowsData = {};

            // ВАЖНО: Сохраняем оригинальные текстовые блоки с плейсхолдерами
            // Это нужно для переключения между строками данных
            // Если есть отдельный шаблон (placeholderTextBlocks), используем его,
            // чтобы не зависеть от примерных данных, показанных до загрузки таблицы
            this.originalTextBlocks = JSON.parse(JSON.stringify(
                this.placeholderTextBlocks && Array.isArray(this.placeholderTextBlocks)
                    ? this.placeholderTextBlocks
                    : this.textBlocks
            ));
            
            // ВАЖНО: Сохраняем оригинальные графические блоки
            // Это нужно для переключения между строками данных
            this.originalGraphicsBlocks = JSON.parse(JSON.stringify(this.graphicsBlocks));

            // Устанавливаем флаг программного обновления при загрузке данных
            this.isProgrammaticUpdate = true;

            // Перед применением первой строки восстанавливаем шаблон с плейсхолдерами,
            // чтобы гарантированно подставлять данные в A1, B1 и т.д., а не в примерный текст
            if (this.originalTextBlocks) {
                this.textBlocks = JSON.parse(JSON.stringify(this.originalTextBlocks));
            }
            if (this.originalGraphicsBlocks) {
                this.graphicsBlocks = JSON.parse(JSON.stringify(this.originalGraphicsBlocks));
            }

            // ВАЖНО: Синхронизируем индексы после восстановления оригинальных блоков
            this._syncTextBlocksIndex();
            this._syncGraphicsBlocksIndex();

            // Обновляем текстовые блоки данными из таблицы (первая строка)
            this.updateTextBlocksFromData(rows);

            // Показываем превью данных
            this.showDataPreview(rows);

            // Обновляем список строк
            this.updateDataRowsList();
            
            // Сбрасываем флаг программного обновления после небольшой задержки
            setTimeout(() => {
                this.isProgrammaticUpdate = false;
            }, 100);

            // Скрываем статус после успешной загрузки
            if (this.dom.dataStatus) {
                this.dom.dataStatus.style.display = 'none';
            }

            // Показываем кнопку "Generate All Labels"
            if (this.dom.generateAllStickersBtn) {
                this.dom.generateAllStickersBtn.style.display = 'block';
            }
            
            // Показываем кнопку "Export All Labels SVG"
            if (this.dom.exportAllSvgBtn) {
                this.dom.exportAllSvgBtn.style.display = 'block';
            }

        } catch (error) {
            console.error('Ошибка:', error);
            this.showDataStatus(`Error: ${error.message}. Make sure the spreadsheet is published or shared.`, 'error');
            
            // Скрываем кнопку "Generate All Labels" при ошибке
            if (this.dom.generateAllStickersBtn) {
                this.dom.generateAllStickersBtn.style.display = 'none';
            }
            
            // Скрываем кнопку "Export All Labels SVG" при ошибке
            if (this.dom.exportAllSvgBtn) {
                this.dom.exportAllSvgBtn.style.display = 'none';
            }
        } finally {
            this.dom.loadDataBtn.disabled = false;
        }
    }

    /**
     * Разбивает многострочное содержимое ячейки на массив строк
     * @param {string} cellValue - Содержимое ячейки
     * @returns {Array<string>} - Массив строк (пустые строки тоже включены)
     */
    parseMultilineCell(cellValue) {
        if (!cellValue) {
            return [];
        }
        
        // Разбиваем по переносам строк (поддерживаем \n и \r\n)
        return cellValue.split(/\r?\n/);
    }

    /**
     * Заменяет плейсхолдеры типа A1, B2 на данные из строки таблицы
     * Строки внутри ячейки определяются автоматически по переносам строк (\n)
     * @param {string} content - Текст с плейсхолдерами
     * @param {Array<string>} rowData - Данные строки таблицы (массив ячеек)
     * @returns {string} - Текст с замененными плейсхолдерами
     */
    replacePlaceholders(content, rowData) {
        if (!content || !rowData) {
            return content;
        }

        // Создаем маппинг колонок: {A: значение_ячейки_A, B: значение_ячейки_B, ...}
        const columnData = {};
        const columnNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        
        rowData.forEach((cellValue, colIndex) => {
            if (colIndex < columnNames.length) {
                const columnName = columnNames[colIndex];
                // Берем содержимое ячейки целиком (со всеми переносами строк)
                columnData[columnName] = cellValue || '';
            }
        });

        // Заменяем все плейсхолдеры типа A1, B2, C3 и т.д.
        // Паттерн: буква (A-Z) + число (1, 2, 10, 100 и т.д.)
        // Буква определяет колонку таблицы, число игнорируется (для совместимости с форматом A1, B2)
        // Используем negative lookbehind и lookahead, чтобы не заменять плейсхолдеры внутри слов
        // Например, "I1" в "IMEI1" не будет заменен
        const placeholderRegex = /(?<![A-Za-z0-9])([A-Z])(\d+)(?![A-Za-z0-9])/g;
        
        return content.replace(placeholderRegex, (match, column, columnNumber) => {
            // Проверяем, есть ли данные для этой колонки
            if (!(column in columnData)) {
                console.warn(`⚠️ Колонка ${column} не найдена в данных таблицы`);
                return match; // Оставляем плейсхолдер без изменений
            }
            
            // Возвращаем содержимое ячейки целиком (со всеми переносами строк)
            const value = columnData[column];
            console.log(`✅ Заменен плейсхолдер ${match} -> "${value}"`);
            return value;
        });
    }

    /**
     * Обновляет текстовые блоки данными из таблицы (первая строка)
     * @param {Array<Array<string>>} rows - Массив строк данных
     */
    updateTextBlocksFromData(rows) {
        if (!rows || rows.length === 0) {
            console.warn('⚠️ Нет данных для обновления');
            return;
        }

        // Используем первую строку таблицы
        const firstRow = rows[0];
        this.updateTextBlocksFromRow(firstRow, 0);
    }

    /**
     * Показывает статус загрузки данных
     * @param {string} message - Сообщение
     * @param {string} type - Тип: 'loading', 'success', 'error'
     */
    showDataStatus(message, type) {
        if (!this.dom.dataStatus) {
            return;
        }

        this.dom.dataStatus.textContent = message;
        this.dom.dataStatus.className = `data-status ${type}`;
        this.dom.dataStatus.style.display = 'block';
    }

    /**
     * Генерирует SVG файлы для всех строк данных из таблицы
     */
    async generateAllStickers() {
        if (!this.loadedTableData || this.loadedTableData.length === 0) {
            this.showDataStatus('Please load data from spreadsheet first', 'error');
            return;
        }

        if (!this.dom.generateAllStickersBtn) {
            return;
        }

        // Отключаем кнопку
        this.dom.generateAllStickersBtn.disabled = true;
        this.showDataStatus(`Generating ${this.loadedTableData.length} label(s)...`, 'loading');

        try {
            // Сохраняем исходное состояние текстовых блоков с плейсхолдерами
            const templateTextBlocks = this.originalTextBlocks ? 
                JSON.parse(JSON.stringify(this.originalTextBlocks)) : 
                JSON.parse(JSON.stringify(this.textBlocks));
            const originalGraphicsBlocks = JSON.parse(JSON.stringify(this.graphicsBlocks));

            const { frontWidth, frontHeight, gridModule, columnCount, rowCount } = this.settings;
            const convertToOutlines = this.dom.convertToOutlinesCheckbox ? this.dom.convertToOutlinesCheckbox.checked : true;

            // Генерируем timestamp
            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            const size = `${frontWidth}×${frontHeight}mm`;
            const cols = `${columnCount}col`;
            const rows = `${rowCount}rows`;
            const module = `${gridModule.toFixed(2)}mm`;

            // Генерируем SVG для каждой строки
            for (let rowIndex = 0; rowIndex < this.loadedTableData.length; rowIndex++) {
                const row = this.loadedTableData[rowIndex];
                
                // Проверяем, есть ли сохраненные изменения для этого макета
                if (this.modifiedRowsData[rowIndex]) {
                    // Используем сохраненные изменения
                    const savedData = this.modifiedRowsData[rowIndex];
                    if (savedData.textBlocks) {
                        this.textBlocks = JSON.parse(JSON.stringify(savedData.textBlocks));
                    }
                    if (savedData.graphicsBlocks) {
                        this.graphicsBlocks = JSON.parse(JSON.stringify(savedData.graphicsBlocks));
                    }
                } else {
                    // Восстанавливаем шаблон с плейсхолдерами перед каждой строкой
                    this.textBlocks = JSON.parse(JSON.stringify(templateTextBlocks));
                    
                    // Обновляем текстовые блоки данными из текущей строки
                    this.updateTextBlocksFromRow(row, rowIndex);
                }

                // Создаем SVG для экспорта
                const exportSvg = await this.createExportSVG();

                // Генерируем имя файла: "(значение из ячейки B)_[device]_label_120×24mm.pdf"
                let cellBValue = '';
                if (row && row.length > 1) {
                    cellBValue = row[1] || ''; // Ячейка B (индекс 1)
                }
                const sanitizedValue = cellBValue.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s\-_]/g, '').trim() || `row${rowIndex + 1}`;
                const deviceType = this.getDeviceType();
                const filename = `${sanitizedValue}_${deviceType}_label_${size}.pdf`;

                // Экспортируем PDF
                await this.pdfExporter.exportToFile(exportSvg, filename, {
                    removeInteractive: true,
                    convertTextToOutlines: convertToOutlines,
                    format: [frontWidth, frontHeight]
                });

                // Небольшая задержка между скачиваниями, чтобы браузер успел обработать
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Восстанавливаем состояние текущего макета (с учетом сохраненных изменений)
            if (this.currentRowIndex !== null) {
                this.updateSingleSticker(this.currentRowIndex);
            } else {
                // Если нет текущего макета, восстанавливаем первую строку
                this.currentRowIndex = 0;
                this.updateSingleSticker(0);
            }
            
            this.updateGrid();
            this.updateElementsNavigator();
            this.updateDataRowsList();

            // Не показываем статус после экспорта

        } catch (error) {
            console.error('Ошибка при генерации стикеров:', error);
            this.showDataStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.dom.generateAllStickersBtn.disabled = false;
        }
    }

    /**
     * Обновляет текстовые блоки данными из конкретной строки таблицы
     * @param {Array<string>} row - Строка данных (массив значений ячеек)
     * @param {number} rowIndex - Индекс строки (0-based)
     */
    updateTextBlocksFromRow(row, rowIndex) {
        if (!row || row.length === 0) {
            console.warn(`⚠️ Строка ${rowIndex + 1}: нет данных`);
            return;
        }

        console.log(`🔄 Обновление текстовых блоков данными из строки ${rowIndex + 1}`);

        let updated = false;

        // Проходим по всем текстовым блокам и заменяем плейсхолдеры
        this.textBlocks.forEach((block, blockIndex) => {
            const originalContent = block.content;
            
            // Заменяем плейсхолдеры типа A1, B2 на данные из таблицы
            const newContent = this.replacePlaceholders(originalContent, row);
            
            // Если содержимое изменилось, обновляем блок
            if (newContent !== originalContent) {
                block.content = newContent;
                console.log(`✅ Блок ${blockIndex + 1} (id: ${block.id}) обновлен`);
                updated = true;
            }
        });

        // Обновляем штрихкод данными из колонки F (индекс 5)
        this.updateBarcodeFromData(row);

        // ВАЖНО: Синхронизируем индексы после обновления блоков данными из таблицы
        // Это необходимо, чтобы при клике на блок в панели редактирования отображался актуальный контент
        this._syncTextBlocksIndex();
        this._syncGraphicsBlocksIndex();

        // Обновляем сетку для отображения изменений
        if (updated) {
            console.log(`✅ Обновлена сетка для строки ${rowIndex + 1}`);
            this.updateGrid();
            this.updateElementsNavigator();
        } else {
            console.log(`ℹ️ Строка ${rowIndex + 1}: плейсхолдеры не найдены или данные не изменились`);
        }
    }

    /**
     * Преобразует букву колонки (A, B, C, ..., Z, AA, AB, ...) в индекс массива (0-based)
     * @param {string} letter - Обозначение колонки, например "A" или "F"
     * @returns {number} Индекс колонки (0-based) или -1, если буква некорректна
     */
    getColumnIndexFromLetter(letter) {
        if (!letter) return -1;
        
        const col = String(letter).trim().toUpperCase();
        if (!col) return -1;
        
        // Поддержка A..Z, AA..ZZ и т.п.
        let index = 0;
        for (let i = 0; i < col.length; i++) {
            const code = col.charCodeAt(i);
            if (code < 65 || code > 90) {
                return -1;
            }
            index = index * 26 + (code - 64);
        }
        
        // Преобразуем из 1-based в 0-based
        return index - 1;
    }
    
    /**
     * Обновляет один штрихкод на основе конфигурации, заданной в пресете
     * Конфигурация хранится в самом графическом блоке: block.barcode = { type, column }
     * type: 'ean-13' | 'SN' | 'IMEI1' | 'IMEI2'
     * column: буква колонки в Google Sheets (например, 'F', 'G', 'H', 'I')
     * @param {Object} block - Графический блок со штрихкодом
     * @param {Array<string>} row - Строка данных
     * @param {Object} gridSettings - Настройки сетки
     */
    updateBarcodeFromConfig(block, row, gridSettings) {
        if (!block || !block.barcode) {
            return;
        }
        
        const config = block.barcode;
        const columnLetter = config.column;
        const logicalType = (config.type || '').toString().toLowerCase();
        
        if (!columnLetter) {
            console.warn(`⚠️ Для блока штрихкода "${block.id}" не указана колонка в пресете`);
            return;
        }
        
        const columnIndex = this.getColumnIndexFromLetter(columnLetter);
        if (columnIndex < 0) {
            console.warn(`⚠️ Некорректное обозначение колонки "${columnLetter}" для блока штрихкода "${block.id}"`);
            return;
        }
        
        if (!row || row.length <= columnIndex) {
            console.warn(`⚠️ Недостаточно данных в строке для обновления штрихкода "${block.id}" (колонка ${columnLetter} отсутствует)`);
            return;
        }
        
        const cellValue = row[columnIndex] || '';
        const lines = this.parseMultilineCell(cellValue);
        const barcodeData = lines[0] || '';
        
        if (!barcodeData) {
            console.warn(`⚠️ Колонка ${columnLetter} пуста, штрихкод "${block.id}" не обновлен`);
            return;
        }
        
        // Маппинг логических типов на реальные типы штрихкода и режим отображения текста
        let barcodeType = 'code128';
        let displayValue = false;
        
        switch (logicalType) {
            case 'ean-13':
            case 'ean13':
                barcodeType = 'ean13';
                displayValue = true; // как и раньше для основного EAN-13
                break;
            case 'sn':
            case 'imei1':
            case 'imei2':
                // Все эти типы кодируются через Code128 без подписи
                barcodeType = 'code128';
                displayValue = false;
                break;
            default:
                // По умолчанию — Code128 без текста, но даём знать в консоль
                console.warn(`⚠️ Неизвестный логический тип штрихкода "${config.type}" для блока "${block.id}", используется Code128 без текста`);
                barcodeType = 'code128';
                displayValue = false;
        }
        
        const contentColor = this.settings.contentColor || '#17264E';
        BarcodeGenerator.updateBarcodeBlock(block, barcodeData, gridSettings, displayValue, barcodeType, contentColor);
        // Save barcode data in block for future reference
        block.barcodeData = barcodeData;
        console.log(`✅ Штрихкод "${block.id}" (${config.type || barcodeType}) обновлен из колонки ${columnLetter}: ${barcodeData}`);
    }
    
    /**
     * Обновляет штрихкоды данными из таблицы.
     * Если в пресете для графических блоков заданы конфигурации штрихкодов (block.barcode),
     * используется именно эта конфигурация (тип + колонка).
     * В противном случае используется старая жёстко прописанная логика (колонки E–H).
     * @param {Array<string>} row - Строка данных (массив значений ячеек)
     */
    updateBarcodeFromData(row) {
        // Получаем настройки сетки (используются для всех штрихкодов)
        const gridSettings = {
            gridModule: this.settings.gridModule,
            columnCount: this.settings.columnCount,
            frontWidth: this.settings.frontWidth,
            frontHeight: this.settings.frontHeight,
            margins: this.settings.margins,
            marginsUnit: this.settings.marginsUnit,
        };
        
        // Ищем конфигурации штрихкодов в графических блоках (новый способ через пресет)
        const graphicsBlocks = this.graphicsBlocks || [];
        const configuredBarcodeBlocks = graphicsBlocks.filter(block => block && block.barcode && block.barcode.column);
        
        if (configuredBarcodeBlocks.length > 0) {
            // Новый путь: все штрихкоды описаны в пресете
            configuredBarcodeBlocks.forEach(block => {
                this.updateBarcodeFromConfig(block, row, gridSettings);
            });
        } else {
            // Fallback: старая логика на фиксированных колонках (E, F, G, H)
            console.warn('ℹ️ Конфигурации штрихкодов в пресете не найдены, используется старая логика колонок E–H');
            
            // Обновляем большой штрихкод из колонки F
            this.updateMainBarcode(row, gridSettings);
            
            // Обновляем маленький штрихкод из колонки E
            this.updateSmallBarcode(row, gridSettings);
            
            // Обновляем штрихкод IMEI1 из колонки G
            this.updateImei1Barcode(row, gridSettings);
            
            // Обновляем штрихкод IMEI2 из колонки H
            this.updateImei2Barcode(row, gridSettings);
        }
    }

    /**
     * Обновляет основной штрихкод из колонки F
     * @param {Array<string>} row - Строка данных
     * @param {Object} gridSettings - Настройки сетки
     */
    updateMainBarcode(row, gridSettings) {
        if (!row || row.length < 6) {
            console.warn('⚠️ Недостаточно данных для обновления основного штрихкода (колонка F отсутствует)');
            return;
        }

        // Получаем данные из колонки F (индекс 5)
        const columnF = row[5] || '';
        const lines = this.parseMultilineCell(columnF);
        const barcodeData = lines[0] || '';
        
        if (!barcodeData) {
            console.warn('⚠️ Колонка F пуста, основной штрихкод не обновлен');
            return;
        }

        // Ищем блок с основным штрихкодом
        const barcodeBlock = this.graphicsBlocks.find(block => 
            block.id === 'sticker-barcode'
        );

        if (!barcodeBlock) {
            console.warn('⚠️ Блок с основным штрихкодом не найден');
            return;
        }

        // Обновляем штрихкод С отображением текста (EAN-13)
        const contentColor = this.settings.contentColor || '#17264E';
        BarcodeGenerator.updateBarcodeBlock(barcodeBlock, barcodeData, gridSettings, true, 'ean13', contentColor);
        barcodeBlock.barcodeData = barcodeData;
        console.log(`✅ Основной штрихкод (EAN-13) обновлен: ${barcodeData}`);
    }

    /**
     * Обновляет маленький штрихкод (SN) из колонки E
     * @param {Array<string>} row - Строка данных
     * @param {Object} gridSettings - Настройки сетки
     */
    updateSmallBarcode(row, gridSettings) {
        if (!row || row.length < 5) {
            console.warn('⚠️ Недостаточно данных для обновления маленького штрихкода (колонка E отсутствует)');
            return;
        }

        // Получаем данные из колонки E (индекс 4)
        const columnE = row[4] || '';
        const lines = this.parseMultilineCell(columnE);
        const barcodeData = lines[0] || '';
        
        if (!barcodeData) {
            console.warn('⚠️ Колонка E пуста, маленький штрихкод не обновлен');
            return;
        }

        // Ищем блок с маленьким штрихкодом
        const barcodeBlock = this.graphicsBlocks.find(block => 
            block.id === 'sticker-barcode-small'
        );

        if (!barcodeBlock) {
            console.warn('⚠️ Блок с маленьким штрихкодом не найден');
            return;
        }

        // Обновляем штрихкод БЕЗ отображения текста (SN)
        const contentColor = this.settings.contentColor || '#17264E';
        BarcodeGenerator.updateBarcodeBlock(barcodeBlock, barcodeData, gridSettings, false, 'code128', contentColor);
        barcodeBlock.barcodeData = barcodeData;
        console.log(`✅ Маленький штрихкод (SN) обновлен: ${barcodeData}`);
    }

    /**
     * Обновляет штрихкод IMEI1 из колонки G
     * @param {Array<string>} row - Строка данных
     * @param {Object} gridSettings - Настройки сетки
     */
    updateImei1Barcode(row, gridSettings) {
        if (!row || row.length < 7) {
            console.warn('⚠️ Недостаточно данных для обновления штрихкода IMEI1 (колонка G отсутствует)');
            return;
        }

        // Получаем данные из колонки G (индекс 6)
        const columnG = row[6] || '';
        const lines = this.parseMultilineCell(columnG);
        const barcodeData = lines[0] || '';
        
        if (!barcodeData) {
            console.warn('⚠️ Колонка G пуста, штрихкод IMEI1 не обновлен');
            return;
        }

        // Ищем блок со штрихкодом IMEI1
        const barcodeBlock = this.graphicsBlocks.find(block => 
            block.id === 'sticker-barcode-imei1'
        );

        if (!barcodeBlock) {
            console.warn('⚠️ Блок со штрихкодом IMEI1 не найден');
            return;
        }

        // Обновляем штрихкод БЕЗ отображения текста
        BarcodeGenerator.updateBarcodeBlock(barcodeBlock, barcodeData, gridSettings, false);
        barcodeBlock.barcodeData = barcodeData;
        console.log(`✅ Штрихкод IMEI1 обновлен: ${barcodeData}`);
    }

    /**
     * Обновляет штрихкод IMEI2 из колонки H
     * @param {Array<string>} row - Строка данных
     * @param {Object} gridSettings - Настройки сетки
     */
    updateImei2Barcode(row, gridSettings) {
        if (!row || row.length < 8) {
            console.warn('⚠️ Недостаточно данных для обновления штрихкода IMEI2 (колонка H отсутствует)');
            return;
        }

        // Получаем данные из колонки H (индекс 7)
        const columnH = row[7] || '';
        const lines = this.parseMultilineCell(columnH);
        const barcodeData = lines[0] || '';
        
        if (!barcodeData) {
            console.warn('⚠️ Колонка H пуста, штрихкод IMEI2 не обновлен');
            return;
        }

        // Ищем блок со штрихкодом IMEI2
        const barcodeBlock = this.graphicsBlocks.find(block => 
            block.id === 'sticker-barcode-imei2'
        );

        if (!barcodeBlock) {
            console.warn('⚠️ Блок со штрихкодом IMEI2 не найден');
            return;
        }

        // Обновляем штрихкод БЕЗ отображения текста
        BarcodeGenerator.updateBarcodeBlock(barcodeBlock, barcodeData, gridSettings, false);
        barcodeBlock.barcodeData = barcodeData;
        console.log(`✅ Штрихкод IMEI2 обновлен: ${barcodeData}`);
    }

    /**
     * Показывает превью загруженных данных
     * @param {Array<Array<string>>} rows - Массив строк данных
     */
    showDataPreview(rows) {
        if (!this.dom.dataPreview) {
            return;
        }

        if (!rows || rows.length === 0) {
            this.dom.dataPreview.innerHTML = '<p>Нет данных</p>';
            return;
        }

        const columns = ['A', 'B', 'C', 'D', 'E', 'F'];
        let html = '';

        // Показываем первые 5 строк
        const maxRows = Math.min(5, rows.length);
        for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
            const row = rows[rowIndex];
            html += `<div style="margin-bottom: 8px;"><strong>Строка ${rowIndex + 1}:</strong></div>`;
            
            row.forEach((value, colIndex) => {
                if (colIndex < columns.length) {
                    html += `<div style="margin-left: 16px; font-family: monospace; font-size: 0.85rem;">
                        <strong>${columns[colIndex]}:</strong> ${value || '(пусто)'}
                    </div>`;
                }
            });
        }

        if (rows.length > maxRows) {
            html += `<div style="margin-top: 8px; color: #888; font-size: 0.85rem;">
                ... и еще ${rows.length - maxRows} строк(и)
            </div>`;
        }

        this.dom.dataPreview.innerHTML = html;
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
            this.inputController.setValue('rowCountValue', rowCount, false);
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
        if (this.dom.frontWidthValue) {
            this.dom.frontWidthValue.value = this.settings.frontWidth.toFixed(1);
        }
        if (this.dom.frontHeightValue) {
            this.dom.frontHeightValue.value = this.settings.frontHeight.toFixed(1);
        }
        
        // Update grid inputs
        if (this.dom.gridModuleValue) {
            this.dom.gridModuleValue.value = this.settings.gridModule.toFixed(4);
        }
        if (this.dom.marginsValue) {
            if (this.settings.marginsUnit === 'mm') {
                const marginsInMm = this.settings.margins * this.settings.gridModule;
                this.dom.marginsValue.value = marginsInMm.toFixed(2);
            } else {
                this.dom.marginsValue.value = this.settings.margins.toFixed(2);
            }
        }
        if (this.dom.columnCountValue) {
            this.dom.columnCountValue.value = this.settings.columnCount;
        }
        if (this.dom.rowCountValue) {
            this.dom.rowCountValue.value = this.settings.rowCount;
        }
        if (this.dom.rowHeightValue) {
            this.dom.rowHeightValue.value = this.settings.rowHeight;
        }
        
        // Update checkboxes
        if (this.dom.showColumns) this.dom.showColumns.checked = this.settings.showColumns;
        if (this.dom.showRows) this.dom.showRows.checked = this.settings.showRows;
        if (this.dom.showBaseline) this.dom.showBaseline.checked = this.settings.showBaseline;
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
        this.inputController = new NumberInputController(this.settingsModule);
        
        // Инициализируем все инпуты из INPUT_CONFIG
        Object.keys(this.INPUT_CONFIG).forEach(inputId => {
            const config = this.INPUT_CONFIG[inputId];
            this.inputController.initInput(inputId, config);
        });
        
        console.log('✅ NumberInputController initialized with', this.inputController.inputs.size, 'inputs');
        
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
        
    }
    
    // ============================================
    // Panel registration (Итерация 5.3)
    // ============================================
    initPanels() {
        // Регистрируем все панели через PanelManager
        const panels = [
            { id: 'controlsPanel', headerId: 'panelHeader', draggable: true },
            { id: 'dataImportPanel', headerId: 'dataImportPanelHeader', draggable: true },
            { id: 'barcodePanel', headerId: 'barcodePanelHeader', draggable: true },
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
    // DEPRECATED: Метод временно отключен - менеджеры и рендереры не используются
    // TODO: Доработать рендереры для полной поддержки интерактивности и baseline snap
    // После доработки можно будет включить менеджеры обратно
    initElementsManagers() {
        // Менеджеры временно отключены - используем старый код
        // После доработки раскомментировать:
        // this.textBlockManager = new TextBlockManager(this.settingsModule, this.gridCalculator);
        // this.textRenderer = new TextRenderer(this.settingsModule, this.gridCalculator);
        // this.graphicsManager = new GraphicsManager(this.settingsModule, this.gridCalculator);
        // this.graphicsRenderer = new GraphicsRenderer(this.settingsModule, this.gridCalculator);
        
        // Миграция данных НЕ выполняется - используем старые массивы this.textBlocks и this.graphicsBlocks
        // ElementsNavigator также не инициализируется - используется старая логика updateElementsNavigator()
    }
    
    // ============================================
    // Edit Mode Toggle
    // ============================================
    setEditMode(active) {
        this.editModeActive = active;
        document.body.classList.toggle('edit-mode-active', this.editModeActive);
        
        // При включении режима редактирования разворачиваем все панели
        if (active) {
            this.expandAllEditModePanels();
        }
        
        // Обновляем сетку для изменения курсора на объектах
        this.updateGrid();
    }
    
    /**
     * Разворачивает все панели режима редактирования
     */
    expandAllEditModePanels() {
        // Находим все панели с классом edit-mode-only
        const editModePanels = document.querySelectorAll('.edit-mode-only.controls-panel');
        
        editModePanels.forEach(panel => {
            // Убираем класс panel-collapsed если он есть
            if (panel.classList.contains('panel-collapsed')) {
                panel.classList.remove('panel-collapsed');
                
                // Обновляем иконку сворачивания
                const collapseIcon = panel.querySelector('.collapse-icon');
                if (collapseIcon) {
                    collapseIcon.classList.remove('collapsed');
                    collapseIcon.setAttribute('aria-label', 'Collapse panel');
                }
            }
            
            // Для панели текстовых стилей не разворачиваем внутренние секции
            const isTextPanel = panel.id === 'textPanel';
            
            if (!isTextPanel) {
                // Разворачиваем все внутренние collapsible секции
                const collapsibleContents = panel.querySelectorAll('.collapsible-content.collapsed');
                collapsibleContents.forEach(content => {
                    content.classList.remove('collapsed');
                    
                    // Обновляем соответствующий toggle
                    const header = content.previousElementSibling;
                    if (header) {
                        const toggle = header.querySelector('.collapse-toggle');
                        if (toggle) {
                            toggle.setAttribute('aria-expanded', 'true');
                        }
                    }
                });
            }
        });
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

