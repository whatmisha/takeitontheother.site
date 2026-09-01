import assert from 'node:assert/strict';
import test from 'node:test';

import {
    generateFocusPath,
    pathIsInsideRegion,
    rebuildFocusPath,
    serializeFocusPath,
    tangentContinuityAtAnchor
} from '../src/animation/focusPath.js';
import {
    ensureFocusPathHandles,
    FOCUS_PATH_EDITOR_ANCHOR_INSET,
    FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH,
    focusPathEditorHandlePoints,
    moveFocusPathAnchor,
    moveFocusPathHandle
} from '../src/animation/focusPathEditor.js';

const handleLengthsAt = (value, index) => {
    const count = value.segments.length;
    const anchor = value.anchors[index];
    return {
        incoming: Math.hypot(
            value.segments[(index - 1 + count) % count].control2.x - anchor.x,
            value.segments[(index - 1 + count) % count].control2.y - anchor.y
        ),
        outgoing: Math.hypot(
            value.segments[index].control1.x - anchor.x,
            value.segments[index].control1.y - anchor.y
        )
    };
};

const path = generateFocusPath({
    start: { x: 240, y: 240 },
    center: { x: 240, y: 240 },
    radius: 195.233,
    pointCount: 6,
    complexity: 50,
    seed: 98765
});

test('serialized edited paths rebuild with the exact same cubic geometry', () => {
    const serialized = serializeFocusPath(path);
    const rebuilt = rebuildFocusPath(serialized);
    assert.equal(rebuilt.path, path.path);
    assert.equal(rebuilt.totalLength, path.totalLength);
    assert.deepEqual(rebuilt.anchors, path.anchors);
    assert.equal(pathIsInsideRegion(rebuilt), true);
});

test('opening editor controls does not change a generated boundary path', () => {
    const boundaryPath = generateFocusPath({
        start: { x: 435.233, y: 240 },
        center: { x: 240, y: 240 },
        radius: 195.233,
        pointCount: 6,
        complexity: 50,
        smoothness: 50,
        seed: 9
    });
    const originalPath = boundaryPath.path;
    const originalAnchors = structuredClone(boundaryPath.anchors);
    const handles = focusPathEditorHandlePoints(boundaryPath, 0);
    const prepared = ensureFocusPathHandles(boundaryPath);

    assert.ok(Math.hypot(
        handles.incoming.x - boundaryPath.anchors[0].x,
        handles.incoming.y - boundaryPath.anchors[0].y
    ) >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    assert.ok(Math.hypot(
        handles.outgoing.x - boundaryPath.anchors[0].x,
        handles.outgoing.y - boundaryPath.anchors[0].y
    ) >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    assert.equal(boundaryPath.path, originalPath);
    assert.deepEqual(boundaryPath.anchors, originalAnchors);
    assert.equal(prepared.path, originalPath);
    assert.deepEqual(prepared.anchors, originalAnchors);
});

test('moving an anchor carries both handles and remains inside the focus circle', () => {
    const moved = moveFocusPathAnchor(path, 2, { x: 900, y: -200 });
    const anchor = moved.anchors[2];
    assert.ok(
        Math.hypot(anchor.x - moved.center.x, anchor.y - moved.center.y)
        <= moved.radius - FOCUS_PATH_EDITOR_ANCHOR_INSET + 1e-6
    );
    assert.equal(pathIsInsideRegion(moved), true);
    const handles = handleLengthsAt(moved, 2);
    assert.ok(handles.incoming >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    assert.ok(handles.outgoing >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    const continuity = tangentContinuityAtAnchor(moved, 2);
    assert.ok(Math.abs(continuity.cross) < 1e-6);
    assert.ok(continuity.dot > 0.999);
});

test('entering the editor restores collapsed handles to a draggable minimum', () => {
    const segments = path.segments.map((segment) => ({
        start: { ...segment.start },
        control1: { ...segment.control1 },
        control2: { ...segment.control2 },
        end: { ...segment.end }
    }));
    segments[0].control1 = { ...segments[0].start };
    segments.at(-1).control2 = { ...segments[0].start };
    const collapsed = rebuildFocusPath(path, segments);
    const restored = ensureFocusPathHandles(collapsed);
    const handles = handleLengthsAt(restored, 0);

    assert.ok(handles.incoming >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    assert.ok(handles.outgoing >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    assert.equal(pathIsInsideRegion(restored), true);
});

test('dragging a Bézier handle rotates its partner along the same straight line', () => {
    const edited = moveFocusPathHandle(path, 0, 'outgoing', { x: 360, y: 300 });
    const outgoing = edited.segments[0].control1;
    assert.notDeepEqual(outgoing, path.segments[0].control1);
    assert.equal(pathIsInsideRegion(edited), true);
    const handles = handleLengthsAt(edited, 0);
    assert.ok(handles.incoming >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    assert.ok(handles.outgoing >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    const continuity = tangentContinuityAtAnchor(edited, 0);
    assert.ok(Math.abs(continuity.cross) < 1e-6);
    assert.ok(continuity.dot > 0.999);
});

test('a smooth handle remains draggable after its anchor is pulled toward the boundary', () => {
    const atBoundary = moveFocusPathAnchor(path, 0, { x: 1000, y: 240 });
    const before = atBoundary.segments[0].control1;
    const edited = moveFocusPathHandle(atBoundary, 0, 'outgoing', { x: 380, y: 310 });
    const handles = handleLengthsAt(edited, 0);

    assert.notDeepEqual(edited.segments[0].control1, before);
    assert.ok(handles.incoming >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    assert.ok(handles.outgoing >= FOCUS_PATH_EDITOR_MIN_HANDLE_LENGTH - 1e-6);
    assert.equal(pathIsInsideRegion(edited), true);
    const continuity = tangentContinuityAtAnchor(edited, 0);
    assert.ok(Math.abs(continuity.cross) < 1e-6);
    assert.ok(continuity.dot > 0.999);
});
