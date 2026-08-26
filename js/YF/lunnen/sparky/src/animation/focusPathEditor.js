import {
    fitCubicSegmentToCircle,
    rebuildFocusPath
} from './focusPath.js?v=20260827-2';

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

function hasSegmentHandle(segment, side) {
    if (!segment || segment.kind === 'line') return false;
    const anchor = side === 'incoming' ? segment.end : segment.start;
    const control = side === 'incoming' ? segment.control2 : segment.control1;
    return length(subtract(control, anchor)) > EPSILON;
}

function anchorHandleState(segments, anchorIndex) {
    const { incomingSegment, outgoingSegment } = anchorHandles(segments, anchorIndex);
    return {
        incoming: hasSegmentHandle(incomingSegment, 'incoming'),
        outgoing: hasSegmentHandle(outgoingSegment, 'outgoing')
    };
}

function refreshLineControls(segment) {
    if (segment.kind !== 'line') return;
    const delta = subtract(segment.end, segment.start);
    segment.control1 = {
        x: segment.start.x + delta.x / 3,
        y: segment.start.y + delta.y / 3
    };
    segment.control2 = {
        x: segment.start.x + delta.x * 2 / 3,
        y: segment.start.y + delta.y * 2 / 3
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
    const { incomingSegment, outgoingSegment } = anchorHandles(path.segments, index);
    const state = anchorHandleState(path.segments, index);
    const incomingVector = subtract(incomingSegment.control2, anchor);
    const outgoingVector = subtract(outgoingSegment.control1, anchor);
    return {
        incoming: state.incoming
            ? visibleHandlePoint(anchor, incomingVector, length(incomingVector))
            : null,
        outgoing: state.outgoing
            ? visibleHandlePoint(anchor, outgoingVector, length(outgoingVector))
            : null
    };
}

export function moveFocusPathAnchor(path, anchorIndex, rawPoint) {
    const prepared = path;
    const count = prepared.segments.length;
    const index = ((Math.round(anchorIndex) % count) + count) % count;
    const segments = copySegments(prepared);
    const previousIndex = (index - 1 + count) % count;
    const previousAnchor = prepared.anchors[index];
    const nextAnchor = constrainPoint(
        rawPoint,
        prepared.center,
        prepared.radius
    );
    const delta = subtract(nextAnchor, previousAnchor);
    const state = anchorHandleState(segments, index);
    const incoming = segments[previousIndex];
    const outgoing = segments[index];

    incoming.end = copyPoint(nextAnchor);
    outgoing.start = copyPoint(nextAnchor);
    incoming.control2 = state.incoming
        ? add(incoming.control2, delta)
        : copyPoint(nextAnchor);
    outgoing.control1 = state.outgoing
        ? add(outgoing.control1, delta)
        : copyPoint(nextAnchor);
    refreshLineControls(incoming);
    refreshLineControls(outgoing);
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
    const state = anchorHandleState(segments, index);
    if ((editingOutgoing && !state.outgoing) || (!editingOutgoing && !state.incoming)) {
        return path;
    }
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

    if (state.outgoing) {
        outgoingSegment.control1 = visibleHandlePoint(
            anchor,
            outgoingDirection,
            outgoingLength
        );
        outgoingSegment.kind = 'curve';
    }
    if (state.incoming) {
        incomingSegment.control2 = visibleHandlePoint(
            anchor,
            incomingDirection,
            incomingLength
        );
        incomingSegment.kind = 'curve';
    }
    return rebuildFocusPath(prepared, segments);
}

export function toggleFocusPathAnchorHandles(path, anchorIndex) {
    const count = path.segments.length;
    const index = ((Math.round(anchorIndex) % count) + count) % count;
    const previousIndex = (index - 1 + count) % count;
    const segments = copySegments(path);
    const anchor = path.anchors[index];
    const previous = path.anchors[previousIndex];
    const next = path.anchors[(index + 1) % count];
    const incoming = segments[previousIndex];
    const outgoing = segments[index];
    const state = anchorHandleState(segments, index);

    if (state.incoming || state.outgoing) {
        incoming.control2 = copyPoint(anchor);
        outgoing.control1 = copyPoint(anchor);
        return rebuildFocusPath(path, segments);
    }

    const direction = pairedDirection(
        subtract(next, anchor),
        subtract(anchor, previous),
        previous,
        next
    );
    const incomingLength = Math.max(
        FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH,
        length(subtract(anchor, previous)) / 3
    );
    const outgoingLength = Math.max(
        FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH,
        length(subtract(next, anchor)) / 3
    );
    incoming.control2 = visibleHandlePoint(anchor, reverse(direction), incomingLength);
    outgoing.control1 = visibleHandlePoint(anchor, direction, outgoingLength);
    incoming.kind = 'curve';
    outgoing.kind = 'curve';
    return rebuildFocusPath(path, segments);
}

export function importedClosureEditorControls(path) {
    if (!path?.importMeta?.wasOpen || path.importMeta.closureKind === 'line') {
        return { anchors: [], handles: [] };
    }
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
    if (!path?.importMeta?.wasOpen || path.importMeta.closureKind === 'line') return path;
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
    if (!path?.importMeta?.wasOpen || path.importMeta.closureKind === 'line') return path;
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
