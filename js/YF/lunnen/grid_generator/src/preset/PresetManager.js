import { PresetDropdownView } from './PresetDropdownView.js';
import { PresetRepository } from './PresetRepository.js';

/** Coordinates preset selection and application. */
export class PresetManager {
    constructor(options = {}) {
        this.onPresetLoad = options.onPresetLoad || (() => {});
        this.onPresetSelect = options.onPresetSelect || (() => {});
        this.onError = options.onError || (() => {});
        this.repository = options.repository || new PresetRepository({
            fetchImpl: options.fetchImpl,
            now: options.now,
            random: options.random
        });
        this.view = options.view || new PresetDropdownView({
            toggle: options.dropdownToggle,
            menu: options.dropdownMenu,
            dropdown: options.dropdown,
            documentRef: options.documentRef,
            onSelect: (file, name) => this.selectPreset(file, name)
        });
        this.dropdownToggle = options.dropdownToggle;
        this.dropdownMenu = options.dropdownMenu;
        this.dropdown = options.dropdown;
        this.currentPreset = null;
        this.currentPresetName = 'Custom';
        this.hasChanges = false;
    }

    get availablePresets() { return this.repository.availablePresets; }
    set availablePresets(value) { this.repository.availablePresets = value; }
    get importedPresets() { return this.repository.importedPresets; }
    set importedPresets(value) { this.repository.importedPresets = value; }
    get presetWidths() { return this.view.presetWidths; }
    set presetWidths(value) { this.view.presetWidths = value; }
    get maxPresetWidth() { return this.view.maxPresetWidth; }
    set maxPresetWidth(value) { this.view.maxPresetWidth = value; }
    get dropdownText() { return this.view.textElement; }
    set dropdownText(value) { this.view.textElement = value; }

    async init() {
        return this.loadPresetsManifest();
    }

    async loadPresetsManifest() {
        try {
            const presets = await this.repository.loadManifest();
            if (presets.length === 0) {
                console.warn('No presets available in manifest');
                this.updateDropdownText('No presets available');
                return false;
            }
            return this.initializeDropdown();
        } catch (error) {
            console.warn('Failed to load presets manifest:', error);
            this.updateDropdownText('Error loading presets');
            return false;
        }
    }

    async initializeDropdown() {
        const initialized = this.view.initialize(this.availablePresets, this.importedPresets);
        if (!initialized) return false;
        const firstPreset = this.availablePresets.find(preset => preset.file);
        return firstPreset
            ? this.selectPreset(firstPreset.file, firstPreset.name)
            : true;
    }

    calculatePresetWidths() {
        this.view.availablePresets = this.availablePresets;
        this.view.importedPresets = this.importedPresets;
        this.view.calculatePresetWidths();
    }

    measureTextWidth(text) {
        return this.view.measureTextWidth(text);
    }

    addImportedPresetToDropdown(preset) {
        this.view.addImportedPreset(preset);
    }

    toggleDropdown() {
        this.view.toggle(this.currentPreset);
    }

    openDropdown() {
        this.view.open();
    }

    closeDropdown() {
        this.view.close(this.currentPreset);
    }

    updateDropdownText(text) {
        this.view.updateText(text);
    }

    async selectPreset(file, name) {
        const previous = {
            file: this.currentPreset,
            name: this.currentPresetName,
            hasChanges: this.hasChanges
        };
        this.applySelection(file, name);

        try {
            if (file.startsWith('imported-')) await this.loadImportedPreset(file);
            else await this.loadPreset(file);
            this.onPresetSelect(file, name);
            return true;
        } catch (error) {
            this.applySelection(previous.file, previous.name);
            this.hasChanges = previous.hasChanges;
            console.error('Failed to load preset:', error);
            this.onError(error);
            return false;
        }
    }

    applySelection(file, name) {
        this.view.applySelection(file, name);
        this.currentPreset = file;
        this.currentPresetName = name;
        this.hasChanges = false;
    }

    async loadPreset(filename) {
        console.log(`Loading preset: ${filename}`);
        const data = await this.repository.loadBuiltIn(filename);
        await this.onPresetLoad(data, this.currentPresetName);
    }

    async loadImportedPreset(presetId) {
        const preset = this.repository.getImported(presetId);
        if (!preset) throw new Error(`Imported preset not found: ${presetId}`);
        console.log(`Loading imported preset: ${presetId}`);
        await this.onPresetLoad(preset.data, preset.displayName);
    }

    async addImportedPreset(data, displayName) {
        const preset = this.repository.addImported(data, displayName);
        this.addImportedPresetToDropdown(preset);
        await this.selectPreset(preset.id, displayName);
        return preset.id;
    }

    markAsChanged() {
        this.hasChanges = true;
    }

    markAsSaved() {
        this.hasChanges = false;
    }

    getCurrentPresetName() {
        return this.currentPresetName;
    }

    hasUnsavedChanges() {
        return this.hasChanges;
    }

    dispose() {
        return this.view.dispose?.() ?? false;
    }
}
