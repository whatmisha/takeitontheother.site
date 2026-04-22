/**
 * templateOps.js  pure operations on keyboard templates.
 *
 * Every function is side-effect-free: callers decide whether to mutate a
 * clone (then `commitTemplate` the result) or work on a live reference.
 *
 * The template shape is documented in `templateSchema.js`. Briefly:
 *   template.rows[i].keys               ordered list of keys
 *   template.rows[i].arrowCluster[4]    optional 4-element arrow cluster
 *   template.rows[i].additionalKey      optional trailing key
 *   template.numpad.keys                grid-positioned numpad keys
 *
 * The reason these live outside KeyboardLayoutApp is so tests (and future
 * import/export tools, CLI linters, etc.) can reuse them without pulling in
 * the DOM, the YF framework, or the layout engine.
 */

/* --------------------------------------------------------------------- */
/*  Basics                                                               */
/* --------------------------------------------------------------------- */

/** Deep clone via structured-clone-ish JSON roundtrip (sufficient for
 *  plain-data templates with no Dates / Maps / cyclic refs).            */
export function cloneTemplate(template) {
    return template == null ? template : JSON.parse(JSON.stringify(template));
}

/* --------------------------------------------------------------------- */
/*  Lookups                                                              */
/* --------------------------------------------------------------------- */

/**
 * Locate a key anywhere in the template.
 *
 * @returns {{key, row, list, index} | null}
 *   list   the array the key belongs to (row.keys | row.arrowCluster |
 *           template.numpad.keys). null for additionalKey.
 *   index  position within `list`. -1 for additionalKey.
 */
export function findKeyInTemplate(template, keyId) {
    if (!template?.rows) return null;
    for (const row of template.rows) {
        if (Array.isArray(row.keys)) {
            const i = row.keys.findIndex(k => k.id === keyId);
            if (i !== -1) return { key: row.keys[i], row, list: row.keys, index: i };
        }
        if (Array.isArray(row.arrowCluster)) {
            const i = row.arrowCluster.findIndex(k => k.id === keyId);
            if (i !== -1) return { key: row.arrowCluster[i], row, list: row.arrowCluster, index: i };
        }
        if (row.additionalKey && row.additionalKey.id === keyId) {
            return { key: row.additionalKey, row, list: null, index: -1 };
        }
    }
    if (template.numpad && Array.isArray(template.numpad.keys)) {
        const list = template.numpad.keys;
        const i = list.findIndex(k => k.id === keyId);
        if (i !== -1) {
            return { key: list[i], row: { id: 'numpad', keys: list }, list, index: i };
        }
    }
    return null;
}

/** Locate a row by id (returns the live reference, not a copy). */
export function findRow(template, rowId) {
    return template?.rows?.find(r => r.id === rowId) ?? null;
}

/* --------------------------------------------------------------------- */
/*  Unique-id helpers                                                    */
/* --------------------------------------------------------------------- */

/**
 * Collect every key id present anywhere in the template. Covers rows.keys,
 * rows.arrowCluster, rows.additionalKey AND numpad.keys so callers never miss
 * a sub-tree when generating new ids.
 */
export function collectKeyIds(template) {
    const out = new Set();
    for (const row of template?.rows || []) {
        for (const k of row.keys || [])         out.add(k.id);
        for (const k of row.arrowCluster || []) out.add(k.id);
        if (row.additionalKey) out.add(row.additionalKey.id);
    }
    if (template?.numpad && Array.isArray(template.numpad.keys)) {
        for (const k of template.numpad.keys) if (k?.id) out.add(k.id);
    }
    return out;
}

export function collectRowIds(template) {
    return new Set((template?.rows || []).map(r => r.id));
}

/**
 * Produce an id not already present in `existing`.
 * Pattern: base, base_copy, base_copy2, base_copy3, 
 *
 * `existing` may be a Set OR an array (convenience for ad-hoc callers).
 */
export function uniqueKeyId(existing, base) {
    const has = existing instanceof Set
        ? (id) => existing.has(id)
        : (id) => existing.includes(id);
    const seed = String(base || 'key').replace(/_copy\d*$/, '');
    let candidate = `${seed}_copy`;
    let i = 1;
    while (has(candidate)) {
        i += 1;
        candidate = `${seed}_copy${i}`;
    }
    return candidate;
}

export function uniqueRowId(existing, base) {
    const has = existing instanceof Set
        ? (id) => existing.has(id)
        : (id) => existing.includes(id);
    const seed = String(base || 'row');
    let candidate = seed;
    let i = 1;
    while (has(candidate)) {
        i += 1;
        candidate = `${seed}${i}`;
    }
    return candidate;
}

/* --------------------------------------------------------------------- */
/*  Introspection                                                        */
/* --------------------------------------------------------------------- */

/** True if the key sits in a simple row.keys array (not arrow cluster /
 *  additional / numpad). Simple keys are the only ones that support
 *  drag-reorder within a row today. */
export function isSimpleRowKey(template, keyId) {
    const found = findKeyInTemplate(template, keyId);
    if (!found) return false;
    return found.list === found.row?.keys;
}
