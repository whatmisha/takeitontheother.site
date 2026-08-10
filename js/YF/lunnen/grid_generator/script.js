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
import { DOMCache } from './src/core/DOMCache.js?v=1.12.17';

// Итерация 3: Grid
import { GridCalculator } from './src/grid/GridCalculator.js?v=1.12.28';
import { GridRenderer } from './src/grid/GridRenderer.js';
import { CanvasRendererController } from './src/grid/CanvasRendererController.js?v=1.12.36';

// Итерация 4: Config
import { createSliderConfig } from './src/config/SliderConfigFactory.js?v=1.12.37';

// Итерация 5: UI Controllers
import { SliderController } from './src/ui/SliderController.js?v=1.12.31';
import { PanelManager } from './src/ui/PanelManager.js';
import { ZoomPanManager } from './src/ui/ZoomPanManager.js?v=1.12.10';
import { TypographyUnitController } from './src/ui/TypographyUnitController.js?v=1.12.29';
import { GridSettingsController } from './src/ui/GridSettingsController.js?v=1.12.31';

// Итерация 6: Elements
import { GraphicsRenderer } from './src/elements/GraphicsRenderer.js?v=1.12.25';
import { TextBlockRenderer } from './src/elements/TextBlockRenderer.js?v=1.12.27';
import { TextLayout } from './src/elements/TextLayout.js?v=1.12.27';
import { TextStyleResolver } from './src/elements/TextStyleResolver.js?v=1.12.28';
import { ObjectEditorPanelController } from './src/elements/ObjectEditorPanelController.js?v=1.12.35';
import { ObjectEditorInputController } from './src/elements/ObjectEditorInputController.js?v=1.12.35';
import { ObjectNavigatorController } from './src/elements/ObjectNavigatorController.js?v=1.12.35';
import { ObjectDragController } from './src/elements/ObjectDragController.js?v=1.12.35';
import { ObjectDocumentController } from './src/elements/ObjectDocumentController.js?v=1.12.35';
import { ObjectPlacementController } from './src/elements/ObjectPlacementController.js?v=1.12.35';
import { GraphicsAssetController } from './src/elements/GraphicsAssetController.js?v=1.12.35';

// Итерация 7: SVG Export
import { SVGExporter } from './src/svg/SVGExporter.js';
import { ExportController } from './src/svg/ExportController.js?v=1.12.36';
import { ExportDocumentBuilder } from './src/svg/ExportDocumentBuilder.js?v=1.12.36';

// Итерация 8: Preset Management
import { PresetManager } from './src/preset/PresetManager.js?v=1.12.32';
import { PresetApplicationController } from './src/preset/PresetApplicationController.js?v=1.12.35';

// Итерация 9: History Management
import { HistoryManager } from './src/history/HistoryManager.js';

// Surface model
import { SurfaceManager, SURFACE_IDS, SIDE_SURFACE_IDS } from './src/surfaces/SurfaceManager.js?v=1.12.10';
import { SurfacePanelController } from './src/surfaces/SurfacePanelController.js?v=1.12.10';
import { SurfaceCoordinateMapper } from './src/surfaces/SurfaceCoordinateMapper.js?v=1.12.11';
import { SurfaceRenderer } from './src/surfaces/SurfaceRenderer.js?v=1.12.11';

