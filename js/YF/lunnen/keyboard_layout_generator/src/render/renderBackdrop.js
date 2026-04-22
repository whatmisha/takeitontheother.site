/**
 * renderBackdrop — pure renderer for the grey/black background rectangle
 * that sits underneath all keys.
 *
 *   renderBackdrop(svg, layout, ctx)
 *     svg    — the root <svg> element to append to
 *     layout — result of computeLayout() (needs backdropX/Y/W/H)
 *     ctx    — { showBackdrop: boolean, backdropFill: string }
 *
 * Returns the created <g id="Back"> element (or null when hidden).
 */

import { el } from './svgHelpers.js';

export function renderBackdrop(svg, layout, ctx) {
    if (!ctx.showBackdrop) return null;

    const g = el('g', { id: 'Back' });
    g.appendChild(el('rect', {
        x:      layout.backdropX,
        y:      layout.backdropY,
        width:  layout.backdropW,
        height: layout.backdropH,
        fill:   ctx.backdropFill
    }));
    svg.appendChild(g);
    return g;
}
