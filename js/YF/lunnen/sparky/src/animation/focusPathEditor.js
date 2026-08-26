import {
    fitCubicSegmentToCircle,
    rebuildFocusPath
} from './focusPath.js?v=20260826-1';

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
        end: copyPoint(segment.end),
        kind: segment.kind,
        role: segment.role
    }));
}

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });

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

export function importedClosureEditorControls(path) {
    if (!path?.importMeta?.wasOpen) return { anchors: [], handles: [] };
    const count = path.segments.length;
    const anchors = [];
    const handles = [];
    path.segments.forEach((segment, segmentIndex) => {
        if (segment.role !== 'closure') return;
        const endAnchorIndex = (segmentIndex + 1) % count;
        handles.push({
            segmentIndex,
            control: 'control1',
            anchorIndex: segmentIndex,
            anchor: copyPoint(segment.start),
            point: visibleHandlePoint(
                segment.start,
                subtract(segment.control1, segment.start),
                length(subtract(segment.control1, segment.start))
            )
        });
        handles.push({
            segmentIndex,
            control: 'control2',
            anchorIndex: endAnchorIndex,
            anchor: copyPoint(segment.end),
            point: visibleHandlePoint(
                segment.end,
                subtract(segment.control2, segment.end),
                length(subtract(segment.control2, segment.end))
            )
        });
        if (path.segments[(segmentIndex - 1 + count) % count].role === 'closure') {
            anchors.push({ anchorIndex: segmentIndex, point: copyPoint(segment.start) });
        }
    });
    return { anchors, handles };
}

export function moveImportedClosureAnchor(path, anchorIndex, rawPoint) {
    if (!path?.importMeta?.wasOpen) return path;
    const count = path.segments.length;
    const index = ((Math.round(anchorIndex) % count) + count) % count;
    const previousIndex = (index - 1 + count) % count;
    if (path.segments[previousIndex].role !== 'closure'
        || path.segments[index].role !== 'closure') return path;
    const segments = copySegments(path);
    const current = path.anchors[index];
    const next = constrainPoint(rawPoint, path.center, path.radius);
    const delta = subtract(next, current);
    segments[previousIndex].end = copyPoint(next);
    segments[previousIndex].control2 = add(segments[previousIndex].control2, delta);
    segments[index].start = copyPoint(next);
    segments[index].control1 = add(segments[index].control1, delta);
    fitSegment(segments, previousIndex, path.center, path.radius, {
        scaleControl1: true,
        scaleControl2: true
    });
    fitSegment(segments, index, path.center, path.radius, {
        scaleControl1: true,
        scaleControl2: true
    });
    return rebuildFocusPath(path, segments);
}

export function moveImportedClosureHandle(path, segmentIndex, control, rawPoint) {
    if (!path?.importMeta?.wasOpen) return path;
    const count = path.segments.length;
    const index = ((Math.round(segmentIndex) % count) + count) % count;
    if (path.segments[index].role !== 'closure') return path;
    const segments = copySegments(path);
    const editingStart = control !== 'control2';
    const anchorIndex = editingStart ? index : (index + 1) % count;
    const anchor = path.anchors[anchorIndex];
    const adjacentIndex = editingStart
        ? (index - 1 + count) % count
        : (index + 1) % count;
    const adjacent = segments[adjacentIndex];
    const selected = segments[index];
    const selectedProperty = editingStart ? 'control1' : 'control2';
    const adjacentProperty = editingStart ? 'control2' : 'control1';
    const rawVector = subtract(rawPoint, anchor);
    let selectedDirection = unit(
        rawVector,
        subtract(selected[selectedProperty], anchor)
    );

    if (adjacent.role !== 'closure') {
        selectedDirection = editingStart
            ? unit(subtract(anchor, adjacent.control2), selectedDirection)
            : unit(subtract(anchor, adjacent.control1), selectedDirection);
    }
    const selectedLength = Math.max(
        FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH,
        adjacent.role === 'closure'
            ? length(rawVector)
            : Math.max(0, dot(rawVector, selectedDirection))
    );
    selected[selectedProperty] = visibleHandlePoint(
        anchor,
        selectedDirection,
        selectedLength
    );

    if (adjacent.role === 'closure') {
        const adjacentLength = length(subtract(adjacent[adjacentProperty], anchor));
        adjacent[adjacentProperty] = visibleHandlePoint(
            anchor,
            reverse(selectedDirection),
            adjacentLength
        );
        fitSegment(segments, adjacentIndex, path.center, path.radius, {
            scaleControl1: true,
            scaleControl2: true
        });
    }
    fitSegment(segments, index, path.center, path.radius, {
        scaleControl1: true,
        scaleControl2: true
    });
    return rebuildFocusPath(path, segments);
}
