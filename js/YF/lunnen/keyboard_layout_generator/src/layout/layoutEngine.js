/**
 * layoutEngine.js -- pure layout computation, no DOM, no side effects.
 *
 * computeLayout(template, settings) => {
 *   placedKeys : Array<PlacedKey>
 *   backdropX, backdropY, backdropW, backdropH : mm
 * }
 *
 * PlacedKey: { id, kind, label, icon, chars, x, y, w, h, rowId, isHalfArrow }
 * All coordinates in mm. 1 SVG unit = 1 mm.
 *
 * Settings used:
 *   keyWidth   -- base key width (mm)
 *   keyHeight  -- base key height (mm)
 *   gapX       -- horizontal gap between keys (mm)
 *   gapY       -- vertical gap between rows (mm)
 *   fnRowH     -- fn-row height override (mm); default = keyHeight * 0.65
 *   fnGap      -- gap after fn-row (mm); default = gapY
 *   padding    -- backdrop inset around key area (mm); SVG canvas size = backdropW x backdropH
 *
 * Per-key overrides on template keys:
 *   w    -- width multiplier relative to baseW (default 1)
 *   wMm  -- absolute mm width; if set (> 0), overrides w * baseW
 *   hMm  -- absolute mm height; if set (> 0), overrides rowH
 *
 * Optional numpad (if template.numpad is defined):
 *   template.numpad = {
 *     cols          : number of columns (default 4),
 *     gapX          : gap between numpad and the main block (default gapX * 2),
 *     keys          : [
 *       { id, label?, icon?, chars?, kind?,
 *         col, row,                            // 0-indexed grid slot
 *         colSpan?, rowSpan?,                  // default 1
 *         w?, h?, wMm?, hMm? }                 // overrides (same rules as main)
 *     ]
 *   }
 *
 * Numpad keys live in a rectangular grid to the right of main + additional. The
 * grid origin Y aligns with the top of the first non-fn row. Column width = baseW,
 * row height = baseH; spans grow by `n*cell + (n-1)*gap`. Numpad keys are also
 * pushed into `placedKeys` (rowId = 'numpad'), so everything downstream (render,
 * export, inspector) works without further changes.
 */

/**
 * Resolves a key's width in mm. Absolute override (wMm) wins over the ratio.
 */
export function keyWidthMm(key, baseW) {
    const abs = +key.wMm;
    if (isFinite(abs) && abs > 0) return abs;
    return baseW * (key.w ?? 1);
}

/**
 * Resolves a key's height in mm. Absolute override (hMm) wins over the row default.
 */
export function keyHeightMm(key, rowH) {
    const abs = +key.hMm;
    if (isFinite(abs) && abs > 0) return abs;
    return rowH;
}

export function computeLayout(template, settings) {
    const baseW   = +settings.keyWidth    || 16.8;
    const baseH   = +settings.keyHeight   || 16.7;
    const gapX    = +settings.gapX        || 1.6;
    const gapY    = +settings.gapY        || 2.1;
    const pad     = +settings.padding     || 4.0;

    const fnH   = (isFinite(+settings.fnRowH) && +settings.fnRowH > 0) ? +settings.fnRowH : baseH * 0.65;
    const fnGap = (isFinite(+settings.fnGap)  && +settings.fnGap  >= 0) ? +settings.fnGap  : gapY;

    const placed = [];

    // Step 1: reference row width defines main block (numbers row).
    //         mainWidth = main block + optional additional column.
    const refRow    = template.rows.find(r => !r.isFnRow) ?? template.rows[0];
    const rowWidth  = rowNaturalWidth(refRow.keys, baseW, gapX);
    const addColW   = template.hasAdditional ? (gapX + baseW) : 0;
    const mainWidth = rowWidth + addColW;

    // Numpad geometry (if present). Width in mm = cols * baseW + (cols - 1) * gapX.
    const npCfg   = template.numpad || null;
    const npCols  = npCfg ? (+npCfg.cols || 4) : 0;
    // Nullish coalescing doesn't catch NaN from +undefined, so check explicitly.
    const npGapX  = npCfg
        ? ((isFinite(+npCfg.gapX) && +npCfg.gapX >= 0) ? +npCfg.gapX : gapX * 2)
        : 0;
    const npW     = npCfg ? (npCols * baseW + (npCols - 1) * gapX) : 0;
    const fullWidth = mainWidth + (npCfg ? npGapX + npW : 0);

    // Step 2: total height.
    // Track the y-position of the first non-fn row so the numpad can align to it.
    let totalH       = 0;
    let firstMainY   = null;
    for (let i = 0; i < template.rows.length; i++) {
        const row = template.rows[i];
        const rh  = row.isFnRow ? fnH : baseH;
        if (!row.isFnRow && firstMainY === null) firstMainY = totalH;
        const gap = (i < template.rows.length - 1)
                    ? (row.isFnRow ? fnGap : gapY)
                    : 0;
        totalH += rh + gap;
    }
    if (firstMainY === null) firstMainY = 0;

    const backdropW = fullWidth + pad * 2;
    const backdropH = totalH    + pad * 2;
    const backdropX = 0;
    const backdropY = 0;

    const originX = backdropX + pad;
    let   curY    = backdropY + pad;

    // Step 3: place rows
    for (let i = 0; i < template.rows.length; i++) {
        const row = template.rows[i];
        const rh  = row.isFnRow ? fnH : baseH;

        placeRow(row, originX, curY, baseW, rh, gapX, mainWidth, placed);

        if (template.hasAdditional && row.additionalKey) {
            const ax = originX + rowWidth + gapX;
            const akW = keyWidthMm(row.additionalKey, baseW);
            const akH = keyHeightMm(row.additionalKey, rh);
            placed.push({
                ...row.additionalKey,
                x: ax, y: curY, w: akW, h: akH,
                rowId: row.id + '_add'
            });
        }

        const gap = (i < template.rows.length - 1)
                    ? (row.isFnRow ? fnGap : gapY)
                    : 0;
        curY += rh + gap;
    }

    // Step 4: place numpad (if any).
    if (npCfg && Array.isArray(npCfg.keys)) {
        const npOriginX = originX + mainWidth + npGapX;
        const npOriginY = backdropY + pad + firstMainY;
        placeNumpad(npCfg.keys, npOriginX, npOriginY, baseW, baseH, gapX, gapY, placed);
    }

    return { placedKeys: placed, backdropX, backdropY, backdropW, backdropH };
}

