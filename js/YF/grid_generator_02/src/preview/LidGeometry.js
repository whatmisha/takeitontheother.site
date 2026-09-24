import { createPackagingModel } from '../packaging/PackagingModel.js';

// Compatibility entry point for the initial lid preview. Panels now form a hinge tree.
export function createLidPanels(settings) {
    return createPackagingModel(settings).panels.filter(panel => !settings.visibleSurfaces || settings.visibleSurfaces.includes(panel.id));
}
export function foldAngle(panel, fold, opening = 0, type = 'lid') {
    const amount = Math.max(0, Math.min(1, fold));
    let angle = amount * Math.PI / 2 * panel.sign;
    if (type !== 'lid') {
        if (panel.id === 'top') angle += opening * amount * Math.PI / 2;
        if (panel.id === 'flap') angle *= 1 - opening;
    }
    return angle;
}
function rotate(point, axis, angle) {
    const [x, y, z] = point, c = Math.cos(angle), s = Math.sin(angle);
    return axis === 'y' ? [c * x + s * z, y, -s * x + c * z] : [x, c * y - s * z, s * y + c * z];
}
/** Net-local point after folding, optionally opening the lid while keeping its body fixed. */
export function panelPoint(panel, x, y, fold, panels = [panel], opening = 0, type = 'lid') {
    let point = [x + panel.offset[0], y + panel.offset[1], panel.offset[2]];
    let joint = panel;
    const visited = new Set();
    while (joint) {
        if (visited.has(joint.id)) throw new Error('Cyclic packaging hinge tree');
        visited.add(joint.id);
        point = rotate(point, joint.axis, foldAngle(joint, fold, opening, type)).map((value, i) => value + joint.hinge[i]);
        joint = panels.find(candidate => candidate.id === joint.parent);
    }
    if (type !== 'lid' && opening) {
        const h = panels.find(candidate => candidate.id === 'front').height;
        point[1] -= h / 2;
        point = rotate(point, 'x', -opening * Math.max(0, Math.min(1, fold)) * Math.PI / 2);
        point[1] += h / 2;
    }
    return point;
}
export function panelUV(panel, u, v) {
    return [(panel.rect.x + u * panel.rect.width) / panel.atlasWidth,
        1 - (panel.rect.y + (1 - v) * panel.rect.height) / panel.atlasHeight];
}
