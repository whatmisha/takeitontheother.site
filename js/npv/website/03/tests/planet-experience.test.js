import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANET_REGIONS } from '../planet-regions.js';
import { buildPlanetMasks } from '../planet-masks.js';
import { geographicToSurface, COUNTRY_BY_ID } from '../../../src/geometry/planetGeography.js';
import { axisRotation, focusLift, orientationDistance, planetProgress, regionOrientation, rotationMatrix, slerp } from '../planet-motion.js';
import { MainSphere } from '../sphere-renderer.js';
import { PlanetExperience } from '../planet-experience.js';
import { storyAt, storyLayout } from '../story-timeline.js';

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
  assert.ok(radii[0]*2 > 12.59 && radii[0]*2 < 12.6);
  sphere.drawFrame({...frame, orientation:axisRotation(0,180), land:1, regions:{us:1}});
  assert.ok(radii[0]*2 > 3.2 && radii[0]*2 < 3.201, 'ocean shrinks and does not inherit country growth');
  sphere.drawFrame({...frame, orientation:axisRotation(0,180), land:0});
  near(radii[0]*2, 4);
  sphere.drawFrame({...frame, orientation:axisRotation(0,180), land:.5});
  assert.ok(radii[0]*2 > 3.6 && radii[0]*2 < 3.601, 'ocean contracts continuously during the transition');
  width = 500;
  sphere.resize();
  assert.equal(sphere.geography, null);
  assert.equal(sphere.setGeography(masks, version), false);
});


test('region clicks persist selection while hover, keyboard and Escape only change the preview', () => {
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
    const experience = { buttons, hovered:null, focused:null, selectedRegion:'us', sync() {} };
    PlanetExperience.prototype.bindRegions.call(experience);
    emit(buttons[0], 'pointerenter', {pointerType:'touch'});
    assert.equal(experience.hovered, null);
    emit(buttons[0], 'pointerdown', {pointerType:'touch'});
    emit(buttons[0], 'click', {detail:1});
    assert.equal(experience.selectedRegion, 'us');
    emit(buttons[0], 'click', {detail:1});
    assert.equal(experience.selectedRegion, 'us');
    emit(buttons[0], 'pointerenter', {pointerType:'mouse'});
    assert.equal(experience.hovered, 'us');
    emit(buttons[1], 'focus');
    assert.equal(experience.hovered, null);
    assert.equal(experience.focused, 'uk');
    assert.equal(experience.selectedRegion, 'us', 'keyboard preview does not change the selection');
    emit(buttons[1], 'click', {detail:0});
    assert.equal(experience.selectedRegion, 'uk');
    emit(document, 'keydown', {key:'Escape'});
    assert.equal(experience.focused, null);
    assert.equal(experience.selectedRegion, 'uk', 'Escape ends preview but keeps the selected region');
    emit(buttons[2], 'pointerdown', {pointerType:'touch'});
    emit(buttons[2], 'click', {detail:1});
    document.closest = () => null;
    emit(document, 'pointerdown');
    assert.equal(experience.selectedRegion, 'eu', 'outside click preserves the selection');
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


test('the surface transition settles at both ends and resumes the current sphere pose on return', () => {
  const previousDocument=globalThis.document, previousRaf=globalThis.requestAnimationFrame;
  const callbacks=[];
  globalThis.document={hidden:false};
  globalThis.requestAnimationFrame=callback=>{callbacks.push(callback);return callbacks.length;};
  const plain={orientation:axisRotation(0,0),land:0,flat:0,regions:{us:0,uk:0,eu:0}};
  const destination={orientation:regionOrientation(-25,20,20),land:1,flat:1,regions:{us:0,uk:0,eu:0}};
  const surface={active:false,draw(frame){
    if (frame.flat>0 && !this.active) {
      this.orientation=[...frame.orientation];
      this.entryFrame={land:frame.land,regions:{...frame.regions}};
    }
    this.active=frame.flat>0;
    return false;
  }};
  const experience={current:structuredClone(plain),target:structuredClone(destination),
    reducedMotion:{matches:false},surface,sphere:{drawFrame(){}},lastTime:0,frame:0,
    animate:PlanetExperience.prototype.animate,
    sync(){this.target=structuredClone(plain);}};
  let time=0;
  const finish=()=>{
    experience.animate(time+=16);
    let frames=0;
    while(callbacks.length && frames++<500) callbacks.shift()(time+=16);
    assert.equal(callbacks.length,0,'no permanent animation loop once the pose settles');
  };
  try {
    finish();
    assert.equal(experience.current.flat,1);
    assert.equal(surface.active,true);
    experience.target.flat=0;
    finish();
    assert.equal(surface.active,false);
    assert.equal(experience.current.flat,0);
    assert.equal(experience.current.land,0);
    near(orientationDistance(experience.current.orientation,plain.orientation),0);
  } finally {
    if(previousDocument===undefined) delete globalThis.document; else globalThis.document=previousDocument;
    if(previousRaf===undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame=previousRaf;
  }
});


test('Who reveals US without a second turn, and resets its selection on a new visit', () => {
  const names = ['document', 'scrollY', 'innerWidth', 'innerHeight'];
  const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]));
  globalThis.document = {body:{classList:{toggle(){}}}};
  globalThis.scrollY = 768;
  globalThis.innerWidth = 1440;
  globalThis.innerHeight = 768;
  const buttons = ['us','uk','eu'].map(region => ({dataset:{region},
    classList:{toggle(name, value){this.active=value;}}, setAttribute(name,value){this[name]=value;}}));
  const experience = {
    sphere:{geography:{},radius:224,canvas:{getBoundingClientRect:()=>({top:109,width:1108,height:1108})}},
    panel:{getBoundingClientRect:()=>({top:0,width:714,height:768,bottom:768})},
    heading:{getBoundingClientRect:()=>({top:292})},
    copy:{getBoundingClientRect:()=>({top:292,bottom:525})},
    reducedMotion:{matches:false}, buttons, selectedRegion:'eu', hovered:null, focused:null,
    sync:PlanetExperience.prototype.sync, setStoryState:PlanetExperience.prototype.setStoryState, schedule(){}
  };
  try {
    experience.setStoryState({active:0,land:0,flat:0});
    assert.equal(experience.selectedRegion,'us');
    const alignedWithoutLand = [...experience.target.orientation];
    assert.equal(experience.target.regions.us,0);
    experience.setStoryState({active:0,land:.25,flat:0});
    assert.equal(experience.target.land,.25,'default selection does not force an abrupt land reveal');
    assert.equal(experience.target.regions.us,.25);
    experience.setStoryState({active:1,land:1,flat:0});
    const lift=focusLift(663,224*1108/480,0,768);
    const us=PLANET_REGIONS.us;
    near(orientationDistance(experience.target.orientation,regionOrientation(us.longitude,us.latitude,lift)),0);
    near(orientationDistance(experience.target.orientation,alignedWithoutLand),0);
    assert.deepEqual(experience.target.orientation,alignedWithoutLand,'revealing land does not change the camera pose');
    assert.equal(experience.target.regions.us,1);
    assert.deepEqual(buttons.map(button=>button['aria-pressed']),['true','false','false']);
    experience.hovered='uk';
    experience.sync();
    assert.equal(experience.target.regions.uk,1);
    assert.equal(buttons[0].classList.active,true,'hover preview leaves the selected item underlined');
    experience.hovered=null;
    experience.sync();
    assert.equal(experience.target.regions.us,1,'leaving a preview restores the selected country');
    experience.selectedRegion='eu';
    experience.setStoryState({active:1,land:1,flat:0});
    assert.equal(experience.target.regions.eu,1,'selection persists while reading Who');
    experience.setStoryState({active:2,land:1,flat:1});
    experience.setStoryState({active:1,land:1,flat:0});
    assert.equal(experience.target.regions.us,1,'returning from the third scene starts at US');
  } finally {
    for (const name of names) {
      if (previous[name]===undefined) delete globalThis[name]; else globalThis[name]=previous[name];
    }
  }
});


