const NUM_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const AXIS_TOLERANCE = 1e-6;
export const LAYOUT_DRAFT_SCHEMA = 'keyboarder.layoutDraft.v1';

export function stripIllustratorPrivateData(svgText = '') {
    let svg = String(svgText || '');
    const removed = [];
    let removedBytes = 0;

    const remove = (label, pattern) => {
        svg = svg.replace(pattern, (match) => {
            removed.push(label);
            removedBytes += match.length;
            return '';
        });
    };

    svg = svg.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, (match) => {
        if (!/i:aipgf/i.test(match)) return match;
        removed.push('metadata:aipgf');
        removedBytes += match.length;
        return '';
    });
    remove('i:aipgf', /<i:aipgf\b[\s\S]*?<\/i:aipgf>/gi);
    remove('i:aipgfRef', /<i:aipgfRef\b[^>]*\/?>/gi);

    return { svg, removedBlocks: removed, removedBytes };
}

export function parseSvgAttributes(source = '') {
    const attrs = {};
    const re = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let m;
    while ((m = re.exec(String(source || '')))) {
        attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
    }
    return attrs;
}

export function extractSvgGroup(svgText = '', id = '') {
    const svg = String(svgText || '');
    const wanted = String(id || '');
    if (!wanted) return '';
    const tagRe = /<\/?g\b[^>]*>/gi;
    let m;
    while ((m = tagRe.exec(svg))) {
        const tag = m[0];
        if (/^<\//.test(tag)) continue;
        if (parseSvgAttributes(tag).id !== wanted) continue;
        const start = m.index;
        let depth = /\/\s*>$/.test(tag) ? 0 : 1;
        if (depth === 0) return tag;
        while ((m = tagRe.exec(svg))) {
            const next = m[0];
            if (/^<\//.test(next)) {
                depth -= 1;
                if (depth === 0) return svg.slice(start, tagRe.lastIndex);
            } else if (!/\/\s*>$/.test(next)) {
                depth += 1;
            }
        }
        return svg.slice(start);
    }
    return '';
}

export function parseViewBox(svgText = '') {
    const m = String(svgText || '').match(/<svg\b[^>]*>/i);
    if (!m) return null;
    const attrs = parseSvgAttributes(m[0]);
    const nums = numbers(attrs.viewBox || '');
    if (nums.length === 4) return { x: nums[0], y: nums[1], w: nums[2], h: nums[3] };
    const w = numberAttr(attrs.width);
    const h = numberAttr(attrs.height);
    return Number.isFinite(w) && Number.isFinite(h) ? { x: 0, y: 0, w, h } : null;
}

export function parseSvgLines(source = '') {
    return tags(source, 'line').map((tag, i) => {
        const a = parseSvgAttributes(tag);
        const x1 = numberAttr(a.x1);
        const y1 = numberAttr(a.y1);
        const x2 = numberAttr(a.x2);
        const y2 = numberAttr(a.y2);
        return { i, x1, y1, x2, y2 };
    }).filter((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite));
}

export function classifySvgLines(lines = [], tolerance = AXIS_TOLERANCE) {
    const horizontal = [];
    const vertical = [];
    const diagonal = [];
    for (const line of lines) {
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const base = { i: line.i, x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 };
        if (Math.abs(dy) <= tolerance) {
            horizontal.push({
                ...base,
                kind: 'horizontal',
                y: (line.y1 + line.y2) / 2,
                xmin: Math.min(line.x1, line.x2),
                xmax: Math.max(line.x1, line.x2),
                length: Math.abs(dx)
            });
        } else if (Math.abs(dx) <= tolerance) {
            vertical.push({
                ...base,
                kind: 'vertical',
                x: (line.x1 + line.x2) / 2,
                ymin: Math.min(line.y1, line.y2),
                ymax: Math.max(line.y1, line.y2),
                length: Math.abs(dy)
            });
        } else {
            diagonal.push({ ...base, kind: 'diagonal', length: Math.hypot(dx, dy) });
        }
    }
    return { horizontal, vertical, diagonal };
}

export function parseSvgRects(source = '') {
    return tags(source, 'rect').map((tag, i) => {
        const a = parseSvgAttributes(tag);
        let x = numberAttr(a.x);
        let y = numberAttr(a.y);
        const w = numberAttr(a.width);
        const h = numberAttr(a.height);
        if (![x, y, w, h].every(Number.isFinite)) return null;
        const transformNums = numbers(a.transform || '');
        if (/translate\(/i.test(a.transform || '') && /rotate\(\s*-180/i.test(a.transform || '') && transformNums.length >= 2) {
            x = transformNums[0] - x - w;
            y = transformNums[1] - y - h;
        }
        return {
            i,
            x,
            y,
            w,
            h,
            rx: numberAttr(a.rx),
            ry: numberAttr(a.ry)
        };
    }).filter(Boolean);
}

export function calibrateFromCaps(rects = []) {
    const usable = rects.filter((r) => [r.x, r.y, r.w, r.h].every(Number.isFinite));
    if (usable.length < 2) return null;
    const keyWidth1U = clusteredMode(usable.map((r) => r.w), 0.2, { tie: 'smallest' });
    const keyHeight = clusteredMode(usable.map((r) => r.h), 0.2, { tie: 'smallest' });
    const x0 = Math.min(...usable.map((r) => r.x));
    const y0 = Math.min(...usable.map((r) => r.y));
    const radii = usable.flatMap((r) => [r.rx, r.ry]).filter(Number.isFinite);
    const rowYs = clusters(usable.map((r) => r.y), 0.5).map((c) => c.value).sort((a, b) => a - b);
    const rowDiffs = diffs(rowYs).filter((v) => v > keyHeight * 0.75);
    const topRow = usable.filter((r) => Math.abs(r.y - rowYs[0]) <= 0.5);
    const topXs = uniqueSorted(topRow
        .filter((r) => Math.abs(r.w - keyWidth1U) <= 0.2)
        .map((r) => r.x), 0.01);
    const pitchDiffs = diffs(topXs).filter((v) => v > keyWidth1U * 0.75);
    const colPitch = pitchDiffs.length ? Math.min(...pitchDiffs) : null;
    const rowPitch = rowDiffs.length ? Math.min(...rowDiffs) : null;

    return {
        caps: usable.length,
        origin: { x: round(x0, 4), y: round(y0, 4) },
        cornerRadius: radii.length ? round(median(radii), 4) : null,
        keyWidth1U: round(keyWidth1U, 4),
        keyHeight: round(keyHeight, 4),
        colPitch: Number.isFinite(colPitch) ? round(colPitch, 4) : null,
        rowPitch: Number.isFinite(rowPitch) ? round(rowPitch, 4) : null,
        gap: Number.isFinite(colPitch) ? round(colPitch - keyWidth1U, 4) : null
    };
}

export function horizontalSpanGroups(horizontal = [], decimals = 1) {
    const groups = new Map();
    for (const seg of horizontal) {
        const key = `${round(seg.xmin, decimals)}:${round(seg.xmax, decimals)}`;
        if (!groups.has(key)) groups.set(key, { key, xmin: round(seg.xmin, decimals), xmax: round(seg.xmax, decimals), count: 0 });
        groups.get(key).count += 1;
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || a.xmin - b.xmin || a.xmax - b.xmax);
}

export function analyzeSvgBlueprint(svgText = '') {
    const stripped = stripIllustratorPrivateData(svgText);
    const viewBox = parseViewBox(stripped.svg);
    const blueprint = extractSvgGroup(stripped.svg, 'blueprint');
    const caps = extractSvgGroup(stripped.svg, 'caps');
    const source = blueprint || stripped.svg;
    const lines = parseSvgLines(source);
    const buckets = classifySvgLines(lines);
    const capRects = parseSvgRects(caps);
    const spanGroups = horizontalSpanGroups(buckets.horizontal);
    const calibration = calibrateFromCaps(capRects);
    const recognized = detectKeyRectCandidates({
        lineBuckets: buckets,
        calibration,
        caps: capRects
    });
    const diagnostics = diagnoseRecognizedKeys({
        groups: { blueprint: !!blueprint, caps: !!caps },
        elements: {
            lines: lines.length,
            paths: countTags(source, 'path'),
            rects: countTags(source, 'rect'),
            polygons: countTags(source, 'polygon')
        },
        calibration,
        caps: capRects,
        recognized
    });
    const layoutDraft = layoutDraftFromRecognized({ calibration, recognized, diagnostics });

    return {
        viewBox,
        privateData: {
            removedBlocks: stripped.removedBlocks,
            removedBytes: stripped.removedBytes
        },
        groups: {
            blueprint: !!blueprint,
            caps: !!caps
        },
        elements: {
            lines: lines.length,
            paths: countTags(source, 'path'),
            rects: countTags(source, 'rect'),
            polygons: countTags(source, 'polygon')
        },
        lineBuckets: buckets,
        horizontalSpanGroups: spanGroups.length,
        topHorizontalSpanGroups: spanGroups.slice(0, 8),
        caps: capRects,
        calibration,
        recognized,
        diagnostics,
        layoutDraft
    };
}

export function detectKeyRectCandidates(analysis = {}, options = {}) {
    const buckets = analysis.lineBuckets || {};
    const horizontal = buckets.horizontal || [];
    const vertical = buckets.vertical || [];
    const calibration = analysis.calibration || {};
    const keyHeight = finiteNumber(options.keyHeight, calibration.keyHeight);
    const rowPitch = finiteNumber(options.rowPitch, calibration.rowPitch);
    if (!horizontal.length || !vertical.length || !Number.isFinite(keyHeight)) {
        return { cornerOffset: null, raw: [], keys: [] };
    }

    const cornerOffset = finiteNumber(
        options.cornerOffset,
        estimateCornerOffsetFromCaps(analysis.caps || [], horizontal, calibration.cornerRadius)
    );
    if (!Number.isFinite(cornerOffset)) return { cornerOffset: null, raw: [], keys: [] };

    const allowedHeights = [keyHeight];
    if (Number.isFinite(rowPitch) && rowPitch > 0) allowedHeights.push(keyHeight + rowPitch);
    const heightTolerance = finiteNumber(options.heightTolerance, 1);
    const minSpan = finiteNumber(options.minSpan, 20);
    const raw = [];

    for (const group of groupedHorizontalSegments(horizontal)) {
        if (group.length < 2 || group[0].length < minSpan) continue;
        group.sort((a, b) => a.y - b.y);
        for (let i = 0; i < group.length - 1; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const top = group[i];
                const bottom = group[j];
                const h = bottom.y - top.y;
                const heightMatch = nearestAllowedHeight(h, allowedHeights, heightTolerance);
                if (!heightMatch) continue;
                const x = top.xmin - cornerOffset;
                const y = top.y;
                const w = top.xmax - top.xmin + 2 * cornerOffset;
                const hasLeft = hasVerticalEdge(vertical, x, y, y + h, cornerOffset);
                const hasRight = hasVerticalEdge(vertical, x + w, y, y + h, cornerOffset);
                if (!hasLeft || !hasRight) continue;
                raw.push({
                    x: round(x, 4),
                    y: round(y, 4),
                    w: round(w, 4),
                    h: round(h, 4),
                    rowSpan: heightMatch.index + 1,
                    top: top.i,
                    bottom: bottom.i,
                    area: w * h
                });
            }
        }
    }

    const keys = removeNestedCandidates(raw).map((k, i) => ({
        i,
        x: k.x,
        y: k.y,
        w: k.w,
        h: k.h,
        rowSpan: k.rowSpan,
        top: k.top,
        bottom: k.bottom
    }));
    return {
        cornerOffset: round(cornerOffset, 4),
        raw,
        keys
    };
}

export function estimateCornerOffsetFromCaps(caps = [], horizontal = [], radius = null) {
    const estimates = [];
    const maxOffset = Number.isFinite(radius) ? radius + 1.5 : 8;
    for (const cap of caps) {
        for (const seg of horizontal) {
            const onTop = Math.abs(seg.y - cap.y) <= 0.3;
            const onBottom = Math.abs(seg.y - (cap.y + cap.h)) <= 0.3;
            if (!onTop && !onBottom) continue;
            if (seg.length < 20) continue;
            const center = (seg.xmin + seg.xmax) / 2;
            if (center < cap.x || center > cap.x + cap.w) continue;
            const left = seg.xmin - cap.x;
            const right = cap.x + cap.w - seg.xmax;
            const d = (left + right) / 2;
            if (d > 0 && d <= maxOffset && Math.abs(left - right) <= 0.35) estimates.push(d);
        }
    }
    if (!estimates.length) return NaN;
    return clusteredMode(estimates, 0.05, { tie: 'smallest' });
}

export function diagnoseRecognizedKeys(analysis = {}, options = {}) {
    const warnings = [];
    const notices = [];
    const suspicious = new Set();
    const recognized = analysis.recognized || {};
    const keys = recognized.keys || [];
    const raw = recognized.raw || [];
    const caps = analysis.caps || [];
    const calibration = analysis.calibration || {};
    const keyWidth1U = finiteNumber(options.keyWidth1U, calibration.keyWidth1U);
    const keyHeight = finiteNumber(options.keyHeight, calibration.keyHeight);
    const colPitch = finiteNumber(options.colPitch, calibration.colPitch);
    const rowPitch = finiteNumber(options.rowPitch, calibration.rowPitch);
    const gap = finiteNumber(options.gap, calibration.gap, colPitch - keyWidth1U);
    const heightTolerance = finiteNumber(options.heightTolerance, 1.2);
    const tinyWidth = Number.isFinite(keyWidth1U) ? keyWidth1U * 0.45 : 20;
    const hugeWidth = Number.isFinite(colPitch) ? colPitch * 8 : 430;

    const add = (list, issue, { suspiciousKey = list === warnings } = {}) => {
        list.push(issue);
        if (suspiciousKey && issue.keyIndex != null) suspicious.add(issue.keyIndex);
    };

    if (!analysis.groups?.blueprint) add(warnings, { code: 'missing-blueprint', message: 'No blueprint group found.' });
    if (!analysis.groups?.caps) add(warnings, { code: 'missing-caps', message: 'No caps group found.' });
    if (!analysis.elements?.lines) add(warnings, { code: 'no-lines', message: 'No line segments found.' });
    if (!calibration) add(warnings, { code: 'no-calibration', message: 'Could not calibrate from caps.' });
    if (!keys.length) add(warnings, { code: 'no-keys', message: 'No key rectangles detected.' });
    if (caps.length && keys.length && caps.length !== keys.length) {
        add(warnings, { code: 'cap-count-mismatch', message: `Detected ${keys.length} keys, but caps has ${caps.length} rects.` });
    }
    if (raw.length && keys.length && raw.length > keys.length * 3) {
        add(notices, { code: 'many-raw-candidates', message: `${raw.length} raw candidates collapsed to ${keys.length} keys.` });
    }

    for (const key of keys) {
        if (![key.x, key.y, key.w, key.h].every(Number.isFinite)) {
            add(warnings, { code: 'invalid-key', keyIndex: key.i, message: `Key ${key.i + 1} has invalid geometry.` });
            continue;
        }
        if (key.w < tinyWidth) {
            add(warnings, { code: 'tiny-key', keyIndex: key.i, message: `Key ${key.i + 1} is too narrow.` });
        }
        if (key.w > hugeWidth) {
            add(warnings, { code: 'huge-key', keyIndex: key.i, message: `Key ${key.i + 1} is unusually wide.` });
        }
        if (Number.isFinite(keyHeight)) {
            const expected = key.rowSpan === 2 && Number.isFinite(rowPitch)
                ? keyHeight + rowPitch
                : keyHeight;
            if (Math.abs(key.h - expected) > heightTolerance) {
                add(warnings, { code: 'height-mismatch', keyIndex: key.i, message: `Key ${key.i + 1} height does not match the calibrated grid.` });
            }
        }
        if (Number.isFinite(colPitch) && Number.isFinite(gap) && Number.isFinite(keyWidth1U)) {
            const u = (key.w + gap) / colPitch;
            const nearestQuarter = Math.round(u * 4) / 4;
            if (Math.abs(u - nearestQuarter) > 0.06) {
                add(notices, { code: 'nonstandard-width', keyIndex: key.i, message: `Key ${key.i + 1} width is ${round(u, 3)}U.` });
            }
        }
    }

    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            if (!rectsIntersect(keys[i], keys[j], 0.5)) continue;
            add(warnings, { code: 'overlap', keyIndex: keys[i].i, message: `Key ${keys[i].i + 1} overlaps key ${keys[j].i + 1}.` });
            add(warnings, { code: 'overlap', keyIndex: keys[j].i, message: `Key ${keys[j].i + 1} overlaps key ${keys[i].i + 1}.` });
        }
    }

    if (caps.length === keys.length && keys.length) {
        const sortedCaps = [...caps].sort((a, b) => a.y - b.y || a.x - b.x);
        let worst = null;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const cap = sortedCaps[i];
            const drift = Math.max(
                Math.abs(key.x - cap.x),
                Math.abs(key.y - cap.y),
                Math.abs(key.w - cap.w),
                Math.abs(key.h - cap.h)
            );
            if (!worst || drift > worst.drift) worst = { keyIndex: key.i, drift };
        }
        if (worst && worst.drift > 0.5) {
            add(warnings, {
                code: 'cap-drift',
                keyIndex: worst.keyIndex,
                message: `Detected keys drift from caps by up to ${round(worst.drift, 3)} px.`
            });
        }
    }

    return {
        ok: warnings.length === 0,
        warnings,
        notices,
        suspiciousKeyIndices: [...suspicious].sort((a, b) => a - b),
        suspiciousKeys: suspicious.size
    };
}

