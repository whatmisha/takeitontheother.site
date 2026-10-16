import {defaults,switchMode} from '../legacy-document.js';
import {LandscapeRenderer} from '../render.js?v=petal-motion-1';
import {motionFrame,renderVideo} from '../motion.js?v=petal-motion-1';
import {getLayers,layerSettingsKey} from '../layer-data.js?v=petal-motion-1';
import {FLOWER_MOTION} from '../flower-motion.js?v=petal-motion-1';
const renderer=new LandscapeRenderer(),out=document.querySelector('#results'),log=[];
const check=(name,ok)=>{log.push((ok?'PASS ':'FAIL ')+name);out.textContent=log.join('\n');if(!ok)throw Error(name);};
const base={...switchMode(defaults,'f'),width:640,height:360,motionAmount:6,motionDuration:4};
const capture=s=>{const c=document.createElement('canvas');c.width=640;c.height=360;c.getContext('2d').drawImage(renderer.render(s,640,360),0,0);return c;};
const pixels=c=>c.getContext('2d').getImageData(0,0,640,360).data;
const difference=(a,b)=>{let total=0;for(let i=0;i<a.length;i++)total+=Math.abs(a[i]-b[i]);return total/a.length;};
try{
 for(const fType of ['radial','cup','fan','lobed']){
  const s={...base,fType},original=JSON.stringify(s),rest=pixels(capture(s));
  const frame=motionFrame(s,.35),moving=capture(frame),layerKey=layerSettingsKey(s.mode);
  const rigid={...frame,[layerKey]:getLayers(frame).map(l=>{const clone={...l};delete clone[FLOWER_MOTION];return clone;})};
  const d=difference(pixels(moving),pixels(capture(rigid)));check(fType+' petals change pixels independently of whole-flower movement',d>.1);
  check(fType+' closes its loop with identical pixels',difference(rest,pixels(capture(motionFrame(s,1))))===0);
  check(fType+' leaves source settings untouched',JSON.stringify(s)===original);
  const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=fType+' · moving petals';figure.append(moving,caption);document.querySelector('#gallery').append(figure);
 }
 const times=[];for(let i=1;i<=12;i++){const t=performance.now();capture(motionFrame(base,i/13));times.push(performance.now()-t);}
 log.push('640 × 360 frame, mean CPU + canvas readback: '+Math.round(times.reduce((a,b)=>a+b,0)/times.length)+' ms');out.textContent=log.join('\n');
 const result=await renderVideo(renderer,{...base,fType:'cup'});
 check('MP4 is encoded',result.blob.size>1000&&String.fromCharCode(...new Uint8Array(await result.blob.slice(4,8).arrayBuffer()))==='ftyp');
 const url=URL.createObjectURL(result.blob),video=document.createElement('video');video.controls=true;video.muted=true;video.loop=true;video.src=url;document.querySelector('#video').append(video);
 await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error('MP4 decode failed'));});
 check('MP4 decodes with expected dimensions',video.videoWidth===640&&video.videoHeight===360);
 const a=document.createElement('a');a.href=url;a.download='flora-petal-motion.mp4';a.textContent='Download animation';document.querySelector('#video').append(a);
 check('All motion checks passed',true);
}catch(error){out.textContent+='\nERROR '+error.stack;}finally{renderer.destroy();}
