import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FloraFieldPool} from '../flora-field-pool.js';
import {defaults,switchMode} from '../document.js';
import {motionFrame} from '../motion.js';
import {getLayers} from '../layer-data.js';
import {createLayerScene} from '../scene.js';
import {bakeFlora} from '../flora-field.js';
import {FLOWER_MOTION} from '../flower-motion.js';
const fixtures=JSON.parse(await readFile(new URL('./motion-field-baselines.json',import.meta.url)));
// Distance-only hashes were extracted from the original full RGBA fixtures.
const distance=f=>Uint8Array.from({length:f.width*f.height*2},(_,i)=>f.pixels[Math.floor(i/2)*4+i%2]);
const hash=b=>createHash('sha256').update(b).digest('hex');
test('moving contours and colors match original animation bytes for every flower type',()=>{
 for(const f of fixtures){const s=motionFrame({...switchMode(defaults,'f'),width:1920,height:1080,motionAmount:6,fType:f.type},f.phase),field=bakeFlora(getLayers(s)[0],s);
  assert.equal(field.width,f.width);assert.equal(field.height,f.height);assert.equal(hash(distance(field)),f.distance);assert.equal(hash(field.colors),f.colors);}
});
class FakeWorker extends EventTarget {
 constructor(){super();this.messages=[];this.terminated=false;}
 postMessage(data){this.messages.push(data);}
 reply(patch={}){const last=this.messages.at(-1);this.dispatchEvent(new MessageEvent('message',{data:{id:last.id,fields:last.entries.map(e=>({index:e.index,key:e.layer.id})),...patch}}));}
 terminate(){this.terminated=true;}
}
function setup(){const workers=[];return {workers,pool:new FloraFieldPool({enabled:true,concurrency:4,createWorker:()=>{const w=new FakeWorker();workers.push(w);return w;}})};}
const scene=Array.from({length:8},(_,i)=>({id:'f'+i,flora:{generator:'flower'},info:[0,0,i===3?0:1],...(i===2?{[FLOWER_MOTION]:{angle:1,amount:.06}}:{})}));
test('worker batches are bounded, preserve indices/runtime poses, and skip invisible objects',async()=>{
 const {pool,workers}=setup(),result=pool.prepare(scene,{});assert.equal(workers.length,4);
 assert.equal(workers.reduce((n,w)=>n+w.messages[0].entries.length,0),7);
 assert.deepEqual(workers.flatMap(w=>w.messages[0].entries).find(e=>e.index===2).motion,{angle:1,amount:.06});
 for(const w of [...workers].reverse())w.reply();const fields=await result;
 assert.equal(fields[3],null);assert.equal(fields[7].key,'f7');assert.ok(workers.every(w=>w.messages[0].cacheBudget===24*1024*1024));pool.destroy();
});
test('cancel immediately terminates workers; stale responses cannot affect a new request',async()=>{
 const {pool,workers}=setup(),controller=new AbortController(),first=pool.prepare(scene,{}, {signal:controller.signal});controller.abort();
 await assert.rejects(first,{name:'AbortError'});assert.ok(workers.every(w=>w.terminated));
 const next=pool.prepare(scene,{});for(const w of workers.slice(0,4))w.reply();for(const w of workers.slice(4))w.reply();assert.equal((await next)[0].key,'f0');pool.destroy();
});
test('a renderer does not build an unbounded queue; destroy rejects pending work',async()=>{
 const {pool}=setup(),pending=pool.prepare(scene,{});await assert.rejects(pool.prepare(scene,{}),/already/);pool.destroy();await assert.rejects(pending,{name:'AbortError'});await assert.rejects(pool.prepare(scene,{}),/closed/);
});
test('calculation errors propagate; only infrastructure failure uses the fallback',async()=>{
 const {pool,workers}=setup(),pending=pool.prepare(scene,{});workers[0].reply({error:'Bad shape'});await assert.rejects(pending,/Bad shape/);assert.equal(pool.enabled,true);pool.destroy();
 const fallback=new FloraFieldPool({enabled:true,createWorker:()=>{throw Error('blocked');}});
 const settings=switchMode(defaults,'f'),realScene=createLayerScene(settings);
 const actual=await fallback.prepare(realScene,settings);assert.equal(fallback.enabled,false);assert.deepEqual(actual[0].pixels,bakeFlora(realScene[0],settings).pixels);fallback.destroy();
});
test('an isolated editor pass can prepare a hidden flower',async()=>{
 const {pool,workers}=setup(),pending=pool.prepare(scene,{}, {editorPass:5});assert.equal(workers.length,1);assert.equal(workers[0].messages[0].entries[0].index,3);workers[0].reply();const fields=await pending;assert.equal(fields[3].key,'f3');assert.equal(fields.filter(Boolean).length,1);pool.destroy();
});

test('a worker load error disables workers and completes the frame synchronously',async()=>{
 const {pool,workers}=setup(),settings=switchMode(defaults,'f'),scene=createLayerScene(settings),pending=pool.prepare(scene,settings);
 workers[0].dispatchEvent(new Event('error',{cancelable:true}));const fields=await pending;
 assert.equal(pool.enabled,false);assert.deepEqual(fields[0].colors,bakeFlora(scene[0],settings).colors);pool.destroy();
});

test('a non-responsive worker times out and a fresh batch can restart',async()=>{
 const {pool,workers}=setup();pool.timeoutMs=10;
 await assert.rejects(pool.prepare(scene,{}),/timed out/);assert.equal(pool.active,null);assert.ok(workers.every(w=>w.terminated));
 const pending=pool.prepare(scene,{});for(const w of workers.slice(4))w.reply();assert.equal((await pending)[0].key,'f0');pool.destroy();
});
