import {
    EPSILON,
    add,
    clamp,
    cross,
    dot,
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

export function createRoundedPolygon(points, radii = 0) {
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

    const corners = raw.map((corner, index) => {
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

    const commands = [`M ${formatPoint(corners[0].start)}`];
    corners.forEach((corner, index) => {
        if (corner.radius > EPSILON) {
            commands.push(`A ${cleanNumber(corner.radius)} ${cleanNumber(corner.radius)} 0 0 ${corner.sweep} ${formatPoint(corner.end)}`);
        } else {
            commands.push(`L ${formatPoint(corner.vertex)}`);
        }
        const next = corners[(index + 1) % corners.length];
        commands.push(`L ${formatPoint(next.start)}`);
    });
    commands.push('Z');

    return { path: commands.join(' '), corners };
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
    const rounded = createRoundedPolygon(points, requestedRadii);

    return {
        ...rounded,
        normalizedAmount,
        maximumScale,
        maximumRadii,
        requestedRadii,
        safety
    };
}
