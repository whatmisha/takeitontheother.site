import { clamp, distance } from '../geometry/vector.js';
import { createMotionPathRegion } from '../geometry/focusBounds.js?v=20260828-2';

const TAU = Math.PI * 2;
const LENGTH_SAMPLES = 64;
const CONTAINMENT_SAMPLES = 192;
const CONTAINMENT_ITERATIONS = 18;
const BOUNDARY_HANDLE_MIN_LENGTH = 14;

export const FOCUS_PATH_COMPLEXITY = Object.freeze({
    soft: Object.freeze({
        angularJitter: 0.16,
        radiusMin: 0.24,
        radiusMax: 0.92,
        strideRatio: 0,
        handleFactor: 0.34,
        radialExponent: 1.12
    }),
    medium: Object.freeze({
        angularJitter: 0.38,
        radiusMin: 0.12,
        radiusMax: 0.94,
        strideRatio: 0,
        handleFactor: 0.29,
        radialExponent: 1.06
    }),
    hard: Object.freeze({
        angularJitter: 0.68,
        radiusMin: 0.05,
        radiusMax: 0.96,
        strideRatio: 0,
        handleFactor: 0.23,
        radialExponent: 0.94
    })
});

const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => {
    const rounded = Number(value.toFixed(4));
    return Object.is(rounded, -0) ? 0 : rounded;
};
const copyPoint = (value) => ({ x: value.x, y: value.y });
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const addScaled = (origin, direction, amount) => ({
    x: origin.x + direction.x * amount,
    y: origin.y + direction.y * amount
});
const vectorLength = (value) => Math.hypot(value.x, value.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const mix = (first, second, amount) => first + (second - first) * amount;

const LEGACY_COMPLEXITY = Object.freeze({ soft: 0, medium: 50, hard: 100 });

export function normalizeMotionComplexity(value) {
    if (typeof value === 'string' && value in LEGACY_COMPLEXITY) {
        return LEGACY_COMPLEXITY[value];
    }
    return clamp(finiteOr(value, 0), 0, 100);
}

export function normalizeMotionSmoothness(value) {
    return clamp(finiteOr(value, 0), 0, 100);
}

function smoothnessAmount(value) {
    const normalized = normalizeMotionSmoothness(value) / 100;
    return normalized * normalized * (3 - 2 * normalized);
}

function interpolateProfile(first, second, amount) {
    return Object.fromEntries(Object.keys(first).map((key) => [
        key,
        first[key] + (second[key] - first[key]) * amount
    ]));
}

function complexityProfile(value) {
    const normalized = normalizeMotionComplexity(value);
    if (normalized <= 50) {
        return interpolateProfile(
            FOCUS_PATH_COMPLEXITY.soft,
            FOCUS_PATH_COMPLEXITY.medium,
            normalized / 50
        );
    }
    return interpolateProfile(
        FOCUS_PATH_COMPLEXITY.medium,
        FOCUS_PATH_COMPLEXITY.hard,
        (normalized - 50) / 50
    );
}

function unit(value, fallback = { x: 1, y: 0 }) {
    const magnitude = vectorLength(value);
    if (magnitude <= 1e-9) return copyPoint(fallback);
    return { x: value.x / magnitude, y: value.y / magnitude };
}

function gcd(a, b) {
    let left = Math.abs(Math.round(a));
    let right = Math.abs(Math.round(b));
    while (right) [left, right] = [right, left % right];
    return left;
}

function coprimeStride(count, requested) {
    if (count <= 2) return 1;
    const target = clamp(Math.round(requested), 1, count - 1);
    for (let offset = 0; offset < count; offset += 1) {
        const lower = target - offset;
        if (lower >= 1 && gcd(lower, count) === 1) return lower;
        const upper = target + offset;
        if (upper < count && gcd(upper, count) === 1) return upper;
    }
    return 1;
}

export function normalizeMotionSeed(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? (Math.round(numeric) >>> 0) : 1;
}

export function createMotionRandom(seed) {
    let state = normalizeMotionSeed(seed) || 0x6d2b79f5;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function constrainToCircle(raw, center, radius) {
    const dx = finiteOr(raw?.x, center.x) - center.x;
    const dy = finiteOr(raw?.y, center.y) - center.y;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude <= radius || magnitude <= 1e-9) {
        return { x: center.x + dx, y: center.y + dy };
    }
    return {
        x: center.x + dx * radius / magnitude,
        y: center.y + dy * radius / magnitude
    };
}

function boundaryAwareTangent(anchor, tangent, center, radius, smoothness = 0) {
    const radialVector = subtract(anchor, center);
    const radialDistance = vectorLength(radialVector);
    const amount = smoothnessAmount(smoothness);
    const blendStart = mix(0.88, 0.84, amount);
    const blendEnd = mix(0.995, 0.98, amount);
    if (radialDistance <= radius * blendStart || radialDistance <= 1e-9) return tangent;

    const radial = unit(radialVector);
    let boundaryTangent = { x: -radial.y, y: radial.x };
    if (dot(boundaryTangent, tangent) < 0) {
        boundaryTangent = { x: -boundaryTangent.x, y: -boundaryTangent.y };
    }
    const blend = clamp(
        (radialDistance / radius - blendStart) / Math.max(1e-9, blendEnd - blendStart),
        0,
        1
    );
    return unit({
        x: tangent.x * (1 - blend) + boundaryTangent.x * blend,
        y: tangent.y * (1 - blend) + boundaryTangent.y * blend
    }, boundaryTangent);
}

function createAnchors({ start, center, radius, pointCount, profile, random }) {
    const count = clamp(Math.round(finiteOr(pointCount, 6)), 2, 16);
    const first = constrainToCircle(start, center, radius);
    const generatedCount = count - 1;
    const baseAngle = random() * TAU;
    const angularStep = TAU / generatedCount;
    const pool = [];
    const primaryEdgeIndex = Math.floor(random() * generatedCount);

    for (let index = 0; index < generatedCount; index += 1) {
        const jitter = (random() - 0.5) * angularStep * profile.angularJitter;
        const angle = baseAngle + index * angularStep + jitter;
        const radialRandom = random();
        const radialMix = Math.pow(radialRandom, profile.radialExponent);
        const radialRatio = index === primaryEdgeIndex
            ? 0.9 + radialRandom * 0.1
            : profile.radiusMin + (profile.radiusMax - profile.radiusMin) * radialMix;
        pool.push({
            x: center.x + Math.cos(angle) * radius * radialRatio,
            y: center.y + Math.sin(angle) * radius * radialRatio
        });
    }

    const requestedStride = profile.strideRatio <= 0
        ? 1
        : Math.max(1, generatedCount * profile.strideRatio);
    const stride = coprimeStride(generatedCount, requestedStride);
    const offset = Math.floor(random() * generatedCount);
    const ordered = [];
    for (let index = 0; index < generatedCount; index += 1) {
        ordered.push(pool[(offset + index * stride) % generatedCount]);
    }
    return [first, ...ordered];
}

function constrainedAnchor(point, center, radius, minimumRadius = 0) {
    const constrained = constrainToCircle(point, center, radius);
    const offset = subtract(constrained, center);
    const magnitude = vectorLength(offset);
    if (magnitude >= minimumRadius || minimumRadius <= 0) return constrained;
    const fallback = unit(subtract(point, center), { x: 1, y: 0 });
    const direction = unit(offset, fallback);
    return addScaled(center, direction, minimumRadius);
}

function addPairSeparation(displacements, anchors, firstIndex, secondIndex, minimumDistance, strength) {
    const first = anchors[firstIndex];
    const second = anchors[secondIndex];
    const offset = subtract(second, first);
    const currentDistance = vectorLength(offset);
    if (currentDistance >= minimumDistance) return;
    const fallbackAngle = (firstIndex * 0.754877666 + secondIndex * 0.569840296) * TAU;
    const direction = unit(offset, {
        x: Math.cos(fallbackAngle),
        y: Math.sin(fallbackAngle)
    });
    const push = (minimumDistance - currentDistance) * strength;
    const firstMovable = firstIndex !== 0;
    const secondMovable = secondIndex !== 0;
    const movableCount = Number(firstMovable) + Number(secondMovable);
    if (!movableCount) return;
    const share = push / movableCount;
    if (firstMovable) {
        displacements[firstIndex].x -= direction.x * share;
        displacements[firstIndex].y -= direction.y * share;
    }
    if (secondMovable) {
        displacements[secondIndex].x += direction.x * share;
        displacements[secondIndex].y += direction.y * share;
    }
}

function addTurnOpening(displacements, anchors, index, minimumAngle, strength) {
    const count = anchors.length;
    const previousIndex = (index - 1 + count) % count;
    const nextIndex = (index + 1) % count;
    const anchor = anchors[index];
    const toPrevious = subtract(anchors[previousIndex], anchor);
    const toNext = subtract(anchors[nextIndex], anchor);
    const previousLength = vectorLength(toPrevious);
    const nextLength = vectorLength(toNext);
    if (previousLength <= 1e-9 || nextLength <= 1e-9) return;
    const previousDirection = unit(toPrevious);
    const nextDirection = unit(toNext);
    const angle = Math.acos(clamp(dot(previousDirection, nextDirection), -1, 1));
    if (angle >= minimumAngle) return;

    const bisector = unit({
        x: previousDirection.x + nextDirection.x,
        y: previousDirection.y + nextDirection.y
    }, { x: -previousDirection.y, y: previousDirection.x });
    const perpendicular = { x: -bisector.y, y: bisector.x };
    let previousSign = Math.sign(dot(previousDirection, perpendicular));
    if (!previousSign) previousSign = cross(previousDirection, nextDirection) >= 0 ? -1 : 1;
    const deficit = (minimumAngle - angle) / Math.max(minimumAngle, 1e-9);
    const push = Math.min(previousLength, nextLength) * deficit * strength;
    if (previousIndex !== 0) {
        displacements[previousIndex].x += perpendicular.x * previousSign * push;
        displacements[previousIndex].y += perpendicular.y * previousSign * push;
    }
    if (nextIndex !== 0) {
        displacements[nextIndex].x -= perpendicular.x * previousSign * push;
        displacements[nextIndex].y -= perpendicular.y * previousSign * push;
    }
}

function regularizeAnchors(source, center, radius, smoothness) {
    const amount = smoothnessAmount(smoothness);
    if (amount <= 0) return source.map(copyPoint);

    const anchors = source.map(copyPoint);
    if (source.length <= 2) return anchors;
    const count = anchors.length;
    const edgeRadii = source.map((anchor, index) => {
        if (index === 0) return vectorLength(subtract(anchor, center));
        const originalRadius = vectorLength(subtract(anchor, center));
        return originalRadius >= radius * 0.9
            ? originalRadius
            : 0;
    });
    const adjacentRatio = clamp(1.22 / Math.sqrt(count), 0.27, 0.56);
    const minimumAdjacentDistance = radius * adjacentRatio * amount;
    const minimumFreeDistance = minimumAdjacentDistance * 0.58;
    const minimumTurnAngle = mix(4, 44, amount) * Math.PI / 180;
    const iterations = Math.max(2, Math.ceil(3 + amount * 8));
    const maximumStep = radius * mix(0.025, 0.075, amount);
    const maximumGeneratedRadius = radius;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const displacements = anchors.map(() => ({ x: 0, y: 0 }));
        for (let index = 0; index < count; index += 1) {
            addPairSeparation(
                displacements,
                anchors,
                index,
                (index + 1) % count,
                minimumAdjacentDistance,
                mix(0.34, 0.52, amount)
            );
        }
        for (let first = 0; first < count; first += 1) {
            for (let second = first + 1; second < count; second += 1) {
                const adjacent = second === first + 1 || (first === 0 && second === count - 1);
                if (!adjacent) {
                    addPairSeparation(
                        displacements,
                        anchors,
                        first,
                        second,
                        minimumFreeDistance,
                        mix(0.12, 0.24, amount)
                    );
                }
            }
        }
        anchors.forEach((_, index) => {
            addTurnOpening(
                displacements,
                anchors,
                index,
                minimumTurnAngle,
                mix(0.035, 0.1, amount)
            );
        });

        for (let index = 1; index < count; index += 1) {
            const displacement = displacements[index];
            const magnitude = vectorLength(displacement);
            const scale = magnitude > maximumStep ? maximumStep / magnitude : 1;
            const edgeRadius = edgeRadii[index];
            anchors[index] = constrainedAnchor({
                x: anchors[index].x + displacement.x * scale,
                y: anchors[index].y + displacement.y * scale
            }, center, edgeRadius || maximumGeneratedRadius, edgeRadius);
        }
        anchors[0] = copyPoint(source[0]);
    }
    return anchors;
}

