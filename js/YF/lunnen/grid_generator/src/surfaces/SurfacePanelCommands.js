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

    setVisibility(surface, visible) {
        const current = this.surfaceManager.get(surface);
        if (!current || current.visible === Boolean(visible)) return false;
        return this.commit('toggle surface visibility', () => {
            this.surfaceManager.update(surface, { visible });
        });
    }

    setGridMode(surface, ownGrid) {
        const gridMode = ownGrid ? 'own' : 'main';
        if (this.surfaceManager.get(surface)?.gridMode === gridMode) return false;
        return this.commit('change surface grid mode', () => {
            this.surfaceManager.update(surface, { gridMode });
        }, { constrain: true });
    }

    setRotation(surface, rotation) {
        if (this.surfaceManager.get(surface)?.rotation === rotation) return false;
        return this.commit('rotate surface', () => {
            this.surfaceManager.update(surface, { rotation });
        }, { constrain: true });
    }

    applyGridValue(surface, key, displayValue) {
        const current = this.surfaceManager.get(surface);
        if (!current || !Number.isFinite(Number(displayValue))) return false;
        if ((key === 'module' && current.grid.lockedModule) ||
            (key === 'margins' && current.grid.lockedMargins)) return false;

        let value = Number(displayValue);
        if (key === 'margins' && current.grid.marginsUnit === 'mm') {
            value = current.grid.module > 0 ? value / current.grid.module : 0;
        }
        if (['columns', 'rows', 'rowHeight'].includes(key)) value = Math.max(1, Math.round(value));
        this.surfaceManager.update(surface, {
            gridMode: 'own',
            grid: { ...current.grid, [key]: value }
        });
        this.onMarkChanged();
        this.onConstrainObjects();
        this.onRenderDebounced();
        return true;
    }

    switchMarginsUnit(surface, unit) {
        const current = this.surfaceManager.get(surface);
        const marginsUnit = unit === 'mm' ? 'mm' : 'mod';
        if (!current || current.grid.marginsUnit === marginsUnit) return false;
        return this.commit('switch surface margins unit', () => {
            this.surfaceManager.update(surface, {
                grid: { ...current.grid, marginsUnit }
            });
        });
    }

    toggleGridLock(surface, type) {
        const current = this.surfaceManager.get(surface);
        if (!current) return false;
        return this.commit(`toggle surface ${type} lock`, () => {
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
            this.surfaceManager.update(surface, { grid });
        });
    }
}
