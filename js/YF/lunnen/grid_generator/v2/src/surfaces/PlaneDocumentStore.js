import { cloneJson } from '../utils/cloneJson.js';
import {
    createBoxNet,
    FIT,
    normalizeDimension,
    normalizePlane,
    normalizeRotation,
    PLANE_EDGES
} from './PlaneDefinition.js';
import { resolvePlaneGridContext } from './PlaneGridResolver.js';

/**
 * The net document: the planes of an unfolding, their topology and their grids.
 *
 * The document is the single source of truth for how many planes exist and how
 * they attach to each other. Plane count is not fixed — the five-plane box is
 * just the default document, not a constraint of the model.
 *
 * Dimensions are named variables so several planes can track one measurement.
 * `W`, `H` and `D` are reserved: they mirror the three dimension sliders, which
 * stay authoritative so the existing history and preset plumbing keeps working.
 * Any other variable is owned by the document.
 */
export const RESERVED_VARIABLES = Object.freeze({
    W: 'frontWidth',
    H: 'frontHeight',
    D: 'thickness'
});

/** Grid modes as the plane document spells them. */
export const GRID_MODE_INHERIT = 'inherit';
export const GRID_MODE_OWN = 'own';

const clone = cloneJson;
const finitePositive = (value, fallback) => (
    Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback
);
const finiteNonNegative = (value, fallback) => (
    Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback
);

/** Chooses the profile that reproduces a legacy preset's side rotations. */
export function getPresetOrientationProfile(presetName = '') {
    const name = String(presetName).trim();
    return /^\+?\s*New(?:\b|$)/i.test(name) || /Front/i.test(name) ? 'front' : 'reverse';
}