function createTangents(anchors, center, radius, smoothness = 0) {
    if (anchors.length === 2) {
        const chord = unit(subtract(anchors[1], anchors[0]));
        const tangent = { x: -chord.y, y: chord.x };
        return anchors.map((anchor) => (
            boundaryAwareTangent(anchor, tangent, center, radius, smoothness)
        ));
    }
    return anchors.map((anchor, index) => {
        const previous = anchors[(index - 1 + anchors.length) % anchors.length];
        const next = anchors[(index + 1) % anchors.length];
        const fallback = unit(subtract(next, anchor));
        const weighted = unit(subtract(next, previous), fallback);
        const incoming = unit(subtract(anchor, previous), weighted);
        const outgoing = unit(subtract(next, anchor), weighted);
        const bisector = unit({
            x: incoming.x + outgoing.x,
            y: incoming.y + outgoing.y
        }, weighted);
        const amount = smoothnessAmount(smoothness);
        const tangent = unit({
            x: mix(weighted.x, bisector.x, amount),
            y: mix(weighted.y, bisector.y, amount)
        }, weighted);
        return boundaryAwareTangent(anchor, tangent, center, radius, smoothness);
    });
}

function createSegments(anchors, tangents, center, radius, profile, smoothness = 0) {
    const amount = smoothnessAmount(smoothness);
    return anchors.map((start, index) => {
        const endIndex = (index + 1) % anchors.length;
        const end = anchors[endIndex];
        const chord = distance(start, end);
        const previous = anchors[(index - 1 + anchors.length) % anchors.length];
        const next = anchors[(endIndex + 1) % anchors.length];
        const previousChord = distance(previous, start);
        const nextChord = distance(end, next);
        const supportLimit = 1 + amount * 1.25;
        const startSupport = clamp(
            Math.sqrt(chord * previousChord),
            chord,
            chord * supportLimit
        );
        const endSupport = clamp(
            Math.sqrt(chord * nextChord),
            chord,
            chord * supportLimit
        );
        const handleFactor = mix(profile.handleFactor, 0.42, amount);
        const handleCap = chord * mix(1.5, 0.48, amount);
        const startDesired = Math.min(
            mix(chord, startSupport, amount) * handleFactor,
            handleCap
        );
        const endDesired = Math.min(
            mix(chord, endSupport, amount) * handleFactor,
            handleCap
        );
        const reverseEndTangent = { x: -tangents[endIndex].x, y: -tangents[endIndex].y };
        const control1 = addScaled(start, tangents[index], startDesired);
        const control2 = addScaled(end, reverseEndTangent, endDesired);
        const startOnBoundary = distance(start, center) >= radius - 1e-6;
        const endOnBoundary = distance(end, center) >= radius - 1e-6;
        const containmentOptions = startOnBoundary !== endOnBoundary
            ? {
                scaleControl1: !startOnBoundary,
                scaleControl2: !endOnBoundary
            }
            : undefined;
        const rawSegment = {
            index,
            start: copyPoint(start),
            control1,
            control2,
            end: copyPoint(end),
            endIndex
        };
        let fitted = fitCubicSegmentToCircle(
            rawSegment,
            center,
            radius,
            containmentOptions
        );
        if (startOnBoundary
            && distance(fitted.control1, start) < BOUNDARY_HANDLE_MIN_LENGTH) {
            fitted = fitCubicSegmentToCircle({
                ...rawSegment,
                control1: addScaled(start, tangents[index], BOUNDARY_HANDLE_MIN_LENGTH)
            }, center, radius, {
                scaleControl1: false,
                scaleControl2: true
            });
        }
        if (endOnBoundary
            && distance(fitted.control2, end) < BOUNDARY_HANDLE_MIN_LENGTH) {
            fitted = fitCubicSegmentToCircle({
                ...rawSegment,
                control2: addScaled(end, reverseEndTangent, BOUNDARY_HANDLE_MIN_LENGTH)
            }, center, radius, {
                scaleControl1: true,
                scaleControl2: false
            });
        }
        return measureSegment(fitted);
    });
}