class GridGenerator {
    constructor() {
        this.SLIDER_CONFIG = createSliderConfig(this);
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
            fontSizeUnit: 'mod',  // 'mod' или 'pt' для кегля
            lineHeightUnit: 'mod',  // 'mod' или 'pt' для интерлиньяжа (независимо от fontSizeUnit)
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
        this.textStyleResolver = new TextStyleResolver(this.settingsModule);
        this.objectDocument = new ObjectDocumentController();

        // ============================================
        // Surface model
        // ============================================
        this.surfaceManager = new SurfaceManager(this.settingsModule);
        this.surfaceManager.initialize('+ New');
        this.surfacePanelController = null;
        this.currentSurfaceLayout = null;
        this.canvasRenderer = new CanvasRendererController(this);
        this.surfaceCoordinates = new SurfaceCoordinateMapper({
            settings: this.settingsModule,
            surfaceManager: this.surfaceManager,
            getLayout: () => this.currentSurfaceLayout,
            clientToSvgPoint: (clientX, clientY) => (
                this.zoomPanManager?.clientToSvgPoint(clientX, clientY) || null
            )
        });
        this.objectPlacementController = new ObjectPlacementController(this);
        this.surfaceRenderer = new SurfaceRenderer({
            settings: this.settingsModule,
            surfaceManager: this.surfaceManager,
            sideSurfaces: SIDE_SURFACE_IDS,
            getGridContext: surface => this.surfaceCoordinates.getGridContext(surface),
            createSvgElement: (type, attrs, container) => (
                this.canvasRenderer.createSvgElement(type, attrs, container)
            ),
            getContrastColor: () => this.canvasRenderer.getContrastColor(),
            getGridOpacity: opacity => this.canvasRenderer.getGridOpacity(opacity),
            getTextBlocks: () => this.textBlocks || [],
            getGraphicsBlocks: () => this.graphicsBlocks || [],
            drawTextBlock: (...args) => this.textRenderer.draw(...args),
            drawGraphicsBlock: (...args) => this.graphicsRenderer?.draw(...args),
            drawGraphicsBlockForExport: (...args) => this.graphicsRenderer?.drawForExport(...args)
        });

        // ============================================
        // Grid Calculator (Итерация 3)
        // ============================================
        this.gridCalculator = new GridCalculator(this.settingsModule);
        this.gridSettingsController = new GridSettingsController(this);
        Object.assign(this.SLIDER_CONFIG, this.gridSettingsController.getSliderConfigs());

        // ============================================
        // Grid Renderer (Итерация 4)
        // ============================================
        this.gridRenderer = new GridRenderer(this.settingsModule, this.gridCalculator);

        // ============================================
        // UI Controllers (Итерация 5)
        // ============================================
        // Инициализируем после DOMCache
        this.sliderController = null;
        this.panelManager = null;
        this.zoomPanManager = null;

        // GraphicsRenderer is initialized after the built-in SVG dimensions load.
        this.graphicsRenderer = null;

        // Storage for deletion timers to allow cancellation
        this.deletionTimers = {};

        // Undo/Redo history - отдельный HistoryManager для каждого пресета
        this.presetHistories = new Map(); // presetName → HistoryManager
        this.historyManager = new HistoryManager({ maxSize: 50 });

        // Calculate initial positions for built-in graphics
        this.objectPlacementController.updateBuiltInPositions();

        // Состояние для drag & drop текстовых блоков
        this.textDragState = {
            kind: null,
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

        // Текущий редактируемый блок в панели параграфа
        this.currentEditingBlock = null;

        // Начальное состояние блока (для отмены изменений)
        this.initialBlockState = null;

        // Display constants
        this.PADDING = 60; // padding around the grid (increased for dimensions)

        // ============================================
        // Performance: Debounced/Throttled update methods (Итерация 11)
        // ============================================
        // Debounced версия для слайдеров - откладывает рендеринг до прекращения ввода
        this._debouncedUpdateGridCore = MathUtils.debounce(() => {
            this.canvasRenderer.render();
        }, 16); // ~60fps, достаточно для плавности

        // Throttled версия для drag операций - ограничивает частоту обновлений
        this._throttledUpdateGridCore = MathUtils.throttle(() => {
            this.canvasRenderer.render();
        }, 16); // ~60fps

        // ============================================
        // Cache DOM elements (Итерация 9: DOMCache модуль)
        // ============================================
        this.domCache = new DOMCache().init();
        this.dom = this.domCache.getAll();
        this.objectEditorPanelController = new ObjectEditorPanelController(this);
        this.objectEditorInputController = new ObjectEditorInputController(this);
        this.graphicsAssetController = new GraphicsAssetController(this);
        this.objectNavigatorController = new ObjectNavigatorController(this);
        this.objectDragController = new ObjectDragController(this);
        this.objectDragController.init();
        this.initTextLayout();
        this.initTextRenderer();

        // ============================================
        // Initialize UI Controllers (Итерация 5)
        // ============================================
        this.initUIControllers();
        this.typographyUnitController = new TypographyUnitController({
            settings: this.settingsModule,
            dom: this.dom,
            sliderController: this.sliderController,
            styleResolver: this.textStyleResolver,
            beginAction: label => (
                this.historyManager.beginAction(label, this.getStateSnapshot())
            ),
            commitAction: () => this.historyManager.commitAction(this.getStateSnapshot()),
            markChanged: () => this.markAsChanged()
        });

        // ============================================
        // SVG Exporter (Итерация 7)
        // ============================================
        this.textToPath = new TextToPath();
        this.svgExporter = new SVGExporter(this.settingsModule, this.textToPath);
        this.exportDocumentBuilder = new ExportDocumentBuilder(this);
        this.exportController = new ExportController(this);
        this.presetApplicationController = new PresetApplicationController(this);

        // ============================================
        // Presets (Итерация 10: PresetManager модуль)
        // ============================================
        this.hasUnsavedChanges = false; // Флаг наличия несохраненных изменений
        this.presetManager = new PresetManager({
            dropdownToggle: this.dom.presetDropdownToggle,
            dropdownMenu: this.dom.presetDropdownMenu,
            dropdown: this.dom.presetDropdown,
            onPresetLoad: (data, name) => this.handlePresetLoad(data, name),
            onPresetSelect: (file, name) => {
                this.hasUnsavedChanges = false;
            }
        });
        this.presetManager.init();

        // Предупреждение при закрытии вкладки с несохраненными изменениями
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                // Стандартный диалог браузера
                e.preventDefault();
                e.returnValue = ''; // Для Chrome
                return ''; // Для других браузеров
            }
        });

        // Calculate initial row count to fill the format (after DOM is ready)
        const rowCount = this.gridCalculator.calculateRowCount();
        this.settingsModule.set('rowCount', rowCount);
        this.sliderController.setValue('rowCountSlider', rowCount, false);

        // Update lock buttons state
        this.gridSettingsController.syncLocks();

        // Generate row presets
        this.gridSettingsController.generateRowPresets();

        // Initialize
        this.initEventListeners();
        this.initSurfaceControls();

        // PanelManager - регистрация всех панелей
        this.initPanels();
        console.log('✅ PanelManager initialized with all panels');

        // НЕ сохраняем начальное состояние здесь — SVG иконок, claim и пресет
        // загружаются асинхронно. Первое состояние в истории будет создано
        // автоматически при первом beginAction/commitAction (загрузка пресета).
        this.initCollapsibleSections();

        // Initialize font size unit buttons state
        this.typographyUnitController.sync();
        this.initDropdowns();
        this.objectEditorInputController.initTextEditor();
        this.objectEditorInputController.initGraphicsEditor();
        this.objectEditorPanelController.initOutsideClickHandler();
        this.objectNavigatorController.init();
        this.gridSettingsController.updateLinkedControlsVisual();
        this.initColorPreview();
        this.constrainAllObjectsToGrid();
        this.updateCanvasSize();
        this.initEyeIcons();
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

    // Отметить, что были внесены изменения
    markAsChanged() {
        this.hasUnsavedChanges = true;
        if (this.presetManager) {
            this.presetManager.markAsChanged();
        }
    }

    // Сбросить флаг изменений (при загрузке пресета, импорте и т.д.)
    resetChangesFlag() {
        this.hasUnsavedChanges = false;
        this.presetManager?.markAsSaved();
    }

    get textBlocks() {
        return this.objectDocument.textBlocks;
    }

    set textBlocks(value) {
        this.objectDocument.replaceTextBlocks(value);
    }

    get graphicsBlocks() {
        return this.objectDocument.graphicsBlocks;
    }

    set graphicsBlocks(value) {
        this.objectDocument.replaceGraphicsBlocks(value);
    }

    get iconsBlock() {
        return this.objectDocument.getGraphicsBlock('icons');
    }

    set iconsBlock(value) {
        this.objectDocument.setBuiltInBlock('icons', value);
    }

    get claimBlock() {
        return this.objectDocument.getGraphicsBlock('claim');
    }

    set claimBlock(value) {
        this.objectDocument.setBuiltInBlock('claim', value);
    }


    initEventListeners() {
        // ============================================
        // NOTE: Slider initialization moved to initUIControllers()
        // ============================================

        // Show side panels checkbox
        this.dom.showSidePanels.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle side panels', this.getStateSnapshot());
            this.markAsChanged();
            this.surfaceManager.setAllSideVisibility(e.target.checked);
            this.updateEyeIcon(e.target);
            this.syncSurfaceControls();
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        this.gridSettingsController.bind();

        // Show columns checkbox
        this.dom.showColumns.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle columns', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('showColumns', e.target.checked);
            this.updateEyeIcon(e.target);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Show rows checkbox
        this.dom.showRows.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle rows', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('showRows', e.target.checked);
            this.updateEyeIcon(e.target);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Show baseline checkbox
        this.dom.showBaseline.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle baseline', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('showBaseline', e.target.checked);
            this.updateEyeIcon(e.target);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Show objects checkbox
        this.dom.showObjects.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle objects', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('showObjects', e.target.checked);
            this.updateEyeIcon(e.target);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Use x-height checkbox
        this.dom.useXHeight.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle x-height', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('useXHeight', e.target.checked);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Use x-height 2 checkbox
        this.dom.useXHeight2.addEventListener('change', (e) => {
            this.historyManager.beginAction('toggle x-height 2', this.getStateSnapshot());
            this.markAsChanged();
            this.settingsModule.set('useXHeight2', e.target.checked);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Use x-height Caption checkbox
        if (this.dom.useXHeightCaption) {
            this.dom.useXHeightCaption.addEventListener('change', (e) => {
                this.historyManager.beginAction('toggle x-height caption', this.getStateSnapshot());
                this.markAsChanged();
                this.settingsModule.set('useXHeightCaption', e.target.checked);
                this.updateGrid();
                this.historyManager.commitAction(this.getStateSnapshot());
            });
        }


        this.typographyUnitController.bindButtons();

        // Style dropdowns в панели Text Styles - изменяют начертание (font-weight)
        const headlineStyleDropdown = document.getElementById('headlineStyleDropdown');
        const textStyleDropdown = document.getElementById('textStyleDropdown');

        if (headlineStyleDropdown) {
            headlineStyleDropdown.addEventListener('change', (e) => {
                this.historyManager.beginAction('change headline font weight', this.getStateSnapshot());
                this.settingsModule.set('headlineFontWeight', parseInt(e.target.value));
                this.objectNavigatorController.render();
                this.updateGrid();
                this.historyManager.commitAction(this.getStateSnapshot());
            });
        }

        if (textStyleDropdown) {
            textStyleDropdown.addEventListener('change', (e) => {
                this.historyManager.beginAction('change text font weight', this.getStateSnapshot());
                this.settingsModule.set('textFontWeight', parseInt(e.target.value));
                this.objectNavigatorController.render();
                this.updateGrid();
                this.historyManager.commitAction(this.getStateSnapshot());
            });
        }

        const captionStyleDropdown = document.getElementById('captionStyleDropdown');
        if (captionStyleDropdown) {
            captionStyleDropdown.addEventListener('change', (e) => {
                this.historyManager.beginAction('change caption font weight', this.getStateSnapshot());
                this.settingsModule.set('captionFontWeight', parseInt(e.target.value));
                this.objectNavigatorController.render();
                this.updateGrid();
                this.historyManager.commitAction(this.getStateSnapshot());
            });
        }

        // Lunnen Display doesn't have font weight dropdown (always Regular)

        // Color preview button - toggle HSB picker
        this.dom.colorPreview.addEventListener('click', () => {
            const isVisible = this.dom.hsbPicker.style.display !== 'none';
            this.dom.hsbPicker.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                this.updateHSBFromHex(this.settingsModule.get('boxColor'));
            }
        });

        // Lunnen Blue preset
        this.dom.lunnenBlue.addEventListener('click', () => {
            this.historyManager.beginAction('apply Lunnen Blue color', this.getStateSnapshot());
            this.markAsChanged();
            const lunnenBlueColor = '#2353DB';
            this.settingsModule.set('boxColor', lunnenBlueColor);
            this.dom.hexColorInput.value = lunnenBlueColor;
            this.dom.colorPreview.style.backgroundColor = lunnenBlueColor;
            this.updateHSBFromHex(lunnenBlueColor);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Hex color input - history tracking
        this.dom.hexColorInput.addEventListener('focus', () => {
            this.historyManager.beginAction('edit hex color', this.getStateSnapshot());
        });

        // Hex color input - только форматирование при вводе, без применения изменений
        this.dom.hexColorInput.addEventListener('input', (e) => {
            let hexValue = e.target.value;

            // Remove all # symbols and add one at the start
            hexValue = hexValue.replace(/#/g, '');
            if (hexValue) {
                hexValue = '#' + hexValue;
                e.target.value = hexValue;
            }
        });

        // Обработка Enter для hexColorInput
        this.dom.hexColorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.dom.hexColorInput.blur();
            }
        });

        // Validate hex input when focus is lost
        this.dom.hexColorInput.addEventListener('blur', (e) => {
            let hexValue = e.target.value;

            if (!hexValue.match(/^#[0-9A-Fa-f]{6}$/)) {
                // Если некорректный, берем текущий цвет из настроек вместо дефолтного
                hexValue = this.settingsModule.get('boxColor') || '#dadde6';
            }

            // Проверяем, изменился ли цвет
            const currentColor = this.settingsModule.get('boxColor');
            if (hexValue !== currentColor) {
                this.markAsChanged();
            }

            e.target.value = hexValue;
            this.settingsModule.set('boxColor', hexValue);
            this.dom.colorPreview.style.backgroundColor = hexValue;
            this.updateHSBFromHex(hexValue);
            this.updateGrid();
            this.historyManager.commitAction(this.getStateSnapshot());
        });

        // Export button
        this.dom.exportBtn.addEventListener('click', () => this.exportController.exportSvg());

        // Export PDF button
        if (this.dom.exportPDFBtn) {
            this.dom.exportPDFBtn.addEventListener('click', () => this.exportController.exportPdf());
        }

        // Export Settings button
        this.dom.exportSettingsBtn.addEventListener(
            'click',
            () => this.exportController.exportSettings()
        );

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
                this.exportController.exportSvg();
            }
            // Cmd+Z / Ctrl+Z - Undo, Cmd+Shift+Z / Ctrl+Shift+Z - Redo
            // Используем toLowerCase() т.к. при зажатом Shift e.key может быть 'Z' (заглавная)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                // Если пользователь в инпуте — сначала коммитим текущие изменения (blur),
                // а потом выполняем undo/redo
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    activeEl.blur();
                }
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            }
            // Delete / Backspace - Delete selected element
            if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
                // Проверяем, что пользователь не находится в поле ввода
                const activeElement = document.activeElement;
                const isInputFocused = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                );

                if (!isInputFocused) {
                    // Проверяем, есть ли выделенный текстовый блок
                    if (this.currentEditingBlock) {
                        e.preventDefault();
                        const blockId = this.currentEditingBlock.id;
                        const block = this.textBlocks.find(b => b.id === blockId);
                        if (block) {
                            const name = block.content.substring(0, 30) + (block.content.length > 30 ? '...' : '');

                            // Close panel first
                            this.objectEditorPanelController.closeTextPanel();

                            // Find the delete button in elements list and trigger delete
                            const elementButton = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                            if (elementButton) {
                                const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                                if (deleteBtn) {
                                    this.objectNavigatorController.startDelete(
                                        deleteBtn,
                                        'text',
                                        blockId,
                                        name
                                    );
                                }
                            }
                        }
                    }
                    // Проверяем, есть ли выделенный графический блок
                    else if (this.currentEditingGraphicsId) {
                        e.preventDefault();
                        const blockId = this.currentEditingGraphicsId;
                        const block = this.objectDocument.getGraphicsBlock(blockId);
                        if (block) {
                            const name = block.name || 'Graphic';

                            // Close panel first
                            this.objectEditorPanelController.closeGraphicsPanel();

                            // Find the delete button in elements list and trigger delete
                            const elementButton = this.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                            if (elementButton) {
                                const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                                if (deleteBtn) {
                                    this.objectNavigatorController.startDelete(
                                        deleteBtn,
                                        'graphics',
                                        blockId,
                                        name
                                    );
                                }
                            }
                        }
                    }
                }
            }
        });

        // Initialize panel collapse functionality
        this.initPanelCollapse();
    }


    // ============================================
    // Panel Collapse Functionality
    // ============================================

    /**
     * Инициализация управления отдельными боковыми поверхностями.
     */
    initSurfaceControls() {
        this.surfacePanelController = new SurfacePanelController({
            dom: this.dom,
            surfaceManager: this.surfaceManager,
            sliderController: this.sliderController,
            sideSurfaces: SIDE_SURFACE_IDS,
            onBeginAction: action => this.historyManager.beginAction(action, this.getStateSnapshot()),
            onCommitAction: () => this.historyManager.commitAction(this.getStateSnapshot()),
            onMarkChanged: () => this.markAsChanged(),
            onConstrainObjects: () => this.constrainAllObjectsToGrid(),
            onRender: () => this.updateGrid(),
            onRenderDebounced: () => this.updateGridDebounced(),
            onUpdateEyeIcon: input => this.updateEyeIcon(input)
        });
        this.surfacePanelController.init();
    }

    syncSurfaceControls() {
        this.surfacePanelController?.sync();
    }

    moveBlockToSurface(block, surface) {
        if (!block || !SURFACE_IDS.includes(surface)) return;
        block.surface = surface;
        block.x = 1;
        block.row = 0;
        block.baselineOffset = 0;
        this.constrainAllObjectsToGrid();
        if (this.currentEditingBlock?.id === block.id) {
            if (this.dom.paragraphXInput) this.dom.paragraphXInput.value = 1;
            if (this.dom.paragraphRowInput) this.dom.paragraphRowInput.value = 1;
            if (this.dom.paragraphBaselineInput) this.dom.paragraphBaselineInput.value = 1;
        }
        if (this.currentEditingGraphicsId === block.id) {
            if (this.dom.graphicsXInput) this.dom.graphicsXInput.value = 1;
            if (this.dom.graphicsRowInput) this.dom.graphicsRowInput.value = 1;
            if (this.dom.graphicsBaselineInput) this.dom.graphicsBaselineInput.value = 1;
        }
    }

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

            const isInitiallyCollapsed = panel.classList.contains('panel-collapsed');
            icon.classList.toggle('collapsed', isInitiallyCollapsed);
            icon.setAttribute('aria-expanded', String(!isInitiallyCollapsed));
            icon.setAttribute('aria-label', isInitiallyCollapsed ? 'Expand panel' : 'Collapse panel');

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
                    icon.setAttribute('aria-expanded', 'true');

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
                    icon.setAttribute('aria-expanded', 'false');
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
            const mod = this.settingsModule.get('gridModule').toFixed(2);
            const col = this.settingsModule.get('columnCount');
            const row = this.settingsModule.get('rowCount');
            gridParams.textContent = `Mod ${mod}  •  Col ${col}  •  Row ${row}`;
        }

        // Dimensions panel
        const dimensionsParams = document.getElementById('dimensionsParams');
        if (dimensionsParams) {
            const w = Math.round(this.settingsModule.get('frontWidth'));
            const h = Math.round(this.settingsModule.get('frontHeight'));
            const t = Math.round(this.settingsModule.get('thickness'));
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

    // Handle preset load from PresetManager
    async handlePresetLoad(data, presetName) {
        return this.presetApplicationController.load(data, presetName);
    }

    syncApplicationUI() {
        const settings = this.settingsModule.getAll();
        this.gridSettingsController.sync(settings);

        const manualSettings = {
            headlineSizeSlider: 'headlineSize',
            lineHeightSlider: 'lineHeight',
            textSizeSlider: 'textSize',
            textLineHeightSlider: 'textLineHeight',
            captionSizeSlider: 'captionSize',
            captionLineHeightSlider: 'captionLineHeight',
            lunnenDisplaySizeSlider: 'lunnenDisplaySize',
            lunnenDisplayLineHeightSlider: 'lunnenDisplayLineHeight'
        };
        const sizeStyles = {
            headlineSize: 'headline',
            textSize: 'text',
            captionSize: 'caption',
            lunnenDisplaySize: 'lunnenDisplay'
        };

        Object.entries(this.SLIDER_CONFIG).forEach(([sliderId, config]) => {
            if (this.gridSettingsController.isGridSlider(sliderId)) return;
            if (config.setting && settings[config.setting] !== undefined) {
                this.sliderController.setValue(sliderId, settings[config.setting], false);
                return;
            }

            const settingKey = manualSettings[sliderId];
            if (!settingKey || settings[settingKey] === undefined) return;
            const isSize = settingKey.endsWith('Size');
            const unit = isSize
                ? (settings.fontSizeUnit || 'mod')
                : (settings.lineHeightUnit || 'mod');
            let displayValue = settings[settingKey];
            if (unit === 'pt') {
                const millimeters = isSize
                    ? this.textStyleResolver.calculateFontSize(sizeStyles[settingKey])
                    : displayValue * settings.gridModule;
                displayValue = MathUtils.mmToPt(millimeters);
            }
            this.sliderController.setValue(
                sliderId,
                Number.parseFloat(displayValue.toFixed(2)),
                false
            );
        });

        if (this.dom.useXHeight) this.dom.useXHeight.checked = settings.useXHeight !== false;
        if (this.dom.useXHeight2) this.dom.useXHeight2.checked = settings.useXHeight2 || false;
        if (this.dom.useXHeightCaption) {
            this.dom.useXHeightCaption.checked = settings.useXHeightCaption || false;
        }

        this.typographyUnitController.syncButtons(settings);
        if (settings.boxColor) {
            if (this.dom.colorPreview) this.dom.colorPreview.style.backgroundColor = settings.boxColor;
            if (this.dom.hexColorInput) this.dom.hexColorInput.value = settings.boxColor;
            this.updateHSBFromHex(settings.boxColor);
        }

        this.gridSettingsController.generateRowPresets();
        this.syncSurfaceControls();
    }

    initColorPreview() {
        // Set initial color preview
        this.dom.colorPreview.style.backgroundColor = this.settingsModule.get('boxColor');
        this.updateHSBFromHex(this.settingsModule.get('boxColor'));
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
                    this.historyManager.beginAction(`select ${sliderId} dropdown`, this.getStateSnapshot());
                    const value = parseFloat(item.getAttribute('data-value'));

                    // Update slider using universal method
                    this.updateSliderValue(sliderId, value);

                    // Close dropdown
                    dropdown.classList.remove('active');
                    this.historyManager.commitAction(this.getStateSnapshot());
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
            headlineStyleDropdown.value = this.settingsModule.get('headlineFontWeight').toString();
        }

        if (textStyleDropdown) {
            textStyleDropdown.value = this.settingsModule.get('textFontWeight').toString();
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
    constrainElementsToBounds() {
        this.objectPlacementController.constrainAll();
    }

    // Инициализация панели настроек иконок
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
        this.markAsChanged();
        const h = parseInt(this.dom.hueSlider.value);
        const s = parseInt(this.dom.saturationSlider.value);
        const b = parseInt(this.dom.brightnessSlider.value);

        const rgb = ColorUtils.hsbToRgb(h, s, b);
        const hex = ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);

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
        // Применяем градиент к широким дорожкам через динамические стили для псевдоэлементов
        this.updateSliderWideTrackGradient('saturationSlider', gradient);
    }

    updateBrightnessGradient() {
        const h = parseInt(this.dom.hueSlider.value);
        const s = parseInt(this.dom.saturationSlider.value);

        const leftColor = ColorUtils.hsbToRgb(h, s, 0);
        const rightColor = ColorUtils.hsbToRgb(h, s, 100);

        const leftHex = ColorUtils.rgbToHex(leftColor.r, leftColor.g, leftColor.b);
        const rightHex = ColorUtils.rgbToHex(rightColor.r, rightColor.g, rightColor.b);

        const gradient = `linear-gradient(to right, ${leftHex}, ${rightHex})`;
        // Применяем градиент к широким дорожкам через динамические стили для псевдоэлементов
        this.updateSliderWideTrackGradient('brightnessSlider', gradient);
    }

    updateSliderWideTrackGradient(sliderId, gradient) {
        // Remove existing style if present
        let styleId = `${sliderId}-wide-track-style`;
        let existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create new style element для широких дорожек (высота 10px вместо 1px)
        // Центрируем ползунок: (10px - 8px) / 2 = 1px
        // Используем конкретное значение 8px вместо CSS переменной для надежности
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #${sliderId}::-webkit-slider-runnable-track {
                background: ${gradient} !important;
                height: 10px !important;
            }
            #${sliderId}::-moz-range-track {
                background: ${gradient} !important;
                height: 10px !important;
            }
            #${sliderId}::-webkit-slider-thumb {
                width: 8px !important;
                height: 8px !important;
                margin-top: 1px !important;
            }
            #${sliderId}::-moz-range-thumb {
                width: 8px !important;
                height: 8px !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // Universal method to update slider value based on configuration
    updateSliderValue(sliderId, newValue) {
        this.sliderController.setValue(sliderId, newValue, true);
    }

    getDecimalsFromStep(step) {
        return this.sliderController.getDecimalsFromStep(step);
    }

    updateCanvasSize() {
        // Calculate canvas size based on viewport height
        const viewportHeight = window.innerHeight;
        const topBottomPadding = 40; // 20px padding on each side
        this.DISPLAY_SIZE = viewportHeight - topBottomPadding;
    }

    constrainAllObjectsToGrid() {
        this.objectPlacementController.constrainAll();
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
                return this.settingsModule.get('headlineFontWeight') === 500 ? 'Medium' : 'Regular';
            case 'text':
                return this.settingsModule.get('textFontWeight') === 500 ? 'Medium' : 'Regular';
            case 'caption':
                return this.settingsModule.get('captionFontWeight') === 500 ? 'Medium' : 'Regular';
            case 'lunnenDisplay':
                return 'Regular'; // Lunnen Display always Regular
            default:
                return 'Medium';
        }
    }

    getSurfaceGridContext(surface = 'front') {
        return this.surfaceCoordinates.getGridContext(surface);
    }

    // Конвертировать Row + BaselineOffset в Y (позиция в baseline модулях)
    rowBaselineToY(row, baselineOffset, surface = 'front') {
        return this.surfaceCoordinates.rowBaselineToY(row, baselineOffset, surface);
    }

    // Конвертировать Y (позиция в baseline модулях) в Row + BaselineOffset
    yToRowBaseline(y, surface = 'front') {
        return this.surfaceCoordinates.yToRowBaseline(y, surface);
    }

    // Получить Y позицию блока в baseline модулях
    getBlockY(block) {
        return this.surfaceCoordinates.getBlockY(block);
    }

    getSurfacePointer(clientX, clientY) {
        return this.surfaceCoordinates.getSurfacePointer(clientX, clientY);
    }

    // Конвертировать колонки в мм
    columnsToMm(columns, surface = 'front') {
        return this.surfaceCoordinates.columnsToMm(columns, surface);
    }

    // Конвертировать мм в колонки
    mmToColumns(widthMm, surface = 'front') {
        return this.surfaceCoordinates.mmToColumns(widthMm, surface);
    }

    // Load SVG files from graphics folder (works only over HTTP, not file://)
    // This function MUST be called to load SVG content for icons and claim
    async initializeBuiltInGraphics() {
        // Load icons.svg from graphics folder
        try {
            const iconsData = await this.graphicsAssetController.load('graphics/icons.svg');
            if (iconsData) {
                const iconsBlock = this.objectDocument.getGraphicsBlock('icons');
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
            const iconsBlock = this.objectDocument.getGraphicsBlock('icons');
            if (iconsBlock && !iconsBlock.svgContent) {
                console.error('Icons block has no SVG content - file graphics/icons.svg must be loaded');
            }
        }

        // Load yf_claim.svg from graphics folder
        try {
            const claimData = await this.graphicsAssetController.load('graphics/yf_claim.svg');
            if (claimData) {
                const claimBlock = this.objectDocument.getGraphicsBlock('claim');
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
            const claimBlock = this.objectDocument.getGraphicsBlock('claim');
            if (claimBlock && !claimBlock.svgContent) {
                console.error('Claim block has no SVG content - file graphics/yf_claim.svg must be loaded');
            }
        }

        // Update positions after dimensions are loaded (or use existing)
        this.objectPlacementController.updateBuiltInPositions();

        this.initGraphicsRenderer();

        // Update navigator and redraw grid
        this.objectNavigatorController.render();
        this.updateGrid();
    }

    // Update eye icon for toggle-chip and checkbox-label elements
    updateEyeIcon(checkbox) {
        const label = checkbox.closest('label');
        if (!label) return;

        const isChecked = checkbox.checked;

        // Add/remove class for checked state (for CSS compatibility)
        if (isChecked) {
            label.classList.add('toggle-chip-checked');
        } else {
            label.classList.remove('toggle-chip-checked');
        }
    }

    // Initialize eye icons on page load
    initEyeIcons() {
        // Initialize all toggle-chip and checkbox-label eye icons
        const checkboxes = [
            this.dom.showColumns,
            this.dom.showRows,
            this.dom.showBaseline,
            this.dom.showSidePanels,
            this.dom.surfaceVisibleToggle,
            this.dom.showObjects
        ];

        checkboxes.forEach(checkbox => {
            if (checkbox) {
                this.updateEyeIcon(checkbox);
            }
        });
    }


    /**
     * Немедленное обновление сетки (для критичных операций)
     * Используйте updateGridDebounced() для слайдеров
     */
    updateGrid() {
        this.canvasRenderer.render();
    }

    /**
     * Debounced обновление сетки - для слайдеров и частых изменений
     * Откладывает рендеринг до прекращения ввода
     */
    updateGridDebounced() {
        this._debouncedUpdateGridCore();
    }

    /**
     * Throttled обновление сетки - для drag операций
     * Ограничивает частоту обновлений до ~60fps
     */
    updateGridThrottled() {
        this._throttledUpdateGridCore();
    }

    // Итерация 7: Импорт настроек из JSON
    async importSettings(file) {
        try {
            await this.presetApplicationController.importFile(file);
            console.log('✅ Settings imported successfully');
        } catch (error) {
            console.error('❌ Failed to import settings:', error);
            alert('Ошибка при импорте настроек: ' + error.message);
        }
    }

    getStateSnapshot() {
        return this.presetApplicationController.createSnapshot();
    }

    undo() {
        if (!this.presetApplicationController.undo()) {
            console.log('[UNDO] Nothing to undo');
        }
    }

    redo() {
        if (!this.presetApplicationController.redo()) {
            console.log('[REDO] Nothing to redo');
        }
    }

    initSliderHistoryHandlers() {
        // Map для отслеживания активных транзакций слайдеров
        this.activeSliderTransactions = new Map();
        // Set для отслеживания транзакций по вводу значений с клавиатуры
        this.activeInputTransactions = new Set();

        // Добавляем обработчики для каждого слайдера
        this.sliderController.sliders.forEach((sliderData, sliderId) => {
            const slider = sliderData.element;
            const valueInput = sliderData.valueInput;

            // ===== Обработчики для перетаскивания слайдера мышью =====

            // Начало перетаскивания - начинаем транзакцию
            slider.addEventListener('mousedown', (e) => {
                // Только левая кнопка мыши
                if (e.button !== 0) return;

                // Сохраняем состояние "до" изменений
                this.historyManager.beginAction(`adjust ${sliderId}`, this.getStateSnapshot());
                this.activeSliderTransactions.set(sliderId, true);
            });

            // Окончание перетаскивания - завершаем транзакцию
            slider.addEventListener('mouseup', (e) => {
                // Только левая кнопка мыши
                if (e.button !== 0) return;

                if (this.activeSliderTransactions.has(sliderId)) {
                    // Сохраняем состояние "после" изменений
                    this.historyManager.commitAction(this.getStateSnapshot());
                    this.activeSliderTransactions.delete(sliderId);
                }
            });

            // Обработка случая, когда мышь уходит за пределы слайдера во время перетаскивания
            slider.addEventListener('mouseleave', (e) => {
                // Если кнопка мыши все еще зажата, это означает, что перетаскивание продолжается
                // Мы не завершаем транзакцию здесь, а ждем mouseup
            });

            // ===== Обработчики для ввода значений с клавиатуры =====
            // Паттерн: focus → beginAction, blur → commitAction
            // Группирует все изменения (набор текста, стрелки) в одно действие

            if (valueInput) {
                valueInput.addEventListener('focus', () => {
                    if (!this.activeInputTransactions.has(sliderId)) {
                        this.historyManager.beginAction(`type ${sliderId}`, this.getStateSnapshot());
                        this.activeInputTransactions.add(sliderId);
                    }
                });

                valueInput.addEventListener('blur', () => {
                    if (this.activeInputTransactions.has(sliderId)) {
                        this.historyManager.commitAction(this.getStateSnapshot());
                        this.activeInputTransactions.delete(sliderId);
                    }
                });
            }
        });

        // Глобальный обработчик mouseup на случай, если мышь отпущена вне слайдера
        document.addEventListener('mouseup', (e) => {
            if (this.activeSliderTransactions.size > 0) {
                // Завершаем все активные транзакции
                this.activeSliderTransactions.forEach((_, sliderId) => {
                    this.historyManager.commitAction(this.getStateSnapshot());
                });
                this.activeSliderTransactions.clear();
            }
        });
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

        // Добавляем обработчики mousedown/mouseup для группировки действий слайдеров
        this.initSliderHistoryHandlers();

        console.log('✅ SliderController initialized with', this.sliderController.sliders.size, 'sliders');

        // PanelManager
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

        this.dom.canvasRotateLeftBtn?.addEventListener('click', () => {
            this.zoomPanManager.rotateLeft();
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
            { id: 'rightSettingsStack', headerId: 'gridPanelHeader', draggable: true },
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

    initGraphicsRenderer() {
        this.graphicsRenderer = new GraphicsRenderer({
            settings: this.settingsModule,
            createSvgElement: (type, attrs, container) => (
                this.canvasRenderer.createSvgElement(type, attrs, container)
            ),
            getContrastColor: () => this.canvasRenderer.getContrastColor(),
            getBlockY: block => this.getBlockY(block),
            attachInteractions: (group, block) => (
                this.objectDragController.attachGraphics(group, block)
            )
        });
    }

    initTextRenderer() {
        this.textRenderer = new TextBlockRenderer({
            settings: this.settingsModule,
            createSvgElement: (type, attrs, container) => (
                this.canvasRenderer.createSvgElement(type, attrs, container)
            ),
            getContrastColor: () => this.canvasRenderer.getContrastColor(),
            getStyleSettings: styleRef => this.textStyleResolver.getStyleSettings(styleRef),
            getFontMetrics: styleRef => this.textStyleResolver.getFontMetrics(styleRef),
            layout: this.textLayout,
            attachInteractions: (element, block) => (
                this.objectDragController.attachText(element, block)
            ),
            attachResize: (handle, block) => (
                this.objectDragController.attachTextResize(handle, block)
            ),
            isDragging: () => this.textDragState.isDragging
        });
    }

    initTextLayout() {
        this.textLayout = new TextLayout({
            settings: this.settingsModule,
            getSurfaceGridContext: surface => this.getSurfaceGridContext(surface),
            getBlockY: block => this.getBlockY(block)
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
