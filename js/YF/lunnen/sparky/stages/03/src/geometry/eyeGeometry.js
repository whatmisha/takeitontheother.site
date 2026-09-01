import {
    EPSILON,
    add,
    clamp,
    distance,
    length,
    point,
    polygonSignedArea,
    scale,
    subtract
} from './vector.js';

export const EYE_DEFAULTS = Object.freeze({
    pairCenterX: 240,
    pairCenterY: 270,
    focusX: 240,
    focusY: 292,
    centerOffsetY: -22,
    mainRadius: 16,
    lidRadius: 48,
    eyeCenterOffsetX: 32,
    maximumMainRadius: 24,
    maximumLidRadius: 72,
    maximumEyeCenterOffsetX: 36,
    referenceRayWidth: 80,
    guard: 6
});

const REFERENCE_HORIZONTAL_OFFSET = 21.6692;

/**
 * Canonical eyelid centers measured from the corresponding eye1 center.
 * Hand-drawn left/right discrepancies from the SVGs are intentionally
 * normalised into exact mirror symmetry.
 */
export const EYE_LID_REFERENCES = Object.freeze({
    neutral: Object.freeze({
        left: Object.freeze({ top: point(0, -64), bottom: point(0, 64) }),
        right: Object.freeze({ top: point(0, -64), bottom: point(0, 64) })
    }),
    cute: Object.freeze({
        left: Object.freeze({ top: point(0, -64), bottom: point(-REFERENCE_HORIZONTAL_OFFSET, 39.4962158) }),
        right: Object.freeze({ top: point(0, -64), bottom: point(REFERENCE_HORIZONTAL_OFFSET, 39.4962158) })
    }),
    angry: Object.freeze({
        left: Object.freeze({ top: point(REFERENCE_HORIZONTAL_OFFSET, -39.4962044), bottom: point(0, 64) }),
        right: Object.freeze({ top: point(-REFERENCE_HORIZONTAL_OFFSET, -39.4962044), bottom: point(0, 64) })
    }),
    cuteAngry: Object.freeze({
        left: Object.freeze({
            top: point(REFERENCE_HORIZONTAL_OFFSET, -45.1654063),
            bottom: point(-REFERENCE_HORIZONTAL_OFFSET, 45.1654053)
        }),
        right: Object.freeze({
            top: point(-REFERENCE_HORIZONTAL_OFFSET, -45.1654063),
            bottom: point(REFERENCE_HORIZONTAL_OFFSET, 45.1654053)
        })
    })
});

function mix(first, second, amount) {
    return first + (second - first) * amount;
}

function bilerpPoint(p00, p10, p01, p11, x, y) {
    return point(
        mix(mix(p00.x, p10.x, x), mix(p01.x, p11.x, x), y),
        mix(mix(p00.y, p10.y, x), mix(p01.y, p11.y, x), y)
    );
}

export function interpolateLidOffset(side, lid, cuteValue = 0, angryValue = 0) {
    const cute = clamp(Number(cuteValue) / 100, 0, 1);
    const angry = clamp(Number(angryValue) / 100, 0, 1);
    return bilerpPoint(
        EYE_LID_REFERENCES.neutral[side][lid],
        EYE_LID_REFERENCES.cute[side][lid],
        EYE_LID_REFERENCES.angry[side][lid],
        EYE_LID_REFERENCES.cuteAngry[side][lid],
        cute,
        angry
    );
}

/**
 * Local eye model. eye1 always stays at (0, 0) inside its own eye group;
 * emotions only change the two lid offsets measured from that origin.
 */
