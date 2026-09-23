export const OBSOLETE_SPARKY_SEED_NAMES = Object.freeze([
    'Basic',
    'Needle Crown',
    'Wide Crown'
]);

/**
 * Remove obsolete shipped presets before force-seeding the current library.
 * User-owned presets with the same names are deliberately preserved. The
 * migration builds a replacement map first, so a failed save leaves the
 * previously persisted library untouched.
 */
export function migrateSparkyPresetLibrary(store) {
    const current = store?.loadAll?.() || {};
    const next = { ...current };
    const removed = [];

    for (const name of OBSOLETE_SPARKY_SEED_NAMES) {
        if (next[name]?.seeded !== true) continue;
        delete next[name];
        removed.push(name);
    }

    if (removed.length === 0) {
        return { ok: true, changed: false, removed };
    }

    if (store?.saveAll?.(next) !== true) {
        return { ok: false, changed: false, removed: [] };
    }

    return { ok: true, changed: true, removed };
}
