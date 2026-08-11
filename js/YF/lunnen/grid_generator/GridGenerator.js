import { TextToPath } from './src/utils/TextToPath.js';

import { Settings } from './src/core/Settings.js?v=1.12.64';
import { DOMCache } from './src/core/DOMCache.js?v=1.12.63';
import { ApplicationStartupController } from './src/core/ApplicationStartupController.js?v=1.12.41';
import { ApplicationUiSynchronizer } from './src/core/ApplicationUiSynchronizer.js?v=1.12.64';
import { RenderScheduler } from './src/core/RenderScheduler.js?v=1.12.64';

import { GridCalculator } from './src/grid/GridCalculator.js?v=1.12.28';
import { GridRenderer } from './src/grid/GridRenderer.js?v=1.12.46';
import { CanvasRendererController } from './src/grid/CanvasRendererController.js?v=1.12.38';

import { createSliderConfig } from './src/config/SliderConfigFactory.js?v=1.12.64';

import { SliderController } from './src/ui/SliderController.js?v=1.12.50';
import { PanelManager } from './src/ui/PanelManager.js?v=1.12.61';
import { ZoomPanManager } from './src/ui/ZoomPanManager.js?v=1.12.47';
import { TypographyUnitController } from './src/ui/TypographyUnitController.js?v=1.12.29';
import { GridSettingsController } from './src/ui/GridSettingsController.js?v=1.12.59';
import { ColorPanelController } from './src/ui/ColorPanelController.js?v=1.12.38';
import { SliderHistoryController } from './src/ui/SliderHistoryController.js?v=1.12.38';
import { ApplicationEventController } from './src/ui/ApplicationEventController.js?v=1.12.39';
import { PanelUiController } from './src/ui/PanelUiController.js?v=1.12.61';
import { ZoomToolbarController } from './src/ui/ZoomToolbarController.js?v=1.12.64';

import { GraphicsRenderer } from './src/elements/GraphicsRenderer.js?v=1.12.25';
import { TextBlockRenderer } from './src/elements/TextBlockRenderer.js?v=1.12.57';
import { TextLayout } from './src/elements/TextLayout.js?v=1.12.27';
import { TextStyleResolver } from './src/elements/TextStyleResolver.js?v=1.12.28';
import { ObjectEditorPanelController } from './src/elements/ObjectEditorPanelController.js?v=1.12.53';
import { ObjectEditorInputController } from './src/elements/ObjectEditorInputController.js?v=1.12.45';
import { TextEditorPositionController } from './src/elements/TextEditorPositionController.js?v=1.12.60';
import { LunnenDisplayEditorController } from './src/elements/LunnenDisplayEditorController.js?v=1.12.45';
import { GraphicsEditorInputController } from './src/elements/GraphicsEditorInputController.js?v=1.12.44';
import { GraphicsEditorEventController } from './src/elements/GraphicsEditorEventController.js?v=1.12.44';
import { ObjectNavigatorController } from './src/elements/ObjectNavigatorController.js?v=1.12.52';
import { ObjectDragController } from './src/elements/ObjectDragController.js?v=1.12.58';
import { ObjectDocumentController } from './src/elements/ObjectDocumentController.js?v=1.12.39';
import { ObjectPlacementController } from './src/elements/ObjectPlacementController.js?v=1.12.35';
import { GraphicsAssetController } from './src/elements/GraphicsAssetController.js?v=1.12.35';
import { BuiltInGraphicsController } from './src/elements/BuiltInGraphicsController.js?v=1.12.54';

import { SVGExporter } from './src/svg/SVGExporter.js?v=1.12.66';
import { ExportController } from './src/svg/ExportController.js?v=1.12.42';
import { ExportDocumentBuilder } from './src/svg/ExportDocumentBuilder.js?v=1.12.36';

import { PresetManager } from './src/preset/PresetManager.js?v=1.12.49';
import { PresetApplicationController } from './src/preset/PresetApplicationController.js?v=1.12.42';

import { HistoryManager } from './src/history/HistoryManager.js?v=1.12.56';