export function layoutDraftFromRecognized(analysis = {}, options = {}) {
    const recognized = analysis.recognized || {};
    const keys = (recognized.keys || []).filter((key) => [key.x, key.y, key.w, key.h].every(Number.isFinite));
    const calibration = analysis.calibration || {};
    const keyWidth1U = finiteNumber(options.keyWidth1U, calibration.keyWidth1U);
    const colPitch = finiteNumber(options.colPitch, calibration.colPitch);
    const gap = finiteNumber(options.gap, calibration.gap, colPitch - keyWidth1U);
    const keyHeight = finiteNumber(options.keyHeight, calibration.keyHeight, clusteredMode(keys.map((key) => key.h), 1, { tie: 'smallest' }));
    const rowClusters = clusters(keys.map((key) => key.y), finiteNumber(options.rowTolerance, 1))
        .map((cluster) => cluster.value)
        .sort((a, b) => a - b);
    const rowPitch = finiteNumber(options.rowPitch, median(diffs(rowClusters)), calibration.rowPitch);
    if (!keys.length || !Number.isFinite(keyWidth1U) || !Number.isFinite(colPitch) || !Number.isFinite(gap) || !Number.isFinite(keyHeight) || !rowClusters.length) {
        return null;
    }

    const blocks = detectDraftBlocks(keys, gap).map((block, index, list) => ({
        id: blockIdFor(index, list.length),
        x: round(block.x, 4),
        width: round(block.right - block.x, 4),
        keys: block.keys
    }));
    const draftRows = rowClusters.map((rowY, rowIndex) => {
        const row = {};
        for (const block of blocks) {
            const blockKeys = keys
                .filter((key) => nearestIndex(rowClusters, key.y) === rowIndex && block.keys.includes(key))
                .sort((a, b) => a.x - b.x);
            if (!blockKeys.length) continue;
            const items = [];
            let cursor = block.x;
            for (const key of blockKeys) {
                const skip = normalizedSkip((key.x - cursor) / colPitch);
                if (skip > 0) items.push({ skip });
                items.push(draftItemForKey(key, { colPitch, gap }));
                cursor = key.x + key.w + gap;
            }
            row[block.id] = compactDraftItems(items);
        }
        return row;
    });
    const layoutBlocks = blocks.map(({ id, x, width }) => ({ id, x, width }));
    const layout = {
        meta: {
            name: options.name || 'IMPORTED_SVG',
            formFactor: options.formFactor || 'custom',
            source: 'svg-blueprint'
        },
        grid: {
            colPitch: round(colPitch, 4),
            rowPitch: round(rowPitch, 4),
            keyWidth1U: round(keyWidth1U, 4),
            keyHeight: round(keyHeight, 4),
            cornerRadius: round(finiteNumber(options.cornerRadius, calibration.cornerRadius, 0), 4),
            guideInset: round(finiteNumber(options.guideInset, calibration.guideInset, keyHeight * 0.14308), 4),
            origin: {
                x: round(Math.min(...keys.map((key) => key.x)), 4),
                y: round(rowClusters[0], 4)
            }
        },
        blocks: layoutBlocks,
        rows: draftRows
    };

    return {
        schema: LAYOUT_DRAFT_SCHEMA,
        layout,
        stats: {
            keys: keys.length,
            rows: draftRows.length,
            blocks: layoutBlocks.length,
            explicitWidths: countDraftItems(draftRows, (item) => item.w != null),
            unitWidths: countDraftItems(draftRows, (item) => item.u != null),
            skips: countDraftItems(draftRows, (item) => item.skip != null),
            rowSpans: countDraftItems(draftRows, (item) => item.rowSpan != null)
        }
    };
}

