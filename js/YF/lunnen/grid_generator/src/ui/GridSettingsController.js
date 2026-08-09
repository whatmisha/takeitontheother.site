import { getSlidersByGroup } from '../config/SliderConfig.js';

const GRID_SLIDER_IDS = new Set([
    'frontWidthSlider',
    'frontHeightSlider',
    'thicknessSlider',
    'gridModuleSlider',
    'marginsSlider',
    'columnCountSlider',
    'rowCountSlider',
    'rowHeightSlider'
]);

/** Owns Dimensions/Grid interaction, linkage, units, locks and UI sync. */
export class GridSettingsController {
    constructor(host) {
        this.host = host;
        this.bound = false;
    }

    getSliderConfigs() {
        const definitions = {
            ...getSlidersByGroup('dimensions'),
            ...getSlidersByGroup('grid')
        };
        return {
            ...definitions,
            frontWidthSlider: {
                ...definitions.frontWidthSlider,
                onUpdate: () => this.handleWidthChange()
            },
            frontHeightSlider: {
                ...definitions.frontHeightSlider,
                onUpdate: () => this.handleVerticalGeometryChange(true)
            },
            thicknessSlider: {
                ...definitions.thicknessSlider,
                onUpdate: () => this.handleThicknessChange()
            },
            gridModuleSlider: {
                ...definitions.gridModuleSlider,
                onUpdate: () => this.handleModuleChange()
            },
            marginsSlider: {
                ...definitions.marginsSlider,
                onUpdate: value => this.handleMarginsChange(value)
            },
            columnCountSlider: {
                ...definitions.columnCountSlider,
                onUpdate: () => this.handleColumnCountChange()
            },
            rowCountSlider: {
                ...definitions.rowCountSlider,
                onUpdate: () => this.handleRowCountChange()
            },
            rowHeightSlider: {
                ...definitions.rowHeightSlider,
                onUpdate: () => this.handleRowHeightChange()
            }
        };
    }

    isGridSlider(sliderId) {
        return GRID_SLIDER_IDS.has(sliderId);
    }