// Surface model
import { SurfaceManager, SURFACE_IDS, SIDE_SURFACE_IDS } from './src/surfaces/SurfaceManager.js?v=1.12.62';
import { SurfacePanelController } from './src/surfaces/SurfacePanelController.js?v=1.12.62';
import { SurfaceCoordinateMapper } from './src/surfaces/SurfaceCoordinateMapper.js?v=1.12.11';
import { SurfaceRenderer } from './src/surfaces/SurfaceRenderer.js?v=1.12.62';

export class GridGenerator {
    constructor() {
        this.isInitializing = true;
        this.sliderConfig = createSliderConfig(this);
        this.settingsModule = new Settings();
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
        this.gridCalculator = new GridCalculator(this.settingsModule);
        this.gridSettingsController = new GridSettingsController(this);
        Object.assign(this.sliderConfig, this.gridSettingsController.getSliderConfigs());

        // ============================================
        this.gridRenderer = new GridRenderer(this.settingsModule, this.gridCalculator);

        // ============================================
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
        this.renderScheduler = new RenderScheduler({
            render: () => this.canvasRenderer.render(),
            canRender: () => !this.isInitializing
        });

        // ============================================
        this.domCache = new DOMCache().init();
        this.dom = this.domCache.getAll();
        this.panelUiController = new PanelUiController(this);
        this.applicationUi = new ApplicationUiSynchronizer(this);
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
        this.textToPath = new TextToPath();
        this.svgExporter = new SVGExporter(this.settingsModule, this.textToPath);
        this.exportDocumentBuilder = new ExportDocumentBuilder(this);
        this.exportController = new ExportController(this);
        this.presetApplicationController = new PresetApplicationController(this);
        this.applicationEventController = new ApplicationEventController(this);

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
        this.applicationUi.updateViewportSize();
        this.applicationUi.initializeEyeIcons();

        // Update canvas size on window resize
        window.addEventListener('resize', () => {
            this.applicationUi.updateViewportSize();
            this.updateGrid();
        });
    }

    finalizeInitialization() {
        this.constrainAllObjectsToGrid();
        this.objectNavigatorController.render();
        this.applicationUi.updateViewportSize();
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

    async handlePresetLoad(data, presetName) {
        return this.presetApplicationController.load(data, presetName);
    }

    syncApplicationUI() {
        this.applicationUi.sync();
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
        this.applicationUi.updateEyeIcon(checkbox);
    }


    /**
     * Немедленное обновление сетки (для критичных операций)
     * Используйте updateGridDebounced() для слайдеров
     */
    updateGrid() {
        this.renderScheduler.immediate();
    }

    /**
     * Debounced обновление сетки - для слайдеров и частых изменений
     * Откладывает рендеринг до прекращения ввода
     */
    updateGridDebounced() {
        this.renderScheduler.deferred();
    }

    /**
     * Throttled обновление сетки - для drag операций
     * Ограничивает частоту обновлений до ~60fps
     */
    updateGridThrottled() {
        this.renderScheduler.duringGesture();
    }

    async importSettings(file) {
        try {
            await this.presetApplicationController.importFile(file);
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

    initUIControllers() {
        this.sliderController = new SliderController(this.settingsModule);

        Object.keys(this.sliderConfig).forEach(sliderId => {
            const config = this.sliderConfig[sliderId];
            this.sliderController.initSlider(sliderId, config);
        });

        this.sliderHistoryController = new SliderHistoryController({
            sliderController: this.sliderController,
            beginAction: label => this.historyManager.beginAction(label, this.getStateSnapshot()),
            commitAction: () => this.historyManager.commitAction(this.getStateSnapshot())
        });
        this.sliderHistoryController.bind();

        this.panelManager = new PanelManager();

        this.zoomPanManager = new ZoomPanManager(
            this.dom.canvasContainer,
            this.dom.svg
        );

        this.zoomToolbarController = new ZoomToolbarController({
            dom: this.dom,
            zoomPanManager: this.zoomPanManager
        });
        this.zoomToolbarController.bind();

    }

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
