import {muxAvcToMp4} from '../infra/framework/src/export/mp4Muxer.js';
import {FLOWER_MOTION} from './flower-motion.js?v=petal-motion-1';
import {getLayers,layerSettingsKey} from './layer-data.js?v=petal-motion-1';
export function motionFrame(settings,phase){
 const angle=((phase%1)+1)%1*Math.PI*2,amount=(settings.motionAmount??3)/100,stack=getLayers(settings),aspect=settings.width/settings.height;
 if(!angle||!amount)return settings;
 const groups=new Map();stack.forEach((l,i)=>{if(!l.collection||l.locked)return;const g=groups.get(l.collection)??{members:[],first:i};g.members.push(l);groups.set(l.collection,g);});
 const rotation=Math.sin(angle)*amount*90,a=rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
 return {...settings,[layerSettingsKey(settings.mode)]:stack.map((l,i)=>{
  if(l.locked)return l;const g=groups.get(l.collection),first=g?stack[g.first]:l,index=g?.first??i,p=(first.seed%997)/997*Math.PI*2+index*.7;
  let x=l.x,y=l.y;if(g){const cx=g.members.reduce((v,m)=>v+m.x,0)/g.members.length,cy=g.members.reduce((v,m)=>v+m.y,0)/g.members.length,dx=(l.x-cx)*aspect,dy=l.y-cy;x=cx+(dx*c-dy*sn)/aspect;y=cy+dx*sn+dy*c;}
  return {...l,...(l.flora?.generator==='flower'&&l.visible?{[FLOWER_MOTION]:{angle,amount}}:{}),x:x+(Math.sin(angle+p)-Math.sin(p))*amount,y:y+(Math.cos(angle+p)-Math.cos(p))*amount*.5,rotation:(l.rotation||0)+rotation};
 })};
}

const VIDEO_FPS=30;
const timestampAt=index=>Math.round(index*1_000_000/VIDEO_FPS);

async function videoConfig(width,height,signal){
 if(typeof VideoEncoder==='undefined'||typeof VideoFrame==='undefined'){
  throw Error('Frame-by-frame MP4 export requires a browser with WebCodecs H.264 support.');
 }
 // Ask the browser rather than assuming a particular hardware encoder/profile.
 for(const codec of ['avc1.640028','avc1.640033','avc1.4d4028','avc1.4d4033','avc1.42E028','avc1.42E033']){
  signal?.throwIfAborted();
  const config={codec,width,height,framerate:VIDEO_FPS,bitrate:12_000_000,
   bitrateMode:'variable',latencyMode:'quality',avc:{format:'avc'}};
  try{
   const support=await VideoEncoder.isConfigSupported(config);
   if(support.supported)return support.config;
  }catch{ /* Try the next supported AVC profile. */ }
 }
 throw Error('H.264 encoding is unavailable for this video size in this browser.');
}

export async function renderVideo(renderer,settings,{signal,onProgress=()=>{}}={}){
 signal?.throwIfAborted();
 const scale=Math.min(1,1920/Math.max(settings.width,settings.height));
 const width=Math.max(2,Math.round(settings.width*scale/2)*2);
 const height=Math.max(2,Math.round(settings.height*scale/2)*2);
 const frameCount=Math.round((settings.motionDuration??6)*VIDEO_FPS);
 if(!Number.isFinite(frameCount)||frameCount<1||frameCount>30*VIDEO_FPS)throw Error('Invalid video duration.');
 const config=await videoConfig(width,height,signal);
 signal?.throwIfAborted();
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 let encoder,error,decoderConfig,rejectFailure;
 const chunks=[];
 // Errors/abort must also interrupt dequeue and flush waits, not just the frame loop.
 const failure=new Promise((_,reject)=>{rejectFailure=reject;});
 failure.catch(()=>{});
 const fail=reason=>{error??=reason;rejectFailure(error);};
 const abort=()=>fail(signal.reason??new DOMException('Export cancelled.','AbortError'));
 const assertActive=()=>{signal?.throwIfAborted();if(error)throw error;};
 const wait=async promise=>{
  let timer;
  try{
   return await Promise.race([promise,failure,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('The video encoder stopped responding. Please retry the export.')),30_000);
   })]);
  }finally{clearTimeout(timer);}
 };
 const capacity=async()=>{
  if(encoder.encodeQueueSize<4)return;
  let check;
  const ready=new Promise(resolve=>{
   check=()=>{if(encoder.encodeQueueSize<4)resolve();};
   encoder.addEventListener('dequeue',check);check();
  });
  try{await wait(ready);}finally{encoder.removeEventListener('dequeue',check);}
 };
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Could not allocate the video canvas.');
  encoder=new VideoEncoder({error:fail,output:(chunk,metadata)=>{
   try{
    const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);
    chunks.push({data,timestamp:chunk.timestamp,type:chunk.type});
    const description=metadata?.decoderConfig?.description;
    if(description)decoderConfig=ArrayBuffer.isView(description)
     ?new Uint8Array(description.buffer,description.byteOffset,description.byteLength).slice()
     :new Uint8Array(description).slice();
   }catch(reason){fail(reason);}
  }});
  encoder.configure(config);
  onProgress({current:0,total:frameCount,message:'MP4 · 0 / '+frameCount});
  for(let index=0;index<frameCount;index++){
   assertActive();await capacity();assertActive();
   // Time belongs to the file, never to the CPU clock or canvas capture cadence.
   const surface=renderer.render(motionFrame(settings,index/frameCount),width,height);
   if(renderer.gl?.isContextLost())throw Error('The graphics context was lost during export. Please retry.');
   ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);ctx.drawImage(surface,0,0);
   const frame=new VideoFrame(canvas,{timestamp:timestampAt(index),duration:timestampAt(index+1)-timestampAt(index)});
   try{encoder.encode(frame,{keyFrame:index%VIDEO_FPS===0});}finally{frame.close();}
   onProgress({current:index+1,total:frameCount,message:'MP4 · '+(index+1)+' / '+frameCount});
   // Give progress, Cancel and the encoder a turn even on expensive scenes. A
   // background tab may take longer, but no frame is skipped or timed differently.
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  assertActive();
  onProgress({current:frameCount,total:frameCount,message:'MP4 · Finishing'});
  await wait(encoder.flush());assertActive();
  const timestamps=new Set(chunks.map(chunk=>chunk.timestamp));
  if(chunks.length!==frameCount||timestamps.size!==frameCount||
   Array.from({length:frameCount},(_,i)=>timestampAt(i)).some(t=>!timestamps.has(t))){
   throw Error('The video encoder returned incomplete frames. Please retry the export.');
  }
  const data=muxAvcToMp4({chunks,decoderConfig,width,height,fps:VIDEO_FPS});
  return {blob:new Blob([data],{type:'video/mp4'}),extension:'mp4',width,height,fps:VIDEO_FPS,frameCount,duration:frameCount/VIDEO_FPS};
 }finally{
  signal?.removeEventListener('abort',abort);
  if(encoder&&encoder.state!=='closed')encoder.close();
  canvas.width=canvas.height=1;
 }
}