export function blueprintSummaryLines(analysis) {
    if (!analysis) return ['No drawing loaded'];
    const b = analysis.lineBuckets || {};
    const c = analysis.calibration;
    const lines = [
        `Groups: blueprint ${analysis.groups?.blueprint ? 'yes' : 'no'}, caps ${analysis.groups?.caps ? 'yes' : 'no'}`,
        `Lines: ${b.horizontal?.length || 0} H, ${b.vertical?.length || 0} V, ${b.diagonal?.length || 0} diagonal`,
        `Paths: ${analysis.elements?.paths || 0}; span groups: ${analysis.horizontalSpanGroups || 0}`
    ];
    if (c) {
        lines.push(`Caps: ${c.caps}; 1U ${c.keyWidth1U}, H ${c.keyHeight}, pitch ${c.colPitch ?? 'n/a'} × ${c.rowPitch ?? 'n/a'}`);
    }
    if (analysis.recognized?.keys?.length) {
        lines.push(`Detected: ${analysis.recognized.keys.length} keys from ${analysis.recognized.raw.length} candidates, d ${analysis.recognized.cornerOffset}`);
    }
    if (analysis.diagnostics) {
        const warnings = analysis.diagnostics.warnings?.length || 0;
        const notices = analysis.diagnostics.notices?.length || 0;
        lines.push(warnings || notices
            ? `Issues: ${warnings} warnings, ${notices} notes`
            : 'Issues: none');
    }
    if (analysis.layoutDraft) {
        const s = analysis.layoutDraft.stats;
        lines.push(`Draft: ${s.blocks} blocks, ${s.rows} rows, ${s.keys} keys`);
    }
    if (analysis.privateData?.removedBytes) {
        lines.push(`Removed Illustrator private data: ${analysis.privateData.removedBytes} bytes`);
    }
    return lines;
}

