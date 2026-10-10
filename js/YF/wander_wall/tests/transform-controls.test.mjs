import test from 'node:test';
import assert from 'node:assert/strict';
import { transformHandles, hitTransformControl, resizeFromHandle, resizeCursor } from '../transform-controls.js';

const scene = { width: 1000, height: 800 }, size = { width: 200, height: 120 };
const item = { x: .5, y: .5, scale: .5, rotation: 0 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('eight handles resize, with rotation zones outside every corner and side at any zoom', () => {
    for (const rotation of [0, 37, 90, -145]) for (const zoom of [.2, 1, 3]) {
        const current = { ...item, rotation }, handles = Object.values(transformHandles(current, scene, size));
        assert.equal(handles.length, 8);
        for (const handle of handles) {
            assert.equal(hitTransformControl(handle, current, scene, size, zoom, 'mouse').mode, 'resize');
            const dx = handle.x - current.x * scene.width, dy = handle.y - current.y * scene.height, distance = Math.hypot(dx, dy);
            const outside = { x: handle.x + dx / distance * 20 / zoom, y: handle.y + dy / distance * 20 / zoom };
            assert.equal(hitTransformControl(outside, current, scene, size, zoom, 'mouse').mode, 'rotate');
            const far = { x: handle.x + dx / distance * 40 / zoom, y: handle.y + dy / distance * 40 / zoom };
            assert.equal(hitTransformControl(far, current, scene, size, zoom, 'mouse'), null);
        }
        assert.equal(hitTransformControl({ x: 500, y: 400 }, current, scene, size, zoom, 'mouse'), null);
    }
});

test('all eight resize gestures preserve proportions and the opposite anchor, including Surface', () => {
    for (const kind of ['letter', 'form', 'ground']) for (const rotation of [0, 45, -110]) {
        const current = { ...item, kind, rotation, x: -4, y: 6 };
        for (const handle of Object.values(transformHandles(current, scene, size))) {
            const dx = handle.x - current.x * scene.width, dy = handle.y - current.y * scene.height;
            const resized = resizeFromHandle(current, scene, size, handle, { x: dx, y: dy });
            near(resized.scale, .75);
            near(resized.x * scene.width - dx * 1.5, current.x * scene.width - dx);
            near(resized.y * scene.height - dy * 1.5, current.y * scene.height - dy);
            assert.equal(resized.rotation, rotation);
            const unchanged = resizeFromHandle(current, scene, size, handle, { x: -dy, y: dx });
            near(unchanged.scale, current.scale);
            const minimum = resizeFromHandle(current, scene, size, handle, { x: -dx * 20, y: -dy * 20 });
            near(minimum.scale, .025);
            near(minimum.x * scene.width - dx * .05, current.x * scene.width - dx);
        }
    }
});

test('touch targets are larger, hidden items have no controls, and resize cursors follow rotation', () => {
    const handles = transformHandles(item, scene, size), point = { x: handles.resizeE.x + 14, y: handles.resizeE.y };
    assert.equal(hitTransformControl(point, item, scene, size, 1, 'touch').mode, 'resize');
    assert.equal(hitTransformControl(point, item, scene, size, 1, 'mouse').mode, 'rotate');
    assert.equal(hitTransformControl(handles.resizeE, { ...item, visible: false }, scene, size, 1, 'mouse'), null);
    assert.equal(resizeCursor(handles.resizeE, 0), 'ew-resize');
    assert.equal(resizeCursor(handles.resizeE, 90), 'ns-resize');
    assert.equal(resizeCursor(handles.resize, 0), 'nwse-resize');
    assert.equal(resizeCursor(handles.resize, 90), 'nesw-resize');
});