export function cubicBezierPoint(segment, amount) {
    const t = clamp(Number(amount) || 0, 0, 1);
    const inverse = 1 - t;
    const inverse2 = inverse * inverse;
    const t2 = t * t;
    return {
        x: inverse2 * inverse * segment.start.x
            + 3 * inverse2 * t * segment.control1.x
            + 3 * inverse * t2 * segment.control2.x
            + t2 * t * segment.end.x,
        y: inverse2 * inverse * segment.start.y
            + 3 * inverse2 * t * segment.control1.y
            + 3 * inverse * t2 * segment.control2.y
            + t2 * t * segment.end.y
    };
}

function segmentIsInsideCircle(segment, center, radius, tolerance = 1e-7) {
    for (let sample = 0; sample <= CONTAINMENT_SAMPLES; sample += 1) {
        const point = cubicBezierPoint(segment, sample / CONTAINMENT_SAMPLES);
        if (distance(point, center) > radius + tolerance) return false;
    }
    return true;
}

function scaleSegmentHandles(segment, amount, scaleControl1, scaleControl2) {
    return {
        ...segment,
        start: copyPoint(segment.start),
        control1: scaleControl1
            ? addScaled(segment.start, subtract(segment.control1, segment.start), amount)
            : copyPoint(segment.control1),
        control2: scaleControl2
            ? addScaled(segment.end, subtract(segment.control2, segment.end), amount)
            : copyPoint(segment.control2),
        end: copyPoint(segment.end)
    };
}