function detectDraftBlocks(keys, gap) {
    const threshold = Number.isFinite(gap) ? Math.max(gap * 1.5, 1) : 12;
    const sorted = [...keys].sort((a, b) => a.x - b.x || a.y - b.y);
    const blocks = [];
    for (const key of sorted) {
        const right = key.x + key.w;
        const last = blocks[blocks.length - 1];
        if (!last || key.x - last.right > threshold) {
            blocks.push({ x: key.x, right, keys: [key] });
        } else {
            last.x = Math.min(last.x, key.x);
            last.right = Math.max(last.right, right);
            last.keys.push(key);
        }
    }
    return blocks;
}

function blockIdFor(index, count) {
    if (count === 1) return 'main';
    if (count === 2) return ['main', 'nav'][index] || `block${index + 1}`;
    if (count === 3) return ['main', 'nav', 'numpad'][index] || `block${index + 1}`;
    return index === 0 ? 'main' : `block${index + 1}`;
}

function draftItemForKey(key, { colPitch, gap }) {
    const item = {};
    const widthU = (key.w + gap) / colPitch;
    const quarter = Math.round(widthU * 4) / 4;
    const quarterWidth = quarter * colPitch - gap;
    if (Math.abs(key.w - quarterWidth) <= 0.02) item.u = normalizedUnit(quarter);
    else item.w = round(key.w, 4);
    if (key.rowSpan && key.rowSpan > 1) item.rowSpan = key.rowSpan;
    return item;
}

