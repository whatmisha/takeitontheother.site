import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGlobalScene } from '../../../src/geometry/globalGeometry.js';
import { projectCap, WEBSITE_SPHERE_PRESET } from '../sphere-renderer.js';

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
