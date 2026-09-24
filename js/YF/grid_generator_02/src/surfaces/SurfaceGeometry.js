import { packagingNet } from '../packaging/PackagingModel.js';

export function getSurfacePhysicalRect(surface, layout) {
    const { panels } = packagingNet(layout);
    return panels[surface] || panels.front;
}

export function getSurfaceGeometry(surface, layout, rotation = 0) {
    const rect = getSurfacePhysicalRect(surface, layout);
    const normalizedRotation = surface === 'front' ? 0 : rotation;
    const swapsAxes = normalizedRotation === 90 || normalizedRotation === 270;
    const transforms = {
        90: `translate(${rect.x + rect.width} ${rect.y}) rotate(90)`,
        180: `translate(${rect.x + rect.width} ${rect.y + rect.height}) rotate(180)`,
        270: `translate(${rect.x} ${rect.y + rect.height}) rotate(-90)`
    };
    return {
        surface,
        rect,
        rotation: normalizedRotation,
        localWidth: swapsAxes ? rect.height : rect.width,
        localHeight: swapsAxes ? rect.width : rect.height,
        transform: transforms[normalizedRotation] || `translate(${rect.x} ${rect.y})`
    };
}

export function globalToSurfaceLocal(point, geometry) {
    const { rect, rotation } = geometry;
    switch (rotation) {
        case 90: return { x: point.y - rect.y, y: rect.x + rect.width - point.x };
        case 180: return { x: rect.x + rect.width - point.x, y: rect.y + rect.height - point.y };
        case 270: return { x: rect.y + rect.height - point.y, y: point.x - rect.x };
        default: return { x: point.x - rect.x, y: point.y - rect.y };
    }
}

export function pointIsInsideRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.width &&
        point.y >= rect.y && point.y <= rect.y + rect.height;
}