export function fitCubicSegmentToCircle(segment, center, radius, {
    scaleControl1 = true,
    scaleControl2 = true
} = {}) {
    const candidate = scaleSegmentHandles(segment, 1, false, false);
    if (segmentIsInsideCircle(candidate, center, radius)) return candidate;

    let collapsed = scaleSegmentHandles(candidate, 0, scaleControl1, scaleControl2);
    if (!segmentIsInsideCircle(collapsed, center, radius)) {
        if (!scaleControl1 || !scaleControl2) {
            return fitCubicSegmentToCircle(candidate, center, radius);
        }
        collapsed = {
            ...candidate,
            control1: copyPoint(candidate.start),
            control2: copyPoint(candidate.end)
        };
    }

    let lower = 0;
    let upper = 1;
    for (let iteration = 0; iteration < CONTAINMENT_ITERATIONS; iteration += 1) {
        const middle = (lower + upper) / 2;
        const scaled = scaleSegmentHandles(candidate, middle, scaleControl1, scaleControl2);
        if (segmentIsInsideCircle(scaled, center, radius)) lower = middle;
        else upper = middle;
    }
    return scaleSegmentHandles(candidate, lower * 0.9995, scaleControl1, scaleControl2);
}

function measureSegment(segment) {
    const lookup = [{ t: 0, length: 0 }];
    let previous = segment.start;
    let total = 0;
    for (let sample = 1; sample <= LENGTH_SAMPLES; sample += 1) {
        const t = sample / LENGTH_SAMPLES;
        const current = cubicBezierPoint(segment, t);
        total += distance(previous, current);
        lookup.push({ t, length: total });
        previous = current;
    }
    return { ...segment, length: total, lookup };
}

