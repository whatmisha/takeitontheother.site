/** Owns all Grid/Dimensions mutations, calculations and history boundaries. */
export class GridSettingsCommands {
    constructor(host, view) {
        this.host = host;
        this.view = view;
    }

    begin(label) {
        this.host.historyManager.beginAction(label, this.host.getStateSnapshot());
        this.host.markAsChanged();
    }

    commit() {
        this.host.historyManager.commitAction(this.host.getStateSnapshot());
    }

    handleWidthChange() {
        this.host.markAsChanged();
        this.host.constrainAllObjectsToGrid();
        this.host.updateGridDebounced();
    }

    handleThicknessChange() { this.handleWidthChange(); }

    handleVerticalGeometryChange(generatePresets = false) {
        this.host.markAsChanged();
        this.recalculateLinkedValues();
        this.host.constrainAllObjectsToGrid();
        if (generatePresets) this.view.generateRowPresets();
        this.host.updateGridDebounced();
    }

    handleModuleChange() {
        this.host.markAsChanged();
        const settings = this.host.settingsModule;
        if (settings.get('lockedModule')) {
            const value = settings.get('lockedModuleValue');
            settings.set('gridModule', value);
            this.host.sliderController.setValue('gridModuleSlider', value, false);
            return;
        }
        if (settings.get('lockedMargins')) {
            const module = settings.get('gridModule');
            const marginsMm = settings.get('lockedMarginsValue');
            settings.set('margins', this.round(module > 0 ? marginsMm / module : 0));
        }
        const rowCount = this.host.gridCalculator.calculateRowCount();
        settings.set('rowCount', rowCount);
        this.host.sliderController.setValue('rowCountSlider', rowCount, false);
        this.view.syncMarginsSlider();
        this.host.constrainAllObjectsToGrid();
        this.view.generateRowPresets();
        if (settings.get('fontSizeUnit') === 'pt') {
            this.host.typographyUnitController.switchUnit('headline', 'size', 'mod');
        }
        if (settings.get('lineHeightUnit') === 'pt') {
            this.host.typographyUnitController.switchUnit('headline', 'lineHeight', 'mod');
        }
        this.host.updateGridDebounced();
    }

    handleMarginsChange(displayValue) {
        this.host.markAsChanged();
        const settings = this.host.settingsModule;
        if (settings.get('lockedMargins')) return this.view.syncMarginsSlider();
        if (settings.get('lockedModule')) return this.recalculateWithLockedModule();
        const value = Number.isFinite(displayValue)
            ? displayValue
            : this.host.sliderController.getValue('marginsSlider');
        const module = settings.get('gridModule');
        const margins = settings.get('marginsUnit') === 'mm'
            ? (module > 0 ? value / module : 0)
            : value;
        settings.set('margins', this.round(margins));
        this.recalculateLinkedValues();
        this.host.constrainAllObjectsToGrid();
        this.view.generateRowPresets();
        this.host.updateGridDebounced();
    }

    handleColumnCountChange() { this.handleWidthChange(); }

    handleRowCountChange() {
        this.host.markAsChanged();
        this.recalculateLinkedValues('rowCount');
        this.host.constrainAllObjectsToGrid();
        this.view.updatePresetButtons();
        this.host.updateGridDebounced();
    }

    handleRowHeightChange() {
        this.host.markAsChanged();
        this.recalculateLinkedValues('rowHeight');
        this.host.constrainAllObjectsToGrid();
        this.view.updatePresetButtons();
        this.host.updateGridDebounced();
    }

    recalculateLinkedValues(changed = 'geometry') {
        const settings = this.host.settingsModule;
        if (settings.get('lockedModule')) return this.recalculateWithLockedModule();
        if (settings.get('lockedMargins')) return this.recalculateWithLockedMargins();
        const mode = settings.get('linkMode');
        if (mode === 'module') {
            const module = this.host.gridCalculator.calculateModule();
            settings.set('gridModule', module);
            this.host.sliderController.setValue('gridModuleSlider', module, false);
            this.view.syncMarginsSlider();
        } else if (mode === 'rows-height') {
            const target = changed === 'rowCount' ? 'rowHeight' : 'rowCount';
            const value = target === 'rowHeight'
                ? this.host.gridCalculator.calculateRowHeight()
                : this.host.gridCalculator.calculateRowCount();
            settings.set(target, value);
            this.host.sliderController.setValue(
                target === 'rowHeight' ? 'rowHeightSlider' : 'rowCountSlider',
                value,
                false
            );
        } else if (changed === 'geometry') {
            const rowCount = this.host.gridCalculator.calculateRowCount();
            settings.set('rowCount', rowCount);
            this.host.sliderController.setValue('rowCountSlider', rowCount, false);
        }
    }

