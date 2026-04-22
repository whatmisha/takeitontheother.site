/**
 * renderGuides — pure renderer for the inner "guide" padding rectangles
 * inside every key (text-safe zones). Controlled by two flags:
 *
 *   showGuides   — draw the overlay in the live preview
 *   exportGuides — include it in the exported SVG
 *
 * If `showGuides` is false but `exportGuides` is true, the group is
 * added to the DOM but marked `data-preview-hidden="true"` + `display: none`.
 * KeyboardLayoutApp._buildExportSvg unhides those before shipping to
 * SVGExporter.
 *
 *   renderGuides(svg, layout, ctx)
 *     ctx: {
 *       showGuides, exportGuides: boolean
 *       padKeyMm: number
 *       radius:   number (key corner radius)
 *     }
 *
 * Returns the created <g id="Guides"> or null when fully hidden.
 */

import { el } from './svgHelpers.js';

export function renderGuides(svg, layout, ctx) {
    const showPreview = !!ctx.showGuides;
    const showExport  = !!ctx.exportGuides;
    if (!showPreview && !showExport) return null;

    const pad = +ctx.padKeyMm || 0;
    if (pad <= 0) return null;

    const g = el('g', {
        id: 'Guides',
        'pointer-events': 'none',
        'data-role':      'guides'
    });

    if (!showPreview && showExport) {
        g.setAttribute('data-preview-hidden', 'true');
        g.style.display = 'none';
    }

    const baseR  = +ctx.radius || 0;
    const innerR = Math.max(0, baseR - pad);

    for (const key of layout.placedKeys) {
        const iw = key.w - pad * 2;
        const ih = key.h - pad * 2;
        if (iw <= 0 || ih <= 0) continue;

        g.appendChild(el('rect', {
            x:      key.x + pad,
            y:      key.y + pad,
            width:  iw,
            height: ih,
            rx:     innerR,
            ry:     innerR,
            fill:   'none',
            stroke: '#4ea1ff',
            'stroke-width':     '0.15',
            'data-row-id':      key.rowId || '',
            'data-object-id':   key.id
        }));
    }
    svg.appendChild(g);
    return g;
}