export function sampleFocusPathSegment(segment, distanceProgress) {
    const progress = clamp(Number(distanceProgress) || 0, 0, 1);
    if (progress <= 0 || segment.length <= 1e-9) return copyPoint(segment.start);
    if (progress >= 1) return copyPoint(segment.end);
    const target = segment.length * progress;
    let low = 1;
    let high = segment.lookup.length - 1;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (segment.lookup[middle].length < target) low = middle + 1;
        else high = middle;
    }
    const right = segment.lookup[low];
    const left = segment.lookup[low - 1];
    const span = Math.max(1e-9, right.length - left.length);
    const mix = (target - left.length) / span;
    return cubicBezierPoint(segment, left.t + (right.t - left.t) * mix);
}

export function sampleFocusPath(path, distanceProgress) {
    const progress = clamp(Number(distanceProgress) || 0, 0, 1);
    if (progress <= 0 || path.totalLength <= 1e-9) {
        return { point: copyPoint(path.anchors[0]), segmentIndex: 0, segmentProgress: 0 };
    }
    if (progress >= 1) {
        const finalIndex = path.segments.length - 1;
        return {
            point: copyPoint(path.anchors[0]),
            segmentIndex: finalIndex,
            segmentProgress: 1
        };
    }
    const target = path.totalLength * progress;
    let traversed = 0;
    for (let index = 0; index < path.segments.length; index += 1) {
        const segment = path.segments[index];
        const end = traversed + segment.length;
        if (target <= end || index === path.segments.length - 1) {
            const localProgress = segment.length <= 1e-9
                ? 0
                : (target - traversed) / segment.length;
            return {
                point: sampleFocusPathSegment(segment, localProgress),
                segmentIndex: index,
                segmentProgress: clamp(localProgress, 0, 1)
            };
        }
        traversed = end;
    }
    return { point: copyPoint(path.anchors[0]), segmentIndex: 0, segmentProgress: 0 };
}

