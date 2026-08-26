import { rebuildFocusPath } from './focusPath.js?v=20260826-1';

export const IMPORT_SIMPLIFICATION_TOLERANCE_PX = 0.75;
export const IMPORT_SIMPLIFICATION_TARGET_POINTS = 48;
export const IMPORT_MAX_POINTS = 96;

const ARTBOARD_SIZE = 480;
const DEFAULT_EXPORT_SIZE = 1080;
const EPSILON = 1e-9;
const COMMAND_ARGUMENTS = Object.freeze({
    m: 2,
    l: 2,
    h: 1,
    v: 1,
    c: 6,
    s: 4,
    q: 4,
    t: 2,
    a: 7,
    z: 0
});

const point = (x, y) => ({ x, y });
const copyPoint = (value) => point(value.x, value.y);
const add = (a, b) => point(a.x + b.x, a.y + b.y);
const subtract = (a, b) => point(a.x - b.x, a.y - b.y);
const scale = (value, amount) => point(value.x * amount, value.y * amount);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const length = (value) => Math.hypot(value.x, value.y);
const distance = (a, b) => length(subtract(a, b));
const distanceSquared = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function unit(value, fallback = point(1, 0)) {
    const magnitude = length(value);
    return magnitude <= EPSILON ? copyPoint(fallback) : scale(value, 1 / magnitude);
}

function lerpPoint(first, second, amount) {
    return point(
        first.x + (second.x - first.x) * amount,
        first.y + (second.y - first.y) * amount
    );
}

function lineSegment(start, end, role = 'source') {
    return {
        start: copyPoint(start),
        control1: lerpPoint(start, end, 1 / 3),
        control2: lerpPoint(start, end, 2 / 3),
        end: copyPoint(end),
        kind: 'line',
        role
    };
}

function cubicSegment(start, control1, control2, end, kind = 'curve', role = 'source') {
    return {
        start: copyPoint(start),
        control1: copyPoint(control1),
        control2: copyPoint(control2),
        end: copyPoint(end),
        kind,
        role
    };
}

function cubicPoint(segment, t) {
    const inverse = 1 - t;
    const inverse2 = inverse * inverse;
    const t2 = t * t;
    return point(
        segment.start.x * inverse2 * inverse
            + 3 * segment.control1.x * inverse2 * t
            + 3 * segment.control2.x * inverse * t2
            + segment.end.x * t2 * t,
        segment.start.y * inverse2 * inverse
            + 3 * segment.control1.y * inverse2 * t
            + 3 * segment.control2.y * inverse * t2
            + segment.end.y * t2 * t
    );
}

function splitCubic(segment, t) {
    const p01 = lerpPoint(segment.start, segment.control1, t);
    const p12 = lerpPoint(segment.control1, segment.control2, t);
    const p23 = lerpPoint(segment.control2, segment.end, t);
    const p012 = lerpPoint(p01, p12, t);
    const p123 = lerpPoint(p12, p23, t);
    const middle = lerpPoint(p012, p123, t);
    return [
        cubicSegment(
            segment.start,
            p01,
            p012,
            middle,
            segment.kind,
            segment.role
        ),
        cubicSegment(
            middle,
            p123,
            p23,
            segment.end,
            segment.kind,
            segment.role
        )
    ];
}

function reflected(control, around) {
    return point(around.x * 2 - control.x, around.y * 2 - control.y);
}

function vectorAngle(first, second) {
    return Math.atan2(
        first.x * second.y - first.y * second.x,
        dot(first, second)
    );
}

