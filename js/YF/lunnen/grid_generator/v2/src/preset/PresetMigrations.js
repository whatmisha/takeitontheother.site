import { createPlaneDocumentFromLegacySurfaces } from '../surfaces/PlaneDocumentStore.js';
import { cloneJson as clone } from '../utils/cloneJson.js';

export const CURRENT_PRESET_VERSION = '2.0';
export const LEGACY_PRESET_VERSION = '1.2';

const finitePositive = (value, fallback) => (
    Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback
);
const finiteNonNegative = (value, fallback) => (
    Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback
);

/**
 * The master grid the 1.2 file described, in the shape the plane document needs
 * for its per-plane grid defaults.
 */
function masterGridFrom(grid = {}) {
    return {
        module: finitePositive(grid.module, 5),
        margins: finiteNonNegative(grid.margins, 2),
        columns: Math.max(1, Math.round(finitePositive(grid.columns, 4))),
        rows: Math.max(1, Math.round(finitePositive(grid.rows, 4))),
        rowHeight: Math.max(1, Math.round(finitePositive(grid.rowHeight, 4))),
        marginsUnit: grid.marginsUnit === 'mm' ? 'mm' : 'mod',
        lockedModule: false,
        lockedMargins: false
    };
}

/** Blocks carried a fixed surface id in 1.2; in 2.0 they name a plane. */
function renameSurfaceToPlane(block, rootId) {
    if (!block || typeof block !== 'object') return block;
    const { surface, ...rest } = block;
    return { ...rest, plane: surface || rootId };
}

/**
 * Lifts a 1.2 preset to 2.0.
 *
 * The five fixed surfaces become the plane document for the box cross, keeping
 * each surface's visibility, rotation and grid. Everything else in the file is
 * carried over untouched, so a migrated preset renders exactly as it did.
 */
export function migratePreset12To20(data) {
    const source = clone(data);
    const document = createPlaneDocumentFromLegacySurfaces(
        source.surfaces,
        source.presetName || '',
        masterGridFrom(source.grid)
    );
    if (source.display?.sidePanels === false) {
        document.planes = document.planes.map(plane => (
            plane.id === document.rootId ? plane : { ...plane, visible: false }
        ));
    }

    const { surfaces, ...rest } = source;
    const graphics = rest.graphics || {};
    return {
        ...rest,
        version: CURRENT_PRESET_VERSION,
        net: {
            rootId: document.rootId,
            variables: document.variables,
            planes: document.planes
        },
        texts: (rest.texts || []).map(text => renameSurfaceToPlane(text, document.rootId)),
        graphics: {
            ...graphics,
            blocks: (graphics.blocks || []).map(
                block => renameSurfaceToPlane(block, document.rootId)
            ),
            icons: graphics.icons ? renameSurfaceToPlane(graphics.icons, document.rootId) : null,
            claim: graphics.claim ? renameSurfaceToPlane(graphics.claim, document.rootId) : null,
            ...(graphics.claim2026 === undefined
                ? {}
                : {
                    claim2026: graphics.claim2026
                        ? renameSurfaceToPlane(graphics.claim2026, document.rootId)
                        : null
                })
        }
    };
}

/** Brings any supported preset version up to the current one. */
export function migratePresetToCurrent(data) {
    if (!data || typeof data !== 'object') return data;
    if (data.version === LEGACY_PRESET_VERSION) return migratePreset12To20(data);
    return data;
}
