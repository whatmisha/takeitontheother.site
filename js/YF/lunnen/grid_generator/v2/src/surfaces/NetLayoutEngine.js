/**
 * Pure layout engine for packaging nets of arbitrary size.
 *
 * A net is a tree of planes: exactly one root plus any number of planes
 * attached to a parent edge. The engine resolves every plane to an axis-aligned
 * rectangle, derives the content transform from the plane rotation, and returns
 * the union bounding box that the editor canvas and the SVG export share.
 *
 * The engine is deliberately free of DOM, settings and rendering concerns so it
 * can be exercised directly and reused by both render paths.
 */
import { FIT } from './PlaneDefinition.js';

export const NET_ISSUES = Object.freeze({
    MISSING_ROOT: 'missing-root',
    UNKNOWN_PARENT: 'unknown-parent',
    CYCLE: 'cycle',
    DUPLICATE_ID: 'duplicate-id'
});

/** Resolves a plane dimension to millimetres. */
export function resolveDimension(dimension, variables = {}, fitLength = null) {
    if (dimension === FIT) {
        return Number.isFinite(fitLength) && fitLength > 0 ? fitLength : 0;
    }
    if (typeof dimension === 'string') {
        const value = Number(variables[dimension]);
        return Number.isFinite(value) && value > 0 ? value : 0;
    }
    const numeric = Number(dimension);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function alignedStart(parentStart, parentLength, childLength, align) {
    if (align === 'center') return parentStart + (parentLength - childLength) / 2;
    if (align === 'end') return parentStart + parentLength - childLength;
    return parentStart;
}

/**
 * Derives the content transform of a plane from its rectangle and rotation.
 *
 * Rotation turns the content inside the plane without moving the plane itself,
 * so 90° and 270° swap the local axes the grid and objects are laid out on.
 */
export function resolveContentGeometry(rect, contentRotation = 0) {
    const swapsAxes = contentRotation === 90 || contentRotation === 270;
    const transforms = {
        90: `translate(${rect.x + rect.width} ${rect.y}) rotate(90)`,
        180: `translate(${rect.x + rect.width} ${rect.y + rect.height}) rotate(180)`,
        270: `translate(${rect.x} ${rect.y + rect.height}) rotate(-90)`
    };
    return {
        rotation: contentRotation,
        localWidth: swapsAxes ? rect.height : rect.width,
        localHeight: swapsAxes ? rect.width : rect.height,
        transform: transforms[contentRotation] || `translate(${rect.x} ${rect.y})`
    };
}

/**
 * Orders planes so every plane appears after its parent, reporting planes that
 * cannot be reached from the root instead of throwing.
 */
function orderPlanes(planes, rootId) {
    const issues = [];
    const byId = new Map();
    for (const plane of planes) {
        if (byId.has(plane.id)) {
            issues.push({ code: NET_ISSUES.DUPLICATE_ID, planeId: plane.id });
            continue;
        }
        byId.set(plane.id, plane);
    }

    const root = byId.get(rootId) || planes.find(plane => !plane.attach) || planes[0];
    if (!root) return { order: [], byId, issues: [{ code: NET_ISSUES.MISSING_ROOT }] };

    const childrenByParent = new Map();
    for (const plane of byId.values()) {
        if (plane.id === root.id || !plane.attach) continue;
        if (!byId.has(plane.attach.to)) {
            issues.push({ code: NET_ISSUES.UNKNOWN_PARENT, planeId: plane.id });
            continue;
        }
        const siblings = childrenByParent.get(plane.attach.to) || [];
        siblings.push(plane.id);
        childrenByParent.set(plane.attach.to, siblings);
    }

    const order = [];
    const visited = new Set();
    const queue = [root.id];
    while (queue.length > 0) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        order.push(id);
        queue.push(...(childrenByParent.get(id) || []));
    }

    for (const plane of byId.values()) {
        if (!visited.has(plane.id) && plane.attach && byId.has(plane.attach.to)) {
            issues.push({ code: NET_ISSUES.CYCLE, planeId: plane.id });
        }
    }

    return { order, byId, issues, rootId: root.id };
}

