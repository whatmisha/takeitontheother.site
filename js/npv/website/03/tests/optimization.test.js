import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGlobalScene as originalLogo} from '../../../src/geometry/globalGeometry.js';
import {buildGlobalScene as optimizedLogo} from '../runtime/geometry/globalGeometry.js';
import {SEEDED_PRESETS} from '../runtime/core/presets.js';
import {createWebsiteSphereLayout as originalLayout} from '../../02/sphere-layout.js';
import {createWebsiteSphereLayout} from '../sphere-layout.js';
import {buildFlatLayout,buildFlatScene} from '../runtime/geometry/flatGeometry.js';
import {buildFlatScene as originalFlat} from '../../../src/geometry/flatGeometry.js';
import {talentSettings} from '../talent-surface.js';
import {MainSphere} from '../sphere-renderer.js';
import {LayoutCache} from '../layout-cache.js';
import {LayoutClient} from '../layout-client.js';
import {Story} from '../story.js';

test('lazy generator produces exactly the same animated logo paths',()=>{
  for(const rotationY of [0,15,57,90,135,180]) {
    const settings=SEEDED_PRESETS['Person Five'];
    const paths=scene=>scene.elements.map(e=>e.frontPath);
    assert.deepEqual(paths(optimizedLogo(settings,{rotationY})),paths(originalLogo(settings,{rotationY})));
  }
});

test('worker layout retains every original point at mobile and desktop sizes',()=>{
  for(const width of [561.6,1108])assert.deepEqual(createWebsiteSphereLayout(width),originalLayout(width));
});

test('reusing the flat grid preserves every cursor pose without mutating its base',()=>{
  const settings=talentSettings(714,768);
  const layout=buildFlatLayout(settings), before=structuredClone(layout);
  for(const field of [{x:0,y:0},{x:-250,y:140},{x:300,y:-300}]) {
    const cached=buildFlatScene(settings,{layout,transientField:field});
    assert.deepEqual(cached,originalFlat(settings,{transientField:field}));
  }
  assert.deepEqual(layout,before);
});

test('width cache is bounded, reuses geometry and masks, and evicts the oldest width',()=>{
  const cache=new LayoutCache(2);
  const first=cache.get(160);
  const masks=cache.masks(first);
  cache.get(180);
  assert.equal(cache.get(160),first);
  assert.equal(cache.masks(first),masks);
  cache.get(200);
  assert.deepEqual([...cache.entries.keys()],[160,200]);
});

test('renderer rejects both old layouts and old masks after a resize',()=>{
  let width=480;
  const context=new Proxy({}, {get:()=>()=>{}});
  const sphere=new MainSphere({getContext:()=>context,getBoundingClientRect:()=>({width}),width:0,height:0});
  const version=sphere.layoutVersion, layout=createWebsiteSphereLayout(width);
  width=500;sphere.resize();
  assert.equal(sphere.setLayout(layout,version),false);
  assert.equal(sphere.setGeography({land:new Float32Array(layout.axes.length*2)},version),false);
  assert.equal(sphere.setLayout(createWebsiteSphereLayout(width),sphere.layoutVersion),true);
});

test('worker queue coalesces rapid resizes and transfers complete coordinates',()=>{
  const previous=globalThis.Worker, sent=[], layouts=[];
  class WorkerStub {postMessage(data){sent.push(data);} terminate(){}}
  globalThis.Worker=WorkerStub;
  try {
    const client=new LayoutClient((layout,version)=>layouts.push({layout,version}),()=>{});
    client.request({version:1,cssSize:480});
    client.request({version:2,cssSize:500});
    client.request({version:3,cssSize:600});
    assert.equal(sent.length,1);
    client.worker.onmessage({data:{type:'layout',version:1,settings:{sphereRadius:224},coordinates:new Float64Array([0,0,1])}});
    assert.deepEqual(layouts[0].layout.axes,[{x:0,y:0,z:1}]);
    client.worker.onmessage({data:{type:'geography',version:1,masks:{}}});
    assert.deepEqual(sent,[{version:1,cssSize:480},{version:3,cssSize:600}]);
  }finally{if(previous===undefined)delete globalThis.Worker;else globalThis.Worker=previous;}
});

test('multiple scroll events are rendered once per shared frame, with no text damping',()=>{
  let requested=0,updates=0;
  const story={scheduleFrame:()=>requested++,dirty:false,update(){updates++;this.dirty=false;}};
  Story.prototype.invalidate.call(story);Story.prototype.invalidate.call(story);
  Story.prototype.flush.call(story);Story.prototype.flush.call(story);
  assert.equal(updates,1);assert.equal(requested,2);
});
