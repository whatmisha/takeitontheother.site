import { cloneJson } from '../utils/cloneJson.js';

export const SURFACE_IDS = Object.freeze(['front', 'left', 'right', 'top', 'bottom']);
export const SIDE_SURFACE_IDS = Object.freeze(['left', 'right', 'top', 'bottom']);
export const SURFACE_ROTATIONS = Object.freeze([0, 90, 180, 270]);

const ORIENTATION_PROFILES = Object.freeze({
    front: Object.freeze({ front: 0, left: 90, right: 270, top: 180, bottom: 0 }),
    reverse: Object.freeze({ front: 0, left: 270, right: 90, top: 0, bottom: 180 })
});
const clone = cloneJson;
const finitePositive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const finiteNonNegative = (value, fallback) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;

function normalizeRotation(value, fallback = 0) {
    const normalized = ((Number(value) % 360) + 360) % 360;
    return Number.isFinite(normalized) && SURFACE_ROTATIONS.includes(normalized) ? normalized : fallback;
}

export function getPresetOrientationProfile(presetName = '') {
    const name = String(presetName).trim();
    return /^\+?\s*New(?:\b|$)/i.test(name) || /Front/i.test(name) ? 'front' : 'reverse';
}

export function createDefaultSurfaceSettings(profile = 'front', mainGrid = {}) {
    const rotations = ORIENTATION_PROFILES[profile] || ORIENTATION_PROFILES.front;
    const grid = {
        module: finitePositive(mainGrid.module, 5),
        margins: finiteNonNegative(mainGrid.margins, 2),
        columns: Math.max(1, Math.round(finitePositive(mainGrid.columns, 4))),
        rows: Math.max(1, Math.round(finitePositive(mainGrid.rows, 4))),
        rowHeight: Math.max(1, Math.round(finitePositive(mainGrid.rowHeight, 4))),
        marginsUnit: 'mod',
        lockedModule: false,
        lockedMargins: false
    };
    return Object.fromEntries(SURFACE_IDS.map(surface => [surface, {
        visible: true,
        rotation: rotations[surface],
        gridMode: 'main',
        grid: clone(grid)
    }]));
}

export class SurfaceStateStore {
    constructor(settings) {
        this.settings = settings;
    }

    getMainGrid() {
        return {
            module: finitePositive(this.settings.get('gridModule'), 1),
            margins: finiteNonNegative(this.settings.get('margins'), 0),
            columns: Math.max(1, Math.round(finitePositive(this.settings.get('columnCount'), 1))),
            rows: Math.max(1, Math.round(finitePositive(this.settings.get('rowCount'), 1))),
            rowHeight: Math.max(1, Math.round(finitePositive(this.settings.get('rowHeight'), 1)))
        };
    }

    normalize(settings, presetName = '') {
        const defaults = createDefaultSurfaceSettings(getPresetOrientationProfile(presetName), this.getMainGrid());
        const source = settings && typeof settings === 'object' ? settings : {};
        return Object.fromEntries(SURFACE_IDS.map(surface => {
            const incoming = source[surface] && typeof source[surface] === 'object' ? source[surface] : {};
            const incomingGrid = incoming.grid && typeof incoming.grid === 'object' ? incoming.grid : {};
            const fallback = defaults[surface];
            return [surface, {
                visible: surface === 'front' || incoming.visible !== false,
                rotation: surface === 'front' ? 0 : normalizeRotation(incoming.rotation, fallback.rotation),
                gridMode: surface === 'front' ? 'main' : (incoming.gridMode === 'own' || incoming.ownGrid === true ? 'own' : 'main'),
                grid: this.normalizeGrid(incomingGrid, fallback.grid)
            }];
        }));
    }

    normalizeGrid(grid = {}, fallback) {
        return {
            module: finitePositive(grid.module, fallback.module),
            margins: finiteNonNegative(grid.margins, fallback.margins),
            columns: Math.max(1, Math.round(finitePositive(grid.columns, fallback.columns))),
            rows: Math.max(1, Math.round(finitePositive(grid.rows, fallback.rows))),
            rowHeight: Math.max(1, Math.round(finitePositive(grid.rowHeight, fallback.rowHeight))),
            marginsUnit: grid.marginsUnit === 'mm' ? 'mm' : (grid.marginsUnit === 'mod' ? 'mod' : fallback.marginsUnit),
            lockedModule: typeof grid.lockedModule === 'boolean' ? grid.lockedModule : fallback.lockedModule,
            lockedMargins: typeof grid.lockedMargins === 'boolean' ? grid.lockedMargins : fallback.lockedMargins
        };
    }

