/**
 * PresetManager - Управление пресетами приложения
 * 
 * Отвечает за:
 * - Загрузку манифеста пресетов
 * - Dropdown меню выбора пресетов
 * - Загрузку и применение пресетов
 * - Управление импортированными пресетами
 */

export class PresetManager {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.dropdownToggle - Кнопка открытия dropdown
     * @param {HTMLElement} options.dropdownMenu - Меню dropdown
     * @param {HTMLElement} options.dropdown - Контейнер dropdown
     * @param {Function} options.onPresetLoad - Callback при загрузке пресета
     * @param {Function} options.onPresetSelect - Callback при выборе пресета
     */
    constructor(options = {}) {
        this.dropdownToggle = options.dropdownToggle;
        this.dropdownMenu = options.dropdownMenu;
        this.dropdown = options.dropdown;
        this.onPresetLoad = options.onPresetLoad || (() => {});
        this.onPresetSelect = options.onPresetSelect || (() => {});
        
        // State
        this.availablePresets = [];
        this.importedPresets = [];
        this.currentPreset = null;
        this.currentPresetName = 'Custom';
        this.presetWidths = {};
        this.maxPresetWidth = 0;
        this.hasChanges = false;
        
        // DOM reference
        this.dropdownText = null;
    }

    /**
     * Инициализация менеджера пресетов
     */
    async init() {
        return this.loadPresetsManifest();
    }

