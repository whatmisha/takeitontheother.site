import { createCircleBoundary, createEllipseBoundary } from './boundaries.js';
import { rebaseLegacyY } from './coordinateSpace.js';
import { createRelativeRoundedPolygon } from './roundedPolygon.js?v=20260823-4';
import {
    add,
    directionFromDegrees,
    intersectLines,
    normalize,
    perpendicular,
    point,
    scale,
    subtract
} from './vector.js';
import {
    rayModulationAmount,
    rayVariationFactor
} from './rayModulation.js';
import { bolidRayAdjustment } from '../animation/bolid.js?v=20260828-3';

const FOCUS_BOUNDARY_NUMERIC_INSET = 1e-4;

function focusInsideBoundary(rawFocus, boundary) {
    if (boundary.type === 'circle') {
        const offset = subtract(rawFocus, boundary.center);
        const magnitude = Math.hypot(offset.x, offset.y);
        const maximum = Math.max(0, boundary.radius - FOCUS_BOUNDARY_NUMERIC_INSET);
        if (magnitude <= maximum || magnitude <= 1e-9) return rawFocus;
        return add(boundary.center, scale(offset, maximum / magnitude));
    }
    if (boundary.type === 'ellipse') {
        const radians = -boundary.rotationDeg * Math.PI / 180;
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);
        const offset = subtract(rawFocus, boundary.center);
        const local = point(
            offset.x * cosine - offset.y * sine,
            offset.x * sine + offset.y * cosine
        );
        const normalized = Math.hypot(
            local.x / boundary.radiusX,
            local.y / boundary.radiusY
        );
        if (normalized < 1) return rawFocus;
        const insetRatio = FOCUS_BOUNDARY_NUMERIC_INSET
            / Math.max(FOCUS_BOUNDARY_NUMERIC_INSET, Math.min(boundary.radiusX, boundary.radiusY));
        const factor = Math.max(0, 1 - insetRatio) / normalized;
        const safeLocal = scale(local, factor);
        const inverse = -radians;
        const inverseCosine = Math.cos(inverse);
        const inverseSine = Math.sin(inverse);
        return add(boundary.center, point(
            safeLocal.x * inverseCosine - safeLocal.y * inverseSine,
            safeLocal.x * inverseSine + safeLocal.y * inverseCosine
        ));
    }
    return rawFocus;
}

export const DEFAULT_GEOMETRY = Object.freeze({
    artboardWidth: 480,
    artboardHeight: 480,
    boundaryType: 'circle',
    boundaryCenterX: 240,
    boundaryCenterY: rebaseLegacyY(334),
    boundaryRadius: 240,
    boundaryRadiusX: 240,
    boundaryRadiusY: 240,
    boundaryRotation: 0,
    focusX: 240,
    focusY: 240,
    rayCount: 5,
    centerAngle: -90,
    angleStep: 36,
    angleSpan: 144,
    rayLength: 240,
    rayWidth: 80,
    rayLengthVariation: 0,
    rayWidthVariation: 0,
    rayModulationFrequency: 1,
    rayModulationPhase: 0,
    roundness: 60,
    cornerSmoothing: 0
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
    const count = Math.max(3, Math.min(13, Math.round(settings.rayCount)));
    const middle = (count - 1) / 2;
    const angleSpan = Number.isFinite(settings.angleSpan)
        ? settings.angleSpan
        : settings.angleStep * 4;
    const resolvedAngleStep = angleSpan / (count - 1);
    const overrides = Array.isArray(settings.rayOverrides) ? settings.rayOverrides : [];

    return Array.from({ length: count }, (_, index) => {
        const override = overrides[index] || {};
        const baseAngle = settings.centerAngle
            + (index - middle) * resolvedAngleStep
            + (override.angleOffset || 0);
        const bolid = bolidRayAdjustment(settings, index, count, baseAngle);
        const modulation = rayModulationAmount(settings, index, count);
        const baseLength = override.length ?? settings.rayLength;
        const baseWidth = override.width ?? settings.rayWidth;
        return {
            index,
            angleDeg: baseAngle + bolid.angleOffset,
            length: baseLength * rayVariationFactor(
                settings.rayLengthVariation,
                modulation
            ) * bolid.lengthFactor,
            width: baseWidth * rayVariationFactor(
                settings.rayWidthVariation,
                modulation
            ) * bolid.widthFactor,
            ...(settings.bolidActive ? { tipOffset: bolid.tipOffset } : {}),
            roundnessWeight: override.roundnessWeight ?? 1,
            tipRadius: override.tipRadius ?? settings.cornerRadius,
            valleyRadius: override.valleyRadius ?? settings.cornerRadius
        };
    });
}

export function buildRayTriangle(focus, boundary, profile) {
    const direction = directionFromDegrees(profile.angleDeg);
    const boundaryTip = boundary.intersectRay(focus, direction);
    if (!boundaryTip) throw new Error(`Ray ${profile.index} does not intersect the boundary.`);
    const tip = add(boundaryTip, profile.tipOffset || point(0, 0));

    const baseCenter = add(tip, scale(direction, -profile.length));
    const normal = perpendicular(direction);
    const halfWidth = profile.width / 2;
    const basePlus = add(baseCenter, scale(normal, halfWidth));
    const baseMinus = add(baseCenter, scale(normal, -halfWidth));
    const oppositeBoundaryPoint = (through) => boundary.intersectRay(
        tip,
        normalize(subtract(through, tip))
    ) || through;
    return {
        ...profile,
        direction,
        normal,
        tip,
        baseCenter,
        basePlus,
        baseMinus,
        guidePlusEnd: oppositeBoundaryPoint(basePlus),
        guideMinusEnd: oppositeBoundaryPoint(baseMinus),
        guideAxisEnd: oppositeBoundaryPoint(baseCenter)
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
    const boundary = createBoundary(values);
    const focus = focusInsideBoundary(point(values.focusX, values.focusY), boundary);
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
        { kind: 'base', roundnessWeight: 1 },
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

    const rounded = createRelativeRoundedPolygon(vertices, vertexMeta, values.roundness, {
        cornerSmoothing: values.cornerSmoothing
    });
    return { values, focus, boundary, rays, valleys, baseClosure, vertices, vertexMeta, rounded };
}
