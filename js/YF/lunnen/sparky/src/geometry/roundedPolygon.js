import {
    EPSILON,
    add,
    clamp,
    cross,
    dot,
    intersectLines,
    length,
    normalize,
    scale,
    subtract
} from './vector.js';

function cleanNumber(value, precision = 4) {
    const rounded = Number(value.toFixed(precision));
    return Object.is(rounded, -0) ? 0 : rounded;
}

function formatPoint(value) {
    return `${cleanNumber(value.x)} ${cleanNumber(value.y)}`;
}

function directedArcDelta(startAngle, endAngle, sweep) {
    const fullTurn = Math.PI * 2;
    if (sweep) {
        let delta = (endAngle - startAngle + fullTurn) % fullTurn;
        if (delta > Math.PI) delta -= fullTurn;
        return delta;
    }
    let delta = -((startAngle - endAngle + fullTurn) % fullTurn);
    if (delta < -Math.PI) delta += fullTurn;
    return delta;
}

function circleCenterForCorner(corner, tangentDistance) {
    const bisector = add(corner.towardPrevious, corner.towardNext);
    const bisectorLength = length(bisector);
    const halfAngleCosine = Math.cos(Math.atan(Math.abs(corner.tangent)));
    if (bisectorLength < EPSILON || Math.abs(halfAngleCosine) < EPSILON) return corner.vertex;
    return add(
        corner.vertex,
        scale(bisector, tangentDistance / (halfAngleCosine * bisectorLength))
    );
}

function circlePoint(center, radius, angle) {
    return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
    };
}

function arcTangent(angle, delta) {
    const direction = delta >= 0 ? 1 : -1;
    return { x: -Math.sin(angle) * direction, y: Math.cos(angle) * direction };
}

function cubicPoint(start, control1, control2, end, amount) {
    const inverse = 1 - amount;
    const inverseSquared = inverse * inverse;
    const amountSquared = amount * amount;
    return {
        x: inverseSquared * inverse * start.x
            + 3 * inverseSquared * amount * control1.x
            + 3 * inverse * amountSquared * control2.x
            + amountSquared * amount * end.x,
        y: inverseSquared * inverse * start.y
            + 3 * inverseSquared * amount * control1.y
            + 3 * inverse * amountSquared * control2.y
            + amountSquared * amount * end.y
    };
}

function transitionFromLineToArc(linePoint, lineDirection, arcPoint, arcDirection) {
    const intersection = intersectLines(
        linePoint,
        add(linePoint, lineDirection),
        arcPoint,
        add(arcPoint, arcDirection)
    );
    const tangentControl = intersection?.point ?? arcPoint;
    // Figma's published construction gives two thirds of the transition interval
    // to the zero-curvature ramp and the remaining third to the arc approach.
    const lineControl = add(linePoint, scale(subtract(tangentControl, linePoint), 2 / 3));
    return { lineControl, tangentControl };
}

function applyCornerSmoothing(corners, distances, requestedValue) {
    const requested = clamp(Number(requestedValue) || 0, 0, 100) / 100;
    let effective = requested;

    corners.forEach((corner, index) => {
        const nextIndex = (index + 1) % corners.length;
        const baseConsumption = distances[index] + distances[nextIndex];
        if (baseConsumption <= EPSILON) return;
        const maximumForEdge = corner.nextLength * 0.998 / baseConsumption - 1;
        effective = Math.min(effective, Math.max(0, maximumForEdge));
    });

    const smoothed = corners.map((corner, index) => {
        const tangentDistance = distances[index];
        const circularStart = corner.start;
        const circularEnd = corner.end;
        if (corner.radius <= EPSILON || effective <= EPSILON) {
            return {
                ...corner,
                circularStart,
                circularEnd,
                smoothing: 0,
                transition: null
            };
        }

        const edgeConsumption = tangentDistance * (1 + effective);
        const start = add(corner.vertex, scale(corner.towardPrevious, edgeConsumption));
        const end = add(corner.vertex, scale(corner.towardNext, edgeConsumption));
        const center = circleCenterForCorner(corner, tangentDistance);
        const startAngle = Math.atan2(circularStart.y - center.y, circularStart.x - center.x);
        const endAngle = Math.atan2(circularEnd.y - center.y, circularEnd.x - center.x);
        const delta = directedArcDelta(startAngle, endAngle, corner.sweep);
        const arcStartAngle = startAngle + delta * effective / 2;
        const arcEndAngle = endAngle - delta * effective / 2;
        const arcStart = circlePoint(center, corner.radius, arcStartAngle);
        const arcEnd = circlePoint(center, corner.radius, arcEndAngle);
        const incoming = transitionFromLineToArc(
            start,
            scale(corner.towardPrevious, -1),
            arcStart,
            arcTangent(arcStartAngle, delta)
        );
        const outgoingReverse = transitionFromLineToArc(
            end,
            scale(corner.towardNext, -1),
            arcEnd,
            scale(arcTangent(arcEndAngle, delta), -1)
        );

        return {
            ...corner,
            start,
            end,
            circularStart,
            circularEnd,
            center,
            smoothing: effective,
            transition: {
                incoming,
                outgoingReverse,
                arcStart,
                arcEnd,
                arcStartAngle,
                arcEndAngle,
                arcDelta: delta * (1 - effective)
            }
        };
    });

    return { corners: smoothed, requestedSmoothing: requested, effectiveSmoothing: effective };
}

