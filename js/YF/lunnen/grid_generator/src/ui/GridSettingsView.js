const round = value => Number.parseFloat(Number(value).toFixed(4));

/** Owns Grid/Dimensions DOM bindings, visual state and row-preset buttons. */
export class GridSettingsView {
    constructor(host, actions, { documentRef = globalThis.document } = {}) {
        this.host = host;
        this.actions = actions;
        this.document = documentRef;
        this.bound = false;
        this.handlers = {
            linkMode: event => this.actions.setLinkMode(event.target.value),
            marginsMod: event => this.handleMarginsUnit(event, 'mod'),
            marginsMm: event => this.handleMarginsUnit(event, 'mm'),
            lockModule: event => this.handleAction(event, 'toggleLockModule'),
            lockMargins: event => this.handleAction(event, 'toggleLockMargins')
        };
    }

    bind() {
        if (this.bound) return;
        const { dom } = this.host;
        dom.linkModeOff?.addEventListener('change', this.handlers.linkMode);
        dom.linkModeRowsHeight?.addEventListener('change', this.handlers.linkMode);
        dom.linkModeModule?.addEventListener('change', this.handlers.linkMode);
        dom.marginsUnitMod?.addEventListener('click', this.handlers.marginsMod);
        dom.marginsUnitMm?.addEventListener('click', this.handlers.marginsMm);
        dom.lockModuleBtn?.addEventListener('click', this.handlers.lockModule);
        dom.lockMarginsBtn?.addEventListener('click', this.handlers.lockMargins);
        this.bound = true;
    }

    handleMarginsUnit(event, unit) {
        event.preventDefault();
        if (this.host.settingsModule.get('marginsUnit') !== unit) {
            this.actions.switchMarginsUnit(unit);
        }
    }

    handleAction(event, action) {
        event.preventDefault();
        this.actions[action]();
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
        this.host.sliderController.setValue('marginsSlider', round(value), false);
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
        const container = this.document?.getElementById('rowPresetsContainer');
        if (!container) return;
        container.innerHTML = '';

        this.host.gridCalculator.findPerfectRowCombinations().forEach(combo => {
            const button = this.document.createElement('button');
            button.type = 'button';
            button.className = 'row-preset-btn';
            button.textContent = `${combo.rowCount}:${combo.rowHeight}`;
            button.setAttribute(
                'aria-label',
                `Set ${combo.rowCount} rows with height ${combo.rowHeight}`
            );
            button.addEventListener('click', () => this.actions.applyRowPreset(combo));
            container.appendChild(button);
        });
        this.updatePresetButtons();
    }

    updatePresetButtons() {
        const container = this.document?.getElementById('rowPresetsContainer');
        if (!container) return;
        const rowCount = this.host.settingsModule.get('rowCount');
        const rowHeight = this.host.settingsModule.get('rowHeight');
        container.querySelectorAll('.row-preset-btn').forEach(button => {
            const [candidateRows, candidateHeight] = button.textContent.split(':').map(Number);
            button.classList.toggle(
                'active',
                candidateRows === rowCount && candidateHeight === rowHeight
            );
        });
    }
}
