import { add, clamp, distance, point, scale, subtract } from './vector.js';
import { rebaseLegacyY } from './coordinateSpace.js';

export const FOCUS_BOUNDARY_REFERENCE = Object.freeze({
    center: Object.freeze({ x: 240, y: rebaseLegacyY(334) }),
    radius: 240,
    focus: Object.freeze({ x: 120, y: rebaseLegacyY(180) })
});

const referenceCenterDistance = distance(
    FOCUS_BOUNDARY_REFERENCE.focus,
    FOCUS_BOUNDARY_REFERENCE.center
);

/** The safety inset preserved between Extended Focus and the large guide circle. */
export const EXTENDED_FOCUS_INSET = FOCUS_BOUNDARY_REFERENCE.radius - referenceCenterDistance;

const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function boundaryCircle(state) {
    const center = point(
        finiteOr(state.boundaryCenterX, FOCUS_BOUNDARY_REFERENCE.center.x),
        finiteOr(state.boundaryCenterY, FOCUS_BOUNDARY_REFERENCE.center.y)
    );
    const radius = state.boundaryType === 'ellipse'
        ? Math.min(
            finiteOr(state.boundaryRadiusX, FOCUS_BOUNDARY_REFERENCE.radius),
            finiteOr(state.boundaryRadiusY, FOCUS_BOUNDARY_REFERENCE.radius)
        )
        : finiteOr(state.boundaryRadius, FOCUS_BOUNDARY_REFERENCE.radius);
    return { center, radius: Math.max(0, radius) };
}

export function createExtendedFocusRegion(state = {}) {
    const boundary = boundaryCircle(state);
    const radius = Math.max(0, boundary.radius - EXTENDED_FOCUS_INSET);
    return {
        center: boundary.center,
        radius,
        minX: boundary.center.x - radius,
        maxX: boundary.center.x + radius,
        minY: boundary.center.y - radius,
        maxY: boundary.center.y + radius
    };
}

export function getFocusSliderBounds(state = {}) {
    return createExtendedFocusRegion(state);
}

export function constrainFocusPoint(raw, state = {}) {
    const region = createExtendedFocusRegion(state);
    const candidate = point(
        finiteOr(raw.x, region.center.x),
        finiteOr(raw.y, region.center.y)
    );
    const delta = subtract(candidate, region.center);
    const magnitude = distance(candidate, region.center);
    if (magnitude <= region.radius || magnitude === 0) return candidate;
    return add(region.center, scale(delta, region.radius / magnitude));
}

/** Convert UI polar coordinates to the Cartesian focus used by the geometry. */
export function focusPointFromPolar(raw = {}, state = {}) {
    const region = createExtendedFocusRegion(state);
    const angle = clamp(finiteOr(raw.angle, 0), 0, 360);
    const distancePercent = clamp(finiteOr(raw.distance, 0), 0, 100);
    const radians = angle * Math.PI / 180;
    const radius = region.radius * distancePercent / 100;
    return point(
        region.center.x + Math.sin(radians) * radius,
        region.center.y - Math.cos(radians) * radius
    );
}

/** Convert a Cartesian focus to clock coordinates: 0° = up, clockwise. */
export function focusPointToPolar(raw, state = {}, fallbackAngle = 0) {
    const region = createExtendedFocusRegion(state);
    const focus = constrainFocusPoint(raw, state);
    const delta = subtract(focus, region.center);
    const magnitude = distance(focus, region.center);
    const measuredAngle = ((Math.atan2(delta.x, -delta.y) * 180 / Math.PI) + 360) % 360;
    return {
        angle: magnitude <= 1e-9 ? clamp(finiteOr(fallbackAngle, 0), 0, 360) : measuredAngle,
        distance: region.radius <= 1e-9 ? 0 : clamp(magnitude / region.radius * 100, 0, 100)
    };
}
