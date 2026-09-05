export const EPSILON = 1e-9;

export const point = (x, y) => ({ x, y });
export const add = (a, b) => point(a.x + b.x, a.y + b.y);
export const subtract = (a, b) => point(a.x - b.x, a.y - b.y);
export const scale = (v, amount) => point(v.x * amount, v.y * amount);
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const length = (v) => Math.hypot(v.x, v.y);
export const distance = (a, b) => length(subtract(a, b));
export const perpendicular = (v) => point(-v.y, v.x);
export const degreesToRadians = (degrees) => degrees * Math.PI / 180;

export function normalize(v) {
    const magnitude = length(v);
    if (magnitude < EPSILON) throw new Error('Cannot normalize a zero-length vector.');
    return scale(v, 1 / magnitude);
}

export function directionFromDegrees(degrees) {
    const radians = degreesToRadians(degrees);
    return point(Math.cos(radians), Math.sin(radians));
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/** Intersection of two infinite lines. Parameters describe p + t(p2-p), q + u(q2-q). */
export function intersectLines(p, p2, q, q2) {
    const r = subtract(p2, p);
    const s = subtract(q2, q);
    const denominator = cross(r, s);
    if (Math.abs(denominator) < EPSILON) return null;

    const qMinusP = subtract(q, p);
    const t = cross(qMinusP, s) / denominator;
    const u = cross(qMinusP, r) / denominator;
    return { point: add(p, scale(r, t)), t, u };
}

export function polygonSignedArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        sum += current.x * next.y - next.x * current.y;
    }
    return sum / 2;
}