function compactDraftItems(items) {
    const out = [];
    for (const item of items || []) {
        const last = out[out.length - 1];
        if (canRepeatDraftItem(item) && canRepeatDraftItem(last) && item.u === last.u) {
            last.repeat = (last.repeat || 1) + 1;
        } else {
            out.push({ ...item });
        }
    }
    return out;
}

function canRepeatDraftItem(item) {
    return !!item
        && item.u != null
        && item.w == null
        && item.skip == null
        && item.flex == null
        && item.rowSpan == null
        && item.id == null
        && item.editId == null;
}

function normalizedSkip(value) {
    if (!Number.isFinite(value) || value <= 0.2) return 0;
    return normalizedUnit(Math.round(value * 4) / 4);
}

function normalizedUnit(value) {
    return Math.abs(value - Math.round(value)) < 1e-6 ? Math.round(value) : round(value, 3);
}

function nearestIndex(values, value) {
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < values.length; i++) {
        const d = Math.abs(values[i] - value);
        if (d < bestD) {
            best = i;
            bestD = d;
        }
    }
    return best;
}

function countDraftItems(rows, predicate) {
    let count = 0;
    for (const row of rows) {
        for (const items of Object.values(row)) {
            for (const item of items || []) {
                if (predicate(item)) count += item.repeat || 1;
            }
        }
    }
    return count;
}

