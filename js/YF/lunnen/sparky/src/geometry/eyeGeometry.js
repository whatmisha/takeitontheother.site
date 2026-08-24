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
import { rebaseLegacyY } from './coordinateSpace.js';

export const EYE_DEFAULTS = Object.freeze({
    pairCenterX: 240,
    pairCenterY: rebaseLegacyY(270),
    focusX: 240,
    focusY: rebaseLegacyY(292),
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
const CONTAINMENT_RELAX_ITERATIONS = 16;
const FIT_SCALE_BINARY_ITERATIONS = 14;
const FIT_SCALE_CONTINUATION_STEP = 0.08;

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
export function createEyeRigModel({
    cute = 0,
    angry = 0,
    eyeSize = 0,
    eyeDistance = 0,
    lidClosure = 0
} = {}) {
    const sizeAmount = clamp(Number(eyeSize) / 100 || 0, 0, 1);
    const distanceAmount = clamp(Number(eyeDistance) || 0, -100, 100);
    const closureAmount = clamp(Number(lidClosure) || 0, 0, 1);
    // At full blink the opposing lid circles overlap enough to cover every
    // point of eye1. Normal Cute/Angry geometry keeps its designed gap.
    const closureScale = mix(1, 0.88, closureAmount);
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
        const topOffset = scale(
            interpolateLidOffset(side, 'top', cute, angry),
            sizeScale * closureScale
        );
        const bottomOffset = scale(
            interpolateLidOffset(side, 'bottom', cute, angry),
            sizeScale * closureScale
        );
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

function mainEyeContour(model, transform, segmentCount = 48) {
    return [
        ...sampleCircle(model.left.eye1, transform, segmentCount),
        ...sampleCircle(model.right.eye1, transform, segmentCount)
    ];
}

function prepareContainmentContour(contour) {
    const orientation = polygonSignedArea(contour);
    const edges = contour.map((start, index) => {
        const end = contour[(index + 1) % contour.length];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        const edgeLength = Math.sqrt(lengthSquared);
        const inward = edgeLength < EPSILON
            ? point(0, 0)
            : orientation >= 0
                ? point(-dy / edgeLength, dx / edgeLength)
                : point(dy / edgeLength, -dx / edgeLength);
        return {
            start,
            end,
            dx,
            dy,
            lengthSquared,
            inward,
            minX: Math.min(start.x, end.x),
            maxX: Math.max(start.x, end.x),
            minY: Math.min(start.y, end.y),
            maxY: Math.max(start.y, end.y)
        };
    });
    const buildNearestTree = (values) => {
        const bounds = values.reduce((result, edge) => ({
            minX: Math.min(result.minX, edge.minX),
            maxX: Math.max(result.maxX, edge.maxX),
            minY: Math.min(result.minY, edge.minY),
            maxY: Math.max(result.maxY, edge.maxY)
        }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
        if (values.length <= 8) return { ...bounds, edges: values };
        const horizontal = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
        const sorted = [...values].sort((first, second) => (
            horizontal
                ? first.minX + first.maxX - second.minX - second.maxX
                : first.minY + first.maxY - second.minY - second.maxY
        ));
        const middle = Math.floor(sorted.length / 2);
        return {
            ...bounds,
            first: buildNearestTree(sorted.slice(0, middle)),
            second: buildNearestTree(sorted.slice(middle))
        };
    };
    const minY = Math.min(...edges.map((edge) => edge.minY));
    const maxY = Math.max(...edges.map((edge) => edge.maxY));
    const bucketCount = Math.min(64, Math.max(8, Math.ceil(Math.sqrt(edges.length) * 2)));
    const bucketHeight = Math.max(EPSILON, (maxY - minY) / bucketCount);
    const crossingBuckets = Array.from({ length: bucketCount }, () => []);
    edges.forEach((edge) => {
        const first = clamp(Math.floor((edge.minY - minY) / bucketHeight), 0, bucketCount - 1);
        const last = clamp(Math.floor((edge.maxY - minY) / bucketHeight), 0, bucketCount - 1);
        for (let index = first; index <= last; index += 1) crossingBuckets[index].push(edge);
    });
    return {
        contour,
        edges,
        orientation,
        minY,
        maxY,
        bucketHeight,
        crossingBuckets,
        nearestTree: buildNearestTree(edges)
    };
}

function squaredDistanceToBounds(x, y, bounds) {
    const offsetX = x < bounds.minX
        ? bounds.minX - x
        : x > bounds.maxX ? x - bounds.maxX : 0;
    const offsetY = y < bounds.minY
        ? bounds.minY - y
        : y > bounds.maxY ? y - bounds.maxY : 0;
    return offsetX * offsetX + offsetY * offsetY;
}

function findNearestPreparedEdge(x, y, node, nearest, metrics) {
    if (metrics) metrics.bvhNodeChecks += 1;
    if (squaredDistanceToBounds(x, y, node) >= nearest.distanceSquared) return;
    if (node.edges) {
        for (let index = 0; index < node.edges.length; index += 1) {
            if (metrics) metrics.edgeChecks += 1;
            const edge = node.edges[index];
            if (squaredDistanceToBounds(x, y, edge) >= nearest.distanceSquared) continue;
            const projection = edge.lengthSquared > EPSILON
                ? clamp(((x - edge.start.x) * edge.dx + (y - edge.start.y) * edge.dy)
                    / edge.lengthSquared, 0, 1)
                : 0;
            const offsetX = x - (edge.start.x + projection * edge.dx);
            const offsetY = y - (edge.start.y + projection * edge.dy);
            const distanceSquared = offsetX * offsetX + offsetY * offsetY;
            if (distanceSquared >= nearest.distanceSquared) continue;
            nearest.distanceSquared = distanceSquared;
            nearest.inward = edge.inward;
        }
        return;
    }
    const firstDistance = squaredDistanceToBounds(x, y, node.first);
    const secondDistance = squaredDistanceToBounds(x, y, node.second);
    if (firstDistance <= secondDistance) {
        findNearestPreparedEdge(x, y, node.first, nearest, metrics);
        findNearestPreparedEdge(x, y, node.second, nearest, metrics);
    } else {
        findNearestPreparedEdge(x, y, node.second, nearest, metrics);
        findNearestPreparedEdge(x, y, node.first, nearest, metrics);
    }
}

function clearanceFromPreparedContour(x, y, prepared, metrics = null) {
    let inside = false;
    if (y >= prepared.minY && y <= prepared.maxY) {
        const bucketIndex = clamp(
            Math.floor((y - prepared.minY) / prepared.bucketHeight),
            0,
            prepared.crossingBuckets.length - 1
        );
        const candidates = prepared.crossingBuckets[bucketIndex];
        for (let index = 0; index < candidates.length; index += 1) {
            if (metrics) {
                metrics.edgeChecks += 1;
                metrics.crossingChecks += 1;
            }
            const edge = candidates[index];
            if ((edge.start.y > y) !== (edge.end.y > y)
                && x < edge.dx * (y - edge.start.y) / edge.dy + edge.start.x) {
                inside = !inside;
            }
        }
    }
    const nearest = { distanceSquared: Infinity, inward: point(0, 0) };
    findNearestPreparedEdge(x, y, prepared.nearestTree, nearest, metrics);
    const clearance = Math.sqrt(nearest.distanceSquared);
    return {
        signedDistance: inside ? clearance : -clearance,
        inward: nearest.inward
    };
}

function createContainmentContext(model, values, headContour, metrics = null) {
    const unitTransform = createRigTransform(values, point(0, 0), 1);
    return {
        values,
        model,
        eyeOffsets: mainEyeContour(model, unitTransform, 48),
        preparedHead: prepareContainmentContour(headContour),
        metrics
    };
}

function evaluateContainment(context, pairCenter, fitScale, { stopOnFailure = false } = {}) {
    const { values, model, eyeOffsets, preparedHead, metrics } = context;
    if (metrics) metrics.containmentEvaluations += 1;
    const guard = Math.max(
        2,
        EYE_DEFAULTS.guard
            * values.rayWidth / EYE_DEFAULTS.referenceRayWidth
            * model.sizeScale
            * fitScale
    );
    let worst = null;

    for (let index = 0; index < eyeOffsets.length; index += 1) {
        if (metrics) metrics.sampleChecks += 1;
        const offset = eyeOffsets[index];
        const sampleX = pairCenter.x + offset.x * fitScale;
        const sampleY = pairCenter.y + offset.y * fitScale;
        const clearance = clearanceFromPreparedContour(sampleX, sampleY, preparedHead, metrics);
        const deficit = guard - clearance.signedDistance;
        if (!worst || deficit > worst.deficit) {
            worst = { ...clearance, deficit, sample: point(sampleX, sampleY) };
        }
        if (stopOnFailure && deficit > 0.02) {
            if (metrics) metrics.earlyExits += 1;
            break;
        }
    }

    return {
        fits: !worst || worst.deficit <= 0.02,
        minClearance: worst ? guard - worst.deficit : Infinity,
        guard,
        worst,
        transform: createRigTransform(values, pairCenter, fitScale)
    };
}

function minimumContainmentResult(context, pairCenter, fitScale) {
    const { eyeOffsets, preparedHead, metrics } = context;
    let minimum = Infinity;
    let inward = point(0, 0);
    for (let index = 0; index < eyeOffsets.length; index += 1) {
        if (metrics) metrics.sampleChecks += 1;
        const offset = eyeOffsets[index];
        const clearance = clearanceFromPreparedContour(
            pairCenter.x + offset.x * fitScale,
            pairCenter.y + offset.y * fitScale,
            preparedHead,
            metrics
        );
        if (clearance.signedDistance >= minimum) continue;
        minimum = clearance.signedDistance;
        inward = clearance.inward;
    }
    return { minimum, inward };
}

function minimumContainmentClearance(context, pairCenter, fitScale) {
    return minimumContainmentResult(context, pairCenter, fitScale).minimum;
}

function solveEyePlacement(
    model,
    values,
    headContour,
    containmentContext,
    { previousEyeGeometry = null } = {}
) {
    const desiredCenter = point(
        values.focusX,
        values.focusY + EYE_DEFAULTS.centerOffsetY
    );
    const focusCenter = point(values.focusX, values.focusY);
    const contourCenter = scale(
        headContour.reduce((sum, sample) => add(sum, sample), point(0, 0)),
        1 / headContour.length
    );
    const previousValues = previousEyeGeometry?.values;
    const focusDelta = previousValues
        ? point(values.focusX - previousValues.focusX, values.focusY - previousValues.focusY)
        : point(0, 0);
    const focusDistance = Math.hypot(focusDelta.x, focusDelta.y);
    const carry = (center) => center ? add(center, focusDelta) : null;
    const transportedLegacyCenter = carry(previousEyeGeometry?.legacyCenter);
    const continuationCenters = [
        transportedLegacyCenter,
        carry(previousEyeGeometry?.opticalCenter),
        carry(previousEyeGeometry?.pairCenter)
    ].filter(Boolean);
    const previousFitScale = clamp(Number(previousEyeGeometry?.fitScale) || 0.05, 0.05, 1);

    const relax = (start, fitScale) => {
        let center = start;
        let result = null;
        for (let iteration = 0; iteration < CONTAINMENT_RELAX_ITERATIONS; iteration += 1) {
            result = evaluateContainment(containmentContext, center, fitScale);
            if (result.fits) break;
            const correction = Math.min(24, Math.max(0.1, result.worst.deficit + 0.05));
            center = add(center, scale(result.worst.inward, correction));
        }
        return { center, result };
    };

    // Phase one: retain full requested size. A continued frame carries every
    // meaningful center through focusDelta; the optical/final centers often
    // preserve the correct feasible branch when the legacy projection reaches
    // a concave ray valley.
    const continuedFullScale = previousFitScale >= 1 - EPSILON
        ? continuationCenters
            .map((center) => relax(center, 1))
            .filter((candidate) => candidate.result?.fits)
            .sort((first, second) => (
                distance(first.center, desiredCenter) - distance(second.center, desiredCenter)
            ))[0]
        : null;
    if (continuedFullScale) {
        return {
            desiredCenter,
            pairCenter: continuedFullScale.center,
            fitScale: 1,
            ...continuedFullScale.result
        };
    }

    // A full-scale fallback is only needed if every carried seed lost
    // containment. It also lets a previously scaled branch rejoin the stable
    // full-size branch gradually instead of ballooning in one pointer frame.
    const fullScaleCandidates = [
        relax(desiredCenter, 1),
        relax(focusCenter, 1),
        relax(contourCenter, 1)
    ];
    const fittingCandidates = fullScaleCandidates
        .filter((candidate) => candidate.result?.fits)
        .sort((first, second) => distance(first.center, desiredCenter) - distance(second.center, desiredCenter));

    if (fittingCandidates.length) {
        const winner = fittingCandidates[0];
        const fitScale = transportedLegacyCenter
            ? Math.min(
                1,
                previousFitScale + (focusDistance > EPSILON ? FIT_SCALE_CONTINUATION_STEP : 0)
            )
            : 1;
        const continued = fitScale >= 1 - EPSILON
            ? winner
            : relax(winner.center, fitScale);
        if (continued.result?.fits) {
            return {
                desiredCenter,
                pairCenter: continued.center,
                fitScale,
                ...continued.result
            };
        }
    }

    // If full scale is impossible, keep one deterministic containment branch.
    // Picking whichever failed relaxation currently has the smallest deficit
    // causes discontinuous center/scale switches between adjacent Focus frames.
    let pairCenter = transportedLegacyCenter || contourCenter;

    // Phase two: preserve that shifted center and find the largest uniform
    // scale that satisfies the same relative guard field.
    let low = 0.05;
    let high = 1;
    let best = evaluateContainment(containmentContext, pairCenter, low);
    if (!best.fits) {
        const recovered = relax(pairCenter, low);
        pairCenter = recovered.center;
        best = recovered.result;
    }
    const previousScale = clamp(previousFitScale, low, high);
    if (previousScale > low && previousScale < high) {
        const previousResult = evaluateContainment(
            containmentContext,
            pairCenter,
            previousScale,
            { stopOnFailure: true }
        );
        if (previousResult.fits) {
            low = previousScale;
            best = previousResult;
        } else {
            high = previousScale;
        }
    }
    for (let iteration = 0; iteration < FIT_SCALE_BINARY_ITERATIONS; iteration += 1) {
        const middle = (low + high) / 2;
        const result = evaluateContainment(
            containmentContext,
            pairCenter,
            middle,
            { stopOnFailure: true }
        );
        if (result.fits) {
            low = middle;
            best = result;
        } else {
            high = middle;
        }
    }
    return { desiredCenter, pairCenter, fitScale: low, ...best };
}

function sampleCircularCorner(corner, sampleCount = 4) {
    if (!corner || corner.radius <= EPSILON) return [corner?.vertex].filter(Boolean);
    // Corner smoothing deliberately does not participate in face placement.
    // circularStart/circularEnd are the underlying Roundness-only tangent points.
    const start = corner.circularStart || corner.start;
    const end = corner.circularEnd || corner.end;
    const tangentDistance = distance(corner.vertex, start);
    const bisector = add(corner.towardPrevious, corner.towardNext);
    const bisectorLength = length(bisector);
    const halfAngleCosine = Math.cos(Math.atan(Math.abs(corner.tangent)));
    if (bisectorLength < EPSILON || Math.abs(halfAngleCosine) < EPSILON) return [corner.vertex];
    const center = add(
        corner.vertex,
        scale(bisector, tangentDistance / (halfAngleCosine * bisectorLength))
    );
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    const delta = directedArcDelta(startAngle, endAngle, corner.sweep);
    return Array.from({ length: sampleCount + 1 }, (_, index) => {
        const angle = startAngle + delta * index / sampleCount;
        return point(
            center.x + Math.cos(angle) * corner.radius,
            center.y + Math.sin(angle) * corner.radius
        );
    });
}

/**
 * The soft facial field is the central sector enclosed by the base closure and
 * the chain of neighbouring-ray intersections. Only circular Roundness arcs
 * alter it; Corner smoothing is intentionally ignored.
 */
export function buildFaceFieldContour(characterGeometry, samplesPerCorner = 4) {
    const selected = characterGeometry.vertexMeta
        .map((meta, index) => ({ meta, corner: characterGeometry.rounded.corners[index] }))
        .filter(({ meta }) => meta.kind === 'base' || meta.kind === 'valley');
    return selected.flatMap(({ corner }) => sampleCircularCorner(corner, samplesPerCorner));
}

function contourBounds(contour) {
    return contour.reduce((bounds, value) => ({
        minX: Math.min(bounds.minX, value.x),
        maxX: Math.max(bounds.maxX, value.x),
        minY: Math.min(bounds.minY, value.y),
        maxY: Math.max(bounds.maxY, value.y)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function downsampleContour(contour, maximumPoints = 96) {
    if (contour.length <= maximumPoints) return contour;
    return Array.from({ length: maximumPoints }, (_, index) => (
        contour[Math.floor(index * contour.length / maximumPoints)]
    ));
}

function preparePlacementContour(contour) {
    return contour.map((start, index) => {
        const end = contour[(index + 1) % contour.length];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return { start, end, dx, dy, lengthSquared: dx * dx + dy * dy };
    });
}

function preparedSignedClearance(x, y, edges) {
    let inside = false;
    let minimumSquared = Infinity;
    for (let index = 0; index < edges.length; index += 1) {
        const edge = edges[index];
        const { start, end, dx, dy, lengthSquared } = edge;
        const projection = lengthSquared > EPSILON
            ? clamp(((x - start.x) * dx + (y - start.y) * dy) / lengthSquared, 0, 1)
            : 0;
        const offsetX = x - (start.x + projection * dx);
        const offsetY = y - (start.y + projection * dy);
        minimumSquared = Math.min(minimumSquared, offsetX * offsetX + offsetY * offsetY);
        if ((start.y > y) !== (end.y > y)
            && x < dx * (y - start.y) / dy + start.x) {
            inside = !inside;
        }
    }
    const clearance = Math.sqrt(minimumSquared);
    return inside ? clearance : -clearance;
}

function placementClearanceStats(localEyeContour, center, preparedContour) {
    let minimum = Infinity;
    let sum = 0;
    for (let index = 0; index < localEyeContour.length; index += 1) {
        const sample = localEyeContour[index];
        const clearance = preparedSignedClearance(
            sample.x + center.x,
            sample.y + center.y,
            preparedContour
        );
        minimum = Math.min(minimum, clearance);
        sum += clearance;
    }
    return { minimum, average: sum / localEyeContour.length };
}

function scoreOpticalPlacement(localEyeContour, center, faceContour, headContour) {
    const headClearances = placementClearanceStats(
        localEyeContour,
        center,
        headContour
    );
    const minimumHeadClearance = headClearances.minimum;
    const minimumGap = 1;
    if (minimumHeadClearance < minimumGap) {
        return {
            score: -1e6 + minimumHeadClearance * 1e3,
            minimumHeadClearance,
            feasible: false
        };
    }

    const fieldClearances = placementClearanceStats(
        localEyeContour,
        center,
        faceContour
    );
    const minimumFieldClearance = fieldClearances.minimum;
    const averageFieldClearance = fieldClearances.average;
    return {
        // The worst point locates the complete footprint; the small mean term
        // removes ambiguous plateaus without turning the field into a hard mask.
        score: minimumFieldClearance + averageFieldClearance * 0.08,
        minimumHeadClearance,
        minimumFieldClearance,
        feasible: true
    };
}

function refinePlacement(bounds, evaluate, seed, {
    iterations,
    stepX,
    stepY
}) {
    let current = { center: seed, result: evaluate(seed) };
    let refinementLevel = 0;
    let sweep = 0;
    while (refinementLevel < iterations && sweep < iterations * 5) {
        sweep += 1;
        let localWinner = current;
        for (let y = -1; y <= 1; y += 1) {
            for (let x = -1; x <= 1; x += 1) {
                const center = point(
                    clamp(current.center.x + x * stepX, bounds.minX, bounds.maxX),
                    clamp(current.center.y + y * stepY, bounds.minY, bounds.maxY)
                );
                const candidate = { center, result: evaluate(center) };
                if (candidate.result.score > localWinner.result.score) localWinner = candidate;
            }
        }
        if (distance(localWinner.center, current.center) > EPSILON) {
            // Follow the current ridge at a stable resolution. Shrinking the
            // grid immediately after every move makes a single coarse choice
            // irreversible and is the main source of branch loss.
            current = localWinner;
        } else {
            stepX /= 2;
            stepY /= 2;
            refinementLevel += 1;
        }
    }
    return current;
}

function refinePlacementBeam(bounds, evaluate, seed, {
    iterations,
    stepX,
    stepY,
    beamWidth = 3
}) {
    let frontier = [{ center: seed, result: evaluate(seed) }];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const candidates = [];
        frontier.forEach((current) => {
            for (let y = -1; y <= 1; y += 1) {
                for (let x = -1; x <= 1; x += 1) {
                    const center = point(
                        clamp(current.center.x + x * stepX, bounds.minX, bounds.maxX),
                        clamp(current.center.y + y * stepY, bounds.minY, bounds.maxY)
                    );
                    candidates.push({ center, result: evaluate(center) });
                }
            }
        });
        candidates.sort((first, second) => second.result.score - first.result.score);
        const minimumSpacing = Math.hypot(stepX, stepY) * 0.45;
        frontier = [];
        candidates.forEach((candidate) => {
            if (frontier.length >= beamWidth) return;
            if (frontier.some((current) => distance(current.center, candidate.center) < minimumSpacing)) return;
            frontier.push(candidate);
        });
        // Boundary clamping can collapse a grid. Fill any remaining beam slots
        // with distinct candidates so refinement never loses all alternatives.
        candidates.forEach((candidate) => {
            if (frontier.length >= beamWidth) return;
            if (frontier.some((current) => distance(current.center, candidate.center) <= EPSILON)) return;
            frontier.push(candidate);
        });
        stepX /= 2;
        stepY /= 2;
    }
    return frontier[0];
}

function searchGlobalPlacement(bounds, evaluate, seeds = []) {
    const width = Math.max(EPSILON, bounds.maxX - bounds.minX);
    const height = Math.max(EPSILON, bounds.maxY - bounds.minY);
    const coarseSteps = 12;
    const candidates = seeds.filter(Boolean);
    for (let row = 0; row <= coarseSteps; row += 1) {
        for (let column = 0; column <= coarseSteps; column += 1) {
            candidates.push(point(
                bounds.minX + width * column / coarseSteps,
                bounds.minY + height * row / coarseSteps
            ));
        }
    }

    const ranked = candidates
        .map((center) => ({ center, result: evaluate(center) }))
        .sort((first, second) => second.result.score - first.result.score)
        .slice(0, 5);
    let winner = ranked[0];
    ranked.forEach((seed) => {
        const current = refinePlacement(bounds, evaluate, seed.center, {
            iterations: 9,
            stepX: width / coarseSteps,
            stepY: height / coarseSteps
        });
        if (!winner || current.result.score > winner.result.score) winner = current;
    });
    const precise = refinePlacementBeam(bounds, evaluate, winner.center, {
        iterations: 9,
        stepX: width / 192,
        stepY: height / 192,
        beamWidth: 4
    });
    if (precise.result.score > winner.result.score) winner = precise;
    return winner;
}

function searchLocalPlacement(bounds, evaluate, seeds, focusDelta) {
    const width = Math.max(EPSILON, bounds.maxX - bounds.minX);
    const height = Math.max(EPSILON, bounds.maxY - bounds.minY);
    // A tiny branch guard keeps three-by-three anchor seeds alive when the
    // transported optimum crosses a concave facial ridge. This is deliberately
    // sparse; the full 13×13 search remains reserved for global placement.
    const branchSeeds = [];
    for (let row = 1; row <= 3; row += 1) {
        for (let column = 1; column <= 3; column += 1) {
            branchSeeds.push(point(
                bounds.minX + width * column / 4,
                bounds.minY + height * row / 4
            ));
        }
    }
    const ranked = [...seeds, ...branchSeeds]
        .filter(Boolean)
        .map((center) => ({ center, result: evaluate(center) }))
        .sort((first, second) => second.result.score - first.result.score);
    const transported = seeds[0]
        ? { center: seeds[0], result: evaluate(seeds[0]), transported: true }
        : null;
    const selected = [transported].filter(Boolean);
    ranked.forEach((candidate) => {
        if (selected.length >= 4) return;
        if (selected.some((seed) => distance(seed.center, candidate.center) <= EPSILON)) return;
        selected.push(candidate);
    });
    if (!selected.length) return null;
    // Every carried seed has already been translated by focusDelta. The first
    // grid therefore searches the residual optical drift, not the full pointer
    // displacement; a large first step can jump across a narrow feasible ridge.
    const stepX = Math.min(width / 12, Math.max(width / 32, Math.abs(focusDelta.x) * 0.4));
    const stepY = Math.min(height / 12, Math.max(height / 32, Math.abs(focusDelta.y) * 0.4));
    let winner = selected[0];
    selected.forEach((seed) => {
        const current = refinePlacementBeam(bounds, evaluate, seed.center, {
            iterations: 6,
            stepX,
            stepY,
            beamWidth: seed.transported ? 3 : 2
        });
        if (current.result.score > winner.result.score) winner = current;
    });
    // Restart once at sub-pixel scale. Min-clearance objectives can contain a
    // thin ridge that is invisible to the larger grid and should not become a
    // separate interactive branch.
    const precise = refinePlacementBeam(bounds, evaluate, winner.center, {
        iterations: 9,
        stepX: width / 192,
        stepY: height / 192,
        beamWidth: 4
    });
    if (precise.result.score > winner.result.score) winner = precise;
    return winner;
}

function smoothstep(value) {
    const amount = clamp(value, 0, 1);
    return amount * amount * (3 - 2 * amount);
}

function solveOpticalPairCenter(
    model,
    values,
    characterGeometry,
    headContour,
    legacyPlacement,
    containmentContext,
    { local = false, previousEyeGeometry = null } = {}
) {
    const faceContour = buildFaceFieldContour(characterGeometry);
    const sampledHead = downsampleContour(headContour, 32);
    const preparedFace = preparePlacementContour(faceContour);
    const preparedHead = preparePlacementContour(sampledHead);
    const localTransform = createRigTransform(values, point(0, 0), legacyPlacement.fitScale);
    const localEyeContour = mainEyeContour(model, localTransform, 8);
    const faceBounds = contourBounds(faceContour);
    const opticalEvaluationCache = new Map();
    const opticalEvaluation = (center) => {
        const key = `${center.x},${center.y}`;
        const cached = opticalEvaluationCache.get(key);
        if (cached) {
            if (containmentContext.metrics) containmentContext.metrics.opticalCacheHits += 1;
            return cached;
        }
        if (containmentContext.metrics) containmentContext.metrics.opticalEvaluations += 1;
        const result = scoreOpticalPlacement(
            localEyeContour,
            center,
            preparedFace,
            preparedHead
        );
        opticalEvaluationCache.set(key, result);
        return result;
    };
    const previousValues = previousEyeGeometry?.values;
    const focusDelta = previousValues
        ? point(values.focusX - previousValues.focusX, values.focusY - previousValues.focusY)
        : point(0, 0);
    const carry = (center) => center ? add(center, focusDelta) : null;
    const desiredCenter = point(values.focusX, values.focusY + EYE_DEFAULTS.centerOffsetY);
    const opticalSeeds = [
        carry(previousEyeGeometry?.opticalSeed),
        carry(previousEyeGeometry?.opticalCenter),
        carry(previousEyeGeometry?.legacyCenter),
        carry(previousEyeGeometry?.pairCenter),
        legacyPlacement.pairCenter,
        desiredCenter
    ];
    const localOptical = searchLocalPlacement(
        faceBounds,
        opticalEvaluation,
        opticalSeeds,
        focusDelta
    );
    const optical = local
        ? localOptical
        : searchGlobalPlacement(
            faceBounds,
            opticalEvaluation,
            [localOptical?.center, ...opticalSeeds]
        );
    const horizontal = clamp((values.focusX - EYE_DEFAULTS.focusX) / 120, -1, 1);
    const verticalRange = values.focusY < EYE_DEFAULTS.focusY ? 112 : 98;
    const vertical = clamp((values.focusY - EYE_DEFAULTS.focusY) / verticalRange, -1, 1);
    const focusAmount = smoothstep(Math.min(1, Math.hypot(horizontal, vertical) / Math.SQRT2));
    // One corpus-wide optical law: the sector apex provides facial gravity,
    // while normalized Focus displacement adds a continuous directional bias.
    // Horizontal influence is stronger because the sector itself already
    // carries most of the vertical movement as Focus changes.
    const widthRatio = values.rayWidth / EYE_DEFAULTS.referenceRayWidth;
    const verticalFaceGravity = 0.24605697262036413
        + Math.max(0, widthRatio - 1) * 0.08
        + vertical * Math.min(1, widthRatio) * 0.05;
    const opticalCenter = point(
        optical.center.x + (characterGeometry.baseClosure.x - optical.center.x) * 0.35,
        optical.center.y
            + (characterGeometry.baseClosure.y - optical.center.y) * verticalFaceGravity
    );
    const horizontalFocusInfluence = (0.72 + Math.max(0, vertical) * 0.43) * focusAmount;
    const target = point(
        opticalCenter.x + (values.focusX - optical.center.x) * horizontalFocusInfluence,
        opticalCenter.y + (values.focusY - optical.center.y) * 0.05 * focusAmount
    );
    const enforceExactHeadGap = (center) => {
        const minimumGap = 1;
        let candidate = center;
        for (let iteration = 0; iteration < 24; iteration += 1) {
            const result = minimumContainmentResult(
                containmentContext,
                candidate,
                legacyPlacement.fitScale
            );
            if (result.minimum >= minimumGap) {
                return { center: candidate, minimumClearance: result.minimum };
            }
            candidate = add(
                candidate,
                scale(result.inward, Math.min(16, minimumGap - result.minimum + 0.025))
            );
        }
        const safeCenter = legacyPlacement.pairCenter;
        return {
            center: safeCenter,
            minimumClearance: minimumContainmentClearance(
                containmentContext,
                safeCenter,
                legacyPlacement.fitScale
            )
        };
    };
    // The optical optimum is already selected above. If Focus bias takes that
    // target through the hard head boundary, project it deterministically from
    // the target itself. Running a second global aesthetic search here
    // would introduce another, unrelated placement law at the boundary.
    const exact = enforceExactHeadGap(target);
    return {
        faceContour,
        opticalSeed: optical.center,
        opticalCenter,
        pairCenter: exact.center,
        minimumHeadClearance: exact.minimumClearance
    };
}

function buildRenderedCircle(circle, transform) {
    const points = sampleCircle(circle, transform, 48);
    return { ...circle, points, path: createClosedCurvePath(points) };
}

/** Rebuilds only the lid cutters while retaining the exact eye placement. */
export function buildEyeLidGeometry(settings, eyeGeometry) {
    const values = { ...eyeGeometry.values, ...settings };
    const model = createEyeRigModel(values);
    const transform = createRigTransform(values, eyeGeometry.pairCenter, eyeGeometry.fitScale);
    return Object.fromEntries(['left', 'right'].map((side) => [side, {
        top: buildRenderedCircle(model[side].top, transform),
        bottom: buildRenderedCircle(model[side].bottom, transform)
    }]));
}

export function buildEyeGeometry(settings, characterGeometry, options = {}) {
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
    const solverMetrics = {
        containmentEvaluations: 0,
        opticalEvaluations: 0,
        opticalCacheHits: 0,
        sampleChecks: 0,
        edgeChecks: 0,
        crossingChecks: 0,
        bvhNodeChecks: 0,
        earlyExits: 0,
        legacyMs: 0,
        opticalMs: 0,
        fallbackReason: null
    };
    const containmentContext = createContainmentContext(model, values, headContour, solverMetrics);
    const requestedLocal = options.placementMode === 'local';
    const previousEyeGeometry = options.previousEyeGeometry;
    const previousValues = previousEyeGeometry?.values;
    const topologyMatches = previousValues
        && previousValues.boundaryType === values.boundaryType
        && Math.round(previousValues.rayCount) === Math.round(values.rayCount);
    const focusDelta = previousValues
        ? Math.hypot(values.focusX - previousValues.focusX, values.focusY - previousValues.focusY)
        : Infinity;
    const canRefineLocally = requestedLocal && topologyMatches && focusDelta <= 64;
    // Containment and fitScale deliberately use the same exact law in both
    // modes. Only the optical search strategy changes.
    let startedAt = performance.now();
    const legacyPlacement = solveEyePlacement(
        model,
        values,
        headContour,
        containmentContext,
        {
            previousEyeGeometry: topologyMatches && focusDelta <= 64
                ? previousEyeGeometry
                : null
        }
    );
    solverMetrics.legacyMs = performance.now() - startedAt;
    // fitScale is solved exactly for the current frame above. A scale delta is
    // therefore not a topology change and must not force an unrelated global
    // optical search; the current scale participates in every local score.
    const localPlacement = canRefineLocally;
    solverMetrics.fallbackReason = localPlacement
        ? null
        : !requestedLocal
            ? 'requested-global'
            : !topologyMatches
                ? 'topology'
                : focusDelta > 64
                    ? 'focus-delta'
                    : 'missing-seed';
    startedAt = performance.now();
    const opticalPlacement = solveOpticalPairCenter(
        model,
        values,
        characterGeometry,
        headContour,
        legacyPlacement,
        containmentContext,
        { local: localPlacement, previousEyeGeometry }
    );
    solverMetrics.opticalMs = performance.now() - startedAt;
    const placement = {
        ...legacyPlacement,
        pairCenter: opticalPlacement.pairCenter,
        minClearance: opticalPlacement.minimumHeadClearance
    };
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
        placementMode: localPlacement ? 'local' : 'global',
        left: renderEye(model.left),
        right: renderEye(model.right),
        desiredCenter: placement.desiredCenter,
        legacyCenter: legacyPlacement.pairCenter,
        pairCenter: placement.pairCenter,
        shift: subtract(placement.pairCenter, placement.desiredCenter),
        opticalCenter: opticalPlacement.opticalCenter,
        opticalSeed: opticalPlacement.opticalSeed,
        fitScale: placement.fitScale,
        guard: 1,
        minClearance: placement.minClearance,
        solverMetrics,
        headContour,
        faceContour: opticalPlacement.faceContour
    };
}
