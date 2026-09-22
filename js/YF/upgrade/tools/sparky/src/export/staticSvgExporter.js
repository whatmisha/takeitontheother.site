const INTERSECTION_EPSILON = 1e-8;
const STITCH_PRECISION = 1e5;
const CURVE_SUBDIVISIONS = 4;
const SIMPLIFY_TOLERANCE = 0.04;

const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const interpolate = (a, b, amount) => ({
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount
});

function signedArea(points) {
    return points.reduce((area, point, index) => {
        const next = points[(index + 1) % points.length];
        return area + point.x * next.y - next.x * point.y;
    }, 0) / 2;
}

function cubicPoint(start, control1, control2, end, amount) {
    const inverse = 1 - amount;
    const inverse2 = inverse * inverse;
    const amount2 = amount * amount;
    return {
        x: inverse2 * inverse * start.x
            + 3 * inverse2 * amount * control1.x
            + 3 * inverse * amount2 * control2.x
            + amount2 * amount * end.x,
        y: inverse2 * inverse * start.y
            + 3 * inverse2 * amount * control1.y
            + 3 * inverse * amount2 * control2.y
            + amount2 * amount * end.y
    };
}

/** Samples the exact periodic cubic law used by eyeGeometry.createClosedCurvePath(). */
function sampleClosedCurve(points) {
    const count = points.length;
    const samples = [];
    for (let index = 0; index < count; index += 1) {
        const previous = points[(index - 1 + count) % count];
        const current = points[index];
        const next = points[(index + 1) % count];
        const afterNext = points[(index + 2) % count];
        const control1 = {
            x: current.x + (next.x - previous.x) / 6,
            y: current.y + (next.y - previous.y) / 6
        };
        const control2 = {
            x: next.x - (afterNext.x - current.x) / 6,
            y: next.y - (afterNext.y - current.y) / 6
        };
        for (let step = 0; step < CURVE_SUBDIVISIONS; step += 1) {
            samples.push(cubicPoint(
                current,
                control1,
                control2,
                next,
                step / CURVE_SUBDIVISIONS
            ));
        }
    }
    return signedArea(samples) < 0 ? samples.reverse() : samples;
}

function segmentIntersection(firstStart, firstEnd, secondStart, secondEnd) {
    const first = subtract(firstEnd, firstStart);
    const second = subtract(secondEnd, secondStart);
    const denominator = cross(first, second);
    if (Math.abs(denominator) <= INTERSECTION_EPSILON) return null;
    const offset = subtract(secondStart, firstStart);
    const firstAmount = cross(offset, second) / denominator;
    const secondAmount = cross(offset, first) / denominator;
    if (firstAmount < -INTERSECTION_EPSILON
        || firstAmount > 1 + INTERSECTION_EPSILON
        || secondAmount < -INTERSECTION_EPSILON
        || secondAmount > 1 + INTERSECTION_EPSILON) return null;
    return {
        firstAmount: Math.max(0, Math.min(1, firstAmount)),
        secondAmount: Math.max(0, Math.min(1, secondAmount))
    };
}

function pointOnSegment(point, start, end) {
    const segment = subtract(end, start);
    const offset = subtract(point, start);
    const area = Math.abs(cross(segment, offset));
    if (area > INTERSECTION_EPSILON * Math.max(1, Math.hypot(segment.x, segment.y))) {
        return false;
    }
    const projection = offset.x * segment.x + offset.y * segment.y;
    const lengthSquared = segment.x * segment.x + segment.y * segment.y;
    return projection >= -INTERSECTION_EPSILON
        && projection <= lengthSquared + INTERSECTION_EPSILON;
}

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
        const start = polygon[previous];
        const end = polygon[index];
        if (pointOnSegment(point, start, end)) return true;
        const crosses = (start.y > point.y) !== (end.y > point.y)
            && point.x < (end.x - start.x) * (point.y - start.y)
                / (end.y - start.y) + start.x;
        if (crosses) inside = !inside;
    }
    return inside;
}

