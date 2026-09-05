/** The old 480 px crop started at source-space Y=94. Version 2 rebases it to Y=0. */
export const LEGACY_ARTBOARD_Y = 94;
export const COORDINATE_SPACE_VERSION = 2;

export const rebaseLegacyY = (value) => Number(value) - LEGACY_ARTBOARD_Y;

export function migrateCoordinateSpace(source = {}) {
    const migrated = { ...source };
    const sourceVersion = Number(source.coordinateSpaceVersion) || 1;
    if (sourceVersion >= COORDINATE_SPACE_VERSION) return migrated;

    if (Number.isFinite(Number(source.boundaryCenterY))) {
        migrated.boundaryCenterY = rebaseLegacyY(source.boundaryCenterY);
    }
    if (Number.isFinite(Number(source.focusY))) {
        migrated.focusY = rebaseLegacyY(source.focusY);
    }
    migrated.coordinateSpaceVersion = COORDINATE_SPACE_VERSION;
    return migrated;
}
