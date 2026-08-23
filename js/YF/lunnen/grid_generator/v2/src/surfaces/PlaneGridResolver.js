/**
 * Resolves the grid a plane is laid out on.
 *
 * A plane either inherits the master grid or owns its own. Inheriting does not
 * mean copying: the master module, margins and row height carry over, while the
 * column and row counts are re-derived from the plane's own size so the module
 * stays the same physical width on every plane of the net.
 *
 * The resolver is pure — it takes the master grid, the plane's grid and the
 * relevant sizes, and returns a grid context. It never reads settings.
 */
const finitePositive = (value, fallback) => (
    Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback
);
const finiteNonNegative = (value, fallback) => (
    Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback
);

/** Tolerance for treating a plane edge as equal to a reference edge, in mm. */
const EDGE_MATCH_TOLERANCE = 0.001;

/**
 * Derives column and row counts for a plane that inherits the master grid.
 *
 * A plane whose width matches a reference edge reuses that edge's count
 * directly, which keeps a rotated wall aligned with the panel it folds from.
 * Any other width fits as many master-width columns as physically fit.
 */
export function resolveInheritedCounts({
    masterGrid,
    planeWidth,
    planeHeight,
    referenceWidth,
    referenceHeight
}) {
    const { module, margins, columns, rows, rowHeight } = masterGrid;
    const masterColumnWidth = Math.max(
        module,
        (referenceWidth - 2 * margins * module - (columns - 1) * module) / columns
    );
    const availableWidth = Math.max(module, planeWidth - 2 * margins * module);
    const resolvedColumns = Math.abs(planeWidth - referenceWidth) < EDGE_MATCH_TOLERANCE
        ? columns
        : Math.abs(planeWidth - referenceHeight) < EDGE_MATCH_TOLERANCE
            ? rows
            : Math.max(1, Math.floor((availableWidth + module) / (masterColumnWidth + module)));
    const availableHeightModules = Math.max(1, planeHeight / module - 2 * margins);

    return {
        columns: resolvedColumns,
        rows: Math.max(1, Math.floor((availableHeightModules + 1) / (rowHeight + 1)))
    };
}

/**
 * Builds the grid context a plane's objects and grid painter work in.
 *
 * `planeWidth` and `planeHeight` are the plane's local content size, already
 * accounting for content rotation, so a 90°-rotated wall reports its long edge
 * as the width its columns run across.
 */
export function resolvePlaneGridContext({
    masterGrid,
    planeGrid = null,
    inherits = true,
    isRoot = false,
    planeWidth,
    planeHeight,
    referenceWidth = planeWidth,
    referenceHeight = planeHeight
}) {
    // The root plane defines the master grid, so it never re-derives counts.
    let grid = masterGrid;
    if (!isRoot && !inherits && planeGrid) {
        grid = planeGrid;
    } else if (!isRoot) {
        grid = {
            ...masterGrid,
            ...resolveInheritedCounts({
                masterGrid,
                planeWidth,
                planeHeight,
                referenceWidth,
                referenceHeight
            })
        };
    }

    const module = finitePositive(grid.module, masterGrid.module);
    const maxMargins = Math.max(0, Math.min(planeWidth, planeHeight) / (2 * module) - 0.01);

    return {
        gridModule: module,
        margins: Math.min(finiteNonNegative(grid.margins, masterGrid.margins), maxMargins),
        columnCount: Math.max(1, Math.round(finitePositive(grid.columns, masterGrid.columns))),
        rowCount: Math.max(1, Math.round(finitePositive(grid.rows, masterGrid.rows))),
        rowHeight: Math.max(1, Math.round(finitePositive(grid.rowHeight, masterGrid.rowHeight))),
        planeWidth,
        planeHeight
    };
}
