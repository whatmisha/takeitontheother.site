/** Owns preset dropdown rendering, sizing, selection and document events. */
export class PresetDropdownView {
    constructor({
        toggle,
        menu,
        dropdown,
        onSelect = () => {},
        documentRef = globalThis.document
    } = {}) {
        this.toggleElement = toggle;
        this.menu = menu;
        this.dropdown = dropdown;
        this.onSelect = onSelect;
        this.document = documentRef;
        this.textElement = toggle?.querySelector?.('.preset-dropdown-text') || null;
        this.availablePresets = [];
        this.importedPresets = [];
        this.presetWidths = {};
        this.maxPresetWidth = 0;
        this.currentPreset = null;
        this.bound = false;
        this.handlers = {
            toggle: event => {
                event.stopPropagation();
                this.toggle();
            },
            documentClick: event => {
                if (this.dropdown && !this.dropdown.contains(event.target)) this.close();
            },
            documentKeydown: event => {
                if (event.key === 'Escape') this.close();
            }
        };
    }

    initialize(availablePresets, importedPresets = []) {
        if (!this.toggleElement || !this.menu || availablePresets.length === 0) return false;
        this.availablePresets = availablePresets;
        this.importedPresets = importedPresets;
        this.textElement = this.toggleElement.querySelector?.('.preset-dropdown-text') || null;
        this.menu.innerHTML = '';

        availablePresets.forEach(preset => this.appendBuiltInPreset(preset));
        importedPresets.forEach(preset => this.addImportedPreset(preset, { recalculate: false }));
        this.calculatePresetWidths();
        this.bind();
        return true;
    }

    appendBuiltInPreset(preset) {
        const item = this.document.createElement('li');
        item.className = 'preset-dropdown-item';
        item.textContent = preset.name;
        if (!preset.file) {
            item.classList.add('preset-dropdown-divider');
            Object.assign(item.style, {
                pointerEvents: 'none',
                cursor: 'default',
                opacity: '0.5'
            });
        } else {
            this.makeSelectable(item, preset.file, preset.name);
        }
        this.menu.appendChild(item);
    }

    makeSelectable(item, file, name) {
        item.dataset.file = file;
        item.setAttribute('role', 'option');
        item.addEventListener('click', () => {
            this.onSelect(file, name);
            this.close(file);
        });
    }

    addImportedPreset(preset, { recalculate = true } = {}) {
        if (!this.menu) return;
        const existing = this.menu.querySelector(`[data-file="${preset.id}"]`);
        if (existing) {
            existing.textContent = preset.displayName;
            if (recalculate) this.calculatePresetWidths();
            return;
        }

        const item = this.document.createElement('li');
        item.className = 'preset-dropdown-item';
        item.textContent = preset.displayName;
        this.makeSelectable(item, preset.id, preset.displayName);

        let separator = this.menu.querySelector('.preset-dropdown-separator');
        if (!separator) {
            separator = this.document.createElement('li');
            separator.className = 'preset-dropdown-separator';
            separator.style.cssText = 'height: 1px; background: rgba(255,255,255,0.1); margin: 8px 0;';
            this.menu.insertBefore(separator, this.menu.firstChild);
        }
        this.menu.insertBefore(item, separator.nextSibling);
        if (!this.importedPresets.includes(preset)) this.importedPresets.push(preset);
        if (recalculate) this.calculatePresetWidths();
    }

    bind() {
        if (this.bound) return;
        this.toggleElement.addEventListener('click', this.handlers.toggle);
        this.document?.addEventListener('click', this.handlers.documentClick);
        this.document?.addEventListener('keydown', this.handlers.documentKeydown);
        this.bound = true;
    }

    calculatePresetWidths() {
        this.presetWidths = {};
        this.availablePresets.forEach(preset => {
            if (preset.file) this.presetWidths[preset.file] = this.measureTextWidth(preset.name);
        });
        this.importedPresets.forEach(preset => {
            if (preset.id && preset.displayName != null) {
                this.presetWidths[preset.id] = this.measureTextWidth(preset.displayName);
            }
        });
        const widths = Object.values(this.presetWidths);
        this.maxPresetWidth = widths.length > 0 ? Math.max(...widths) : 200;
    }

    measureTextWidth(text) {
        if (!this.document?.body) return 200;
        const temp = this.document.createElement('button');
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
        const textSpan = this.document.createElement('span');
        textSpan.textContent = text;
        temp.appendChild(textSpan);
        const arrow = this.document.createElement('span');
        arrow.style.cssText = 'width: 12px; height: 8px; flex-shrink: 0;';
        temp.appendChild(arrow);
        this.document.body.appendChild(temp);
        const width = temp.offsetWidth;
        temp.remove();
        return width;
    }

    toggle(currentPreset = this.currentPreset) {
        if (this.toggleElement.getAttribute('aria-expanded') === 'true') {
            this.close(currentPreset);
        } else {
            this.open();
        }
    }

    open() {
        if (!this.toggleElement || !this.menu) return;
        this.toggleElement.setAttribute('aria-expanded', 'true');
        this.menu.classList.add('active');
        if (this.maxPresetWidth) this.toggleElement.style.width = `${this.maxPresetWidth}px`;
    }

    close(currentPreset = this.currentPreset) {
        if (!this.toggleElement || !this.menu) return;
        this.toggleElement.setAttribute('aria-expanded', 'false');
        this.menu.classList.remove('active');
        if (currentPreset && this.presetWidths[currentPreset]) {
            this.toggleElement.style.width = `${this.presetWidths[currentPreset]}px`;
        }
    }

    updateText(text) {
        if (this.textElement) this.textElement.textContent = text;
    }

    applySelection(file, name) {
        this.currentPreset = file;
        const items = this.menu?.querySelectorAll('.preset-dropdown-item') || [];
        items.forEach(item => item.classList.toggle('selected', item.dataset.file === file));
        this.updateText(name);
        if (
            this.toggleElement &&
            this.presetWidths[file] &&
            this.toggleElement.getAttribute('aria-expanded') !== 'true'
        ) {
            this.toggleElement.style.width = `${this.presetWidths[file]}px`;
        }
    }
}
