import { rebuildFocusPath } from './focusPath.js?v=20260825-6';

export const FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH = 14;
export const FOCUS_PATH_EDITOR_ANCHOR_INSET = 14.5;
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

function maximumLengthAlong(anchor, direction, center, radius) {
    const offset = subtract(anchor, center);
    const b = 2 * dot(offset, direction);
    const c = dot(offset, offset) - radius * radius;
    const discriminant = Math.max(0, b * b - 4 * c);
    return Math.max(0, (-b + Math.sqrt(discriminant)) / 2);
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

function visibleHandlePoint(anchor, direction, preferredLength, center, radius) {
    const normalizedDirection = unit(direction);
    const requestedLength = Math.max(
        FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH,
        preferredLength
    );
    const permittedLength = Math.min(
        requestedLength,
        maximumLengthAlong(anchor, normalizedDirection, center, radius) * 0.9995
    );
    return {
        x: anchor.x + normalizedDirection.x * permittedLength,
        y: anchor.y + normalizedDirection.y * permittedLength
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
    const direction = pairedDirection(outgoingVector, incomingVector, previous, next);

    incomingSegment.end = copyPoint(anchor);
    outgoingSegment.start = copyPoint(anchor);
    incomingSegment.control2 = visibleHandlePoint(
        anchor,
        reverse(direction),
        length(incomingVector),
        center,
        radius
    );
    outgoingSegment.control1 = visibleHandlePoint(
        anchor,
        direction,
        length(outgoingVector),
        center,
        radius
    );
}

function editableAnchors(path) {
    const anchors = path.anchors.map((anchor) => (
        constrainPoint(
            anchor,
            path.center,
            Math.max(0, path.radius - FOCUS_PATH_EDITOR_ANCHOR_INSET)
        )
    ));
    return anchors;
}

export function ensureFocusPathHandles(path) {
    const segments = copySegments(path);
    const anchors = editableAnchors(path);
    anchors.forEach((_, index) => {
        restoreAnchorHandles(
            segments,
            anchors,
            index,
            path.anchors[index],
            path.center,
            path.radius
        );
    });
    return rebuildFocusPath(path, segments);
}

export function moveFocusPathAnchor(path, anchorIndex, rawPoint) {
    const prepared = ensureFocusPathHandles(path);
    const count = prepared.segments.length;
    const index = ((Math.round(anchorIndex) % count) + count) % count;
    const segments = copySegments(prepared);
    const anchors = editableAnchors(prepared);
    const previousAnchor = prepared.anchors[index];
    anchors[index] = constrainPoint(
        rawPoint,
        prepared.center,
        Math.max(0, prepared.radius - FOCUS_PATH_EDITOR_ANCHOR_INSET)
    );
    restoreAnchorHandles(
        segments,
        anchors,
        index,
        previousAnchor,
        prepared.center,
        prepared.radius
    );
    return rebuildFocusPath(prepared, segments);
}

export function moveFocusPathHandle(path, anchorIndex, side, rawPoint) {
    const prepared = ensureFocusPathHandles(path);
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
    const outgoingDirection = editingOutgoing
        ? selectedDirection
        : reverse(selectedDirection);
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
        outgoingLength,
        prepared.center,
        prepared.radius
    );
    incomingSegment.control2 = visibleHandlePoint(
        anchor,
        incomingDirection,
        incomingLength,
        prepared.center,
        prepared.radius
    );
    return rebuildFocusPath(prepared, segments);
}
