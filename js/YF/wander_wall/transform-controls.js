import { clamp } from './document.js';

const directions = { resize: [1, 1], resizeNE: [1, -1], resizeNW: [-1, -1], resizeSW: [-1, 1],
    resizeN: [0, -1], resizeE: [1, 0], resizeS: [0, 1], resizeW: [-1, 0] };

export function transformHandles(item, scene, size) {
    const angle = item.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    return Object.fromEntries(Object.entries(directions).map(([name, [axisX, axisY]]) => {
        const x = axisX * size.width / 2, y = axisY * size.height / 2;
        return [name, { x: item.x * scene.width + x * cos - y * sin, y: item.y * scene.height + x * sin + y * cos, axisX, axisY }];
    }));
}

export function hitTransformControl(point, item, scene, size, zoom, pointerType) {
    if (item.visible === false) return null;
    const handles = Object.values(transformHandles(item, scene, size));
    const nearest = handles.reduce((best, handle) => Math.hypot(point.x - handle.x, point.y - handle.y) < Math.hypot(point.x - best.x, point.y - best.y) ? handle : best);
    const distance = Math.hypot(point.x - nearest.x, point.y - nearest.y) * zoom;
    if (distance <= (pointerType === 'touch' ? 16 : 10)) return { mode: 'resize', handle: nearest };
    const angle = item.rotation * Math.PI / 180, dx = point.x - item.x * scene.width, dy = point.y - item.y * scene.height;
    const outside = Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle)) > size.width / 2 || Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) > size.height / 2;
    if (outside && distance <= (pointerType === 'touch' ? 34 : 26)) return { mode: 'rotate', handle: nearest };
    return null;
}

export function resizeFromHandle(item, scene, size, handle, delta) {
    const angle = item.rotation * Math.PI / 180;
    const vx = handle.axisX * size.width, vy = handle.axisY * size.height;
    const x = vx * Math.cos(angle) - vy * Math.sin(angle), y = vx * Math.sin(angle) + vy * Math.cos(angle);
    // Project the drag onto the handle axis; preserve proportions and the opposite anchor.
    const scale = clamp(item.scale * (1 + (delta.x * x + delta.y * y) / Math.max(1, x * x + y * y)), .025, 3);
    const ratio = scale / item.scale;
    return { ...item, scale, x: item.x + x * (ratio - 1) / (2 * scene.width), y: item.y + y * (ratio - 1) / (2 * scene.height) };
}

export function resizeCursor(handle, rotation) {
    const angle = rotation + Math.atan2(handle.axisY, handle.axisX) * 180 / Math.PI;
    return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][((Math.round(angle / 45) % 4) + 4) % 4];
}