export function createEyeRigModel({ cute = 0, angry = 0, eyeSize = 0, eyeDistance = 0 } = {}) {
    const sizeAmount = clamp(Number(eyeSize) / 100 || 0, 0, 1);
    const distanceAmount = clamp(Number(eyeDistance) || 0, -90, 100);
    const sizeScale = mix(1, 1.5, sizeAmount);
    const mainRadius = mix(EYE_DEFAULTS.mainRadius, EYE_DEFAULTS.maximumMainRadius, sizeAmount);
    const lidRadius = mix(EYE_DEFAULTS.lidRadius, EYE_DEFAULTS.maximumLidRadius, sizeAmount);
    const referenceCenterOffset = mix(
        EYE_DEFAULTS.eyeCenterOffsetX,
        EYE_DEFAULTS.maximumEyeCenterOffsetX,
        sizeAmount
    );
    const referenceGap = (referenceCenterOffset - mainRadius) * 2;
    const eyeGap = referenceGap * (1 + distanceAmount / 100);
    const centerOffset = mainRadius + eyeGap / 2;
    const makeEye = (side, x) => {
        const eyeCenter = point(x, 0);
        const topOffset = scale(interpolateLidOffset(side, 'top', cute, angry), sizeScale);
        const bottomOffset = scale(interpolateLidOffset(side, 'bottom', cute, angry), sizeScale);
        return {
            side,
            eye1: { center: eyeCenter, radius: mainRadius },
            top: { center: add(eyeCenter, topOffset), offset: topOffset, radius: lidRadius },
            bottom: { center: add(eyeCenter, bottomOffset), offset: bottomOffset, radius: lidRadius }
        };
    };

    return {
        pairCenter: point(0, 0),
        sizeScale,
        eyeGap,
        centerOffset,
        left: makeEye('left', -centerOffset),
        right: makeEye('right', centerOffset)
    };
}

function cleanNumber(value, precision = 4) {
    const rounded = Number(value.toFixed(precision));
    return Object.is(rounded, -0) ? 0 : rounded;
}

function formatPoint(value) {
    return `${cleanNumber(value.x)} ${cleanNumber(value.y)}`;
}

/** Smooth closed cubic path through a periodic set of sampled conic points. */
export function createClosedCurvePath(points) {
    if (!Array.isArray(points) || points.length < 4) {
        throw new Error('A closed eye curve needs at least four points.');
    }
    const count = points.length;
    const commands = [`M ${formatPoint(points[0])}`];
    for (let index = 0; index < count; index += 1) {
        const previous = points[(index - 1 + count) % count];
        const current = points[index];
        const next = points[(index + 1) % count];
        const afterNext = points[(index + 2) % count];
        const control1 = add(current, scale(subtract(next, previous), 1 / 6));
        const control2 = subtract(next, scale(subtract(afterNext, current), 1 / 6));
        commands.push(`C ${formatPoint(control1)} ${formatPoint(control2)} ${formatPoint(next)}`);
    }
    commands.push('Z');
    return commands.join(' ');
}

function createRigTransform(values, pairCenter, fitScale = 1) {
    const horizontal = clamp((values.focusX - EYE_DEFAULTS.focusX) / 120, -1, 1);
    const verticalRange = values.focusY < EYE_DEFAULTS.focusY ? 112 : 98;
    const vertical = clamp((values.focusY - EYE_DEFAULTS.focusY) / verticalRange, -1, 1);
    const widthScale = Math.max(0.05, values.rayWidth / EYE_DEFAULTS.referenceRayWidth);
    const verticalScale = clamp(1 + (values.focusY - EYE_DEFAULTS.focusY) / 420, 0.7, 1.35);
    const baseScale = widthScale * verticalScale * fitScale;
    const horizontalSqueeze = 1 - Math.abs(horizontal) * 0.22;
    const perspectiveMultiplier = 1 + clamp(Number(values.eyePerspective) || 0, 0, 100) / 100;

    return (localPoint) => {
        const denominator = Math.max(0.52,
            1
            + 0.18 * perspectiveMultiplier * horizontal * localPoint.x / 64
            + 0.10 * vertical * localPoint.y / 64
        );
        return point(
            pairCenter.x + baseScale * horizontalSqueeze * localPoint.x / denominator,
            pairCenter.y + baseScale * localPoint.y / denominator
        );
    };
}

function sampleCircle(circle, transform, segmentCount = 48) {
    return Array.from({ length: segmentCount }, (_, index) => {
        const angle = index / segmentCount * Math.PI * 2;
        return transform(point(
            circle.center.x + Math.cos(angle) * circle.radius,
            circle.center.y + Math.sin(angle) * circle.radius
        ));
    });
}