function groupedHorizontalSegments(horizontal) {
    const groups = new Map();
    for (const seg of horizontal) {
        const key = `${round(seg.xmin, 1)}:${round(seg.xmax, 1)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(seg);
    }
    return groups.values();
}

function nearestAllowedHeight(value, allowed, tolerance) {
    let best = null;
    for (let i = 0; i < allowed.length; i++) {
        const h = allowed[i];
        const d = Math.abs(value - h);
        if (d <= tolerance && (!best || d < best.d)) best = { index: i, h, d };
    }
    return best;
}

function hasVerticalEdge(vertical, x, y0, y1, cornerOffset) {
    const xTolerance = 0.25;
    const yTolerance = 2;
    const innerTop = y0 + cornerOffset;
    const innerBottom = y1 - cornerOffset;
    return vertical.some((seg) => Math.abs(seg.x - x) <= xTolerance
        && seg.ymin <= innerTop + yTolerance
        && seg.ymax >= innerBottom - yTolerance);
}

function removeNestedCandidates(candidates) {
    const kept = [];
    const sorted = [...candidates].sort((a, b) => b.area - a.area || a.y - b.y || a.x - b.x);
    for (const candidate of sorted) {
        if (kept.some((existing) => rectsIntersect(candidate, existing, 0.5))) continue;
        kept.push(candidate);
    }
    return kept.sort((a, b) => a.y - b.y || a.x - b.x);
}

function rectsIntersect(a, b, tolerance) {
    return a.x < b.x + b.w - tolerance
        && a.x + a.w > b.x + tolerance
        && a.y < b.y + b.h - tolerance
        && a.y + a.h > b.y + tolerance;
}

function tags(source, name) {
    const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
    return String(source || '').match(re) || [];
}

function countTags(source, name) {
    return tags(source, name).length;
}

function numberAttr(value) {
    if (value == null || value === '') return NaN;
    const m = String(value).match(NUM_RE);
    return m && m.length ? Number(m[0]) : NaN;
}

function finiteNumber(...values) {
    for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return NaN;
}

function numbers(value) {
    return (String(value || '').match(NUM_RE) || []).map(Number).filter(Number.isFinite);
}

function round(value, decimals = 4) {
    const p = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * p) / p;
}

function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return NaN;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clusters(values, tolerance) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const out = [];
    for (const value of sorted) {
        const last = out[out.length - 1];
        if (last && Math.abs(value - last.value) <= tolerance) {
            last.values.push(value);
            last.value = median(last.values);
        } else {
            out.push({ value, values: [value] });
        }
    }
    return out;
}

function clusteredMode(values, tolerance, { tie = 'largest' } = {}) {
    const grouped = clusters(values, tolerance);
    if (!grouped.length) return NaN;
    grouped.sort((a, b) => {
        const count = b.values.length - a.values.length;
        if (count) return count;
        return tie === 'smallest' ? a.value - b.value : b.value - a.value;
    });
    return grouped[0].value;
}

function uniqueSorted(values, tolerance = 0.01) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const out = [];
    for (const value of sorted) {
        if (!out.length || Math.abs(value - out[out.length - 1]) > tolerance) out.push(value);
    }
    return out;
}

function diffs(values) {
    const out = [];
    for (let i = 1; i < values.length; i++) out.push(values[i] - values[i - 1]);
    return out;
}