function uniqueAmounts(amounts) {
    return [...amounts]
        .sort((first, second) => first - second)
        .filter((amount, index, values) => (
            index === 0 || Math.abs(amount - values[index - 1]) > INTERSECTION_EPSILON
        ));
}

function fragmentBelongsToAperture(sourceIndex, midpoint, contours) {
    const insideEye = pointInPolygon(midpoint, contours[0]);
    const insideTop = pointInPolygon(midpoint, contours[1]);
    const insideBottom = pointInPolygon(midpoint, contours[2]);
    if (sourceIndex === 0) return !insideTop && !insideBottom;
    if (sourceIndex === 1) return insideEye && !insideBottom;
    return insideEye && !insideTop;
}

function createBoundaryFragments(contours) {
    const splits = contours.map((points) => points.map(() => [0, 1]));
    for (let firstIndex = 0; firstIndex < contours.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < contours.length; secondIndex += 1) {
            const first = contours[firstIndex];
            const second = contours[secondIndex];
            first.forEach((firstStart, firstEdge) => {
                const firstEnd = first[(firstEdge + 1) % first.length];
                second.forEach((secondStart, secondEdge) => {
                    const secondEnd = second[(secondEdge + 1) % second.length];
                    const intersection = segmentIntersection(
                        firstStart,
                        firstEnd,
                        secondStart,
                        secondEnd
                    );
                    if (!intersection) return;
                    splits[firstIndex][firstEdge].push(intersection.firstAmount);
                    splits[secondIndex][secondEdge].push(intersection.secondAmount);
                });
            });
        }
    }

    const fragments = [];
    contours.forEach((points, sourceIndex) => {
        points.forEach((start, edgeIndex) => {
            const end = points[(edgeIndex + 1) % points.length];
            const amounts = uniqueAmounts(splits[sourceIndex][edgeIndex]);
            for (let index = 0; index < amounts.length - 1; index += 1) {
                const first = interpolate(start, end, amounts[index]);
                const second = interpolate(start, end, amounts[index + 1]);
                if (Math.hypot(second.x - first.x, second.y - first.y) <= INTERSECTION_EPSILON) {
                    continue;
                }
                const midpoint = interpolate(first, second, 0.5);
                if (!fragmentBelongsToAperture(sourceIndex, midpoint, contours)) continue;
                fragments.push(sourceIndex === 0
                    ? { start: first, end: second }
                    : { start: second, end: first });
            }
        });
    });
    return fragments;
}

function pointKey(point) {
    return `${Math.round(point.x * STITCH_PRECISION)},${Math.round(point.y * STITCH_PRECISION)}`;
}

function stitchFragments(fragments) {
    const starts = new Map();
    fragments.forEach((fragment, index) => {
        const key = pointKey(fragment.start);
        if (!starts.has(key)) starts.set(key, []);
        starts.get(key).push(index);
    });
    const used = new Set();
    const loops = [];

    fragments.forEach((fragment, initialIndex) => {
        if (used.has(initialIndex)) return;
        used.add(initialIndex);
        const firstKey = pointKey(fragment.start);
        const points = [fragment.start, fragment.end];
        let current = fragment.end;
        let safety = fragments.length + 1;
        while (pointKey(current) !== firstKey && safety > 0) {
            safety -= 1;
            const nextIndex = (starts.get(pointKey(current)) || [])
                .find((candidate) => !used.has(candidate));
            if (nextIndex == null) break;
            used.add(nextIndex);
            current = fragments[nextIndex].end;
            points.push(current);
        }
        if (pointKey(current) !== firstKey || points.length < 4) return;
        points.pop();
        loops.push(points);
    });
    return loops.filter((points) => Math.abs(signedArea(points)) > 1e-4);
}

function distanceToLine(point, start, end) {
    const segment = subtract(end, start);
    const lengthSquared = segment.x * segment.x + segment.y * segment.y;
    if (lengthSquared <= INTERSECTION_EPSILON) {
        return Math.hypot(point.x - start.x, point.y - start.y);
    }
    const offset = subtract(point, start);
    const amount = Math.max(0, Math.min(1,
        (offset.x * segment.x + offset.y * segment.y) / lengthSquared));
    return Math.hypot(
        point.x - (start.x + segment.x * amount),
        point.y - (start.y + segment.y * amount)
    );
}

