import test from 'node:test';
import assert from 'node:assert/strict';
import { axesForSettings, buildGlobalScene } from '../../../src/geometry/globalGeometry.js';
import { createWebsiteSpherePreset, projectCap, WEBSITE_SPHERE_PRESET } from '../sphere-renderer.js';

const preset = WEBSITE_SPHERE_PRESET;

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

// Measure the physical boundary gap independently of the generator's limit
// calculation. Absolute dot products include the opposite side of each pair.
function minimumSurfaceGap(settings) {
  const axes = axesForSettings(settings);
  let closestDot = -1;
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const a = axes[i];
      const b = axes[j];
      closestDot = Math.max(closestDot, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z));
    }
  }
  const separation = Math.acos(Math.min(1, closestDot));
  const angularDiameter = 2 * Math.asin(settings.diameter / (2 * settings.sphereRadius));
  return (separation - angularDiameter) * settings.sphereRadius;
}

test('website density fills Main Draft while preserving diameter 4 and surface gap 6', () => {
  const scene = buildGlobalScene(preset);
  assert.equal(scene.settings.diameter, 4);
  assert.equal(scene.settings.overlapGap, 6);
  assert.equal(scene.axes.length, preset.ellipseCount);
  assert.ok(scene.elements.every(mark => Math.abs(2 * scene.sphereRadius * Math.sin(mark.angularRadius) - 4) < 1e-9));
  assert.ok(minimumSurfaceGap(preset) >= 6 - 1e-9);
  assert.ok(minimumSurfaceGap({ ...preset, ellipseCount: preset.ellipseCount + 1 }) < 6);
});

test('density responds to sphere size, diameter and gap instead of a preset count', () => {
  const smallerSphere = createWebsiteSpherePreset({ sphereRadius: 180 });
  const largerSphere = createWebsiteSpherePreset({ sphereRadius: 240 });
  const largerMarks = createWebsiteSpherePreset({ diameter: 6 });
  const widerGap = createWebsiteSpherePreset({ overlapGap: 8 });
  assert.ok(smallerSphere.ellipseCount < preset.ellipseCount);
  assert.ok(largerSphere.ellipseCount > preset.ellipseCount);
  assert.ok(largerMarks.ellipseCount < preset.ellipseCount);
  assert.ok(widerGap.ellipseCount < preset.ellipseCount);
  for (const settings of [smallerSphere, largerSphere, largerMarks, widerGap]) {
    assert.ok(minimumSurfaceGap(settings) >= settings.overlapGap - 1e-9);
    assert.ok(minimumSurfaceGap({ ...settings, ellipseCount: settings.ellipseCount + 1 }) < settings.overlapGap);
  }
});
