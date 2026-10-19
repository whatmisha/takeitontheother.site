import { ARTBOARD_SIZE, SPHERE_AXES } from '../../src/geometry/globalGeometry.js';
import { SEEDED_PRESETS } from '../../src/core/presets.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function reverseBits(value, bits) {
  let result = 0;
  for (let bit = 0; bit < bits; bit++) {
    result = result * 2 + value % 2;
    value = Math.floor(value / 2);
  }
  return result;
}

// Keep the large Figma sphere, but interpret Diameter and Minimum gap in CSS
// pixels at the generator's 100% zoom. DPR affects raster resolution only.
export function createWebsiteSphereLayout(cssSize, {
  diameter = 4,
  overlapGap = 6,
  sphereRadius = 224
} = {}) {
  if (!(cssSize > 0 && diameter > 0 && overlapGap >= 0 && sphereRadius > 0)) {
    throw new RangeError('Sphere dimensions must be positive and the gap non-negative.');
  }
  const cssRadius = sphereRadius * cssSize / ARTBOARD_SIZE;
  const angularRadius = Math.asin(diameter / (2 * cssRadius));
  const separation = 2 * angularRadius + overlapGap / cssRadius;
  if (!Number.isFinite(separation) || separation >= Math.PI) {
    throw new RangeError('The sphere is too small for the requested diameter and gap.');
  }
  const cellSize = 2 * Math.sin(separation / 2);
  const minimumSquared = cellSize * cellSize;
  const stride = Math.ceil(2 / cellSize) + 3;
  const buckets = new Map();
  const axes = [];
  const cell = value => Math.floor((value + 1) / cellSize) + 1;
  const key = (x, y, z) => (z * stride + y) * stride + x;
  const insert = point => {
    const id = key(cell(point.x), cell(point.y), cell(point.z));
    const bucket = buckets.get(id);
    if (bucket) bucket.push(point);
    else buckets.set(id, [point]);
  };
  const accept = point => {
    const x = cell(point.x), y = cell(point.y), z = cell(point.z);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const bucket = buckets.get(key(x + dx, y + dy, z + dz));
          if (!bucket) continue;
          for (const other of bucket) {
            const distanceSquared = (point.x - other.x) ** 2
              + (point.y - other.y) ** 2 + (point.z - other.z) ** 2;
            if (distanceSquared < minimumSquared) return;
          }
        }
      }
    }
    axes.push(point);
    // Antipodal symmetry lets us check one side and render both, as in Main Draft.
    insert(point);
    insert({ x: -point.x, y: -point.y, z: -point.z });
  };

  // Preserve the generator's existing centers wherever they fit. Fill remaining
  // space from a finer equal-area candidate field, without the editor's count cap.
  for (const point of SPHERE_AXES) accept(point);
  const candidateCount = Math.ceil(8 / (1 - Math.cos(separation / 2)));
  const bits = Math.ceil(Math.log2(candidateCount));
  for (let step = 0; step < 2 ** bits; step++) {
    const index = reverseBits(step, bits);
    if (index >= candidateCount) continue;
    const z = (index + .5) / candidateCount;
    const radial = Math.sqrt(1 - z * z);
    const angle = index * GOLDEN_ANGLE;
    accept({ x: Math.cos(angle) * radial, y: Math.sin(angle) * radial, z });
  }
  return {
    axes,
    sphereRadius,
    angularRadius,
    color: SEEDED_PRESETS['Main Draft'].ellipseColor
  };
}
