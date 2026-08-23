import {
    getPresetOrientationProfile,
    GRID_MODE_INHERIT,
    GRID_MODE_OWN,
    PlaneDocumentStore,
    RESERVED_VARIABLES
} from './PlaneDocumentStore.js';
import { PLANE_ALIGNMENTS, PLANE_EDGES, PLANE_ROTATIONS } from './PlaneDefinition.js';
import { computeNetLayout, globalToPlaneLocal, planeAtPoint } from './NetLayoutEngine.js';

export {
    getPresetOrientationProfile,
    GRID_MODE_INHERIT,
    GRID_MODE_OWN,
    PLANE_ALIGNMENTS,
    PLANE_EDGES,
    PLANE_ROTATIONS,
    RESERVED_VARIABLES
};

/**
 * Public facade over the net document and the pure layout engine.
 *
 * Everything geometric is derived from one resolved net layout, so the editor,
 * hit-testing and the SVG export all read the same rectangles. Nothing here
 * assumes how many planes the document holds.
 */
export class SurfaceManager {
    constructor(settings) {
        this.settings = settings;
        this.state = new PlaneDocumentStore(settings);
        this.cachedKey = null;
        this.cachedLayout = null;
    }

    // --- document ------------------------------------------------------------

    getMasterGrid() { return this.state.getMasterGrid(); }
    getDocument() { return this.state.getDocument(); }
    normalize(state, presetName = '') { return this.state.normalize(state, presetName); }
    initialize(presetName = '', explicitState) { return this.state.initialize(presetName, explicitState); }
    getPlanes() { return this.state.getPlanes(); }
    getPlaneIds() { return this.state.getPlaneIds(); }
    getPlane(planeId) { return this.state.getPlane(planeId); }
    getRootId() { return this.state.getRootId(); }
    has(planeId) { return this.state.has(planeId); }
    isRoot(planeId) { return this.state.isRoot(planeId); }
    isVisible(planeId) { return this.state.isVisible(planeId); }
    getChildren(planeId) { return this.state.getChildren(planeId); }
    getSubtree(planeId) { return this.state.getSubtree(planeId); }
    getVariables() { return this.state.getVariables(); }
    setVariable(name, value) { return this.state.setVariable(name, value); }
    removeVariable(name) { return this.state.removeVariable(name); }

    update(planeId, patch = {}) { return this.state.update(planeId, patch); }
    addPlane(spec) { return this.state.addPlane(spec); }
    removePlane(planeId) { return this.state.removePlane(planeId); }
    reorderPlane(planeId, index) { return this.state.reorderPlane(planeId, index); }
    setAllSideVisibility(visible) { return this.state.setAllSideVisibility(visible); }

    getGridContext(planeId, width, height) {
        return this.state.getGridContext(planeId, width, height);
    }

    // --- geometry ------------------------------------------------------------

    /**
     * The document resolved for one layout.
     *
     * Layouts arrive pre-scaled, so the reserved dimension variables are taken
     * from the layout itself and everything else — custom variables and literal
     * millimetre sizes — is scaled to match.
     */
    getNet(layout) {
        const document = this.getDocument();
        const scale = layout.scale || 1;
        const custom = document.variables || {};
        const variables = { W: layout.frontWidth, H: layout.frontHeight, D: layout.thickness };
        for (const [name, value] of Object.entries(custom)) {
            if (name in RESERVED_VARIABLES) continue;
            variables[name] = Number(value) * scale;
        }

        const scaleSize = dimension => (
            typeof dimension === 'number' ? dimension * scale : dimension
        );

        return {
            rootId: document.rootId,
            variables,
            planes: document.planes.map(plane => ({
                ...plane,
                size: {
                    width: scaleSize(plane.size.width),
                    height: scaleSize(plane.size.height)
                },
                visible: this.isVisible(plane.id)
            }))
        };
    }

    /**
     * Placed geometry and union bounds for every plane.
     *
     * The single-entry cache keeps pointer hit-testing from resolving the net
     * again for every probe within one frame.
     */
    getNetLayout(layout) {
        const key = [
            layout.x ?? 0,
            layout.y ?? 0,
            layout.frontWidth,
            layout.frontHeight,
            layout.thickness,
            layout.scale ?? 1,
            this.getDocument().revision ?? 0,
            this.settings.get('showSidePanels') !== false
        ].join('|');

        if (key === this.cachedKey) return this.cachedLayout;
        this.cachedLayout = computeNetLayout(this.getNet(layout), {
            origin: { x: layout.x ?? 0, y: layout.y ?? 0 }
        });
        this.cachedKey = key;
        return this.cachedLayout;
    }

    getPhysicalRect(planeId, layout) {
        return this.getGeometry(planeId, layout).rect;
    }

    /** Unknown ids fall back to the root so a stale reference cannot crash a render. */
    getGeometry(planeId, layout) {
        const net = this.getNetLayout(layout);
        const plane = net.planes[planeId] || net.planes[net.rootId];
        return { surface: plane.id, ...plane };
    }

    globalToLocal(planeId, point, layout) {
        return globalToPlaneLocal(point, this.getGeometry(planeId, layout));
    }

    surfaceAtPoint(point, layout) {
        return planeAtPoint(this.getNetLayout(layout), point);
    }
}