/**
 * Stacking follows the document's plane array rather than the attachment tree,
 * so it is both the order planes are emitted in and the order hit-testing
 * resolves ties in. Planes of a valid net do not overlap; the semantics of
 * deliberate overlap are settled together with plane management.
 */
function stackOrderOf(planes, placedIds) {
    const pending = new Set(placedIds);
    const order = [];
    for (const plane of planes) {
        if (!pending.delete(plane.id)) continue;
        order.push(plane.id);
    }
    return order;
}

/**
 * Resolves a net to placed rectangles.
 *
 * Rectangles are returned in net space with the root plane at the origin, plus
 * the union bounds of every plane. `origin` shifts the result so the artboard's
 * top-left corner lands on the requested point, which is how the editor centres
 * the net and how the export anchors it at (0, 0).
 */
export function computeNetLayout(net, { origin = { x: 0, y: 0 } } = {}) {
    const planes = Array.isArray(net?.planes) ? net.planes : [];
    const variables = net?.variables || {};
    const { order, byId, issues, rootId } = orderPlanes(planes, net?.rootId);
    const rects = new Map();

    for (const id of order) {
        const plane = byId.get(id);
        if (!plane.attach || id === rootId) {
            rects.set(id, {
                x: 0,
                y: 0,
                width: resolveDimension(plane.size.width, variables),
                height: resolveDimension(plane.size.height, variables)
            });
            continue;
        }

        // `fit` resolves against the parent side it runs along.
        const parent = rects.get(plane.attach.to);
        const { edge, align, offset } = plane.attach;
        const width = resolveDimension(plane.size.width, variables, parent.width);
        const height = resolveDimension(plane.size.height, variables, parent.height);

        if (edge === 'left' || edge === 'right') {
            rects.set(id, {
                x: edge === 'left' ? parent.x - width : parent.x + parent.width,
                y: alignedStart(parent.y, parent.height, height, align) + offset,
                width,
                height
            });
            continue;
        }
        rects.set(id, {
            x: alignedStart(parent.x, parent.width, width, align) + offset,
            y: edge === 'top' ? parent.y - height : parent.y + parent.height,
            width,
            height
        });
    }

    const bounds = order.reduce((accumulator, id) => {
        const rect = rects.get(id);
        return {
            minX: Math.min(accumulator.minX, rect.x),
            minY: Math.min(accumulator.minY, rect.y),
            maxX: Math.max(accumulator.maxX, rect.x + rect.width),
            maxY: Math.max(accumulator.maxY, rect.y + rect.height)
        };
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const resolvedBounds = Number.isFinite(bounds.minX)
        ? { ...bounds, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY }
        : { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };

    const placed = {};
    for (const id of order) {
        const plane = byId.get(id);
        const rect = rects.get(id);
        const placedRect = {
            x: origin.x + (rect.x - resolvedBounds.minX),
            y: origin.y + (rect.y - resolvedBounds.minY),
            width: rect.width,
            height: rect.height
        };
        placed[id] = {
            id,
            name: plane.name,
            kind: plane.kind,
            visible: plane.visible,
            rect: placedRect,
            ...resolveContentGeometry(placedRect, plane.contentRotation)
        };
    }

    return {
        rootId,
        order,
        stackOrder: stackOrderOf(planes, order),
        planes: placed,
        bounds: resolvedBounds,
        issues
    };
}

/** Maps a point in artboard space into the plane's local content space. */
export function globalToPlaneLocal(point, geometry) {
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

/** Finds the topmost visible plane under a point, honouring stacking order. */
export function planeAtPoint(layout, point, { isVisible = plane => plane.visible } = {}) {
    for (const id of layout.stackOrder || layout.order) {
        const plane = layout.planes[id];
        if (isVisible(plane) && pointIsInsideRect(point, plane.rect)) return plane.id;
    }
    return null;
}
