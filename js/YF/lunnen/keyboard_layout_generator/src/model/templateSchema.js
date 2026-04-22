/**
 * templateSchema.js  declarative validation for layout templates.
 *
 * The generator stores everything in `Settings.template`:
 *
 *   Template {
 *     rows:          Row[]                // required, >= 1 entry
 *     hasAdditional: boolean              // optional
 *     numpad:        Numpad | undefined   // optional
 *   }
 *   Row {
 *     id:            string               // required, unique across rows
 *     isFnRow:       boolean              // optional
 *     keys:          Key[]                // required, >= 1 entry
 *     arrowCluster:  [left, up, down, right]? // optional, exactly 4 keys
 *     additionalKey: Key?                 // optional
 *   }
 *   Numpad { cols?: number, gapX?: number, keys: NumpadKey[] }
 *   NumpadKey extends Key { col: number, row: number, colSpan?, rowSpan? }
 *   Key {
 *     id:    string                       // required, globally unique
 *     kind?: 'char' | 'special' | 'function' | 'arrow'
 *     label?: string
 *     icon?:  string
 *     chars?: { base?, shift?, ru?, ruShift? }
 *     w?:     number  (ratio; default 1)
 *     wMm?:   number  (mm; absolute override)
 *     hMm?:   number  (mm; absolute override)
 *   }
 *
 * validateTemplate(raw) throws a descriptive Error on the first problem it
 * finds, or returns the sanitized template unchanged. It does NOT clone, mutate,
 * or fill defaults  just structural checks. `strictIdUnique: false` disables
 * the cross-tree id-uniqueness check (useful during hand-editing).
 */

const KEY_KINDS = new Set([
    'char', 'special', 'function',
    'arrow', 'arrow-half',
    undefined, null
]);

/* --------------------------------------------------------------------- */
/*  Public API                                                           */
/* --------------------------------------------------------------------- */

/**
 * Validate a template. Throws on the first structural violation; otherwise
 * returns the same object back.
 *
 * @param  {unknown} raw
 * @param  {{strictIdUnique?: boolean}} [opts]
 * @returns {object} the original `raw` (after narrow validation)
 */
export function validateTemplate(raw, { strictIdUnique = true } = {}) {
    if (!raw || typeof raw !== 'object') {
        throw new TemplateError('template must be an object', '');
    }
    if (!Array.isArray(raw.rows)) {
        throw new TemplateError('template.rows must be an array', 'rows');
    }
    if (raw.rows.length === 0) {
        throw new TemplateError('template.rows must contain at least one row', 'rows');
    }

    const rowIds = new Set();
    const keyIds = new Set();

    raw.rows.forEach((row, i) => {
        validateRow(row, `rows[${i}]`, rowIds, keyIds, strictIdUnique);
    });

    if (raw.numpad != null) {
        validateNumpad(raw.numpad, 'numpad', keyIds, strictIdUnique);
    }

    if (raw.hasAdditional != null && typeof raw.hasAdditional !== 'boolean') {
        throw new TemplateError('template.hasAdditional must be boolean', 'hasAdditional');
    }

    return raw;
}

/**
 * Returns `{valid: true, template}` or `{valid: false, error, path}` instead
 * of throwing. Handy for UI layers that want to show a toast on error.
 */
export function tryValidateTemplate(raw, opts) {
    try {
        const t = validateTemplate(raw, opts);
        return { valid: true, template: t };
    } catch (e) {
        return {
            valid: false,
            error: e?.message ?? String(e),
            path:  e?.path ?? ''
        };
    }
}

/* --------------------------------------------------------------------- */
/*  Internals                                                            */
/* --------------------------------------------------------------------- */

class TemplateError extends Error {
    constructor(message, path) {
        super(path ? `${message} (at ${path})` : message);
        this.name = 'TemplateError';
        this.path = path;
    }
}

function validateRow(row, path, rowIds, keyIds, strict) {
    if (!row || typeof row !== 'object') {
        throw new TemplateError('row must be an object', path);
    }
    if (typeof row.id !== 'string' || row.id.length === 0) {
        throw new TemplateError('row.id must be a non-empty string', `${path}.id`);
    }
    if (rowIds.has(row.id)) {
        throw new TemplateError(`duplicate row id "${row.id}"`, `${path}.id`);
    }
    rowIds.add(row.id);

    if (row.isFnRow != null && typeof row.isFnRow !== 'boolean') {
        throw new TemplateError('row.isFnRow must be boolean', `${path}.isFnRow`);
    }
    if (!Array.isArray(row.keys)) {
        throw new TemplateError('row.keys must be an array', `${path}.keys`);
    }
    if (row.keys.length === 0) {
        throw new TemplateError('row.keys must contain at least one key', `${path}.keys`);
    }
    row.keys.forEach((k, i) => validateKey(k, `${path}.keys[${i}]`, keyIds, strict));

    if (row.arrowCluster != null) {
        if (!Array.isArray(row.arrowCluster) || row.arrowCluster.length !== 4) {
            throw new TemplateError(
                'row.arrowCluster must be an array of exactly 4 keys',
                `${path}.arrowCluster`
            );
        }
        row.arrowCluster.forEach((k, i) =>
            validateKey(k, `${path}.arrowCluster[${i}]`, keyIds, strict)
        );
    }

    if (row.additionalKey != null) {
        validateKey(row.additionalKey, `${path}.additionalKey`, keyIds, strict);
    }
}

