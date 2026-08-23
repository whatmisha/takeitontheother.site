/**
 * Vocabulary and normalization for a single plane of a packaging net.
 *
 * A plane owns its own dimensions, its attachment to a parent edge and the
 * rotation of its content. Dimensions are either literal millimetres, the name
 * of a document variable, or `fit` — which means "match the parent edge".
 */
export const PLANE_EDGES = Object.freeze(['left', 'right', 'top', 'bottom']);
export const PLANE_ALIGNMENTS = Object.freeze(['start', 'center', 'end']);
export const PLANE_ROTATIONS = Object.freeze([0, 90, 180, 270]);
export const PLANE_KINDS = Object.freeze(['panel', 'flap', 'glue']);
export const PLANE_GRID_MODES = Object.freeze(['inherit', 'own']);
export const FIT = 'fit';

/**
 * The root plane id of the default box net.
 *
 * Objects with no plane of their own and documents with no explicit root fall
 * back to this, so the literal lives in exactly one place.
 */
export const DEFAULT_ROOT_PLANE_ID = 'front';

/**
 * Content rotations that reproduce the two dieline orientations of the legacy
 * five-surface model.
 */
export const BOX_ROTATION_PROFILES = Object.freeze({
    front: Object.freeze({ front: 0, left: 90, right: 270, top: 180, bottom: 0 }),
    reverse: Object.freeze({ front: 0, left: 270, right: 90, top: 0, bottom: 180 })
});

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function normalizeRotation(value, fallback = 0) {
    const normalized = ((Number(value) % 360) + 360) % 360;
    return PLANE_ROTATIONS.includes(normalized) ? normalized : fallback;
}

/** A dimension is a positive number, a variable name, or the `fit` keyword. */
export function normalizeDimension(value, fallback = FIT) {
    if (value === FIT) return FIT;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === FIT) return FIT;
        return trimmed.length > 0 ? trimmed : fallback;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function normalizeAttachment(value) {
    if (!isPlainObject(value)) return null;
    const to = typeof value.to === 'string' ? value.to.trim() : '';
    if (!to) return null;
    return {
        to,
        edge: PLANE_EDGES.includes(value.edge) ? value.edge : 'right',
        align: PLANE_ALIGNMENTS.includes(value.align) ? value.align : 'start',
        offset: Number.isFinite(Number(value.offset)) ? Number(value.offset) : 0
    };
}

export function normalizePlane(raw, index = 0) {
    const source = isPlainObject(raw) ? raw : {};
    const id = typeof source.id === 'string' && source.id.trim()
        ? source.id.trim()
        : `plane-${index + 1}`;
    const size = isPlainObject(source.size) ? source.size : {};
    const grid = isPlainObject(source.grid) ? source.grid : {};

    return {
        id,
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : id,
        kind: PLANE_KINDS.includes(source.kind) ? source.kind : 'panel',
        size: {
            width: normalizeDimension(size.width),
            height: normalizeDimension(size.height)
        },
        attach: normalizeAttachment(source.attach),
        contentRotation: normalizeRotation(source.contentRotation),
        grid: {
            mode: PLANE_GRID_MODES.includes(grid.mode) ? grid.mode : 'inherit',
            ...(isPlainObject(grid.own) ? { own: { ...grid.own } } : {})
        },
        visible: source.visible !== false
    };
}

/**
 * Builds the five-plane cross that the legacy surface model described
 * implicitly: a root panel with one panel attached to each of its edges.
 */
export function createBoxNet({ width, height, depth, profile = 'front' } = {}) {
    const rotations = BOX_ROTATION_PROFILES[profile] || BOX_ROTATION_PROFILES.front;
    const sides = [
        { id: 'left', name: 'Left', edge: 'left', size: { width: 'D', height: FIT } },
        { id: 'right', name: 'Right', edge: 'right', size: { width: 'D', height: FIT } },
        { id: 'top', name: 'Top', edge: 'top', size: { width: FIT, height: 'D' } },
        { id: 'bottom', name: 'Bottom', edge: 'bottom', size: { width: FIT, height: 'D' } }
    ];

    return {
        rootId: DEFAULT_ROOT_PLANE_ID,
        variables: { W: width, H: height, D: depth },
        planes: [
            normalizePlane({
                id: DEFAULT_ROOT_PLANE_ID,
                name: 'Front',
                size: { width: 'W', height: 'H' },
                attach: null,
                contentRotation: rotations.front,
                grid: { mode: 'inherit' }
            }),
            ...sides.map(side => normalizePlane({
                id: side.id,
                name: side.name,
                size: side.size,
                attach: {
                    to: DEFAULT_ROOT_PLANE_ID, edge: side.edge, align: 'start', offset: 0
                },
                contentRotation: rotations[side.id],
                grid: { mode: 'inherit' }
            }))
        ]
    };
}
