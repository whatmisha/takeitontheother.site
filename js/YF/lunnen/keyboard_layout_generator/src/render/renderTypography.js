/**
 * renderTypography ù on-key text (labels + multi-language chars).
 *
 * Placement rules:
 *   - `kind: special | function` with `label`: small label at bottom-left (unchanged).
 *   - `kind: char` with both languages on: classic 4-corner (Lat left, Cyr right)
 *     with right column at `rightX`, `text-anchor: end` and `text-align: right` in
 *     `style` so apps like Adobe Illustrator show Align Right for exported live text.
 *   - `kind: char` with only one language (`showLatin` xor `showCyrillic`):
 *     glyphs are centered in the inner (padded) box, not tucked in a corner.
 *
 * Icons are drawn first; `arrow-half` keys get icon-only treatment.
 *
 *   renderTypography(parent, key, ctx)
 */

import { el }         from './svgHelpers.js';
import { renderIcon } from './renderIcon.js';

const FONT_FAMILY = 'YSText-Regular, YS Text, sans-serif';
const DEFAULT_FG  = '#e6e7e8';

export function renderTypography(parent, key, ctx) {
    if (key.kind === 'spacer') return;

    if (key.icon) renderIcon(parent, key, ctx);
    if (key.kind === 'arrow-half') return;

    const pad       = +ctx.padKeyMm || 0;
    const sizeChar  = +ctx.fontChar  || 5;
    const sizeShift = +ctx.fontShift || 4;
    const sizeLabel = +ctx.fontLabel || 3;

    if (key.w < pad * 2 || key.h < pad * 2) return;

    const leftX   = key.x + pad;
    const rightX  = key.x + key.w  - pad;
    const topY    = key.y + pad;
    const bottomY = key.y + key.h - pad;
    const midX    = (leftX + rightX) / 2;
    const midY    = (topY + bottomY) / 2;
    const innerH  = bottomY - topY;
    const fill    = ctx.fontColor || DEFAULT_FG;

    const showLat = ctx.showLatin    !== false;
    const showCyr = ctx.showCyrillic !== false;
    const both    = showLat && showCyr;
    const oneLang = showLat !== showCyr;

    /** Maps SVG `text-anchor` to CSS `text-align` for vector apps (e.g. Illustrator). */
    const textAlignForExport = (anchor) => {
        if (anchor === 'end') return 'right';
        if (anchor === 'middle') return 'center';
        return 'left';
    };

    const draw = (text, { x, y, size, anchor, baseline }) => {
        if (text === '' || text == null) return;
        const t = el('text', {
            'class':             'key-text',
            x, y,
            'font-size':         size.toFixed(2),
            'font-family':       FONT_FAMILY,
            fill,
            'text-anchor':       anchor,
            style:               `text-align: ${textAlignForExport(anchor)};`,
            'dominant-baseline': baseline,
            'pointer-events':    'none',
            'data-key-id':       key.id
        });
        t.textContent = String(text);
        parent.appendChild(t);
    };

    if (key.kind === 'char' && key.chars) {
        const { base, shift, ru, ruShift } = key.chars;

        if (shift != null) {
            // Number / punctuation row.
            if (both) {
                draw(shift,   { x: leftX,  y: topY,    size: sizeShift, anchor: 'start', baseline: 'hanging' });
                draw(base,    { x: leftX,  y: bottomY, size: sizeChar,  anchor: 'start', baseline: 'alphabetic' });
                // Right column: anchor at the inner right edge = right alignment to the guides box.
                draw(ruShift, { x: rightX, y: topY,    size: sizeShift, anchor: 'end',   baseline: 'hanging' });
                draw(ru,      { x: rightX, y: bottomY, size: sizeChar,  anchor: 'end',   baseline: 'alphabetic' });
            } else if (oneLang) {
                const yTop = topY + innerH * 0.28;
                const yBot = topY + innerH * 0.72;
                if (showLat) {
                    draw(shift, { x: midX, y: yTop, size: sizeShift, anchor: 'middle', baseline: 'middle' });
                    draw(base,  { x: midX, y: yBot, size: sizeChar,  anchor: 'middle', baseline: 'middle' });
                } else {
                    draw(ruShift, { x: midX, y: yTop, size: sizeShift, anchor: 'middle', baseline: 'middle' });
                    draw(ru,      { x: midX, y: yBot, size: sizeChar,  anchor: 'middle', baseline: 'middle' });
                }
            }
        } else {
            // Letter row.
            if (both) {
                draw(base, { x: leftX,  y: topY,    size: sizeChar, anchor: 'start', baseline: 'hanging' });
                draw(ru,   { x: rightX, y: bottomY, size: sizeChar, anchor: 'end',   baseline: 'alphabetic' });
            } else if (showLat) {
                draw(base, { x: midX, y: midY, size: sizeChar, anchor: 'middle', baseline: 'central' });
            } else if (showCyr) {
                draw(ru, { x: midX, y: midY, size: sizeChar, anchor: 'middle', baseline: 'central' });
            }
        }
        return;
    }

    if (key.label) {
        draw(key.label, { x: leftX, y: bottomY, size: sizeLabel, anchor: 'start', baseline: 'alphabetic' });
    }
}
