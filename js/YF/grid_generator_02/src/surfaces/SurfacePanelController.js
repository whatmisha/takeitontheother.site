import { EYE_VISIBLE, EYE_HIDDEN } from '../ui/VisibilityIcons.js';
import { panelNames } from '../packaging/PackagingModel.js';
import { ListenerScope } from '../core/ListenerScope.js';
import { SurfacePanelCommands } from './SurfacePanelCommands.js';

const DEFAULT_SIDE_SURFACES = Object.freeze(['left', 'right', 'top', 'bottom', 'base', 'flap']);

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
        additions,
        onSelect = () => {},
        onFocus = () => {},
        onEditMainGrid = () => {},
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
        this.activeSurface = null;
        Object.assign(this, { additions, onSelect, onFocus, onEditMainGrid });
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
                if (input.checked) this.select(input.dataset.surface);
            });
        });

        this.addToggle = document.getElementById('surfaceAddToggle');
        this.addChoices = document.getElementById('surfaceAddChoices');
        this.listeners.listen(this.addToggle, 'click', () => this.setAddMenu(this.addChoices.hidden));
        this.listeners.listen(this.addChoices, 'click', event => {
            const button = event.target.closest('[data-add-surface]');
            if (button) this.add(button.dataset.addSurface);
        });
        this.listeners.listen(document, 'pointerdown', event => {
            if (!this.addChoices.contains(event.target) && !this.addToggle.contains(event.target)) this.setAddMenu(false);
        });
        this.listeners.listen(this.addChoices, 'keydown', event => {
            if (event.key === 'Escape') { this.setAddMenu(false); this.addToggle.focus(); }
        });
        this.dom.surfaceSettingsTabs.querySelectorAll('[data-surface-row]').forEach(row => {
            const id = row.dataset.surfaceRow;
            const eye = row.querySelector('[data-surface-visibility]');
            this.listeners.listen(eye, 'click', () => {
                this.commands.setVisibility(id, !this.surfaceManager.isVisible(id));
                this.sync();
            });
        });
        this.listeners.listen(document.getElementById('surfaceFocusButton'), 'click', () => this.onFocus(this.activeSurface));
        this.listeners.listen(document.getElementById('surfaceMainGridButton'), 'click', this.onEditMainGrid);

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

    select(id, { notify = true } = {}) {
        if (id !== null && !this.surfaceManager.isActive(id)) return;
        this.activeSurface = id;
        this.sync();
        if (notify) this.onSelect(id);
    }

    setAddMenu(open) {
        if (!this.addChoices) return;
        this.addChoices.hidden = !open;
        this.addToggle.setAttribute('aria-expanded', String(open));
    }

    add(id) {
        if (!this.additions?.add(id)) return false;
        this.setAddMenu(false);
        this.select(null);
        // Adding geometry does not select it. Keep the complete new net in view.
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
        if (this.activeSurface && !this.surfaceManager.isActive(this.activeSurface)) {
            this.activeSurface = null;
            this.onSelect(null);
        }
        const settings = this.surfaceManager.get(this.activeSurface);
        const names = panelNames(this.surfaceManager.settings.getAll());
        const format = value => Number(value.toFixed(1));
        this.dom.surfaceSettingsTabs.querySelectorAll('[data-surface-row]').forEach(row => {
            const id = row.dataset.surfaceRow, active = this.surfaceManager.isActive(id);
            row.hidden = !active;
            const input = row.querySelector('input');
            input.disabled = !active;
            input.checked = id === this.activeSurface;
            const item = row.querySelector('.element-item');
            item.classList.toggle('active', input.checked);
            const visible = this.surfaceManager.isVisible(id);
            item.classList.toggle('hidden', !visible);
            row.querySelector('[data-surface-name]').textContent = names[id];
            const rect = this.surfaceManager.getPhysicalRect(id);
            row.querySelector('[data-surface-size]').textContent = `${format(rect.width)} × ${format(rect.height)}`;
            const eye = row.querySelector('[data-surface-visibility]');
            eye.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${names[id]}`);
            eye.setAttribute('aria-pressed', String(visible));
            eye.title = `${visible ? 'Hide' : 'Show'} side · artwork is kept`;
            eye.innerHTML = `<span class="element-action-icon">${visible ? EYE_VISIBLE : EYE_HIDDEN}</span>`;
        });
        const isMain = this.activeSurface === 'front';
        document.getElementById('surfaceBehaviorControls').hidden = !this.activeSurface || isMain;
        document.getElementById('surfaceMainGridHint').hidden = !isMain;
        document.getElementById('surfaceSelectionTitle').textContent = names[this.activeSurface] || 'Select a side';
        document.getElementById('surfaceFocusButton').disabled = !this.surfaceManager.isVisible(this.activeSurface);
        document.getElementById('surfaceCount').textContent = `${this.surfaceManager.getActiveIds().filter(id => this.surfaceManager.isVisible(id)).length} sides`;
        const available = this.additions?.available() || [];
        this.addToggle.disabled = !available.length;
        if (!available.length) this.setAddMenu(false);
        document.getElementById('surfaceAddHint').textContent = available.length ? 'Add a side here or use + on the net. Sizes in mm.' : 'All sides added. Hidden artwork is always kept.';
        this.addChoices.replaceChildren(...available.map(item => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'dropdown-item'; button.dataset.addSurface = item.id;
            const title = document.createElement('span'); title.textContent = `${item.restore ? 'Restore' : 'Add'} ${item.name}`;
            const size = document.createElement('small'); size.textContent = `${format(item.rect.width)} × ${format(item.rect.height)} mm`;
            button.append(title, size);
            return button;
        }));
        if (this.dom.surfaceVisibleToggle) {
            this.dom.surfaceVisibleToggle.checked = settings.visible !== false;
        }
        if (this.dom.surfaceOwnGridToggle) {
            this.dom.surfaceOwnGridToggle.checked = settings.gridMode === 'own';
        }
        if (this.dom.surfaceOwnGridControls) {
            this.dom.surfaceOwnGridControls.hidden = !this.activeSurface || isMain || settings.gridMode !== 'own';
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
