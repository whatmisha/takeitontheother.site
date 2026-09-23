import { getSurfacePhysicalRect } from '../surfaces/SurfaceGeometry.js';

// Millimeters, exterior normals +Z. Each side rotates about its real fold edge.
// The main face keeps the legacy ID "front" so existing layouts map unchanged.
export function createLidPanels({ frontWidth: w, frontHeight: h, thickness: d, visibleSurfaces }) {
    if (![w, h, d].every(value => Number.isFinite(value) && value > 0)) {
        throw new Error('The lid needs positive width, height and depth.');
    }
    const specs = [
        { id: 'front', width: w, height: h, hinge: [0, 0, 0], offset: [0, 0, 0], axis: 'x', sign: 0 },
        { id: 'left', width: d, height: h, hinge: [-w / 2, 0, 0], offset: [-d / 2, 0, 0], axis: 'y', sign: -1 },
        { id: 'right', width: d, height: h, hinge: [w / 2, 0, 0], offset: [d / 2, 0, 0], axis: 'y', sign: 1 },
        { id: 'top', width: w, height: d, hinge: [0, h / 2, 0], offset: [0, d / 2, 0], axis: 'x', sign: -1 },
        { id: 'bottom', width: w, height: d, hinge: [0, -h / 2, 0], offset: [0, -d / 2, 0], axis: 'x', sign: 1 }
    ];
    return specs.filter(panel => !visibleSurfaces || visibleSurfaces.includes(panel.id)).map(panel => ({
        ...panel,
        rect: getSurfacePhysicalRect(panel.id, { frontWidth: w, frontHeight: h, thickness: d }),
        atlasWidth: w + 2 * d,
        atlasHeight: h + 2 * d
    }));
}

export function foldAngle(panel, fold) {
    return Math.max(0, Math.min(1, fold)) * Math.PI / 2 * panel.sign;
}

export function panelPoint(panel, x, y, fold) {
    x += panel.offset[0];
    y += panel.offset[1];
    const angle = foldAngle(panel, fold), c = Math.cos(angle), s = Math.sin(angle);
    const point = panel.axis === 'y' ? [c * x, y, -s * x] : [x, c * y, s * y];
    return point.map((value, i) => value + panel.hinge[i]);
}

export function panelUV(panel, u, v) {
    return [(panel.rect.x + u * panel.rect.width) / panel.atlasWidth,
        1 - (panel.rect.y + (1 - v) * panel.rect.height) / panel.atlasHeight];
}
