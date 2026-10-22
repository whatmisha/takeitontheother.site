import {defaults,switchMode} from '../legacy-document.js';
import {normalizeSettings} from '../document.js?v=unified-document-1';
import {LandscapeRenderer} from '../render.js?v=petal-motion-1';
import {renderVideo,motionFrame} from '../motion.js?v=video-timestamps-1';
import {resizeObjects} from '../object-actions.js?v=petal-motion-1';

const log=[],out=document.querySelector('#results'),progress=document.querySelector('#progress');
const check=(name,ok)=>{log.push((ok?'PASS ':'FAIL ')+name);out.textContent=log.join('\n');if(!ok)throw Error(name);};
const write=text=>{log.push(text);out.textContent=log.join('\n');};
const u32=(bytes,at)=>new DataView(bytes.buffer,bytes.byteOffset+at,4).getUint32(0);
const atom=(bytes,type)=>{const at=new TextDecoder('latin1').decode(bytes).indexOf(type);if(at<0)throw Error('Missing '+type);return at;};
const pixels=source=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#000';ctx.fillRect(0,0,160,90);ctx.drawImage(source,0,0,160,90);return ctx.getImageData(0,0,160,90).data;};
const difference=(a,b)=>{let d=0;for(let i=0;i<a.length;i++)if(i%4!==3)d+=Math.abs(a[i]-b[i]);return d/(a.length*.75);};
const event=(target,type)=>new Promise((resolve,reject)=>{
 const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Video '+type+' failed'));},cleanup=()=>{clearTimeout(timer);target.removeEventListener(type,done);target.removeEventListener('error',fail);};
 const timer=setTimeout(fail,20000);target.addEventListener(type,done,{once:true});target.addEventListener('error',fail,{once:true});
});
try{
 const flowerFlow=normalizeSettings(await (await fetch('../presets/flower-flow.json')).json());
 const six=normalizeSettings(await (await fetch('../presets/six-cup.json')).json());
 const base={...defaults,width:640,height:360,motionDuration:2,motionAmount:8};
 const flowers=(type,count,width=640,height=360)=>resizeObjects({...switchMode(base,'f'),width,height,fType:type,motionDuration:2,motionAmount:8},'flower',count);
 const cases=[
  ['Flower Flow · default 6-second loop',flowerFlow],
  ['Flower Flow · WebKit canvas timestamps',flowerFlow,{webkitTimestamps:true}],
  ['Land',base],['Spot',switchMode(base,'abstract')],['Plant',switchMode(base,'flora')],
  ['Six cup · 1920 × 1080',{...six,motionDuration:2,motionAmount:8}],
  ['Fan · 4 flowers',flowers('fan',4)],['Lobed · 8 flowers · portrait',flowers('lobed',8,360,640)],
  ['Radial · 32 flowers',flowers('radial',32)],
  ['Cup · square 1920',flowers('cup',1,1920,1920)],
  ['Land · 80 ms extra per frame',{...base,width:320,height:180},{slow:true}],
  ['Hidden Background',{...base,width:320,height:180,landscapeLayers:[],backgroundVisible:false},{still:true}],
  ['30-second loop',{...base,width:160,height:90,motionDuration:30}]
 ];
 for(const [name,s,options={}] of cases){
  const renderer=new LandscapeRenderer(),original=JSON.stringify(s),start=performance.now();
  let rendered=0;
  const NativeVideoFrame=globalThis.VideoFrame;
  if(options.webkitTimestamps)globalThis.VideoFrame=class extends NativeVideoFrame{
   constructor(source,init){
    // Reproduce WebKit 321880 even when this suite runs in Chromium.
    const timestamp=Math.trunc((((init.timestamp/1000)/1000)*1000)*1000);
    super(source,{...init,timestamp});
   }
  };
  const source={gl:renderer.gl,async renderAsync(...args){rendered++;if(options.slow){const end=performance.now()+80;while(performance.now()<end){ /* Simulate a render slower than 30 fps. */ }}return renderer.renderAsync(...args);}};
  try{
   const result=await renderVideo(source,s,{onProgress:({message})=>{progress.textContent=name+' · '+message;}});
   const bytes=new Uint8Array(await result.blob.arrayBuffer()),stts=atom(bytes,'stts'),stsz=atom(bytes,'stsz'),mdhd=atom(bytes,'mdhd');
   const frames=u32(bytes,stsz+12),rate=u32(bytes,mdhd+16)/u32(bytes,stts+16),duration=u32(bytes,mdhd+20)/u32(bytes,mdhd+16);
   check(name+' · every frame / 30 fps / exact duration',frames===s.motionDuration*30&&rendered===frames&&rate===30&&duration===s.motionDuration&&u32(bytes,stts+12)===frames);
   const url=URL.createObjectURL(result.blob),video=document.createElement('video');video.controls=true;video.muted=true;video.preload='auto';
   const figure=document.createElement('figure'),caption=document.createElement('figcaption'),link=document.createElement('a');
   caption.textContent=name+' · '+frames+' frames · 30 fps';link.href=url;link.download=name.replace(/[^a-z0-9]+/gi,'-')+'.mp4';link.textContent='Download MP4';figure.append(video,caption,link);document.querySelector('#gallery').append(figure);
   const loaded=event(video,'loadeddata');video.src=url;await loaded;
   check(name+' · MP4 decoder sees exact dimensions and duration',video.videoWidth===result.width&&video.videoHeight===result.height&&Math.abs(video.duration-duration)<.002);
   const samples=[];let maxError=0;
   for(const phase of [.125,.375,.625,.875]){
    const index=Math.floor(frames*phase),seek=event(video,'seeked');video.currentTime=(index+.1)/30;await seek;
    const actual=pixels(video),expected=pixels(renderer.render(motionFrame(s,index/frames),result.width,result.height));samples.push(actual);
    maxError=Math.max(maxError,difference(actual,expected));
   }
   check(name+' · decoded frames match their timeline poses ('+maxError.toFixed(2)+' MAE)',maxError<16);
   if(!options.still)check(name+' · video moves through the loop',difference(samples[0],samples[2])>.2);
   else check(name+' · hidden Background flattens to black',samples[0].every((v,i)=>i%4===3?v===255:v<3));
   check(name+' · source document is unchanged',JSON.stringify(s)===original);
   write('  Export and verification: '+((performance.now()-start)/1000).toFixed(1)+' s');
  }finally{globalThis.VideoFrame=NativeVideoFrame;renderer.destroy();}
 }
 const renderer=new LandscapeRenderer(),controller=new AbortController();
 try{
  let cancelled=false;try{await renderVideo(renderer,base,{signal:controller.signal,onProgress:({current})=>{if(current===3)controller.abort();}});}catch(error){cancelled=error.name==='AbortError';}
  check('Real encoder cancellation',cancelled);
  const result=await renderVideo(renderer,{...base,width:160,height:90});check('Fresh export after cancellation',result.frameCount===60);
 }finally{renderer.destroy();}
 progress.textContent='All video export checks passed';check('All video export checks passed',true);
}catch(error){progress.textContent='Failed';out.textContent+='\nERROR '+error.stack;}
