const NUMBER_SOURCE = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][-+]?\\d+)?';
const PATH_TOKEN_RE = new RegExp(`[AaCcHhLlMmQqSsTtVvZz]|${NUMBER_SOURCE}`, 'g');
const TAG_RE = /<\/?([A-Za-z][\w:.-]*)\b[^>]*>/g;
const IDENTITY = [1, 0, 0, 1, 0, 0];
const DEFAULT_CURVE_STEPS = 12;

export function normalizeSvgGeometry(source = '', options = {}) {
    const segments = [];
    const unsupported = new Set();
    const stats = {
        elements: 0,
        paths: 0,
        primitives: 0,
        transforms: 0,
        segments: 0,
        curveSegments: 0
    };
    const stack = [{ name: '', matrix: IDENTITY }];
    const svg = String(source || '');
    let match;

    while ((match = TAG_RE.exec(svg))) {
        const tag = match[0];
        if (/^<\//.test(tag)) {
            if (stack.length > 1) stack.pop();
            continue;
        }
        if (/^<\s*(?:defs|style|metadata)\b/i.test(tag)) {
            if (!/\/\s*>$/.test(tag)) stack.push({ name: localName(match[1]), matrix: stack.at(-1).matrix, ignored: true });
            continue;
        }

        const name = localName(match[1]);
        const parent = stack.at(-1);
        const attrs = parseAttributes(tag);
        const ownMatrix = parseSvgTransform(attrs.transform || '');
        const matrix = multiplyMatrices(parent.matrix, ownMatrix);
        if (attrs.transform) stats.transforms += 1;
        const ignored = parent.ignored || hiddenElement(attrs);
        const selfClosing = /\/\s*>$/.test(tag);

        if (!ignored) {
            const before = segments.length;
            if (name === 'path') {
                stats.paths += 1;
                appendPathSegments(segments, attrs.d || '', matrix, options);
            } else if (name === 'line') {
                appendLineElement(segments, attrs, matrix);
            } else if (name === 'polyline' || name === 'polygon') {
                appendPolyElement(segments, attrs, matrix, name === 'polygon');
            } else if (name === 'rect') {
                appendRectElement(segments, attrs, matrix, options);
            } else if (name === 'circle' || name === 'ellipse') {
                appendEllipseElement(segments, attrs, matrix, options);
            } else if (!['g', 'svg', 'title', 'desc'].includes(name)) {
                unsupported.add(name);
            }
            if (segments.length > before) {
                stats.elements += 1;
                if (name !== 'path') stats.primitives += 1;
            }
        }

        if (!selfClosing) stack.push({ name, matrix, ignored });
    }

    const normalized = segments
        .filter(validSegment)
        .map((segment, i) => ({ i, ...segment }));
    stats.segments = normalized.length;
    stats.curveSegments = normalized.filter((segment) => segment.curve).length;
    return { segments: normalized, unsupported: [...unsupported].sort(), stats };
}

export function parseSvgPathSegments(d = '', options = {}) {
    const out = [];
    appendPathSegments(out, d, IDENTITY, options);
    return out.map((segment, i) => ({ i, ...segment }));
}

export function parseSvgTransform(source = '') {
    const re = /([A-Za-z]+)\s*\(([^)]*)\)/g;
    let matrix = IDENTITY;
    let match;
    while ((match = re.exec(String(source || '')))) {
        const values = numbers(match[2]);
        const name = match[1].toLowerCase();
        let next = IDENTITY;
        if (name === 'matrix' && values.length >= 6) {
            next = values.slice(0, 6);
        } else if (name === 'translate' && values.length) {
            next = [1, 0, 0, 1, values[0], values[1] || 0];
        } else if (name === 'scale' && values.length) {
            next = [values[0], 0, 0, values[1] ?? values[0], 0, 0];
        } else if (name === 'rotate' && values.length) {
            const angle = values[0] * Math.PI / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const rotate = [cos, sin, -sin, cos, 0, 0];
            if (values.length >= 3) {
                next = multiplyMatrices(
                    multiplyMatrices([1, 0, 0, 1, values[1], values[2]], rotate),
                    [1, 0, 0, 1, -values[1], -values[2]]
                );
            } else {
                next = rotate;
            }
        } else if (name === 'skewx' && values.length) {
            next = [1, 0, Math.tan(values[0] * Math.PI / 180), 1, 0, 0];
        } else if (name === 'skewy' && values.length) {
            next = [1, Math.tan(values[0] * Math.PI / 180), 0, 1, 0, 0];
        }
        matrix = multiplyMatrices(matrix, next);
    }
    return matrix;
}

