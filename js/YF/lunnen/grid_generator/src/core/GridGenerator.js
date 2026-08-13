import { TextToPath } from '../utils/TextToPath.js';

import { Settings } from './Settings.js';
import { DOMCache } from './DOMCache.js';
import { ApplicationStartupController } from './ApplicationStartupController.js';
import { ApplicationUiSynchronizer } from './ApplicationUiSynchronizer.js';
import { ApplicationLifecycle } from './ApplicationLifecycle.js';
import {
    createApplicationEventPort,
    createExportDocumentPort,
    createExportPort,
    createGridSettingsPort,
    createObjectEditorPort,
    createPresetApplicationPort
} from './ApplicationPorts.js';
import { ListenerScope } from './ListenerScope.js';
import { RenderScheduler } from './RenderScheduler.js';

import { GridCalculator } from '../grid/GridCalculator.js';
import { GridRenderer } from '../grid/GridRenderer.js';
import { CanvasRendererController } from '../grid/CanvasRendererController.js';

import { createSliderConfig } from '../config/SliderConfigFactory.js';

import { SliderController } from '../ui/SliderController.js';
import { PanelManager } from '../ui/PanelManager.js';
import { ZoomPanManager } from '../ui/ZoomPanManager.js';
import { TypographyUnitController } from '../ui/TypographyUnitController.js';
import { GridSettingsController } from '../ui/GridSettingsController.js';
import { ColorPanelController } from '../ui/ColorPanelController.js';
import { SliderHistoryController } from '../ui/SliderHistoryController.js';
import { ApplicationEventController } from '../ui/ApplicationEventController.js';
import { PanelUiController } from '../ui/PanelUiController.js';
import { ZoomToolbarController } from '../ui/ZoomToolbarController.js';
import { ErrorPresenter } from '../ui/ErrorPresenter.js';

import { GraphicsRenderer } from '../elements/GraphicsRenderer.js';
import { TextBlockRenderer } from '../elements/TextBlockRenderer.js';
import { TextLayout } from '../elements/TextLayout.js';
import { TextStyleResolver } from '../elements/TextStyleResolver.js';
import { ObjectEditorPanelController } from '../elements/ObjectEditorPanelController.js';
import { ObjectEditorInputController } from '../elements/ObjectEditorInputController.js';
import { TextEditorPositionController } from '../elements/TextEditorPositionController.js';
import { LunnenDisplayEditorController } from '../elements/LunnenDisplayEditorController.js';
import { GraphicsEditorInputController } from '../elements/GraphicsEditorInputController.js';
import { GraphicsEditorEventController } from '../elements/GraphicsEditorEventController.js';
import { ObjectNavigatorController } from '../elements/ObjectNavigatorController.js';
import { ObjectDragController } from '../elements/ObjectDragController.js';
import { ObjectDocumentController } from '../elements/ObjectDocumentController.js';
import { ObjectPlacementController } from '../elements/ObjectPlacementController.js';
import { GraphicsAssetController } from '../elements/GraphicsAssetController.js';
import { BuiltInGraphicsController } from '../elements/BuiltInGraphicsController.js';

import { SVGExporter } from '../svg/SVGExporter.js';
import { ExportController } from '../svg/ExportController.js';
import { ExportDocumentBuilder } from '../svg/ExportDocumentBuilder.js';
import { SvgSanitizer } from '../svg/SvgSanitizer.js';

import { PresetManager } from '../preset/PresetManager.js';
import { PresetApplicationController } from '../preset/PresetApplicationController.js';

import { HistoryManager } from '../history/HistoryManager.js';
import { DraftStore } from '../persistence/DraftStore.js';
import { DraftRecoveryController } from '../persistence/DraftRecoveryController.js';

// Surface model
import { SurfaceManager, SURFACE_IDS, SIDE_SURFACE_IDS } from '../surfaces/SurfaceManager.js';
import { SurfacePanelController } from '../surfaces/SurfacePanelController.js';
import { SurfaceCoordinateMapper } from '../surfaces/SurfaceCoordinateMapper.js';
import { SurfaceRenderer } from '../surfaces/SurfaceRenderer.js';

