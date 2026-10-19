import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANET_REGIONS } from '../planet-regions.js';
import { buildPlanetMasks } from '../planet-masks.js';
import { geographicToSurface, COUNTRY_BY_ID } from '../../../src/geometry/planetGeography.js';
import { axisRotation, focusLift, orientationDistance, planetProgress, regionOrientation, rotationMatrix, slerp } from '../planet-motion.js';
import { MainSphere } from '../sphere-renderer.js';
import { PlanetExperience } from '../planet-experience.js';

const rotate = (point, orientation) => {
  const m = rotationMatrix(orientation);
  return { x: m[0]*point.x+m[1]*point.y+m[2]*point.z,
    y: m[3]*point.x+m[4]*point.y+m[5]*point.z,
    z: m[6]*point.x+m[7]*point.y+m[8]*point.z };
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} vs ${expected}`);

for (const [id, region] of Object.entries(PLANET_REGIONS)) {
  test(`${id} focuses its geographic center inside both desktop and mobile crops`, () => {
    for (const [size, centerY, panelHeight] of [[1108, 663, 768], [561.6, 422, 422]]) {
      const radius = size * 224 / 480;
      const lift = focusLift(centerY, radius, 0, panelHeight);
      const orientation = regionOrientation(region.longitude, region.latitude, lift);
      const center = rotate(geographicToSurface(region.longitude, region.latitude), orientation);
      near(center.x, 0);
      near(centerY + center.y * radius, panelHeight * .62);
      assert.ok(center.z > .75, 'region faces the viewer');
      const north = rotate(geographicToSurface(region.longitude, region.latitude + 1), orientation);
      assert.ok(north.y < center.y, 'north stays up');
    }
  });
}

test('region turns take the short path and can be interrupted without a jump', () => {
  const start = axisRotation(1, 350);
  const end = axisRotation(1, 10);
  const halfway = slerp(start, end, .5);
  near(orientationDistance(halfway, axisRotation(1, 0)), 0);
  const newTarget = regionOrientation(-98, 39, 20);
  near(orientationDistance(slerp(halfway, newTarget, 0), halfway), 0);
  near(orientationDistance(slerp(halfway, newTarget, 1), newTarget), 0);
  for (let t = 0; t <= 1; t += .1) near(Math.hypot(...slerp(halfway, newTarget, t)), 1);
});

test('land fades in as Who enters the visible text area, and fades back on return', () => {
  for (const [top, height] of [[84, 768], [422, 844]]) {
    assert.equal(planetProgress(height, top, height), 0);
    assert.equal(planetProgress(top, top, height), 1);
    const values = [0, .25, .5, .75, 1].map(t => planetProgress(height - (height - top) * t, top, height));
    for (let i = 1; i < values.length; i++) assert.ok(values[i] >= values[i - 1]);
    assert.ok(values.some(value => value > 0 && value < 1));
    assert.equal(planetProgress(height + 100, top, height), 0);
  }
});

test('website region masks distinguish USA, Britain and EU members from their neighbors and oceans', () => {
  // Include every country anchor so unrelated microstate fallbacks cannot claim
  // these test points on a deliberately tiny lattice.
  const locations = [[-98,39], [-2,54], [13,52], [9,62], [8,47], [-40,0], [151,-25]];
  const axes = [...locations.map(point => geographicToSurface(...point)),
    ...[...COUNTRY_BY_ID.values()].flatMap(country => country.anchors.map(point => geographicToSurface(...point)))];
  const masks = buildPlanetMasks(axes);
  assert.equal(masks.land.length, axes.length * 2);
  assert.deepEqual(locations.map((_,i) => masks.land[i*2]), [1,1,1,1,1,0,1]);
  assert.deepEqual(locations.map((_,i) => masks.regions.us[i*2]), [1,0,0,0,0,0,0]);
  assert.deepEqual(locations.map((_,i) => masks.regions.uk[i*2]), [0,1,0,0,0,0,0]);
  assert.deepEqual(locations.map((_,i) => masks.regions.eu[i*2]), [0,0,1,0,0,0,0]);
  assert.equal(new Set(PLANET_REGIONS.eu.countries).size, 27);
  assert.ok(PLANET_REGIONS.eu.countries.every(id => COUNTRY_BY_ID.has(id)));
});

test('land and region sizes stay on their surface point through rotation; stale resize masks are rejected', () => {
  let width = 480;
  const radii = [];
  const context = { setTransform() {}, clearRect() { radii.length = 0; }, beginPath() {},
    moveTo() {}, lineTo() {}, closePath() {}, fill() {}, ellipse(x,y,r) { radii.push(r); } };
  const canvas = { width: 0, height: 0, getContext: () => context,
    getBoundingClientRect: () => ({ width }) };
  const sphere = new MainSphere(canvas);
  // A land point in front, an ocean point on its antipode.
  sphere.axes = [{x:0,y:0,z:1}];
  const version = sphere.layoutVersion;
  const masks = { land: new Float32Array([1,0]), regions: { us: new Float32Array([1,0]) } };
  assert.equal(sphere.setGeography(masks, version), true);
  const frame = { orientation: axisRotation(0,0), land: 0, regions: {us:0} };
  sphere.drawFrame(frame);
  near(radii[0]*2, 4);
  sphere.drawFrame({...frame, land:1});
  assert.ok(radii[0]*2 > 6.99 && radii[0]*2 <= 7);
  sphere.drawFrame({...frame, land:1, regions:{us:1}});
  assert.ok(radii[0]*2 > 9.79 && radii[0]*2 < 9.8);
  sphere.drawFrame({...frame, orientation:axisRotation(0,180), land:1, regions:{us:1}});
  near(radii[0]*2, 4, 'ocean antipode must not inherit country growth');
  width = 500;
  sphere.resize();
  assert.equal(sphere.geography, null);
  assert.equal(sphere.setGeography(masks, version), false);
});


test('touch toggles selection, keyboard focus supersedes hover, and Escape clears the preview', () => {
  const previousDocument = globalThis.document;
  const document = new EventTarget();
  globalThis.document = document;
  const emit = (target, type, props = {}) => {
    const event = new Event(type);
    Object.assign(event, props);
    target.dispatchEvent(event);
  };
  try {
    const buttons = ['us','uk','eu'].map(id => Object.assign(new EventTarget(), {
      dataset: {region:id}, matches: () => true
    }));
    const experience = { buttons, hovered:null, focused:null, pinned:null, sync() {} };
    PlanetExperience.prototype.bindRegions.call(experience);
    emit(buttons[0], 'pointerenter', {pointerType:'touch'});
    assert.equal(experience.hovered, null);
    emit(buttons[0], 'pointerdown', {pointerType:'touch'});
    emit(buttons[0], 'click', {detail:1});
    assert.equal(experience.pinned, 'us');
    emit(buttons[0], 'click', {detail:1});
    assert.equal(experience.pinned, null);
    emit(buttons[0], 'pointerenter', {pointerType:'mouse'});
    assert.equal(experience.hovered, 'us');
    emit(buttons[1], 'focus');
    assert.equal(experience.hovered, null);
    assert.equal(experience.focused, 'uk');
    emit(document, 'keydown', {key:'Escape'});
    assert.equal(experience.focused, null);
    emit(buttons[2], 'pointerdown', {pointerType:'touch'});
    emit(buttons[2], 'click', {detail:1});
    document.closest = () => null;
    emit(document, 'pointerdown');
    assert.equal(experience.pinned, null);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('preview animation settles, releases its frame loop, and reduced motion updates immediately', () => {
  const previousDocument = globalThis.document;
  const previousRaf = globalThis.requestAnimationFrame;
  const callbacks = [];
  globalThis.document = {hidden:false};
  globalThis.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
  const makeState = () => ({
    current:{orientation:axisRotation(0,0),land:0,regions:{us:0,uk:0,eu:0}},
    target:{orientation:regionOrientation(-98,39,20),land:1,regions:{us:1,uk:0,eu:0}},
    reducedMotion:{matches:false}, sphere:{drawFrame(){}}, lastTime:0, frame:0,
    animate:PlanetExperience.prototype.animate
  });
  try {
    const experience = makeState();
    let time = 16;
    experience.animate(time);
    while (callbacks.length && time < 5000) { time += 16; callbacks.shift()(time); }
    assert.equal(callbacks.length, 0, 'stop rendering once the transition settles');
    near(orientationDistance(experience.current.orientation, experience.target.orientation), 0);
    assert.equal(experience.current.land, 1);
    assert.equal(experience.current.regions.us, 1);
    const reduced = makeState();
    reduced.reducedMotion.matches = true;
    reduced.animate(16);
    assert.equal(callbacks.length, 0);
    near(orientationDistance(reduced.current.orientation, reduced.target.orientation), 0);
    assert.equal(reduced.current.land, 1);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousRaf === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previousRaf;
  }
});