    /**
     * Загрузить манифест пресетов
     */
    async loadPresetsManifest() {
        const manifestUrl = `presets/manifest.json?ts=${Date.now()}`;
        
        try {
            const response = await fetch(manifestUrl, {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                console.warn('No presets manifest found');
                this.updateDropdownText('No presets available');
                return false;
            }
            
            const manifest = await response.json();
            const presetsFromManifest = Array.isArray(manifest.presets) ? manifest.presets : [];
            
            if (presetsFromManifest.length === 0) {
                console.warn('No presets available in manifest');
                this.updateDropdownText('No presets available');
                return false;
            }
            
            // Use presets in the order they appear in manifest.json
            this.availablePresets = presetsFromManifest;
            await this.initializeDropdown();
            return true;
        } catch (error) {
            console.warn('Failed to load presets manifest:', error);
            this.updateDropdownText('Error loading presets');
            return false;
        }
    }

    /**
     * Инициализация dropdown меню
     */
    async initializeDropdown() {
        if (!this.dropdownToggle || !this.dropdownMenu || this.availablePresets.length === 0) {
            return false;
        }
        
        // Get text element
        this.dropdownText = this.dropdownToggle.querySelector('.preset-dropdown-text');
        
        // Clear menu
        this.dropdownMenu.innerHTML = '';
        
        // Populate dropdown menu with presets
        this.availablePresets.forEach((preset) => {
            const item = document.createElement('li');
            item.className = 'preset-dropdown-item';
            item.textContent = preset.name;
            
            // Check if this is a divider (no file or file is null/empty)
            const isDivider = !preset.file || preset.file === null || preset.file === '';
            
            if (isDivider) {
                // Make divider non-clickable
                item.classList.add('preset-dropdown-divider');
                item.style.pointerEvents = 'none';
                item.style.cursor = 'default';
                item.style.opacity = '0.5';
            } else {
                item.dataset.file = preset.file;
                item.setAttribute('role', 'option');
                
                item.addEventListener('click', () => {
                    this.selectPreset(preset.file, preset.name);
                    this.closeDropdown();
                });
            }
            
            this.dropdownMenu.appendChild(item);
        });
        
        // Add imported presets to dropdown (if any exist)
        this.importedPresets.forEach(preset => {
            this.addImportedPresetToDropdown(preset);
        });
        
        // Calculate widths after items are added to DOM
        this.calculatePresetWidths();
        
        // Setup toggle button click
        this.dropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.dropdown && !this.dropdown.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        // Close dropdown on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDropdown();
            }
        });
        
        // Load first preset by default (skip dividers)
        const firstPreset = this.availablePresets.find(preset => preset.file && preset.file !== null && preset.file !== '');
        if (firstPreset) {
            return this.selectPreset(firstPreset.file, firstPreset.name);
        }
        return true;
    }

    /**
     * Рассчитать ширину для каждого названия пресета
     */
    calculatePresetWidths() {
        // Calculate width for each preset name
        this.availablePresets.forEach(preset => {
            // Skip dividers (presets without file)
            if (!preset.file || preset.file === null || preset.file === '') {
                return;
            }
            const width = this.measureTextWidth(preset.name);
            this.presetWidths[preset.file] = width;
        });
        
        // Calculate width for imported presets
        this.importedPresets.forEach(preset => {
            if (!preset.id || preset.displayName == null) return;
            const width = this.measureTextWidth(preset.displayName);
            this.presetWidths[preset.id] = width;
        });
        
        // Find max width
        const widthValues = Object.values(this.presetWidths);
        this.maxPresetWidth = widthValues.length > 0 ? Math.max(...widthValues) : 200;
    }

    /**
     * Измерить ширину текста
     * @param {string} text
     * @returns {number}
     */
    measureTextWidth(text) {
        // Create temporary element to measure text width
        const temp = document.createElement('button');
        temp.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: nowrap;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            font-size: 0.9rem;
            font-weight: 600;
            padding: 8px 20px;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            border: none;
        `;
        
        // Add text span
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        temp.appendChild(textSpan);
        
        // Add arrow (same size as real arrow)
        const arrow = document.createElement('span');
        arrow.style.cssText = `
            width: 12px;
            height: 8px;
            flex-shrink: 0;
        `;
        temp.appendChild(arrow);
        
        document.body.appendChild(temp);
        const width = temp.offsetWidth;
        document.body.removeChild(temp);
        return width;
    }

    /**
     * Добавить импортированный пресет в dropdown
     * @param {Object} preset
     */
    addImportedPresetToDropdown(preset) {
        if (!this.dropdownMenu) return;
        
        // Check if preset already exists in dropdown
        const existingItem = this.dropdownMenu.querySelector(`[data-file="${preset.id}"]`);
        if (existingItem) {
            // Update existing item text in case display name changed
            existingItem.textContent = preset.displayName;
            return;
        }
        
        const item = document.createElement('li');
        item.className = 'preset-dropdown-item';
        item.textContent = preset.displayName;
        item.dataset.file = preset.id;
        item.setAttribute('role', 'option');
        
        item.addEventListener('click', () => {
            this.selectPreset(preset.id, preset.displayName);
            this.closeDropdown();
        });
        
        // Insert imported presets at the beginning (after separator if exists)
        const separator = this.dropdownMenu.querySelector('.preset-dropdown-separator');
        if (separator) {
            this.dropdownMenu.insertBefore(item, separator.nextSibling);
        } else {
            // Add separator before imported presets if it doesn't exist
            const sep = document.createElement('li');
            sep.className = 'preset-dropdown-separator';
            sep.style.cssText = 'height: 1px; background: rgba(255,255,255,0.1); margin: 8px 0;';
            this.dropdownMenu.insertBefore(sep, this.dropdownMenu.firstChild);
            this.dropdownMenu.insertBefore(item, sep.nextSibling);
        }
        
        // Recalculate widths
        this.calculatePresetWidths();
    }

    /**
     * Переключить состояние dropdown
     */
    toggleDropdown() {
        const isOpen = this.dropdownToggle.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    /**
     * Открыть dropdown
     */
    openDropdown() {
        this.dropdownToggle.setAttribute('aria-expanded', 'true');
        this.dropdownMenu.classList.add('active');
        
        // Animate width expansion to max width
        if (this.maxPresetWidth) {
            this.dropdownToggle.style.width = `${this.maxPresetWidth}px`;
        }
    }

    /**
     * Закрыть dropdown
     */
    closeDropdown() {
        if (!this.dropdownToggle || !this.dropdownMenu) return;
        
        this.dropdownToggle.setAttribute('aria-expanded', 'false');
        this.dropdownMenu.classList.remove('active');
        
        // Animate width back to current preset width
        if (this.currentPreset && this.presetWidths[this.currentPreset]) {
            this.dropdownToggle.style.width = `${this.presetWidths[this.currentPreset]}px`;
        }
    }

    /**
     * Обновить текст в dropdown toggle
     * @param {string} text
     */
    updateDropdownText(text) {
        if (this.dropdownText) {
            this.dropdownText.textContent = text;
        }
    }

    /**
     * Выбрать пресет
     * @param {string} file - Имя файла или ID импортированного пресета
     * @param {string} name - Отображаемое имя
     */
    async selectPreset(file, name) {
        const previous = {
            file: this.currentPreset,
            name: this.currentPresetName,
            hasChanges: this.hasChanges
        };
        this.applySelection(file, name);

        try {
            if (file.startsWith('imported-')) {
                await this.loadImportedPreset(file);
            } else {
                await this.loadPreset(file);
            }
            this.onPresetSelect(file, name);
            return true;
        } catch (error) {
            this.applySelection(previous.file, previous.name);
            this.hasChanges = previous.hasChanges;
            console.error('Failed to load preset:', error);
            alert(`Failed to load preset: ${error.message}`);
            return false;
        }
    }

    applySelection(file, name) {
        const items = this.dropdownMenu?.querySelectorAll('.preset-dropdown-item') || [];
        items.forEach(item => {
            if (item.dataset.file === file) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // Update button text
        this.updateDropdownText(name);
        
        // Store current preset
        this.currentPreset = file;
        this.currentPresetName = name;
        this.hasChanges = false;
        
        // Set button width to match current preset (when closed)
        if (this.dropdownToggle && this.presetWidths[file]) {
            const isOpen = this.dropdownToggle.getAttribute('aria-expanded') === 'true';
            if (!isOpen) {
                this.dropdownToggle.style.width = `${this.presetWidths[file]}px`;
            }
        }
        
    }

    /**
     * Загрузить пресет из файла
     * @param {string} filename
     */
    async loadPreset(filename) {
        console.log(`Loading preset: ${filename}`);
        const encodedFilename = encodeURIComponent(filename);
        const response = await fetch(`presets/${encodedFilename}`);
        if (!response.ok) {
            throw new Error(`Failed to load preset: ${response.statusText}`);
        }
        const data = await response.json();
        await this.onPresetLoad(data, this.currentPresetName);
    }

    /**
     * Загрузить импортированный пресет из памяти
     * @param {string} presetId
     */
    async loadImportedPreset(presetId) {
        const importedPreset = this.importedPresets.find(p => p.id === presetId);
        if (!importedPreset) {
            throw new Error(`Imported preset not found: ${presetId}`);
        }
        
        console.log(`Loading imported preset: ${presetId}`);
        
        // Notify about loaded data
        await this.onPresetLoad(importedPreset.data, importedPreset.displayName);
    }

    /**
     * Добавить импортированный пресет
     * @param {Object} data - Нормализованные данные пресета
     * @param {string} displayName - Отображаемое имя
     */
    async addImportedPreset(data, displayName) {
        const presetId = `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        
        const importedPreset = {
            id: presetId,
            displayName: displayName,
            data: JSON.parse(JSON.stringify(data))
        };
        
        this.importedPresets.push(importedPreset);
        this.addImportedPresetToDropdown(importedPreset);
        
        // Select the imported preset
        await this.selectPreset(presetId, displayName);
        
        return presetId;
    }

    /**
     * Отметить что были изменения
     */
    markAsChanged() {
        if (!this.hasChanges) {
            this.hasChanges = true;
            // Можно добавить визуальную индикацию изменений
        }
    }

    markAsSaved() {
        this.hasChanges = false;
    }

    /**
     * Получить текущее имя пресета
     * @returns {string}
     */
    getCurrentPresetName() {
        return this.currentPresetName;
    }

    /**
     * Проверить есть ли изменения
     * @returns {boolean}
     */
    hasUnsavedChanges() {
        return this.hasChanges;
    }
}