function simplifyOpen(points, tolerance) {
    if (points.length <= 2) return points;
    let maximum = 0;
    let splitIndex = 0;
    for (let index = 1; index < points.length - 1; index += 1) {
        const distance = distanceToLine(points[index], points[0], points.at(-1));
        if (distance <= maximum) continue;
        maximum = distance;
        splitIndex = index;
    }
    if (maximum <= tolerance) return [points[0], points.at(-1)];
    const first = simplifyOpen(points.slice(0, splitIndex + 1), tolerance);
    const second = simplifyOpen(points.slice(splitIndex), tolerance);
    return [...first.slice(0, -1), ...second];
}

function circularSlice(points, start, end) {
    const result = [points[start]];
    let index = start;
    while (index !== end) {
        index = (index + 1) % points.length;
        result.push(points[index]);
    }
    return result;
}

function simplifyClosed(points) {
    if (points.length <= 4) return points;
    let leftIndex = 0;
    let rightIndex = 0;
    points.forEach((point, index) => {
        if (point.x < points[leftIndex].x) leftIndex = index;
        if (point.x > points[rightIndex].x) rightIndex = index;
    });
    if (leftIndex === rightIndex) return points;
    const first = simplifyOpen(circularSlice(points, leftIndex, rightIndex), SIMPLIFY_TOLERANCE);
    const second = simplifyOpen(circularSlice(points, rightIndex, leftIndex), SIMPLIFY_TOLERANCE);
    return [...first.slice(0, -1), ...second.slice(0, -1)];
}

function cleanNumber(value) {
    const rounded = Number(value.toFixed(4));
    return Object.is(rounded, -0) ? 0 : rounded;
}

function contoursToPath(contours) {
    return contours.map((points) => {
        const simplified = simplifyClosed(points);
        const commands = [`M ${cleanNumber(simplified[0].x)} ${cleanNumber(simplified[0].y)}`];
        simplified.slice(1).forEach((point) => {
            commands.push(`L ${cleanNumber(point.x)} ${cleanNumber(point.y)}`);
        });
        commands.push('Z');
        return commands.join(' ');
    }).join(' ');
}

export function buildVisibleEyeContours(eye) {
    const contours = [eye.eye1, eye.top, eye.bottom]
        .map((shape) => sampleClosedCurve(shape.points));
    const loops = stitchFragments(createBoundaryFragments(contours));
    if (!loops.length) throw new Error('Unable to flatten the visible eye contour.');
    return loops;
}

const normalizedColor = (value) => String(value || '').trim().toLowerCase();

export function createStaticSparkySvg({
    settings,
    characterGeometry,
    eyeGeometry,
    width = 480,
    height = 480
}) {
    if (!characterGeometry?.rounded?.path || !eyeGeometry?.left || !eyeGeometry?.right) {
        throw new Error('Static SVG export requires current character and eye geometry.');
    }
    const leftContours = buildVisibleEyeContours(eyeGeometry.left);
    const rightContours = buildVisibleEyeContours(eyeGeometry.right);
    const eyePath = contoursToPath([...leftContours, ...rightContours]);
    const headPath = `${characterGeometry.rounded.path} ${eyePath}`;
    const sameColor = normalizedColor(settings.eyeColor)
        === normalizedColor(settings.backgroundColor);
    const eyeObject = sameColor
        ? ''
        : `<path id="eyes" d="${eyePath}" fill="${settings.eyeColor}" fill-rule="evenodd"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${cleanNumber(width)}" height="${cleanNumber(height)}" viewBox="0 0 ${cleanNumber(width)} ${cleanNumber(height)}">`
        + `<rect id="back" x="0" y="0" width="${cleanNumber(width)}" height="${cleanNumber(height)}" fill="${settings.backgroundColor}"/>`
        + `<path id="head" d="${headPath}" fill="${settings.headColor}" fill-rule="evenodd"/>`
        + eyeObject
        + '</svg>';
}
