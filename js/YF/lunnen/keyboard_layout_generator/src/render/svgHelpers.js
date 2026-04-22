/**
 * svgHelpers.js — tiny DOM helpers for building SVG trees.
 *
 * Keeping them in one place (instead of spelling out `createElementNS` plus
 * a dozen `setAttribute`s inline) makes render modules noticeably easier to
 * read and consistent in their attribute order.
 */

export const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an SVG element and optionally bulk-set attributes.
 *
 *   el('rect', { x: 0, y: 0, width: 10, height: 10 });
 *
 * Keys with `undefined` or `null` values are skipped so callers can pass
 * optional attrs unconditionally.
 */
export function el(tag, attrs = null) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) setAttrs(node, attrs);
    return node;
}

/** Apply a plain object of attributes to an existing node. */
export function setAttrs(node, attrs) {
    for (const key in attrs) {
        const v = attrs[key];
        if (v == null) continue;
        node.setAttribute(key, v);
    }
    return node;
}