function circleCenterFromRoundedCorner(corner) {
    const bisector = add(corner.towardPrevious, corner.towardNext);
    const bisectorLength = length(bisector);
    const halfAngleCosine = Math.cos(Math.atan(Math.abs(corner.tangent)));
    if (bisectorLength < EPSILON || Math.abs(halfAngleCosine) < EPSILON) return corner.vertex;
    const tangentDistance = distance(corner.vertex, corner.start);
    return add(
        corner.vertex,
        scale(bisector, tangentDistance / (halfAngleCosine * bisectorLength))
    );
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

/** Flattens the exact head fillets for deterministic containment tests. */
export function flattenRoundedContour(rounded, samplesPerArc = 12) {
    if (Array.isArray(rounded.contour) && rounded.contour.length >= 3) {
        return rounded.contour;
    }
    const contour = [];
    rounded.corners.forEach((corner) => {
        contour.push(corner.start);
        if (corner.radius <= EPSILON) {
            contour.push(corner.vertex);
            return;
        }
        const center = circleCenterFromRoundedCorner(corner);
        const startAngle = Math.atan2(corner.start.y - center.y, corner.start.x - center.x);
        const endAngle = Math.atan2(corner.end.y - center.y, corner.end.x - center.x);
        const delta = directedArcDelta(startAngle, endAngle, corner.sweep);
        for (let index = 1; index <= samplesPerArc; index += 1) {
            const angle = startAngle + delta * index / samplesPerArc;
            contour.push(point(
                center.x + Math.cos(angle) * corner.radius,
                center.y + Math.sin(angle) * corner.radius
            ));
        }
    });
    return contour;
}

function pointInPolygon(value, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
        const a = polygon[index];
        const b = polygon[previous];
        const crosses = (a.y > value.y) !== (b.y > value.y)
            && value.x < (b.x - a.x) * (value.y - a.y) / (b.y - a.y) + a.x;
        if (crosses) inside = !inside;
    }
    return inside;
}

function closestPointOnSegment(value, start, end) {
    const edge = subtract(end, start);
    const edgeLengthSquared = edge.x * edge.x + edge.y * edge.y;
    if (edgeLengthSquared < EPSILON) return start;
    const projection = clamp(
        ((value.x - start.x) * edge.x + (value.y - start.y) * edge.y) / edgeLengthSquared,
        0,
        1
    );
    return add(start, scale(edge, projection));
}

function clearanceFromContour(value, contour, orientation) {
    let nearestDistance = Infinity;
    let inward = point(0, 0);

    for (let index = 0; index < contour.length; index += 1) {
        const start = contour[index];
        const end = contour[(index + 1) % contour.length];
        const closest = closestPointOnSegment(value, start, end);
        const currentDistance = distance(value, closest);
        if (currentDistance >= nearestDistance) continue;
        nearestDistance = currentDistance;
        const edge = subtract(end, start);
        const edgeLength = length(edge);
        if (edgeLength < EPSILON) continue;
        inward = orientation >= 0
            ? point(-edge.y / edgeLength, edge.x / edgeLength)
            : point(edge.y / edgeLength, -edge.x / edgeLength);
    }

    return {
        signedDistance: pointInPolygon(value, contour) ? nearestDistance : -nearestDistance,
        inward
    };
}

function mainEyeContour(model, transform, segmentCount = 48) {
    return [
        ...sampleCircle(model.left.eye1, transform, segmentCount),
        ...sampleCircle(model.right.eye1, transform, segmentCount)
    ];
}

function evaluateContainment(model, values, headContour, pairCenter, fitScale) {
    const transform = createRigTransform(values, pairCenter, fitScale);
    const eyeContour = mainEyeContour(model, transform);
    const orientation = polygonSignedArea(headContour);
    const guard = Math.max(
        2,
        EYE_DEFAULTS.guard
            * values.rayWidth / EYE_DEFAULTS.referenceRayWidth
            * model.sizeScale
            * fitScale
    );
    let worst = null;

    eyeContour.forEach((sample) => {
        const clearance = clearanceFromContour(sample, headContour, orientation);
        const deficit = guard - clearance.signedDistance;
        if (!worst || deficit > worst.deficit) worst = { ...clearance, deficit, sample };
    });

    return {
        fits: !worst || worst.deficit <= 0.02,
        minClearance: worst ? guard - worst.deficit : Infinity,
        guard,
        worst,
        transform
    };
}