export function multiplyMatrices(left = IDENTITY, right = IDENTITY) {
    const [a, b, c, d, e, f] = left;
    const [g, h, i, j, k, l] = right;
    return [
        a * g + c * h,
        b * g + d * h,
        a * i + c * j,
        b * i + d * j,
        a * k + c * l + e,
        b * k + d * l + f
    ];
}

function appendPathSegments(out, d, matrix, options) {
    const tokens = String(d || '').match(PATH_TOKEN_RE) || [];
    let i = 0;
    let command = '';
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let lastCubic = null;
    let lastQuad = null;
    const curveSteps = positiveInt(options.curveSteps, DEFAULT_CURVE_STEPS);
    const isCommand = (token) => /^[A-Za-z]$/.test(token || '');
    const hasNumber = () => i < tokens.length && !isCommand(tokens[i]);
    const read = () => Number(tokens[i++]);
    const readPoint = (relative) => {
        const px = read();
        const py = read();
        return relative ? { x: x + px, y: y + py } : { x: px, y: py };
    };
    const line = (nx, ny, curve = false) => {
        addSegment(out, { x, y }, { x: nx, y: ny }, matrix, curve);
        x = nx;
        y = ny;
    };

    while (i < tokens.length) {
        if (isCommand(tokens[i])) command = tokens[i++];
        if (!command) break;
        const lower = command.toLowerCase();
        const relative = command === lower;

        if (lower === 'z') {
            line(startX, startY);
            lastCubic = null;
            lastQuad = null;
            command = '';
            continue;
        }
        if (lower === 'm') {
            if (i + 1 >= tokens.length || !hasNumber()) break;
            const first = readPoint(relative);
            x = first.x;
            y = first.y;
            startX = x;
            startY = y;
            command = relative ? 'l' : 'L';
            while (i + 1 < tokens.length && hasNumber()) {
                const point = readPoint(relative);
                line(point.x, point.y);
            }
            lastCubic = null;
            lastQuad = null;
            continue;
        }
        if (lower === 'l') {
            while (i + 1 < tokens.length && hasNumber()) {
                const point = readPoint(relative);
                line(point.x, point.y);
            }
            lastCubic = null;
            lastQuad = null;
            continue;
        }
        if (lower === 'h') {
            while (hasNumber()) line(relative ? x + read() : read(), y);
            lastCubic = null;
            lastQuad = null;
            continue;
        }
        if (lower === 'v') {
            while (hasNumber()) line(x, relative ? y + read() : read());
            lastCubic = null;
            lastQuad = null;
            continue;
        }
        if (lower === 'c') {
            while (i + 5 < tokens.length && hasNumber()) {
                const p0 = { x, y };
                const c1 = readPoint(relative);
                const c2 = readPoint(relative);
                const end = readPoint(relative);
                appendCubic(out, p0, c1, c2, end, matrix, curveSteps);
                x = end.x;
                y = end.y;
                lastCubic = c2;
                lastQuad = null;
            }
            continue;
        }
        if (lower === 's') {
            while (i + 3 < tokens.length && hasNumber()) {
                const p0 = { x, y };
                const c1 = lastCubic ? { x: x * 2 - lastCubic.x, y: y * 2 - lastCubic.y } : p0;
                const c2 = readPoint(relative);
                const end = readPoint(relative);
                appendCubic(out, p0, c1, c2, end, matrix, curveSteps);
                x = end.x;
                y = end.y;
                lastCubic = c2;
                lastQuad = null;
            }
            continue;
        }
        if (lower === 'q') {
            while (i + 3 < tokens.length && hasNumber()) {
                const p0 = { x, y };
                const control = readPoint(relative);
                const end = readPoint(relative);
                appendQuadratic(out, p0, control, end, matrix, curveSteps);
                x = end.x;
                y = end.y;
                lastQuad = control;
                lastCubic = null;
            }
            continue;
        }
        if (lower === 't') {
            while (i + 1 < tokens.length && hasNumber()) {
                const p0 = { x, y };
                const control = lastQuad ? { x: x * 2 - lastQuad.x, y: y * 2 - lastQuad.y } : p0;
                const end = readPoint(relative);
                appendQuadratic(out, p0, control, end, matrix, curveSteps);
                x = end.x;
                y = end.y;
                lastQuad = control;
                lastCubic = null;
            }
            continue;
        }
        if (lower === 'a') {
            while (i + 6 < tokens.length && hasNumber()) {
                const rx = Math.abs(read());
                const ry = Math.abs(read());
                const rotation = read();
                const largeArc = read() !== 0;
                const sweep = read() !== 0;
                const ex = read();
                const ey = read();
                const end = relative ? { x: x + ex, y: y + ey } : { x: ex, y: ey };
                appendArc(out, { x, y }, end, rx, ry, rotation, largeArc, sweep, matrix, curveSteps);
                x = end.x;
                y = end.y;
                lastCubic = null;
                lastQuad = null;
            }
            continue;
        }
        break;
    }
}