function arcToCubics(start, rxValue, ryValue, rotationValue, largeArc, sweep, end) {
    let rx = Math.abs(rxValue);
    let ry = Math.abs(ryValue);
    if (rx <= EPSILON || ry <= EPSILON || distance(start, end) <= EPSILON) {
        return [lineSegment(start, end)];
    }

    const rotation = rotationValue * Math.PI / 180;
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);
    const midpoint = point((start.x - end.x) / 2, (start.y - end.y) / 2);
    const local = point(
        cosRotation * midpoint.x + sinRotation * midpoint.y,
        -sinRotation * midpoint.x + cosRotation * midpoint.y
    );
    const lambda = local.x * local.x / (rx * rx) + local.y * local.y / (ry * ry);
    if (lambda > 1) {
        const correction = Math.sqrt(lambda);
        rx *= correction;
        ry *= correction;
    }

    const rx2 = rx * rx;
    const ry2 = ry * ry;
    const numerator = Math.max(
        0,
        rx2 * ry2 - rx2 * local.y * local.y - ry2 * local.x * local.x
    );
    const denominator = Math.max(
        EPSILON,
        rx2 * local.y * local.y + ry2 * local.x * local.x
    );
    const sign = Boolean(largeArc) === Boolean(sweep) ? -1 : 1;
    const coefficient = sign * Math.sqrt(numerator / denominator);
    const localCenter = point(
        coefficient * rx * local.y / ry,
        coefficient * -ry * local.x / rx
    );
    const center = point(
        cosRotation * localCenter.x - sinRotation * localCenter.y
            + (start.x + end.x) / 2,
        sinRotation * localCenter.x + cosRotation * localCenter.y
            + (start.y + end.y) / 2
    );

    const unitStart = point(
        (local.x - localCenter.x) / rx,
        (local.y - localCenter.y) / ry
    );
    const localEnd = point(
        (-local.x - localCenter.x) / rx,
        (-local.y - localCenter.y) / ry
    );
    const startAngle = vectorAngle(point(1, 0), unitStart);
    let deltaAngle = vectorAngle(unitStart, localEnd);
    if (!sweep && deltaAngle > 0) deltaAngle -= Math.PI * 2;
    if (sweep && deltaAngle < 0) deltaAngle += Math.PI * 2;
    const count = Math.max(1, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 2)));
    const step = deltaAngle / count;
    const map = (value) => point(
        center.x + cosRotation * rx * value.x - sinRotation * ry * value.y,
        center.y + sinRotation * rx * value.x + cosRotation * ry * value.y
    );
    const segments = [];
    let segmentStart = copyPoint(start);
    for (let index = 0; index < count; index += 1) {
        const angle1 = startAngle + step * index;
        const angle2 = angle1 + step;
        const alpha = 4 / 3 * Math.tan((angle2 - angle1) / 4);
        const unit1 = point(Math.cos(angle1), Math.sin(angle1));
        const unit2 = point(Math.cos(angle2), Math.sin(angle2));
        const control1 = map(point(
            unit1.x - alpha * unit1.y,
            unit1.y + alpha * unit1.x
        ));
        const control2 = map(point(
            unit2.x + alpha * unit2.y,
            unit2.y - alpha * unit2.x
        ));
        const segmentEnd = index === count - 1 ? copyPoint(end) : map(unit2);
        segments.push(cubicSegment(segmentStart, control1, control2, segmentEnd));
        segmentStart = segmentEnd;
    }
    return segments;
}

function tokenizePathData(pathData) {
    const source = String(pathData || '').trim();
    if (!source) throw new Error('The SVG path is empty.');
    const tokens = source.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
    const remainder = source.replace(
        /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?|[\s,]+/g,
        ''
    );
    if (remainder) throw new Error('The SVG path contains unsupported syntax.');
    return tokens;
}