const GENERATED_PATH_QUALITY_SAMPLES = 256;
const GENERATED_PATH_ATTEMPTS = 16;

function strictSegmentIntersection(firstStart, firstEnd, secondStart, secondEnd) {
    const first = subtract(firstEnd, firstStart);
    const second = subtract(secondEnd, secondStart);
    const denominator = cross(first, second);
    if (Math.abs(denominator) <= 1e-9) return null;
    const offset = subtract(secondStart, firstStart);
    const firstAmount = cross(offset, second) / denominator;
    const secondAmount = cross(offset, first) / denominator;
    const epsilon = 1e-5;
    if (firstAmount <= epsilon || firstAmount >= 1 - epsilon
        || secondAmount <= epsilon || secondAmount >= 1 - epsilon) return null;
    return {
        x: firstStart.x + first.x * firstAmount,
        y: firstStart.y + first.y * firstAmount
    };
}

function shorterLoopDiameter(samples, firstIndex, secondIndex) {
    const count = samples.length;
    const directLength = secondIndex - firstIndex;
    const useDirect = directLength <= count - directLength;
    const points = [];
    if (useDirect) {
        for (let index = firstIndex + 1; index <= secondIndex; index += 1) {
            points.push(samples[index % count]);
        }
    } else {
        for (let index = secondIndex + 1; index <= firstIndex + count; index += 1) {
            points.push(samples[index % count]);
        }
    }
    if (!points.length) return 0;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return Math.hypot(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys)
    );
}

/** Metrics used only to reject unattractive automatically generated paths. */
export function analyzeGeneratedFocusPath(path, {
    sampleCount = GENERATED_PATH_QUALITY_SAMPLES,
    outerBandStart = 0.92
} = {}) {
    const count = Math.max(64, Math.round(sampleCount));
    const samples = Array.from({ length: count }, (_, index) => (
        sampleFocusPath(path, index / count).point
    ));
    const radii = samples.map((sample) => distance(sample, path.center) / path.radius);
    const intersections = [];
    let tinyLoopCount = 0;
    for (let first = 0; first < count; first += 1) {
        const firstEnd = (first + 1) % count;
        for (let second = first + 2; second < count; second += 1) {
            const secondEnd = (second + 1) % count;
            if (first === 0 && secondEnd === 0) continue;
            const intersection = strictSegmentIntersection(
                samples[first],
                samples[firstEnd],
                samples[second],
                samples[secondEnd]
            );
            if (!intersection) continue;
            const directSpan = second - first;
            const loopFraction = Math.min(directSpan, count - directSpan) / count;
            const diameterRatio = shorterLoopDiameter(samples, first, second) / path.radius;
            const tiny = loopFraction < 0.16 || diameterRatio < 0.34;
            intersections.push({ loopFraction, diameterRatio, tiny });
            if (tiny) tinyLoopCount += 1;
        }
    }
    return {
        outerBandRatio: radii.filter((radius) => radius >= outerBandStart).length / count,
        maximumRadiusRatio: Math.max(...radii),
        intersectionCount: intersections.length,
        tinyLoopCount
    };
}

