import { ARTBOARD_SIZE, MAX_ELLIPSES, buildGlobalScene, geometryControlLimits } from '../../src/geometry/globalGeometry.js';
import { SEEDED_PRESETS } from '../../src/core/presets.js';

// Diameter and gap use the generator's 480-unit artboard, not CSS pixels.
// Keep the site's framing and resolve density without shrinking either value.
export function createWebsiteSpherePreset({ diameter = 4, overlapGap = 6, sphereRadius = 224 } = {}) {
  const preset = {
    ...SEEDED_PRESETS['Main Draft'],
    diameter,
    overlapGap,
    sphereRadius,
    magnetStrength: 0,
    showMagnetField: false
  };
  const fits = ellipseCount => geometryControlLimits({ ...preset, ellipseCount }).diameterMax >= diameter;

  // Above 128 pairs, Main Draft uses a nested sequence: adding a pair can
  // only reduce minimum separation. Search that sequence without building
  // projected paths for each candidate count.
  let lower = 129;
  let upper = MAX_ELLIPSES;
  if (fits(lower)) {
    while (lower < upper) {
      const middle = Math.ceil((lower + upper) / 2);
      if (fits(middle)) lower = middle;
      else upper = middle - 1;
    }
  } else {
    // Small layouts relax their axes independently and are not monotonic.
    // Check them in descending order instead of applying binary search.
    lower = 128;
    while (lower > 1 && !fits(lower)) lower--;
  }
  return { ...preset, ellipseCount: lower };
}

// Resolve once on page load; scrolling and resizing reuse the same axes.
export const WEBSITE_SPHERE_PRESET = Object.freeze(createWebsiteSpherePreset());

const TAU = Math.PI * 2;

function hull(points) {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (list) => {
    const result = [];
    for (const point of list) {
      while (result.length > 1 && turn(result.at(-2), result.at(-1), point) <= 0) result.pop();
      result.push(point);
    }
    result.pop();
    return result;
  };
  return [...half(points), ...half([...points].reverse())];
}

/** A spherical cap under orthographic projection is an ellipse. */
export function projectCap(normal, radius, angularRadius) {
  const sine = Math.sin(angularRadius);
  return {
    x: ARTBOARD_SIZE / 2 + normal.x * radius * Math.cos(angularRadius),
    y: ARTBOARD_SIZE / 2 + normal.y * radius * Math.cos(angularRadius),
    major: radius * sine,
    minor: radius * sine * Math.abs(normal.z),
    angle: Math.atan2(normal.y, normal.x) + Math.PI / 2,
    visible: normal.z > -sine,
    whole: normal.z >= sine
  };
}

// Only the few caps grazing the horizon need a polygon instead of an ellipse.
function horizonCap(normal, angularRadius, radius) {
  const cosine = Math.cos(angularRadius);
  const sine = Math.sin(angularRadius);
  const radial = Math.hypot(normal.x, normal.y);
  const first = { x: -normal.y / radial, y: normal.x / radial, z: 0 };
  const second = {
    x: -normal.z * first.y,
    y: normal.z * first.x,
    z: normal.x * first.y - normal.y * first.x
  };
  const points = [];
  const add = (x, y) => points.push({ x: 240 + x * radius, y: 240 + y * radius });
  for (let i = 0; i < 64; i++) {
    const angle = i / 64 * TAU;
    const c = Math.cos(angle) * sine;
    const s = Math.sin(angle) * sine;
    if (normal.z * cosine + second.z * s >= 0) {
      add(normal.x * cosine + first.x * c + second.x * s,
        normal.y * cosine + first.y * c + second.y * s);
    }
  }
  const centerAngle = Math.atan2(normal.y, normal.x);
  const halfArc = Math.acos(Math.min(1, cosine / radial));
  for (let i = 0; i <= 12; i++) {
    const angle = centerAngle - halfArc + 2 * halfArc * i / 12;
    add(Math.cos(angle), Math.sin(angle));
  }
  return hull(points);
}

export class MainSphere {
  constructor(canvas, preset = WEBSITE_SPHERE_PRESET) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    // Reuse the generator's axes, constrained sizes and preset. The site's
    // first version deliberately omits the live magnet and perspective.
    const scene = buildGlobalScene({ ...preset, magnetStrength: 0, showMagnetField: false });
    this.axes = scene.axes;
    this.radius = scene.sphereRadius;
    this.angularRadius = scene.elements[0].angularRadius;
    this.color = scene.settings.ellipseColor;
    this.rotation = 0;
    this.resize();
  }

  resize() {
    const size = Math.max(1, Math.round(this.canvas.getBoundingClientRect().width * Math.min(devicePixelRatio || 1, 2)));
    if (this.canvas.width !== size || this.canvas.height !== size) {
      this.canvas.width = size;
      this.canvas.height = size;
    }
    this.draw(this.rotation);
  }

  draw(degrees) {
    this.rotation = degrees;
    const context = this.context;
    const scale = this.canvas.width / ARTBOARD_SIZE;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, ARTBOARD_SIZE, ARTBOARD_SIZE);
    context.fillStyle = this.color;
    const angle = degrees * Math.PI / 180;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    context.beginPath();
    for (const axis of this.axes) {
      for (const side of [1, -1]) {
        // Screen Y rotation, matching worldRotationForScreenSettings.
        const normal = {
          x: axis.x * side,
          y: (axis.y * cosine - axis.z * sine) * side,
          z: (axis.y * sine + axis.z * cosine) * side
        };
        const cap = projectCap(normal, this.radius, this.angularRadius);
        if (!cap.visible) continue;
        if (cap.whole) {
          context.moveTo(cap.x + Math.cos(cap.angle) * cap.major,
            cap.y + Math.sin(cap.angle) * cap.major);
          context.ellipse(cap.x, cap.y, cap.major, cap.minor, cap.angle, 0, TAU);
        } else {
          const points = horizonCap(normal, this.angularRadius, this.radius);
          if (points.length < 3) continue;
          context.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
        }
        context.closePath();
      }
    }
    context.fill();
  }
}
