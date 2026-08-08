/**
 * Единая модель поверхностей упаковочной развёртки.
 *
 * Центральная поверхность всегда видима и не поворачивается. Боковые
 * поверхности хранят собственную видимость, ориентацию и (опционально)
 * независимую сетку. Координаты объектов задаются в локальной системе
 * выбранной поверхности.
 */

export const SURFACE_IDS = Object.freeze(['front', 'left', 'right', 'top', 'bottom']);
export const SIDE_SURFACE_IDS = Object.freeze(['left', 'right', 'top', 'bottom']);
export const SURFACE_ROTATIONS = Object.freeze([0, 90, 180, 270]);

const FRONT_ROTATIONS = Object.freeze({
    front: 0,
    left: 90,
    right: 270,
    top: 180,
    bottom: 0
});

const REVERSE_ROTATIONS = Object.freeze({
    front: 0,
    left: 270,
    right: 90,
    top: 0,
    bottom: 180
});

const clone = value => JSON.parse(JSON.stringify(value));

function normalizeRotation(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    const normalized = ((numeric % 360) + 360) % 360;
    return SURFACE_ROTATIONS.includes(normalized) ? normalized : fallback;
}

function finitePositive(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function finiteNonNegative(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function getPresetOrientationProfile(presetName = '') {
    const name = String(presetName).trim();
    return name.startsWith('+ New') || name.startsWith('+New') || /Front/i.test(name)
        ? 'front'
        : 'reverse';
}

export function createDefaultSurfaceSettings(profile = 'front', mainGrid = {}) {
    const rotations = profile === 'reverse' ? REVERSE_ROTATIONS : FRONT_ROTATIONS;
    const defaultGrid = {
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
        grid: clone(defaultGrid)
    }]));
}

export class SurfaceManager {
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
        const defaults = createDefaultSurfaceSettings(
            getPresetOrientationProfile(presetName),
            this.getMainGrid()
        );
        const source = settings && typeof settings === 'object' ? settings : {};

        const normalized = {};
        SURFACE_IDS.forEach(surface => {
            const incoming = source[surface] && typeof source[surface] === 'object'
                ? source[surface]
                : {};
            const defaultSurface = defaults[surface];
            const incomingGrid = incoming.grid && typeof incoming.grid === 'object'
                ? incoming.grid
                : {};

            normalized[surface] = {
                visible: surface === 'front' ? true : incoming.visible !== false,
                rotation: surface === 'front'
                    ? 0
                    : normalizeRotation(incoming.rotation, defaultSurface.rotation),
                gridMode: surface === 'front'
                    ? 'main'
                    : (incoming.gridMode === 'own' || incoming.ownGrid === true ? 'own' : 'main'),
                grid: {
                    module: finitePositive(incomingGrid.module, defaultSurface.grid.module),
                    margins: finiteNonNegative(incomingGrid.margins, defaultSurface.grid.margins),
                    columns: Math.max(1, Math.round(finitePositive(incomingGrid.columns, defaultSurface.grid.columns))),
                    rows: Math.max(1, Math.round(finitePositive(incomingGrid.rows, defaultSurface.grid.rows))),
                    rowHeight: Math.max(1, Math.round(finitePositive(incomingGrid.rowHeight, defaultSurface.grid.rowHeight))),
                    marginsUnit: incomingGrid.marginsUnit === 'mm' ? 'mm' : 'mod',
                    lockedModule: incomingGrid.lockedModule === true,
                    lockedMargins: incomingGrid.lockedMargins === true
                }
            };
        });