function retryMotionSeed(seed, attempt) {
    if (attempt <= 0) return normalizeMotionSeed(seed);
    let value = (normalizeMotionSeed(seed) + Math.imul(attempt, 0x9e3779b9)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x21f0aaad) >>> 0;
    value ^= value >>> 15;
    return value >>> 0;
}

function generatedPathQuality(path, complexity) {
    const metrics = analyzeGeneratedFocusPath(path);
    const complexityAmount = normalizeMotionComplexity(complexity) / 100;
    const startRadius = distance(path.anchors[0], path.center) / path.radius;
    const outerLimit = path.anchors.length <= 2
        ? 1
        : mix(0.22, 0.34, complexityAmount) + (startRadius >= 0.92 ? 0.08 : 0);
    const radiusDeficit = Math.max(0, 0.88 - metrics.maximumRadiusRatio);
    const outerExcess = Math.max(0, metrics.outerBandRatio - outerLimit);
    return {
        accepted: metrics.tinyLoopCount === 0
            && outerExcess <= 1e-9
            && radiusDeficit <= 1e-9,
        score: metrics.tinyLoopCount * 100
            + outerExcess * 20
            + radiusDeficit * 10,
        metrics
    };
}

function formatPath(segments) {
    if (!segments.length) return '';
    const commands = [`M ${clean(segments[0].start.x)} ${clean(segments[0].start.y)}`];
    segments.forEach((segment) => {
        commands.push(
            `C ${clean(segment.control1.x)} ${clean(segment.control1.y)}`
            + ` ${clean(segment.control2.x)} ${clean(segment.control2.y)}`
            + ` ${clean(segment.end.x)} ${clean(segment.end.y)}`
        );
    });
    commands.push('Z');
    return commands.join(' ');
}

function finitePoint(value, label) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`Invalid ${label} point.`);
    }
    return { x, y };
}

export function rebuildFocusPath(source, rawSegments = source?.segments) {
    if (!Array.isArray(rawSegments) || rawSegments.length < 2 || rawSegments.length > 96) {
        throw new Error('A focus path requires between 2 and 96 segments.');
    }
    const center = finitePoint(source?.center, 'focus path center');
    const radius = Number(source?.radius);
    if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error('Invalid focus path radius.');
    }
    const segments = rawSegments.map((segment, index) => measureSegment({
        index,
        start: finitePoint(segment?.start, `segment ${index} start`),
        control1: finitePoint(segment?.control1, `segment ${index} control1`),
        control2: finitePoint(segment?.control2, `segment ${index} control2`),
        end: finitePoint(segment?.end, `segment ${index} end`),
        endIndex: (index + 1) % rawSegments.length,
        kind: segment?.kind === 'line' ? 'line' : 'curve',
        role: segment?.role === 'closure' ? 'closure' : 'source'
    }));
    const anchors = segments.map((segment) => copyPoint(segment.start));
    const tangents = segments.map((segment, index) => unit(
        subtract(segment.control1, segment.start),
        subtract(segments[(index - 1 + segments.length) % segments.length].end,
            segments[(index - 1 + segments.length) % segments.length].control2)
    ));
    const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
    return {
        seed: normalizeMotionSeed(source?.seed),
        complexity: normalizeMotionComplexity(source?.complexity),
        smoothness: normalizeMotionSmoothness(source?.smoothness),
        center,
        radius,
        anchors,
        tangents,
        segments,
        totalLength,
        path: formatPath(segments),
        importMeta: source?.importMeta?.imported
            ? {
                imported: true,
                fileName: String(source.importMeta.fileName || 'Imported SVG'),
                wasOpen: Boolean(source.importMeta.wasOpen),
                closureKind: source.importMeta.closureKind === 'line'
                    ? 'line'
                    : source.importMeta.wasOpen ? 'smooth' : 'none',
                originalPointCount: Math.max(0, Math.round(Number(source.importMeta.originalPointCount) || 0)),
                simplifiedPointCount: Math.max(0, Math.round(Number(source.importMeta.simplifiedPointCount) || 0)),
                pointCount: segments.length,
                tolerancePx: Math.max(0, Number(source.importMeta.tolerancePx) || 0)
            }
            : null
    };
}