function appendLineElement(out, attrs, matrix) {
    addSegment(out,
        { x: number(attrs.x1), y: number(attrs.y1) },
        { x: number(attrs.x2), y: number(attrs.y2) },
        matrix);
}

function appendPolyElement(out, attrs, matrix, close) {
    const values = numbers(attrs.points || '');
    const points = [];
    for (let i = 0; i + 1 < values.length; i += 2) points.push({ x: values[i], y: values[i + 1] });
    for (let i = 1; i < points.length; i++) addSegment(out, points[i - 1], points[i], matrix);
    if (close && points.length > 2) addSegment(out, points.at(-1), points[0], matrix);
}

function appendRectElement(out, attrs, matrix, options) {
    const x = number(attrs.x, 0);
    const y = number(attrs.y, 0);
    const w = number(attrs.width);
    const h = number(attrs.height);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return;
    const rx = Math.min(Math.abs(number(attrs.rx, attrs.ry, 0)), w / 2);
    const ry = Math.min(Math.abs(number(attrs.ry, attrs.rx, 0)), h / 2);
    if (!rx && !ry) {
        const points = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
        for (let i = 0; i < points.length; i++) addSegment(out, points[i], points[(i + 1) % points.length], matrix);
        return;
    }
    const steps = Math.max(2, Math.ceil(positiveInt(options.curveSteps, DEFAULT_CURVE_STEPS) / 4));
    const points = [
        { x: x + rx, y }, { x: x + w - rx, y },
        ...quarterEllipse(x + w - rx, y + ry, rx, ry, -Math.PI / 2, 0, steps),
        { x: x + w, y: y + h - ry },
        ...quarterEllipse(x + w - rx, y + h - ry, rx, ry, 0, Math.PI / 2, steps),
        { x: x + rx, y: y + h },
        ...quarterEllipse(x + rx, y + h - ry, rx, ry, Math.PI / 2, Math.PI, steps),
        { x, y: y + ry },
        ...quarterEllipse(x + rx, y + ry, rx, ry, Math.PI, Math.PI * 1.5, steps)
    ];
    for (let i = 1; i < points.length; i++) addSegment(out, points[i - 1], points[i], matrix, true);
    addSegment(out, points.at(-1), points[0], matrix, true);
}

function appendEllipseElement(out, attrs, matrix, options) {
    const isCircle = attrs.r != null;
    const cx = number(attrs.cx, 0);
    const cy = number(attrs.cy, 0);
    const rx = Math.abs(number(isCircle ? attrs.r : attrs.rx));
    const ry = Math.abs(number(isCircle ? attrs.r : attrs.ry));
    if (![cx, cy, rx, ry].every(Number.isFinite) || !rx || !ry) return;
    const steps = Math.max(8, positiveInt(options.curveSteps, DEFAULT_CURVE_STEPS) * 2);
    let prev = { x: cx + rx, y: cy };
    for (let i = 1; i <= steps; i++) {
        const angle = Math.PI * 2 * i / steps;
        const point = { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
        addSegment(out, prev, point, matrix, true);
        prev = point;
    }
}

function appendCubic(out, p0, p1, p2, p3, matrix, steps) {
    let prev = p0;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const point = {
            x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
            y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y
        };
        addSegment(out, prev, point, matrix, true);
        prev = point;
    }
}

function appendQuadratic(out, p0, p1, p2, matrix, steps) {
    let prev = p0;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const point = {
            x: mt ** 2 * p0.x + 2 * mt * t * p1.x + t ** 2 * p2.x,
            y: mt ** 2 * p0.y + 2 * mt * t * p1.y + t ** 2 * p2.y
        };
        addSegment(out, prev, point, matrix, true);
        prev = point;
    }
}

