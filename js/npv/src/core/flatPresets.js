export const FLAT_DEFAULT_PRESET_NAME = 'Talent';

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
        personIconScale: 100,
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
        width: 1080,
        height: 600,
        mode: 'person',
        personAnimation: 'interactive',
        distribution: 'grid',
        ellipseWidth: 8,
        ellipseHeight: 8,
        spacingX: 24,
        spacingY: 24,
        stagger: 50,
        basicScale: 215,
        personIconScale: 150,
        personMinimumScale: 25,
        fieldRadius: 100,
        falloffCurve: -25,
        fieldX: 334.1,
        fieldY: -270.6,
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
