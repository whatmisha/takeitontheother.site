/**
 * renderSelectionOverlay — dashed outlines around selected keys.
 *
 * Selection outlines live above every other layer so they're always visible,
 * but are marked `data-interactive="true"` so SVGExporter strips them from
 * the exported file.
 *
 *   renderSelectionOverlay(svg, layout, ctx)
 *     ctx: {
 *       primaryId: string | null,
 *       selectedIds: Set<string>,
 *       radius: number
 *     }
 */

import { el } from './svgHelpers.js';

const SELECT_COLOR = '#4ea1ff';
const INSET        = 0.35;

export function renderSelectionOverlay(svg, layout, ctx) {
    const primary = ctx.primaryId;
    const ids     = ctx.selectedIds;
    if (!primary && (!ids || ids.size === 0)) return null;

    const g = el('g', {
        id:                 'Selection',
        'pointer-events':   'none',
        'data-interactive': 'true'
    });

    const r = Math.max(0, (ctx.radius || 0) + INSET);

    const drawOutline = (key, isPrimary) => {
        g.appendChild(el('rect', {
            x:      key.x - INSET,
            y:      key.y - INSET,
            width:  key.w + INSET * 2,
            height: key.h + INSET * 2,
            rx:     r,
            ry:     r,
            fill:   'none',
            stroke: SELECT_COLOR,
            'stroke-width':     isPrimary ? '0.45'      : '0.3',
            'stroke-opacity':   isPrimary ? '1'         : '0.7',
            'stroke-dasharray': isPrimary ? '1.2 0.6'   : '0.6 0.6'
        }));
    };

    // Draw non-primary first so primary outline stays on top.
    if (ids) {
        for (const id of ids) {
            if (id === primary) continue;
            const k = layout.placedKeys.find(kk => kk.id === id);
            if (k) drawOutline(k, false);
        }
    }
    if (primary) {
        const pk = layout.placedKeys.find(k => k.id === primary);
        if (pk) drawOutline(pk, true);
    }

    svg.appendChild(g);
    return g;
}