export class GridGenerator {
    constructor() {
        this.isInitializing = true;
        this.disposed = false;
        this.lifecycle = new ApplicationLifecycle();
        this.globalListeners = this.lifecycle.own(new ListenerScope());
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
            getLayerEntries: () => this.objectDocument.getLayerEntries(),
            drawTextBlock: (...args) => this.textRenderer.draw(...args),
            drawGraphicsBlock: (...args) => this.graphicsRenderer?.draw(...args),
            drawGraphicsBlockForExport: (...args) => this.graphicsRenderer?.drawForExport(...args)
        });

        // ============================================
        this.gridCalculator = new GridCalculator(this.settingsModule);
        this.gridSettingsController = this.lifecycle.own(
            new GridSettingsController(createGridSettingsPort(this))
        );
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
        this.renderScheduler = this.lifecycle.own(new RenderScheduler({
            render: () => this.canvasRenderer.render(),
            canRender: () => !this.isInitializing
        }));

        // ============================================
        this.domCache = new DOMCache().init();
        this.dom = this.domCache.getAll();
        this.errorPresenter = this.lifecycle.own(new ErrorPresenter());
        this.panelUiController = this.lifecycle.own(new PanelUiController(this));
        this.applicationUi = new ApplicationUiSynchronizer(this);
        this.colorPanelController = this.lifecycle.own(new ColorPanelController({
            settings: this.settingsModule,
            dom: this.dom,
            beginAction: label => this.historyManager.beginAction(label, this.getStateSnapshot()),
            commitAction: () => this.historyManager.commitAction(this.getStateSnapshot()),
            markChanged: () => this.markAsChanged(),
            render: () => this.updateGrid()
        }));
        const objectEditorPort = createObjectEditorPort(this);
        this.objectEditorPanelController = this.lifecycle.own(
            new ObjectEditorPanelController(objectEditorPort)
        );
        this.objectEditorInputController = this.lifecycle.own(
            new ObjectEditorInputController(objectEditorPort)
        );
        this.textEditorPositionController = this.lifecycle.own(
            new TextEditorPositionController(objectEditorPort)
        );
        this.lunnenDisplayEditorController = this.lifecycle.own(
            new LunnenDisplayEditorController(objectEditorPort)
        );
        this.graphicsEditorInputController = new GraphicsEditorInputController(objectEditorPort);
        this.graphicsEditorEventController = this.lifecycle.own(
            new GraphicsEditorEventController(objectEditorPort)
        );
        this.svgSanitizer = new SvgSanitizer();
        this.graphicsAssetController = new GraphicsAssetController(this, {
            sanitizer: this.svgSanitizer
        });
        this.objectNavigatorController = this.lifecycle.own(new ObjectNavigatorController(this));
        this.builtInGraphicsController = new BuiltInGraphicsController({
            assetController: this.graphicsAssetController,
            objectDocument: this.objectDocument,
            onReady: () => {
                this.objectPlacementController.updateBuiltInPositions();
                this.initGraphicsRenderer();
            }
        });
        this.objectDragController = this.lifecycle.own(new ObjectDragController(this));
        this.objectDragController.init();
        this.initTextLayout();
        this.initTextRenderer();

        // ============================================
        this.initUIControllers();
        this.typographyUnitController = this.lifecycle.own(new TypographyUnitController({
            settings: this.settingsModule,
            dom: this.dom,
            sliderController: this.sliderController,
            styleResolver: this.textStyleResolver,
            beginAction: label => (
                this.historyManager.beginAction(label, this.getStateSnapshot())
            ),
            commitAction: () => this.historyManager.commitAction(this.getStateSnapshot()),
            markChanged: () => this.markAsChanged()
        }));

        // ============================================
        this.textToPath = new TextToPath();
        this.svgExporter = new SVGExporter(this.settingsModule, this.textToPath);
        this.exportDocumentBuilder = new ExportDocumentBuilder(createExportDocumentPort(this));
        this.exportController = new ExportController(createExportPort(this));
        this.presetApplicationController = new PresetApplicationController(
            createPresetApplicationPort(this)
        );
        this.applicationEventController = this.lifecycle.own(
            new ApplicationEventController(createApplicationEventPort(this))
        );

        // ============================================
        this.hasUnsavedChanges = false; // Флаг наличия несохраненных изменений
        this.presetManager = this.lifecycle.own(new PresetManager({
            dropdownToggle: this.dom.presetDropdownToggle,
            dropdownMenu: this.dom.presetDropdownMenu,
            dropdown: this.dom.presetDropdown,
            onPresetLoad: (data, name) => this.handlePresetLoad(data, name),
            onPresetSelect: (file, name) => {
                this.hasUnsavedChanges = false;
                if (!this.isInitializing) void this.draftRecoveryController?.clearDraft();
            },
            onError: error => this.errorPresenter.show(error, { title: 'Preset loading failed' })
        }));
        this.draftRecoveryController = this.lifecycle.own(new DraftRecoveryController({
            store: new DraftStore(),
            createDraft: () => ({
                presetKey: this.presetManager?.currentPreset || null,
                presetName: this.currentPresetName || 'Custom',
                snapshot: this.getStateSnapshot()
            }),
            restoreDraft: draft => this.presetApplicationController.restoreDraft(draft)
        }));
        this.startupController = new ApplicationStartupController({
            loadPresets: () => this.presetManager.init(),
            loadBuiltInGraphics: () => this.builtInGraphicsController.initialize(),
            finalize: () => this.finalizeInitialization(),
            recover: () => this.draftRecoveryController.checkForRecovery(),
            fit: () => this.zoomPanManager?.fitToScreen()
        });

        // Предупреждение при закрытии вкладки с несохраненными изменениями
        this.globalListeners.listen(globalThis.window, 'beforeunload', e => {
            if (this.hasUnsavedChanges) {
                void this.draftRecoveryController?.saveNow();
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
        this.globalListeners.listen(globalThis.window, 'resize', () => {
            this.applicationUi.updateViewportSize();
            this.updateGrid();
        });
    }

    finalizeInitialization() {
        if (this.disposed) return false;
        this.constrainAllObjectsToGrid();
        this.objectNavigatorController.render();
        this.applicationUi.updateViewportSize();
        this.isInitializing = false;
        this.updateGrid();
        document.documentElement.dataset.appReady = 'true';
        return true;
    }

    // Отметить, что были внесены изменения
    markAsChanged() {
        this.hasUnsavedChanges = true;
        if (this.presetManager) {
            this.presetManager.markAsChanged();
        }
        this.draftRecoveryController?.scheduleSave();
    }

    // Сбросить флаг изменений (при загрузке пресета, импорте и т.д.)
    resetChangesFlag() {
        this.hasUnsavedChanges = false;
        this.presetManager?.markAsSaved();
    }

    handleSettingsExported() {
        this.resetChangesFlag();
        void this.draftRecoveryController?.clearDraft();
        return true;
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
        this.surfacePanelController = this.lifecycle.own(new SurfacePanelController({
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
        }));
        this.surfacePanelController.init();
    }

    syncSurfaceControls() {
        this.surfacePanelController?.sync();
    }

    moveBlockToSurface(block, surface) {
        if (!block || !SURFACE_IDS.includes(surface)) return;
        const type = this.objectDocument.textBlocks.includes(block) ? 'text' : 'graphics';
        this.objectPlacementController.moveToSurface(block, surface, type);
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
            this.errorPresenter.show(error, { title: 'Import failed' });
        }
    }

    getStateSnapshot() {
        return this.presetApplicationController.createSnapshot();
    }

    getPerformanceMetrics() {
        return Object.freeze({
            render: this.renderScheduler.getMetrics(),
            export: this.exportDocumentBuilder.getPerformanceMetrics()
        });
    }

    undo() {
        if (!this.presetApplicationController.undo()) {
            console.log('[UNDO] Nothing to undo');
        } else {
            this.markAsChanged();
        }
    }

    redo() {
        if (!this.presetApplicationController.redo()) {
            console.log('[REDO] Nothing to redo');
        } else {
            this.markAsChanged();
        }
    }

    initUIControllers() {
        this.sliderController = this.lifecycle.own(new SliderController(this.settingsModule));

        Object.keys(this.sliderConfig).forEach(sliderId => {
            const config = this.sliderConfig[sliderId];
            this.sliderController.initSlider(sliderId, config);
        });

        this.sliderHistoryController = this.lifecycle.own(new SliderHistoryController({
            sliderController: this.sliderController,
            beginAction: label => this.historyManager.beginAction(label, this.getStateSnapshot()),
            commitAction: () => this.historyManager.commitAction(this.getStateSnapshot())
        }));
        this.sliderHistoryController.bind();

        this.panelManager = this.lifecycle.own(new PanelManager());

        this.zoomPanManager = this.lifecycle.own(new ZoomPanManager(
            this.dom.canvasContainer,
            this.dom.svg
        ));

        this.zoomToolbarController = this.lifecycle.own(new ZoomToolbarController({
            dom: this.dom,
            zoomPanManager: this.zoomPanManager
        }));
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
            sanitizeSvgContent: content => this.svgSanitizer.sanitizeFragment(content),
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
            getStyleSettings: (styleRef, gridModule) => (
                this.textStyleResolver.getStyleSettings(styleRef, gridModule)
            ),
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

    dispose() {
        if (this.disposed) return false;
        this.disposed = true;
        this.isInitializing = true;
        Object.values(this.deletionTimers).forEach(timer => clearTimeout(timer));
        this.deletionTimers = {};
        this.historyManager?.cancelAction?.();
        this.lifecycle.dispose();
        if (globalThis.document?.documentElement?.dataset.appReady === 'true') {
            globalThis.document.documentElement.dataset.appReady = 'disposed';
        }
        return true;
    }
}