export function normalizeGrid(grid = {}, fallback) {
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

export function defaultOwnGrid(masterGrid) {
    return {
        module: finitePositive(masterGrid.module, 5),
        margins: finiteNonNegative(masterGrid.margins, 2),
        columns: Math.max(1, Math.round(finitePositive(masterGrid.columns, 4))),
        rows: Math.max(1, Math.round(finitePositive(masterGrid.rows, 4))),
        rowHeight: Math.max(1, Math.round(finitePositive(masterGrid.rowHeight, 4))),
        marginsUnit: 'mod',
        lockedModule: false,
        lockedMargins: false
    };
}

/** Makes an id that reads well in the UI and does not collide. */
function uniquePlaneId(taken, base = 'plane') {
    const slug = String(base).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        || 'plane';
    if (!taken.has(slug)) return slug;
    let index = 2;
    while (taken.has(`${slug}-${index}`)) index += 1;
    return `${slug}-${index}`;
}

/**
 * Builds the default document: the five-plane box cross, with side rotations
 * chosen by the preset's dieline orientation.
 */
export function createBoxPlaneDocument(presetName = '', masterGrid) {
    const net = createBoxNet({
        width: 'W',
        height: 'H',
        depth: 'D',
        profile: getPresetOrientationProfile(presetName)
    });
    const ownGrid = defaultOwnGrid(masterGrid);
    return {
        rootId: net.rootId,
        variables: {},
        planes: net.planes.map(plane => ({
            ...plane,
            grid: { mode: GRID_MODE_INHERIT, own: clone(ownGrid) }
        }))
    };
}

/**
 * Folds a legacy five-surface map into a plane document.
 *
 * Legacy state only carried visibility, rotation, grid mode and an own grid per
 * fixed surface id, so everything else comes from the default box.
 */
export function createPlaneDocumentFromLegacySurfaces(surfaceSettings, presetName = '', masterGrid) {
    const document = createBoxPlaneDocument(presetName, masterGrid);
    const source = surfaceSettings && typeof surfaceSettings === 'object' ? surfaceSettings : {};
    document.planes = document.planes.map(plane => {
        const legacy = source[plane.id] && typeof source[plane.id] === 'object'
            ? source[plane.id]
            : {};
        const isRoot = plane.id === document.rootId;
        const ownsGrid = legacy.gridMode === GRID_MODE_OWN || legacy.ownGrid === true;
        return {
            ...plane,
            visible: isRoot || legacy.visible !== false,
            contentRotation: isRoot ? 0 : normalizeRotation(legacy.rotation, plane.contentRotation),
            grid: {
                mode: !isRoot && ownsGrid ? GRID_MODE_OWN : GRID_MODE_INHERIT,
                own: normalizeGrid(legacy.grid, plane.grid.own)
            }
        };
    });
    return document;
}

export class PlaneDocumentStore {
    constructor(settings) {
        this.settings = settings;
    }

    // --- master grid and variables -------------------------------------------

    getMasterGrid() {
        return {
            module: finitePositive(this.settings.get('gridModule'), 1),
            margins: finiteNonNegative(this.settings.get('margins'), 0),
            columns: Math.max(1, Math.round(finitePositive(this.settings.get('columnCount'), 1))),
            rows: Math.max(1, Math.round(finitePositive(this.settings.get('rowCount'), 1))),
            rowHeight: Math.max(1, Math.round(finitePositive(this.settings.get('rowHeight'), 1)))
        };
    }

    /**
     * Reserved variables read through to the dimension sliders so the document
     * cannot drift out of sync with the controls that drive them.
     */
    getVariables() {
        const custom = this.getDocument().variables || {};
        const reserved = {};
        for (const [name, settingKey] of Object.entries(RESERVED_VARIABLES)) {
            reserved[name] = finitePositive(this.settings.get(settingKey), 0);
        }
        return { ...custom, ...reserved };
    }

    setVariable(name, value) {
        const settingKey = RESERVED_VARIABLES[name];
        if (settingKey) {
            this.settings.set(settingKey, Number(value));
            return this.getVariables();
        }
        const document = clone(this.getDocument());
        document.variables = { ...document.variables, [name]: Number(value) };
        this.write(document);
        return this.getVariables();
    }

    removeVariable(name) {
        if (RESERVED_VARIABLES[name]) return false;
        const document = clone(this.getDocument());
        if (!(name in (document.variables || {}))) return false;
        delete document.variables[name];
        this.write(document);
        return true;
    }

    // --- document lifecycle ---------------------------------------------------

    createDefaultDocument(presetName = '') {
        return createBoxPlaneDocument(presetName, this.getMasterGrid());
    }

    fromLegacySurfaceSettings(surfaceSettings, presetName = '') {
        return createPlaneDocumentFromLegacySurfaces(
            surfaceSettings,
            presetName,
            this.getMasterGrid()
        );
    }

    normalize(raw, presetName = '') {
        // A legacy five-key surface map is still a valid input here.
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && !Array.isArray(raw.planes)) {
            return this.fromLegacySurfaceSettings(raw, presetName);
        }

        const fallback = this.createDefaultDocument(presetName);
        if (!raw || !Array.isArray(raw.planes) || raw.planes.length === 0) return fallback;

        const ownGrid = defaultOwnGrid(this.getMasterGrid());
        const seen = new Set();
        const planes = [];
        raw.planes.forEach((entry, index) => {
            const plane = normalizePlane(entry, index);
            if (seen.has(plane.id)) return;
            seen.add(plane.id);
            planes.push({
                ...plane,
                grid: {
                    mode: plane.grid.mode === GRID_MODE_OWN ? GRID_MODE_OWN : GRID_MODE_INHERIT,
                    own: normalizeGrid(plane.grid.own, ownGrid)
                }
            });
        });

        const rootId = planes.some(plane => plane.id === raw.rootId)
            ? raw.rootId
            : (planes.find(plane => !plane.attach) || planes[0]).id;

        // An attachment pointing at a plane that did not survive normalization
        // would detach the plane from the net, so it falls back to the root.
        const ids = new Set(planes.map(plane => plane.id));
        return {
            rootId,
            variables: raw.variables && typeof raw.variables === 'object' ? { ...raw.variables } : {},
            planes: planes.map(plane => (
                plane.id === rootId
                    ? { ...plane, attach: null }
                    : {
                        ...plane,
                        attach: plane.attach && ids.has(plane.attach.to)
                            ? plane.attach
                            : { to: rootId, edge: 'right', align: 'start', offset: 0 }
                    }
            ))
        };
    }

    initialize(presetName = '', explicitState) {
        const document = this.normalize(explicitState, presetName);
        if (!explicitState && this.settings.get('showSidePanels') === false) {
            document.planes = document.planes.map(plane => (
                plane.id === document.rootId ? plane : { ...plane, visible: false }
            ));
        }
        this.write(document, true);
        return document;
    }

    getDocument() {
        return this.settings.get('planeDocument') || this.initialize('');
    }

    /**
     * Persists the document and refreshes the master visibility toggle, which
     * the display panel and the export path still read as a single flag.
     */
    write(document, silent = false) {
        // The revision lets consumers cache derived layouts without hashing the
        // whole document on every pointer probe.
        document.revision = (Number(this.settings.get('planeDocument')?.revision) || 0) + 1;
        this.settings.set('planeDocument', document, silent);
        this.settings.set(
            'showSidePanels',
            document.planes.some(plane => plane.id !== document.rootId && plane.visible !== false),
            true
        );
        return document;
    }

    // --- plane access --------------------------------------------------------

    getRootId() {
        return this.getDocument().rootId;
    }

    /** Planes in document order, which is also the order they are painted in. */
    getPlanes() {
        return this.getDocument().planes;
    }

    getPlaneIds() {
        return this.getPlanes().map(plane => plane.id);
    }

    has(planeId) {
        return this.getPlanes().some(plane => plane.id === planeId);
    }

    /** Unknown ids resolve to the root so a stale reference cannot crash a render. */
    getPlane(planeId) {
        const document = this.getDocument();
        return document.planes.find(plane => plane.id === planeId)
            || document.planes.find(plane => plane.id === document.rootId)
            || document.planes[0];
    }

    isRoot(planeId) {
        return planeId === this.getRootId();
    }

    isVisible(planeId) {
        if (this.isRoot(planeId)) return true;
        return this.settings.get('showSidePanels') !== false
            && this.getPlane(planeId).visible !== false;
    }

    getChildren(planeId) {
        return this.getPlanes().filter(plane => plane.attach?.to === planeId);
    }

    /** Every plane reachable from the given one, the plane itself included. */
    getSubtree(planeId) {
        const collected = [];
        const queue = [planeId];
        while (queue.length > 0) {
            const id = queue.shift();
            if (collected.includes(id)) continue;
            collected.push(id);
            queue.push(...this.getChildren(id).map(plane => plane.id));
        }
        return collected;
    }

    // --- plane mutation ------------------------------------------------------

    update(planeId, patch = {}) {
        const document = clone(this.getDocument());
        const plane = document.planes.find(entry => entry.id === planeId);
        if (!plane) return this.getPlane(planeId);
        const isRoot = plane.id === document.rootId;

        if ('visible' in patch && !isRoot) plane.visible = patch.visible !== false;
        if ('name' in patch && String(patch.name).trim()) plane.name = String(patch.name).trim();
        if ('kind' in patch) plane.kind = normalizePlane({ ...plane, kind: patch.kind }).kind;
        if ('contentRotation' in patch) {
            plane.contentRotation = normalizeRotation(patch.contentRotation, plane.contentRotation);
        }
        if ('size' in patch && patch.size && typeof patch.size === 'object') {
            if ('width' in patch.size) {
                plane.size.width = normalizeDimension(patch.size.width, plane.size.width);
            }
            if ('height' in patch.size) {
                plane.size.height = normalizeDimension(patch.size.height, plane.size.height);
            }
        }
        if ('attach' in patch && !isRoot) {
            const attach = patch.attach && typeof patch.attach === 'object' ? patch.attach : {};
            const to = document.planes.some(entry => entry.id === attach.to)
                ? attach.to
                : plane.attach?.to || document.rootId;
            plane.attach = {
                to,
                edge: PLANE_EDGES.includes(attach.edge) ? attach.edge : plane.attach?.edge || 'right',
                align: ['start', 'center', 'end'].includes(attach.align)
                    ? attach.align
                    : plane.attach?.align || 'start',
                offset: Number.isFinite(Number(attach.offset))
                    ? Number(attach.offset)
                    : plane.attach?.offset || 0
            };
        }
        if ('gridMode' in patch && !isRoot) {
            plane.grid.mode = patch.gridMode === GRID_MODE_OWN ? GRID_MODE_OWN : GRID_MODE_INHERIT;
        }
        if (patch.grid && typeof patch.grid === 'object') {
            plane.grid.own = normalizeGrid(patch.grid, plane.grid.own);
        }

        this.write(document);
        return plane;
    }

    /**
     * Adds a plane attached to an existing one.
     *
     * The new plane fits the edge it folds from and is a depth-sized strip
     * across it, which is the shape a wall or a flap almost always has.
     */
    addPlane({
        name = 'Panel',
        parentId = this.getRootId(),
        edge = 'right',
        kind = 'panel',
        size = null,
        align = 'start',
        offset = 0,
        contentRotation = 0
    } = {}) {
        const document = clone(this.getDocument());
        if (!document.planes.some(plane => plane.id === parentId)) return null;

        const runsVertically = edge === 'left' || edge === 'right';
        const plane = normalizePlane({
            id: uniquePlaneId(new Set(document.planes.map(entry => entry.id)), name),
            name,
            kind,
            size: size || (runsVertically
                ? { width: 'D', height: FIT }
                : { width: FIT, height: 'D' }),
            attach: { to: parentId, edge, align, offset },
            contentRotation,
            grid: { mode: GRID_MODE_INHERIT }
        });
        plane.grid.own = defaultOwnGrid(this.getMasterGrid());

        document.planes.push(plane);
        this.write(document);
        return plane;
    }

    /**
     * Removes a plane and everything folded onto it.
     *
     * Children cannot survive their parent: their position is defined by an
     * edge that no longer exists. The removed ids are returned so callers can
     * decide what to do with the objects that lived on them.
     */
    removePlane(planeId) {
        const document = clone(this.getDocument());
        if (planeId === document.rootId) return [];
        if (!document.planes.some(plane => plane.id === planeId)) return [];

        const removed = this.getSubtree(planeId);
        document.planes = document.planes.filter(plane => !removed.includes(plane.id));
        this.write(document);
        return removed;
    }

    /** Moves a plane within the document order, which reorders painting. */
    reorderPlane(planeId, targetIndex) {
        const document = clone(this.getDocument());
        const from = document.planes.findIndex(plane => plane.id === planeId);
        if (from === -1) return false;
        const to = Math.max(0, Math.min(document.planes.length - 1, Math.round(targetIndex)));
        if (from === to) return false;
        const [plane] = document.planes.splice(from, 1);
        document.planes.splice(to, 0, plane);
        this.write(document);
        return true;
    }

    setAllSideVisibility(visible) {
        const document = clone(this.getDocument());
        document.planes = document.planes.map(plane => (
            plane.id === document.rootId ? plane : { ...plane, visible: Boolean(visible) }
        ));
        this.write(document);
        this.settings.set('showSidePanels', Boolean(visible));
        return document;
    }

    // --- grid ---------------------------------------------------------------

    getGridContext(planeId, planeWidthMm, planeHeightMm) {
        const plane = this.getPlane(planeId);
        const variables = this.getVariables();
        return resolvePlaneGridContext({
            masterGrid: this.getMasterGrid(),
            planeGrid: plane.grid.own,
            inherits: plane.grid.mode !== GRID_MODE_OWN,
            isRoot: plane.id === this.getRootId(),
            planeWidth: planeWidthMm,
            planeHeight: planeHeightMm,
            referenceWidth: finitePositive(variables.W, planeWidthMm),
            referenceHeight: finitePositive(variables.H, planeHeightMm)
        });
    }
}
