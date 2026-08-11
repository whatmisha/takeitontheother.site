import { HistoryManager } from '../history/HistoryManager.js';
import { SvgSanitizer } from '../svg/SvgSanitizer.js';

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/**
 * Owns every path that replaces the editable document: bundled presets,
 * imported JSON and history snapshots. The controller deliberately works
 * through a small host adapter so persistence stays independent from the UI.
 */
export class PresetApplicationController {
    constructor(host, { sanitizer = host.svgSanitizer || new SvgSanitizer() } = {}) {
        this.host = host;
        this.sanitizer = sanitizer;
        this.currentHistoryKey = null;
    }

    async normalize(data) {
        return this.host.svgExporter.importSettings(
            new Blob([JSON.stringify(data)], { type: 'application/json' })
        );
    }

    async load(data, presetName) {
        const normalized = await this.normalize(data);
        const isImported = this.host.presetManager?.currentPreset?.startsWith('imported-');
        const appliedName = isImported
            ? presetName
            : (data.presetName || presetName);
        return this.applyPreset(normalized, appliedName);
    }

    async importFile(file) {
        const data = await this.host.svgExporter.importSettings(file);
        const presetName = data.currentPresetName ||
            data.presetName ||
            data.settings?.presetName ||
            'Custom';
        const normalizedName = presetName.replace(/^(?:Custom\s+—\s*)+/i, '') || 'Custom';
        const displayName = `Custom — ${normalizedName}`;
        await this.host.presetManager.addImportedPreset(clone(data), displayName);
        return { data, displayName };
    }

    applyPreset(normalizedData, presetName) {
        const previous = {
            history: this.host.historyManager,
            historyKey: this.currentHistoryKey,
            presetName: this.host.currentPresetName,
            state: this.host.currentPresetName ? this.createSnapshot() : null
        };
        this.storeCurrentHistory();

        const historyKey = this.host.presetManager?.currentPreset || presetName;
        const savedHistory = this.host.presetHistories.get(historyKey);
        try {
            if (savedHistory?.history?.length > 0) {
                this.host.historyManager = savedHistory;
                this.currentHistoryKey = historyKey;
                this.host.currentPresetName = presetName;
                const currentState = savedHistory.getCurrentState();
                if (currentState) this.applySnapshot(currentState);
                this.host.resetChangesFlag();
                return { restoredFromHistory: true };
            }

            this.host.historyManager = new HistoryManager({ maxSize: 50 });
            this.currentHistoryKey = historyKey;
            this.applyDocumentState(normalizedData, {
                presetName,
                defaultMissingUnits: true,
                closeEditors: false
            });
            this.host.resetChangesFlag();
            this.host.historyManager.saveSnapshot(this.createSnapshot(), 'initial preset');
            return { restoredFromHistory: false };
        } catch (error) {
            this.host.historyManager = previous.history;
            this.currentHistoryKey = previous.historyKey;
            this.host.currentPresetName = previous.presetName;
            if (previous.state) {
                this.applyDocumentState(previous.state, {
                    presetName: previous.presetName,
                    defaultMissingUnits: false,
                    closeEditors: false
                });
            }
            throw error;
        }
    }

    storeCurrentHistory() {
        const name = this.host.currentPresetName;
        const history = this.host.historyManager;
        if (!name || !history) return;
        history.cancelAction();
        history.saveSnapshot(this.createSnapshot(), 'before preset switch');
        this.host.presetHistories.set(this.currentHistoryKey || name, history);
    }

    createSnapshot() {
        return clone({
            settings: this.host.settingsModule.getAll(),
            document: this.host.objectDocument.createSnapshot()
        });
    }

    applySnapshot(snapshot) {
        const history = this.host.historyManager;
        history.setRestoring(true);
        try {
            this.applyDocumentState(snapshot, {
                presetName: this.host.currentPresetName,
                defaultMissingUnits: false,
                closeEditors: true
            });
        } finally {
            history.setRestoring(false);
        }
    }