/**
 * Computes exact circular fillets. Requested radii are reduced locally when two
 * neighbouring fillets would otherwise consume an entire edge.
 */
function measurePolygonCorners(points, radiusAt) {
    return points.map((vertex, index) => {
        const previous = points[(index - 1 + points.length) % points.length];
        const next = points[(index + 1) % points.length];
        const towardPrevious = normalize(subtract(previous, vertex));
        const towardNext = normalize(subtract(next, vertex));
        const previousLength = length(subtract(previous, vertex));
        const nextLength = length(subtract(next, vertex));
        const angle = Math.acos(clamp(dot(towardPrevious, towardNext), -1, 1));
        const tangent = Math.tan(angle / 2);
        const requestedRadius = Math.max(0, Number(radiusAt(vertex, index)) || 0);
        const idealDistance = requestedRadius > EPSILON && Math.abs(tangent) > EPSILON
            ? requestedRadius / Math.abs(tangent)
            : 0;

        return {
            vertex,
            towardPrevious,
            towardNext,
            previousLength,
            nextLength,
            tangent,
            requestedRadius,
            idealDistance
        };
    });
}

export function createRoundedPolygon(points, radii = 0, options = {}) {
    if (!Array.isArray(points) || points.length < 3) {
        throw new Error('A rounded polygon needs at least three points.');
    }

    const radiusAt = typeof radii === 'function'
        ? radii
        : Array.isArray(radii)
            ? (_, index) => radii[index] ?? 0
            : () => radii;

    const raw = measurePolygonCorners(points, radiusAt);

    // First cap each corner independently, then share the available edge length
    // proportionally between neighbouring fillets.
    const distances = raw.map((corner) => Math.min(
        corner.idealDistance,
        corner.previousLength * 0.999,
        corner.nextLength * 0.999
    ));

    for (let index = 0; index < points.length; index += 1) {
        const nextIndex = (index + 1) % points.length;
        const edgeLength = length(subtract(points[nextIndex], points[index]));
        const total = distances[index] + distances[nextIndex];
        const maximum = edgeLength * 0.998;
        if (total > maximum && total > EPSILON) {
            const factor = maximum / total;
            distances[index] *= factor;
            distances[nextIndex] *= factor;
        }
    }

    const circularCorners = raw.map((corner, index) => {
        const tangentDistance = distances[index];
        const radius = tangentDistance * Math.abs(corner.tangent);
        const start = add(corner.vertex, scale(corner.towardPrevious, tangentDistance));
        const end = add(corner.vertex, scale(corner.towardNext, tangentDistance));
        const incoming = subtract(corner.vertex, points[(index - 1 + points.length) % points.length]);
        const outgoing = subtract(points[(index + 1) % points.length], corner.vertex);
        return {
            ...corner,
            start,
            end,
            radius,
            sweep: cross(incoming, outgoing) > 0 ? 1 : 0
        };
    });

    const smoothing = applyCornerSmoothing(circularCorners, distances, options.cornerSmoothing);
    const corners = smoothing.corners;
    const commands = [`M ${formatPoint(corners[0].start)}`];
    const contour = [corners[0].start];
    corners.forEach((corner, index) => {
        if (corner.radius > EPSILON && corner.transition) {
            const { incoming, outgoingReverse, arcStart, arcEnd, arcDelta } = corner.transition;
            commands.push(`C ${formatPoint(incoming.lineControl)} ${formatPoint(incoming.tangentControl)} ${formatPoint(arcStart)}`);
            for (let sample = 1; sample <= 8; sample += 1) {
                contour.push(cubicPoint(
                    corner.start,
                    incoming.lineControl,
                    incoming.tangentControl,
                    arcStart,
                    sample / 8
                ));
            }
            if (Math.abs(arcDelta) > EPSILON) {
                commands.push(`A ${cleanNumber(corner.radius)} ${cleanNumber(corner.radius)} 0 0 ${corner.sweep} ${formatPoint(arcEnd)}`);
                for (let sample = 1; sample <= 12; sample += 1) {
                    contour.push(circlePoint(
                        corner.center,
                        corner.radius,
                        corner.transition.arcStartAngle + arcDelta * sample / 12
                    ));
                }
            }
            commands.push(`C ${formatPoint(outgoingReverse.tangentControl)} ${formatPoint(outgoingReverse.lineControl)} ${formatPoint(corner.end)}`);
            for (let sample = 1; sample <= 8; sample += 1) {
                contour.push(cubicPoint(
                    arcEnd,
                    outgoingReverse.tangentControl,
                    outgoingReverse.lineControl,
                    corner.end,
                    sample / 8
                ));
            }
        } else if (corner.radius > EPSILON) {
            commands.push(`A ${cleanNumber(corner.radius)} ${cleanNumber(corner.radius)} 0 0 ${corner.sweep} ${formatPoint(corner.end)}`);
            const center = circleCenterForCorner(corner, distances[index]);
            const startAngle = Math.atan2(corner.start.y - center.y, corner.start.x - center.x);
            const endAngle = Math.atan2(corner.end.y - center.y, corner.end.x - center.x);
            const delta = directedArcDelta(startAngle, endAngle, corner.sweep);
            for (let sample = 1; sample <= 12; sample += 1) {
                contour.push(circlePoint(center, corner.radius, startAngle + delta * sample / 12));
            }
        } else {
            commands.push(`L ${formatPoint(corner.vertex)}`);
            contour.push(corner.vertex);
        }
        const next = corners[(index + 1) % corners.length];
        commands.push(`L ${formatPoint(next.start)}`);
        contour.push(next.start);
    });
    commands.push('Z');
    if (contour.length > 1 && length(subtract(contour[0], contour[contour.length - 1])) < EPSILON) {
        contour.pop();
    }

    return {
        path: commands.join(' '),
        corners,
        contour,
        requestedSmoothing: smoothing.requestedSmoothing,
        effectiveSmoothing: smoothing.effectiveSmoothing
    };
}