export function parseSvgPathData(pathData) {
    const tokens = tokenizePathData(pathData);
    const segments = [];
    let index = 0;
    let command = null;
    let current = point(0, 0);
    let subpathStart = null;
    let previousCommand = null;
    let previousCubicControl = null;
    let previousQuadraticControl = null;
    let hasMove = false;
    let closed = false;

    const isCommand = (token) => /^[a-zA-Z]$/.test(token);
    const readNumbers = (count) => {
        if (index + count > tokens.length
            || tokens.slice(index, index + count).some(isCommand)) {
            throw new Error(`Command ${command} has incomplete coordinates.`);
        }
        const values = tokens.slice(index, index + count).map(Number);
        if (values.some((value) => !Number.isFinite(value))) {
            throw new Error(`Command ${command} contains an invalid number.`);
        }
        index += count;
        return values;
    };
    const absolutePoint = (x, y, relative) => relative
        ? point(current.x + x, current.y + y)
        : point(x, y);
    const resetControls = () => {
        previousCubicControl = null;
        previousQuadraticControl = null;
    };

    while (index < tokens.length) {
        if (isCommand(tokens[index])) command = tokens[index++];
        if (!command) throw new Error('The SVG path must begin with a move command.');
        const lower = command.toLowerCase();
        const relative = command === lower;
        if (!(lower in COMMAND_ARGUMENTS)) {
            throw new Error(`SVG path command ${command} is not supported.`);
        }
        if (lower === 'z') {
            if (!subpathStart) throw new Error('The SVG path closes before it starts.');
            if (distance(current, subpathStart) > EPSILON) {
                segments.push(lineSegment(current, subpathStart));
            }
            current = copyPoint(subpathStart);
            closed = true;
            resetControls();
            previousCommand = lower;
            command = null;
            if (index < tokens.length) {
                throw new Error('The SVG must contain one continuous path without extra subpaths.');
            }
            continue;
        }
        if (index >= tokens.length || isCommand(tokens[index])) {
            throw new Error(`Command ${command} has no coordinates.`);
        }

        let firstSet = true;
        const argumentCount = COMMAND_ARGUMENTS[lower];
        while (index < tokens.length && !isCommand(tokens[index])) {
            const values = readNumbers(argumentCount);
            if (lower === 'm') {
                const destination = absolutePoint(values[0], values[1], relative);
                if (firstSet) {
                    if (hasMove) {
                        throw new Error('The SVG must contain one continuous path without extra subpaths.');
                    }
                    current = destination;
                    subpathStart = copyPoint(destination);
                    hasMove = true;
                    resetControls();
                } else {
                    segments.push(lineSegment(current, destination));
                    current = destination;
                    resetControls();
                }
            } else {
                if (!hasMove) throw new Error('The SVG path must begin with a move command.');
                if (lower === 'l') {
                    const destination = absolutePoint(values[0], values[1], relative);
                    segments.push(lineSegment(current, destination));
                    current = destination;
                    resetControls();
                } else if (lower === 'h') {
                    const destination = point(relative ? current.x + values[0] : values[0], current.y);
                    segments.push(lineSegment(current, destination));
                    current = destination;
                    resetControls();
                } else if (lower === 'v') {
                    const destination = point(current.x, relative ? current.y + values[0] : values[0]);
                    segments.push(lineSegment(current, destination));
                    current = destination;
                    resetControls();
                } else if (lower === 'c') {
                    const control1 = absolutePoint(values[0], values[1], relative);
                    const control2 = absolutePoint(values[2], values[3], relative);
                    const destination = absolutePoint(values[4], values[5], relative);
                    segments.push(cubicSegment(current, control1, control2, destination));
                    current = destination;
                    previousCubicControl = control2;
                    previousQuadraticControl = null;
                } else if (lower === 's') {
                    const control1 = previousCommand === 'c' || previousCommand === 's'
                        ? reflected(previousCubicControl, current)
                        : copyPoint(current);
                    const control2 = absolutePoint(values[0], values[1], relative);
                    const destination = absolutePoint(values[2], values[3], relative);
                    segments.push(cubicSegment(current, control1, control2, destination));
                    current = destination;
                    previousCubicControl = control2;
                    previousQuadraticControl = null;
                } else if (lower === 'q') {
                    const quadratic = absolutePoint(values[0], values[1], relative);
                    const destination = absolutePoint(values[2], values[3], relative);
                    const control1 = add(current, scale(subtract(quadratic, current), 2 / 3));
                    const control2 = add(destination, scale(subtract(quadratic, destination), 2 / 3));
                    segments.push(cubicSegment(current, control1, control2, destination));
                    current = destination;
                    previousQuadraticControl = quadratic;
                    previousCubicControl = null;
                } else if (lower === 't') {
                    const quadratic = previousCommand === 'q' || previousCommand === 't'
                        ? reflected(previousQuadraticControl, current)
                        : copyPoint(current);
                    const destination = absolutePoint(values[0], values[1], relative);
                    const control1 = add(current, scale(subtract(quadratic, current), 2 / 3));
                    const control2 = add(destination, scale(subtract(quadratic, destination), 2 / 3));
                    segments.push(cubicSegment(current, control1, control2, destination));
                    current = destination;
                    previousQuadraticControl = quadratic;
                    previousCubicControl = null;
                } else if (lower === 'a') {
                    const destination = absolutePoint(values[5], values[6], relative);
                    const arcSegments = arcToCubics(
                        current,
                        values[0],
                        values[1],
                        values[2],
                        values[3] !== 0,
                        values[4] !== 0,
                        destination
                    );
                    segments.push(...arcSegments);
                    current = destination;
                    resetControls();
                }
            }
            previousCommand = lower === 'm' && !firstSet ? 'l' : lower;
            firstSet = false;
            if (lower === 'm') command = relative ? 'l' : 'L';
        }
    }

    if (!hasMove || !segments.length) {
        throw new Error('The SVG path must contain at least one visible segment.');
    }
    return { segments, closed, start: subpathStart, end: current };
}

const identityMatrix = () => [1, 0, 0, 1, 0, 0];

