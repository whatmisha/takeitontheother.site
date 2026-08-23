const bind = (application, method) => application[method].bind(application);

/** Exposes only document replacement and history operations to preset code. */
export function createPresetApplicationPort(application) {
    return Object.freeze({
        svgSanitizer: application.svgSanitizer,
        svgExporter: application.svgExporter,
        get presetManager() { return application.presetManager; },
        get historyManager() { return application.historyManager; },
        set historyManager(value) { application.historyManager = value; },
        get currentPresetName() { return application.currentPresetName; },
        set currentPresetName(value) { application.currentPresetName = value; },
        presetHistories: application.presetHistories,
        settingsModule: application.settingsModule,
        surfaceManager: application.surfaceManager,
        objectDocument: application.objectDocument,
        gridSettingsController: application.gridSettingsController,
        get objectNavigatorController() { return application.objectNavigatorController; },
        get objectEditorPanelController() { return application.objectEditorPanelController; },
        objectPlacementController: application.objectPlacementController,
        resetChangesFlag: bind(application, 'resetChangesFlag'),
        markAsChanged: bind(application, 'markAsChanged'),
        syncApplicationUI: bind(application, 'syncApplicationUI'),
        updateGrid: bind(application, 'updateGrid'),
        fitLayoutView: bind(application, 'fitLayoutView'),
        mmToColumns: bind(application, 'mmToColumns')
    });
}

/** Exposes the immutable drawing services needed to compose an export SVG. */
export function createExportDocumentPort(application) {
    return Object.freeze({
        settingsModule: application.settingsModule,
        canvasRenderer: application.canvasRenderer,
        surfaceRenderer: application.surfaceRenderer,
        gridRenderer: application.gridRenderer,
        objectDocument: application.objectDocument,
        textRenderer: application.textRenderer,
        get graphicsRenderer() { return application.graphicsRenderer; },
        textStyleResolver: application.textStyleResolver
    });
}

/** Exposes file-export commands without leaking the full composition root. */
export function createExportPort(application) {
    return Object.freeze({
        settingsModule: application.settingsModule,
        get currentPresetName() { return application.currentPresetName; },
        exportDocumentBuilder: application.exportDocumentBuilder,
        dom: application.dom,
        svgExporter: application.svgExporter,
        objectDocument: application.objectDocument,
        get errorPresenter() { return application.errorPresenter; },
        onSettingsExported: () => application.handleSettingsExported()
    });
}

/** Exposes user-command services used by the top-level event router. */
export function createApplicationEventPort(application) {
    return Object.freeze({
        dom: application.dom,
        gridSettingsController: application.gridSettingsController,
        typographyUnitController: application.typographyUnitController,
        colorPanelController: application.colorPanelController,
        exportController: application.exportController,
        settingsModule: application.settingsModule,
        surfaceManager: application.surfaceManager,
        objectDocument: application.objectDocument,
        objectEditorPanelController: application.objectEditorPanelController,
        objectNavigatorController: application.objectNavigatorController,
        get historyManager() { return application.historyManager; },
        get currentEditingBlock() { return application.currentEditingBlock; },
        get currentEditingGraphicsId() { return application.currentEditingGraphicsId; },
        importSettings: bind(application, 'importSettings'),
        undo: bind(application, 'undo'),
        redo: bind(application, 'redo'),
        getStateSnapshot: bind(application, 'getStateSnapshot'),
        markAsChanged: bind(application, 'markAsChanged'),
        updateEyeIcon: bind(application, 'updateEyeIcon'),
        syncSurfaceControls: bind(application, 'syncSurfaceControls'),
        updateGrid: bind(application, 'updateGrid')
    });
}

/** Exposes only grid state, calculation and rendering commands to Grid controls. */
export function createGridSettingsPort(application) {
    return Object.freeze({
        get dom() { return application.dom; },
        settingsModule: application.settingsModule,
        gridCalculator: application.gridCalculator,
        get sliderController() { return application.sliderController; },
        get typographyUnitController() { return application.typographyUnitController; },
        get historyManager() { return application.historyManager; },
        constrainAllObjectsToGrid: bind(application, 'constrainAllObjectsToGrid'),
        getStateSnapshot: bind(application, 'getStateSnapshot'),
        markAsChanged: bind(application, 'markAsChanged'),
        updateGrid: bind(application, 'updateGrid'),
        updateGridDebounced: bind(application, 'updateGridDebounced')
    });
}

/** Exposes editable-object state and geometry without leaking the composition root. */
export function createObjectEditorPort(application) {
    return Object.freeze({
        dom: application.dom,
        objectDocument: application.objectDocument,
        objectPlacementController: application.objectPlacementController,
        surfaceCoordinates: application.surfaceCoordinates,
        get sliderController() { return application.sliderController; },
        get historyManager() { return application.historyManager; },
        get objectEditorPanelController() { return application.objectEditorPanelController; },
        get objectNavigatorController() { return application.objectNavigatorController; },
        get graphicsEditorInputController() { return application.graphicsEditorInputController; },
        get graphicsAssetController() { return application.graphicsAssetController; },
        get currentEditingBlock() { return application.currentEditingBlock; },
        set currentEditingBlock(value) { application.currentEditingBlock = value; },
        get currentEditingGraphicsId() { return application.currentEditingGraphicsId; },
        set currentEditingGraphicsId(value) { application.currentEditingGraphicsId = value; },
        get initialBlockState() { return application.initialBlockState; },
        set initialBlockState(value) { application.initialBlockState = value; },
        get uploadedSvgData() { return application.uploadedSvgData; },
        set uploadedSvgData(value) { application.uploadedSvgData = value; },
        columnsToMm: bind(application, 'columnsToMm'),
        getBlockY: bind(application, 'getBlockY'),
        getStateSnapshot: bind(application, 'getStateSnapshot'),
        getStyleDisplayName: bind(application, 'getStyleDisplayName'),
        getSurfaceGridContext: bind(application, 'getSurfaceGridContext'),
        markAsChanged: bind(application, 'markAsChanged'),
        mmToColumns: bind(application, 'mmToColumns'),
        moveBlockToSurface: bind(application, 'moveBlockToSurface'),
        rowBaselineToY: bind(application, 'rowBaselineToY'),
        updateGrid: bind(application, 'updateGrid'),
        yToRowBaseline: bind(application, 'yToRowBaseline')
    });
}
