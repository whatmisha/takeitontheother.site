/**
 * renderIcon — draws a single key's glyph icon.
 *
 * Placement rules:
 *   - function / special kind: icon is centered in the inner padding box,
 *     unless the key also has a label — then icon goes top-right (label
 *     sits bottom-left).
 *   - char kind: icon goes top-right to avoid colliding with letters.
 *
 * Icon is scaled so its longest bbox side equals `iconSize` (or fits the
 * inner padding box, whichever is smaller).
 *
 *   renderIcon(parent, key, ctx)
 *     parent — SVG group to append to (same group as keys / typography)
 *     key    — layout key (with x/y/w/h and key.icon)
 *     ctx    — {
 *       icons:         dict of icon defs (`{d, bboxMm: {w,h}}`)
 *       iconTransform: transform-builder fn(icon, size, x, y) -> string
 *       padKeyMm:      number
 *       iconSize:      number
 *       fontColor:     string
 *     }
 */

import { el } from './svgHelpers.js';

export function renderIcon(parent, key, ctx) {
    const icon = ctx.icons[key.icon];
    if (!icon) return null;

    const pad       = +ctx.padKeyMm || 0;
    const requested = +ctx.iconSize || 4.0;
    if (requested <= 0) return null;

    const innerW = key.w - pad * 2;
    const innerH = key.h - pad * 2;
    if (innerW <= 0 || innerH <= 0) return null;

    const fit = Math.min(requested, innerW, innerH);
    if (fit <= 0) return null;

    let xMm, yMm;
    const hasLabel = !!(key.label && String(key.label).length > 0);
    if (key.kind === 'char' || hasLabel) {
        // Icon top-right, label (if any) bottom-left.
        xMm = key.x + key.w - pad - fit;
        yMm = key.y + pad;
    } else {
        // Icon centered in inner padding box.
        xMm = key.x + pad + (innerW - fit) / 2;
        yMm = key.y + pad + (innerH - fit) / 2;
    }

    const g = el('g', {
        'class':          'key-icon',
        'transform':      ctx.iconTransform(icon, fit, xMm, yMm),
        'pointer-events': 'none',
        'data-key-id':    key.id,
        'data-icon':      key.icon
    });

    g.appendChild(el('path', {
        d:    icon.d,
        fill: ctx.fontColor || '#e6e7e8'
    }));

    parent.appendChild(g);
    return g;
}
