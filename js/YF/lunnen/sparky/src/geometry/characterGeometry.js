import { createCircleBoundary, createEllipseBoundary } from './boundaries.js';
import { createRelativeRoundedPolygon } from './roundedPolygon.js';
import {
    add,
    directionFromDegrees,
    intersectLines,
    perpendicular,
    point,
    scale
} from './vector.js';

export const DEFAULT_GEOMETRY = Object.freeze({
    artboardWidth: 480,
    artboardHeight: 480,
    boundaryType: 'circle',
    boundaryCenterX: 240,
    boundaryCenterY: 334,
    boundaryRadius: 240,
    boundaryRadiusX: 240,
    boundaryRadiusY: 240,
    boundaryRotation: 0,
    focusX: 240,
    focusY: 292,
    rayCount: 5,
    centerAngle: -90,
    angleStep: 36,
    rayLength: 240,
    rayWidth: 80,
    roundness: 60
});

export function createBoundary(settings) {
    if (settings.boundaryType === 'ellipse') {
        return createEllipseBoundary({
            cx: settings.boundaryCenterX,
            cy: settings.boundaryCenterY,
            radiusX: settings.boundaryRadiusX,
            radiusY: settings.boundaryRadiusY,
            rotationDeg: settings.boundaryRotation
        });
    }
    return createCircleBoundary({
        cx: settings.boundaryCenterX,
        cy: settings.boundaryCenterY,
        radius: settings.boundaryRadius
    });
}

/**
 * Scalar UI values form a base profile. Serializable overrides are resolved per
 * ray so later distributions do not require a new geometry representation.
 */
export function createRayProfiles(settings) {
    const count = Math.max(2, Math.round(settings.rayCount));
    const middle = (count - 1) / 2;
    const overrides = Array.isArray(settings.rayOverrides) ? settings.rayOverrides : [];

    return Array.from({ length: count }, (_, index) => {
        const override = overrides[index] || {};
        return {
            index,
            angleDeg: settings.centerAngle
                + (index - middle) * settings.angleStep
                + (override.angleOffset || 0),
            length: override.length ?? settings.rayLength,
            width: override.width ?? settings.rayWidth,
            roundnessWeight: override.roundnessWeight ?? 1,
            tipRadius: override.tipRadius ?? settings.cornerRadius,
            valleyRadius: override.valleyRadius ?? settings.cornerRadius
        };
    });
}

export function buildRayTriangle(focus, boundary, profile) {
    const direction = directionFromDegrees(profile.angleDeg);
    const tip = boundary.intersectRay(focus, direction);
    if (!tip) throw new Error(`Ray ${profile.index} does not intersect the boundary.`);

    const baseCenter = add(tip, scale(direction, -profile.length));
    const normal = perpendicular(direction);
    const halfWidth = profile.width / 2;
    return {
        ...profile,
        direction,
        normal,
        tip,
        baseCenter,
        basePlus: add(baseCenter, scale(normal, halfWidth)),
        baseMinus: add(baseCenter, scale(normal, -halfWidth))
    };
}

function requireIntersection(firstStart, firstEnd, secondStart, secondEnd, label) {
    const intersection = intersectLines(firstStart, firstEnd, secondStart, secondEnd);
    if (!intersection) throw new Error(`Cannot construct ${label}: parallel ray edges.`);
    return intersection.point;
}

export function buildCharacterGeometry(settings = {}) {
    const values = { ...DEFAULT_GEOMETRY, ...settings };
    if (settings.roundness == null && Number.isFinite(settings.cornerRadius)) {
        values.roundness = Math.max(0, Math.min(100, settings.cornerRadius * 6));
    }
    const focus = point(values.focusX, values.focusY);
    const boundary = createBoundary(values);
    const profiles = createRayProfiles(values);
    const rays = profiles.map((profile) => buildRayTriangle(focus, boundary, profile));

    const valleys = [];
    for (let index = 0; index < rays.length - 1; index += 1) {
        const current = rays[index];
        const next = rays[index + 1];
        valleys.push(requireIntersection(
            current.tip,
            current.basePlus,
            next.tip,
            next.baseMinus,
            `valley ${index}`
        ));
    }

    const first = rays[0];
    const last = rays[rays.length - 1];
    const baseClosure = requireIntersection(
        first.tip,
        first.baseMinus,
        last.tip,
        last.basePlus,
        'base closure'
    );

    const vertices = [last.tip, baseClosure, first.tip];
    const vertexMeta = [
        { kind: 'tip', rayIndex: last.index, roundnessWeight: last.roundnessWeight },
        { kind: 'base' },
        { kind: 'tip', rayIndex: first.index, roundnessWeight: first.roundnessWeight }
    ];

    for (let index = 0; index < valleys.length; index += 1) {
        vertices.push(valleys[index], rays[index + 1].tip);
        vertexMeta.push(
            { kind: 'valley', afterRayIndex: index },
            {
                kind: 'tip',
                rayIndex: rays[index + 1].index,
                roundnessWeight: rays[index + 1].roundnessWeight
            }
        );
    }

    // The final rightmost tip is already the first vertex.
    vertices.pop();
    vertexMeta.pop();

    const rounded = createRelativeRoundedPolygon(vertices, vertexMeta, values.roundness);
    return { values, focus, boundary, rays, valleys, baseClosure, vertices, vertexMeta, rounded };
}
