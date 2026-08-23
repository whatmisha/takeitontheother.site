import { ListenerScope } from '../core/ListenerScope.js';
import { SurfacePanelCommands } from './SurfacePanelCommands.js';
import { GRID_MODE_OWN, RESERVED_VARIABLES } from './PlaneDocumentStore.js';
import { FIT, PLANE_EDGES } from './PlaneDefinition.js';

/**
 * UI controller for the plane inspector.
 *
 * The panel edits one plane at a time and lists every plane the document has,
 * so adding, renaming or reattaching a plane needs no markup change. Geometry
 * and persistence stay in SurfaceManager; this controller owns only panel
 * state, DOM events and value presentation.
 */
export class SurfacePanelController {
    constructor({
        dom,
        surfaceManager,
        sliderController,
        documentRef = globalThis.document,
        onBeginAction = () => {},
        onCommitAction = () => {},
        onMarkChanged = () => {},
        onConstrainObjects = () => {},
        onRender = () => {},
        onRenderDebounced = () => {},
        onUpdateEyeIcon = () => {},
        onPlanesRemoved = () => {},
        resolvePlaneAtPointer = null
    }) {
        this.dom = dom;
        this.surfaceManager = surfaceManager;
        this.sliderController = sliderController;
        this.document = documentRef;
        this.activeSurface = null;
        this.listeners = new ListenerScope();
        this.initialized = false;
        this.onUpdateEyeIcon = onUpdateEyeIcon;
        this.onPlanesRemoved = onPlanesRemoved;
        this.resolvePlaneAtPointer = resolvePlaneAtPointer;
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

    /** Every plane is editable; the root just has fewer applicable controls. */
    getEditablePlaneIds() {
        return this.surfaceManager.getPlaneIds();
    }

    getActivePlaneId() {
        const editable = this.getEditablePlaneIds();
        if (editable.length === 0) return null;
        return editable.includes(this.activeSurface) ? this.activeSurface : editable[0];
    }

    setActivePlane(planeId) {
        if (!this.getEditablePlaneIds().includes(planeId)) return false;
        this.activeSurface = planeId;
        this.sync();
        return true;
    }

    init() {
        if (!this.dom.surfaceSettingsTabs) return;
        if (this.initialized) return false;
        this.initialized = true;

        this.bindPlaneList();
        this.bindQuickControls();
        this.bindGeometryControls();
        this.bindVariableControls();
        this.bindCanvasSelection();

        this.sync();
        return true;
    }

    /**
     * Clicking empty canvas selects the plane under the cursor.
     *
     * Clicks that land on an object belong to that object's editor, so they are
     * left alone.
     */
    bindCanvasSelection() {
        if (!this.dom.svg || !this.resolvePlaneAtPointer) return;
        this.listeners.listen(this.dom.svg, 'click', event => {
            if (event.target.closest?.('[data-block-id]')) return;
            const planeId = this.resolvePlaneAtPointer(event.clientX, event.clientY);
            if (planeId) this.setActivePlane(planeId);
        });
    }

    /**
     * One delegated listener covers the whole list, so rows can be rebuilt
     * whenever the document changes without rebinding anything.
     */
    bindPlaneList() {
        this.listeners.listen(this.dom.surfaceSettingsTabs, 'click', event => {
            const button = event.target.closest('[data-plane-action]');
            if (!button) return;
            const planeId = button.dataset.planeId;
            if (button.dataset.planeAction === 'select') {
                this.setActivePlane(planeId);
            } else if (button.dataset.planeAction === 'visible') {
                this.commands.setVisibility(planeId, !this.surfaceManager.getPlane(planeId).visible);
                this.sync();
            } else if (button.dataset.planeAction === 'remove') {
                this.removePlane(planeId);
            }
        });

        this.listeners.listen(this.dom.planeAddBtn, 'click', () => {
            const created = this.commands.addPlane({
                parentId: this.getActivePlaneId(),
                edge: this.dom.planeAddEdge?.value || 'right',
                kind: this.dom.planeAddKind?.value || 'panel',
                name: this.suggestPlaneName(this.dom.planeAddKind?.value || 'panel')
            });
            if (created) this.activeSurface = created.id;
            this.sync();
        });
    }

    bindQuickControls() {
        this.listeners.listen(this.dom.surfaceVisibleToggle, 'change', event => {
            this.commands.setVisibility(this.getActivePlaneId(), event.target.checked);
            this.sync();
        });

        this.listeners.listen(this.dom.surfaceOwnGridToggle, 'change', event => {
            this.commands.setGridMode(this.getActivePlaneId(), event.target.checked);
            this.sync();
        });

        this.listeners.listen(this.dom.surfaceRotationSelect, 'change', event => {
            this.commands.setRotation(this.getActivePlaneId(), Number(event.target.value));
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
    }

    bindGeometryControls() {
        this.listeners.listen(this.dom.planeNameInput, 'change', event => {
            this.commands.renamePlane(this.getActivePlaneId(), event.target.value);
            this.sync();
        });
        this.listeners.listen(this.dom.planeKindSelect, 'change', event => {
            this.commands.commit('change plane kind', () => {
                this.surfaceManager.update(this.getActivePlaneId(), { kind: event.target.value });
            });
            this.sync();
        });
        this.listeners.listen(this.dom.planeWidthInput, 'change', () => this.applySize());
        this.listeners.listen(this.dom.planeHeightInput, 'change', () => this.applySize());

        [
            this.dom.planeAttachToSelect,
            this.dom.planeAttachEdgeSelect,
            this.dom.planeAttachAlignSelect,
            this.dom.planeAttachOffsetInput
        ].forEach(control => {
            this.listeners.listen(control, 'change', () => this.applyAttachment());
        });

        this.listeners.listen(this.dom.planeStackUpBtn, 'click', () => this.movePlaneInStack(1));
        this.listeners.listen(this.dom.planeStackDownBtn, 'click', () => this.movePlaneInStack(-1));
    }

    bindVariableControls() {
        this.listeners.listen(this.dom.planeVariableList, 'change', event => {
            const input = event.target.closest('[data-variable-name]');
            if (!input) return;
            this.setVariable(input.dataset.variableName, input.value);
        });
        this.listeners.listen(this.dom.planeVariableList, 'click', event => {
            const button = event.target.closest('[data-variable-remove]');
            if (!button) return;
            this.commands.commit('remove variable', () => {
                this.surfaceManager.removeVariable(button.dataset.variableRemove);
            }, { constrain: true });
            this.sync();
        });
        this.listeners.listen(this.dom.planeVariableAddBtn, 'click', () => {
            const name = String(this.dom.planeVariableNameInput?.value || '').trim();
            if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name)) return;
            if (this.setVariable(name, this.dom.planeVariableValueInput?.value)) {
                if (this.dom.planeVariableNameInput) this.dom.planeVariableNameInput.value = '';
                if (this.dom.planeVariableValueInput) this.dom.planeVariableValueInput.value = '';
            }
        });
    }

    setVariable(name, rawValue) {
        const value = Number(rawValue);
        if (!Number.isFinite(value) || value <= 0) return false;
        this.commands.commit('set variable', () => {
            this.surfaceManager.setVariable(name, value);
        }, { constrain: true });
        this.sync();
        return true;
    }

    removePlane(planeId) {
        const removed = this.commands.removePlane(planeId, ids => this.onPlanesRemoved(ids));
        if (removed.includes(this.activeSurface)) this.activeSurface = null;
        this.sync();
        return removed;
    }

    /** Moves the plane one step through the paint and hit-test order. */
    movePlaneInStack(delta) {
        const planeId = this.getActivePlaneId();
        const index = this.surfaceManager.getPlaneIds().indexOf(planeId);
        if (index === -1) return false;
        const moved = this.commands.reorderPlane(planeId, index + delta);
        this.sync();
        return moved;
    }

    /**
     * A size field takes millimetres, the name of a variable, or `fit`.
     *
     * An empty field means "leave as is", which keeps a stray blur from
     * silently resizing the plane.
     */
    applySize() {
        const plane = this.surfaceManager.getPlane(this.getActivePlaneId());
        const size = {
            width: this.parseDimension(this.dom.planeWidthInput?.value, plane.size.width),
            height: this.parseDimension(this.dom.planeHeightInput?.value, plane.size.height)
        };
        if (size.width === plane.size.width && size.height === plane.size.height) return false;
        this.commands.resizePlane(plane.id, size);
        this.sync();
        return true;
    }

    parseDimension(rawValue, fallback) {
        const value = String(rawValue ?? '').trim();
        if (!value) return fallback;
        if (value.toLowerCase() === FIT) return FIT;
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) return numeric;
        return this.surfaceManager.getVariables()[value] === undefined ? fallback : value;
    }

