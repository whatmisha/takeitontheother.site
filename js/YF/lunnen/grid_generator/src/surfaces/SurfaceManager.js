import {
    createDefaultSurfaceSettings,
    getPresetOrientationProfile,
    SIDE_SURFACE_IDS,
    SURFACE_IDS,
    SURFACE_ROTATIONS,
    SurfaceStateStore
} from './SurfaceStateStore.js';
import {
    getSurfaceGeometry,
    getSurfacePhysicalRect,
    globalToSurfaceLocal,
    pointIsInsideRect
} from './SurfaceGeometry.js';

export {
    createDefaultSurfaceSettings,
    getPresetOrientationProfile,
    SIDE_SURFACE_IDS,
    SURFACE_IDS,
    SURFACE_ROTATIONS
};

/** Public facade joining persistent surface state with pure geometry. */
export class SurfaceManager {
    constructor(settings) {
        this.settings = settings;
        this.state = new SurfaceStateStore(settings);
    }

    getMainGrid() { return this.state.getMainGrid(); }
    normalize(settings, presetName = '') { return this.state.normalize(settings, presetName); }
    initialize(presetName = '', explicitSettings) { return this.state.initialize(presetName, explicitSettings); }
    getAll() { return this.state.getAll(); }
    get(surface = 'front') { return this.state.get(surface); }
    update(surface, patch = {}) { return this.state.update(surface, patch); }
    setAllSideVisibility(visible) { return this.state.setAllSideVisibility(visible); }
    syncMasterVisibility() { return this.state.syncMasterVisibility(); }
    isVisible(surface) { return this.state.isVisible(surface); }
    getGridContext(surface, width, height) { return this.state.getGridContext(surface, width, height); }

    getPhysicalRect(surface, layout) {
        return getSurfacePhysicalRect(surface, layout);
    }

    getGeometry(surface, layout) {
        return getSurfaceGeometry(surface, layout, this.get(surface).rotation);
    }

    globalToLocal(surface, point, layout) {
        return globalToSurfaceLocal(point, this.getGeometry(surface, layout));
    }

    surfaceAtPoint(point, layout) {
        return SURFACE_IDS.find(surface => (
            this.isVisible(surface) && pointIsInsideRect(point, this.getPhysicalRect(surface, layout))
        )) || null;
    }
}
