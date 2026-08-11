import { createGridSliderConfigs, isGridSlider } from './GridSliderConfig.js';
import { GridSettingsCommands } from './GridSettingsCommands.js';
import { GridSettingsView } from './GridSettingsView.js';

/** Public facade separating Grid commands from DOM synchronization. */
export class GridSettingsController {
    constructor(host, { view = null, commands = null } = {}) {
        this.host = host;
        this.view = view || new GridSettingsView(host, this);
        this.commands = commands || new GridSettingsCommands(host, this.view);
    }

    getSliderConfigs() { return createGridSliderConfigs(this); }
    isGridSlider(sliderId) { return isGridSlider(sliderId); }
    bind() { return this.view.bind(); }
    sync(settings) { return this.view.sync(settings); }
    syncMarginsSlider(settings) { return this.view.syncMarginsSlider(settings); }
    syncMarginsUnitButtons(unit) { return this.view.syncMarginsUnitButtons(unit); }
    syncLocks() { return this.view.syncLocks(); }
    syncLockButton(button, locked, groupClass) {
        return this.view.syncLockButton(button, locked, groupClass);
    }
    updateLinkedControlsVisual() { return this.view.updateLinkedControlsVisual(); }
    generateRowPresets() { return this.view.generateRowPresets(); }
    updatePresetButtons() { return this.view.updatePresetButtons(); }

    begin(label) { return this.commands.begin(label); }
    commit() { return this.commands.commit(); }
    handleWidthChange() { return this.commands.handleWidthChange(); }
    handleThicknessChange() { return this.commands.handleThicknessChange(); }
    handleVerticalGeometryChange(generatePresets = false) {
        return this.commands.handleVerticalGeometryChange(generatePresets);
    }
    handleModuleChange() { return this.commands.handleModuleChange(); }
    handleMarginsChange(displayValue) { return this.commands.handleMarginsChange(displayValue); }
    handleColumnCountChange() { return this.commands.handleColumnCountChange(); }
    handleRowCountChange() { return this.commands.handleRowCountChange(); }
    handleRowHeightChange() { return this.commands.handleRowHeightChange(); }
    recalculateLinkedValues(changed = 'geometry') {
        return this.commands.recalculateLinkedValues(changed);
    }
    setLinkMode(mode) { return this.commands.setLinkMode(mode); }
    switchMarginsUnit(unit, options = {}) { return this.commands.switchMarginsUnit(unit, options); }
    toggleLockModule() { return this.commands.toggleLockModule(); }
    toggleLockMargins() { return this.commands.toggleLockMargins(); }
    recalculateWithLockedModule() { return this.commands.recalculateWithLockedModule(); }
    recalculateWithLockedMargins() { return this.commands.recalculateWithLockedMargins(); }
    applyRowPreset(combo) { return this.commands.applyRowPreset(combo); }
    round(value) { return this.commands.round(value); }
    dispose() { return this.view.dispose?.() ?? false; }
}
