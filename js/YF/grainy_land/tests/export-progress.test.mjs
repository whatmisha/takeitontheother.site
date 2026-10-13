import test from 'node:test';
import assert from 'node:assert/strict';
import {ExportProgress} from '../export-progress.js';
import {hoverPixels} from '../layer-hover.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(){
 const classes=new Set(),properties=new Map(),timers=[];
 const status={hidden:true,dataset:{},style:{setProperty:(key,value)=>properties.set(key,value)},setAttribute(){}};
 const cancelButton={addEventListener(_name,fn){this.click=fn;},removeEventListener(){}};
 const view=new ExportProgress({container:{classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key)}},status,progress:{},message:{},cancelButton,
  clock:{setTimeout(fn,delay){if(!delay){queueMicrotask(fn);return null;}timers.push(fn);return timers.length;},clearTimeout(){}}});
 return {view,classes,properties,status,cancelButton,restore:()=>timers.shift()?.()};
}
test('export surface shows real progress, prevents overlapping formats and restores after completion',async()=>{
 const f=fixture(),work=deferred();let update,calls=0;
 const pending=f.view.run({label:'MP4'},async({onProgress})=>{calls++;update=onProgress;return work.promise;});
 assert.equal(f.status.hidden,false);assert.equal(f.view.busy,true);assert.equal(f.view.message.textContent,'Preparing MP4');
 await Promise.resolve();await Promise.resolve();
 update({current:3,total:6,message:'MP4 · 3.0 / 6 s'});
 assert.equal(f.properties.get('--export-progress'),'50%');assert.equal(f.view.progress.value,3);
 await f.view.run({label:'PNG'},()=>{calls++;});assert.equal(calls,1);
 work.resolve('movie');assert.equal(await pending,'movie');assert.equal(f.status.dataset.state,'complete');assert.equal(f.cancelButton.hidden,true);
 f.restore();assert.equal(f.view.busy,false);assert.equal(f.status.hidden,true);assert.equal(f.classes.has('is-exporting'),false);f.view.destroy();
});
test('cancel aborts the renderer signal without reporting export failure, then permits retry',async()=>{
 const f=fixture();let jobSignal;
 const pending=f.view.run({label:'ZIP'},({signal})=>new Promise((resolve,reject)=>{jobSignal=signal;signal.addEventListener('abort',()=>reject(signal.reason));}));
 await Promise.resolve();await Promise.resolve();f.cancelButton.click();await pending;
 assert.equal(jobSignal.aborted,true);assert.equal(f.status.dataset.state,'cancelled');f.restore();
 assert.equal(await f.view.run({label:'PNG'},async()=>42),42);f.view.destroy();
});
test('export errors retain their explanation; destroying pending work cancels and hides feedback',async()=>{
 const f=fixture();await assert.rejects(f.view.run({label:'MP4'},async()=>{throw Error('Encoder unavailable');}),/Encoder unavailable/);
 assert.equal(f.status.dataset.state,'error');assert.equal(f.status.title,'Encoder unavailable');f.restore();
 const pending=f.view.run({label:'PNG'},({signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason))));
 await Promise.resolve();await Promise.resolve();f.view.destroy();await pending;assert.equal(f.status.hidden,true);
});
test('hover distinguishes object edges, interiors and background without changing the hit map',()=>{
 const map={width:5,height:5,ids:Uint8Array.from([0,0,0,0,0,0,4,4,4,0,0,4,4,4,0,0,4,4,4,0,0,0,0,0,0])},original=map.ids.slice();
 const pixels=hoverPixels(map);assert.equal(pixels[3],0);assert.equal(pixels[6*4+3],210);assert.equal(pixels[12*4+3],24);
 const background=hoverPixels(map,true);assert.equal(background[3],210);assert.equal(background[12*4+3],0);assert.deepEqual(map.ids,original);
});