/**
 * Places numpad keys on a rectangular grid (baseW x baseH cells, gapX / gapY
 * between them). Each key specifies absolute grid coords (col, row) and optional
 * spans. Absolute wMm/hMm overrides still win over the span math.
 */
function placeNumpad(keys, originX, originY, baseW, baseH, gapX, gapY, out) {
    for (const key of keys) {
        const col      = Math.max(0, +key.col || 0);
        const row      = Math.max(0, +key.row || 0);
        const colSpan  = Math.max(1, +key.colSpan || 1);
        const rowSpan  = Math.max(1, +key.rowSpan || 1);

        const x = originX + col * (baseW + gapX);
        const y = originY + row * (baseH + gapY);

        // Numpad keys don't use ratio `w` (unlike main-row keys); the size
        // comes from col/rowSpan. Absolute wMm/hMm still wins if provided.
        const spanW = colSpan * baseW + (colSpan - 1) * gapX;
        const spanH = rowSpan * baseH + (rowSpan - 1) * gapY;
        const wAbs  = +key.wMm;
        const hAbs  = +key.hMm;
        const w = (isFinite(wAbs) && wAbs > 0) ? wAbs : spanW;
        const h = (isFinite(hAbs) && hAbs > 0) ? hAbs : spanH;

        out.push({ ...key, x, y, w, h, rowId: 'numpad' });
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Total width of a sequence of keys including gaps between them. */
function rowNaturalWidth(keys, baseW, gapX) {
    let w = 0;
    for (const k of keys) w += keyWidthMm(k, baseW);
    w += gapX * (keys.length - 1);
    return w;
}

/**
 * Places all keys of a row.
 *
 * - Standard row: keys placed left-to-right with gapX.
 * - Row with arrowCluster (bottom row): main keys placed naturally, then the
 *   arrow cluster is placed right-aligned to fullWidth. If the last main key
 *   (ctrl_r) has NO explicit wMm override, any slack is absorbed into it so
 *   that: naturalMainKeys + gapX + arrowBlock == fullWidth. If ctrl_r has
 *   an override, its width is respected verbatim and the arrow block stays
 *   at its natural position (user's explicit choice wins).
 */
function placeRow(row, originX, originY, baseW, rowH, gapX, fullWidth, out) {
    if (!row.arrowCluster) {
        let curX = originX;
        for (const key of row.keys) {
            const kw = keyWidthMm(key, baseW);
            const kh = keyHeightMm(key, rowH);
            out.push({ ...key, x: curX, y: originY, w: kw, h: kh, rowId: row.id });
            curX += kw + gapX;
        }
        return;
    }

    // Bottom row with arrow cluster
    const arrowW     = baseW;
    const arrowBlock = arrowW * 3 + gapX * 2;

    const keys     = row.keys.map(k => ({ ...k }));
    const lastKey  = keys[keys.length - 1];
    const hasLastOverride = isFinite(+lastKey.wMm) && +lastKey.wMm > 0;

    if (!hasLastOverride) {
        // Absorb delta into ctrl_r so the arrow cluster lands at the right edge.
        const natural    = rowNaturalWidth(keys, baseW, gapX);
        const targetMain = fullWidth - gapX - arrowBlock;
        const lastNatW   = keyWidthMm(lastKey, baseW);
        const delta      = targetMain - natural;
        const minLast    = baseW * 0.5;
        lastKey.wMm      = Math.max(minLast, lastNatW + delta);
    }

    // Place main keys
    let curX = originX;
    for (const key of keys) {
        const kw = keyWidthMm(key, baseW);
        const kh = keyHeightMm(key, rowH);
        out.push({ ...key, x: curX, y: originY, w: kw, h: kh, rowId: row.id });
        curX += kw + gapX;
    }

    // Arrow cluster: three columns of baseW at the right of main keys.
    const [arrowL, arrowUp, arrowDn, arrowR] = row.arrowCluster;
    const halfGap = gapX * 0.5;
    const halfH   = (rowH - halfGap) / 2;

    const colL = curX;
    const colM = colL + arrowW + gapX;
    const colR = colM + arrowW + gapX;

    out.push({ ...arrowL,  x: colL, y: originY,                  w: arrowW, h: rowH,  rowId: row.id });
    out.push({ ...arrowUp, x: colM, y: originY,                  w: arrowW, h: halfH, rowId: row.id, isHalfArrow: true });
    out.push({ ...arrowDn, x: colM, y: originY + halfH + halfGap, w: arrowW, h: halfH, rowId: row.id, isHalfArrow: true });
    out.push({ ...arrowR,  x: colR, y: originY,                  w: arrowW, h: rowH,  rowId: row.id });
}
