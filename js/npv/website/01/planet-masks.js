import { planetMaskForAxes } from '../../src/geometry/planetGeography.js';
import { PLANET_REGIONS } from './planet-regions.js';

// Reuse Planet's geography, including a representative dot for small countries.
// This module is loaded only by the worker, never on the rendering thread.
export function buildPlanetMasks(axes) {
  const settings = { landGrowth: 100, countryGrowth: 100, landSoftness: 0, countrySoftness: 0 };
  const land = Float32Array.from(planetMaskForAxes(axes, settings), mark => mark.landInfluence);
  const regions = Object.fromEntries(Object.entries(PLANET_REGIONS).map(([id, region]) => [id,
    Float32Array.from(planetMaskForAxes(axes, { ...settings, selectedCountries: region.countries }),
      mark => mark.countryInfluence)
  ]));
  return { land, regions };
}
