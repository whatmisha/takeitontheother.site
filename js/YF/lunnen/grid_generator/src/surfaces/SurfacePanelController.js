const DEFAULT_SIDE_SURFACES = Object.freeze(['left', 'right', 'top', 'bottom']);

/**
 * UI controller for the Side Surfaces panel.
 *
 * Surface geometry and persistence stay in SurfaceManager. This controller
 * owns only panel state, DOM events and value presentation.
 */
export class SurfacePanelController {
    constructor({
        dom,
        surfaceManager,
        sliderController,
        sideSurfaces = DEFAULT_SIDE_SURFACES,
        onBeginAction = () => {},
        onCommitAction = () => {},
        onMarkChanged = () => {},
        onConstrainObjects = () => {},
        onRender = () => {},
        onRenderDebounced = () => {},
        onUpdateEyeIcon = () => {}
    }) {
        this.dom = dom;
        this.surfaceManager = surfaceManager;
        this.sliderController = sliderController;
        this.sideSurfaces = sideSurfaces;
        this.activeSurface = sideSurfaces[0];
        this.onBeginAction = onBeginAction;
        this.onCommitAction = onCommitAction;
        this.onMarkChanged = onMarkChanged;
        this.onConstrainObjects = onConstrainObjects;
        this.onRender = onRender;
        this.onRenderDebounced = onRenderDebounced;
        this.onUpdateEyeIcon = onUpdateEyeIcon;
    }

    init() {
        if (!this.dom.surfaceSettingsTabs) return;

        this.dom.surfaceSettingsTabs.querySelectorAll('[data-surface]').forEach(input => {
            input.addEventListener('change', () => {
                if (!input.checked || !this.sideSurfaces.includes(input.dataset.surface)) return;
                this.activeSurface = input.dataset.surface;
                this.sync();
            });
        });

        this.dom.surfaceVisibleToggle?.addEventListener('change', event => {
            this.onBeginAction('toggle surface visibility');
            this.surfaceManager.update(this.activeSurface, { visible: event.target.checked });
            this.onMarkChanged();
            this.sync();
            this.onRender();
            this.onCommitAction();
        });

        this.dom.surfaceOwnGridToggle?.addEventListener('change', event => {
            this.onBeginAction('change surface grid mode');
            this.surfaceManager.update(this.activeSurface, {
                gridMode: event.target.checked ? 'own' : 'main'
            });
            this.onMarkChanged();
            this.sync();
            this.onConstrainObjects();
            this.onRender();
            this.onCommitAction();
        });

        this.dom.surfaceRotationSelect?.addEventListener('change', event => {
            const rotation = Number(event.target.value);
            const current = this.surfaceManager.get(this.activeSurface);
            if (current.rotation === rotation) return;

            this.onBeginAction('rotate surface');
            this.surfaceManager.update(this.activeSurface, { rotation });
            this.onMarkChanged();
            this.sync();
            this.onConstrainObjects();
            this.onRender();
            this.onCommitAction();
        });

        this.dom.surfaceMarginsUnitMod?.addEventListener('click', event => {
            event.preventDefault();
            this.switchMarginsUnit('mod');
        });
        this.dom.surfaceMarginsUnitMm?.addEventListener('click', event => {
            event.preventDefault();
            this.switchMarginsUnit('mm');
        });
        this.dom.surfaceLockModuleBtn?.addEventListener('click', event => {
            event.preventDefault();
            this.toggleGridLock('module');
        });
        this.dom.surfaceLockMarginsBtn?.addEventListener('click', event => {
            event.preventDefault();
            this.toggleGridLock('margins');
        });

        this.sync();
    }

    applyGridValue(key, displayValue) {
        const current = this.surfaceManager.get(this.activeSurface);
        if (!current || !Number.isFinite(Number(displayValue))) return;
        if ((key === 'module' && current.grid.lockedModule) ||
            (key === 'margins' && current.grid.lockedMargins)) {
            this.syncGridSliders(current);
            return;
        }

        let value = Number(displayValue);
        if (key === 'margins' && current.grid.marginsUnit === 'mm') {
            value = current.grid.module > 0 ? value / current.grid.module : 0;
        }
        if (key === 'columns' || key === 'rows' || key === 'rowHeight') {
            value = Math.max(1, Math.round(value));
        }

        const grid = { ...current.grid, [key]: value };
        this.surfaceManager.update(this.activeSurface, { gridMode: 'own', grid });
        this.onMarkChanged();
        this.onConstrainObjects();
        this.onRenderDebounced();

        if (key === 'module' && grid.marginsUnit === 'mm') {
            this.syncGridSliders(this.surfaceManager.get(this.activeSurface));
        }
    }