    bind() {
        if (this.bound) return;
        this.bound = true;
        const { dom } = this.host;
        const linkModeHandler = event => this.setLinkMode(event.target.value);
        dom.linkModeOff?.addEventListener('change', linkModeHandler);
        dom.linkModeRowsHeight?.addEventListener('change', linkModeHandler);
        dom.linkModeModule?.addEventListener('change', linkModeHandler);
        dom.marginsUnitMod?.addEventListener('click', event => {
            event.preventDefault();
            if (this.host.settingsModule.get('marginsUnit') !== 'mod') this.switchMarginsUnit('mod');
        });
        dom.marginsUnitMm?.addEventListener('click', event => {
            event.preventDefault();
            if (this.host.settingsModule.get('marginsUnit') !== 'mm') this.switchMarginsUnit('mm');
        });
        dom.lockModuleBtn?.addEventListener('click', event => {
            event.preventDefault();
            this.toggleLockModule();
        });
        dom.lockMarginsBtn?.addEventListener('click', event => {
            event.preventDefault();
            this.toggleLockMargins();
        });
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

    handleThicknessChange() {
        this.host.markAsChanged();
        this.host.constrainAllObjectsToGrid();
        this.host.updateGridDebounced();
    }

    handleVerticalGeometryChange(generatePresets = false) {
        this.host.markAsChanged();
        this.recalculateLinkedValues();
        this.host.constrainAllObjectsToGrid();
        if (generatePresets) this.generateRowPresets();
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
        this.syncMarginsSlider();
        this.host.constrainAllObjectsToGrid();
        this.generateRowPresets();

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
        if (settings.get('lockedMargins')) {
            this.syncMarginsSlider();
            return;
        }
        if (settings.get('lockedModule')) {
            this.recalculateWithLockedModule();
            return;
        }

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
        this.generateRowPresets();
        this.host.updateGridDebounced();
    }

    handleColumnCountChange() {
        this.host.markAsChanged();
        this.host.constrainAllObjectsToGrid();
        this.host.updateGridDebounced();
    }

    handleRowCountChange() {
        this.host.markAsChanged();
        this.recalculateLinkedValues('rowCount');
        this.host.constrainAllObjectsToGrid();
        this.updatePresetButtons();
        this.host.updateGridDebounced();
    }

    handleRowHeightChange() {
        this.host.markAsChanged();
        this.recalculateLinkedValues('rowHeight');
        this.host.constrainAllObjectsToGrid();
        this.updatePresetButtons();
        this.host.updateGridDebounced();
    }

    recalculateLinkedValues(changed = 'geometry') {
        const settings = this.host.settingsModule;
        if (settings.get('lockedModule')) {
            this.recalculateWithLockedModule();
            return;
        }
        if (settings.get('lockedMargins')) {
            this.recalculateWithLockedMargins();
            return;
        }

        const mode = settings.get('linkMode');
        if (mode === 'module') {
            const module = this.host.gridCalculator.calculateModule();
            settings.set('gridModule', module);
            this.host.sliderController.setValue('gridModuleSlider', module, false);
            this.syncMarginsSlider();
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
        this.updateLinkedControlsVisual();
        if (settings.get('lockedModule')) {
            this.recalculateWithLockedModule();
        } else if (settings.get('lockedMargins')) {
            this.recalculateWithLockedMargins();
        } else if (mode === 'module') {
            const module = this.host.gridCalculator.calculateModule();
            settings.set('gridModule', module);
            this.host.sliderController.setValue('gridModuleSlider', module, false);
            this.syncMarginsSlider();
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
        this.syncMarginsUnitButtons(unit);
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
        this.syncLocks();
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
            if (settings.get('marginsUnit') !== 'mm') {
                this.switchMarginsUnit('mm', { recordHistory: false });
            }
            settings.set('lockedMarginsValue', settings.get('margins') * settings.get('gridModule'));
            this.recalculateWithLockedMargins();
        } else {
            settings.set('lockedMarginsValue', null);
        }
        this.syncLocks();
        this.host.updateGrid();
        this.commit();
    }

    recalculateWithLockedModule() {
        const settings = this.host.settingsModule;
        const value = settings.get('lockedModuleValue');
        if (!settings.get('lockedModule') || value == null) return;
        settings.set('gridModule', value);
        this.host.sliderController.setValue('gridModuleSlider', value, false);
        const margins = this.host.gridCalculator.calculateMargins();
        settings.set('margins', margins);
        this.syncMarginsSlider();
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

    sync(settings = this.host.settingsModule.getAll()) {
        const sliders = {
            frontWidthSlider: settings.frontWidth,
            frontHeightSlider: settings.frontHeight,
            thicknessSlider: settings.thickness,
            gridModuleSlider: settings.gridModule,
            columnCountSlider: settings.columnCount,
            rowCountSlider: settings.rowCount,
            rowHeightSlider: settings.rowHeight
        };
        Object.entries(sliders).forEach(([id, value]) => {
            if (value !== undefined) this.host.sliderController.setValue(id, value, false);
        });
        this.host.sliderController.updateLimits(
            'marginsSlider',
            0,
            settings.marginsUnit === 'mm' ? 250 : 10
        );
        this.syncMarginsSlider(settings);

        const toggles = {
            showSidePanels: settings.showSidePanels !== false,
            showColumns: settings.showColumns !== false,
            showRows: settings.showRows !== false,
            showBaseline: settings.showBaseline !== false,
            showObjects: settings.showObjects !== false
        };
        Object.entries(toggles).forEach(([key, checked]) => {
            if (this.host.dom[key]) this.host.dom[key].checked = checked;
        });

        const radio = {
            off: this.host.dom.linkModeOff,
            'rows-height': this.host.dom.linkModeRowsHeight,
            module: this.host.dom.linkModeModule
        }[settings.linkMode];
        if (radio) radio.checked = true;
        this.syncMarginsUnitButtons(settings.marginsUnit || 'mod');
        this.syncLocks();
        this.updateLinkedControlsVisual();
    }

    syncMarginsSlider(settings = this.host.settingsModule.getAll()) {
        const value = settings.marginsUnit === 'mm'
            ? settings.margins * settings.gridModule
            : settings.margins;
        this.host.sliderController.setValue('marginsSlider', this.round(value), false);
    }

    syncMarginsUnitButtons(unit) {
        this.host.dom.marginsUnitMod?.classList.toggle('active', unit === 'mod');
        this.host.dom.marginsUnitMm?.classList.toggle('active', unit === 'mm');
    }

    syncLocks() {
        const settings = this.host.settingsModule;
        this.syncLockButton(
            this.host.dom.lockModuleBtn,
            settings.get('lockedModule'),
            'locked-module'
        );
        this.syncLockButton(
            this.host.dom.lockMarginsBtn,
            settings.get('lockedMargins'),
            'locked-margins'
        );
    }

    syncLockButton(button, locked, groupClass) {
        if (!button) return;
        button.classList.toggle('locked', Boolean(locked));
        button.closest('.control-group')?.classList.toggle(groupClass, Boolean(locked));
    }

    updateLinkedControlsVisual() {
        this.host.dom.linkedControlsContainer?.classList.toggle(
            'linked-controls-group',
            this.host.settingsModule.get('linkMode') !== 'off'
        );
    }

    generateRowPresets() {
        const container = document.getElementById('rowPresetsContainer');
        if (!container) return;
        container.innerHTML = '';

        this.host.gridCalculator.findPerfectRowCombinations().forEach(combo => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'row-preset-btn';
            button.textContent = `${combo.rowCount}:${combo.rowHeight}`;
            button.setAttribute(
                'aria-label',
                `Set ${combo.rowCount} rows with height ${combo.rowHeight}`
            );
            button.addEventListener('click', () => this.applyRowPreset(combo));
            container.appendChild(button);
        });
        this.updatePresetButtons();
    }

    applyRowPreset(combo) {
        this.begin(`apply row preset ${combo.rowCount}:${combo.rowHeight}`);
        const settings = this.host.settingsModule;
        settings.set('rowCount', combo.rowCount);
        settings.set('rowHeight', combo.rowHeight);
        if (settings.get('linkMode') === 'off') {
            settings.set('linkMode', 'rows-height');
            if (this.host.dom.linkModeRowsHeight) this.host.dom.linkModeRowsHeight.checked = true;
            this.updateLinkedControlsVisual();
        }

        if (settings.get('lockedModule')) {
            this.recalculateWithLockedModule();
        } else if (settings.get('lockedMargins')) {
            this.recalculateWithLockedMargins();
        } else if (settings.get('linkMode') === 'module') {
            const module = this.host.gridCalculator.calculateModule();
            settings.set('gridModule', module);
            this.host.sliderController.setValue('gridModuleSlider', module, false);
            this.syncMarginsSlider();
        }

        this.host.sliderController.setValue('rowCountSlider', combo.rowCount, false);
        this.host.sliderController.setValue('rowHeightSlider', combo.rowHeight, false);
        this.host.constrainAllObjectsToGrid();
        this.host.updateGrid();
        this.updatePresetButtons();
        this.commit();
    }

    updatePresetButtons() {
        const container = document.getElementById('rowPresetsContainer');
        if (!container) return;
        const rowCount = this.host.settingsModule.get('rowCount');
        const rowHeight = this.host.settingsModule.get('rowHeight');
        container.querySelectorAll('.row-preset-btn').forEach(button => {
            const [candidateRows, candidateHeight] = button.textContent
                .split(':')
                .map(Number);
            button.classList.toggle(
                'active',
                candidateRows === rowCount && candidateHeight === rowHeight
            );
        });
    }

    round(value) {
        return Number.parseFloat(Number(value).toFixed(4));
    }
}
