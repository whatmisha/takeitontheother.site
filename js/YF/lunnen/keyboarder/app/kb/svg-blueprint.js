const NUM_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const AXIS_TOLERANCE = 1e-6;

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
        recognized
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
    if (analysis.privateData?.removedBytes) {
        lines.push(`Removed Illustrator private data: ${analysis.privateData.removedBytes} bytes`);
    }
    return lines;
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