    applyDocumentState(source, options = {}) {
        const state = clone(source) || {};
        const settings = state.settings || {};
        if (options.defaultMissingUnits && !hasOwn(settings, 'lineHeightUnit')) {
            settings.lineHeightUnit = 'mod';
        }
        this.normalizeLocks(settings);

        this.host.settingsModule.setMultiple(settings, true);
        this.host.currentPresetName = options.presetName || this.host.currentPresetName || 'Custom';
        this.host.surfaceManager.initialize(
            this.host.currentPresetName,
            settings.surfaceSettings
        );

        const documentState = this.getDocumentState(state);
        if (documentState) {
            this.host.objectDocument.replaceDocument({
                textBlocks: this.normalizeTextBlocks(documentState.textBlocks),
                graphicsBlocks: this.normalizeGraphicsBlocks(documentState.graphicsBlocks)
            });
        }

        this.host.syncApplicationUI();
        this.recalculateGrid();
        this.host.objectNavigatorController.render();
        this.host.updateGrid();

        if (options.closeEditors) {
            this.host.objectEditorPanelController.closeTextPanel();
            this.host.objectEditorPanelController.closeGraphicsPanel();
        }
    }

    normalizeTextBlocks(blocks = []) {
        return clone(blocks).map(block => ({
            ...block,
            lockPosition: block.lockPosition ?? true,
            textAlign: block.textAlign ?? 'left'
        }));
    }

    getDocumentState(state) {
        const nested = state.document;
        const hasTopLevelCollections = hasOwn(state, 'textBlocks') ||
            hasOwn(state, 'graphicsBlocks');
        if (!nested && !hasTopLevelCollections) return null;

        const current = this.host.objectDocument;
        const source = nested || state;
        const textBlocks = hasOwn(source, 'textBlocks')
            ? clone(source.textBlocks)
            : clone(current.textBlocks);
        const graphicsBlocks = hasOwn(source, 'graphicsBlocks')
            ? clone(source.graphicsBlocks)
            : clone(current.graphicsBlocks);
        return { textBlocks, graphicsBlocks };
    }

    normalizeGraphicsBlocks(blocks = []) {
        const normalized = clone(blocks);
        const maxColumns = this.host.settingsModule.get('columnCount');
        const gridModule = this.host.settingsModule.get('gridModule');

        normalized.forEach(block => {
            if (block.svgContent) {
                block.svgContent = this.sanitizer.sanitizeFragment(block.svgContent);
            }
            block.lockPosition ??= true;
            if (block.widthInColumns == null && block.widthInModules != null) {
                const columns = this.host.mmToColumns(block.widthInModules * gridModule);
                if (columns > 0 && columns <= maxColumns * 2) {
                    block.widthInColumns = Number.parseFloat(columns.toFixed(2));
                } else {
                    this.recalculateGraphicsWidthFromHeight(block);
                }
            } else if (
                block.widthInColumns == null ||
                block.widthInColumns <= 0 ||
                block.widthInColumns > maxColumns * 2
            ) {
                this.recalculateGraphicsWidthFromHeight(block);
            }
        });
        return normalized;
    }

    recalculateGraphicsWidthFromHeight(block) {
        if (this.host.objectPlacementController) {
            this.host.objectPlacementController.recalculateGraphicsWidthFromHeight(block);
        } else {
            this.host.recalculateGraphicsWidthFromHeight(block);
        }
    }

    normalizeLocks(settings) {
        if (settings.lockedModule && settings.lockedMargins) {
            settings.lockedMargins = false;
            settings.lockedMarginsValue = null;
        }
        if (settings.lockedModule && settings.lockedModuleValue == null) {
            settings.lockedModuleValue = settings.gridModule;
        }
        if (settings.lockedMargins && settings.lockedMarginsValue == null) {
            settings.lockedMarginsValue = settings.margins * settings.gridModule;
        }
    }

    recalculateGrid() {
        const settings = this.host.settingsModule;
        if (settings.get('lockedModule')) {
            this.host.gridSettingsController.recalculateWithLockedModule();
        } else if (settings.get('lockedMargins')) {
            this.host.gridSettingsController.recalculateWithLockedMargins();
        }
        this.host.gridSettingsController.generateRowPresets();
    }

    undo() {
        const state = this.host.historyManager.undo();
        if (state) this.applySnapshot(state);
        return Boolean(state);
    }

    redo() {
        const state = this.host.historyManager.redo();
        if (state) this.applySnapshot(state);
        return Boolean(state);
    }
}
