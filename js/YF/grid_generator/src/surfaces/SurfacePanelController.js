import { ListenerScope } from '../core/ListenerScope.js';
import { SurfacePanelCommands } from './SurfacePanelCommands.js';

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
        onRenderDebounced = () => {}
    }) {
        this.dom = dom;
        this.surfaceManager = surfaceManager;
        this.sliderController = sliderController;
        this.sideSurfaces = sideSurfaces;
        this.activeSurface = sideSurfaces[0];
        this.listeners = new ListenerScope();
        this.initialized = false;
        this.commands = new SurfacePanelCommands({
            surfaceManager,
            onBeginAction,
            onCommitAction,
            onMarkChanged,
            onConstrainObjects,
            onRender,
            onRenderDebounced
        });
    }

    init() {
        if (!this.dom.surfaceSettingsTabs) return;
        if (this.initialized) return false;
        this.initialized = true;

        this.dom.surfaceSettingsTabs.querySelectorAll('[data-surface]').forEach(input => {
            this.listeners.listen(input, 'change', () => {
                if (!input.checked || !this.sideSurfaces.includes(input.dataset.surface)) return;
                this.activeSurface = input.dataset.surface;
                this.sync();
            });
        });

        this.listeners.listen(this.dom.surfaceVisibleToggle, 'change', event => {
            this.commands.setVisibility(this.activeSurface, event.target.checked);
            this.sync();
        });

        this.listeners.listen(this.dom.surfaceOwnGridToggle, 'change', event => {
            this.commands.setGridMode(this.activeSurface, event.target.checked);
            this.sync();
        });

        this.listeners.listen(this.dom.surfaceRotationSelect, 'change', event => {
            const rotation = Number(event.target.value);
            this.commands.setRotation(this.activeSurface, rotation);
            this.sync();
        });

        this.listeners.listen(this.dom.surfaceMarginsUnitMod, 'click', event => {
            event.preventDefault();
            this.switchMarginsUnit('mod');
        });
        this.listeners.listen(this.dom.surfaceMarginsUnitMm, 'click', event => {
            event.preventDefault();
            this.switchMarginsUnit('mm');
        });
        this.listeners.listen(this.dom.surfaceLockModuleBtn, 'click', event => {
            event.preventDefault();
            this.toggleGridLock('module');
        });
        this.listeners.listen(this.dom.surfaceLockMarginsBtn, 'click', event => {
            event.preventDefault();
            this.toggleGridLock('margins');
        });

        this.sync();
        return true;
    }

    applyGridValue(key, displayValue) {
        this.commands.applyGridValue(this.activeSurface, key, displayValue);
        this.syncGridSliders(this.surfaceManager.get(this.activeSurface));
    }

    switchMarginsUnit(unit) {
        if (this.commands.switchMarginsUnit(this.activeSurface, unit)) this.sync();
    }

    toggleGridLock(type) {
        if (this.commands.toggleGridLock(this.activeSurface, type)) this.sync();
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
        }

        [this.dom.paragraphSurfaceSelect, this.dom.graphicsSurfaceSelect].forEach(select => {
            if (!select) return;
            Array.from(select.options).forEach(option => {
                option.disabled = option.value !== 'front' && !this.surfaceManager.isVisible(option.value);
            });
        });
    }

    dispose() {
        this.initialized = false;
        return this.listeners.dispose();
    }
}