    applyAttachment() {
        const planeId = this.getActivePlaneId();
        if (this.surfaceManager.isRoot(planeId)) return false;
        const offset = Number(this.dom.planeAttachOffsetInput?.value);
        this.commands.reattachPlane(planeId, {
            to: this.dom.planeAttachToSelect?.value,
            edge: this.dom.planeAttachEdgeSelect?.value,
            align: this.dom.planeAttachAlignSelect?.value,
            offset: Number.isFinite(offset) ? offset : 0
        });
        this.sync();
        return true;
    }

    /** Names the next plane of a kind so the list stays readable. */
    suggestPlaneName(kind) {
        const label = kind === 'glue' ? 'Glue' : (kind === 'flap' ? 'Flap' : 'Panel');
        const taken = new Set(this.surfaceManager.getPlanes().map(plane => plane.name));
        if (!taken.has(label)) return label;
        let index = 2;
        while (taken.has(`${label} ${index}`)) index += 1;
        return `${label} ${index}`;
    }

    applyGridValue(key, displayValue) {
        const planeId = this.getActivePlaneId();
        this.commands.applyGridValue(planeId, key, displayValue);
        this.syncGridSliders(this.surfaceManager.getPlane(planeId));
    }

    switchMarginsUnit(unit) {
        if (this.commands.switchMarginsUnit(this.getActivePlaneId(), unit)) this.sync();
    }

