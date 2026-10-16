import {defaults,switchMode} from '../legacy-document.js';
import {normalizeSettings} from '../document.js?v=unified-document-1';
import {resizeObjects,addObject} from '../object-actions.js';
import {editLayer,getLayers} from '../layers.js';
import {createLayerScene} from '../scene.js';
import {bakeFlora} from '../flora-field.js?v=motion-perf-1';
import {FloraFieldPool} from '../flora-field-pool.js?v=motion-perf-1';
import {motionFrame} from '../motion.js?v=motion-perf-1';
import {LandscapeRenderer} from '../render.js?v=motion-perf-1';
const out=document.querySelector('#results'),log=[],renderer=new LandscapeRenderer(),pool=new FloraFieldPool();
const check=(name,ok)=>{log.push((ok?'PASS ':'FAIL ')+name);out.textContent=log.join('\n');if(!ok)throw Error(name);};
const base={...switchMode(defaults,'f'),width:1920,height:1080,motionAmount:6};
const pixels=surface=>{const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');ctx.drawImage(surface,0,0,640,360);return ctx.getImageData(0,0,640,360).data;};
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
try{
 for(const type of ['fan','cup','lobed','radial']){
  const s=motionFrame({...base,fType:type},.37),sync=pixels(renderer.render(s,640,360));
  const asyncRenderer=new LandscapeRenderer();
  try{const worker=pixels(await asyncRenderer.renderAsync(s,640,360));check(type+' worker pixels equal synchronous pixels',same(sync,worker));
    const expectedMap=renderer.formMap(s,160,90,0);
    check(type+' hover reuses prepared fields with the same contour',same(expectedMap.ids,asyncRenderer.formMap(s,160,90,0,asyncRenderer.preparedFrame).ids));}
  finally{asyncRenderer.destroy();}
 }
 let mixed=resizeObjects(base,'flower',4);mixed=addObject(mixed,'plant').settings;
 const flowers=getLayers(mixed).filter(l=>l.flora?.generator==='flower');mixed=editLayer(mixed,flowers[0].id,{visible:false});mixed=editLayer(mixed,flowers[1].id,{locked:true});
 const posed=motionFrame(mixed,.62),expected=pixels(renderer.render(posed,640,360)),other=new LandscapeRenderer();
 try{check('hidden, locked and Plant objects keep identical pixels',same(expected,pixels(await other.renderAsync(posed,640,360))));}finally{other.destroy();}
 for(const count of [1,8,32]){
  const s=resizeObjects(base,'flower',count),sync=[],parallel=[],gaps=[];
  for(let i=0;i<5;i++){
   const frame=normalizeSettings(motionFrame(s,(i+.11)/7)),scene=createLayerScene(frame);
   let t=performance.now();for(const l of scene)if(l.flora&&l.info[2]>0)bakeFlora(l,frame);sync.push(performance.now()-t);
   let last=performance.now();const timer=setInterval(()=>{const now=performance.now();gaps.push(now-last);last=now;},16);
   try{t=performance.now();const fields=await pool.prepare(scene,frame);parallel.push(performance.now()-t);
    check(count+' flowers, phase '+i+': worker field bytes match',fields.every((f,j)=>!f||same(f.pixels,bakeFlora(scene[j],frame).pixels)&&same(f.colors,bakeFlora(scene[j],frame).colors)));
   }finally{clearInterval(timer);}
   await new Promise(r=>setTimeout(r,0));
  }
  const row=document.createElement('tr');for(const value of [count,median(sync).toFixed(1),median(parallel).toFixed(1),Math.max(...gaps).toFixed(1)]){const td=document.createElement('td');td.textContent=value;row.append(td);}document.querySelector('#timings').append(row);
 }
 check('module workers are active',pool.enabled&&pool.workers.length>0);
 const final=await renderer.renderAsync(motionFrame(base,.37),640,360),c=document.createElement('canvas');c.width=640;c.height=360;c.getContext('2d').drawImage(final,0,0);document.querySelector('#image').append(c);
 check('All async render checks passed',true);
}catch(error){out.textContent+='\nERROR '+error.stack;}finally{renderer.destroy();pool.destroy();}
