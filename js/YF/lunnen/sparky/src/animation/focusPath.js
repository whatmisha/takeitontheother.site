import { clamp, distance } from '../geometry/vector.js';
import { createExtendedFocusRegion } from '../geometry/focusBounds.js';

const TAU = Math.PI * 2;
const LENGTH_SAMPLES = 64;

export const FOCUS_PATH_COMPLEXITY = Object.freeze({
    soft: Object.freeze({
        angularJitter: 0.16,
        radiusMin: 0.42,
        radiusMax: 0.84,
        strideRatio: 0,
        handleFactor: 0.34
    }),
    medium: Object.freeze({
        angularJitter: 0.38,
        radiusMin: 0.28,
        radiusMax: 0.91,
        strideRatio: 0.32,
        handleFactor: 0.29
    }),
    hard: Object.freeze({
        angularJitter: 0.68,
        radiusMin: 0.18,
        radiusMax: 0.96,
        strideRatio: 0.48,
        handleFactor: 0.23
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

function maximumHandleLength(anchor, direction, center, radius) {
    const offset = subtract(anchor, center);
    const b = 2 * dot(offset, direction);
    const c = dot(offset, offset) - radius * radius;
    const discriminant = Math.max(0, b * b - 4 * c);
    return Math.max(0, (-b + Math.sqrt(discriminant)) / 2);
}

function boundaryAwareTangent(anchor, tangent, center, radius) {
    const radialVector = subtract(anchor, center);
    const radialDistance = vectorLength(radialVector);
    if (radialDistance <= radius * 0.78 || radialDistance <= 1e-9) return tangent;

    const radial = unit(radialVector);
    let boundaryTangent = { x: -radial.y, y: radial.x };
    if (dot(boundaryTangent, tangent) < 0) {
        boundaryTangent = { x: -boundaryTangent.x, y: -boundaryTangent.y };
    }
    const blend = clamp((radialDistance / radius - 0.78) / 0.22, 0, 1);
    return unit({
        x: tangent.x * (1 - blend) + boundaryTangent.x * blend,
        y: tangent.y * (1 - blend) + boundaryTangent.y * blend
    }, boundaryTangent);
}

function createAnchors({ start, center, radius, pointCount, profile, random }) {
    const count = clamp(Math.round(finiteOr(pointCount, 6)), 3, 16);
    const first = constrainToCircle(start, center, radius * 0.995);
    const generatedCount = count - 1;
    const baseAngle = random() * TAU;
    const angularStep = TAU / generatedCount;
    const pool = [];

    for (let index = 0; index < generatedCount; index += 1) {
        const jitter = (random() - 0.5) * angularStep * profile.angularJitter;
        const angle = baseAngle + index * angularStep + jitter;
        const radialMix = Math.pow(random(), profile === FOCUS_PATH_COMPLEXITY.soft ? 0.82 : 1);
        const radialRatio = profile.radiusMin
            + (profile.radiusMax - profile.radiusMin) * radialMix;
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

function createTangents(anchors, center, radius) {
    return anchors.map((anchor, index) => {
        const previous = anchors[(index - 1 + anchors.length) % anchors.length];
        const next = anchors[(index + 1) % anchors.length];
        const fallback = unit(subtract(next, anchor));
        const tangent = unit(subtract(next, previous), fallback);
        return boundaryAwareTangent(anchor, tangent, center, radius);
    });
}

function createSegments(anchors, tangents, center, radius, profile) {
    return anchors.map((start, index) => {
        const endIndex = (index + 1) % anchors.length;
        const end = anchors[endIndex];
        const chord = distance(start, end);
        const startDesired = chord * profile.handleFactor;
        const endDesired = chord * profile.handleFactor;
        const startMaximum = maximumHandleLength(start, tangents[index], center, radius);
        const reverseEndTangent = { x: -tangents[endIndex].x, y: -tangents[endIndex].y };
        const endMaximum = maximumHandleLength(end, reverseEndTangent, center, radius);
        const control1 = addScaled(start, tangents[index], Math.min(startDesired, startMaximum * 0.985));
        const control2 = addScaled(end, reverseEndTangent, Math.min(endDesired, endMaximum * 0.985));
        return measureSegment({
            index,
            start: copyPoint(start),
            control1,
            control2,
            end: copyPoint(end),
            endIndex
        });
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

export function generateFocusPath({
    start,
    center,
    radius,
    pointCount = 6,
    complexity = 'soft',
    seed = 1
} = {}) {
    const safeCenter = {
        x: finiteOr(center?.x, 240),
        y: finiteOr(center?.y, 240)
    };
    const safeRadius = Math.max(1, finiteOr(radius, 195));
    const profile = FOCUS_PATH_COMPLEXITY[complexity] || FOCUS_PATH_COMPLEXITY.soft;
    const random = createMotionRandom(seed);
    const anchors = createAnchors({
        start: start || safeCenter,
        center: safeCenter,
        radius: safeRadius,
        pointCount,
        profile,
        random
    });
    const tangents = createTangents(anchors, safeCenter, safeRadius);
    const segments = createSegments(anchors, tangents, safeCenter, safeRadius, profile);
    const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
    return {
        seed: normalizeMotionSeed(seed),
        complexity: FOCUS_PATH_COMPLEXITY[complexity] ? complexity : 'soft',
        center: safeCenter,
        radius: safeRadius,
        anchors,
        tangents,
        segments,
        totalLength,
        path: formatPath(segments)
    };
}

export function generateFocusPathForSettings(settings, start) {
    const region = createExtendedFocusRegion(settings);
    return generateFocusPath({
        start,
        center: region.center,
        radius: region.radius,
        pointCount: settings.motionPointCount,
        complexity: settings.motionComplexity,
        seed: settings.motionSeed
    });
}

export function pathIsInsideRegion(path, tolerance = 1e-6) {
    return path.segments.every((segment) => {
        const controls = [segment.start, segment.control1, segment.control2, segment.end];
        if (controls.some((value) => distance(value, path.center) > path.radius + tolerance)) return false;
        return segment.lookup.every((sample) => (
            distance(cubicBezierPoint(segment, sample.t), path.center) <= path.radius + tolerance
        ));
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