test('entry rotation is vertical only and US is already in place before the first land appears', () => {
  const names=['document','scrollY','innerWidth','innerHeight'];
  const previous=Object.fromEntries(names.map(name=>[name,globalThis[name]]));
  globalThis.document={body:{classList:{toggle(){}}}};
  const home=PLANET_REGIONS.us;
  const point=geographicToSurface(home.longitude,home.latitude);
  try {
    for(const [width,height,panelHeight,canvasWidth,canvasTop,heights] of [
      [1440,768,768,1108,109,[417,232,194]],
      [390,844,422,561.6,141.2,[402,232,335]]
    ]) {
      globalThis.innerWidth=width; globalThis.innerHeight=height;
      const mobile=width<768;
      const panelWidth=mobile?width:714;
      const layout=storyLayout(heights,height,mobile);
      const experience={
        sphere:{geography:{},radius:224,canvas:{getBoundingClientRect:()=>({top:canvasTop,width:canvasWidth,height:canvasWidth})},drawFrame(){}},
        panel:{getBoundingClientRect:()=>({top:0,width:panelWidth,height:panelHeight,bottom:panelHeight})},
        heading:{getBoundingClientRect:()=>({top:layout.scenes[1].anchor})},
        copy:{getBoundingClientRect:()=>({top:layout.scenes[1].anchor,bottom:layout.scenes[1].anchor+heights[1]})},
        reducedMotion:{matches:false},buttons:[],selectedRegion:'us',hovered:null,focused:null,
        sync:PlanetExperience.prototype.sync,setStoryState:PlanetExperience.prototype.setStoryState,schedule(){},
        initialPosePending:true,current:{orientation:axisRotation(0,0),land:0,regions:{}}
      };
      const lift=focusLift(canvasTop+canvasWidth/2,224*canvasWidth/480,0,panelHeight);
      const final=regionOrientation(home.longitude,home.latitude,lift);
      const horizontal=rotationMatrix(final).slice(0,3);
      let previousTurn=-Infinity, last;
      for(let step=0;step<=100;step++) {
        globalThis.scrollY=layout.scenes[1].start*step/100;
        const state=storyAt(scrollY,layout);
        experience.setStoryState(state);
        const pose=experience.target.orientation;
        rotationMatrix(pose).slice(0,3).forEach((value,i)=>near(value,horizontal[i]));
        near(rotate(point,pose).x,0);
        assert.ok(state.sphereTurn>=previousTurn,'scroll never reverses the vertical roll');
        previousTurn=state.sphereTurn;
        if(state.land>0) {
          near(orientationDistance(pose,final),0,'US needs no extra turn once land is visible');
          assert.ok(experience.target.regions.us>0,'US highlights with the first land');
        }
        if(step===0) near(orientationDistance(experience.current.orientation,pose),0);
        // The animation between adjacent targets must not introduce a side turn either.
        if(last) near(rotate(point,slerp(last,pose,.5)).x,0);
        last=pose;
      }
      near(orientationDistance(last,final),0);
      experience.sphere.geography=null;
      experience.sync();
      near(orientationDistance(experience.target.orientation,final),0,'late geography cannot move the camera');
    }
  } finally {
    for(const name of names) {
      if(previous[name]===undefined) delete globalThis[name]; else globalThis[name]=previous[name];
    }
  }
});
