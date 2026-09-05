export const FLAT_DEFAULT_PRESET_NAME = 'Basic';

export const FLAT_PRESETS = Object.freeze({
    Basic: Object.freeze({
        width: 960,
        height: 540,
        mode: 'basic',
        distribution: 'grid',
        ellipseWidth: 8.4,
        ellipseHeight: 8.4,
        spacingX: 23.1,
        spacingY: 23.1,
        stagger: 50,
        basicScale: 215,
        personMinimumScale: 48,
        fieldRadius: 78,
        falloffCurve: 0,
        fieldX: 0,
        fieldY: 0,
        coordinateSpace: 'center',
        fieldFollow: true,
        showField: false,
        staticFields: [],
        ellipseColor: '#d9d9d9',
        backgroundColor: '#000000'
    }),
    Talent: Object.freeze({
        width: 960,
        height: 540,
        mode: 'person',
        distribution: 'grid',
        ellipseWidth: 18,
        ellipseHeight: 18,
        spacingX: 30,
        spacingY: 30,
        stagger: 50,
        basicScale: 215,
        personMinimumScale: 10,
        fieldRadius: 200,
        falloffCurve: 0,
        fieldX: 0,
        fieldY: 0,
        coordinateSpace: 'center',
        fieldFollow: true,
        showField: false,
        staticFields: [],
        ellipseColor: '#d9d9d9',
        backgroundColor: '#000000'
    })
});

export function flatPresetNames() {
    return Object.keys(FLAT_PRESETS);
}

export function getFlatPreset(name) {
    const preset = FLAT_PRESETS[name];
    return preset ? structuredClone(preset) : null;
}
