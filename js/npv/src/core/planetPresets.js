import { SEEDED_PRESETS } from './presets.js';

export function planetDefaults() {
    return {
        ...structuredClone(SEEDED_PRESETS['Main Draft']),
        planetMode: true,
        magnetStrength: 0,
        magnetFollow: false,
        landGrowth: 100,
        countryGrowth: 100,
        landSoftness: 0,
        countrySoftness: 0,
        selectedCountries: [],
        showCountryBorders: false
    };
}

export const PLANET_PRESETS = Object.freeze({ Planet: planetDefaults() });
