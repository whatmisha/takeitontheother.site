import { GRID_MODE_INHERIT, GRID_MODE_OWN } from './PlaneDocumentStore.js';

/** Undoable edits to a single plane of the net. */
export class SurfacePanelCommands {
    constructor({
        surfaceManager,
        onBeginAction = () => {},
        onCommitAction = () => {},
        onMarkChanged = () => {},
        onConstrainObjects = () => {},
        onRender = () => {},
        onRenderDebounced = () => {}
    }) {
        this.surfaceManager = surfaceManager;
        this.onBeginAction = onBeginAction;
        this.onCommitAction = onCommitAction;
        this.onMarkChanged = onMarkChanged;
        this.onConstrainObjects = onConstrainObjects;
        this.onRender = onRender;
        this.onRenderDebounced = onRenderDebounced;
    }

    commit(label, mutation, { constrain = false } = {}) {
        this.onBeginAction(label);
        mutation();
        this.onMarkChanged();
        if (constrain) this.onConstrainObjects();
        this.onRender();
        this.onCommitAction();
        return true;
    }

    setVisibility(planeId, visible) {
        const plane = this.surfaceManager.getPlane(planeId);
        if (!plane || plane.visible === Boolean(visible)) return false;
        return this.commit('toggle plane visibility', () => {
            this.surfaceManager.update(planeId, { visible });
        });
    }

    setGridMode(planeId, ownGrid) {
        const gridMode = ownGrid ? GRID_MODE_OWN : GRID_MODE_INHERIT;
        if (this.surfaceManager.getPlane(planeId)?.grid.mode === gridMode) return false;
        return this.commit('change plane grid mode', () => {
            this.surfaceManager.update(planeId, { gridMode });
        }, { constrain: true });
    }

    setRotation(planeId, rotation) {
        if (this.surfaceManager.getPlane(planeId)?.contentRotation === rotation) return false;
        return this.commit('rotate plane content', () => {
            this.surfaceManager.update(planeId, { contentRotation: rotation });
        }, { constrain: true });
    }

    applyGridValue(planeId, key, displayValue) {
        const grid = this.surfaceManager.getPlane(planeId)?.grid.own;
        if (!grid || !Number.isFinite(Number(displayValue))) return false;
        if ((key === 'module' && grid.lockedModule) ||
            (key === 'margins' && grid.lockedMargins)) return false;

        let value = Number(displayValue);
        if (key === 'margins' && grid.marginsUnit === 'mm') {
            value = grid.module > 0 ? value / grid.module : 0;
        }
        if (['columns', 'rows', 'rowHeight'].includes(key)) value = Math.max(1, Math.round(value));
        this.surfaceManager.update(planeId, {
            gridMode: GRID_MODE_OWN,
            grid: { ...grid, [key]: value }
        });
        this.onMarkChanged();
        this.onConstrainObjects();
        this.onRenderDebounced();
        return true;
    }

    switchMarginsUnit(planeId, unit) {
        const grid = this.surfaceManager.getPlane(planeId)?.grid.own;
        const marginsUnit = unit === 'mm' ? 'mm' : 'mod';
        if (!grid || grid.marginsUnit === marginsUnit) return false;
        return this.commit('switch plane margins unit', () => {
            this.surfaceManager.update(planeId, { grid: { ...grid, marginsUnit } });
        });
    }

    toggleGridLock(planeId, type) {
        const current = this.surfaceManager.getPlane(planeId)?.grid.own;
        if (!current) return false;
        return this.commit(`toggle plane ${type} lock`, () => {
            const grid = { ...current };
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
            this.surfaceManager.update(planeId, { grid });
        });
    }

    // --- plane management ----------------------------------------------------

    addPlane(spec) {
        let created = null;
        this.commit('add plane', () => { created = this.surfaceManager.addPlane(spec); });
        return created;
    }

    /**
     * Removes a plane and its children.
     *
     * Objects that lived on the removed planes are handed to `onOrphanObjects`
     * so the caller can move them to the root or drop them with the planes.
     */
    removePlane(planeId, onOrphanObjects = () => {}) {
        if (this.surfaceManager.isRoot(planeId)) return [];
        let removed = [];
        this.commit('remove plane', () => {
            removed = this.surfaceManager.removePlane(planeId);
            if (removed.length > 0) onOrphanObjects(removed);
        }, { constrain: true });
        return removed;
    }

    renamePlane(planeId, name) {
        const plane = this.surfaceManager.getPlane(planeId);
        const trimmed = String(name).trim();
        if (!plane || !trimmed || plane.name === trimmed) return false;
        return this.commit('rename plane', () => {
            this.surfaceManager.update(planeId, { name: trimmed });
        });
    }

    reattachPlane(planeId, attach) {
        if (this.surfaceManager.isRoot(planeId)) return false;
        return this.commit('reattach plane', () => {
            this.surfaceManager.update(planeId, { attach });
        }, { constrain: true });
    }

    resizePlane(planeId, size) {
        return this.commit('resize plane', () => {
            this.surfaceManager.update(planeId, { size });
        }, { constrain: true });
    }

    reorderPlane(planeId, index) {
        let moved = false;
        this.commit('reorder planes', () => {
            moved = this.surfaceManager.reorderPlane(planeId, index);
        });
        return moved;
    }
}
