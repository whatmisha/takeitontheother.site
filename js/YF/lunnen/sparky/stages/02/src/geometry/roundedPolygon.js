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
export function createRoundedPolygon(points, radii = 0) {
    if (!Array.isArray(points) || points.length < 3) {
        throw new Error('A rounded polygon needs at least three points.');
    }

    const radiusAt = typeof radii === 'function'
        ? radii
        : Array.isArray(radii)
            ? (_, index) => radii[index] ?? 0
            : () => radii;

    const raw = points.map((vertex, index) => {
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

    // First cap each corner independently, then share the available edge length
    // proportionally between neighbouring fillets.
    const distances = raw.map((corner) => Math.min(
        corner.idealDistance,
        corner.previousLength * 0.499,
        corner.nextLength * 0.499
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
