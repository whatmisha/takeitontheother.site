const STORAGE_KEY = 'globalEllipseGeneratorV1';
export const DEFAULT_PRESET_NAME = 'Person Five';

const clone = (value) => structuredClone(value);

export const SEEDED_PRESETS = Object.freeze({
    'Packed': {
        ellipseCount: 15,
        packingCoverage: 100,
        sphereRadius: 224,
        perspective: 50,
        topologyMode: 'packed',
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        rotationCoordinateMode: 'screen',
        magnetStrength: 0,
        preventOverlap: true,
        overlapGap: 4
    },
    'Tessellated': {
        ellipseCount: 15,
        diameter: 130,
        sphereRadius: 224,
        perspective: 50,
        topologyMode: 'tessellated',
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        rotationCoordinateMode: 'screen',
        magnetStrength: 0,
        preventOverlap: true,
        overlapGap: 4
    },
    'Progressive': {
        ellipseCount: 15,
        diameter: 130,
        sphereRadius: 224,
        perspective: 50,
        topologyMode: 'progressive',
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        rotationCoordinateMode: 'screen',
        magnetStrength: 0,
        preventOverlap: true,
        overlapGap: 4
    },
    'Rings': {
        ellipseCount: 15,
        diameter: 120,
        sphereRadius: 224,
        perspective: 38,
        topologyMode: 'rings',
        rotationX: 10,
        rotationY: -12,
        rotationZ: 0,
        rotationCoordinateMode: 'screen',
        magnetStrength: 0,
        preventOverlap: true,
        overlapGap: 4
    },
    'Iconic Five': {
        width: 480,
        height: 480,
        ellipseCount: 28,
        diameter: 48,
        packingCoverage: 100,
        sphereRadius: 152,
        perspective: 85,
        topologyMode: 'rings',
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        rotationCoordinateMode: 'screen',
        magnetStrength: 0,
        magnetRadius: 42,
        magnetX: 240,
        magnetY: 240,
        magnetFollow: true,
        preventOverlap: true,
        overlapGap: 0,
        showGuides: false,
        showBackside: false,
        ellipseColor: '#ffffff',
        backgroundColor: '#000000',
        animationMode: 'static',
        animationFrom: 1,
        duration: 5,
        rotationAnimation: {
            axis: 'x',
            degrees: 360,
            duration: 3,
            easing: 'smootherstep'
        },
        overrides: {}
    },
    'Person Five': {
        width: 480,
        height: 480,
        ellipseCount: 28,
        diameter: 45,
        packingCoverage: 100,
        sphereRadius: 152,
        perspective: 86,
        topologyMode: 'rings',
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        rotationCoordinateMode: 'screen',
        magnetStrength: 66,
        magnetRadius: 5,
        magnetX: 240,
        magnetY: 480,
        magnetFollow: false,
        preventOverlap: true,
        overlapGap: 0,
        showGuides: false,
        showBackside: false,
        ellipseColor: '#ffffff',
        backgroundColor: '#000000',
        animationMode: 'static',
        animationFrom: 1,
        duration: 5,
        rotationAnimation: {
            axis: 'x',
            degrees: 180,
            duration: 3,
            easing: 'smootherstep'
        },
        overrides: {}
    },
    'South Pull': {
        ellipseCount: 9,
        diameter: 190,
        sphereRadius: 202,
        perspective: 65,
        topologyMode: 'tessellated',
        rotationX: 0,
        rotationY: 34,
        rotationZ: 0,
        rotationCoordinateMode: 'screen',
        magnetStrength: 105,
        magnetRadius: 38,
        magnetX: 240,
        magnetY: 392,
        magnetFollow: false,
        preventOverlap: false
    },
    'Dense Globe': {
        ellipseCount: 28,
        diameter: 82,
        sphereRadius: 205,
        perspective: 40,
        topologyMode: 'tessellated',
        rotationX: 18,
        rotationY: -12,
        rotationZ: 0,
        rotationCoordinateMode: 'screen',
        magnetStrength: 0,
        preventOverlap: true,
        overlapGap: 3
    }
});

export class PresetManager {
    constructor(defaults) {
        this.defaults = clone(defaults);
        this.currentName = DEFAULT_PRESET_NAME;
        this.dirty = false;
    }

    loadUserPresets() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    saveUserPresets(presets) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    }

    names() {
        const seeded = Object.keys(SEEDED_PRESETS);
        return [...seeded, ...Object.keys(this.loadUserPresets()).filter((name) => !SEEDED_PRESETS[name])];
    }

    get(name) {
        const source = SEEDED_PRESETS[name] || this.loadUserPresets()[name];
        if (!source) return null;
        const state = { ...clone(this.defaults), ...clone(source) };
        if (!Object.hasOwn(source, 'rotationCoordinateMode')) delete state.rotationCoordinateMode;
        return state;
    }

    save(name, state) {
        if (SEEDED_PRESETS[name]) return false;
        const presets = this.loadUserPresets();
        presets[name] = clone(state);
        this.saveUserPresets(presets);
        this.currentName = name;
        this.dirty = false;
        return true;
    }

    delete(name) {
        if (SEEDED_PRESETS[name]) return false;
        const presets = this.loadUserPresets();
        if (!presets[name]) return false;
        delete presets[name];
        this.saveUserPresets(presets);
        return true;
    }

    markDirty() {
        this.dirty = true;
    }

    markClean(name = this.currentName) {
        this.currentName = name;
        this.dirty = false;
    }
}