function multiplyMatrices(left, right) {
    return [
        left[0] * right[0] + left[2] * right[1],
        left[1] * right[0] + left[3] * right[1],
        left[0] * right[2] + left[2] * right[3],
        left[1] * right[2] + left[3] * right[3],
        left[0] * right[4] + left[2] * right[5] + left[4],
        left[1] * right[4] + left[3] * right[5] + left[5]
    ];
}

function transformPoint(value, matrix) {
    return point(
        matrix[0] * value.x + matrix[2] * value.y + matrix[4],
        matrix[1] * value.x + matrix[3] * value.y + matrix[5]
    );
}

function transformSegments(segments, matrix) {
    return segments.map((segment) => ({
        ...segment,
        start: transformPoint(segment.start, matrix),
        control1: transformPoint(segment.control1, matrix),
        control2: transformPoint(segment.control2, matrix),
        end: transformPoint(segment.end, matrix)
    }));
}

export function parseSvgTransform(source) {
    const text = String(source || '').trim();
    if (!text) return identityMatrix();
    let matrix = identityMatrix();
    let consumed = '';
    const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
    for (const match of text.matchAll(pattern)) {
        consumed += match[0];
        const name = match[1].toLowerCase();
        const values = match[2].trim()
            ? match[2].trim().split(/[\s,]+/).map(Number)
            : [];
        if (values.some((value) => !Number.isFinite(value))) {
            throw new Error('The SVG path has an invalid transform.');
        }
        let next;
        if (name === 'matrix' && values.length === 6) next = values;
        else if (name === 'translate' && (values.length === 1 || values.length === 2)) {
            next = [1, 0, 0, 1, values[0], values[1] || 0];
        } else if (name === 'scale' && (values.length === 1 || values.length === 2)) {
            next = [values[0], 0, 0, values[1] ?? values[0], 0, 0];
        } else if (name === 'rotate' && (values.length === 1 || values.length === 3)) {
            const radians = values[0] * Math.PI / 180;
            const rotation = [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
            if (values.length === 3) {
                const toCenter = [1, 0, 0, 1, values[1], values[2]];
                const fromCenter = [1, 0, 0, 1, -values[1], -values[2]];
                next = multiplyMatrices(multiplyMatrices(toCenter, rotation), fromCenter);
            } else next = rotation;
        } else if (name === 'skewx' && values.length === 1) {
            next = [1, 0, Math.tan(values[0] * Math.PI / 180), 1, 0, 0];
        } else if (name === 'skewy' && values.length === 1) {
            next = [1, Math.tan(values[0] * Math.PI / 180), 0, 1, 0, 0];
        } else {
            throw new Error(`SVG transform ${match[1]} is not supported.`);
        }
        matrix = multiplyMatrices(matrix, next);
    }
    const remainder = text.replace(pattern, '').replace(/[\s,]+/g, '');
    if (remainder || !consumed) throw new Error('The SVG path has an invalid transform.');
    return matrix;
}

function extractSinglePath(svgText) {
    if (typeof DOMParser === 'undefined') {
        throw new Error('SVG import requires a browser DOM parser.');
    }
    const documentNode = new DOMParser().parseFromString(String(svgText || ''), 'image/svg+xml');
    if (documentNode.querySelector('parsererror')) throw new Error('The selected file is not valid SVG.');
    const root = documentNode.documentElement;
    if (root?.localName?.toLowerCase() !== 'svg') throw new Error('The selected file is not an SVG document.');
    const graphics = [...documentNode.querySelectorAll(
        'path, rect, circle, ellipse, line, polyline, polygon, text, image, use'
    )];
    if (graphics.length !== 1
        || !['path', 'polyline', 'polygon'].includes(graphics[0].localName.toLowerCase())) {
        throw new Error('The SVG must contain exactly one path, polyline, or polygon object.');
    }
    const pathElement = graphics[0];
    const elementName = pathElement.localName.toLowerCase();
    const pathData = elementName === 'path'
        ? pathElement.getAttribute('d')
        : svgPointsToPathData(pathElement.getAttribute('points'), {
            closed: elementName === 'polygon'
        });
    if (!pathData) throw new Error('The SVG object has no geometry.');
    const transforms = [];
    let node = pathElement;
    while (node && node !== root.parentNode) {
        const transform = node.getAttribute?.('transform');
        if (transform) transforms.unshift(parseSvgTransform(transform));
        if (node === root) break;
        node = node.parentNode;
    }
    const matrix = transforms.reduce(
        (combined, transform) => multiplyMatrices(combined, transform),
        identityMatrix()
    );
    return { pathData, matrix };
}

export function svgPointsToPathData(source, { closed = false } = {}) {
    const text = String(source || '').trim();
    if (!text) throw new Error('The SVG polyline has no points.');
    const tokens = text.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
    const remainder = text.replace(
        /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?|[\s,]+/g,
        ''
    );
    if (remainder || tokens.length < 4 || tokens.length % 2 !== 0) {
        throw new Error('The SVG polyline contains invalid points.');
    }
    const values = tokens.map(Number);
    if (values.some((value) => !Number.isFinite(value))) {
        throw new Error('The SVG polyline contains invalid points.');
    }
    const commands = [`M ${values[0]} ${values[1]}`];
    for (let index = 2; index < values.length; index += 2) {
        commands.push(`L ${values[index]} ${values[index + 1]}`);
    }
    if (closed) commands.push('Z');
    return commands.join(' ');
}

function pointLineDistance(value, start, end) {
    const line = subtract(end, start);
    const lengthSquared = dot(line, line);
    if (lengthSquared <= EPSILON) return distance(value, start);
    const progress = clamp(dot(subtract(value, start), line) / lengthSquared, 0, 1);
    return distance(value, add(start, scale(line, progress)));
}

function cubicFlatness(segment) {
    return Math.max(
        pointLineDistance(segment.control1, segment.start, segment.end),
        pointLineDistance(segment.control2, segment.start, segment.end)
    );
}

function flattenSegment(segment, tolerance = 0.08, maximumDepth = 12) {
    const points = [copyPoint(segment.start)];
    const visit = (candidate, depth) => {
        if (depth >= maximumDepth || cubicFlatness(candidate) <= tolerance) {
            points.push(copyPoint(candidate.end));
            return;
        }
        const [left, right] = splitCubic(candidate, 0.5);
        visit(left, depth + 1);
        visit(right, depth + 1);
    };
    visit(segment, 0);
    return points;
}

function flattenSegments(segments, tolerance = 0.08) {
    const values = [];
    segments.forEach((segment, index) => {
        const flattened = flattenSegment(segment, tolerance);
        values.push(...(index ? flattened.slice(1) : flattened));
    });
    return values;
}

function circleContains(circle, value, tolerance = 1e-7) {
    return distanceSquared(circle.center, value) <= (circle.radius + tolerance) ** 2;
}

function diameterCircle(first, second) {
    const center = lerpPoint(first, second, 0.5);
    return { center, radius: distance(first, second) / 2 };
}

function circumcircle(first, second, third) {
    const determinant = 2 * (
        first.x * (second.y - third.y)
        + second.x * (third.y - first.y)
        + third.x * (first.y - second.y)
    );
    if (Math.abs(determinant) <= EPSILON) {
        return [diameterCircle(first, second), diameterCircle(first, third), diameterCircle(second, third)]
            .filter((circle) => circleContains(circle, first)
                && circleContains(circle, second)
                && circleContains(circle, third))
            .sort((a, b) => a.radius - b.radius)[0] || null;
    }
    const firstSquared = first.x * first.x + first.y * first.y;
    const secondSquared = second.x * second.x + second.y * second.y;
    const thirdSquared = third.x * third.x + third.y * third.y;
    const center = point(
        (firstSquared * (second.y - third.y)
            + secondSquared * (third.y - first.y)
            + thirdSquared * (first.y - second.y)) / determinant,
        (firstSquared * (third.x - second.x)
            + secondSquared * (first.x - third.x)
            + thirdSquared * (second.x - first.x)) / determinant
    );
    return { center, radius: distance(center, first) };
}

function shuffledPoints(source) {
    const values = source.map(copyPoint);
    let seed = 0x6d2b79f5;
    for (let index = values.length - 1; index > 0; index -= 1) {
        seed = (Math.imul(seed ^ (seed >>> 15), seed | 1) + 0x9e3779b9) >>> 0;
        const swapIndex = seed % (index + 1);
        [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
}

function minimumEnclosingCircle(source) {
    const values = shuffledPoints(source);
    let circle = null;
    for (let firstIndex = 0; firstIndex < values.length; firstIndex += 1) {
        const first = values[firstIndex];
        if (circle && circleContains(circle, first)) continue;
        circle = { center: copyPoint(first), radius: 0 };
        for (let secondIndex = 0; secondIndex < firstIndex; secondIndex += 1) {
            const second = values[secondIndex];
            if (circleContains(circle, second)) continue;
            circle = diameterCircle(first, second);
            for (let thirdIndex = 0; thirdIndex < secondIndex; thirdIndex += 1) {
                const third = values[thirdIndex];
                if (circleContains(circle, third)) continue;
                const candidate = circumcircle(first, second, third);
                if (candidate) circle = candidate;
            }
        }
    }
    return circle;
}

function normalizeIntoCircle(segments, center, radius) {
    const silhouette = flattenSegments(segments);
    const sourceCircle = minimumEnclosingCircle(silhouette);
    if (!sourceCircle || sourceCircle.radius <= EPSILON) {
        throw new Error('The SVG path is too small to use as a motion path.');
    }
    const factor = radius * 0.9995 / sourceCircle.radius;
    const map = (value) => point(
        center.x + (value.x - sourceCircle.center.x) * factor,
        center.y + (value.y - sourceCircle.center.y) * factor
    );
    return segments.map((segment) => ({
        ...segment,
        start: map(segment.start),
        control1: map(segment.control1),
        control2: map(segment.control2),
        end: map(segment.end)
    }));
}

function sampleSegment(segment, count = 16) {
    return Array.from({ length: count + 1 }, (_, index) => cubicPoint(segment, index / count));
}

function segmentPolylineDistance(values, polyline) {
    let maximum = 0;
    values.forEach((value) => {
        let minimum = Infinity;
        for (let index = 1; index < polyline.length; index += 1) {
            minimum = Math.min(minimum, pointLineDistance(value, polyline[index - 1], polyline[index]));
        }
        maximum = Math.max(maximum, minimum);
    });
    return maximum;
}

function mergeError(first, second, candidate) {
    const source = [...sampleSegment(first, 18), ...sampleSegment(second, 18).slice(1)];
    const fitted = sampleSegment(candidate, 40);
    return Math.max(
        segmentPolylineDistance(source, fitted),
        segmentPolylineDistance(fitted, source)
    );
}

function fitMergedCubic(first, second) {
    const source = [...sampleSegment(first, 12), ...sampleSegment(second, 12).slice(1)];
    const lengths = [];
    let total = 0;
    for (let index = 0; index < source.length; index += 1) {
        if (index) total += distance(source[index - 1], source[index]);
        lengths.push(total);
    }
    const start = first.start;
    const end = second.end;
    const startDirection = unit(subtract(first.control1, start), subtract(first.end, start));
    const endDirection = unit(subtract(end, second.control2), subtract(end, second.start));
    let c00 = 0;
    let c01 = 0;
    let c11 = 0;
    let x0 = 0;
    let x1 = 0;
    source.forEach((value, index) => {
        const t = total <= EPSILON ? index / (source.length - 1) : lengths[index] / total;
        const inverse = 1 - t;
        const b0 = inverse ** 3;
        const b1 = 3 * inverse * inverse * t;
        const b2 = 3 * inverse * t * t;
        const b3 = t ** 3;
        const baseline = add(scale(start, b0 + b1), scale(end, b2 + b3));
        const delta = subtract(value, baseline);
        const firstBasis = scale(startDirection, b1);
        const secondBasis = scale(endDirection, -b2);
        c00 += dot(firstBasis, firstBasis);
        c01 += dot(firstBasis, secondBasis);
        c11 += dot(secondBasis, secondBasis);
        x0 += dot(firstBasis, delta);
        x1 += dot(secondBasis, delta);
    });
    const determinant = c00 * c11 - c01 * c01;
    const chord = Math.max(distance(start, end), total / 3, EPSILON);
    let firstLength = chord / 3;
    let secondLength = chord / 3;
    if (Math.abs(determinant) > EPSILON) {
        firstLength = (x0 * c11 - x1 * c01) / determinant;
        secondLength = (c00 * x1 - c01 * x0) / determinant;
    }
    firstLength = clamp(firstLength, 0, chord * 4);
    secondLength = clamp(secondLength, 0, chord * 4);
    return cubicSegment(
        start,
        add(start, scale(startDirection, firstLength)),
        subtract(end, scale(endDirection, secondLength)),
        end,
        'curve',
        'source'
    );
}

function mergeCandidate(first, second, tolerance) {
    if (first.role !== 'source' || second.role !== 'source') return null;
    if (first.kind !== second.kind) return null;
    if (first.kind === 'line') {
        const middleError = pointLineDistance(first.end, first.start, second.end);
        const firstDirection = unit(subtract(first.end, first.start));
        const secondDirection = unit(subtract(second.end, second.start));
        if (middleError > tolerance || dot(firstDirection, secondDirection) < 0.9995) return null;
        return lineSegment(first.start, second.end);
    }
    const incoming = unit(subtract(first.end, first.control2));
    const outgoing = unit(subtract(second.control1, second.start));
    if (dot(incoming, outgoing) < Math.cos(5 * Math.PI / 180)) return null;
    const candidate = fitMergedCubic(first, second);
    return mergeError(first, second, candidate) <= tolerance ? candidate : null;
}

export function simplifyImportedSegments(source, {
    tolerance = IMPORT_SIMPLIFICATION_TOLERANCE_PX * ARTBOARD_SIZE / DEFAULT_EXPORT_SIZE,
    target = IMPORT_SIMPLIFICATION_TARGET_POINTS,
    maximum = IMPORT_MAX_POINTS
} = {}) {
    let segments = source
        .filter((segment) => distance(segment.start, segment.end) > EPSILON
            || length(subtract(segment.control1, segment.start)) > EPSILON
            || length(subtract(segment.control2, segment.end)) > EPSILON)
        .map((segment) => cubicSegment(
            segment.start,
            segment.control1,
            segment.control2,
            segment.end,
            segment.kind,
            segment.role
        ));
    let pass = 0;
    let changed = true;
    while (segments.length > target && changed) {
        changed = false;
        const next = [];
        const offset = pass % 2;
        let index = 0;
        if (offset && segments.length) next.push(segments[index++]);
        while (index < segments.length) {
            const first = segments[index];
            const second = segments[index + 1];
            const merged = second ? mergeCandidate(first, second, tolerance) : null;
            if (merged) {
                next.push(merged);
                index += 2;
                changed = true;
            } else {
                next.push(first);
                index += 1;
            }
        }
        segments = next;
        pass += 1;
    }
    if (segments.length > maximum) {
        throw new Error(
            `The path remains too detailed (${segments.length} points). The maximum is ${maximum}.`
        );
    }
    return segments;
}

function maximumDistanceInsideCircle(anchor, direction, center, radius) {
    const normalized = unit(direction);
    const offset = subtract(anchor, center);
    const projection = dot(offset, normalized);
    const discriminant = Math.max(0, projection * projection - (dot(offset, offset) - radius * radius));
    return Math.max(0, -projection + Math.sqrt(discriminant));
}

function insideHandle(anchor, direction, preferredLength, center, radius) {
    const normalized = unit(direction);
    const available = maximumDistanceInsideCircle(anchor, normalized, center, radius);
    return add(anchor, scale(normalized, Math.min(preferredLength, available * 0.98)));
}

function constrainToCircle(value, center, radius, ratio = 1) {
    const offset = subtract(value, center);
    const magnitude = length(offset);
    const maximum = radius * ratio;
    return magnitude <= maximum || magnitude <= EPSILON
        ? copyPoint(value)
        : add(center, scale(offset, maximum / magnitude));
}

function createSmoothClosure(source, center, radius) {
    const first = source[0];
    const last = source[source.length - 1];
    const start = first.start;
    const end = last.end;
    const chord = subtract(start, end);
    const chordLength = Math.max(length(chord), radius * 0.04);
    const sourcePoints = flattenSegments(source, 0.4);
    const centroid = scale(
        sourcePoints.reduce((sum, value) => add(sum, value), point(0, 0)),
        1 / sourcePoints.length
    );
    const chordDirection = unit(chord);
    let normal = point(-chordDirection.y, chordDirection.x);
    const chordMiddle = lerpPoint(end, start, 0.5);
    if (dot(subtract(centroid, chordMiddle), normal) > 0) normal = scale(normal, -1);
    const bulge = clamp(chordLength * 0.25, radius * 0.08, radius * 0.28);
    const middle = constrainToCircle(add(chordMiddle, scale(normal, bulge)), center, radius, 0.94);
    const endDirection = unit(subtract(end, last.control2), chordDirection);
    const startDirection = unit(subtract(first.control1, start), chordDirection);
    const middleDirection = unit(subtract(start, end), chordDirection);
    const endpointHandleLength = Math.min(chordLength * 0.28, radius * 0.3);
    const middleHandleLength = Math.min(chordLength * 0.22, radius * 0.24);
    const firstClosure = cubicSegment(
        end,
        insideHandle(end, endDirection, endpointHandleLength, center, radius),
        insideHandle(middle, scale(middleDirection, -1), middleHandleLength, center, radius),
        middle,
        'curve',
        'closure'
    );
    const secondClosure = cubicSegment(
        middle,
        insideHandle(middle, middleDirection, middleHandleLength, center, radius),
        insideHandle(start, scale(startDirection, -1), endpointHandleLength, center, radius),
        start,
        'curve',
        'closure'
    );
    return [firstClosure, secondClosure];
}

function closestPointOnSegment(segment, target) {
    const samples = 32;
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let index = 0; index <= samples; index += 1) {
        const candidate = cubicPoint(segment, index / samples);
        const candidateDistance = distanceSquared(candidate, target);
        if (candidateDistance < bestDistance) {
            bestDistance = candidateDistance;
            bestIndex = index;
        }
    }
    let left = Math.max(0, (bestIndex - 1) / samples);
    let right = Math.min(1, (bestIndex + 1) / samples);
    for (let iteration = 0; iteration < 24; iteration += 1) {
        const first = left + (right - left) / 3;
        const second = right - (right - left) / 3;
        if (distanceSquared(cubicPoint(segment, first), target)
            <= distanceSquared(cubicPoint(segment, second), target)) right = second;
        else left = first;
    }
    const t = (left + right) / 2;
    return { t, distanceSquared: distanceSquared(cubicPoint(segment, t), target) };
}

function rotateToNearestSourcePoint(source, target) {
    let segmentIndex = 0;
    let closest = { t: 0, distanceSquared: Infinity };
    source.forEach((segment, index) => {
        if (segment.role !== 'source') return;
        const candidate = closestPointOnSegment(segment, target);
        if (candidate.distanceSquared < closest.distanceSquared) {
            closest = candidate;
            segmentIndex = index;
        }
    });
    let segments = source.map((segment) => ({ ...segment }));
    let startIndex = segmentIndex;
    if (closest.t > 1e-4 && closest.t < 1 - 1e-4) {
        const [left, right] = splitCubic(segments[segmentIndex], closest.t);
        segments.splice(segmentIndex, 1, left, right);
        startIndex = segmentIndex + 1;
    } else if (closest.t >= 1 - 1e-4) {
        startIndex = (segmentIndex + 1) % segments.length;
    }
    return [...segments.slice(startIndex), ...segments.slice(0, startIndex)];
}

function importParsedPath(parsed, {
    matrix = identityMatrix(),
    center,
    radius,
    startFocus = center,
    fileName = 'Imported SVG'
} = {}) {
    if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
        throw new Error('A valid focus-region center is required.');
    }
    if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error('A valid focus-region radius is required.');
    }
    const transformed = transformSegments(parsed.segments, matrix);
    const normalized = normalizeIntoCircle(transformed, center, radius);
    const geometricallyClosed = parsed.closed
        || distance(normalized[0].start, normalized.at(-1).end) <= 1e-6;
    const reservedPoints = geometricallyClosed ? 1 : 3;
    const simplified = simplifyImportedSegments(normalized, {
        target: Math.max(2, IMPORT_SIMPLIFICATION_TARGET_POINTS - reservedPoints),
        maximum: IMPORT_MAX_POINTS - reservedPoints
    });
    const withClosure = geometricallyClosed
        ? simplified
        : [...simplified, ...createSmoothClosure(simplified, center, radius)];
    const ordered = rotateToNearestSourcePoint(withClosure, startFocus || center);
    if (ordered.length > IMPORT_MAX_POINTS) {
        throw new Error(`The imported path exceeds the ${IMPORT_MAX_POINTS}-point limit.`);
    }
    return rebuildFocusPath({
        seed: 1,
        complexity: 0,
        smoothness: 0,
        center,
        radius,
        importMeta: {
            imported: true,
            fileName,
            wasOpen: !geometricallyClosed,
            originalPointCount: parsed.segments.length,
            simplifiedPointCount: ordered.filter((segment) => segment.role === 'source').length,
            pointCount: ordered.length,
            tolerancePx: IMPORT_SIMPLIFICATION_TOLERANCE_PX
        },
        segments: ordered
    });
}

export function importSvgPathData(pathData, options = {}) {
    return importParsedPath(parseSvgPathData(pathData), options);
}

export function importSvgMotionPath(svgText, options = {}) {
    const extracted = extractSinglePath(svgText);
    return importParsedPath(parseSvgPathData(extracted.pathData), {
        ...options,
        matrix: extracted.matrix
    });
}
