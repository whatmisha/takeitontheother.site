import {
    fitCubicSegmentToCircle,
    rebuildFocusPath
} from './focusPath.js?v=20260825-8';

export const FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH = 14;
export const FOCUS_PATH_EDITOR_ANCHOR_INSET = 0;
const EPSILON = 1e-9;

const copyPoint = (point) => ({ x: point.x, y: point.y });
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const length = (vector) => Math.hypot(vector.x, vector.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const reverse = (vector) => ({ x: -vector.x, y: -vector.y });

function unit(vector, fallback = { x: 1, y: 0 }) {
    const magnitude = length(vector);
    if (magnitude <= EPSILON) return copyPoint(fallback);
    return { x: vector.x / magnitude, y: vector.y / magnitude };
}

function copySegments(path) {
    return path.segments.map((segment) => ({
        start: copyPoint(segment.start),
        control1: copyPoint(segment.control1),
        control2: copyPoint(segment.control2),
        end: copyPoint(segment.end)
    }));
}

function constrainPoint(point, center, radius) {
    const offset = subtract(point, center);
    const magnitude = length(offset);
    if (magnitude <= radius || magnitude <= EPSILON) return copyPoint(point);
    return {
        x: center.x + offset.x * radius / magnitude,
        y: center.y + offset.y * radius / magnitude
    };
}

function pairedDirection(outgoing, incoming, previous, next) {
    const candidates = [
        outgoing,
        reverse(incoming),
        subtract(next, previous)
    ];
    for (const candidate of candidates) {
        if (length(candidate) > EPSILON) return unit(candidate);
    }
    return { x: 1, y: 0 };
}

function boundarySafeDirection(anchor, direction, center, radius) {
    const radialVector = subtract(anchor, center);
    const radialDistance = length(radialVector);
    if (radialDistance <= radius * 0.9 || radialDistance <= EPSILON) return unit(direction);
    const radial = unit(radialVector);
    let tangent = { x: -radial.y, y: radial.x };
    if (dot(tangent, direction) < 0) tangent = reverse(tangent);
    const blend = Math.min(1, Math.max(0, (radialDistance / radius - 0.9) / 0.1));
    return unit({
        x: direction.x * (1 - blend) + tangent.x * blend,
        y: direction.y * (1 - blend) + tangent.y * blend
    }, tangent);
}

function visibleHandlePoint(anchor, direction, preferredLength) {
    const normalizedDirection = unit(direction);
    const length = Math.max(
        FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH,
        preferredLength
    );
    return {
        x: anchor.x + normalizedDirection.x * length,
        y: anchor.y + normalizedDirection.y * length
    };
}

function anchorHandles(segments, anchorIndex) {
    const count = segments.length;
    return {
        incomingSegment: segments[(anchorIndex - 1 + count) % count],
        outgoingSegment: segments[anchorIndex]
    };
}

function restoreAnchorHandles(segments, anchors, index, previousAnchor, center, radius) {
    const count = anchors.length;
    const anchor = anchors[index];
    const previous = anchors[(index - 1 + count) % count];
    const next = anchors[(index + 1) % count];
    const { incomingSegment, outgoingSegment } = anchorHandles(segments, index);
    const incomingVector = subtract(incomingSegment.control2, previousAnchor);
    const outgoingVector = subtract(outgoingSegment.control1, previousAnchor);
    const direction = boundarySafeDirection(
        anchor,
        pairedDirection(outgoingVector, incomingVector, previous, next),
        center,
        radius
    );

    incomingSegment.end = copyPoint(anchor);
    outgoingSegment.start = copyPoint(anchor);
    incomingSegment.control2 = visibleHandlePoint(
        anchor,
        reverse(direction),
        length(incomingVector)
    );
    outgoingSegment.control1 = visibleHandlePoint(
        anchor,
        direction,
        length(outgoingVector)
    );
}

function editableAnchors(path) {
    return path.anchors.map(copyPoint);
}

function handleLengths(segments, anchors, index) {
    const count = anchors.length;
    const anchor = anchors[index];
    return {
        incoming: length(subtract(
            segments[(index - 1 + count) % count].control2,
            anchor
        )),
        outgoing: length(subtract(segments[index].control1, anchor))
    };
}

function fitSegment(segments, index, center, radius, options) {
    const normalizedIndex = ((index % segments.length) + segments.length) % segments.length;
    segments[normalizedIndex] = fitCubicSegmentToCircle(
        segments[normalizedIndex],
        center,
        radius,
        options
    );
}

export function focusPathEditorHandlePoints(path, anchorIndex) {
    const count = path.anchors.length;
    const index = ((Math.round(anchorIndex) % count) + count) % count;
    const anchor = path.anchors[index];
    const previous = path.anchors[(index - 1 + count) % count];
    const next = path.anchors[(index + 1) % count];
    const incomingVector = subtract(
        path.segments[(index - 1 + count) % count].control2,
        anchor
    );
    const outgoingVector = subtract(path.segments[index].control1, anchor);
    const direction = boundarySafeDirection(
        anchor,
        pairedDirection(outgoingVector, incomingVector, previous, next),
        path.center,
        path.radius
    );
    return {
        incoming: visibleHandlePoint(anchor, reverse(direction), length(incomingVector)),
        outgoing: visibleHandlePoint(anchor, direction, length(outgoingVector))
    };
}

export function ensureFocusPathHandles(path) {
    const segments = copySegments(path);
    const anchors = editableAnchors(path);
    let changed = false;
    anchors.forEach((_, index) => {
        const lengths = handleLengths(segments, anchors, index);
        if (lengths.incoming >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6
            && lengths.outgoing >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6) return;
        restoreAnchorHandles(
            segments,
            anchors,
            index,
            path.anchors[index],
            path.center,
            path.radius
        );
        fitSegment(segments, index - 1, path.center, path.radius, {
            scaleControl1: false,
            scaleControl2: true
        });
        fitSegment(segments, index, path.center, path.radius, {
            scaleControl1: true,
            scaleControl2: false
        });
        changed = true;
    });
    return changed ? rebuildFocusPath(path, segments) : path;
}

export function moveFocusPathAnchor(path, anchorIndex, rawPoint) {
    const prepared = path;
    const count = prepared.segments.length;
    const index = ((Math.round(anchorIndex) % count) + count) % count;
    const segments = copySegments(prepared);
    const anchors = editableAnchors(prepared);
    const previousAnchor = prepared.anchors[index];
    anchors[index] = constrainPoint(
        rawPoint,
        prepared.center,
        prepared.radius
    );
    restoreAnchorHandles(
        segments,
        anchors,
        index,
        previousAnchor,
        prepared.center,
        prepared.radius
    );
    fitSegment(segments, index - 1, prepared.center, prepared.radius, {
        scaleControl1: false,
        scaleControl2: true
    });
    fitSegment(segments, index, prepared.center, prepared.radius, {
        scaleControl1: true,
        scaleControl2: false
    });
    return rebuildFocusPath(prepared, segments);
}

export function moveFocusPathHandle(path, anchorIndex, side, rawPoint) {
    const prepared = path;
    const count = prepared.segments.length;
    const index = ((Math.round(anchorIndex) % count) + count) % count;
    const segments = copySegments(prepared);
    const anchor = prepared.anchors[index];
    const { incomingSegment, outgoingSegment } = anchorHandles(segments, index);
    const editingOutgoing = side !== 'incoming';
    const currentPoint = editingOutgoing
        ? outgoingSegment.control1
        : incomingSegment.control2;
    const editedVector = length(subtract(rawPoint, anchor)) > EPSILON
        ? subtract(rawPoint, anchor)
        : subtract(currentPoint, anchor);
    const selectedDirection = unit(editedVector);
    const rawOutgoingDirection = editingOutgoing
        ? selectedDirection
        : reverse(selectedDirection);
    const outgoingDirection = boundarySafeDirection(
        anchor,
        rawOutgoingDirection,
        prepared.center,
        prepared.radius
    );
    const incomingDirection = reverse(outgoingDirection);
    const outgoingLength = editingOutgoing
        ? length(editedVector)
        : length(subtract(outgoingSegment.control1, anchor));
    const incomingLength = editingOutgoing
        ? length(subtract(incomingSegment.control2, anchor))
        : length(editedVector);

    outgoingSegment.control1 = visibleHandlePoint(
        anchor,
        outgoingDirection,
        outgoingLength
    );
    incomingSegment.control2 = visibleHandlePoint(
        anchor,
        incomingDirection,
        incomingLength
    );
    fitSegment(segments, index, prepared.center, prepared.radius, {
        scaleControl1: true,
        scaleControl2: false
    });
    fitSegment(segments, index - 1, prepared.center, prepared.radius, {
        scaleControl1: false,
        scaleControl2: true
    });
    return rebuildFocusPath(prepared, segments);
}
