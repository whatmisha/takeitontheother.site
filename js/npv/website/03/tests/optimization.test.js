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
import {MainSphere as OriginalSphere} from '../../02/sphere-renderer.js';
import {axisRotation} from '../planet-motion.js';
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

test('width cache is bounded, reuses geometry and masks, and evicts the oldest width',async()=>{
  const cache=new LayoutCache(2);
  const first=cache.get(160);
  const masks=await cache.masks(first);
  cache.get(180);
  assert.equal(cache.get(160),first);
  assert.equal(await cache.masks(first),masks);
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


test('optimized renderer emits the same visible ellipses as version 02',()=>{
  const makeCanvas=()=>{
    const ellipses=[];
    const ctx={setTransform(){},clearRect(){ellipses.length=0;},beginPath(){},moveTo(){},
      lineTo(){},closePath(){},fill(){},ellipse(...args){ellipses.push(args);}};
    return {canvas:{width:0,height:0,getContext:()=>ctx,getBoundingClientRect:()=>({width:480})},ellipses};
  };
  const a=makeCanvas(),b=makeCanvas();
  const original=new OriginalSphere(a.canvas),optimized=new MainSphere(b.canvas);
  optimized.setLayout(createWebsiteSphereLayout(480),optimized.layoutVersion);
  const land=Float32Array.from({length:original.axes.length*2},(_,i)=>i%3===0?1:0);
  const us=Float32Array.from(land,(v,i)=>v&&i%2===0?1:0);
  original.setGeography({land,regions:{us}},original.layoutVersion);
  optimized.setGeography({land,regions:{us}},optimized.layoutVersion);
  for(const degrees of [0,31,90,180])for(const weight of [0,.4,1]){
    const frame={orientation:axisRotation(0,degrees),land:weight,regions:{us:weight}};
    original.drawFrame(frame);optimized.drawFrame(frame);
    assert.equal(a.ellipses.length,b.ellipses.length);
    a.ellipses.forEach((ellipse,i)=>ellipse.forEach((value,j)=>
      assert.ok(Math.abs(value-b.ellipses[i][j])<1e-9)));
  }
});

test('worker-unavailable fallback still delivers a matching layout and geography',async()=>{
  const previous=globalThis.Worker;
  globalThis.Worker=class{constructor(){throw new Error('Workers blocked');}};
  try{
    let delivered;
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('fallback timeout')),5000);
      const client=new LayoutClient((layout,version)=>{delivered={layout,version};},(masks,version)=>{
        try{assert.equal(version,7);assert.equal(masks.land.length,delivered.layout.axes.length*2);
          assert.equal(delivered.version,7);clearTimeout(timeout);resolve();}catch(error){clearTimeout(timeout);reject(error);}
      });
      client.request({version:7,cssSize:160});
    });
  }finally{if(previous===undefined)delete globalThis.Worker;else globalThis.Worker=previous;}
});