function validateNumpad(np, path, keyIds, strict) {
    if (typeof np !== 'object') {
        throw new TemplateError('numpad must be an object', path);
    }
    if (np.cols != null && !(isFinite(+np.cols) && +np.cols > 0)) {
        throw new TemplateError('numpad.cols must be a positive number', `${path}.cols`);
    }
    if (np.gapX != null && !(isFinite(+np.gapX) && +np.gapX >= 0)) {
        throw new TemplateError('numpad.gapX must be >= 0', `${path}.gapX`);
    }
    if (!Array.isArray(np.keys)) {
        throw new TemplateError('numpad.keys must be an array', `${path}.keys`);
    }
    np.keys.forEach((k, i) => {
        validateKey(k, `${path}.keys[${i}]`, keyIds, strict);
        if (!isFinite(+k.col) || +k.col < 0) {
            throw new TemplateError('numpad key.col must be >= 0', `${path}.keys[${i}].col`);
        }
        if (!isFinite(+k.row) || +k.row < 0) {
            throw new TemplateError('numpad key.row must be >= 0', `${path}.keys[${i}].row`);
        }
        if (k.colSpan != null && !(isFinite(+k.colSpan) && +k.colSpan >= 1)) {
            throw new TemplateError('numpad key.colSpan must be >= 1', `${path}.keys[${i}].colSpan`);
        }
        if (k.rowSpan != null && !(isFinite(+k.rowSpan) && +k.rowSpan >= 1)) {
            throw new TemplateError('numpad key.rowSpan must be >= 1', `${path}.keys[${i}].rowSpan`);
        }
    });
}

function validateKey(key, path, keyIds, strict) {
    if (!key || typeof key !== 'object') {
        throw new TemplateError('key must be an object', path);
    }
    if (typeof key.id !== 'string' || key.id.length === 0) {
        throw new TemplateError('key.id must be a non-empty string', `${path}.id`);
    }
    if (strict && keyIds.has(key.id)) {
        throw new TemplateError(`duplicate key id "${key.id}"`, `${path}.id`);
    }
    keyIds.add(key.id);

    if (key.kind !== undefined && !KEY_KINDS.has(key.kind)) {
        throw new TemplateError(
            `key.kind must be one of char | special | function | arrow (got "${key.kind}")`,
            `${path}.kind`
        );
    }
    if (key.label !== undefined && typeof key.label !== 'string') {
        throw new TemplateError('key.label must be a string', `${path}.label`);
    }
    if (key.icon !== undefined && typeof key.icon !== 'string') {
        throw new TemplateError('key.icon must be a string', `${path}.icon`);
    }
    if (key.chars !== undefined) {
        if (typeof key.chars !== 'object' || key.chars === null) {
            throw new TemplateError('key.chars must be an object', `${path}.chars`);
        }
        for (const slot of ['base', 'shift', 'ru', 'ruShift']) {
            if (key.chars[slot] !== undefined && typeof key.chars[slot] !== 'string') {
                throw new TemplateError(
                    `key.chars.${slot} must be a string`,
                    `${path}.chars.${slot}`
                );
            }
        }
    }
    if (key.w != null && !isFinite(+key.w)) {
        throw new TemplateError('key.w must be a finite number', `${path}.w`);
    }
    if (key.wMm != null && !isFinite(+key.wMm)) {
        throw new TemplateError('key.wMm must be a finite number', `${path}.wMm`);
    }
    if (key.hMm != null && !isFinite(+key.hMm)) {
        throw new TemplateError('key.hMm must be a finite number', `${path}.hMm`);
    }

    // Sanitize against prototype-pollution when templates come from JSON.
    // Proto/constructor/prototype keys on parsed JSON are enumerable but
    // should never appear on a real template.
    for (const banned of ['__proto__', 'constructor', 'prototype']) {
        if (Object.prototype.hasOwnProperty.call(key, banned)) {
            throw new TemplateError(
                `key has forbidden field "${banned}"`,
                `${path}.${banned}`
            );
        }
    }
}
