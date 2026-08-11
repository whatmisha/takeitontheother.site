// ============================================
// Импорты модулей
// ============================================
// Итерация 1: Утилиты
import { MathUtils } from './src/utils/MathUtils.js';
import { DOMUtils } from './src/utils/DOMUtils.js';
import { TextToPath } from './src/utils/TextToPath.js';

// Итерация 2: Core
import { Settings } from './src/core/Settings.js';
import { DOMCache } from './src/core/DOMCache.js?v=1.12.17';
import { ApplicationStartupController } from './src/core/ApplicationStartupController.js?v=1.12.41';

// Итерация 3: Grid
import { GridCalculator } from './src/grid/GridCalculator.js?v=1.12.28';
import { GridRenderer } from './src/grid/GridRenderer.js?v=1.12.46';
import { CanvasRendererController } from './src/grid/CanvasRendererController.js?v=1.12.38';

// Итерация 4: Config
import { createSliderConfig } from './src/config/SliderConfigFactory.js?v=1.12.38';

// Итерация 5: UI Controllers
import { SliderController } from './src/ui/SliderController.js?v=1.12.50';
import { PanelManager } from './src/ui/PanelManager.js';
import { ZoomPanManager } from './src/ui/ZoomPanManager.js?v=1.12.47';
import { TypographyUnitController } from './src/ui/TypographyUnitController.js?v=1.12.29';
import { GridSettingsController } from './src/ui/GridSettingsController.js?v=1.12.48';
import { ColorPanelController } from './src/ui/ColorPanelController.js?v=1.12.38';
import { SliderHistoryController } from './src/ui/SliderHistoryController.js?v=1.12.38';
import { ApplicationEventController } from './src/ui/ApplicationEventController.js?v=1.12.39';
import { PanelUiController } from './src/ui/PanelUiController.js?v=1.12.39';

// Итерация 6: Elements
import { GraphicsRenderer } from './src/elements/GraphicsRenderer.js?v=1.12.25';
import { TextBlockRenderer } from './src/elements/TextBlockRenderer.js?v=1.12.57';
import { TextLayout } from './src/elements/TextLayout.js?v=1.12.27';
import { TextStyleResolver } from './src/elements/TextStyleResolver.js?v=1.12.28';
import { ObjectEditorPanelController } from './src/elements/ObjectEditorPanelController.js?v=1.12.53';
import { ObjectEditorInputController } from './src/elements/ObjectEditorInputController.js?v=1.12.45';
import { TextEditorPositionController } from './src/elements/TextEditorPositionController.js?v=1.12.45';
import { LunnenDisplayEditorController } from './src/elements/LunnenDisplayEditorController.js?v=1.12.45';
import { GraphicsEditorInputController } from './src/elements/GraphicsEditorInputController.js?v=1.12.44';
import { GraphicsEditorEventController } from './src/elements/GraphicsEditorEventController.js?v=1.12.44';
import { ObjectNavigatorController } from './src/elements/ObjectNavigatorController.js?v=1.12.52';
import { ObjectDragController } from './src/elements/ObjectDragController.js?v=1.12.35';
import { ObjectDocumentController } from './src/elements/ObjectDocumentController.js?v=1.12.39';
import { ObjectPlacementController } from './src/elements/ObjectPlacementController.js?v=1.12.35';
import { GraphicsAssetController } from './src/elements/GraphicsAssetController.js?v=1.12.35';
import { BuiltInGraphicsController } from './src/elements/BuiltInGraphicsController.js?v=1.12.54';

// Итерация 7: SVG Export
import { SVGExporter } from './src/svg/SVGExporter.js?v=1.12.51';
import { ExportController } from './src/svg/ExportController.js?v=1.12.42';
import { ExportDocumentBuilder } from './src/svg/ExportDocumentBuilder.js?v=1.12.36';

// Итерация 8: Preset Management
import { PresetManager } from './src/preset/PresetManager.js?v=1.12.49';
import { PresetApplicationController } from './src/preset/PresetApplicationController.js?v=1.12.42';

// Итерация 9: History Management
import { HistoryManager } from './src/history/HistoryManager.js?v=1.12.56';

// Surface model
import { SurfaceManager, SURFACE_IDS, SIDE_SURFACE_IDS } from './src/surfaces/SurfaceManager.js?v=1.12.10';
import { SurfacePanelController } from './src/surfaces/SurfacePanelController.js?v=1.12.10';
import { SurfaceCoordinateMapper } from './src/surfaces/SurfaceCoordinateMapper.js?v=1.12.11';
import { SurfaceRenderer } from './src/surfaces/SurfaceRenderer.js?v=1.12.11';