    toggleGridLock(type) {
        if (this.commands.toggleGridLock(this.getActivePlaneId(), type)) this.sync();
    }

    syncGridSliders(plane) {
        if (!plane?.grid?.own || !this.sliderController) return;
        const grid = plane.grid.own;
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
        const planeId = this.getActivePlaneId();
        if (!planeId) return;
        this.activeSurface = planeId;

        const plane = this.surfaceManager.getPlane(planeId);
        const isRoot = this.surfaceManager.isRoot(planeId);

        this.renderPlaneList(planeId);
        if (this.dom.surfaceVisibleToggle) {
            this.dom.surfaceVisibleToggle.checked = isRoot || plane.visible !== false;
            this.dom.surfaceVisibleToggle.disabled = isRoot;
            this.onUpdateEyeIcon(this.dom.surfaceVisibleToggle);
        }
        const ownsGrid = plane.grid.mode === GRID_MODE_OWN;
        if (this.dom.surfaceOwnGridToggle) {
            this.dom.surfaceOwnGridToggle.checked = ownsGrid;
            this.dom.surfaceOwnGridToggle.disabled = isRoot;
        }
        if (this.dom.surfaceOwnGridControls) this.dom.surfaceOwnGridControls.hidden = !ownsGrid;
        if (this.dom.surfaceRotationSelect) {
            this.dom.surfaceRotationSelect.value = String(plane.contentRotation);
        }

        this.syncGeometryControls(plane, isRoot);
        this.syncVariableList();
        this.syncGridSliders(plane);

        if (this.dom.showSidePanels) {
            this.dom.showSidePanels.checked = this.surfaceManager.getPlaneIds()
                .some(id => !this.surfaceManager.isRoot(id) && this.surfaceManager.isVisible(id));
            this.onUpdateEyeIcon(this.dom.showSidePanels);
        }

        this.syncPlaneSelects();
    }

    renderPlaneList(activeId) {
        const rootId = this.surfaceManager.getRootId();
        const rows = this.surfaceManager.getPlanes().map(plane => {
            const row = this.document.createElement('div');
            row.className = 'plane-row';
            row.classList.toggle('is-active', plane.id === activeId);
            row.classList.toggle('is-root', plane.id === rootId);

            const select = this.document.createElement('button');
            select.type = 'button';
            select.className = 'plane-row-select';
            select.dataset.planeAction = 'select';
            select.dataset.planeId = plane.id;
            select.setAttribute('role', 'option');
            select.setAttribute('aria-selected', plane.id === activeId ? 'true' : 'false');
            select.textContent = plane.name;
            if (plane.kind !== 'panel') {
                const kind = this.document.createElement('span');
                kind.className = 'plane-row-kind';
                kind.textContent = ` · ${plane.kind}`;
                select.appendChild(kind);
            }
            row.appendChild(select);

            const visible = this.document.createElement('button');
            visible.type = 'button';
            visible.className = 'plane-row-visible';
            visible.dataset.planeAction = 'visible';
            visible.dataset.planeId = plane.id;
            visible.disabled = plane.id === rootId;
            visible.setAttribute('aria-pressed', plane.visible !== false ? 'true' : 'false');
            visible.setAttribute('aria-label', `Toggle ${plane.name} visibility`);
            visible.textContent = plane.visible !== false ? '◉' : '◌';
            row.appendChild(visible);

            const remove = this.document.createElement('button');
            remove.type = 'button';
            remove.className = 'plane-row-remove';
            remove.dataset.planeAction = 'remove';
            remove.dataset.planeId = plane.id;
            remove.setAttribute('aria-label', `Remove ${plane.name}`);
            remove.textContent = '×';
            row.appendChild(remove);

            return row;
        });
        this.dom.surfaceSettingsTabs.replaceChildren(...rows);
    }

