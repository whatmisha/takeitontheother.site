const NUM_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const AXIS_TOLERANCE = 1e-6;
const PATH_CORNER_TOLERANCE = 0.55;
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
    const wanted = normalizeSvgGroupId(id);
    if (!wanted) return '';
    const tagRe = /<\/?g\b[^>]*>/gi;
    let m;
    while ((m = tagRe.exec(svg))) {
        const tag = m[0];
        if (/^<\//.test(tag)) continue;
        if (normalizeSvgGroupId(parseSvgAttributes(tag).id) !== wanted) continue;
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

function normalizeSvgGroupId(id = '') {
    return String(id || '').trim().toLowerCase();
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

export function parseSvgPathBounds(source = '') {
    return tags(source, 'path').map((tag, i) => {
        const bounds = pathDataBounds(pathDataAttr(tag));
        if (!bounds) return null;
        return { i, ...bounds };
    }).filter(Boolean);
}

export function parseSvgCapShapes(source = '') {
    const rects = parseSvgRects(source).map((rect) => ({
        ...rect,
        tagIndex: rect.i,
        source: 'rect'
    }));
    const paths = parseSvgPathBounds(source).map((path) => ({
        ...path,
        tagIndex: path.i,
        source: 'path',
        rx: NaN,
        ry: NaN
    }));
    if (!paths.length) return rects.map((rect, i) => ({ ...rect, i }));

    const baseWidth = clusteredMode(rects.map((rect) => rect.w), 0.75, { tie: 'smallest' });
    const baseHeight = clusteredMode(rects.map((rect) => rect.h), 0.75, { tie: 'smallest' });
    const minWidth = rects.length ? Math.max(8, Number.isFinite(baseWidth) ? baseWidth * 0.35 : 12) : 8;
    const minHeight = rects.length ? Math.max(8, Number.isFinite(baseHeight) ? baseHeight * 0.35 : 12) : 8;
    const capPaths = paths.filter((path) => path.w >= minWidth && path.h >= minHeight);
    return [...rects, ...capPaths]
        .sort((a, b) => a.y - b.y || a.x - b.x || a.source.localeCompare(b.source) || a.tagIndex - b.tagIndex)
        .map((shape, i) => ({ ...shape, i }));
}

export function parseSvgPathCornerArcs(source = '') {
    const out = [];
    tags(source, 'path').forEach((tag, i) => {
        if (!/[cC]/.test(tag)) return;
        const d = pathDataAttr(tag);
        const cubic = d.match(/[cC]/)?.[0] || '';
        if (!cubic) return;
        const nums = numbers(d);
        if (nums.length < 8) return;
        const x = nums[0];
        const y = nums[1];
        const ex = cubic === 'c' ? x + nums[6] : nums[6];
        const ey = cubic === 'c' ? y + nums[7] : nums[7];
        const dx = ex - x;
        const dy = ey - y;
        if (Math.abs(dx) < 0.05 || Math.abs(dy) < 0.05) return;

        const arc = {
            i,
            x: round(x, 4),
            y: round(y, 4),
            ex: round(ex, 4),
            ey: round(ey, 4),
            dx,
            dy
        };
        if (dx < 0 && dy > 0) {
            out.push({ ...arc, kind: 'tl', x0: round(ex, 4), y0: round(y, 4) });
            return;
        }
        if (dx < 0 && dy < 0) {
            out.push({ ...arc, kind: 'tr', x1: round(x, 4), y0: round(ey, 4) });
            return;
        }
        if (dx > 0 && dy > 0) {
            out.push({ ...arc, kind: 'bl', x0: round(x, 4), y1: round(ey, 4) });
            return;
        }
        if (dx > 0 && dy < 0) {
            out.push({ ...arc, kind: 'br', x1: round(ex, 4), y1: round(y, 4) });
        }
    });
    return out;
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
    const rowPitch = rowDiffs.length ? clusteredMode(rowDiffs, 0.5, { tie: 'smallest' }) : null;

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
    const timings = {};
    const totalStarted = nowMs();
    const timed = (key, fn) => {
        const started = nowMs();
        const value = fn();
        timings[key] = round(nowMs() - started, 4);
        return value;
    };

    const stripped = timed('stripMs', () => stripIllustratorPrivateData(svgText));
    const viewBox = timed('viewBoxMs', () => parseViewBox(stripped.svg));
    const groups = timed('groupsMs', () => ({
        blueprint: extractSvgGroup(stripped.svg, 'blueprint'),
        caps: extractSvgGroup(stripped.svg, 'caps'),
        guides: extractSvgGroup(stripped.svg, 'guides')
    }));
    const blueprint = groups.blueprint;
    const caps = groups.caps;
    const guides = groups.guides;
    const source = blueprint || stripped.svg;
    const sourceCounts = timed('tagCountsMs', () => countElementTags(source, ['line', 'path', 'rect', 'polygon']));
    const lines = timed('parseLinesMs', () => parseSvgLines(source));
    const buckets = timed('classifyLinesMs', () => classifySvgLines(lines));
    const pathCornerArcs = timed('pathArcsMs', () => parseSvgPathCornerArcs(source));
    const capShapes = timed('capsMs', () => parseSvgCapShapes(caps));
    const spanGroups = timed('spanGroupsMs', () => horizontalSpanGroups(buckets.horizontal));
    const calibration = timed('calibrationMs', () => calibrateFromCaps(capShapes));
    const elements = {
        lines: lines.length,
        paths: sourceCounts.path || 0,
        pathCornerArcs: pathCornerArcs.length,
        rects: sourceCounts.rect || 0,
        polygons: sourceCounts.polygon || 0
    };
    const detected = timed('detectMs', () => detectKeyRectCandidates({
        lineBuckets: buckets,
        pathCornerArcs,
        calibration,
        caps: capShapes
    }));
    const recognized = timed('sourceMs', () => chooseRecognizedKeySource(detected, capShapes, calibration, {
        hasBlueprint: !!blueprint
    }));
    const diagnostics = timed('diagnosticsMs', () => diagnoseRecognizedKeys({
        groups: { blueprint: !!blueprint, caps: !!caps, guides: !!guides },
        elements,
        calibration,
        caps: capShapes,
        recognized
    }));
    const layoutDraft = timed('draftMs', () => layoutDraftFromRecognized({ calibration, recognized, diagnostics }));
    timings.totalMs = round(nowMs() - totalStarted, 4);

    return {
        viewBox,
        privateData: {
            removedBlocks: stripped.removedBlocks,
            removedBytes: stripped.removedBytes
        },
        groups: {
            blueprint: !!blueprint,
            caps: !!caps,
            guides: !!guides
        },
        elements: {
            lines: lines.length,
            paths: sourceCounts.path || 0,
            rects: sourceCounts.rect || 0,
            polygons: sourceCounts.polygon || 0
        },
        lineBuckets: buckets,
        horizontalSpanGroups: spanGroups.length,
        topHorizontalSpanGroups: spanGroups.slice(0, 8),
        caps: capShapes,
        calibration,
        recognized,
        diagnostics,
        layoutDraft,
        timings
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
        estimateCornerOffsetFromCaps(analysis.caps || [], horizontal, calibration.cornerRadius),
        calibration.cornerRadius
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

    const regularKeys = removeNestedCandidates(raw).map((k) => ({
        x: k.x,
        y: k.y,
        w: k.w,
        h: k.h,
        rowSpan: k.rowSpan,
        top: k.top,
        bottom: k.bottom
    }));

    const stackCells = detectStackedKeyCellsFromPathArcs(analysis.pathCornerArcs || [], {
        calibration,
        cornerOffset,
        existingKeys: regularKeys
    }).map((cell, stackId) => ({
        ...cell,
        stackId,
        stack: cell.stack.map((key, stackIndex) => ({
            ...key,
            stackId,
            stackIndex,
            stackCount: cell.stack.length
        }))
    }));
    const stackedKeys = stackCells.flatMap((cell) => cell.stack.map((key) => ({
        x: key.x,
        y: key.y,
        w: key.w,
        h: key.h,
        rowSpan: key.rowSpan,
        stackId: key.stackId,
        stackIndex: key.stackIndex,
        stackCount: key.stackCount,
        stackBaseY: cell.y,
        stackBaseH: cell.h
    })));
    const keys = [...regularKeys, ...stackedKeys]
        .sort((a, b) => a.y - b.y || a.x - b.x || (a.stackIndex || 0) - (b.stackIndex || 0))
        .map((k, i) => ({ i, ...k }));
    const estimatedGrid = estimateGridFromKeys(draftCellsFromRecognized(keys, { stackCells }), calibration);
    return {
        source: 'blueprint',
        cornerOffset: round(cornerOffset, 4),
        raw: [...raw, ...stackedKeys],
        stackCells,
        estimatedGrid,
        keys
    };
}

function chooseRecognizedKeySource(detected = {}, caps = [], calibration = {}, options = {}) {
    if (!shouldUseCapsAsKeySource(detected, caps, options)) {
        return { source: 'blueprint', ...detected };
    }
    return recognizedKeysFromCaps(caps, calibration);
}

function shouldUseCapsAsKeySource(detected = {}, caps = [], options = {}) {
    if (!caps.length) return false;
    const detectedCount = detected.keys?.length || 0;
    if (!detectedCount) return true;
    const sparseCaps = caps.length <= Math.max(4, detectedCount * 0.1);
    if (sparseCaps) return false;
    if (!options.hasBlueprint) return true;
    return caps.length !== detectedCount;
}

function recognizedKeysFromCaps(caps = [], calibration = {}) {
    const stackCells = detectStackedKeyCellsFromCaps(caps, calibration).map((cell, stackId) => ({
        ...cell,
        stackId,
        stack: cell.stack.map((key, stackIndex) => ({
            ...key,
            stackId,
            stackIndex,
            stackCount: cell.stack.length
        }))
    }));
    const stackKeys = stackCells.flatMap((cell) => cell.stack);
    const stackedSignatures = new Set(stackKeys.map(rectSignature));
    const regularKeys = caps
        .filter((cap) => !stackedSignatures.has(rectSignature(cap)))
        .map(capShapeToKey);
    const keys = [...regularKeys, ...stackKeys.map(capShapeToKey)]
        .sort((a, b) => a.y - b.y || a.x - b.x || (a.stackIndex || 0) - (b.stackIndex || 0))
        .map((key, i) => ({ i, ...key }));
    const estimatedGrid = estimateGridFromKeys(draftCellsFromRecognized(keys, { stackCells }), calibration);
    return {
        source: 'caps',
        cornerOffset: null,
        raw: caps,
        stackCells,
        estimatedGrid,
        keys
    };
}

function detectStackedKeyCellsFromCaps(caps = [], calibration = {}) {
    const keyHeight = finiteNumber(
        calibration.keyHeight,
        clusteredMode(caps.map((cap) => cap.h), 1, { tie: 'smallest' })
    );
    if (!Number.isFinite(keyHeight)) return [];
    const xTolerance = 0.9;
    const widthTolerance = 0.9;
    const minPartHeight = keyHeight * 0.28;
    const maxPartHeight = keyHeight * 0.85;
    const minFootprintHeight = keyHeight * 0.72;
    const maxFootprintHeight = keyHeight * 1.35;
    const maxMiddleGap = keyHeight * 0.28;
    const sorted = [...caps].sort((a, b) => a.y - b.y || a.x - b.x);
    const used = new Set();
    const cells = [];

    for (let i = 0; i < sorted.length; i++) {
        if (used.has(i)) continue;
        const top = sorted[i];
        if (top.h < minPartHeight || top.h > maxPartHeight) continue;
        let mateIndex = -1;
        for (let j = i + 1; j < sorted.length; j++) {
            if (used.has(j)) continue;
            const bottom = sorted[j];
            if (bottom.h < minPartHeight || bottom.h > maxPartHeight) continue;
            if (!closeEnough(top.x, bottom.x, xTolerance)) continue;
            if (!closeEnough(top.w, bottom.w, widthTolerance)) continue;
            const middleGap = bottom.y - (top.y + top.h);
            if (middleGap < -0.5 || middleGap > maxMiddleGap) continue;
            const footprintH = bottom.y + bottom.h - top.y;
            if (footprintH < minFootprintHeight || footprintH > maxFootprintHeight) continue;
            mateIndex = j;
            break;
        }
        if (mateIndex < 0) continue;
        const bottom = sorted[mateIndex];
        used.add(i);
        used.add(mateIndex);
        cells.push({
            x: round((top.x + bottom.x) / 2, 4),
            y: round(top.y, 4),
            w: round((top.w + bottom.w) / 2, 4),
            h: round(bottom.y + bottom.h - top.y, 4),
            stack: [
                capShapeToKey(top),
                capShapeToKey(bottom)
            ]
        });
    }

    return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

function capShapeToKey(shape = {}) {
    const key = {
        x: round(shape.x, 4),
        y: round(shape.y, 4),
        w: round(shape.w, 4),
        h: round(shape.h, 4),
        source: shape.source || 'caps'
    };
    for (const prop of ['rowSpan', 'stackId', 'stackIndex', 'stackCount', 'stackBaseY', 'stackBaseH']) {
        if (shape[prop] != null) key[prop] = shape[prop];
    }
    return key;
}

function rectSignature(rect = {}) {
    return `${round(rect.x, 3)}:${round(rect.y, 3)}:${round(rect.w, 3)}:${round(rect.h, 3)}`;
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

function detectStackedKeyCellsFromPathArcs(arcs = [], options = {}) {
    const calibration = options.calibration || {};
    const keyWidth1U = finiteNumber(options.keyWidth1U, calibration.keyWidth1U);
    const keyHeight = finiteNumber(options.keyHeight, calibration.keyHeight);
    if (!Number.isFinite(keyWidth1U) || !Number.isFinite(keyHeight)) return [];

    const widthTolerance = Math.max(1.25, keyWidth1U * 0.04);
    const minH = keyHeight * 0.35;
    const maxH = keyHeight * 0.75;
    const tls = arcs.filter((arc) => arc.kind === 'tl');
    const trs = arcs.filter((arc) => arc.kind === 'tr');
    const bls = arcs.filter((arc) => arc.kind === 'bl');
    const brs = arcs.filter((arc) => arc.kind === 'br');
    const rects = [];

    for (const tl of tls) {
        for (const tr of trs) {
            if (!closeEnough(tl.y0, tr.y0, PATH_CORNER_TOLERANCE)) continue;
            const w = tr.x1 - tl.x0;
            if (Math.abs(w - keyWidth1U) > widthTolerance) continue;
            for (const bl of bls) {
                if (!closeEnough(bl.x0, tl.x0, PATH_CORNER_TOLERANCE)) continue;
                const h = bl.y1 - tl.y0;
                if (h < minH || h > maxH) continue;
                const br = brs.find((candidate) =>
                    closeEnough(candidate.x1, tr.x1, PATH_CORNER_TOLERANCE)
                    && closeEnough(candidate.y1, bl.y1, PATH_CORNER_TOLERANCE));
                if (!br) continue;
                rects.push({
                    x: round((tl.x0 + bl.x0) / 2, 4),
                    y: round((tl.y0 + tr.y0) / 2, 4),
                    w: round(w, 4),
                    h: round(h, 4)
                });
            }
        }
    }

    const unique = uniqueRects(rects, 0.7).sort((a, b) => a.x - b.x || a.y - b.y);
    const used = new Set();
    const cells = [];
    for (let i = 0; i < unique.length; i++) {
        if (used.has(i)) continue;
        const top = unique[i];
        const mateIndex = unique.findIndex((candidate, j) => {
            if (j === i || used.has(j)) return false;
            if (!closeEnough(candidate.x, top.x, 0.75) || !closeEnough(candidate.w, top.w, 0.75)) return false;
            if (candidate.y <= top.y) return false;
            const footprintH = candidate.y + candidate.h - top.y;
            return Math.abs(footprintH - keyHeight) <= Math.max(1.5, keyHeight * 0.04);
        });
        if (mateIndex < 0) continue;
        const bottom = unique[mateIndex];
        const cell = {
            x: round((top.x + bottom.x) / 2, 4),
            y: round(top.y, 4),
            w: round((top.w + bottom.w) / 2, 4),
            h: round(bottom.y + bottom.h - top.y, 4),
            stack: [
                { x: top.x, y: top.y, w: top.w, h: top.h },
                { x: bottom.x, y: bottom.y, w: bottom.w, h: bottom.h }
            ]
        };
        if (overlapsExistingKey(cell, options.existingKeys || [])) continue;
        used.add(i);
        used.add(mateIndex);
        cells.push(cell);
    }
    return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

function overlapsExistingKey(cell, keys = []) {
    return keys.some((key) => rectsIntersect(cell, key, 0.5));
}

function draftCellsFromRecognized(keys = [], recognized = {}) {
    const stackKeys = new Set();
    const cells = [];
    for (const cell of recognized.stackCells || []) {
        for (const key of cell.stack || []) {
            stackKeys.add(`${round(key.x, 3)}:${round(key.y, 3)}:${round(key.w, 3)}:${round(key.h, 3)}`);
        }
        cells.push({
            x: cell.x,
            y: cell.y,
            w: cell.w,
            h: cell.h,
            stackId: cell.stackId,
            stack: (cell.stack || []).map((key) => ({
                x: key.x,
                y: key.y,
                w: key.w,
                h: key.h,
                stackIndex: key.stackIndex,
                stackCount: key.stackCount
            }))
        });
    }
    for (const key of keys) {
        const signature = `${round(key.x, 3)}:${round(key.y, 3)}:${round(key.w, 3)}:${round(key.h, 3)}`;
        if (stackKeys.has(signature)) continue;
        cells.push({ ...key });
    }
    return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

function estimateGridFromKeys(cells = [], calibration = {}, options = {}) {
    const keyWidth1U = finiteNumber(options.keyWidth1U, calibration.keyWidth1U, clusteredMode(cells.map((key) => key.w), 0.5, { tie: 'smallest' }));
    const keyHeight = finiteNumber(options.keyHeight, calibration.keyHeight, clusteredMode(cells.map((key) => key.h), 1, { tie: 'smallest' }));
    const rowClusters = clusters(cells.map((key) => key.y), finiteNumber(options.rowTolerance, 1))
        .map((cluster) => cluster.value)
        .sort((a, b) => a - b);
    const rowDiffs = diffs(rowClusters).filter((value) => !Number.isFinite(keyHeight) || value > keyHeight * 0.75);
    const gap = estimateGapFromRows(cells, keyWidth1U);
    const colPitch = Number.isFinite(gap) && Number.isFinite(keyWidth1U)
        ? keyWidth1U + gap
        : NaN;
    const rowPitch = finiteNumber(calibration.rowPitch, median(rowDiffs), Number.isFinite(keyHeight) && Number.isFinite(gap) ? keyHeight + gap : NaN);
    return {
        keyWidth1U: Number.isFinite(keyWidth1U) ? round(keyWidth1U, 4) : null,
        keyHeight: Number.isFinite(keyHeight) ? round(keyHeight, 4) : null,
        gap: Number.isFinite(gap) ? round(gap, 4) : null,
        colPitch: Number.isFinite(colPitch) ? round(colPitch, 4) : null,
        rowPitch: Number.isFinite(rowPitch) ? round(rowPitch, 4) : null
    };
}

function estimateGapFromRows(cells = [], keyWidth1U = NaN) {
    const rows = clusters(cells.map((key) => key.y), 1).map((cluster) => ({
        y: cluster.value,
        keys: cells.filter((key) => Math.abs(key.y - cluster.value) <= 1).sort((a, b) => a.x - b.x)
    }));
    const gaps = [];
    for (const row of rows) {
        for (let i = 1; i < row.keys.length; i++) {
            const prev = row.keys[i - 1];
            const key = row.keys[i];
            const gap = key.x - (prev.x + prev.w);
            if (gap <= 0.4) continue;
            if (Number.isFinite(keyWidth1U) && gap > keyWidth1U * 0.6) continue;
            gaps.push(gap);
        }
    }
    return clusteredMode(gaps, 0.35, { tie: 'smallest' });
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
    const estimated = recognized.estimatedGrid || {};
    const keyWidth1U = finiteNumber(options.keyWidth1U, calibration.keyWidth1U, estimated.keyWidth1U);
    const keyHeight = finiteNumber(options.keyHeight, calibration.keyHeight, estimated.keyHeight);
    const colPitch = finiteNumber(options.colPitch, calibration.colPitch, estimated.colPitch);
    const rowPitch = finiteNumber(options.rowPitch, calibration.rowPitch, estimated.rowPitch);
    const gap = finiteNumber(options.gap, calibration.gap, estimated.gap, colPitch - keyWidth1U);
    const heightTolerance = finiteNumber(options.heightTolerance, 1.2);
    const tinyWidth = Number.isFinite(keyWidth1U) ? keyWidth1U * 0.45 : 20;
    const hugeWidth = Number.isFinite(colPitch) ? colPitch * 8 : 430;

    const add = (list, issue, { suspiciousKey = list === warnings } = {}) => {
        list.push(issue);
        if (suspiciousKey && issue.keyIndex != null) suspicious.add(issue.keyIndex);
    };

    const usingCapsSource = recognized.source === 'caps';
    if (!analysis.groups?.blueprint && !usingCapsSource) add(warnings, { code: 'missing-blueprint', message: 'No blueprint group found.' });
    if (!analysis.groups?.caps) add(warnings, { code: 'missing-caps', message: 'No caps group found.' });
    if (!analysis.elements?.lines && !usingCapsSource) add(warnings, { code: 'no-lines', message: 'No line segments found.' });
    if (!calibration) add(warnings, { code: 'no-calibration', message: 'Could not calibrate from caps.' });
    if (!keys.length) add(warnings, { code: 'no-keys', message: 'No key rectangles detected.' });
    if (usingCapsSource && keys.length) {
        add(notices, {
            code: 'caps-used-as-source',
            message: `Used ${keys.length} caps shapes as keyboard geometry.`
        }, { suspiciousKey: false });
    }
    if (caps.length && keys.length && caps.length !== keys.length) {
        const sparseCaps = caps.length <= Math.max(4, keys.length * 0.1);
        add(sparseCaps ? notices : warnings, {
            code: sparseCaps ? 'caps-used-for-calibration' : 'cap-count-mismatch',
            message: sparseCaps
                ? `Detected ${keys.length} keys; ${caps.length} caps rects were used as calibration samples.`
                : `Detected ${keys.length} keys, but caps has ${caps.length} rects.`
        }, { suspiciousKey: false });
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
        if (!usingCapsSource && Number.isFinite(keyHeight)) {
            const expected = key.rowSpan === 2 && Number.isFinite(rowPitch)
                ? keyHeight + rowPitch
                : keyHeight;
            if (!key.stackCount && Math.abs(key.h - expected) > heightTolerance) {
                add(warnings, { code: 'height-mismatch', keyIndex: key.i, message: `Key ${key.i + 1} height does not match the calibrated grid.` });
            }
        }
        if (!usingCapsSource && Number.isFinite(colPitch) && Number.isFinite(gap) && Number.isFinite(keyWidth1U)) {
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

    if (!usingCapsSource && caps.length === keys.length && keys.length) {
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
    const cells = draftCellsFromRecognized(keys, recognized);
    const calibration = analysis.calibration || {};
    const estimated = recognized.estimatedGrid || estimateGridFromKeys(cells, calibration, options);
    const keyWidth1U = finiteNumber(options.keyWidth1U, calibration.keyWidth1U, estimated.keyWidth1U);
    const colPitch = finiteNumber(options.colPitch, calibration.colPitch, estimated.colPitch);
    const gap = finiteNumber(options.gap, calibration.gap, estimated.gap, colPitch - keyWidth1U);
    const keyHeight = finiteNumber(options.keyHeight, calibration.keyHeight, estimated.keyHeight, clusteredMode(cells.map((key) => key.h), 1, { tie: 'smallest' }));
    const rowClusters = clusters(cells.map((key) => key.y), finiteNumber(options.rowTolerance, 1))
        .map((cluster) => cluster.value)
        .sort((a, b) => a - b);
    const rowPitch = finiteNumber(options.rowPitch, median(diffs(rowClusters)), calibration.rowPitch, estimated.rowPitch, keyHeight + gap);
    if (!cells.length || !Number.isFinite(keyWidth1U) || !Number.isFinite(colPitch) || !Number.isFinite(gap) || !Number.isFinite(keyHeight) || !rowClusters.length) {
        return null;
    }
    const irregularRows = rowClusters.some((rowY, rowIndex) =>
        Math.abs(rowY - (rowClusters[0] + rowIndex * rowPitch)) > 0.05);

    const draftBlocks = detectDraftBlocks(cells, gap);
    const layoutProfile = assignDraftSemanticIds(cells, rowClusters, draftBlocks);
    const explicitX = recognized.source === 'caps';

    const blocks = draftBlocks.map((block, index, list) => ({
        id: blockIdFor(index, list.length),
        x: round(block.x, 4),
        width: round(block.right - block.x, 4),
        keys: block.keys
    }));
    const draftRows = rowClusters.map((rowY, rowIndex) => {
        const row = {};
        if (irregularRows) row.__y = round(rowY, 4);
        for (const block of blocks) {
            const blockKeys = cells
                .filter((key) => nearestIndex(rowClusters, key.y) === rowIndex && block.keys.includes(key))
                .sort((a, b) => a.x - b.x);
            if (!blockKeys.length) continue;
            const items = [];
            let cursor = block.x;
            let ordinal = 0;
            for (const key of blockKeys) {
                const skip = explicitX ? 0 : normalizedSkip((key.x - cursor) / colPitch);
                if (skip > 0) items.push({ skip });
                const item = draftItemForKey(key, { colPitch, gap, keyHeight, rowPitch, explicitX });
                if (item.stack) {
                    item.editId = `${rowIndex}:${block.id}:${ordinal}`;
                    item.stack = item.stack.map((child, stackIndex) => ({
                        ...child,
                        editId: `${item.editId}:stack${stackIndex}`
                    }));
                }
                items.push(item);
                ordinal += 1;
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
            source: recognized.source === 'caps' ? 'svg-caps' : 'svg-blueprint',
            layoutProfile: layoutProfile?.id || null
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
            rowSpans: countDraftItems(draftRows, (item) => item.rowSpan != null),
            stacks: countDraftItems(draftRows, (item) => Array.isArray(item.stack)),
            explicitHeights: countDraftItems(draftRows, (item) => item.h != null),
            explicitX: countDraftItems(draftRows, (item) => item.x != null),
            explicitY: countDraftItems(draftRows, (item) => item.y != null),
            explicitRows: draftRows.filter((row) => row.__y != null).length,
            layoutProfile: layoutProfile?.id || null,
            semanticKeys: countSemanticKeys(cells)
        }
    };
}

export function blueprintSummaryLines(analysis) {
    if (!analysis) return ['No drawing loaded'];
    const b = analysis.lineBuckets || {};
    const c = analysis.calibration;
    const lines = [
        `Groups: blueprint ${analysis.groups?.blueprint ? 'yes' : 'no'}, caps ${analysis.groups?.caps ? 'yes' : 'no'}, guides ${analysis.groups?.guides ? 'yes' : 'no'}`,
        `Lines: ${b.horizontal?.length || 0} H, ${b.vertical?.length || 0} V, ${b.diagonal?.length || 0} diagonal`,
        `Paths: ${analysis.elements?.paths || 0}; span groups: ${analysis.horizontalSpanGroups || 0}`
    ];
    if (c) {
        const e = analysis.recognized?.estimatedGrid || {};
        lines.push(`Caps: ${c.caps}; 1U ${c.keyWidth1U}, H ${c.keyHeight}, pitch ${c.colPitch ?? e.colPitch ?? 'n/a'} × ${c.rowPitch ?? e.rowPitch ?? 'n/a'}`);
    }
    if (analysis.recognized?.keys?.length) {
        const stacks = analysis.recognized.stackCells?.length || 0;
        const source = analysis.recognized.source === 'caps' ? 'caps' : 'blueprint';
        const d = analysis.recognized.cornerOffset == null ? '' : `, d ${analysis.recognized.cornerOffset}`;
        lines.push(`Detected: ${analysis.recognized.keys.length} keys from ${analysis.recognized.raw.length} ${source}${d}${stacks ? `, ${stacks} stack` : ''}`);
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
        const profile = s.layoutProfile ? `, profile ${s.layoutProfile}` : '';
        const semantic = Number.isFinite(s.semanticKeys) ? `, semantic ${s.semanticKeys}/${s.keys}` : '';
        lines.push(`Draft: ${s.blocks} blocks, ${s.rows} rows, ${s.keys} keys${s.stacks ? `, ${s.stacks} stack` : ''}${profile}${semantic}`);
        if (s.content) {
            lines.push(`Content: alpha-dual ${s.content.alphaDualKeys || 0}, punctuation-dual ${s.content.punctuationDualKeys || 0}, f-icons ${s.content.fIconKeys || 0}, corners ${s.content.cornerTemplateKeys || 0}, placeholders ${s.content.placeholderKeys || 0}`);
        }
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

const ANSI_COMPACT_IDS = [
    ['esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'f13'],
    ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal', 'backspace'],
    ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash'],
    ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote', 'enter'],
    ['lshift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash', 'rshift'],
    ['lctrl', 'lmeta', 'lalt', 'fn-left', 'space', 'ralt', 'fn-right', 'left', 'arrow-stack', 'right']
];

const ANSI_NAV_89_ROWS = [
    {
        main: ['esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'f13'],
        nav: ['print', 'scroll', 'pause']
    },
    {
        main: ['grave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal', 'backspace'],
        nav: ['insert', 'home', 'pg-up']
    },
    {
        main: ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'left-bracket', 'right-bracket', 'backslash'],
        nav: ['delete', 'end', 'pg-down']
    },
    {
        main: ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote', 'enter']
    },
    {
        main: ['lshift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash', 'rshift'],
        nav: ['up']
    },
    {
        main: ['lctrl', 'lmeta', 'lalt', 'fn-left', 'space', 'ralt', 'fn-right', 'menu', 'rctrl'],
        nav: ['left', 'down', 'right']
    }
];

const LAYOUT_PROFILES = [
    {
        id: 'ANSI_COMPACT_78',
        rows: ANSI_COMPACT_IDS.map((main) => ({ main }))
    },
    {
        id: 'ANSI_NAV_89',
        rows: ANSI_NAV_89_ROWS
    }
];

function assignDraftSemanticIds(cells = [], rowClusters = [], rawBlocks = []) {
    const rows = rowsByDraftBlock(cells, rowClusters, rawBlocks);
    for (const profile of LAYOUT_PROFILES) {
        if (!draftProfileMatches(rows, profile)) continue;
        applyDraftProfile(rows, profile);
        return { id: profile.id };
    }
    return null;
}

function rowsByDraftBlock(cells = [], rowClusters = [], rawBlocks = []) {
    return rowClusters.map((rowY, rowIndex) => {
        const row = {};
        rawBlocks.forEach((block, blockIndex) => {
            const blockId = blockIdFor(blockIndex, rawBlocks.length);
            row[blockId] = cells
                .filter((key) => nearestIndex(rowClusters, key.y) === rowIndex && block.keys.includes(key))
                .sort((a, b) => a.x - b.x);
        });
        return row;
    });
}

function draftProfileMatches(rows = [], profile = {}) {
    if (rows.length !== profile.rows?.length) return false;
    return profile.rows.every((profileRow, rowIndex) => {
        const row = rows[rowIndex] || {};
        const blockIds = new Set([...Object.keys(row), ...Object.keys(profileRow || {})]);
        for (const blockId of blockIds) {
            const actual = row[blockId] || [];
            const expected = profileRow?.[blockId] || [];
            if (actual.length !== expected.length) return false;
        }
        return true;
    });
}

function applyDraftProfile(rows = [], profile = {}) {
    profile.rows.forEach((profileRow, rowIndex) => {
        for (const [blockId, ids] of Object.entries(profileRow || {})) {
            (rows[rowIndex]?.[blockId] || []).forEach((cell, ordinal) => {
                assignCellSemanticId(cell, ids[ordinal]);
            });
        }
    });
}

function assignCellSemanticId(cell, id) {
    if (!cell || !id) return;
    if (cell.stack?.length) {
        cell.id = id;
        cell.stack[0].id = 'up';
        if (cell.stack[1]) cell.stack[1].id = 'down';
    } else {
        cell.id = id;
    }
}

function countSemanticKeys(cells = []) {
    let count = 0;
    for (const cell of cells || []) {
        if (Array.isArray(cell.stack) && cell.stack.length) {
            count += cell.stack.filter((child) => child.id).length;
        } else if (cell.id) {
            count += 1;
        }
    }
    return count;
}

function inferredRowSpanForKey(key = {}, metrics = {}) {
    if (key.rowSpan && key.rowSpan > 1) return key.rowSpan;
    const { keyHeight, rowPitch } = metrics;
    if (!Number.isFinite(key.h) || !Number.isFinite(keyHeight) || !Number.isFinite(rowPitch)) return 1;
    for (let span = 2; span <= 4; span++) {
        const expected = keyHeight + (span - 1) * rowPitch;
        if (Math.abs(key.h - expected) <= 0.08) return span;
    }
    return 1;
}

function draftItemForKey(key, metrics = {}) {
    const { colPitch, gap, keyHeight, rowPitch, explicitX } = metrics;
    const item = {};
    if (explicitX && Number.isFinite(key.x)) item.x = round(key.x, 4);
    if (explicitX && Number.isFinite(key.y)) item.y = round(key.y, 4);
    const widthU = (key.w + gap) / colPitch;
    const quarter = Math.round(widthU * 4) / 4;
    const quarterWidth = quarter * colPitch - gap;
    if (Math.abs(key.w - quarterWidth) <= 0.02) item.u = normalizedUnit(quarter);
    else item.w = round(key.w, 4);
    if (key.id) item.id = key.id;
    const rowSpan = inferredRowSpanForKey(key, metrics);
    if (rowSpan > 1) item.rowSpan = rowSpan;
    const expectedH = rowSpan > 1
        ? keyHeight + (rowSpan - 1) * rowPitch
        : keyHeight;
    if (Number.isFinite(key.h) && (!Number.isFinite(expectedH) || Math.abs(key.h - expectedH) > 0.05)) {
        item.h = round(key.h, 4);
    }
    if (Array.isArray(key.stack) && key.stack.length) {
        item.stack = key.stack.map((child, stackIndex) => {
            const out = {
                yOffset: round(child.y - key.y, 4),
                h: round(child.h, 4)
            };
            if (child.id) out.id = child.id;
            else if (stackIndex === 0) out.id = 'up';
            else if (stackIndex === 1) out.id = 'down';
            return out;
        });
    }
    return item;
}

function compactDraftItems(items) {
    const out = [];
    for (const item of items || []) {
        const last = out[out.length - 1];
        if (canCompactRepeatDraftItem(item) && canCompactRepeatDraftItem(last) && item.u === last.u) {
            appendRepeatedDraftItem(last, item);
        } else {
            out.push({ ...item });
        }
    }
    return out;
}

function canCompactRepeatDraftItem(item) {
    return !!item
        && item.u != null
        && item.w == null
        && item.x == null
        && item.y == null
        && item.h == null
        && item.skip == null
        && item.flex == null
        && item.rowSpan == null
        && item.stack == null
        && item.editId == null;
}

function appendRepeatedDraftItem(last, item) {
    const lastRepeat = last.repeat || 1;
    const itemRepeat = item.repeat || 1;
    const mergedIds = draftItemIds(last, lastRepeat).concat(draftItemIds(item, itemRepeat));
    last.repeat = lastRepeat + itemRepeat;

    if (mergedIds.some((id) => id)) {
        last.ids = mergedIds.map((id) => id || null);
        delete last.id;
    } else {
        delete last.ids;
    }
}

function draftItemIds(item, repeat) {
    if (Array.isArray(item.ids)) {
        return Array.from({ length: repeat }, (_, i) => item.ids[i] || null);
    }
    if (item.id) {
        return Array.from({ length: repeat }, (_, i) => (i === 0 ? item.id : null));
    }
    return Array.from({ length: repeat }, () => null);
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
            if (!Array.isArray(items)) continue;
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

function uniqueRects(rects, tolerance = 0.5) {
    const out = [];
    for (const rect of rects || []) {
        if (out.some((existing) =>
            closeEnough(existing.x, rect.x, tolerance)
            && closeEnough(existing.y, rect.y, tolerance)
            && closeEnough(existing.w, rect.w, tolerance)
            && closeEnough(existing.h, rect.h, tolerance))) {
            continue;
        }
        out.push(rect);
    }
    return out;
}

function closeEnough(a, b, tolerance) {
    return Math.abs(a - b) <= tolerance;
}

function pathDataBounds(d = '') {
    const tokens = String(d || '').match(/[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
    if (!tokens.length) return null;
    let i = 0;
    let command = '';
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    const points = [];
    const add = (px, py) => {
        if (Number.isFinite(px) && Number.isFinite(py)) points.push({ x: px, y: py });
    };
    const isCommand = (token) => /^[A-Za-z]$/.test(token || '');
    const hasNumber = () => i < tokens.length && !isCommand(tokens[i]);
    const read = () => Number(tokens[i++]);
    const point = (relative = false) => {
        const px = read();
        const py = read();
        return relative ? { x: x + px, y: y + py } : { x: px, y: py };
    };

    while (i < tokens.length) {
        const token = tokens[i++];
        if (isCommand(token)) command = token;
        else {
            i -= 1;
            if (!command) break;
        }
        const lower = command.toLowerCase();
        const relative = command === lower;

        if (lower === 'z') {
            x = startX;
            y = startY;
            add(x, y);
            continue;
        }
        if (lower === 'm') {
            let first = true;
            while (i + 1 < tokens.length && hasNumber()) {
                const p = point(relative);
                x = p.x;
                y = p.y;
                if (first) {
                    startX = x;
                    startY = y;
                    first = false;
                }
                add(x, y);
                command = relative ? 'l' : 'L';
                if (i >= tokens.length || isCommand(tokens[i])) break;
            }
            continue;
        }
        if (lower === 'l' || lower === 't') {
            while (i + 1 < tokens.length && hasNumber()) {
                const p = point(relative);
                x = p.x;
                y = p.y;
                add(x, y);
                if (i >= tokens.length || isCommand(tokens[i])) break;
            }
            continue;
        }
        if (lower === 'h') {
            while (hasNumber()) {
                const value = read();
                x = relative ? x + value : value;
                add(x, y);
                if (i >= tokens.length || isCommand(tokens[i])) break;
            }
            continue;
        }
        if (lower === 'v') {
            while (hasNumber()) {
                const value = read();
                y = relative ? y + value : value;
                add(x, y);
                if (i >= tokens.length || isCommand(tokens[i])) break;
            }
            continue;
        }
        if (lower === 'c') {
            while (i + 5 < tokens.length && hasNumber()) {
                const c1 = point(relative);
                const c2 = point(relative);
                const end = point(relative);
                add(c1.x, c1.y);
                add(c2.x, c2.y);
                add(end.x, end.y);
                x = end.x;
                y = end.y;
                if (i >= tokens.length || isCommand(tokens[i])) break;
            }
            continue;
        }
        if (lower === 's' || lower === 'q') {
            while (i + 3 < tokens.length && hasNumber()) {
                const c = point(relative);
                const end = point(relative);
                add(c.x, c.y);
                add(end.x, end.y);
                x = end.x;
                y = end.y;
                if (i >= tokens.length || isCommand(tokens[i])) break;
            }
            continue;
        }
        if (lower === 'a') {
            while (i + 6 < tokens.length && hasNumber()) {
                const rx = Math.abs(read());
                const ry = Math.abs(read());
                read(); // x-axis-rotation
                read(); // large-arc-flag
                read(); // sweep-flag
                const ex = read();
                const ey = read();
                const end = relative ? { x: x + ex, y: y + ey } : { x: ex, y: ey };
                add(x - rx, y - ry);
                add(x + rx, y + ry);
                add(end.x - rx, end.y - ry);
                add(end.x + rx, end.y + ry);
                x = end.x;
                y = end.y;
                add(x, y);
                if (i >= tokens.length || isCommand(tokens[i])) break;
            }
            continue;
        }
        break;
    }

    if (!points.length) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
        x: round(minX, 4),
        y: round(minY, 4),
        w: round(maxX - minX, 4),
        h: round(maxY - minY, 4)
    };
}

function tags(source, name) {
    const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
    return String(source || '').match(re) || [];
}

function pathDataAttr(tag) {
    const m = String(tag || '').match(/\sd\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    return String(m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim();
}

function countElementTags(source, names = []) {
    const wanted = new Set(names.map((name) => String(name || '').toLowerCase()).filter(Boolean));
    const counts = Object.fromEntries([...wanted].map((name) => [name, 0]));
    if (!wanted.size) return counts;
    const re = /<([A-Za-z][\w:.-]*)\b[^>]*>/g;
    let m;
    const svg = String(source || '');
    while ((m = re.exec(svg))) {
        const name = String(m[1] || '').toLowerCase();
        if (wanted.has(name)) counts[name] += 1;
    }
    return counts;
}

function numberAttr(value) {
    if (value == null || value === '') return NaN;
    const m = String(value).match(NUM_RE);
    return m && m.length ? Number(m[0]) : NaN;
}

function finiteNumber(...values) {
    for (const value of values) {
        if (value == null || value === '') continue;
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

function nowMs() {
    return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}
