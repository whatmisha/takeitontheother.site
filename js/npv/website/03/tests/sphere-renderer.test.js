import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTBOARD_SIZE, buildGlobalScene } from '../../../src/geometry/globalGeometry.js';
import { SEEDED_PRESETS } from '../../../src/core/presets.js';
import { MainSphere, projectCap } from '../sphere-renderer.js';
import { createWebsiteSphereLayout } from '../sphere-layout.js';

const preset = SEEDED_PRESETS['Main Draft'];

for (const degrees of [0, 31, 90, 180]) {
  test(`Website sphere analytic projection matches the original generator at ${degrees} degrees`, () => {
    const scene = buildGlobalScene(preset, { rotationY: degrees });
    const angle = degrees * Math.PI / 180;
    let compared = 0;
    for (const mark of scene.elements) {
      const source = scene.axes[mark.pairIndex];
      const normal = {
        x: source.x * mark.side,
        y: (source.y * Math.cos(angle) - source.z * Math.sin(angle)) * mark.side,
        z: (source.y * Math.sin(angle) + source.z * Math.cos(angle)) * mark.side
      };
      const cap = projectCap(normal, scene.sphereRadius, mark.angularRadius);
      if (!cap.whole) continue;
      const rx = Math.hypot(cap.major * Math.cos(cap.angle), cap.minor * Math.sin(cap.angle));
      const ry = Math.hypot(cap.major * Math.sin(cap.angle), cap.minor * Math.cos(cap.angle));
      // The source approximates each ellipse with a 96-vertex polygon.
      for (const [actual, expected] of [[cap.x, mark.cx], [cap.y, mark.cy], [rx, mark.rx], [ry, mark.ry]]) {
        assert.ok(Math.abs(actual - expected) < .003, `${actual} vs ${expected}`);
      }
      compared++;
    }
    assert.ok(compared > preset.ellipseCount * .9);
  });
}

test('caps crossing the horizon are distinguished from front and back caps', () => {
  const radius = 230;
  const angularRadius = .01;
  assert.equal(projectCap({x:0,y:0,z:1}, radius, angularRadius).whole, true);
  assert.equal(projectCap({x:0,y:0,z:-1}, radius, angularRadius).visible, false);
  const limb = projectCap({x:1,y:0,z:0}, radius, angularRadius);
  assert.equal(limb.visible, true);
  assert.equal(limb.whole, false);
});

// Independent nearest-neighbor check using a sorted sweep, including both
// hemispheres. It does not reuse the layout generator's spatial hash.
function minimumSurfaceGap(layout, cssSize) {
  const points = layout.axes.flatMap(axis => [axis, { x: -axis.x, y: -axis.y, z: -axis.z }])
    .sort((a, b) => a.z - b.z);
  let closestSquared = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    for (let j = i + 1; j < points.length; j++) {
      const b = points[j];
      const dz = b.z - a.z;
      if (dz * dz > closestSquared) break;
      closestSquared = Math.min(closestSquared, (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + dz * dz);
    }
  }
  const separation = 2 * Math.asin(Math.sqrt(closestSquared) / 2);
  return (separation - 2 * layout.angularRadius) * layout.sphereRadius * cssSize / ARTBOARD_SIZE;
}

for (const cssSize of [480, 561.6, 1108, 1331.46]) {
  test(`displayed sphere at ${cssSize}px keeps a 4px diameter and at least 6px surface gap`, () => {
    const layout = createWebsiteSphereLayout(cssSize);
    const actualDiameter = 2 * layout.sphereRadius * Math.sin(layout.angularRadius) * cssSize / ARTBOARD_SIZE;
    assert.ok(Math.abs(actualDiameter - 4) < 1e-9);
    const gap = minimumSurfaceGap(layout, cssSize);
    assert.ok(gap >= 6 - 1e-8, `minimum gap: ${gap}`);
    assert.ok(gap < 6.02, `the field should fill down to the requested gap: ${gap}`);
    if (cssSize >= 1108) assert.ok(layout.axes.length > 8192, 'website density must exceed the editor cap when needed');
  });
}

test('larger spheres gain dots rather than enlarging them', () => {
  const small = createWebsiteSphereLayout(561.6);
  const large = createWebsiteSphereLayout(1108);
  assert.ok(large.axes.length > small.axes.length * 3);
});

test('scroll and DPR changes reuse the layout; width changes keep a 4px rendered diameter', () => {
  const previousDpr = globalThis.devicePixelRatio;
  let cssSize = 1108;
  const context = {
    scale: 1,
    maximumRadius: 0,
    setTransform(scale) { this.scale = scale; },
    clearRect() { this.maximumRadius = 0; },
    ellipse(x, y, major) { this.maximumRadius = Math.max(this.maximumRadius, major); },
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: cssSize })
  };
  const renderedDiameter = () => context.maximumRadius * 2 * context.scale * cssSize / canvas.width;
  try {
    globalThis.devicePixelRatio = 1;
    const sphere = new MainSphere(canvas);
    sphere.setLayout(createWebsiteSphereLayout(cssSize),sphere.layoutVersion);
    sphere.drawFrame(sphere.frame);
    const initialAxes = sphere.axes;
    assert.ok(Math.abs(renderedDiameter() - 4) < 1e-9);
    sphere.draw(73);
    assert.equal(sphere.axes, initialAxes);
    globalThis.devicePixelRatio = 2;
    sphere.resize();
    assert.equal(sphere.axes, initialAxes);
    assert.equal(canvas.width, 2216);
    assert.ok(Math.abs(renderedDiameter() - 4) < 1e-9);
    cssSize = 1331.46;
    sphere.resize();
    sphere.setLayout(createWebsiteSphereLayout(cssSize),sphere.layoutVersion);
    sphere.drawFrame(sphere.frame);
    assert.notEqual(sphere.axes, initialAxes);
    assert.equal(sphere.rotation, 73);
    assert.ok(Math.abs(renderedDiameter() - 4) < 1e-9);
  } finally {
    if (previousDpr === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = previousDpr;
  }
});