    initialize(presetName = '', explicitSettings) {
        const normalized = this.normalize(explicitSettings, presetName);
        if (!explicitSettings && this.settings.get('showSidePanels') === false) {
            SIDE_SURFACE_IDS.forEach(surface => { normalized[surface].visible = false; });
        }
        this.settings.set('surfaceSettings', normalized, true);
        this.syncMasterVisibility();
        return normalized;
    }

    getAll() {
        return this.settings.get('surfaceSettings') || this.initialize('');
    }

    get(surface = 'front') {
        return this.getAll()[SURFACE_IDS.includes(surface) ? surface : 'front'];
    }

    update(surface, patch = {}) {
        if (!SIDE_SURFACE_IDS.includes(surface)) return this.get('front');
        const next = clone(this.getAll());
        const current = next[surface];
        if ('visible' in patch) current.visible = patch.visible !== false;
        if ('rotation' in patch) current.rotation = normalizeRotation(patch.rotation, current.rotation);
        if ('gridMode' in patch) current.gridMode = patch.gridMode === 'own' ? 'own' : 'main';
        if (patch.grid && typeof patch.grid === 'object') current.grid = this.normalizeGrid(patch.grid, current.grid);
        this.settings.set('surfaceSettings', next);
        this.syncMasterVisibility();
        return current;
    }

    setAllSideVisibility(visible) {
        const next = clone(this.getAll());
        SIDE_SURFACE_IDS.forEach(surface => { next[surface].visible = Boolean(visible); });
        this.settings.set('surfaceSettings', next);
        this.settings.set('showSidePanels', Boolean(visible));
    }

    syncMasterVisibility() {
        this.settings.set(
            'showSidePanels',
            SIDE_SURFACE_IDS.some(surface => this.getAll()[surface].visible !== false),
            true
        );
    }

    isVisible(surface) {
        return surface === 'front' || (
            this.settings.get('showSidePanels') !== false && this.get(surface).visible !== false
        );
    }

    getGridContext(surface, localWidthMm, localHeightMm) {
        const main = this.getMainGrid();
        const surfaceSettings = this.get(surface);
        let grid = main;
        if (surface !== 'front' && surfaceSettings.gridMode === 'own') {
            grid = surfaceSettings.grid;
        } else if (surface !== 'front') {
            const frontWidth = finitePositive(this.settings.get('frontWidth'), localWidthMm);
            const frontHeight = finitePositive(this.settings.get('frontHeight'), localHeightMm);
            const mainColumnWidth = Math.max(main.module, (frontWidth - 2 * main.margins * main.module - (main.columns - 1) * main.module) / main.columns);
            const availableWidth = Math.max(main.module, localWidthMm - 2 * main.margins * main.module);
            const columns = Math.abs(localWidthMm - frontWidth) < 0.001
                ? main.columns
                : Math.abs(localWidthMm - frontHeight) < 0.001
                    ? main.rows
                    : Math.max(1, Math.floor((availableWidth + main.module) / (mainColumnWidth + main.module)));
            const availableHeightModules = Math.max(1, localHeightMm / main.module - 2 * main.margins);
            grid = { ...main, columns, rows: Math.max(1, Math.floor((availableHeightModules + 1) / (main.rowHeight + 1))) };
        }
        const module = finitePositive(grid.module, main.module);
        const maxMargins = Math.max(0, Math.min(localWidthMm, localHeightMm) / (2 * module) - 0.01);
        return {
            gridModule: module,
            margins: Math.min(finiteNonNegative(grid.margins, main.margins), maxMargins),
            columnCount: Math.max(1, Math.round(finitePositive(grid.columns, main.columns))),
            rowCount: Math.max(1, Math.round(finitePositive(grid.rows, main.rows))),
            rowHeight: Math.max(1, Math.round(finitePositive(grid.rowHeight, main.rowHeight))),
            frontWidth: localWidthMm,
            frontHeight: localHeightMm
        };
    }
}