/**
 * Maps a 0..100 control to the largest mutually compatible set of fillets.
 * Tip capacities follow the local ray geometry; every joining corner receives
 * the smaller capacity of its two neighbouring tips. At 100 the closest pair
 * of arcs leaves a small deterministic gap instead of numerically touching.
 */
export function createRelativeRoundedPolygon(points, vertexMeta, amount = 0, options = {}) {
    if (!Array.isArray(vertexMeta) || vertexMeta.length !== points.length) {
        throw new Error('Relative rounding needs metadata for every polygon vertex.');
    }

    const safety = clamp(Number(options.safety) || 0.97, 0.8, 0.999);
    const measured = measurePolygonCorners(points, () => 0);
    const weights = Array(points.length).fill(0);
    const tipWeightsByRay = new Map();

    vertexMeta.forEach((meta, index) => {
        if (meta.kind !== 'tip') return;
        const corner = measured[index];
        const capacity = Math.min(corner.previousLength, corner.nextLength)
            * Math.abs(corner.tangent)
            * Math.max(0, Number(meta.roundnessWeight) || 1);
        weights[index] = capacity;
        tipWeightsByRay.set(meta.rayIndex, capacity);
    });

    const rayIndices = [...tipWeightsByRay.keys()].sort((first, second) => first - second);
    vertexMeta.forEach((meta, index) => {
        if (meta.kind === 'valley') {
            weights[index] = Math.min(
                tipWeightsByRay.get(meta.afterRayIndex) ?? 0,
                tipWeightsByRay.get(meta.afterRayIndex + 1) ?? 0
            );
        } else if (meta.kind === 'base') {
            weights[index] = Math.min(
                tipWeightsByRay.get(rayIndices[0]) ?? 0,
                tipWeightsByRay.get(rayIndices[rayIndices.length - 1]) ?? 0
            );
        }
    });

    let maximumScale = Infinity;
    measured.forEach((corner, index) => {
        const nextIndex = (index + 1) % measured.length;
        const next = measured[nextIndex];
        const currentTangent = Math.abs(corner.tangent);
        const nextTangent = Math.abs(next.tangent);
        const tangentUsage = (currentTangent > EPSILON ? weights[index] / currentTangent : 0)
            + (nextTangent > EPSILON ? weights[nextIndex] / nextTangent : 0);
        if (tangentUsage > EPSILON) {
            maximumScale = Math.min(maximumScale, corner.nextLength * safety / tangentUsage);
        }
    });

    if (!Number.isFinite(maximumScale)) maximumScale = 0;
    const normalizedAmount = clamp(Number(amount) || 0, 0, 100) / 100;
    const maximumRadii = weights.map((weight) => weight * maximumScale);
    const requestedRadii = maximumRadii.map((radius) => radius * normalizedAmount);
    const rounded = createRoundedPolygon(points, requestedRadii, {
        cornerSmoothing: options.cornerSmoothing
    });

    return {
        ...rounded,
        normalizedAmount,
        maximumScale,
        maximumRadii,
        requestedRadii,
        safety
    };
}