        return normalized;
    }

    initialize(presetName = '', explicitSettings) {
        const normalized = this.normalize(explicitSettings, presetName);
        if (!explicitSettings && this.settings.get('showSidePanels') === false) {
            SIDE_SURFACE_IDS.forEach(surface => {
                normalized[surface].visible = false;
            });
        }
        this.settings.set('surfaceSettings', normalized, true);
        this.syncMasterVisibility();
        return normalized;
    }

    getAll() {
        const current = this.settings.get('surfaceSettings');
        if (!current) return this.initialize('');
        return current;
    }

    get(surface = 'front') {
        return this.getAll()[SURFACE_IDS.includes(surface) ? surface : 'front'];
    }

    update(surface, patch = {}) {
        if (!SIDE_SURFACE_IDS.includes(surface)) return this.get('front');
        const next = clone(this.getAll());
        const current = next[surface];

        if (Object.prototype.hasOwnProperty.call(patch, 'visible')) {
            current.visible = patch.visible !== false;
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'rotation')) {
            current.rotation = normalizeRotation(patch.rotation, current.rotation);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'gridMode')) {
            current.gridMode = patch.gridMode === 'own' ? 'own' : 'main';
        }
        if (patch.grid && typeof patch.grid === 'object') {
            current.grid = {
                module: finitePositive(patch.grid.module, current.grid.module),
                margins: finiteNonNegative(patch.grid.margins, current.grid.margins),
                columns: Math.max(1, Math.round(finitePositive(patch.grid.columns, current.grid.columns))),
                rows: Math.max(1, Math.round(finitePositive(patch.grid.rows, current.grid.rows))),
                rowHeight: Math.max(1, Math.round(finitePositive(patch.grid.rowHeight, current.grid.rowHeight))),
                marginsUnit: patch.grid.marginsUnit === 'mm' ? 'mm' : (patch.grid.marginsUnit === 'mod' ? 'mod' : current.grid.marginsUnit),
                lockedModule: typeof patch.grid.lockedModule === 'boolean' ? patch.grid.lockedModule : current.grid.lockedModule,
                lockedMargins: typeof patch.grid.lockedMargins === 'boolean' ? patch.grid.lockedMargins : current.grid.lockedMargins
            };
        }

        this.settings.set('surfaceSettings', next);
        this.syncMasterVisibility();
        return current;
    }

    setAllSideVisibility(visible) {
        const next = clone(this.getAll());
        SIDE_SURFACE_IDS.forEach(surface => {
            next[surface].visible = Boolean(visible);
        });
        this.settings.set('surfaceSettings', next);
        this.settings.set('showSidePanels', Boolean(visible));
    }

    syncMasterVisibility() {
        const anyVisible = SIDE_SURFACE_IDS.some(surface => this.getAll()[surface].visible !== false);
        this.settings.set('showSidePanels', anyVisible, true);
    }

    isVisible(surface) {
        if (surface === 'front') return true;
        return this.settings.get('showSidePanels') !== false && this.get(surface).visible !== false;
    }

    getPhysicalRect(surface, layout) {
        const { x = 0, y = 0, frontWidth, frontHeight, thickness } = layout;
        switch (surface) {
            case 'left':
                return { x, y: y + thickness, width: thickness, height: frontHeight };
            case 'right':
                return { x: x + thickness + frontWidth, y: y + thickness, width: thickness, height: frontHeight };
            case 'top':
                return { x: x + thickness, y, width: frontWidth, height: thickness };
            case 'bottom':
                return { x: x + thickness, y: y + thickness + frontHeight, width: frontWidth, height: thickness };
            default:
                return { x: x + thickness, y: y + thickness, width: frontWidth, height: frontHeight };
        }
    }

    getGeometry(surface, layout) {
        const rect = this.getPhysicalRect(surface, layout);
        const rotation = surface === 'front' ? 0 : this.get(surface).rotation;
        const swapsAxes = rotation === 90 || rotation === 270;
        const localWidth = swapsAxes ? rect.height : rect.width;
        const localHeight = swapsAxes ? rect.width : rect.height;

        let transform;
        switch (rotation) {
            case 90:
                transform = `translate(${rect.x + rect.width} ${rect.y}) rotate(90)`;
                break;
            case 180:
                transform = `translate(${rect.x + rect.width} ${rect.y + rect.height}) rotate(180)`;
                break;
            case 270:
                transform = `translate(${rect.x} ${rect.y + rect.height}) rotate(-90)`;
                break;
            default:
                transform = `translate(${rect.x} ${rect.y})`;
        }

        return { surface, rect, rotation, localWidth, localHeight, transform };
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
            const mainColumnWidth = Math.max(
                main.module,
                (frontWidth - 2 * main.margins * main.module - (main.columns - 1) * main.module) / main.columns
            );
            const availableWidth = Math.max(main.module, localWidthMm - 2 * main.margins * main.module);
            const columns = Math.abs(localWidthMm - frontWidth) < 0.001
                ? main.columns
                : Math.abs(localWidthMm - frontHeight) < 0.001
                    ? main.rows
                    : Math.max(1, Math.floor((availableWidth + main.module) / (mainColumnWidth + main.module)));
            const availableHeightModules = Math.max(1, localHeightMm / main.module - 2 * main.margins);
            const rows = Math.max(1, Math.floor((availableHeightModules + 1) / (main.rowHeight + 1)));
            grid = { ...main, columns, rows };
        }

        const module = finitePositive(grid.module, main.module);
        const maxMargins = Math.max(0, Math.min(localWidthMm, localHeightMm) / (2 * module) - 0.01);
        const margins = Math.min(finiteNonNegative(grid.margins, main.margins), maxMargins);

        return {
            gridModule: module,
            margins,
            columnCount: Math.max(1, Math.round(finitePositive(grid.columns, main.columns))),
            rowCount: Math.max(1, Math.round(finitePositive(grid.rows, main.rows))),
            rowHeight: Math.max(1, Math.round(finitePositive(grid.rowHeight, main.rowHeight))),
            frontWidth: localWidthMm,
            frontHeight: localHeightMm
        };
    }

    globalToLocal(surface, point, layout) {
        const { rect, rotation } = this.getGeometry(surface, layout);
        const px = point.x;
        const py = point.y;
        switch (rotation) {
            case 90:
                return { x: py - rect.y, y: rect.x + rect.width - px };
            case 180:
                return { x: rect.x + rect.width - px, y: rect.y + rect.height - py };
            case 270:
                return { x: rect.y + rect.height - py, y: px - rect.x };
            default:
                return { x: px - rect.x, y: py - rect.y };
        }
    }

    surfaceAtPoint(point, layout) {
        return SURFACE_IDS.find(surface => {
            if (!this.isVisible(surface)) return false;
            const rect = this.getPhysicalRect(surface, layout);
            return point.x >= rect.x && point.x <= rect.x + rect.width &&
                point.y >= rect.y && point.y <= rect.y + rect.height;
        }) || null;
    }
}