    syncGeometryControls(plane, isRoot) {
        if (this.dom.planeNameInput) this.dom.planeNameInput.value = plane.name;
        if (this.dom.planeKindSelect) {
            this.dom.planeKindSelect.value = plane.kind;
            this.dom.planeKindSelect.disabled = isRoot;
        }
        if (this.dom.planeWidthInput) this.dom.planeWidthInput.value = String(plane.size.width);
        if (this.dom.planeHeightInput) this.dom.planeHeightInput.value = String(plane.size.height);

        if (this.dom.planeAttachToSelect) {
            // A plane cannot fold from itself or from anything folded onto it.
            const subtree = new Set(this.surfaceManager.getSubtree(plane.id));
            const candidates = this.surfaceManager.getPlanes()
                .filter(candidate => !subtree.has(candidate.id));
            this.dom.planeAttachToSelect.replaceChildren(...candidates.map(candidate => {
                const option = this.document.createElement('option');
                option.value = candidate.id;
                option.textContent = candidate.name;
                return option;
            }));
            if (plane.attach) this.dom.planeAttachToSelect.value = plane.attach.to;
            this.dom.planeAttachToSelect.disabled = isRoot || candidates.length === 0;
        }
        if (this.dom.planeAttachEdgeSelect) {
            this.dom.planeAttachEdgeSelect.value = plane.attach?.edge || PLANE_EDGES[1];
            this.dom.planeAttachEdgeSelect.disabled = isRoot;
        }
        if (this.dom.planeAttachAlignSelect) {
            this.dom.planeAttachAlignSelect.value = plane.attach?.align || 'start';
            this.dom.planeAttachAlignSelect.disabled = isRoot;
        }
        if (this.dom.planeAttachOffsetInput) {
            this.dom.planeAttachOffsetInput.value = String(plane.attach?.offset ?? 0);
            this.dom.planeAttachOffsetInput.disabled = isRoot;
        }

        const index = this.surfaceManager.getPlaneIds().indexOf(plane.id);
        const count = this.surfaceManager.getPlaneIds().length;
        if (this.dom.planeStackDownBtn) this.dom.planeStackDownBtn.disabled = index <= 0;
        if (this.dom.planeStackUpBtn) this.dom.planeStackUpBtn.disabled = index >= count - 1;
    }

    /**
     * Lists the net variables. `W`, `H` and `D` mirror the dimension sliders,
     * so they are shown read-only instead of offering a second way to edit them.
     */
    syncVariableList() {
        if (!this.dom.planeVariableList) return;
        const variables = this.surfaceManager.getVariables();
        const names = [
            ...Object.keys(RESERVED_VARIABLES),
            ...Object.keys(variables).filter(name => !(name in RESERVED_VARIABLES)).sort()
        ];
        this.dom.planeVariableList.replaceChildren(...names.map(name => {
            const reserved = name in RESERVED_VARIABLES;
            const row = this.document.createElement('div');
            row.className = 'plane-variable-row';

            const label = this.document.createElement('span');
            label.textContent = name;
            row.appendChild(label);

            const input = this.document.createElement('input');
            input.type = 'text';
            input.inputMode = 'decimal';
            input.value = String(Number(variables[name] ?? 0));
            input.disabled = reserved;
            input.dataset.variableName = name;
            input.setAttribute('aria-label', `Value of ${name} in millimetres`);
            row.appendChild(input);

            const remove = this.document.createElement('button');
            remove.type = 'button';
            remove.className = 'plane-row-remove';
            remove.dataset.variableRemove = name;
            remove.disabled = reserved;
            remove.setAttribute('aria-label', `Remove ${name}`);
            remove.textContent = '×';
            row.appendChild(remove);

            return row;
        }));
    }

    /**
     * Rebuilds the plane pickers in the object editors from the document.
     *
     * Options carry plane ids as values, so a renamed or newly added plane
     * appears without touching the markup.
     */
    syncPlaneSelects() {
        const rootId = this.surfaceManager.getRootId();
        const planes = this.surfaceManager.getPlanes();
        [this.dom.paragraphSurfaceSelect, this.dom.graphicsSurfaceSelect].forEach(select => {
            if (!select) return;
            const selected = select.value;
            select.replaceChildren(...planes.map(plane => {
                const option = this.document.createElement('option');
                option.value = plane.id;
                option.textContent = plane.name;
                option.disabled = plane.id !== rootId && !this.surfaceManager.isVisible(plane.id);
                return option;
            }));
            if (planes.some(plane => plane.id === selected)) select.value = selected;
        });
    }

    dispose() {
        this.initialized = false;
        return this.listeners.dispose();
    }
}