function appendArc(out, start, end, rx0, ry0, rotation, largeArc, sweep, matrix, baseSteps) {
    if (!rx0 || !ry0 || (start.x === end.x && start.y === end.y)) {
        addSegment(out, start, end, matrix);
        return;
    }
    const phi = rotation * Math.PI / 180;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const dx = (start.x - end.x) / 2;
    const dy = (start.y - end.y) / 2;
    const x1 = cosPhi * dx + sinPhi * dy;
    const y1 = -sinPhi * dx + cosPhi * dy;
    let rx = rx0;
    let ry = ry0;
    const scale = x1 ** 2 / rx ** 2 + y1 ** 2 / ry ** 2;
    if (scale > 1) {
        const factor = Math.sqrt(scale);
        rx *= factor;
        ry *= factor;
    }
    const sign = largeArc === sweep ? -1 : 1;
    const numerator = Math.max(0, rx ** 2 * ry ** 2 - rx ** 2 * y1 ** 2 - ry ** 2 * x1 ** 2);
    const denominator = rx ** 2 * y1 ** 2 + ry ** 2 * x1 ** 2;
    const factor = denominator ? sign * Math.sqrt(numerator / denominator) : 0;
    const cx1 = factor * rx * y1 / ry;
    const cy1 = factor * -ry * x1 / rx;
    const cx = cosPhi * cx1 - sinPhi * cy1 + (start.x + end.x) / 2;
    const cy = sinPhi * cx1 + cosPhi * cy1 + (start.y + end.y) / 2;
    const vectorAngle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const ux = (x1 - cx1) / rx;
    const uy = (y1 - cy1) / ry;
    const vx = (-x1 - cx1) / rx;
    const vy = (-y1 - cy1) / ry;
    let startAngle = vectorAngle(1, 0, ux, uy);
    let delta = vectorAngle(ux, uy, vx, vy);
    if (!sweep && delta > 0) delta -= Math.PI * 2;
    if (sweep && delta < 0) delta += Math.PI * 2;
    const steps = Math.max(2, Math.ceil(baseSteps * Math.abs(delta) / (Math.PI * 2)));
    let prev = start;
    for (let i = 1; i <= steps; i++) {
        const angle = startAngle + delta * i / steps;
        const point = {
            x: cx + cosPhi * rx * Math.cos(angle) - sinPhi * ry * Math.sin(angle),
            y: cy + sinPhi * rx * Math.cos(angle) + cosPhi * ry * Math.sin(angle)
        };
        addSegment(out, prev, point, matrix, true);
        prev = point;
    }
}

function addSegment(out, start, end, matrix, curve = false) {
    if (![start?.x, start?.y, end?.x, end?.y].every(Number.isFinite)) return;
    const a = transformPoint(start, matrix);
    const b = transformPoint(end, matrix);
    out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, curve: !!curve });
}

function transformPoint(point, matrix) {
    const [a, b, c, d, e, f] = matrix;
    return {
        x: a * point.x + c * point.y + e,
        y: b * point.x + d * point.y + f
    };
}

function quarterEllipse(cx, cy, rx, ry, from, to, steps) {
    const out = [];
    for (let i = 1; i <= steps; i++) {
        const angle = from + (to - from) * i / steps;
        out.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
    }
    return out;
}

function parseAttributes(source = '') {
    const attrs = {};
    const re = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let match;
    while ((match = re.exec(source))) attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
    return attrs;
}

function hiddenElement(attrs) {
    const style = String(attrs.style || '').toLowerCase();
    return String(attrs.display || '').toLowerCase() === 'none'
        || String(attrs.visibility || '').toLowerCase() === 'hidden'
        || /(?:^|;)\s*display\s*:\s*none(?:;|$)/.test(style)
        || /(?:^|;)\s*visibility\s*:\s*hidden(?:;|$)/.test(style);
}

function validSegment(segment) {
    return [segment.x1, segment.y1, segment.x2, segment.y2].every(Number.isFinite)
        && Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) > 1e-9;
}

function numbers(source = '') {
    return String(source || '').match(new RegExp(NUMBER_SOURCE, 'g'))?.map(Number).filter(Number.isFinite) || [];
}

function number(...values) {
    for (const value of values) {
        if (value == null || value === '') continue;
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return NaN;
}

function positiveInt(value, fallback) {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function localName(name = '') {
    return String(name || '').split(':').at(-1).toLowerCase();
}