class GridGenerator {
    constructor() {
        this.isInitializing = true;
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
            getTextBlocks: () => this.objectDocument.textBlocks,
            getGraphicsBlocks: () => this.objectDocument.graphicsBlocks,
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
        this.panelUiController = new PanelUiController(this);
        this.colorPanelController = new ColorPanelController({
            settings: this.settingsModule,
            dom: this.dom,
            beginAction: label => this.historyManager.beginAction(label, this.getStateSnapshot()),
            commitAction: () => this.historyManager.commitAction(this.getStateSnapshot()),
            markChanged: () => this.markAsChanged(),
            render: () => this.updateGrid()
        });
        this.objectEditorPanelController = new ObjectEditorPanelController(this);
        this.objectEditorInputController = new ObjectEditorInputController(this);
        this.textEditorPositionController = new TextEditorPositionController(this);
        this.lunnenDisplayEditorController = new LunnenDisplayEditorController(this);
        this.graphicsEditorInputController = new GraphicsEditorInputController(this);
        this.graphicsEditorEventController = new GraphicsEditorEventController(this);
        this.graphicsAssetController = new GraphicsAssetController(this);
        this.objectNavigatorController = new ObjectNavigatorController(this);
        this.builtInGraphicsController = new BuiltInGraphicsController({
            assetController: this.graphicsAssetController,
            objectDocument: this.objectDocument,
            onReady: () => {
                this.objectPlacementController.updateBuiltInPositions();
                this.initGraphicsRenderer();
            }
        });
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
        this.applicationEventController = new ApplicationEventController(this);

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
        this.startupController = new ApplicationStartupController({
            loadPresets: () => this.presetManager.init(),
            loadBuiltInGraphics: () => this.builtInGraphicsController.initialize(),
            finalize: () => this.finalizeInitialization(),
            fit: () => this.zoomPanManager?.fitToScreen()
        });

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

        // Initial history is created when the awaited default preset is applied.
        this.panelUiController.bindCollapsibleSections();

        // Initialize font size unit buttons state
        this.typographyUnitController.sync();
        this.panelUiController.bindDropdowns();
        this.objectEditorInputController.initTextEditor();
        this.textEditorPositionController.init();
        this.lunnenDisplayEditorController.init();
        this.graphicsEditorEventController.init();
        this.objectEditorPanelController.initOutsideClickHandler();
        this.objectNavigatorController.init();
        this.gridSettingsController.updateLinkedControlsVisual();
        this.colorPanelController.initialize();
        this.updateCanvasSize();
        this.initEyeIcons();

        // Update canvas size on window resize
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.updateGrid();
        });
    }

    finalizeInitialization() {
        this.constrainAllObjectsToGrid();
        this.objectNavigatorController.render();
        this.updateCanvasSize();
        this.isInitializing = false;
        this.updateGrid();
        document.documentElement.dataset.appReady = 'true';
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

    initEventListeners() {
        this.applicationEventController.bind();
        this.panelUiController.bindPanelCollapse();
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
        this.panelUiController.syncFontWeights(settings);
        this.colorPanelController.sync(settings.boxColor);

        this.gridSettingsController.generateRowPresets();
        this.syncSurfaceControls();
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
        if (this.isInitializing) return;
        this.canvasRenderer.render();
    }

    /**
     * Debounced обновление сетки - для слайдеров и частых изменений
     * Откладывает рендеринг до прекращения ввода
     */
    updateGridDebounced() {
        if (this.isInitializing) return;
        this._debouncedUpdateGridCore();
    }

    /**
     * Throttled обновление сетки - для drag операций
     * Ограничивает частоту обновлений до ~60fps
     */
    updateGridThrottled() {
        if (this.isInitializing) return;
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

        this.sliderHistoryController = new SliderHistoryController({
            sliderController: this.sliderController,
            beginAction: label => this.historyManager.beginAction(label, this.getStateSnapshot()),
            commitAction: () => this.historyManager.commitAction(this.getStateSnapshot())
        });
        this.sliderHistoryController.bind();

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

    try {
        const generator = new GridGenerator();
        await generator.startupController.initialize();
    } catch (error) {
        document.documentElement.dataset.appReady = 'error';
        console.error('Application initialization failed:', error);
    }
});
