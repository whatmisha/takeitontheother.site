/**
 * ProjectSerializer — import/export the full tool state as JSON.
 *
 * A project bundles the structural spec, the optional hand-edited matrix override,
 * and the visual render options. It is the canonical on-disk format and is also
 * what presets store. Versioned so future formats (e.g. graph-based threads) can
 * be migrated rather than rejected.
 */

import { normalizeSpec } from './PatternSpec.js';

export const PROJECT_VERSION = 2;

/**
 * Build a plain, JSON-serialisable project object.
 * @param {Object} params
 * @param {Object} params.spec            structural parameters
 * @param {Object} [params.render]        visual options (colours, thickness, tiling)
 * @param {number[][]|null} [params.matrix] hand-edited rapport override, or null
 * @returns {Object}
 */
export function serialize({ spec, render = {}, matrix = null } = {}) {
    const project = {
        type: 'techstyler.weave',
        version: PROJECT_VERSION,
        spec: normalizeSpec(spec),
        render: { ...render }
    };
    if (Array.isArray(matrix) && matrix.length) {
        project.matrix = matrix.map((row) => row.slice());
    }
    return project;
}

/** Serialize to a pretty JSON string. */
export function toJSON(state, space = 2) {
    return JSON.stringify(serialize(state), null, space);
}

/**
 * Parse a project from an object or JSON string. Tolerant: unknown/missing fields
 * fall back to normalised defaults so a partial file still loads.
 * @param {Object|string} input
 * @returns {{version:number, spec:Object, render:Object, matrix:(number[][]|null)}}
 */
export function deserialize(input) {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    if (!data || typeof data !== 'object') {
        throw new Error('ProjectSerializer: invalid project (not an object).');
    }
    const version = Number(data.version) || PROJECT_VERSION;
    const spec = normalizeSpec(data.spec || {});
    const render = (data.render && typeof data.render === 'object') ? { ...data.render } : {};
    let matrix = null;
    if (Array.isArray(data.matrix) && data.matrix.length && Array.isArray(data.matrix[0])) {
        matrix = data.matrix.map((row) => row.map((v) => (v ? 1 : 0)));
    }
    return { version, spec, render, matrix };
}

/** Parse from a JSON string (throws on malformed JSON). */
export function fromJSON(text) {
    return deserialize(text);
}