    setLinkMode(mode) {
        this.begin('change link mode');
        const settings = this.host.settingsModule;
        settings.set('linkMode', mode);
        this.view.updateLinkedControlsVisual();
        if (settings.get('lockedModule')) this.recalculateWithLockedModule();
        else if (settings.get('lockedMargins')) this.recalculateWithLockedMargins();
        else if (mode === 'module') {
            const module = this.host.gridCalculator.calculateModule();
            settings.set('gridModule', module);
            this.host.sliderController.setValue('gridModuleSlider', module, false);
            this.view.syncMarginsSlider();
        }
        this.host.updateGrid();
        this.commit();
    }

    switchMarginsUnit(unit, { recordHistory = true } = {}) {
        if (recordHistory) this.begin('switch margins unit');
        const settings = this.host.settingsModule;
        const module = settings.get('gridModule');
        const physicalMm = settings.get('margins') * module;
        settings.set('marginsUnit', unit);
        this.view.syncMarginsUnitButtons(unit);
        if (unit === 'mm') {
            this.host.sliderController.updateLimits('marginsSlider', 0, 250);
            this.host.sliderController.setValue('marginsSlider', this.round(physicalMm), false);
        } else {
            const margins = this.round(module > 0 ? physicalMm / module : 0);
            settings.set('margins', margins);
            this.host.sliderController.updateLimits('marginsSlider', 0, 10);
            this.host.sliderController.setValue('marginsSlider', margins, false);
        }
        if (recordHistory) this.commit();
    }

    toggleLockModule() {
        this.begin('toggle lock module');
        const settings = this.host.settingsModule;
        const lock = !settings.get('lockedModule');
        settings.set('lockedModule', lock);
        settings.set('lockedModuleValue', lock ? settings.get('gridModule') : null);
        if (lock) {
            settings.set('lockedMargins', false);
            settings.set('lockedMarginsValue', null);
            this.recalculateWithLockedModule();
        }
        this.view.syncLocks();
        this.host.updateGrid();
        this.commit();
    }

    toggleLockMargins() {
        this.begin('toggle lock margins');
        const settings = this.host.settingsModule;
        const lock = !settings.get('lockedMargins');
        settings.set('lockedMargins', lock);
        if (lock) {
            settings.set('lockedModule', false);
            settings.set('lockedModuleValue', null);
            if (settings.get('marginsUnit') !== 'mm') this.switchMarginsUnit('mm', { recordHistory: false });
            settings.set('lockedMarginsValue', settings.get('margins') * settings.get('gridModule'));
            this.recalculateWithLockedMargins();
        } else {
            settings.set('lockedMarginsValue', null);
        }
        this.view.syncLocks();
        this.host.updateGrid();
        this.commit();
    }

    recalculateWithLockedModule() {
        const settings = this.host.settingsModule;
        const value = settings.get('lockedModuleValue');
        if (!settings.get('lockedModule') || value == null) return;
        settings.set('gridModule', value);
        this.host.sliderController.setValue('gridModuleSlider', value, false);
        settings.set('margins', this.host.gridCalculator.calculateMargins());
        this.view.syncMarginsSlider();
    }

    recalculateWithLockedMargins() {
        const settings = this.host.settingsModule;
        const value = settings.get('lockedMarginsValue');
        if (!settings.get('lockedMargins') || value == null) return;
        const module = this.host.gridCalculator.calculateModule();
        settings.set('gridModule', module);
        settings.set('margins', this.round(module > 0 ? value / module : 0));
        this.host.sliderController.setValue('gridModuleSlider', module, false);
        this.host.sliderController.setValue('marginsSlider', this.round(value), false);
    }

    applyRowPreset(combo) {
        this.begin(`apply row preset ${combo.rowCount}:${combo.rowHeight}`);
        const settings = this.host.settingsModule;
        settings.set('rowCount', combo.rowCount);
        settings.set('rowHeight', combo.rowHeight);
        if (settings.get('linkMode') === 'off') {
            settings.set('linkMode', 'rows-height');
            if (this.host.dom.linkModeRowsHeight) this.host.dom.linkModeRowsHeight.checked = true;
            this.view.updateLinkedControlsVisual();
        }
        if (settings.get('lockedModule')) this.recalculateWithLockedModule();
        else if (settings.get('lockedMargins')) this.recalculateWithLockedMargins();
        else if (settings.get('linkMode') === 'module') {
            const module = this.host.gridCalculator.calculateModule();
            settings.set('gridModule', module);
            this.host.sliderController.setValue('gridModuleSlider', module, false);
            this.view.syncMarginsSlider();
        }
        this.host.sliderController.setValue('rowCountSlider', combo.rowCount, false);
        this.host.sliderController.setValue('rowHeightSlider', combo.rowHeight, false);
        this.host.constrainAllObjectsToGrid();
        this.host.updateGrid();
        this.view.updatePresetButtons();
        this.commit();
    }

    round(value) {
        return Number.parseFloat(Number(value).toFixed(4));
    }
}
