import {
    EPSILON,
    add,
    degreesToRadians,
    dot,
    point,
    scale,
    subtract
} from './vector.js';

function positiveExitRoot(a, b, c) {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -EPSILON) return null;
    const root = Math.sqrt(Math.max(0, discriminant));
    const roots = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
        .filter((value) => value >= -EPSILON);
    return roots.length ? Math.max(...roots) : null;
}

/** Boundary contract: intersectRay(origin, unitDirection) -> point|null. */
export function createCircleBoundary({ cx, cy, radius }) {
    if (!(radius > 0)) throw new Error('Circle radius must be positive.');
    const center = point(cx, cy);

    return Object.freeze({
        type: 'circle',
        center,
        radius,
        intersectRay(origin, direction) {
            const offset = subtract(origin, center);
            const a = dot(direction, direction);
            const b = 2 * dot(offset, direction);
            const c = dot(offset, offset) - radius * radius;
            const t = positiveExitRoot(a, b, c);
            return t == null ? null : add(origin, scale(direction, t));
        }
    });
}

/** Already supported by the geometry kernel; the first UI exposes only circles. */
export function createEllipseBoundary({ cx, cy, radiusX, radiusY, rotationDeg = 0 }) {
    if (!(radiusX > 0) || !(radiusY > 0)) throw new Error('Ellipse radii must be positive.');
    const center = point(cx, cy);
    const rotation = degreesToRadians(rotationDeg);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    const toLocalVector = (vector) => point(
        vector.x * cos + vector.y * sin,
        -vector.x * sin + vector.y * cos
    );
    const toWorldVector = (vector) => point(
        vector.x * cos - vector.y * sin,
        vector.x * sin + vector.y * cos
    );

    return Object.freeze({
        type: 'ellipse',
        center,
        radiusX,
        radiusY,
        rotationDeg,
        intersectRay(origin, direction) {
            const localOrigin = toLocalVector(subtract(origin, center));
            const localDirection = toLocalVector(direction);
            const a = (localDirection.x ** 2) / (radiusX ** 2)
                + (localDirection.y ** 2) / (radiusY ** 2);
            const b = 2 * (
                localOrigin.x * localDirection.x / (radiusX ** 2)
                + localOrigin.y * localDirection.y / (radiusY ** 2)
            );
            const c = (localOrigin.x ** 2) / (radiusX ** 2)
                + (localOrigin.y ** 2) / (radiusY ** 2) - 1;
            const t = positiveExitRoot(a, b, c);
            return t == null ? null : add(center, toWorldVector(add(localOrigin, scale(localDirection, t))));
        }
    });
}

/** Allows future blobs to provide their own exact or numerical ray intersection. */
export function createCustomBoundary({ type = 'custom', intersectRay, guidePath = null }) {
    if (typeof intersectRay !== 'function') throw new Error('Custom boundary requires intersectRay().');
    return Object.freeze({ type, intersectRay, guidePath });
}