function solveEyePlacement(model, values, headContour) {
    const desiredCenter = point(
        values.focusX,
        values.focusY + EYE_DEFAULTS.centerOffsetY
    );
    const focusCenter = point(values.focusX, values.focusY);
    const contourCenter = scale(
        headContour.reduce((sum, sample) => add(sum, sample), point(0, 0)),
        1 / headContour.length
    );

    const relax = (start, fitScale) => {
        let center = start;
        let result = null;
        for (let iteration = 0; iteration < 72; iteration += 1) {
            result = evaluateContainment(model, values, headContour, center, fitScale);
            if (result.fits) break;
            const correction = Math.min(24, Math.max(0.1, result.worst.deficit + 0.05));
            center = add(center, scale(result.worst.inward, correction));
        }
        return { center, result };
    };

    // Phase one: retain full requested size. The desired optical position is
    // tried first; focus and contour centre are deterministic safe fallbacks
    // for very narrow heads where alternating concave edges can trap a local
    // projection.
    const desiredCandidate = relax(desiredCenter, 1);
    if (desiredCandidate.result?.fits) {
        return {
            desiredCenter,
            pairCenter: desiredCandidate.center,
            fitScale: 1,
            ...desiredCandidate.result
        };
    }

    const fullScaleCandidates = [
        desiredCandidate,
        relax(focusCenter, 1),
        relax(contourCenter, 1)
    ];
    const fittingCandidates = fullScaleCandidates
        .filter((candidate) => candidate.result?.fits)
        .sort((first, second) => distance(first.center, desiredCenter) - distance(second.center, desiredCenter));

    if (fittingCandidates.length) {
        const winner = fittingCandidates[0];
        return { desiredCenter, pairCenter: winner.center, fitScale: 1, ...winner.result };
    }

    const bestFullScale = fullScaleCandidates.sort(
        (first, second) => first.result.worst.deficit - second.result.worst.deficit
    )[0];
    let pairCenter = bestFullScale.center;

    // Phase two: preserve that shifted center and find the largest uniform
    // scale that satisfies the same relative guard field.
    let low = 0.05;
    let high = 1;
    let best = evaluateContainment(model, values, headContour, pairCenter, low);
    if (!best.fits) {
        const smallScaleCandidates = [pairCenter, focusCenter, contourCenter]
            .map((start) => relax(start, low))
            .sort((first, second) => first.result.worst.deficit - second.result.worst.deficit);
        pairCenter = smallScaleCandidates[0].center;
        best = smallScaleCandidates[0].result;
    }
    for (let iteration = 0; iteration < 28; iteration += 1) {
        const middle = (low + high) / 2;
        const result = evaluateContainment(model, values, headContour, pairCenter, middle);
        if (result.fits) {
            low = middle;
            best = result;
        } else {
            high = middle;
        }
    }
    return { desiredCenter, pairCenter, fitScale: low, ...best };
}

function buildRenderedCircle(circle, transform) {
    const points = sampleCircle(circle, transform, 48);
    return { ...circle, points, path: createClosedCurvePath(points) };
}

export function buildEyeGeometry(settings, characterGeometry) {
    const values = {
        ...characterGeometry.values,
        eyePerspective: 50,
        eyeSize: 0,
        eyeDistance: -20,
        cute: 0,
        angry: 0,
        ...settings
    };
    const model = createEyeRigModel(values);
    const headContour = flattenRoundedContour(characterGeometry.rounded);
    const placement = solveEyePlacement(model, values, headContour);
    const transform = createRigTransform(values, placement.pairCenter, placement.fitScale);
    const renderEye = (eye) => ({
        side: eye.side,
        eye1: buildRenderedCircle(eye.eye1, transform),
        top: buildRenderedCircle(eye.top, transform),
        bottom: buildRenderedCircle(eye.bottom, transform)
    });

    return {
        values,
        model,
        left: renderEye(model.left),
        right: renderEye(model.right),
        desiredCenter: placement.desiredCenter,
        pairCenter: placement.pairCenter,
        shift: subtract(placement.pairCenter, placement.desiredCenter),
        fitScale: placement.fitScale,
        guard: placement.guard,
        minClearance: placement.minClearance,
        headContour
    };
}
