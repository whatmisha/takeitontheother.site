import { buildPlanetMasks } from './planet-masks.js';

self.onmessage = ({ data: { version, coordinates } }) => {
  const axes = [];
  for (let i = 0; i < coordinates.length; i += 3) {
    axes.push({ x: coordinates[i], y: coordinates[i + 1], z: coordinates[i + 2] });
  }
  const masks = buildPlanetMasks(axes);
  self.postMessage({ version, masks }, [masks.land.buffer,
    ...Object.values(masks.regions).map(values => values.buffer)]);
};