export function serializeFocusPath(path) {
    return {
        version: 1,
        seed: normalizeMotionSeed(path?.seed),
        complexity: normalizeMotionComplexity(path?.complexity),
        smoothness: normalizeMotionSmoothness(path?.smoothness),
        center: finitePoint(path?.center, 'focus path center'),
        radius: Number(path?.radius),
        importMeta: path?.importMeta?.imported ? { ...path.importMeta } : null,
        segments: path?.segments?.map((segment) => ({
            start: finitePoint(segment.start, 'segment start'),
            control1: finitePoint(segment.control1, 'segment control1'),
            control2: finitePoint(segment.control2, 'segment control2'),
            end: finitePoint(segment.end, 'segment end'),
            kind: segment.kind === 'line' ? 'line' : 'curve',
            role: segment.role === 'closure' ? 'closure' : 'source'
        })) || []
    };
}

function generateFocusPathCandidate({
    start,
    center,
    radius,
    pointCount,
    normalizedComplexity,
    normalizedSmoothness,
    baseSeed,
    candidateSeed
}) {
    const profile = complexityProfile(normalizedComplexity);
    const random = createMotionRandom(candidateSeed);
    const anchors = createAnchors({
        start: start || center,
        center,
        radius,
        pointCount,
        profile,
        random
    });
    const regularizedAnchors = regularizeAnchors(
        anchors,
        center,
        radius,
        normalizedSmoothness
    );
    const tangents = createTangents(
        regularizedAnchors,
        center,
        radius,
        normalizedSmoothness
    );
    const segments = createSegments(
        regularizedAnchors,
        tangents,
        center,
        radius,
        profile,
        normalizedSmoothness
    );
    return rebuildFocusPath({
        seed: baseSeed,
        complexity: normalizedComplexity,
        smoothness: normalizedSmoothness,
        center,
        radius,
        segments
    });
}

export function generateFocusPath({
    start,
    center,
    radius,
    pointCount = 6,
    complexity = 0,
    smoothness = 0,
    seed = 1
} = {}) {
    const safeCenter = {
        x: finiteOr(center?.x, 240),
        y: finiteOr(center?.y, 240)
    };
    const safeRadius = Math.max(1, finiteOr(radius, 195));
    const normalizedComplexity = normalizeMotionComplexity(complexity);
    const normalizedSmoothness = normalizeMotionSmoothness(smoothness);
    const baseSeed = normalizeMotionSeed(seed);
    const candidateOptions = {
        start,
        center: safeCenter,
        radius: safeRadius,
        pointCount,
        normalizedComplexity,
        normalizedSmoothness,
        baseSeed
    };
    let best = null;
    for (let attempt = 0; attempt < GENERATED_PATH_ATTEMPTS; attempt += 1) {
        const candidate = generateFocusPathCandidate({
            ...candidateOptions,
            candidateSeed: retryMotionSeed(baseSeed, attempt)
        });
        const quality = generatedPathQuality(candidate, normalizedComplexity);
        if (!best || quality.score < best.quality.score) best = { candidate, quality };
        if (quality.accepted) return candidate;
    }
    return best.candidate;
}

export function generateFocusPathForSettings(settings, start) {
    const region = createMotionPathRegion(settings);
    return generateFocusPath({
        start,
        center: region.center,
        radius: region.radius,
        pointCount: settings.motionPointCount,
        complexity: settings.motionComplexity,
        smoothness: settings.motionSmoothness,
        seed: settings.motionSeed
    });
}

export function pathIsInsideRegion(path, tolerance = 1e-6) {
    return path.segments.every((segment) => {
        return segmentIsInsideCircle(segment, path.center, path.radius, tolerance);
    });
}

export function tangentContinuityAtAnchor(path, anchorIndex) {
    const count = path.segments.length;
    const incoming = path.segments[(anchorIndex - 1 + count) % count];
    const outgoing = path.segments[anchorIndex % count];
    const incomingTangent = unit(subtract(incoming.end, incoming.control2));
    const outgoingTangent = unit(subtract(outgoing.control1, outgoing.start));
    return {
        cross: cross(incomingTangent, outgoingTangent),
        dot: dot(incomingTangent, outgoingTangent)
    };
}