    switchMarginsUnit(unit) {
        const current = this.surfaceManager.get(this.activeSurface);
        const nextUnit = unit === 'mm' ? 'mm' : 'mod';
        if (!current || current.grid.marginsUnit === nextUnit) return;

        this.onBeginAction('switch surface margins unit');
        this.surfaceManager.update(this.activeSurface, {
            grid: { ...current.grid, marginsUnit: nextUnit }
        });
        this.onMarkChanged();
        this.sync();
        this.onCommitAction();
    }

    toggleGridLock(type) {
        const current = this.surfaceManager.get(this.activeSurface);
        if (!current) return;

        this.onBeginAction(`toggle surface ${type} lock`);
        const grid = { ...current.grid };
        if (type === 'module') {
            grid.lockedModule = !grid.lockedModule;
            if (grid.lockedModule) grid.lockedMargins = false;
        } else {
            grid.lockedMargins = !grid.lockedMargins;
            if (grid.lockedMargins) {
                grid.lockedModule = false;
                grid.marginsUnit = 'mm';
            }
        }
        this.surfaceManager.update(this.activeSurface, { grid });
        this.onMarkChanged();
        this.sync();
        this.onCommitAction();
    }

    syncGridSliders(settings) {
        if (!settings?.grid || !this.sliderController) return;
        const grid = settings.grid;
        const marginsUnit = grid.marginsUnit === 'mm' ? 'mm' : 'mod';
        const marginsDisplay = marginsUnit === 'mm' ? grid.margins * grid.module : grid.margins;

        this.sliderController.updateLimits('surfaceGridMarginsSlider', 0, marginsUnit === 'mm' ? 250 : 10);
        this.sliderController.setValue('surfaceGridModuleSlider', grid.module, false);
        this.sliderController.setValue('surfaceGridMarginsSlider', marginsDisplay, false);
        this.sliderController.setValue('surfaceGridColumnsSlider', grid.columns, false);
        this.sliderController.setValue('surfaceGridRowsSlider', grid.rows, false);
        this.sliderController.setValue('surfaceGridRowHeightSlider', grid.rowHeight, false);
        this.dom.surfaceMarginsUnitMod?.classList.toggle('active', marginsUnit === 'mod');
        this.dom.surfaceMarginsUnitMm?.classList.toggle('active', marginsUnit === 'mm');
        this.dom.surfaceLockModuleBtn?.classList.toggle('locked', grid.lockedModule === true);
        this.dom.surfaceLockMarginsBtn?.classList.toggle('locked', grid.lockedMargins === true);
        this.dom.surfaceLockModuleBtn?.setAttribute('aria-pressed', grid.lockedModule === true ? 'true' : 'false');
        this.dom.surfaceLockMarginsBtn?.setAttribute('aria-pressed', grid.lockedMargins === true ? 'true' : 'false');
    }

    sync() {
        if (!this.dom.surfaceSettingsTabs) return;
        if (!this.sideSurfaces.includes(this.activeSurface)) {
            this.activeSurface = this.sideSurfaces[0];
        }

        const settings = this.surfaceManager.get(this.activeSurface);
        this.dom.surfaceSettingsTabs.querySelectorAll('[data-surface]').forEach(input => {
            input.checked = input.dataset.surface === this.activeSurface;
        });
        if (this.dom.surfaceVisibleToggle) {
            this.dom.surfaceVisibleToggle.checked = settings.visible !== false;
            this.onUpdateEyeIcon(this.dom.surfaceVisibleToggle);
        }
        if (this.dom.surfaceOwnGridToggle) {
            this.dom.surfaceOwnGridToggle.checked = settings.gridMode === 'own';
        }
        if (this.dom.surfaceOwnGridControls) {
            this.dom.surfaceOwnGridControls.hidden = settings.gridMode !== 'own';
        }
        if (this.dom.surfaceRotationSelect) {
            this.dom.surfaceRotationSelect.value = String(settings.rotation);
        }

        this.syncGridSliders(settings);

        if (this.dom.showSidePanels) {
            this.dom.showSidePanels.checked = this.sideSurfaces.some(surface => this.surfaceManager.isVisible(surface));
            this.onUpdateEyeIcon(this.dom.showSidePanels);
        }

        [this.dom.paragraphSurfaceSelect, this.dom.graphicsSurfaceSelect].forEach(select => {
            if (!select) return;
            Array.from(select.options).forEach(option => {
                option.disabled = option.value !== 'front' && !this.surfaceManager.isVisible(option.value);
            });
        });
    }
}
